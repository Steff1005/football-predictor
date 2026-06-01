import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import TournamentFilter from './TournamentFilter'
import AvatarUpload from './AvatarUpload'
import ProfileSettings from './ProfileSettings'
import ProfilePredictions from './ProfilePredictions'
import NotificationSettings from './NotificationSettings'
import { translateTeam } from '../../lib/team-translations'
import CLUB_CRESTS from '../../lib/club-crests'
import { computeTourneyRanks } from '../../lib/rankings'

export const metadata = { title: 'Профіль — Kickoff' }

export default async function ProfilePage({ searchParams }) {
  const { tournament: tournamentFilter = 'all' } = await searchParams

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth')

  const userId = session.user.id

  const [
    { data: profile },
    { data: rawPredictions },
    { data: tournaments },
  ] = await Promise.all([
    supabase.from('profiles').select('username, first_name, last_name, total_points, total_predictions, avatar_url, notify_results, notify_reminder').eq('id', userId).single(),
    supabase.from('predictions').select('*').eq('user_id', userId),
    supabase.from('tournaments').select('id, name').order('name'),
  ])

  const matchIds = rawPredictions?.map(p => p.match_id) ?? []
  let matchMap = {}
  if (matchIds.length > 0) {
    const CHUNK = 200
    const allMatches = []
    for (let i = 0; i < matchIds.length; i += CHUNK) {
      const { data } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_logo, away_logo, home_score, away_score, status, kickoff_at, tournament_id, round')
        .in('id', matchIds.slice(i, i + CHUNK))
      if (data) allMatches.push(...data)
    }
    allMatches.forEach(m => {
      const ht = translateTeam(m.home_team)
      const at = translateTeam(m.away_team)
      matchMap[m.id] = {
        ...m,
        home_team: ht,
        away_team: at,
        home_logo: m.home_logo ?? CLUB_CRESTS[ht] ?? null,
        away_logo: m.away_logo ?? CLUB_CRESTS[at] ?? null,
      }
    })
  }

  const allPredictions = (rawPredictions ?? [])
    .map(p => ({ ...p, match: matchMap[p.match_id] }))
    .filter(p => p.match)
    .sort((a, b) => new Date(b.match.kickoff_at) - new Date(a.match.kickoff_at))

  const filtered = tournamentFilter === 'all'
    ? allPredictions
    : allPredictions.filter(p => p.match.tournament_id === tournamentFilter)

  const finished = allPredictions.filter(p => p.points !== null)
  const totalPoints  = finished.reduce((s, p) => s + (p.points ?? 0), 0)
  const exactScores  = finished.filter(p => p.points === 4).length
  const correctResults = finished.filter(p => p.points === 1).length

  const exactPct   = finished.length > 0 ? Math.round(exactScores   / finished.length * 100) : 0
  const correctPct = finished.length > 0 ? Math.round(correctResults / finished.length * 100) : 0

  const fullName   = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || profile?.username || session.user.email?.split('@')[0] || 'Гравець'
  const initials   = (profile?.first_name?.[0] ?? displayName[0] ?? '?').toUpperCase() +
                     (profile?.last_name?.[0]  ?? displayName[1] ?? '').toUpperCase()

  // ── Tournament history ────────────────────────────────────────────────────
  const userTournamentIds = [...new Set(allPredictions.map(p => p.match.tournament_id))]

  // Per-tournament stats for the current user (finished predictions only)
  const userTourneyStats = {}
  for (const p of allPredictions) {
    const tid = p.match.tournament_id
    if (!userTourneyStats[tid]) userTourneyStats[tid] = { total: 0, exact: 0, correct: 0, predictions: 0 }
    if (p.points !== null) {
      const s = userTourneyStats[tid]
      s.predictions++
      s.total += p.points
      if (p.points === 4) s.exact++
      if (p.points === 1) s.correct++
    }
  }

  const tourneyRankMap = await computeTourneyRanks(supabase, userTournamentIds, userId)

  // Tournament map for display names
  const tournamentMap = {}
  ;(tournaments ?? []).forEach(t => { tournamentMap[t.id] = t.name })

  // Build history rows sorted by most predictions first
  const historyRows = userTournamentIds
    .map(tid => ({
      id: tid,
      name: tournamentMap[tid] ?? tid,
      rank: tourneyRankMap[tid] ?? null,
      ...userTourneyStats[tid] ?? { total: 0, exact: 0, correct: 0, predictions: 0 },
    }))
    .filter(r => r.predictions > 0)
    .sort((a, b) => b.predictions - a.predictions)

  function rankBadge(rank) {
    if (!rank) return <span className="text-gray-400">—</span>
    if (rank === 1) return <span>🥇</span>
    if (rank === 2) return <span>🥈</span>
    if (rank === 3) return <span>🥉</span>
    return <span className="text-gray-700 dark:text-gray-300">{rank}</span>
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header + accordion settings */}
      <div className="flex items-start gap-4 mb-6">
        <AvatarUpload userId={userId} avatarUrl={profile?.avatar_url} initials={initials} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{session.user.email}</p>
          <ProfileSettings
            initialFirst={profile?.first_name ?? ''}
            initialLast={profile?.last_name ?? ''}
            initialUsername={profile?.username ?? ''}
          />
          <NotificationSettings
            initialPrefs={{
              notify_results: profile?.notify_results ?? true,
              notify_reminder: profile?.notify_reminder ?? true,
            }}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{finished.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Прогнозів</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-green-500 dark:text-green-400">{totalPoints}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Балів</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{exactScores}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Точних рахунків</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">{correctResults}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Правильних результатів</div>
        </div>
      </div>

      {/* Accuracy */}
      {finished.length > 0 && (
        <div className="flex gap-4 mb-8 text-xs text-gray-400 dark:text-gray-500 px-1">
          <span>Точність рахунків: <span className="font-medium text-gray-600 dark:text-gray-300">{exactPct}%</span></span>
          <span>Точність результатів: <span className="font-medium text-gray-600 dark:text-gray-300">{correctPct}%</span></span>
        </div>
      )}

      {/* Tournament history */}
      {historyRows.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Історія турнірів</h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 flex">
            {/* Fixed: Турнір column */}
            <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
              <table className="text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 min-w-[140px]">Турнір</th>
                    <th className="text-center px-3 py-2.5">Місце</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <a href={`/tournaments/${r.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition-colors">
                          {r.name}
                        </a>
                      </td>
                      <td className="text-center px-3 py-2.5">{rankBadge(r.rank)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Scrollable: remaining columns */}
            <div className="overflow-x-auto scrollbar-hide flex-1 min-w-0">
              <table className="text-sm w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    <th className="text-right px-3 py-2.5">Балів</th>
                    <th className="text-right px-3 py-2.5">Прогн.</th>
                    <th className="text-right px-3 py-2.5">Точних</th>
                    <th className="text-right px-3 py-2.5 pr-4">Правил.</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                      <td className="text-right px-3 py-2.5 font-bold text-green-500 dark:text-green-400">{r.total}</td>
                      <td className="text-right px-3 py-2.5 text-gray-600 dark:text-gray-300">{r.predictions}</td>
                      <td className="text-right px-3 py-2.5 text-yellow-500 dark:text-yellow-400">{r.exact}</td>
                      <td className="text-right px-3 py-2.5 pr-4 text-blue-500 dark:text-blue-400">{r.correct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Predictions list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Мої прогнози</h2>
        {tournaments && tournaments.length > 1 && (
          <TournamentFilter tournaments={tournaments} current={tournamentFilter} />
        )}
      </div>

      <ProfilePredictions predictions={filtered} />
    </div>
  )
}
