import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import TournamentFilter from './TournamentFilter'
import AvatarUpload from './AvatarUpload'

export const metadata = { title: 'Профіль — Football Predictor' }

export default async function ProfilePage({ searchParams }) {
  const { tournament: tournamentFilter = 'all' } = await searchParams

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth')

  const userId = session.user.id

  const [
    { data: profile },
    { data: rawPredictions },
    { data: tournaments },
  ] = await Promise.all([
    supabase.from('profiles').select('username, first_name, last_name, total_points, total_predictions, avatar_url').eq('id', userId).single(),
    supabase.from('predictions').select('*').eq('user_id', userId),
    supabase.from('tournaments').select('id, name').order('name'),
  ])

  const matchIds = rawPredictions?.map(p => p.match_id) ?? []
  let matchMap = {}
  if (matchIds.length > 0) {
    const { data: matches } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_logo, away_logo, home_score, away_score, status, kickoff_at, tournament_id')
      .in('id', matchIds)
    matches?.forEach(m => { matchMap[m.id] = m })
  }

  const allPredictions = (rawPredictions ?? [])
    .map(p => ({ ...p, match: matchMap[p.match_id] }))
    .filter(p => p.match)
    .sort((a, b) => new Date(b.match.kickoff_at) - new Date(a.match.kickoff_at))

  const filtered = tournamentFilter === 'all'
    ? allPredictions
    : allPredictions.filter(p => p.match.tournament_id === tournamentFilter)

  const finished = allPredictions.filter(p => p.points !== null)
  const totalPoints = finished.reduce((s, p) => s + (p.points ?? 0), 0)
  const exactScores = finished.filter(p => p.points === 4).length
  const correctResults = finished.filter(p => p.points === 1).length

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const displayName = fullName || profile?.username || session.user.email?.split('@')[0] || 'Гравець'
  const initials = (profile?.first_name?.[0] ?? displayName[0] ?? '?').toUpperCase() +
                   (profile?.last_name?.[0] ?? displayName[1] ?? '').toUpperCase()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <AvatarUpload userId={userId} avatarUrl={profile?.avatar_url} initials={initials} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{session.user.email}</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-green-500 dark:text-green-400">{totalPoints}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Балів</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{finished.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Прогнозів</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{exactScores}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Точних рахунків</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-center">
          <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">{correctResults}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Вірних результатів</div>
        </div>
      </div>

      {/* Predictions list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Мої прогнози</h2>
        {tournaments && tournaments.length > 1 && (
          <TournamentFilter tournaments={tournaments} current={tournamentFilter} />
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p>Прогнозів ще немає</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const m = p.match
            const kickoff = new Date(m.kickoff_at)
            const dateStr = kickoff.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
            const isFinished = m.status === 'finished'

            return (
              <div key={p.id} className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  {/* Teams */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      {m.home_logo && <img src={m.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                      <span className="truncate">{m.home_team}</span>
                      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">vs</span>
                      <span className="truncate">{m.away_team}</span>
                      {m.away_logo && <img src={m.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{dateStr}</div>
                  </div>

                  {/* Scores */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Прогноз</div>
                      <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                        {p.predicted_home}:{p.predicted_away}
                      </div>
                    </div>

                    {isFinished && (
                      <div className="text-center">
                        <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Рахунок</div>
                        <div className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                          {m.home_score}:{m.away_score}
                        </div>
                      </div>
                    )}

                    {isFinished ? (
                      <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        p.points === 4 ? 'bg-yellow-500/20 text-yellow-500 dark:text-yellow-400' :
                        p.points === 1 ? 'bg-green-500/20 text-green-500 dark:text-green-400' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {p.points === 4 ? '🎯 +4' : p.points === 1 ? '✅ +1' : '❌ 0'}
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                        Очікує
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
