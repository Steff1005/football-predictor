'use client'
import { useState } from 'react'
import PredictionBadge from '../../../components/PredictionBadge'
import { groupAndSortMatches } from '../../../lib/round-sort'

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

function Chevron({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ScoreChip({ match }) {
  if (match.status === 'finished') {
    return (
      <span className="bg-gray-100 dark:bg-white/10 rounded-md px-3 py-0.5 font-mono text-sm font-semibold text-gray-900 dark:text-white">
        {match.home_score}:{match.away_score}
      </span>
    )
  }
  if (match.status === 'live') {
    return (
      <span className="bg-red-500/10 rounded-md px-2 py-0.5 text-xs font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">
        🔴 Live
      </span>
    )
  }
  return (
    <span className="bg-yellow-500/10 rounded-md px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
      Триває
    </span>
  )
}

export default function PredsTab({ finishedMatches, predsByMatch, profileMap, defaultRound }) {
  const groups = groupAndSortMatches(finishedMatches)
  const rounds = groups.map(g => g.label)

  const [activeRound, setActiveRound] = useState(defaultRound ?? rounds[rounds.length - 1] ?? null)
  const [openMatches, setOpenMatches] = useState({})

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

  const activeGroup = groups.find(g => g.label === activeRound) ?? groups[groups.length - 1]
  const activeMatches = activeGroup?.matches ?? []

  return (
    <div>
      {/* Round navigation */}
      <div className="flex gap-2 flex-wrap mb-4">
        {rounds.map(round => (
          <button
            key={round}
            onClick={() => setActiveRound(round)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeRound === round
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'
            }`}
          >
            {round}
          </button>
        ))}
      </div>

      {activeMatches.map(match => {
        const preds = (predsByMatch[match.id] ?? [])
          .filter(p => profileMap[p.user_id])
          .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))

        const isOpen  = !!openMatches[match.id]
        const kickoff = new Date(match.kickoff_at)
        const dateStr = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
        const isFinished = match.status === 'finished'

        return (
          <div key={match.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-2">

            {/* ── Collapsed header ── */}
            <div
              onClick={() => toggleMatch(match.id)}
              className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 select-none"
            >
              {/* === Mobile layout: date row + teams row === */}
              <div className="sm:hidden">
                {/* Date + chevron */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr}</span>
                  <Chevron open={isOpen} />
                </div>
                {/* Home: logo + full name + score */}
                <div className="flex items-center gap-2 mb-1">
                  {match.home_logo && <img src={match.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 leading-tight">
                    {match.home_team}
                  </span>
                  <div className="flex justify-center flex-shrink-0">
                    <ScoreChip match={match} />
                  </div>
                </div>
                {/* Away: logo + full name */}
                <div className="flex items-center gap-2">
                  {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                    {match.away_team}
                  </span>
                </div>
              </div>

              {/* === Desktop layout: single row === */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">{dateStr}</span>

                <div className="flex items-center gap-1.5 w-[38%] justify-end min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate text-right">{match.home_team}</span>
                  {match.home_logo && <img src={match.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                </div>

                <div className="w-[72px] flex justify-center flex-shrink-0">
                  <ScoreChip match={match} />
                </div>

                <div className="flex items-center gap-1.5 w-[38%] justify-start min-w-0">
                  {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{match.away_team}</span>
                </div>

                <Chevron open={isOpen} />
              </div>
            </div>

            {/* ── Expanded predictions ── */}
            {isOpen && (
              <div>
                {preds.length === 0 ? (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-white/10 text-sm text-center text-gray-400 dark:text-gray-600">
                    Прогнозів немає
                  </div>
                ) : preds.map(pred => {
                  const profile = profileMap[pred.user_id]

                  return (
                    <div key={pred.user_id} className="flex items-center px-4 py-2 border-t border-gray-100 dark:border-white/10 gap-3">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        {profile?.avatar_url
                          ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <UserIcon />
                        }
                      </div>

                      <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">
                        {displayName(profile)}
                      </span>

                      <span className="bg-gray-100 dark:bg-white/10 rounded-md px-2.5 py-0.5 font-mono text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0 min-w-[2.75rem] text-center">
                        {pred.predicted_home}:{pred.predicted_away}
                      </span>

                      <div className="w-16 flex-shrink-0 flex justify-end">
                        {isFinished && <PredictionBadge pts={pred.points} />}
                      </div>
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
