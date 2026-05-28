import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import TOURNAMENT_LOGOS from '../../lib/tournament-logos'
import { pluralMatches } from '../../lib/formatters'

export const revalidate = 60
export const metadata = { title: 'Турніри — Kickoff' }

const LEAGUE_EMOJI = { WC: '🌍', CL: '⭐', EC: '🇪🇺' }

const TOURNAMENT_DESCRIPTIONS = {
  'Чемпіонат світу 2026':   '104 матчі · 11.06 – 19.07.26',
  'Ліга чемпіонів 2025-26': '189 матчів · 11.06.25 – 30.04.26',
  'Ліга чемпіонів 2024-25': '189 матчів · 17.09.24 – 31.05.25',
  'Ліга чемпіонів 2023-24': '125 матчів · 19.09.23 – 01.06.24',
  'Чемпіонат Європи 2024':  '51 матч · 14.06.24 – 14.07.24',
}

function formatDateRange(min, max) {
  if (!min || !max) return null
  const opts = { day: '2-digit', month: '2-digit' }
  const d1 = new Date(min).toLocaleDateString('uk-UA', opts)
  const d2 = new Date(max).toLocaleDateString('uk-UA', { ...opts, year: '2-digit' })
  return d1 === d2 ? d1 : `${d1} – ${d2}`
}

export default async function TournamentsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: tournaments } = await supabase.from('tournaments').select('*')

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

  const active = (tournaments?.filter(t => t.is_active) ?? [])
    .sort((a, b) => (statsMap[a.id]?.max ?? '').localeCompare(statsMap[b.id]?.max ?? ''))

  const finished = (tournaments?.filter(t => !t.is_active) ?? [])
    .sort((a, b) => (statsMap[b.id]?.max ?? '').localeCompare(statsMap[a.id]?.max ?? ''))

  function TournamentCard({ tournament, isActive }) {
    const stats = statsMap[tournament.id]
    const description = TOURNAMENT_DESCRIPTIONS[tournament.name] ?? (stats
      ? [`${stats.count} ${pluralMatches(stats.count)}`, formatDateRange(stats.min, stats.max)].filter(Boolean).join(' · ')
      : null)

    return (
      <a href={`/tournaments/${tournament.id}`}
        className={`block bg-white dark:bg-gray-900 rounded-xl p-4 border transition-colors group ${
          isActive
            ? 'border-gray-200 dark:border-gray-800 hover:border-green-500/50'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
        }`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
            {TOURNAMENT_LOGOS[tournament.league_id]
              ? <img src={TOURNAMENT_LOGOS[tournament.league_id]} alt="" className="w-20 h-20 object-contain" />
              : <span className="text-4xl">{LEAGUE_EMOJI[tournament.league_id] ?? '🏆'}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className={`font-semibold text-sm sm:text-base leading-snug transition-colors ${
                isActive
                  ? 'text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400'
                  : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'
              }`}>
                {tournament.name}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 whitespace-nowrap ${
                isActive
                  ? 'bg-green-500/20 text-green-500 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              }`}>
                {isActive ? 'Активний' : 'Завершений'}
              </span>
            </div>
            {description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{description}</p>
            )}
          </div>
        </div>
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
