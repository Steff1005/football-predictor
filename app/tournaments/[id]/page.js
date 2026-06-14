import { cache } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import MatchesTab from './MatchesTab'
import LiveTab from './LiveTab'
import PredsTab from './PredsTab'
import StandingsTab from './StandingsTab'
import RoundsTab from './RoundsTab'
import CLUB_CRESTS from '../../../lib/club-crests'
import TOURNAMENT_LOGOS from '../../../lib/tournament-logos'
import { groupAndSortMatches } from '../../../lib/round-sort'
import { translateTeam } from '../../../lib/team-translations'
import { simulateProbabilities, SAMPLES_FAST } from '../../../lib/probability'
import { isAdminEmail } from '../../../lib/admin'
import { compareTournamentStandings } from '../../../lib/rankings'
import TournamentTabs from './TournamentTabs'
import DynamicsTab from './DynamicsTab'
import RealtimeRefresher from '../../../components/RealtimeRefresher'


// Fix #10: cached tournament fetch — shared between generateMetadata and page (one DB call)
const getTournament = cache(async (id) => {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [] } }
  )
  const { data } = await supabase.from('tournaments').select('*').eq('id', id).single()
  return data
})

export async function generateMetadata({ params }) {
  const { id } = await params
  const t = await getTournament(id)
  if (!t) return { title: 'Турнір — Kickoff' }
  return {
    title: `${t.name} — Kickoff`,
    openGraph: {
      title: `${t.name} — Kickoff`,
      description: `Прогнози та результати турніру ${t.name}`,
      images: [{ url: '/icons/icon-512.png' }],
    },
  }
}

// ── Country flag helpers ──────────────────────────────────────────────────────

const COUNTRY_FLAG_CODES = {
  'Іспанія': 'es', 'Англія': 'gb-eng', 'Франція': 'fr', 'Португалія': 'pt',
  'Нідерланди': 'nl', 'Туреччина': 'tr', 'Швейцарія': 'ch', 'Австрія': 'at',
  'Румунія': 'ro', 'Словаччина': 'sk', 'Угорщина': 'hu', 'Польща': 'pl',
  'Бельгія': 'be', 'Чехія': 'cz', 'Данія': 'dk', 'Словенія': 'si',
  'Сербія': 'rs', 'Хорватія': 'hr', 'Албанія': 'al', 'Грузія': 'ge',
  'Шотландія': 'gb-sct', 'Україна': 'ua', 'Німеччина': 'de', 'Італія': 'it',
}

function getFlagUrl(name) {
  const code = COUNTRY_FLAG_CODES[name]
  return code ? `https://flagcdn.com/32x24/${code}.png` : null
}

