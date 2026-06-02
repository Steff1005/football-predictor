import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { notFound } from 'next/navigation'
import { translateTeam } from '../../../lib/team-translations'
import CLUB_CRESTS from '../../../lib/club-crests'
import { computeTourneyRanks } from '../../../lib/rankings'

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
  return {
    title: `${name} — Kickoff`,
    openGraph: {
      title: `${name} — Kickoff`,
      description: `Профіль учасника прогнозів Kickoff`,
      images: [{ url: '/icons/icon-512.png' }],
    },
  }
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

  // Last 10 predictions sorted by match date desc → then reversed for left-to-right display
  const recentForm = [...allPredictions]
    .sort((a, b) => b.match.kickoff_at.localeCompare(a.match.kickoff_at))
    .slice(0, 10)
    .reverse()


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

  const tourneyRankMap = await computeTourneyRanks(supabase, userTournamentIds, id)

  const historyRows = userTournamentIds
    .map(tid => ({
      id: tid, name: tournamentMap[tid] ?? tid,
      rank: tourneyRankMap[tid] ?? null,
      ...(userTourneyStats[tid] ?? { total: 0, exact: 0, correct: 0, predictions: 0 }),
    }))
    .filter(r => r.predictions > 0)
    .sort((a, b) => b.predictions - a.predictions)

  const maxTourneyPts = Math.max(1, ...historyRows.map(r => r.total))

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
        <div className="mb-6 px-1">
          <div className="flex gap-4 mb-3 text-xs text-gray-400 dark:text-gray-500">
            <span>Точність рахунків: <span className="font-medium text-gray-600 dark:text-gray-300">{exactPct}%</span></span>
            <span>Точність результатів: <span className="font-medium text-gray-600 dark:text-gray-300">{correctPct}%</span></span>
          </div>
          {recentForm.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">Остання форма ({recentForm.length} прогнозів)</div>
              <div className="flex gap-1.5 items-center">
                {recentForm.map((p, i) => {
                  const color = p.points === 4
                    ? 'bg-yellow-400 title="4 бали — точний рахунок"'
                    : p.points === 1
                      ? 'bg-green-500'
                      : 'bg-red-400'
                  const title = p.points === 4 ? '4 бали — точний рахунок' : p.points === 1 ? '1 бал — правильний результат' : '0 балів'
                  return (
                    <div
                      key={i}
                      title={title}
                      className={`w-5 h-5 rounded-md flex-shrink-0 ${
                        p.points === 4 ? 'bg-yellow-400' : p.points === 1 ? 'bg-green-500' : 'bg-red-400'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tournament history ── */}
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
                      <td className="px-3 py-2.5 min-w-[80px]">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${Math.round(r.total / maxTourneyPts * 100)}%` }} />
                          </div>
                          <span className="font-bold text-green-500 dark:text-green-400 tabular-nums w-6 text-right">{r.total}</span>
                        </div>
                      </td>
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

      {/* Predictions section intentionally hidden on public profile */}
    </div>
  )
}
