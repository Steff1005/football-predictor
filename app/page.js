import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import TOURNAMENT_LOGOS from '../lib/tournament-logos'
import { formatBaly, formatPrognazy } from '../lib/formatters'
import AnalyticsTable from '../components/AnalyticsTable'
import RealtimeRefresher from '../components/RealtimeRefresher'
import Avatar from '../components/Avatar'
import FormDots from '../components/FormDots'
import HallOfFame from '../components/HallOfFame'

export const revalidate = 60

export const metadata = {
  title: 'Kickoff — Футбольні прогнози',
  openGraph: {
    title: 'Kickoff — Футбольні прогнози',
    description: 'Змагайтеся з друзями у прогнозуванні футбольних матчів',
    images: [{ url: '/icons/icon-512.png' }],
  },
}

const LEAGUE_EMOJI = { WC: '🌍', CL: '⭐', EC: '🇪🇺' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}

function pini(p) {
  const n = pdn(p)
  return n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

function fmtNum(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('uk-UA').format(n)
}

function pct(a, b) {
  return b > 0 ? Math.round(a / b * 100) : 0
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-xl leading-none">🥇</span>
  if (rank === 2) return <span className="text-xl leading-none">🥈</span>
  if (rank === 3) return <span className="text-xl leading-none">🥉</span>
  return <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{rank}</span>
}

// pts: undefined = no prediction shown, null = unscored, 0/1/4 = scored
function FormDot({ pts }) {
  if (pts == null)  return <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 inline-block flex-shrink-0" />
  if (pts === 4)    return <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block flex-shrink-0" title="4 бали — точний рахунок" />
  if (pts === 1)    return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block flex-shrink-0" title="1 бал — правильний результат" />
  return              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block flex-shrink-0" title="0 балів" />
}

// ── Data helpers ──────────────────────────────────────────────────────────────

// Fix #8: filter by match IDs from loaded tournaments instead of full table scan
async function fetchPagedPreds(supabase, matchIds) {
  if (!matchIds?.length) return []
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('predictions')
      .select('user_id, match_id, points, predicted_home, predicted_away')
      .in('match_id', matchIds)
      .eq('is_calculated', true)
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // ── Phase 1: core ────────────────────────────────────────────────────────────
  const [{ data: tournaments }, { data: allProfiles }] = await Promise.all([
    supabase.from('tournaments').select('*'),
    supabase.from('profiles')
      .select('id, username, first_name, last_name, avatar_url, total_points, total_predictions')
      .order('total_points', { ascending: false }),
  ])

  const now = new Date()
  const activeTournaments  = (tournaments ?? []).filter(t =>  t.is_active).sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  const finishedTournaments = (tournaments ?? []).filter(t => !t.is_active).sort((a, b) => b.name.localeCompare(a.name, 'uk'))
  const activeTids   = activeTournaments.map(t => t.id)
  const finishedTids = finishedTournaments.map(t => t.id)

  // ── Phase 2: match metadata ───────────────────────────────────────────────────
  const [activeMatchesResult, finishedTourneyMatchesResult] = await Promise.all([
    activeTids.length > 0
      ? supabase.from('matches').select('id, tournament_id, status, kickoff_at, home_team, away_team, home_score, away_score').in('tournament_id', activeTids).order('kickoff_at', { ascending: false })
      : { data: [] },
    finishedTids.length > 0
      ? supabase.from('matches').select('id, tournament_id, kickoff_at, home_team, away_team, home_score, away_score').in('tournament_id', finishedTids)
      : { data: [] },
  ])

  const allActiveMatches        = activeMatchesResult.data ?? []
  const finishedTourneyMatches  = finishedTourneyMatchesResult.data ?? []

  // Match lookup maps
  const matchDateMap      = {}
  const matchInfoMap      = {}
  const matchTidMap       = {}
  const finishedMatchIdSet = new Set()
  for (const m of allActiveMatches) {
    matchDateMap[m.id] = m.kickoff_at
    matchTidMap[m.id]  = m.tournament_id
    matchInfoMap[m.id] = { home: m.home_team, away: m.away_team, scoreH: m.home_score, scoreA: m.away_score }
    if (m.status === 'finished') finishedMatchIdSet.add(m.id)
  }

  // Compute last match date per finished tournament for sorting
  const finishedLastDate = {}
  for (const m of finishedTourneyMatches) {
    if (!finishedLastDate[m.tournament_id] || m.kickoff_at > finishedLastDate[m.tournament_id]) {
      finishedLastDate[m.tournament_id] = m.kickoff_at
    }
    matchDateMap[m.id] = m.kickoff_at
    matchTidMap[m.id]  = m.tournament_id
    matchInfoMap[m.id] = { home: m.home_team, away: m.away_team, scoreH: m.home_score, scoreA: m.away_score }
    finishedMatchIdSet.add(m.id)  // all matches from finished tournaments are finished
  }

  // Sort finished tournaments by last match date descending
  finishedTournaments.sort((a, b) =>
    (finishedLastDate[b.id] ?? '').localeCompare(finishedLastDate[a.id] ?? '')
  )

  // Active tournament stats
  const activeMatchStats = {}
  for (const m of allActiveMatches) {
    if (!activeMatchStats[m.tournament_id]) activeMatchStats[m.tournament_id] = { total: 0, finished: 0, upcomingIds: [] }
    const s = activeMatchStats[m.tournament_id]
    s.total++
    if (m.status === 'finished') s.finished++
    else if (new Date(m.kickoff_at) > now) s.upcomingIds.push(m.id)
  }

  const allUpcomingIds = activeTournaments.flatMap(t => activeMatchStats[t.id]?.upcomingIds ?? [])

  const allRelevantMatchIds = [
    ...allActiveMatches.map(m => m.id),
    ...finishedTourneyMatches.map(m => m.id),
  ]

  // ── Phase 3: predictions ──────────────────────────────────────────────────────
  const [allScoredPreds, userUpcomingPredsResult] = await Promise.all([
    fetchPagedPreds(supabase, allRelevantMatchIds),
    userId && allUpcomingIds.length > 0
      ? supabase.from('predictions').select('match_id').eq('user_id', userId).in('match_id', allUpcomingIds)
      : Promise.resolve({ data: [] }),
  ])

  const userPredictedIds = new Set((userUpcomingPredsResult.data ?? []).map(p => p.match_id))

  // ── Analytics: per-user stats ─────────────────────────────────────────────────
  const userAnalytics = {}
  for (const p of allScoredPreds) {
    if (!userAnalytics[p.user_id]) userAnalytics[p.user_id] = { scored: 0, exact: 0, correct: 0 }
    const s = userAnalytics[p.user_id]
    s.scored++
    if (p.points === 4) s.exact++
    if (p.points === 1) s.correct++
  }

  // ── Form: per-user last 8 scored predictions (by match date desc) ─────────────
  const userFormRaw = {}
  for (const p of allScoredPreds) {
    if (!finishedMatchIdSet.has(p.match_id)) continue  // skip upcoming/live matches
    const date = matchDateMap[p.match_id]
    if (!date) continue
    if (!userFormRaw[p.user_id]) userFormRaw[p.user_id] = []
    const info = matchInfoMap[p.match_id] ?? {}
    userFormRaw[p.user_id].push({
      pts: p.points,
      date,
      home: info.home ?? '?',
      away: info.away ?? '?',
      scoreH: info.scoreH,
      scoreA: info.scoreA,
      predH: p.predicted_home,
      predA: p.predicted_away,
    })
  }
  const userFormData = {}
  for (const [uid, entries] of Object.entries(userFormRaw)) {
    userFormData[uid] = entries
      .sort((a, b) => b.date.localeCompare(a.date)) // sorts in-place — entries now desc
      .slice(0, 8)
      .reverse()
  }

  // Trend: compare last-20 efficiency vs overall (only finished matches, sorted desc)
  const userTrend = {}
  for (const [uid, entries] of Object.entries(userFormRaw)) {
    const last20 = entries.slice(0, 20)
    if (last20.length >= 5) {
      userTrend[uid] = last20.reduce((s, e) => s + e.pts, 0) / last20.length
    }
  }

  // ── Hall of fame: top 3 per finished tournament ───────────────────────────────
  const hofPts = {}
  for (const p of allScoredPreds) {
    const tid = matchTidMap[p.match_id]
    if (!tid || !finishedTids.includes(tid)) continue
    if (!hofPts[tid]) hofPts[tid] = {}
    hofPts[tid][p.user_id] = (hofPts[tid][p.user_id] ?? 0) + p.points
  }
  const profileMap = Object.fromEntries((allProfiles ?? []).map(p => [p.id, p]))
  const hofRankings = {}
  for (const [tid, ptsMap] of Object.entries(hofPts)) {
    hofRankings[tid] = Object.entries(ptsMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([uid, pts]) => ({ uid, pts, profile: profileMap[uid] ?? null }))
      .filter(r => r.profile)
  }

  // ── Medal tally: aggregate gold/silver/bronze per user ───────────────────────
  const medalMap = {}
  for (const rankings of Object.values(hofRankings)) {
    rankings.forEach((r, i) => {
      if (!medalMap[r.uid]) medalMap[r.uid] = { gold: 0, silver: 0, bronze: 0, profile: r.profile }
      if (i === 0) medalMap[r.uid].gold++
      else if (i === 1) medalMap[r.uid].silver++
      else medalMap[r.uid].bronze++
    })
  }
  const medalRows = Object.entries(medalMap)
    .map(([uid, d]) => ({ uid, ...d, total: d.gold + d.silver + d.bronze }))
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze)

  // ── Leaderboard — ranked by efficiency (points per prediction) ────────────────
  const leaderboard = (allProfiles ?? [])
    .filter(p => (p.total_predictions ?? 0) > 0 || userAnalytics[p.id])
    .filter(p => p.first_name !== 'Адмін')
    .map(p => ({ ...p, efficiency: p.total_predictions > 0 ? p.total_points / p.total_predictions : 0 }))
    .sort((a, b) => b.efficiency - a.efficiency)

  const maxEfficiency = leaderboard[0]?.efficiency ?? 1

  // Analytics rows sorted by % correct results desc, then by total points
  const analyticsRows = [...leaderboard].sort((a, b) => {
    const anA = userAnalytics[a.id] ?? { scored: 0, exact: 0, correct: 0 }
    const anB = userAnalytics[b.id] ?? { scored: 0, exact: 0, correct: 0 }
    const corPctA = pct(anA.correct, anA.scored)
    const corPctB = pct(anB.correct, anB.scored)
    if (corPctB !== corPctA) return corPctB - corPctA
    return b.total_points - a.total_points
  })

  // ── Community stats ───────────────────────────────────────────────────────────
  const totalParticipants = leaderboard.length
  const totalPredictions  = leaderboard.reduce((s, p) => s + (p.total_predictions ?? 0), 0)
  const totalPoints       = leaderboard.reduce((s, p) => s + (p.total_points ?? 0), 0)
  const avgPoints         = totalParticipants > 0 ? Math.round(totalPoints / totalParticipants) : 0

  // ── Current user ──────────────────────────────────────────────────────────────
  const myProfile = userId ? (allProfiles ?? []).find(p => p.id === userId) ?? null : null
  const myRank    = myProfile ? leaderboard.findIndex(p => p.id === userId) + 1 : null

  const tourneyProgress = {}
  for (const t of activeTournaments) {
    const s = activeMatchStats[t.id] ?? { total: 0, finished: 0, upcomingIds: [] }
    const upcoming  = s.upcomingIds.length
    const predicted = userId ? s.upcomingIds.filter(id => userPredictedIds.has(id)).length : 0
    tourneyProgress[t.id] = { upcoming, predicted, total: s.total, finished: s.finished }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // Only subscribe to realtime when there are active tournaments with upcoming/live matches
  const hasLiveActivity = activeTournaments.length > 0 && allActiveMatches.some(
    m => m.status === 'live' || (m.status !== 'finished' && new Date(m.kickoff_at) <= new Date(now.getTime() + 24 * 60 * 60 * 1000))
  )

  return (
    <div className="space-y-6">
      {hasLiveActivity && <RealtimeRefresher />}

      {/* Personal welcome card */}
      {myProfile && (
        <div className="bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-500/15 dark:to-transparent rounded-2xl p-4 sm:p-5 border border-green-500/20">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar url={myProfile.avatar_url} initials={pini(myProfile)} sizeCls="w-11 h-11 sm:w-12 sm:h-12" textCls="text-sm" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                {myRank && (
                  myRank <= 3
                    ? <span className="flex-shrink-0"><RankBadge rank={myRank} /></span>
                    : <span className="text-sm text-gray-400 dark:text-gray-500 font-medium flex-shrink-0">#{myRank}</span>
                )}
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {pdn(myProfile)}
                </h2>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0 text-sm">
                <span className="font-semibold text-green-600 dark:text-green-400">{formatBaly(myProfile.total_points)}</span>
                <span className="text-gray-400 dark:text-gray-500">{formatPrognazy(myProfile.total_predictions)}</span>
              </div>
            </div>
            <a href="/profile" className="text-sm text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors flex-shrink-0">
              <span className="hidden sm:inline text-xs">Профіль </span>→
            </a>
          </div>
        </div>
      )}

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: Leaderboard + Analytics ─────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Leaderboard */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Загальний рейтинг</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                <div className="sm:hidden space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">Форма (8 останніх):</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> точний</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> вірний</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> промах</span>
                  </div>
                  <div><span className="font-medium">PPP</span> = бали &divide; прогнози &nbsp;·&nbsp; <span className="text-green-500">↑</span> зростає &nbsp;·&nbsp; <span className="text-red-400">↓</span> падає</div>
                </div>
                <div className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">Форма — останні 8 прогнозів:</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> точний рахунок</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> правильний результат</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> промах</span>
                  <span className="text-gray-300 dark:text-gray-700">|</span>
                  <span><span className="font-medium">PPP</span> = бали &divide; прогнози &nbsp;·&nbsp; <span className="text-green-500">↑</span> зростає &nbsp;·&nbsp; <span className="text-red-400">↓</span> падає</span>
                </div>
              </div>

              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">Ще немає учасників</div>
              )}

              {leaderboard.length > 0 && (
                <table className="w-full text-sm hidden sm:table">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                      <th className="w-10 px-3 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5 text-left">Учасник</th>
                      <th className="px-3 py-2.5 text-left whitespace-nowrap">Форма</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">PPP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((p, idx) => {
                      const rank      = idx + 1
                      const isMe      = p.id === userId
                      const form      = userFormData[p.id] ?? []
                      const recentEff = userTrend[p.id]
                      const trend     = recentEff !== undefined
                        ? (recentEff > p.efficiency + 0.05 ? 1 : recentEff < p.efficiency - 0.05 ? -1 : 0)
                        : null
                      const barWidth  = Math.round(p.efficiency / maxEfficiency * 100)
                      return (
                        <tr key={p.id}
                          className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 animate-fade-in ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
                          style={{ animationDelay: `${idx * 50}ms` }}>
                          <td className="px-3 py-3 text-center"><RankBadge rank={rank} /></td>
                          <td className="px-3 py-3">
                            <a href={`/players/${p.id}`} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
                              <Avatar url={p.avatar_url} initials={pini(p)} sizeCls="w-8 h-8" textCls="text-xs" />
                              <span className="font-medium text-gray-900 dark:text-white truncate">
                                {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                              </span>
                            </a>
                          </td>
                          <td className="px-3 py-3">
                            <FormDots form={form} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5 mb-0.5">
                              {trend !== null && (
                                <span className={`text-xs font-semibold ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                  {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'}
                                </span>
                              )}
                              <span className="font-bold text-green-500 dark:text-green-400 tabular-nums">{p.efficiency.toFixed(2)}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right whitespace-nowrap mb-1.5">
                              {fmtNum(p.total_points)} б. · {fmtNum(p.total_predictions)} прогн.
                            </div>
                            <div className="h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500/70 rounded-full" style={{width:`${barWidth}%`}} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              <div className="sm:hidden">
                {leaderboard.map((p, idx) => {
                  const rank      = idx + 1
                  const isMe      = p.id === userId
                  const form      = userFormData[p.id] ?? []
                  const recentEff = userTrend[p.id]
                  const trend     = recentEff !== undefined
                    ? (recentEff > p.efficiency + 0.05 ? 1 : recentEff < p.efficiency - 0.05 ? -1 : 0)
                    : null
                  const barWidth  = Math.round(p.efficiency / maxEfficiency * 100)
                  return (
                    <div key={p.id}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 animate-fade-in ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
                      style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 flex-shrink-0 text-center"><RankBadge rank={rank} /></div>
                        <a href={`/players/${p.id}`}
                          className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                          <Avatar url={p.avatar_url} initials={pini(p)} sizeCls="w-8 h-8" textCls="text-xs" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                          </span>
                        </a>
                        <div className="flex-shrink-0 text-right ml-1">
                          <div className="flex items-center justify-end gap-1">
                            {trend !== null && (
                              <span className={`text-xs font-semibold ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'}
                              </span>
                            )}
                            <span className="font-bold text-green-500 dark:text-green-400 text-sm tabular-nums">{p.efficiency.toFixed(2)}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtNum(p.total_points)} б. · {fmtNum(p.total_predictions)} прогн.</div>
                        </div>
                      </div>
                      <div className="pl-9 mt-1.5">
                        {form.length > 0 && (
                          <div className="mb-1.5">
                            <FormDots form={form} />
                          </div>
                        )}
                        <div className="h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500/70 rounded-full" style={{width:`${barWidth}%`}} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </div>

          {/* Analytics table */}
          {leaderboard.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Детальна статистика</h2>
              <AnalyticsTable rows={analyticsRows} userAnalytics={userAnalytics} userId={userId} />
            </div>
          )}

        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Active tournaments */}
          {activeTournaments.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Активні турніри</h2>
              <div className="space-y-3">
                {activeTournaments.map(t => {
                  const prog = tourneyProgress[t.id] ?? { upcoming: 0, predicted: 0, total: 0, finished: 0 }
                  const progPct = prog.upcoming > 0 ? Math.round(prog.predicted / prog.upcoming * 100) : 100
                  return (
                    <a key={t.id} href={`/tournaments/${t.id}`}
                      className="block bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-green-500/50 transition-colors group">
                      <div className="flex items-center gap-3 mb-3">
                        {TOURNAMENT_LOGOS[t.league_id]
                          ? <img src={TOURNAMENT_LOGOS[t.league_id]} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                          : <span className="text-2xl leading-none">{LEAGUE_EMOJI[t.league_id] ?? '🏆'}</span>
                        }
                        <div className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400 transition-colors leading-tight">{t.name}</div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">{prog.finished} / {prog.total} матчів зіграно</div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-2">
                        <div className="bg-gray-400 dark:bg-gray-500 rounded-full h-1.5" style={{ width: `${prog.total > 0 ? Math.round(prog.finished / prog.total * 100) : 0}%` }} />
                      </div>
                      {userId && prog.upcoming > 0 && (
                        <>
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-1">
                            <div className="bg-green-500 rounded-full h-1.5" style={{ width: `${progPct}%` }} />
                          </div>
                          <div className={`text-xs ${progPct === 100 ? 'text-green-500 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`}>
                            {progPct === 100 ? '✅ Всі прогнози зроблені' : `Прогнози: ${prog.predicted} / ${prog.upcoming}`}
                          </div>
                        </>
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Community stats */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Спільнота</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtNum(totalParticipants)}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">учасників</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500 dark:text-green-400">{fmtNum(totalPoints)}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">загальних балів</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtNum(totalPredictions)}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">прогнозів</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtNum(avgPoints)}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">сер. балів</div>
              </div>
            </div>
          </div>

          {/* Hall of fame */}
          <HallOfFame
            finishedTournaments={finishedTournaments}
            hofRankings={hofRankings}
            medalRows={medalRows}
            tournamentLogos={TOURNAMENT_LOGOS}
            leagueEmoji={LEAGUE_EMOJI}
          />

        </div>
      </div>

    </div>
  )
}
