import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const revalidate = 300

export default async function LeaderboardPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('username, total_points, total_predictions')
    .order('total_points', { ascending: false })
    .limit(50)

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">🏆 Таблиця лідерів</h1>

      {/* Мобільна версія — картки */}
      <div className="sm:hidden space-y-2">
        {leaderboard?.map((player, index) => (
          <div key={player.username} className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg w-8">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                  <span className="text-gray-500 text-sm">{index + 1}</span>}
              </span>
              <span className="font-medium text-white">{player.username}</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-400 text-lg">{player.total_points}</div>
              <div className="text-xs text-gray-500">{player.total_predictions} прогнозів</div>
            </div>
          </div>
        ))}
      </div>

      {/* Десктоп версія — таблиця */}
      <div className="hidden sm:block bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-4 text-gray-400 font-medium w-12">#</th>
              <th className="text-left px-6 py-4 text-gray-400 font-medium">Учасник</th>
              <th className="text-right px-6 py-4 text-gray-400 font-medium">Прогнози</th>
              <th className="text-right px-6 py-4 text-gray-400 font-medium">Бали</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard?.map((player, index) => (
              <tr key={player.username} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-4 font-bold text-lg">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                    <span className="text-gray-500">{index + 1}</span>}
                </td>
                <td className="px-6 py-4 font-medium text-white">{player.username}</td>
                <td className="px-6 py-4 text-right text-gray-400">{player.total_predictions}</td>
                <td className="px-6 py-4 text-right font-bold text-green-400 text-lg">{player.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}