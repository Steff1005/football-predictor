'use client'
import { useState, useEffect } from 'react'
import PredictionBadge from '../../../components/PredictionBadge'
import { groupAndSortMatches } from '../../../lib/round-sort'

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

function PlayerAvatar({ profile }) {
  const name = displayName(profile)
  const initials = name === '—' ? '?' : name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-green-500/20 flex items-center justify-center">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className="text-xs font-bold text-green-600 dark:text-green-400">{initials}</span>
      }
    </div>
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
  // Reverse so most recently finished rounds (and matches within them) appear first
  const groups = groupAndSortMatches(finishedMatches)
    .reverse()
    .map(g => ({ ...g, matches: [...g.matches].reverse() }))
  const rounds = groups.map(g => g.label)

  const [activeRound, setActiveRound] = useState(defaultRound ?? rounds[0] ?? null)
  const [openMatches, setOpenMatches] = useState({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

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
        {mounted ? rounds.map(round => (
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
        )) : rounds.map(round => (
          <div key={round} className="px-3 py-1 rounded-full text-sm font-medium bg-gray-400/20 animate-pulse text-transparent select-none">
            {round}
          </div>
        ))}
      </div>

      {activeMatches.map(match => {
        const preds = (predsByMatch[match.id] ?? [])
          .filter(p => profileMap[p.user_id])
          .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))

        const isOpen    = !!openMatches[match.id]
        const kickoff   = new Date(match.kickoff_at)
        const dateStr   = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
        const isFinished = match.status === 'finished'

        return (
          <div key={match.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-2">

            {/* ── Collapsed header ── */}
            <div
              onClick={() => toggleMatch(match.id)}
              className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 select-none"
            >
              {/* === Mobile layout === */}
              <div className="sm:hidden">
                {/* Row 1: date + status + chevron */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                      Завершено
                    </span>
                    <Chevron open={isOpen} />
                  </div>
                </div>

                {/*
                  Row 2+3: same 4-column flex as player rows below.
                  w-7 spacer | flex-1 teams | w-11 score | w-[52px] label
                  This matches: w-7 avatar | flex-1 name | w-11 pred | w-[52px] badge
                */}
                <div className="flex items-center gap-3">
                  {/* Spacer matching avatar width */}
                  <div className="w-7 flex-shrink-0" />

                  {/* Team names */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {match.home_logo && <img src={match.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                      <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight truncate">{match.home_team}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                      <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight truncate">{match.away_team}</span>
                    </div>
                  </div>

                  {/* Match score — styled chip to stand out from player predictions */}
                  <div className="w-11 flex-shrink-0 flex flex-col items-center bg-gray-100 dark:bg-white/10 rounded-md py-0.5">
                    <span className="font-mono text-sm font-bold text-gray-900 dark:text-white leading-snug">{match.home_score}</span>
                    <span className="font-mono text-sm font-bold text-gray-900 dark:text-white leading-snug">{match.away_score}</span>
                  </div>

                  {/* "Рах." — column header for badge column */}
                  <div className="w-[52px] flex-shrink-0 flex justify-end">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Рах.</span>
                  </div>
                </div>
              </div>

              {/* === Desktop layout (unchanged) === */}
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
                    <div key={pred.user_id} className="border-t border-gray-100 dark:border-white/10">

                      {/* Mobile row: same 4-column flex as header above */}
                      <div className="sm:hidden flex items-center px-4 py-2 gap-3">
                        {/* Avatar (w-7) */}
                        <PlayerAvatar profile={profile} />

                        {/* Name (flex-1) */}
                        <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">
                          {displayName(profile)}
                        </span>

                        {/* Predicted score — vertical digits, w-11, same as score col in header */}
                        <div className="w-11 flex-shrink-0 flex flex-col items-center">
                          <span className="font-mono text-sm font-semibold text-gray-500 dark:text-gray-400 leading-snug">{pred.predicted_home}</span>
                          <span className="font-mono text-sm font-semibold text-gray-500 dark:text-gray-400 leading-snug">{pred.predicted_away}</span>
                        </div>

                        {/* Badge (w-[52px]) */}
                        <div className="w-[52px] flex-shrink-0 flex justify-end">
                          {isFinished && <PredictionBadge pts={pred.points} />}
                        </div>
                      </div>

                      {/* Desktop row (unchanged) */}
                      <div className="hidden sm:flex items-center px-4 py-2 gap-3">
                        <PlayerAvatar profile={profile} />

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
