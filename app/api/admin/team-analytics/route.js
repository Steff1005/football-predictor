import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../../../../lib/admin'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || !isAdminEmail(session.user.email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: tournament } = await db
    .from('tournaments')
    .select('id, name')
    .ilike('name', '%Ліга чемпіонів%')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 })

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score')
    .eq('tournament_id', tournament.id)
    .eq('status', 'finished')
    .not('home_score', 'is', null)

  const matchIds = (matches ?? []).map(m => m.id)
  if (!matchIds.length) return Response.json({ tournament, matches: [], predictions: [], profiles: [] })

  // Fetch in chunks of 500 to avoid URL length limits
  let predictions = []
  for (let i = 0; i < matchIds.length; i += 500) {
    const { data } = await db
      .from('predictions')
      .select('user_id, match_id, predicted_home, predicted_away, points')
      .in('match_id', matchIds.slice(i, i + 500))
      .eq('is_calculated', true)
    if (data) predictions = predictions.concat(data)
  }

  const userIds = [...new Set(predictions.map(p => p.user_id))]
  const { data: profiles } = await db
    .from('profiles')
    .select('id, first_name, last_name, username')
    .in('id', userIds)

  return Response.json({ tournament, matches, predictions, profiles })
}
