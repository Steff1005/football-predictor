import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import CLUB_CRESTS from '../../lib/club-crests'
import TOURNAMENT_LOGOS from '../../lib/tournament-logos'
import { translateTeam } from '../../lib/team-translations'
import LiveAllClient from './LiveAllClient'

export const revalidate = 30
export const metadata = { title: 'Live — Kickoff' }

export default async function LivePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const now = new Date()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, league_id')
    .eq('is_active', true)

  if (!tournaments?.length) {
    return <Empty />
  }

  // Fetch live matches for all active tournaments in parallel
  const groups = (
    await Promise.all(
      tournaments.map(async tournament => {
        const { data: rawMatches } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .lte('kickoff_at', now.toISOString())
          .neq('status', 'finished')
          .order('kickoff_at', { ascending: true })

        if (!rawMatches?.length) return null

        const matches = rawMatches.map(m => ({
          ...m,
          home_logo: m.home_logo ?? CLUB_CRESTS[m.home_team] ?? null,
          away_logo: m.away_logo ?? CLUB_CRESTS[m.away_team] ?? null,
          home_team: translateTeam(m.home_team),
          away_team: translateTeam(m.away_team),
        }))

        const matchIds = matches.map(m => m.id)

        const { data: preds } = await supabase
          .from('predictions')
          .select('user_id, match_id, predicted_home, predicted_away')
          .in('match_id', matchIds)

        const userIds = [...new Set((preds ?? []).map(p => p.user_id))]
        let profileMap = {}
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', userIds)
          ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })
        }

        const predsByMatch = {}
        for (const p of preds ?? []) {
          if (!predsByMatch[p.match_id]) predsByMatch[p.match_id] = []
          predsByMatch[p.match_id].push(p)
        }

        return {
          tournament: {
            ...tournament,
            logo: TOURNAMENT_LOGOS[tournament.league_id] ?? null,
          },
          matches,
          predsByMatch,
          profileMap,
        }
      })
    )
  ).filter(Boolean)

  if (!groups.length) return <Empty />

  return <LiveAllClient groups={groups} />
}

function Empty() {
  return (
    <div className="text-center py-20 text-gray-400 dark:text-gray-600">
      <p className="text-5xl mb-4">🟡</p>
      <p className="text-sm">Зараз немає матчів, що тривають</p>
    </div>
  )
}
