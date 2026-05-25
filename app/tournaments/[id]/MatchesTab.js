'use client'
import { useState } from 'react'
import MatchCard from '../../../components/MatchCard'
import { groupAndSortMatches } from '../../../lib/round-sort'

export default function MatchesTab({ matches, userPredictions, userId, defaultRound }) {
  const groups = groupAndSortMatches(matches)
  const rounds = groups.map(g => g.label)

  const [activeRound, setActiveRound] = useState(defaultRound ?? rounds[0] ?? null)

  if (!rounds.length) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-600">
        <p className="text-5xl mb-4">✅</p>
        <p>Усі матчі цього турніру завершені</p>
      </div>
    )
  }

  const activeGroup = groups.find(g => g.label === activeRound) ?? groups[0]
  const now = new Date()

  return (
    <div>
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

      <div className="space-y-3">
        {activeGroup?.matches.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            userPrediction={userPredictions[match.id]}
            userId={userId}
            highlight={
              !!userId &&
              match.status !== 'finished' &&
              new Date(match.kickoff_at) > now &&
              !userPredictions[match.id]
            }
          />
        ))}
      </div>
    </div>
  )
}
