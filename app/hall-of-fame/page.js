import { createServerClient } from '@supabase/ssr'
import TOURNAMENT_LOGOS from '../../lib/tournament-logos'
import { compareTournamentStandings } from '../../lib/rankings'
import HallOfFamePageClient from '../../components/HallOfFamePageClient'

export const revalidate = 300
export const metadata = { title: 'Зал слави — Kickoff' }

async function fetchStandings(supabase, tournamentId) {
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
  if (!matches?.length) return []

  const matchIds = matches.map(m => m.id)
  const PAGE = 1000
  let preds = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('predictions')
      .select('user_id, points')
      .in('match_id', matchIds)
      .not('points', 'is', null)
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    preds = preds.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const userStats = {}
  for (const p of preds) {
    if (!userStats[p.user_id]) userStats[p.user_id] = { total: 0, exact: 0, results: 0, predictions: 0 }
    userStats[p.user_id].predictions++
    userStats[p.user_id].total += p.points ?? 0
    if (p.points === 4) userStats[p.user_id].exact++
    if (p.points === 1) userStats[p.user_id].results++
  }

  const userIds = Object.keys(userStats)
  if (!userIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name, avatar_url')
    .in('id', userIds)
  const profileMap = {}
  ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })

  return Object.entries(userStats)
    .map(([uid, stats]) => ({ uid, ...stats, profile: profileMap[uid] }))
    .filter(s => s.profile)
    .sort(compareTournamentStandings)
}

export default async function HallOfFamePage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [] } }
  )

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', false)

  if (!tournaments?.length) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">🏛️</span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Зал слави</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Переможці завершених турнірів · Медальний залік</p>
          </div>
        </div>
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-5xl mb-4">🏛️</p>
          <p>Завершених турнірів ще немає</p>
        </div>
      </div>
    )
  }

  const { data: matchDates } = await supabase
    .from('matches')
    .select('tournament_id, kickoff_at')
    .in('tournament_id', tournaments.map(t => t.id))

  const lastMatchDate = {}
  for (const m of matchDates ?? []) {
    if (!lastMatchDate[m.tournament_id] || m.kickoff_at > lastMatchDate[m.tournament_id]) {
      lastMatchDate[m.tournament_id] = m.kickoff_at
    }
  }

  const sorted = [...tournaments].sort((a, b) =>
    (lastMatchDate[b.id] ?? '').localeCompare(lastMatchDate[a.id] ?? '')
  )

  const enriched = await Promise.all(
    sorted.map(async t => ({
      tournament: t,
      lastDate: lastMatchDate[t.id] ?? null,
      standings: await fetchStandings(supabase, t.id),
    }))
  )

  const withResults = enriched.filter(e => e.standings.length > 0)

  // Medal tally across all tournaments
  const medalMap = {}
  for (const { standings } of withResults) {
    standings.slice(0, 3).forEach((row, i) => {
      if (!medalMap[row.uid]) medalMap[row.uid] = { gold: 0, silver: 0, bronze: 0, profile: row.profile }
      if (i === 0) medalMap[row.uid].gold++
      else if (i === 1) medalMap[row.uid].silver++
      else medalMap[row.uid].bronze++
    })
  }
  const medalRows = Object.entries(medalMap)
    .map(([uid, d]) => ({ uid, ...d, total: d.gold + d.silver + d.bronze }))
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze)

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <span className="text-4xl">🏛️</span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Зал слави</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Переможці завершених турнірів · Медальний залік</p>
        </div>
      </div>

      <HallOfFamePageClient
        enriched={withResults}
        medalRows={medalRows}
        tournamentLogos={TOURNAMENT_LOGOS}
      />
    </div>
  )
}
