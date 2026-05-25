'use client'
import { useState } from 'react'

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

function UserIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  )
}

function PointsBadge({ pts }) {
  if (pts === 4) return <span className="text-sm flex-shrink-0 w-14 text-right">🎯 +4</span>
  if (pts === 1) return <span className="text-sm flex-shrink-0 w-14 text-right">✅ +1</span>
  return <span className="text-sm flex-shrink-0 w-14 text-right text-gray-400 dark:text-gray-500">❌ 0</span>
}

export default function PredsTab({ finishedMatches, predsByMatch, profileMap }) {
  const [openMatches, setOpenMatches] = useState(
    () => finishedMatches.length > 0 ? { [finishedMatches[0].id]: true } : {}
  )

  function toggleMatch(matchId) {
    setOpenMatches(prev => ({ ...prev, [matchId]: !prev[matchId] }))
  }

  if (!finishedMatches.length) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-600">
        <p className="text-5xl mb-4">🔒</p>
        <p>Результати стануть доступні після завершення матчів</p>
      </div>
    )
  }

  return (
    <div>
      {finishedMatches.map(match => {
        const preds = (predsByMatch[match.id] ?? [])
          .filter(p => profileMap[p.user_id])
          .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))

        const isOpen  = !!openMatches[match.id]

        const kickoff = new Date(match.kickoff_at)
        const dateStr = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })

        return (
          <div key={match.id} className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden mb-2">
            {/* ── Collapsed header ── */}
            <div
              onClick={() => toggleMatch(match.id)}
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 gap-2 select-none"
            >
              {/* Date */}
              <span className="text-xs text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">{dateStr}</span>

              {/* Home team — right-aligned, fixed half */}
              <div className="flex items-center gap-1.5 w-[38%] justify-end min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate text-right">{match.home_team}</span>
                {match.home_logo && <img src={match.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
              </div>

              {/* Score badge — fixed width */}
              <div className="w-[72px] flex justify-center flex-shrink-0">
                {match.status === 'finished' ? (
                  <span className="bg-gray-100 dark:bg-white/10 rounded-md px-3 py-0.5 font-mono text-sm font-semibold text-gray-900 dark:text-white">
                    {match.home_score}:{match.away_score}
                  </span>
                ) : match.status === 'live' ? (
                  <span className="bg-red-500/10 rounded-md px-2 py-0.5 text-xs font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">
                    🔴 Live
                  </span>
                ) : (
                  <span className="bg-yellow-500/10 rounded-md px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                    Триває
                  </span>
                )}
              </div>

              {/* Away team — left-aligned, fixed half */}
              <div className="flex items-center gap-1.5 w-[38%] justify-start min-w-0">
                {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{match.away_team}</span>
              </div>

              {/* Chevron — end of row */}
              <svg
                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ml-auto ${isOpen ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* ── Expanded predictions ── */}
            {isOpen && (
              <div>
                {preds.length === 0 ? (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10 text-sm text-center text-gray-400 dark:text-gray-600">
                    Прогнозів немає
                  </div>
                ) : preds.map(pred => {
                  const profile    = profileMap[pred.user_id]
                  const pts        = pred.points
                  const isFinished = match.status === 'finished'

                  return (
                    <div key={pred.user_id} className="flex items-center px-4 py-2 border-t border-gray-100 dark:border-white/10 gap-3">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <UserIcon />
                        }
                      </div>

                      {/* Name */}
                      <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">
                        {displayName(profile)}
                      </span>

                      {/* Predicted score — fixed width */}
                      <span className="font-mono text-sm text-gray-500 dark:text-gray-400 w-12 text-center flex-shrink-0">
                        {pred.predicted_home}:{pred.predicted_away}
                      </span>

                      {/* Points badge */}
                      {isFinished && <PointsBadge pts={pts} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
