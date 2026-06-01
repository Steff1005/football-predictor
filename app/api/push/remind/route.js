import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '../../../../lib/push-send'
import { translateTeam } from '../../../../lib/team-translations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Matches starting in 20–40 min from now
  const from = new Date(now.getTime() + 20 * 60 * 1000).toISOString()
  const to   = new Date(now.getTime() + 40 * 60 * 1000).toISOString()

  const { data: matches } = await supabase
    .from('matches')
    .select('id, home_team, away_team, kickoff_at')
    .gte('kickoff_at', from)
    .lte('kickoff_at', to)
    .eq('status', 'scheduled')

  if (!matches?.length) return Response.json({ sent: 0 })

  // Find users with notify_reminder=true who have push subscriptions
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('notify_reminder', true)

  const userIds = (profiles ?? []).map(p => p.id)
  if (!userIds.length) return Response.json({ sent: 0 })

  // Filter to users who actually have a push subscription
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .in('user_id', userIds)

  const subscribedIds = [...new Set((subs ?? []).map(s => s.user_id))]
  if (!subscribedIds.length) return Response.json({ sent: 0 })

  let sent = 0

  for (const match of matches) {
    const matchIds = [match.id]

    // Find who already has a prediction for this match
    const { data: preds } = await supabase
      .from('predictions')
      .select('user_id')
      .in('user_id', subscribedIds)
      .in('match_id', matchIds)

    const alreadyPredicted = new Set((preds ?? []).map(p => p.user_id))

    const targets = subscribedIds.filter(id => !alreadyPredicted.has(id))
    if (!targets.length) continue

    const home = translateTeam(match.home_team)
    const away = translateTeam(match.away_team)
    const time = new Date(match.kickoff_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })

    for (const userId of targets) {
      await sendPushToUser(supabase, userId, {
        title: '⏰ Матч за 30 хвилин!',
        body: `${home} — ${away} о ${time}. Прогноз ще не зроблено.`,
        url: '/tournaments',
      })
      sent++
    }
  }

  return Response.json({ sent })
}
