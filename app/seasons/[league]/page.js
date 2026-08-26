import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { notFound } from 'next/navigation'
import SeasonCard from '@/components/SeasonCard'
import SeasonPredictionForm from './SeasonPredictionForm'
import { SEASON, SEASON_LABEL, LEAGUES, getLeague, relegationPositions } from '@/lib/season-2026'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { league: code } = await params
  const lg = getLeague(code)
  return { title: lg ? `${lg.name} ${SEASON_LABEL} — Kickoff` : 'Сезон — Kickoff' }
}

export default async function SeasonLeaguePage({ params }) {
  const { league: code } = await params
  const league = getLeague(code)
  if (!league) notFound()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? null

  const { data: predictions } = await supabase
    .from('season_predictions')
    .select('*')
    .eq('season', SEASON)
    .eq('league_code', league.code)
    .order('created_at')

  const rows = predictions ?? []
  const { data: profs } = rows.length
    ? await supabase.from('profiles').select('id, first_name, last_name, username, avatar_url')
      .in('id', [...new Set(rows.map(r => r.user_id))])
    : { data: [] }
  const profileMap = Object.fromEntries((profs ?? []).map(p => [p.id, p]))

  const mine = rows.find(r => r.user_id === userId) ?? null
  const others = rows.filter(r => r.user_id !== userId)

  return (
    <div>
      {/* ── Перемикач ліг ─────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none">
        {LEAGUES.map(l => (
          <a key={l.code} href={`/seasons/${l.code}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              l.code === league.code
                ? 'bg-green-500 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}>
            {l.emblem && <img src={l.emblem} alt="" className="w-5 h-5 object-contain" />}
            {l.shortName}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-1">
        {league.emblem && <img src={league.emblem} alt="" className="w-10 h-10 object-contain flex-shrink-0" />}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {league.name} {SEASON_LABEL}
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {league.country} · {league.teams.length} команд · прогнозів: {rows.length}
          </p>
        </div>
      </div>

      {/* ── Форма або своя картка ─────────────────────────────── */}
      <div className="mt-6">
        {!userId ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-3">Увійди, щоб зробити свій прогноз</p>
            <a href="/auth" className="inline-block px-5 py-2.5 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-colors">
              Увійти
            </a>
          </div>
        ) : mine ? (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Твій прогноз
            </h2>
            <SeasonCard league={league} prediction={mine} profile={profileMap[mine.user_id]} />
          </div>
        ) : (
          <SeasonPredictionForm league={league} relPos={relegationPositions(league.code)} />
        )}
      </div>

      {/* ── Картки інших учасників ────────────────────────────── */}
      {others.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Прогнози учасників ({others.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {others.map(p => (
              <SeasonCard key={p.id} league={league} prediction={p} profile={profileMap[p.user_id]} />
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 && userId && (
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">
          Прогнозів на цю лігу ще немає — будеш першим.
        </p>
      )}
    </div>
  )
}
