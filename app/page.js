import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import MatchCard from '../components/MatchCard'

export const revalidate = 60

export default async function HomePage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .gte('kickoff_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('kickoff_at', { ascending: true })
    .limit(50)

  let userPredictions = {}
  if (userId) {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
    predictions?.forEach(p => {
      userPredictions[p.match_id] = p
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">⚽ Прогнози на матчі</h1>
        {!userId && (
          <a href="/auth" className="bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded-lg font-medium">
            Увійди щоб прогнозувати
          </a>
        )}
      </div>

      <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-4 mb-8 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold">🎯 4 бали</span>
          <span className="text-gray-400">— точний рахунок</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold">✅ 1 бал</span>
          <span className="text-gray-400">— вгадав результат</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-bold">❌ 0 балів</span>
          <span className="text-gray-400">— не вгадав</span>
        </div>
      </div>

      {tournaments?.map(tournament => {
        const tournamentMatches = matches?.filter(m => m.tournament_id === tournament.id)
        if (!tournamentMatches?.length) return null
        return (
          <div key={tournament.id} className="mb-10">
            <h2 className="text-xl font-semibold text-gray-300 mb-4">🏆 {tournament.name}</h2>
            <div className="space-y-3">
              {tournamentMatches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  userPrediction={userPredictions[match.id]}
                  userId={userId}
                />
              ))}
            </div>
          </div>
        )
      })}

      {!matches?.length && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-5xl mb-4">⚽</p>
          <p>Матчі ще не завантажені</p>
        </div>
      )}
    </div>
  )
}