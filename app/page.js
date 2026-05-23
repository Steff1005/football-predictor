import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const revalidate = 60

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

  const active = tournaments?.filter(t => t.is_active) ?? []
  const finished = tournaments?.filter(t => !t.is_active) ?? []

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">🏆 Турніри</h1>

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Активні</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map(tournament => (
              <a key={tournament.id} href={`/tournaments/${tournament.id}`}
                className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-green-500/50 transition-colors group flex items-center justify-between">
                <span className="font-semibold text-white group-hover:text-green-400 transition-colors">
                  {tournament.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium flex-shrink-0 ml-3">
                  Активний
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Завершені</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {finished.map(tournament => (
              <a key={tournament.id} href={`/tournaments/${tournament.id}`}
                className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-600 transition-colors group flex items-center justify-between">
                <span className="font-semibold text-gray-400 group-hover:text-white transition-colors">
                  {tournament.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 font-medium flex-shrink-0 ml-3">
                  Завершений
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {!tournaments?.length && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-5xl mb-4">🏆</p>
          <p>Турніри ще не додані</p>
        </div>
      )}
    </div>
  )
}