async function fetchAllRows(buildQuery) {
  const PAGE = 1000
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TournamentPage({ params, searchParams }) {
  const { id }              = await params
  const { tab = 'matches' } = await searchParams

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId  = session?.user?.id
  const isAdmin = isAdminEmail(session?.user?.email)

  // Fix #10: tournament from cache (no extra DB call vs generateMetadata)
  const [tournament, { data: matches }, { data: roundAnalysesRows }] = await Promise.all([
    getTournament(id),
    supabase.from('matches').select('*').eq('tournament_id', id).order('kickoff_at', { ascending: true }),
    supabase.from('round_analyses').select('round_label, analysis_text').eq('tournament_id', id),
  ])

  if (!tournament) {
    return (
      <div className="text-center py-20 text-gray-600">
        <p className="text-5xl mb-4">🏆</p>
        <p>Турнір не знайдено</p>
      </div>
    )
  }

  // Enrich matches: logos then translated names
  const allMatches = (matches ?? []).map(m => ({
    ...m,
    home_logo: m.home_logo ?? CLUB_CRESTS[m.home_team] ?? getFlagUrl(m.home_team),
    away_logo: m.away_logo ?? CLUB_CRESTS[m.away_team] ?? getFlagUrl(m.away_team),
    home_team: translateTeam(m.home_team),
    away_team: translateTeam(m.away_team),
  }))

  const matchIds         = allMatches.map(m => m.id)
  const now              = new Date()
  const finishedMatchIds = allMatches.filter(m => m.status === 'finished').map(m => m.id)
  const liveMatches      = allMatches.filter(m => m.status === 'live' || (new Date(m.kickoff_at) < now && m.status !== 'finished'))
  const liveMatchIds     = liveMatches.map(m => m.id)

  // Current user's predictions (for matches tab progress bar)
  let userPredictions = {}
  if (userId) {
    const { data: preds } = await supabase
      .from('predictions').select('*').eq('user_id', userId)
    preds?.forEach(p => { userPredictions[p.match_id] = p })
  }

  // Fix #5: only fetch calcPreds when needed (not for matches/live tabs)
  const needCalcPreds = !['matches', 'live'].includes(tab)

  let calcPreds = []
  if (needCalcPreds && matchIds.length > 0) {
    calcPreds = await fetchAllRows((from, to) =>
      supabase
        .from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points, points_exact, points_result')
        .in('match_id', matchIds)
        .not('points', 'is', null)
        .range(from, to)
    )
  }

  // Live match predictions (visible to all while match is ongoing)
  let livePreds = []
  if (liveMatchIds.length > 0) {
    const { data } = await supabase
      .from('predictions')
      .select('user_id, match_id, predicted_home, predicted_away')
      .in('match_id', liveMatchIds)
    livePreds = data ?? []
  }

  // Upcoming predictions (to surface late joiners in standings)
  const upcomingMatchIds = allMatches.filter(m => new Date(m.kickoff_at) > now).map(m => m.id)
  let upcomingPreds = []
  if (upcomingMatchIds.length > 0) {
    const { data } = await supabase
      .from('predictions')
      .select('user_id, match_id, predicted_home, predicted_away')
      .in('match_id', upcomingMatchIds)
    upcomingPreds = data ?? []
  }

  // Profiles for everyone who has predictions
  const allUserIds = [...new Set([
    ...calcPreds.map(p => p.user_id),
    ...upcomingPreds.map(p => p.user_id),
    ...livePreds.map(p => p.user_id),
  ])]
  let profileMap = {}
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, avatar_url')
      .in('id', allUserIds)
    ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })
  }

  // ── Standings ─────────────────────────────────────────────────────────────
  const userStats = {}
  const countedPairs = new Set()
  for (const p of calcPreds) {
    if (!userStats[p.user_id]) userStats[p.user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
    userStats[p.user_id].predictions++
    userStats[p.user_id].total += p.points ?? 0
    if ((p.points_result ?? 0) > 0) userStats[p.user_id].results++
    if ((p.points_exact  ?? 0) > 0) userStats[p.user_id].exact++
    countedPairs.add(`${p.user_id}|${p.match_id}`)
  }
  for (const p of livePreds) {
    if (countedPairs.has(`${p.user_id}|${p.match_id}`)) continue
    if (!userStats[p.user_id]) userStats[p.user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
    userStats[p.user_id].predictions++
  }
  for (const uid of upcomingPreds.map(p => p.user_id)) {
    if (!userStats[uid]) userStats[uid] = { results: 0, exact: 0, total: 0, predictions: 0 }
  }
  const standings = Object.entries(userStats)
    .map(([uid, stats]) => ({ uid, ...stats, profile: profileMap[uid] }))
    .filter(s => s.profile)
    .sort(compareTournamentStandings)

  // ── По-турах ──────────────────────────────────────────────────────────────
  const roundedGroups   = groupAndSortMatches(allMatches)
  const matchRoundLabel = {}
  roundedGroups.forEach(({ label, matches: gm }) => gm.forEach(m => { matchRoundLabel[m.id] = label }))

  const byRound = {}
  for (const p of calcPreds) {
    const label = matchRoundLabel[p.match_id]
    if (!label) continue
    if (!byRound[label]) byRound[label] = {}
    byRound[label][p.user_id] = (byRound[label][p.user_id] ?? 0) + (p.points ?? 0)
  }

  const roundTables = roundedGroups
    .filter(({ label }) => byRound[label])
    .map(({ label, matches: gm }) => {
      const rows = Object.entries(byRound[label])
        .map(([uid, pts]) => ({ uid, pts, profile: profileMap[uid] }))
        .filter(r => r.profile)
        .sort((a, b) => b.pts - a.pts)
      return { label, rows, maxPts: rows[0]?.pts ?? 0, matchCount: gm.length, matchIds: gm.map(m => m.id) }
    })

  // ── Live tab ──────────────────────────────────────────────────────────────
  const predsByLiveMatch = {}
  for (const p of livePreds) {
    if (!predsByLiveMatch[p.match_id]) predsByLiveMatch[p.match_id] = []
    predsByLiveMatch[p.match_id].push(p)
  }

  // ── Прогнози tab — built from calcPreds (eliminates separate publicPreds fetch) ──
  const finishedMatchIdSet = new Set(finishedMatchIds)
  const predsByMatch = {}
  for (const p of calcPreds) {
    if (!finishedMatchIdSet.has(p.match_id)) continue
    if (!predsByMatch[p.match_id]) predsByMatch[p.match_id] = []
    predsByMatch[p.match_id].push(p)
  }
  const finishedMatches = allMatches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))

  const roundLabels = roundTables.map(rt => rt.label)

  // ── Round analyses map ────────────────────────────────────────────────────
  const analysisMap = {}
  ;(roundAnalysesRows ?? []).forEach(r => { analysisMap[r.round_label] = r.analysis_text })

  // ── Progress bar ──────────────────────────────────────────────────────────
  const matchesTabMatches = allMatches.filter(m => new Date(m.kickoff_at) > now)
  const predictedCount    = userId ? matchesTabMatches.filter(m => userPredictions[m.id]).length : 0
  const unpredictedCount  = userId ? matchesTabMatches.length - predictedCount : 0
  const progressPct       = matchesTabMatches.length > 0
    ? Math.round((predictedCount / matchesTabMatches.length) * 100)
    : 100

  // ── Dynamics: position changes per round ─────────────────────────────────
  const finishedByRound = {}
  for (const m of allMatches.filter(m => m.status === 'finished')) {
    if (!finishedByRound[m.round]) finishedByRound[m.round] = { first: m.kickoff_at, matchIds: [] }
    if (m.kickoff_at < finishedByRound[m.round].first) finishedByRound[m.round].first = m.kickoff_at
    finishedByRound[m.round].matchIds.push(m.id)
  }

  const dynRounds = Object.keys(finishedByRound)
    .sort((a, b) => finishedByRound[a].first.localeCompare(finishedByRound[b].first))

  const hasDynamics = dynRounds.length >= 2

  let dynamicsRows = []
  if (hasDynamics) {
    const matchToRoundIdx = {}
    dynRounds.forEach((rk, ri) => {
      for (const mid of finishedByRound[rk].matchIds) matchToRoundIdx[mid] = ri
    })

    const ppr = {}
    for (const p of calcPreds) {
      const ri = matchToRoundIdx[p.match_id]
      if (ri === undefined) continue
      if (!ppr[p.user_id]) ppr[p.user_id] = {}
      ppr[p.user_id][ri] = (ppr[p.user_id][ri] ?? 0) + (p.points ?? 0)
    }

    const dynUserIds = Object.keys(ppr)

    const cum = {}
    for (const uid of dynUserIds) {
      let total = 0
      cum[uid] = dynRounds.map((_, ri) => { total += ppr[uid][ri] ?? 0; return total })
    }

    const ranksByRound = dynRounds.map((_, ri) => {
      const sorted = [...dynUserIds]
        .map(uid => ({ uid, pts: cum[uid][ri] }))
        .sort((a, b) => b.pts - a.pts || a.uid.localeCompare(b.uid))
      return sorted.reduce((acc, u, i) => { acc[u.uid] = i + 1; return acc }, {})
    })

    const finalRanks = ranksByRound[dynRounds.length - 1]

    dynamicsRows = [...dynUserIds]
      .sort((a, b) => (finalRanks[a] ?? 99) - (finalRanks[b] ?? 99))
      .map(uid => ({
        uid,
        profile: profileMap[uid] ?? null,
        rounds: dynRounds.map((_, ri) => {
          const rank     = ranksByRound[ri][uid]
          const prevRank = ri > 0 ? ranksByRound[ri - 1][uid] : null
          return { rank, cumPoints: cum[uid][ri], delta: prevRank !== null ? prevRank - rank : null }
        }),
      }))
      .filter(r => r.profile)
  }

  // ── Probability matrix — Fix #5: only fetch for standings tab ────────────
  let probMatrix = null
  if (tab === 'standings' && matchesTabMatches.length > 0 && standings.length > 0) {
    const { data: cached } = await supabase
      .from('probability_cache')
      .select('data')
      .eq('tournament_id', id)
      .single()

    if (cached?.data?.length) {
      probMatrix = cached.data
        .map(row => ({ uid: row.uid, profile: profileMap[row.uid] ?? null, probs: row.probs }))
        .filter(row => row.profile)
    } else {
      probMatrix = simulateProbabilities(standings, matchesTabMatches.length, SAMPLES_FAST)
        ?.map(row => ({ ...row, profile: profileMap[row.uid] ?? null }))
        .filter(row => row.profile) ?? null
    }
  }

  // ── Default active rounds ─────────────────────────────────────────────────
  const matchTabGroups    = groupAndSortMatches(matchesTabMatches)
  const nearestUpcoming   = [...matchesTabMatches].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0]
  const defaultMatchesRound = nearestUpcoming
    ? (matchTabGroups.find(g => g.matches.some(m => m.id === nearestUpcoming.id))?.label ?? matchTabGroups[0]?.label ?? null)
    : (matchTabGroups[0]?.label ?? null)

  const predGroups          = groupAndSortMatches(finishedMatches)
  const mostRecentFinished  = finishedMatches[0]
  const defaultPredsRound   = mostRecentFinished
    ? (predGroups.find(g => g.matches.some(m => m.id === mostRecentFinished.id))?.label ?? predGroups[predGroups.length - 1]?.label ?? null)
    : (predGroups[predGroups.length - 1]?.label ?? null)

  // Realtime only makes sense when the tournament is active (predictions/scores can change)
  const needsRealtime = tournament.is_active && (liveMatches.length > 0 || matchesTabMatches.length > 0)

  return (
    <div>
      {needsRealtime && <RealtimeRefresher />}
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-4">
        <a href="/tournaments" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Турніри</a>
        <span>/</span>
        <span className="text-gray-600 dark:text-gray-300 truncate">{tournament.name}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        {TOURNAMENT_LOGOS[tournament.league_id] && (
          <img src={TOURNAMENT_LOGOS[tournament.league_id]} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{tournament.name}</h1>
      </div>

      {/* Tabs */}
      <TournamentTabs id={id} activeTab={tab} hasLive={liveMatches.length > 0} hasDynamics={hasDynamics} />

      {/* ── Matches ─────────────────────────────────────────────────────── */}
      {tab === 'matches' && (
        <>
          {userId && matchesTabMatches.length > 0 && (
            <div className="mb-5 bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
              <div className="mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Прогнози на майбутні матчі</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-2">
                <div className="bg-green-500 rounded-full h-2 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              {unpredictedCount > 0
                ? <p className="text-xs text-amber-500 dark:text-amber-400">Спрогнозовано: {predictedCount} з {matchesTabMatches.length} матчів</p>
                : <p className="text-xs text-green-500 dark:text-green-400">✅ Всі майбутні матчі спрогнозовано</p>
              }
            </div>
          )}
          <MatchesTab matches={matchesTabMatches} userPredictions={userPredictions} userId={userId} defaultRound={defaultMatchesRound} />
        </>
      )}

      {/* ── Live ────────────────────────────────────────────────────────── */}
      {tab === 'live' && (
        <LiveTab liveMatches={liveMatches} predsByMatch={predsByLiveMatch} profileMap={profileMap} tournamentId={id} />
      )}

      {/* ── Predictions ─────────────────────────────────────────────────── */}
      {tab === 'preds' && (
        <PredsTab finishedMatches={finishedMatches} predsByMatch={predsByMatch} profileMap={profileMap} defaultRound={defaultPredsRound} />
      )}

      {/* ── Standings ───────────────────────────────────────────────────── */}
      {tab === 'standings' && (
        <StandingsTab
          standings={standings}
          roundLabels={roundLabels}
          roundPointsMap={byRound}
          probMatrix={probMatrix}
          upcomingCount={matchesTabMatches.length}
        />
      )}

      {/* ── By round ────────────────────────────────────────────────────── */}
      {tab === 'rounds' && (
        <RoundsTab
          roundTables={roundTables}
          tournamentId={id}
          analysisMap={analysisMap}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Dynamics ────────────────────────────────────────────────────── */}
      {tab === 'dynamics' && (
        <DynamicsTab rounds={dynRounds} rows={dynamicsRows} />
      )}
    </div>
  )
}
