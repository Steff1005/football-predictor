import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import RoundAnalysisSection from './RoundAnalysisSection'
import MatchesTab from './MatchesTab'
import PredsTab from './PredsTab'
import CLUB_CRESTS from '../../../lib/club-crests'
import TOURNAMENT_LOGOS from '../../../lib/tournament-logos'
import { groupAndSortMatches } from '../../../lib/round-sort'
import { translateTeam } from '../../../lib/team-translations'
import { simulateProbabilities } from '../../../lib/probability'

export const revalidate = 60

// ── Helpers ──────────────────────────────────────────────────────────────────

function pluralMatches(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'матч'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'матчі'
  return 'матчів'
}

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

// ── Probability matrix ────────────────────────────────────────────────────────

// Country flags (flagcdn.com) — keyed by Ukrainian team name
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

// ── Shared components ─────────────────────────────────────────────────────────

function Avatar({ profile }) {
  const name     = displayName(profile)
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-xs font-bold text-green-600 dark:text-green-400">{initials}</span>
      }
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-20 text-gray-400 dark:text-gray-600">
      <p className="text-5xl mb-4">{icon}</p>
      <p>{text}</p>
    </div>
  )
}

// ── Probability section ───────────────────────────────────────────────────────

function probCellCls(pct) {
  if (pct === 0) return 'text-gray-300 dark:text-gray-700'
  if (pct < 10)  return 'text-gray-500 dark:text-gray-400'
  if (pct < 25)  return 'bg-green-500/15 text-green-700 dark:text-green-400'
  if (pct < 50)  return 'bg-green-500/30 text-green-700 dark:text-green-300 font-semibold'
  if (pct < 75)  return 'bg-green-500/55 text-white font-bold'
  return                 'bg-green-500 text-white font-bold'
}

