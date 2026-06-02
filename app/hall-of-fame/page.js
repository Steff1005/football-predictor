import { createServerClient } from '@supabase/ssr'
import TOURNAMENT_LOGOS from '../../lib/tournament-logos'
import { compareTournamentStandings } from '../../lib/rankings'
import Avatar from '../../components/Avatar'

export const revalidate = 300
export const metadata = { title: 'Зал слави — Kickoff' }

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

function getInitials(profile) {
  const name = displayName(profile)
  return name === '—' ? '?' : name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

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

const RANK_STYLE = [
  {
    medal: '🥇',
    row: 'bg-yellow-500/5 border-l-[3px] border-l-yellow-400',
    pts: 'text-yellow-500 dark:text-yellow-400',
    avatarCls: 'w-10 h-10',
    nameCls: 'text-base font-bold text-gray-900 dark:text-white',
  },
  {
    medal: '🥈',
    row: 'border-l-[3px] border-l-gray-400',
    pts: 'text-gray-500 dark:text-gray-300',
    avatarCls: 'w-8 h-8',
    nameCls: 'text-sm font-medium text-gray-800 dark:text-gray-200',
  },
  {
    medal: '🥉',
    row: 'border-l-[3px] border-l-orange-400/70',
    pts: 'text-orange-600 dark:text-orange-400',
    avatarCls: 'w-8 h-8',
    nameCls: 'text-sm font-medium text-gray-800 dark:text-gray-200',
  },
]

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
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Переможці завершених турнірів</p>
          </div>
        </div>
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-5xl mb-4">🏛️</p>
          <p>Завершених турнірів ще немає</p>
        </div>
      </div>
    )
  }

  // Fetch last match date per tournament for sorting
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

  // Sort by last match date descending
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <span className="text-4xl">🏛️</span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Зал слави</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Переможці завершених турнірів</p>
        </div>
      </div>

      {withResults.length === 0 && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-5xl mb-4">🏛️</p>
          <p>Завершених турнірів ще немає</p>
        </div>
      )}

      <div className="space-y-5">
        {withResults.map(({ tournament, lastDate, standings }) => {
          const top3 = standings.slice(0, 3)
          const rest = standings.length - top3.length

          const dateLabel = lastDate
            ? new Date(lastDate).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
            : null

          return (
            <div key={tournament.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/10">
                {TOURNAMENT_LOGOS[tournament.league_id] && (
                  <img src={TOURNAMENT_LOGOS[tournament.league_id]} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg leading-tight truncate">{tournament.name}</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {[dateLabel, `${standings.length} учасник${standings.length === 1 ? '' : standings.length < 5 ? 'и' : 'ів'}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <a href={`/tournaments/${tournament.id}?tab=standings`}
                  className="text-xs text-green-500 hover:text-green-400 font-medium whitespace-nowrap flex-shrink-0 transition-colors">
                  Таблиця →
                </a>
              </div>

              {/* Top 3 — unified list, each rank styled differently */}
              <div>
                {top3.map((row, i) => {
                  const s = RANK_STYLE[i]
                  return (
                    <a key={row.uid} href={`/players/${row.uid}`}
                      className={`flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${s.row}`}>
                      <span className="text-xl w-6 text-center flex-shrink-0 leading-none">{s.medal}</span>
                      <Avatar url={row.profile?.avatar_url} initials={getInitials(row.profile)} sizeCls={s.avatarCls} textCls="text-xs" />
                      <span className={`flex-1 min-w-0 truncate ${s.nameCls}`}>
                        {displayName(row.profile)}
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                          🎯 {row.exact} &nbsp;✅ {row.results}
                        </span>
                        <span className={`font-bold text-base tabular-nums ${s.pts}`}>{row.total}</span>
                      </div>
                    </a>
                  )
                })}
              </div>

              {/* Footer: remaining count */}
              {rest > 0 && (
                <div className="px-5 py-2.5 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
                  <a href={`/tournaments/${tournament.id}?tab=standings`}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors">
                    + ще {rest} учасник{rest === 1 ? '' : rest < 5 ? 'и' : 'ів'} →
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
