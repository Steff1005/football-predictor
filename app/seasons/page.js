import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { SEASON, SEASON_LABEL, LEAGUES } from '@/lib/season-2026'

export const dynamic = 'force-dynamic'
export const metadata = { title: `Сезон ${SEASON_LABEL} — Kickoff` }

export default async function SeasonsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? null

  const { data: rows } = await supabase
    .from('season_predictions')
    .select('league_code, user_id')
    .eq('season', SEASON)

  const counts = {}
  const mine = new Set()
  for (const r of rows ?? []) {
    counts[r.league_code] = (counts[r.league_code] ?? 0) + 1
    if (r.user_id === userId) mine.add(r.league_code)
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
        📋 Прогноз сезону {SEASON_LABEL}
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-2xl">
        Обери лігу й склади прогноз: чемпіон, топ-4, три останні місця та сюрпризи сезону.
        Прогноз зберігається один раз — далі він стає карткою, яку бачать усі учасники.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {LEAGUES.map(l => (
          <a key={l.code} href={`/seasons/${l.code}`}
            className="block bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-green-500/50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
                {l.emblem
                  ? <img src={l.emblem} alt="" className="w-12 h-12 object-contain" />
                  : <span className="text-3xl">⚽</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400 transition-colors">
                    {l.name}
                  </span>
                  {mine.has(l.code)
                    ? <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-500/20 text-green-500 dark:text-green-400 flex-shrink-0">✓ Готово</span>
                    : <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">Не заповнено</span>}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {l.country} · {l.teams.length} команд
                  {counts[l.code] ? ` · ${counts[l.code]} прогноз${counts[l.code] === 1 ? '' : counts[l.code] < 5 ? 'и' : 'ів'}` : ''}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
