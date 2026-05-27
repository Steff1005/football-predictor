import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { notFound } from 'next/navigation'
import { translateTeam } from '../../../lib/team-translations'
import PlayerUpcomingPredictions from './PlayerUpcomingPredictions'
import CLUB_CRESTS from '../../../lib/club-crests'

const PAGE = 1000
async function fetchAll(supabase, buildQuery) {
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

function StaticAvatar({ avatarUrl, initials }) {
  if (avatarUrl) return (
    <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
  )
  return (
    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
      <span className="text-2xl font-bold text-green-600 dark:text-green-400">{initials}</span>
    </div>
  )
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [] } }
  )
  const { data: profile } = await supabase.from('profiles')
    .select('first_name, last_name, username').eq('id', id).single()
  if (!profile) return { title: 'Профіль — Kickoff' }
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Гравець'
  return { title: `${name} — Kickoff` }
}

export default async function PlayerProfilePage({ params }) {
  const { id } = await params

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const isOwn = session?.user?.id === id

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, first_name, last_name, avatar_url')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const fullName    = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  const displayName = fullName || profile.username || 'Гравець'
  const initials    = (profile.first_name?.[0] ?? displayName[0] ?? '?').toUpperCase() +
                      (profile.last_name?.[0]  ?? displayName[1] ?? '').toUpperCase()

  // ── Finished predictions (for stats + history only) ─────────────────────────
  const rawPredictions = await fetchAll(supabase, (from, to) =>
    supabase.from('predictions')
      .select('id, match_id, points')
      .eq('user_id', id)
      .not('points', 'is', null)
      .range(from, to)
  )

  const finishedMatchIds = rawPredictions.map(p => p.match_id)
  let finishedMatchMap = {}
  if (finishedMatchIds.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < finishedMatchIds.length; i += CHUNK) {
      const { data } = await supabase
        .from('matches')
        .select('id, status, kickoff_at, tournament_id')
        .in('id', finishedMatchIds.slice(i, i + CHUNK))
      if (data) data.forEach(m => { finishedMatchMap[m.id] = m })
    }
  }

  const allPredictions = rawPredictions
    .map(p => ({ ...p, match: finishedMatchMap[p.match_id] }))
    .filter(p => p.match && p.match.status === 'finished')

  // ── Upcoming scheduled matches — only from tournaments the player plays in ────
  // Find active tournament IDs: where player made ≥1 prediction
  const activeTournamentIds = [...new Set(
    rawPredictions.map(p => finishedMatchMap[p.match_id]?.tournament_id).filter(Boolean)
  )]

  let rawScheduled = []
  if (activeTournamentIds.length > 0) {
    const { data } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_logo, away_logo, kickoff_at, tournament_id, round, status')
      .eq('status', 'scheduled')
      .in('tournament_id', activeTournamentIds)
      .order('kickoff_at', { ascending: true })
    rawScheduled = data ?? []
  }

  const scheduledIds = rawScheduled.map(m => m.id)
  const scheduledPredMap = {}
  if (scheduledIds.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < scheduledIds.length; i += CHUNK) {
      const { data: preds } = await supabase
        .from('predictions')
        .select('match_id, predicted_home, predicted_away')
        .eq('user_id', id)
        .in('match_id', scheduledIds.slice(i, i + CHUNK))
      preds?.forEach(p => { scheduledPredMap[p.match_id] = p })
    }
  }

  const upcomingItems = rawScheduled.map(m => {
    const ht   = translateTeam(m.home_team)
    const at   = translateTeam(m.away_team)
    const pred = scheduledPredMap[m.id]
    return {
      id:             m.id,
      hasPrediction:  !!pred,
      predicted_home: isOwn ? (pred?.predicted_home ?? null) : null,
      predicted_away: isOwn ? (pred?.predicted_away ?? null) : null,
      match: {
        ...m,
        home_team: ht, away_team: at,
        home_logo: m.home_logo ?? CLUB_CRESTS[ht] ?? null,
        away_logo: m.away_logo ?? CLUB_CRESTS[at] ?? null,
      },
    }
  })

  const totalPoints     = allPredictions.reduce((s, p) => s + (p.points ?? 0), 0)
  const exactScores     = allPredictions.filter(p => p.points === 4).length
  const correctResults  = allPredictions.filter(p => p.points === 1).length
  const exactPct        = allPredictions.length > 0 ? Math.round(exactScores    / allPredictions.length * 100) : 0
  const correctPct      = allPredictions.length > 0 ? Math.round(correctResults / allPredictions.length * 100) : 0

  // ── Tournament history ────────────────────────────────────────────────────────
  const { data: tournaments } = await supabase.from('tournaments').select('id, name').order('name')
  const tournamentMap = Object.fromEntries((tournaments ?? []).map(t => [t.id, t.name]))

  const userTournamentIds = [...new Set(allPredictions.map(p => p.match.tournament_id))]
  const userTourneyStats  = {}
  for (const p of allPredictions) {
    const tid = p.match.tournament_id
    if (!userTourneyStats[tid]) userTourneyStats[tid] = { total: 0, exact: 0, correct: 0, predictions: 0 }
    const s = userTourneyStats[tid]
    s.predictions++; s.total += p.points
    if (p.points === 4) s.exact++
    if (p.points === 1) s.correct++
  }

  let tourneyRankMap = {}
  if (userTournamentIds.length > 0) {
    const { data: tourneyMatches } = await supabase
      .from('matches').select('id, tournament_id')
      .in('tournament_id', userTournamentIds)
    const allTMIds = tourneyMatches?.map(m => m.id) ?? []
    const midToTid = {}
    tourneyMatches?.forEach(m => { midToTid[m.id] = m.tournament_id })

    if (allTMIds.length > 0) {
      let rankPreds = []
      const CHUNK = 200
      for (let i = 0; i < allTMIds.length; i += CHUNK) {
        const chunk = allTMIds.slice(i, i + CHUNK)
        const chunkPreds = await fetchAll(supabase, (from, to) =>
          supabase.from('predictions').select('user_id, match_id, points')
            .in('match_id', chunk).not('points', 'is', null).range(from, to)
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
        const rank = sorted.findIndex(([uid]) => uid === id) + 1
        tourneyRankMap[tid] = rank > 0 ? rank : null
      }
    }
  }

  const historyRows = userTournamentIds
    .map(tid => ({
      id: tid, name: tournamentMap[tid] ?? tid,
      rank: tourneyRankMap[tid] ?? null,
      ...(userTourneyStats[tid] ?? { total: 0, exact: 0, correct: 0, predictions: 0 }),
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

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <StaticAvatar avatarUrl={profile.avatar_url} initials={initials} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
          {isOwn && (
            <a href="/profile"
              className="text-sm text-green-500 hover:text-green-400 transition-colors">
              Редагувати профіль →
            </a>
          )}
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{allPredictions.length}</div>
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

      {allPredictions.length > 0 && (
        <div className="flex gap-4 mb-8 text-xs text-gray-400 dark:text-gray-500 px-1">
          <span>Точність рахунків: <span className="font-medium text-gray-600 dark:text-gray-300">{exactPct}%</span></span>
          <span>Точність результатів: <span className="font-medium text-gray-600 dark:text-gray-300">{correctPct}%</span></span>
        </div>
      )}

      {/* ── Tournament history ── */}
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

      {/* ── Upcoming scheduled matches ── */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Прогнози</h2>
      <PlayerUpcomingPredictions items={upcomingItems} isOwn={isOwn} />
    </div>
  )
}
