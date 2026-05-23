import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import MatchCard from '../../../components/MatchCard'

export const revalidate = 60

export default async function TournamentPage({ params, searchParams }) {
  const { id } = await params
  const { tab = 'matches' } = await searchParams

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  const [{ data: tournament }, { data: matches }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('matches').select('*').eq('tournament_id', id).order('kickoff_at', { ascending: true }),
  ])

  if (!tournament) {
    return (
      <div className="text-center py-20 text-gray-600">
        <p className="text-5xl mb-4">🏆</p>
        <p>Турнір не знайдено</p>
      </div>
    )
  }

  let userPredictions = {}
  if (userId) {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
    predictions?.forEach(p => { userPredictions[p.match_id] = p })
  }

  // Tournament leaderboard — aggregate predictions for this tournament's matches
  const matchIds = matches?.map(m => m.id) ?? []
  let leaderboard = []

  if (matchIds.length > 0) {
    const { data: allPredictions } = await supabase
      .from('predictions')
      .select('user_id, points')
      .in('match_id', matchIds)
      .not('points', 'is', null)

    const userStats = {}
    allPredictions?.forEach(p => {
      if (!userStats[p.user_id]) userStats[p.user_id] = { points: 0, predictions: 0 }
      userStats[p.user_id].points += p.points ?? 0
      userStats[p.user_id].predictions += 1
    })

    const userIds = Object.keys(userStats)
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds)

      leaderboard = (profiles ?? [])
        .map(profile => ({
          username: profile.username,
          points: userStats[profile.id]?.points ?? 0,
          predictions: userStats[profile.id]?.predictions ?? 0,
        }))
        .sort((a, b) => b.points - a.points)
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-gray-300 transition-colors">Турніри</a>
        <span>/</span>
        <span className="text-gray-300 truncate">{tournament.name}</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6">{tournament.name}</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        <a href={`/tournaments/${id}?tab=matches`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'matches' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          Матчі
        </a>
        <a href={`/tournaments/${id}?tab=standings`}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'standings' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
          }`}>
          Рейтинг
        </a>
      </div>

      {tab === 'matches' ? (
        <div className="space-y-3">
          {matches?.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              userPrediction={userPredictions[match.id]}
              userId={userId}
            />
          ))}
          {!matches?.length && (
            <div className="text-center py-20 text-gray-600">
              <p className="text-5xl mb-4">⚽</p>
              <p>Матчі ще не завантажені</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Mobile — cards */}
          <div className="sm:hidden space-y-2">
            {leaderboard.map((player, index) => (
              <div key={player.username} className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg w-8">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                      <span className="text-gray-500 text-sm">{index + 1}</span>}
                  </span>
                  <span className="font-medium text-white">{player.username}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-400 text-lg">{player.points}</div>
                  <div className="text-xs text-gray-500">{player.predictions} прогнозів</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop — table */}
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
                {leaderboard.map((player, index) => (
                  <tr key={player.username} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 font-bold text-lg">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' :
                        <span className="text-gray-500">{index + 1}</span>}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{player.username}</td>
                    <td className="px-6 py-4 text-right text-gray-400">{player.predictions}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-400 text-lg">{player.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-20 text-gray-600">
              <p className="text-5xl mb-4">📊</p>
              <p>Поки немає прогнозів</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
