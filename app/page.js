import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import TOURNAMENT_LOGOS from '../lib/tournament-logos'

export const revalidate = 60

export const metadata = {
  title: 'Kickoff — Футбольні прогнози',
  openGraph: {
    title: 'Kickoff — Футбольні прогнози',
    description: 'Змагайтеся з друзями у прогнозуванні футбольних матчів',
    images: [{ url: '/icons/icon-512.png' }],
  },
}

const LEAGUE_EMOJI = { WC: '🌍', CL: '⭐', EC: '🇪🇺' }

function profileDisplayName(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}

function profileInitials(p) {
  const n = profileDisplayName(p)
  return n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

function ProfileAvatar({ profile, sizeCls = 'w-9 h-9', textCls = 'text-xs' }) {
  const ini = profileInitials(profile)
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={`${sizeCls} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${sizeCls} rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0`}>
      <span className={`font-bold text-green-600 dark:text-green-400 ${textCls}`}>{ini}</span>
    </div>
  )
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-xl">🥇</span>
  if (rank === 2) return <span className="text-xl">🥈</span>
  if (rank === 3) return <span className="text-xl">🥉</span>
  return <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{rank}</span>
}

// pts: undefined = no prediction, null = unscored, 0/1/4 = scored
function FormDot({ pts }) {
  if (pts == null)  return <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 inline-block" />
  if (pts === 4)    return <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
  if (pts === 1)    return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
  return              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  // ── Core data ─────────────────────────────────────────────────────────────
  const [{ data: tournaments }, { data: allProfiles }] = await Promise.all([
    supabase.from('tournaments').select('*'),
    supabase.from('profiles')
      .select('id, username, first_name, last_name, avatar_url, total_points, total_predictions')
      .order('total_points', { ascending: false }),
  ])

  const now = new Date()

  const activeTournaments = (tournaments ?? [])
    .filter(t => t.is_active)
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'))

  const finishedTournaments = (tournaments ?? [])
    .filter(t => !t.is_active)
    .sort((a, b) => b.name.localeCompare(a.name, 'uk'))

  const activeTids = activeTournaments.map(t => t.id)

  // ── Active match data ─────────────────────────────────────────────────────
  let allActiveMatches = []
  if (activeTids.length > 0) {
    const { data } = await supabase
      .from('matches')
      .select('id, tournament_id, status, kickoff_at')
      .in('tournament_id', activeTids)
      .order('kickoff_at', { ascending: false })
    allActiveMatches = data ?? []
  }

  // Per-tournament stats + upcoming match IDs
  const activeMatchStats = {}
  for (const m of allActiveMatches) {
    if (!activeMatchStats[m.tournament_id]) {
      activeMatchStats[m.tournament_id] = { total: 0, finished: 0, upcomingIds: [] }
    }
    const s = activeMatchStats[m.tournament_id]
    s.total++
    if (m.status === 'finished') s.finished++
    else if (new Date(m.kickoff_at) > now) s.upcomingIds.push(m.id)
  }

  // Last 8 finished matches across active tournaments (newest → oldest; reversed for strip display)
  const recentFinishedIds = allActiveMatches
    .filter(m => m.status === 'finished')
    .slice(0, 8)
    .reverse()
    .map(m => m.id)

  const allUpcomingIds = activeTournaments.flatMap(t => activeMatchStats[t.id]?.upcomingIds ?? [])

  // ── Predictions data ──────────────────────────────────────────────────────
  const [formPredsResult, userUpcomingPredsResult] = await Promise.all([
    recentFinishedIds.length > 0
      ? supabase.from('predictions').select('user_id, match_id, points').in('match_id', recentFinishedIds)
      : { data: [] },
    userId && allUpcomingIds.length > 0
      ? supabase.from('predictions').select('match_id').eq('user_id', userId).in('match_id', allUpcomingIds)
      : { data: [] },
  ])

  // form map: { userId: { matchId: points } }
  const formMap = {}
  for (const p of formPredsResult.data ?? []) {
    if (!formMap[p.user_id]) formMap[p.user_id] = {}
    formMap[p.user_id][p.match_id] = p.points
  }

  const userPredictedIds = new Set((userUpcomingPredsResult.data ?? []).map(p => p.match_id))

  // ── Leaderboard (profiles with at least 1 prediction) ────────────────────
  const leaderboard = (allProfiles ?? []).filter(p => (p.total_predictions ?? 0) > 0)

  // ── Community stats ───────────────────────────────────────────────────────
  const totalParticipants = leaderboard.length
  const totalPredictions  = leaderboard.reduce((s, p) => s + (p.total_predictions ?? 0), 0)
  const totalPoints       = leaderboard.reduce((s, p) => s + (p.total_points ?? 0), 0)
  const avgPoints         = totalParticipants > 0 ? Math.round(totalPoints / totalParticipants) : 0

  // ── Current user data ─────────────────────────────────────────────────────
  const myProfile = userId ? (allProfiles ?? []).find(p => p.id === userId) ?? null : null
  const myRank    = myProfile ? leaderboard.findIndex(p => p.id === userId) + 1 : null

  // Per active-tournament prediction progress
  const tourneyProgress = {}
  for (const t of activeTournaments) {
    const stats = activeMatchStats[t.id] ?? { total: 0, finished: 0, upcomingIds: [] }
    const upcoming  = stats.upcomingIds.length
    const predicted = userId ? stats.upcomingIds.filter(id => userPredictedIds.has(id)).length : 0
    tourneyProgress[t.id] = { upcoming, predicted, total: stats.total, finished: stats.finished }
  }

  return (
    <div className="space-y-6">

      {/* ── Personal welcome card ───────────────────────────────────────── */}
      {myProfile && (
        <div className="bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-500/15 dark:to-transparent rounded-2xl p-5 border border-green-500/20">
          <div className="flex items-center gap-4">
            <ProfileAvatar profile={myProfile} sizeCls="w-12 h-12" textCls="text-sm" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {profileDisplayName(myProfile)}
                </h2>
                {myRank && (
                  myRank <= 3
                    ? <span className="text-lg leading-none"><RankBadge rank={myRank} /></span>
                    : <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">#{myRank} місце</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0 text-sm">
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {myProfile.total_points ?? 0} балів
                </span>
                <span className="text-gray-400 dark:text-gray-500">
                  {myProfile.total_predictions ?? 0} прогнозів
                </span>
              </div>
            </div>
            <a href="/profile"
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors whitespace-nowrap flex-shrink-0">
              Профіль →
            </a>
          </div>
        </div>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Leaderboard ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Загальний рейтинг
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

            {/* Form strip legend */}
            {recentFinishedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                <span className="font-medium">Форма</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> 4 бали
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> 1 бал
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> 0 балів
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 inline-block" /> без прогнозу
                </span>
              </div>
            )}

            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
                Ще немає учасників
              </div>
            )}

            {leaderboard.map((p, idx) => {
              const rank = idx + 1
              const isMe = p.id === userId
              const form = recentFinishedIds.map(mid => {
                const entry = formMap[p.id]
                return entry ? entry[mid] : undefined
              })
              return (
                <div key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                    isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''
                  }`}>
                  {/* Rank badge */}
                  <div className="w-7 text-center flex-shrink-0">
                    <RankBadge rank={rank} />
                  </div>

                  {/* Avatar */}
                  <ProfileAvatar profile={p} sizeCls="w-8 h-8" textCls="text-xs" />

                  {/* Name + form strip */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate leading-snug">
                      {profileDisplayName(p)}
                      {isMe && <span className="text-green-500 dark:text-green-400 ml-1 text-xs font-normal">(я)</span>}
                    </div>
                    {recentFinishedIds.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {form.map((pts, i) => <FormDot key={i} pts={pts} />)}
                      </div>
                    )}
                  </div>

                  {/* Points */}
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="font-bold text-green-500 dark:text-green-400 leading-tight">
                      {p.total_points ?? 0}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
                      {p.total_predictions ?? 0} прогн.
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar ──────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Active tournaments */}
          {activeTournaments.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Активні турніри
              </h2>
              <div className="space-y-3">
                {activeTournaments.map(t => {
                  const prog = tourneyProgress[t.id] ?? { upcoming: 0, predicted: 0, total: 0, finished: 0 }
                  const pct  = prog.upcoming > 0 ? Math.round(prog.predicted / prog.upcoming * 100) : 100
                  return (
                    <a key={t.id} href={`/tournaments/${t.id}`}
                      className="block bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-green-500/50 transition-colors group">
                      <div className="flex items-center gap-3 mb-3">
                        {TOURNAMENT_LOGOS[t.league_id]
                          ? <img src={TOURNAMENT_LOGOS[t.league_id]} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                          : <span className="text-2xl leading-none">{LEAGUE_EMOJI[t.league_id] ?? '🏆'}</span>
                        }
                        <div className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-green-500 dark:group-hover:text-green-400 transition-colors leading-tight">
                          {t.name}
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                        {prog.finished} / {prog.total} матчів зіграно
                      </div>

                      {/* Match progress bar */}
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-2">
                        <div
                          className="bg-gray-400 dark:bg-gray-500 rounded-full h-1.5 transition-all"
                          style={{ width: `${prog.total > 0 ? Math.round(prog.finished / prog.total * 100) : 0}%` }}
                        />
                      </div>

                      {/* User prediction progress */}
                      {userId && prog.upcoming > 0 && (
                        <>
                          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-1">
                            <div className="bg-green-500 rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className={`text-xs ${pct === 100 ? 'text-green-500 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`}>
                            {pct === 100
                              ? '✅ Всі прогнози зроблені'
                              : `Прогнози: ${prog.predicted} / ${prog.upcoming}`
                            }
                          </div>
                        </>
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Community stats */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Спільнота
            </h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalParticipants}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">учасників</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500 dark:text-green-400">{totalPoints}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">загальних балів</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPredictions}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">прогнозів</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgPoints}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">сер. балів</div>
              </div>
            </div>
          </div>

          {/* Finished tournaments */}
          {finishedTournaments.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Завершені турніри
              </h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {finishedTournaments.map((t, i) => (
                  <a key={t.id} href={`/tournaments/${t.id}`}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      i < finishedTournaments.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                    }`}>
                    {TOURNAMENT_LOGOS[t.league_id]
                      ? <img src={TOURNAMENT_LOGOS[t.league_id]} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                      : <span className="text-base leading-none">{LEAGUE_EMOJI[t.league_id] ?? '🏆'}</span>
                    }
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{t.name}</span>
                    <span className="text-gray-300 dark:text-gray-600 text-xs flex-shrink-0">→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
