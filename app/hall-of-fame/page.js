import { createServerClient } from '@supabase/ssr'
import TOURNAMENT_LOGOS from '../../lib/tournament-logos'
import { compareTournamentStandings } from '../../lib/rankings'

export const revalidate = 300
export const metadata = { title: 'Зал слави — Kickoff' }

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

function PlayerAvatar({ profile, size = 'w-9 h-9', text = 'text-xs' }) {
  const name = displayName(profile)
  const initials = name === '—' ? '?' : name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`${size} rounded-full flex-shrink-0 overflow-hidden bg-green-500/20 flex items-center justify-center`}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className={`font-bold text-green-600 dark:text-green-400 ${text}`}>{initials}</span>
      }
    </div>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

async function fetchStandings(supabase, tournamentId) {
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
  if (!matches?.length) return []

  const matchIds = matches.map(m => m.id)

  // Paginate predictions
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
    .order('created_at', { ascending: false })

  const enriched = await Promise.all(
    (tournaments ?? []).map(async t => ({
      tournament: t,
      standings: await fetchStandings(supabase, t.id),
    }))
  )

  // Only show tournaments that actually have results
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

      <div className="space-y-6">
        {withResults.map(({ tournament, standings }) => {
          const top3 = standings.slice(0, 3)
          const winner = standings[0]

          return (
            <div key={tournament.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

              {/* Tournament header */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-gradient-to-r from-yellow-500/5 to-transparent">
                {TOURNAMENT_LOGOS[tournament.league_id] && (
                  <img src={TOURNAMENT_LOGOS[tournament.league_id]} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg leading-tight">{tournament.name}</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Завершений турнір · {standings.length} учасник{standings.length === 1 ? '' : standings.length < 5 ? 'и' : 'ів'}</p>
                </div>
                <a href={`/tournaments/${tournament.id}?tab=standings`}
                  className="text-xs text-green-500 hover:text-green-400 font-medium whitespace-nowrap flex-shrink-0 transition-colors">
                  Таблиця →
                </a>
              </div>

              {/* Winner spotlight */}
              {winner && (
                <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-white/10">
                  <span className="text-3xl">🥇</span>
                  <PlayerAvatar profile={winner.profile} size="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{displayName(winner.profile)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Переможець</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-yellow-500">{winner.total}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">очок</p>
                  </div>
                </div>
              )}

              {/* Top 3 */}
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {top3.map((row, i) => (
                  <a key={row.uid} href={`/players/${row.uid}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <span className="text-lg w-6 text-center flex-shrink-0">{MEDALS[i]}</span>
                    <PlayerAvatar profile={row.profile} size="w-8 h-8" text="text-xs" />
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate min-w-0">
                      {displayName(row.profile)}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0 text-right">
                      <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                        🎯 {row.exact} · ✅ {row.results}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm w-8 text-right">{row.total}</span>
                    </div>
                  </a>
                ))}
              </div>

              {/* Show remaining count if more than 3 */}
              {standings.length > 3 && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10">
                  <a href={`/tournaments/${tournament.id}?tab=standings`}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors">
                    + ще {standings.length - 3} учасник{standings.length - 3 === 1 ? '' : standings.length - 3 < 5 ? 'и' : 'ів'} →
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