function placeLabel(p) {
  return p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}`
}

function ProbabilitySection({ probMatrix, remainingCount }) {
  if (!probMatrix?.length) return null

  const n = probMatrix.length
  const activePlaces = Array.from({ length: n }, (_, i) => i + 1)
    .filter(place => probMatrix.some(row => (row.probs[place] ?? 0) > 0))

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Прогноз підсумкових місць</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {remainingCount === 1 ? 'Залишився 1 матч' : `Залишилось ${remainingCount} матчів`}
          {' · '}на основі поточних балів та макс. можливого приросту
        </p>
      </div>

      {/* Mobile: card per participant */}
      <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
        {probMatrix.map(row => (
          <div key={row.uid} className="px-4 py-3">
            <Link href={`/players/${row.uid}`} className="flex items-center gap-2.5 mb-2 hover:opacity-75 transition-opacity">
              <Avatar profile={row.profile} />
              <span className="font-medium text-gray-900 dark:text-white text-sm flex-1 min-w-0 truncate">
                {displayName(row.profile)}
              </span>
            </Link>
            <div className="flex flex-wrap gap-1.5">
              {activePlaces.map(place => {
                const pct = row.probs[place] ?? 0
                if (pct === 0) return null
                return (
                  <span key={place} className={`px-2.5 py-1 rounded-lg text-xs tabular-nums ${probCellCls(pct)}`}>
                    {placeLabel(place)}: {pct}%
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide sticky left-0 bg-white dark:bg-gray-900 min-w-[160px]">
                Учасник
              </th>
              {activePlaces.map(place => (
                <th key={place} className="text-center px-2 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[64px]">
                  {placeLabel(place)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probMatrix.map(row => (
              <tr key={row.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900 z-10">
                  <Link href={`/players/${row.uid}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                    <Avatar profile={row.profile} />
                    <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {displayName(row.profile)}
                    </span>
                  </Link>
                </td>
                {activePlaces.map(place => {
                  const pct = row.probs[place] ?? 0
                  return (
                    <td key={place} className={`text-center px-2 py-2.5 tabular-nums min-w-[64px] ${probCellCls(pct)}`}>
                      {pct > 0 ? `${pct}%` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Standings tab ─────────────────────────────────────────────────────────────

function StandingsTab({ standings, roundLabels, roundPointsMap, probMatrix, upcomingCount }) {
  if (!standings.length) return <EmptyState icon="📊" text="Поки немає прогнозів" />

  const colMaxes = (roundLabels ?? []).map(label =>
    Math.max(0, ...standings.map(s => roundPointsMap?.[label]?.[s.uid] ?? 0))
  )

  return (
    <div className="space-y-6">
      {/* Mobile — cards */}
      <div className="sm:hidden space-y-2">
        {standings.map((s, i) => (
          <div key={s.uid} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 text-center text-lg">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm text-gray-400 dark:text-gray-500">{i + 1}</span>}
              </span>
              <Link href={`/players/${s.uid}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                <Avatar profile={s.profile} />
                <span className="font-medium text-gray-900 dark:text-white flex-1 min-w-0 truncate">{displayName(s.profile)}</span>
              </Link>
              <span className="font-bold text-green-500 dark:text-green-400 text-xl flex-shrink-0">{s.total}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500 pl-10">
              <span>Прогн: <b className="text-gray-600 dark:text-gray-300">{s.predictions}</b></span>
              <span>Рез: <b className="text-gray-600 dark:text-gray-300">{s.results}</b></span>
              <span className="text-blue-400">×1: <b>{s.results}</b></span>
              <span>Точних: <b className="text-gray-600 dark:text-gray-300">{s.exact}</b></span>
              <span className="text-blue-400">×4: <b>{s.exact * 4}</b></span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop — summary table */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide w-10">Місце</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Гравець</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Прогнози</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Прав. результати</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-blue-400 dark:text-blue-500 uppercase tracking-wide">Бали за результати</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Точні рахунки</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-blue-400 dark:text-blue-500 uppercase tracking-wide">Бали за точні</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Сума балів</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-3 py-3 text-center text-lg">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉'
                      : <span className="text-sm text-gray-400 dark:text-gray-500">{i + 1}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/players/${s.uid}`} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
                      <Avatar profile={s.profile} />
                      <span className="font-medium text-gray-900 dark:text-white">{displayName(s.profile)}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500 dark:text-gray-400">{s.predictions}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{s.results}</td>
                  <td className="px-3 py-3 text-right font-medium text-blue-600 dark:text-blue-400">{s.results}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{s.exact}</td>
                  <td className="px-3 py-3 text-right font-medium text-blue-600 dark:text-blue-400">{s.exact * 4}</td>
                  <td className="px-3 py-3 text-right font-bold text-green-500 dark:text-green-400 text-lg">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round-by-round breakdown (all screen sizes) */}
      {roundLabels?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Очки по стадіях</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900">Учасник</th>
                  {roundLabels.map(label => (
                    <th key={label} className="text-center px-1 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[60px] w-[60px]">{label}</th>
                  ))}
                  <th className="text-center px-1 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[60px] w-[60px]">Загалом</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(s => (
                  <tr key={s.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                    <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900">
                      <Link href={`/players/${s.uid}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                        <Avatar profile={s.profile} />
                        <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{displayName(s.profile)}</span>
                      </Link>
                    </td>
                    {roundLabels.map((label, ci) => {
                      const pts = roundPointsMap?.[label]?.[s.uid] ?? 0
                      const isMax = colMaxes[ci] > 0 && pts === colMaxes[ci]
                      return (
                        <td key={label} className={`text-center px-1 py-2.5 tabular-nums min-w-[60px] w-[60px] ${
                          isMax
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 font-bold'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {pts > 0 ? pts : '—'}
                        </td>
                      )
                    })}
                    <td className="text-center px-1 py-2.5 font-bold text-green-500 dark:text-green-400 tabular-nums min-w-[60px] w-[60px]">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Probability forecast table */}
      {probMatrix && <ProbabilitySection probMatrix={probMatrix} remainingCount={upcomingCount} />}
    </div>
  )
}

// ── By-round tab ──────────────────────────────────────────────────────────────

function RoundsTab({ roundTables, tournamentId, analysisMap, isAdmin }) {
  if (!roundTables.length) return <EmptyState icon="📅" text="Поки немає даних по турах" />

  return (
    <div className="space-y-5">
      {roundTables.map(({ label, rows, maxPts, matchCount, matchIds }) => (
        <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">{label}</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{matchCount} {pluralMatches(matchCount)}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r, i) => {
              const isTop = maxPts > 0 && r.pts === maxPts
              return (
                <div key={r.uid} className={`flex items-center justify-between px-5 py-3 ${isTop ? 'bg-yellow-50 dark:bg-yellow-500/[0.07]' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 text-xs text-center text-gray-400 dark:text-gray-500 flex-shrink-0">{i + 1}</span>
                    <Link href={`/players/${r.uid}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                      <Avatar profile={r.profile} />
                      <span className={`text-sm font-medium ${isTop ? 'text-yellow-700 dark:text-yellow-300' : 'text-gray-900 dark:text-white'}`}>
                        {displayName(r.profile)}
                      </span>
                    </Link>
                    {isTop && <span className="text-sm leading-none">🥇</span>}
                  </div>
                  <span className={`font-bold tabular-nums ${isTop ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    +{r.pts}
                  </span>
                </div>
              )
            })}
          </div>
          <RoundAnalysisSection
            tournamentId={tournamentId}
            roundLabel={label}
            matchIds={matchIds}
            initialText={analysisMap[label] ?? null}
            isAdmin={isAdmin}
          />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'matches',   label: 'Матчі',           short: 'Матчі' },
  { id: 'preds',     label: 'Результати',       short: 'Результати' },
  { id: 'standings', label: 'Турнірна таблиця', short: 'Таблиця' },
  { id: 'rounds',    label: 'По турах',         short: 'Тури' },
]

// Fetch all rows past the 1000-row PostgREST server cap using range pagination
async function fetchAllRows(buildQuery) {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error || !data?.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export default async function TournamentPage({ params, searchParams }) {
  const { id }          = await params
  const { tab = 'matches' } = await searchParams

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId  = session?.user?.id
  const isAdmin = session?.user?.email === process.env.ADMIN_EMAIL

  const [{ data: tournament }, { data: matches }, { data: roundAnalysesRows }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
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

  // Enrich matches: logos (using original name) then translate team names
  const allMatches = (matches ?? []).map(m => ({
    ...m,
    home_logo: m.home_logo ?? CLUB_CRESTS[m.home_team] ?? getFlagUrl(m.home_team),
    away_logo: m.away_logo ?? CLUB_CRESTS[m.away_team] ?? getFlagUrl(m.away_team),
    home_team: translateTeam(m.home_team),
    away_team: translateTeam(m.away_team),
  }))

  const matchIds        = allMatches.map(m => m.id)
  const now             = new Date()
  const finishedMatchIds = allMatches.filter(m => new Date(m.kickoff_at) <= now).map(m => m.id)

  // Current user's predictions (for matches tab progress bar)
  let userPredictions = {}
  if (userId) {
    const { data: preds } = await supabase
      .from('predictions').select('*').eq('user_id', userId)
    preds?.forEach(p => { userPredictions[p.match_id] = p })
  }

  // Calculated predictions → standings + по-турах
  let calcPreds = []
  if (matchIds.length > 0) {
    calcPreds = await fetchAllRows((from, to) =>
      supabase
        .from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points')
        .in('match_id', matchIds)
        .not('points', 'is', null)
        .range(from, to)
    )
  }

  // Public predictions (past matches = kickoff_at <= now) → прогнози tab
  let publicPreds = []
  if (finishedMatchIds.length > 0) {
    publicPreds = await fetchAllRows((from, to) =>
      supabase
        .from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points')
        .in('match_id', finishedMatchIds)
        .range(from, to)
    )
  }

  // Predictions for upcoming matches — needed to surface participants who haven't
  // played past matches yet (e.g. joined late and only predicted the final).
  const upcomingMatchIds = allMatches.filter(m => new Date(m.kickoff_at) > now).map(m => m.id)
  let upcomingPreds = []
  if (upcomingMatchIds.length > 0) {
    const { data } = await supabase
      .from('predictions')
      .select('user_id, match_id, predicted_home, predicted_away')
      .in('match_id', upcomingMatchIds)
    upcomingPreds = data ?? []
  }

  // Profiles for everyone who has predictions (past or upcoming)
  const allUserIds = [...new Set([
    ...calcPreds.map(p => p.user_id),
    ...publicPreds.map(p => p.user_id),
    ...upcomingPreds.map(p => p.user_id),
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
  for (const p of calcPreds) {
    if (!userStats[p.user_id]) userStats[p.user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
    userStats[p.user_id].predictions++
    userStats[p.user_id].total += p.points ?? 0
    if (p.points === 1) userStats[p.user_id].results++
    if (p.points === 4) userStats[p.user_id].exact++
  }
  // Ensure participants who only predicted upcoming matches appear with 0 pts
  for (const uid of upcomingPreds.map(p => p.user_id)) {
    if (!userStats[uid]) userStats[uid] = { results: 0, exact: 0, total: 0, predictions: 0 }
  }
  const standings = Object.entries(userStats)
    .map(([uid, stats]) => ({ uid, ...stats, profile: profileMap[uid] }))
    .filter(s => s.profile)
    .sort((a, b) =>
      b.total - a.total ||
      b.exact - a.exact ||
      b.results - a.results ||
      b.predictions - a.predictions
    )

  // ── По-турах ──────────────────────────────────────────────────────────────
  const roundedGroups  = groupAndSortMatches(allMatches)
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

  // ── Прогнози ──────────────────────────────────────────────────────────────
  const predsByMatch = {}
  for (const p of publicPreds) {
    if (!predsByMatch[p.match_id]) predsByMatch[p.match_id] = []
    predsByMatch[p.match_id].push(p)
  }
  const finishedMatches = allMatches
    .filter(m => new Date(m.kickoff_at) <= now)
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))

  const roundLabels = roundTables.map(rt => rt.label)

  // ── Round analyses map ────────────────────────────────────────────────────
  const analysisMap = {}
  ;(roundAnalysesRows ?? []).forEach(r => { analysisMap[r.round_label] = r.analysis_text })

  // ── Progress bar (matches tab) ────────────────────────────────────────────
  const matchesTabMatches = allMatches.filter(m => new Date(m.kickoff_at) > now)
  const upcomingMatches   = matchesTabMatches

  // ── Probability matrix — read from cache, fallback to live simulation ─────
  let probMatrix = null
  if (matchesTabMatches.length > 0 && standings.length > 0) {
    const { data: cached } = await supabase
      .from('probability_cache')
      .select('data')
      .eq('tournament_id', id)
      .single()

    if (cached?.data?.length) {
      // Merge cached probs with fresh profiles (avoids stale names/avatars)
      probMatrix = cached.data
        .map(row => ({ uid: row.uid, profile: profileMap[row.uid] ?? null, probs: row.probs }))
        .filter(row => row.profile)
    } else {
      // Fallback: compute live (first load or cache not yet populated)
      probMatrix = simulateProbabilities(standings, matchesTabMatches.length)
        ?.map(row => ({ ...row, profile: profileMap[row.uid] ?? null }))
        .filter(row => row.profile) ?? null
    }
  }
  const predictedCount   = userId ? upcomingMatches.filter(m => userPredictions[m.id]).length : 0
  const unpredictedCount = userId ? upcomingMatches.length - predictedCount : 0
  const progressPct = upcomingMatches.length > 0
    ? Math.round((predictedCount / upcomingMatches.length) * 100)
    : 100

  // ── Default active rounds (computed server-side to avoid hydration mismatch) ─
  const matchTabGroups = groupAndSortMatches(matchesTabMatches)
  const nearestUpcoming = [...matchesTabMatches].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0]
  const defaultMatchesRound = nearestUpcoming
    ? (matchTabGroups.find(g => g.matches.some(m => m.id === nearestUpcoming.id))?.label ?? matchTabGroups[0]?.label ?? null)
    : (matchTabGroups[0]?.label ?? null)

  const predGroups = groupAndSortMatches(finishedMatches)
  const mostRecentFinished = finishedMatches[0] // sorted desc
  const defaultPredsRound = mostRecentFinished
    ? (predGroups.find(g => g.matches.some(m => m.id === mostRecentFinished.id))?.label ?? predGroups[predGroups.length - 1]?.label ?? null)
    : (predGroups[predGroups.length - 1]?.label ?? null)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-4">
        <a href="/" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Турніри</a>
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
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <a key={t.id} href={`/tournaments/${id}?tab=${t.id}`}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === t.id ? 'bg-green-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}>
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </a>
        ))}
      </div>

      {/* ── Matches ─────────────────────────────────────────────────────── */}
      {tab === 'matches' && (
        <>
          {userId && upcomingMatches.length > 0 && (
            <div className="mb-5 bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
              <div className="mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Прогнози на майбутні матчі</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-2">
                <div className="bg-green-500 rounded-full h-2 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              {unpredictedCount > 0
                ? <p className="text-xs text-amber-500 dark:text-amber-400">Спрогнозовано: {predictedCount} з {upcomingMatches.length} матчів</p>
                : <p className="text-xs text-green-500 dark:text-green-400">✅ Всі майбутні матчі спрогнозовано</p>
              }
            </div>
          )}
          <MatchesTab matches={matchesTabMatches} userPredictions={userPredictions} userId={userId} defaultRound={defaultMatchesRound} />
        </>
      )}

      {/* ── Predictions ─────────────────────────────────────────────────── */}
      {tab === 'preds' && (
        <PredsTab finishedMatches={finishedMatches} predsByMatch={predsByMatch} profileMap={profileMap} defaultRound={defaultPredsRound} />
      )}

      {/* ── Standings ───────────────────────────────────────────────────── */}
      {tab === 'standings' && <StandingsTab standings={standings} roundLabels={roundLabels} roundPointsMap={byRound} probMatrix={probMatrix} upcomingCount={matchesTabMatches.length} />}

      {/* ── By round ────────────────────────────────────────────────────── */}
      {tab === 'rounds' && (
        <RoundsTab
          roundTables={roundTables}
          tournamentId={id}
          analysisMap={analysisMap}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
