import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const revalidate = 60

const LEAGUE_EMOJI = { WC: '🌍', CL: '⭐', EC: '🇪🇺' }

function leagueEmoji(leagueId) {
  return LEAGUE_EMOJI[leagueId] ?? '🏆'
}

function pluralMatches(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'матч'
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'матчі'
  return 'матчів'
}

function formatDateRange(min, max) {
  if (!min || !max) return null
  const opts = { day: '2-digit', month: '2-digit' }
  const d1 = new Date(min).toLocaleDateString('uk-UA', opts)
  const d2 = new Date(max).toLocaleDateString('uk-UA', { ...opts, year: '2-digit' })
  return d1 === d2 ? d1 : `${d1} – ${d2}`
}

export default async function HomePage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  // Fetch match stats for all tournaments in one query
  const statsMap = {}
  if (tournaments?.length) {
    const { data: matchData } = await supabase
      .from('matches')
      .select('tournament_id, kickoff_at')
      .in('tournament_id', tournaments.map(t => t.id))

    for (const m of matchData ?? []) {
      const s = statsMap[m.tournament_id]
      if (!s) {
        statsMap[m.tournament_id] = { count: 1, min: m.kickoff_at, max: m.kickoff_at }
      } else {
        s.count++
        if (m.kickoff_at < s.min) s.min = m.kickoff_at
        if (m.kickoff_at > s.max) s.max = m.kickoff_at
      }
    }
  }

  const active   = tournaments?.filter(t => t.is_active)  ?? []
  const finished = tournaments?.filter(t => !t.is_active) ?? []

  function TournamentCard({ tournament, isActive }) {
    const stats = statsMap[tournament.id]
    const dateRange = stats ? formatDateRange(stats.min, stats.max) : null

    return (
      <a href={`/tournaments/${tournament.id}`}
        className={`block bg-white dark:bg-gray-900 rounded-xl p-5 border transition-colors group ${
          isActive
            ? 'border-gray-200 dark:border-gray-800 hover:border-green-500/50'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
        }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">{leagueEmoji(tournament.league_id)}</span>
            <span className={`font-semibold text-sm sm:text-base truncate transition-colors ${
              isActive
                ? 'text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400'
                : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'
            }`}>
              {tournament.name}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
            isActive
              ? 'bg-green-500/20 text-green-500 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
          }`}>
            {isActive ? 'Активний' : 'Завершений'}
          </span>
        </div>

        {stats && (
          <div className="mt-1.5 ml-9 text-xs text-gray-400 dark:text-gray-500">
            {stats.count} {pluralMatches(stats.count)}
            {dateRange && <> · {dateRange}</>}
          </div>
        )}
      </a>
    )
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">🏆 Турніри</h1>

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Активні</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map(t => <TournamentCard key={t.id} tournament={t} isActive={true} />)}
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Завершені</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {finished.map(t => <TournamentCard key={t.id} tournament={t} isActive={false} />)}
          </div>
        </div>
      )}

      {!tournaments?.length && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-5xl mb-4">🏆</p>
          <p>Турніри ще не додані</p>
        </div>
      )}
    </div>
  )
}
