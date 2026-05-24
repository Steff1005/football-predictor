import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const revalidate = 300

function playerName(p) {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
}

export default async function LeaderboardPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('username, first_name, last_name, total_points, total_predictions')
    .order('total_points', { ascending: false })
    .limit(50)

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">🏆 Таблиця лідерів</h1>

      {/* Mobile — cards */}
      <div className="sm:hidden space-y-2">
        {leaderboard?.map((player, index) => (
          <div key={player.username ?? index} className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg w-8">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                  <span className="text-gray-400 dark:text-gray-500 text-sm">{index + 1}</span>}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">{playerName(player)}</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-500 dark:text-green-400 text-lg">{player.total_points}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{player.total_predictions} прогнозів</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop — table */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-6 py-4 text-gray-500 dark:text-gray-400 font-medium w-12">#</th>
              <th className="text-left px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">Учасник</th>
              <th className="text-right px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">Прогнози</th>
              <th className="text-right px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">Бали</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard?.map((player, index) => (
              <tr key={player.username ?? index} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="px-6 py-4 font-bold text-lg">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                    <span className="text-gray-400 dark:text-gray-500">{index + 1}</span>}
                </td>
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{playerName(player)}</td>
                <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{player.total_predictions}</td>
                <td className="px-6 py-4 text-right font-bold text-green-500 dark:text-green-400 text-lg">{player.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
