import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import TournamentFilter from './TournamentFilter'
import AvatarUpload from './AvatarUpload'
import ProfileSettings from './ProfileSettings'
import PredictionBadge from '../../components/PredictionBadge'
import { getRoundLabel } from '../../lib/round-sort'
import { translateTeam } from '../../lib/team-translations'
import CLUB_CRESTS from '../../lib/club-crests'

export const metadata = { title: 'Профіль — Kickoff' }

const PAGE = 1000
async function fetchAll(buildQuery) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error || !data?.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

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
    supabase.from('profiles').select('username, first_name, last_name, total_points, total_predictions, avatar_url').eq('id', userId).single(),
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

  // Fetch all matches in those tournaments to compute proper rankings
  let tourneyRankMap = {}
  if (userTournamentIds.length > 0) {
    const { data: tourneyMatches } = await supabase
      .from('matches')
      .select('id, tournament_id')
      .in('tournament_id', userTournamentIds)

    const allTMIds  = tourneyMatches?.map(m => m.id) ?? []
    const midToTid  = {}
    tourneyMatches?.forEach(m => { midToTid[m.id] = m.tournament_id })

    if (allTMIds.length > 0) {
      const CHUNK = 200
      let rankPreds = []
      for (let i = 0; i < allTMIds.length; i += CHUNK) {
        const chunk = allTMIds.slice(i, i + CHUNK)
        const chunkPreds = await fetchAll((from, to) =>
          supabase.from('predictions')
            .select('user_id, match_id, points')
            .in('match_id', chunk)
            .not('points', 'is', null)
            .range(from, to)
        )
        rankPreds = rankPreds.concat(chunkPreds)
      }

      const tidUsers = {}
      for (const p of rankPreds) {
        const tid = midToTid[p.match_id]
        if (!tid) continue
        if (!tidUsers[tid]) tidUsers[tid] = {}
        if (!tidUsers[tid][p.user_id]) tidUsers[tid][p.user_id] = { total: 0, exact: 0, correct: 0, preds: 0 }
        const u = tidUsers[tid][p.user_id]
        u.preds++; u.total += p.points
        if (p.points === 4) u.exact++
        if (p.points === 1) u.correct++
      }

      for (const [tid, users] of Object.entries(tidUsers)) {
        const sorted = Object.entries(users).sort(([, a], [, b]) =>
          b.total - a.total || b.exact - a.exact || b.correct - a.correct || b.preds - a.preds
        )
        const rank = sorted.findIndex(([uid]) => uid === userId) + 1
        tourneyRankMap[tid] = rank > 0 ? rank : null
      }
    }
  }

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
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <AvatarUpload userId={userId} avatarUrl={profile?.avatar_url} initials={initials} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{session.user.email}</p>
        </div>
      </div>

      {/* Settings: edit profile + change password */}
      <ProfileSettings
        initialFirst={profile?.first_name ?? ''}
        initialLast={profile?.last_name ?? ''}
        initialUsername={profile?.username ?? ''}
      />

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
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 sticky left-0 z-10 bg-white dark:bg-gray-900 min-w-[140px] border-r border-gray-200 dark:border-gray-800">Турнір</th>
                    <th className="text-center px-3 py-2.5">Місце</th>
                    <th className="text-right px-3 py-2.5">Балів</th>
                    <th className="text-right px-3 py-2.5">Прогн.</th>
                    <th className="text-right px-3 py-2.5">Точних</th>
                    <th className="text-right px-3 py-2.5 pr-4">Правил.</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((r, i) => (
                    <tr key={r.id}
                      className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${
                        i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/30'
                      }`}>
                      <td className="px-4 py-2.5 sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
                        <a href={`/tournaments/${r.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-green-500 dark:hover:text-green-400 transition-colors">
                          {r.name}
                        </a>
                      </td>
                      <td className="text-center px-3 py-2.5 text-base">{rankBadge(r.rank)}</td>
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

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p>Прогнозів ще немає</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const m = p.match
            const kickoff  = new Date(m.kickoff_at)
            const dateStr  = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
            const timeStr  = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })
            const roundLabel = getRoundLabel(m.round)
            const isFinished = m.status === 'finished'

            return (
              <div key={p.id} className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
                {/* Top: date/time + round */}
                <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500 mb-2">
                  <span>{dateStr}, {timeStr}</span>
                  {roundLabel && <span>{roundLabel}</span>}
                </div>

                {/* Teams */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate text-right">{m.home_team}</span>
                    {m.home_logo && <img src={m.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">vs</span>
                  <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
                    {m.away_logo && <img src={m.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.away_team}</span>
                  </div>
                </div>

                {/* 3-column: Прогноз | Рахунок | Статус */}
                <div className="grid grid-cols-3 text-center pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Прогноз</div>
                    <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      {p.predicted_home}:{p.predicted_away}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Рахунок</div>
                    <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      {isFinished ? `${m.home_score}:${m.away_score}` : '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Статус</div>
                    <PredictionBadge pts={p.points} pending={!isFinished} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
