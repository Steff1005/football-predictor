import Link from 'next/link'
import { Avatar, EmptyState, displayName, pluralMatches } from './TournamentHelpers'
import RoundAnalysisSection from './RoundAnalysisSection'

export default function RoundsTab({ roundTables, tournamentId, analysisMap, isAdmin }) {
  if (!roundTables.length) return <EmptyState icon="📅" text="Поки немає даних по турах" />

  return (
    <div className="space-y-5">
      {roundTables.map(({ label, rows, maxPts, matchCount, matchIds }) => (
        <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">{label}</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{matchCount} {pluralMatches(matchCount)}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r, i) => {
              const isTop = maxPts > 0 && r.pts === maxPts
              return (
                <div key={r.uid} className={`flex items-center justify-between px-5 py-3 ${isTop ? 'bg-yellow-50 dark:bg-yellow-500/[0.07]' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 text-xs text-center text-gray-400 dark:text-gray-500 flex-shrink-0">{i + 1}</span>
                    <Link href={`/players/${r.uid}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                      <Avatar profile={r.profile} />
                      <span className={`text-sm font-medium ${isTop ? 'text-yellow-700 dark:text-yellow-300' : 'text-gray-900 dark:text-white'}`}>
                        {displayName(r.profile)}
                      </span>
                    </Link>
                    {isTop && <span className="text-sm leading-none">🥇</span>}
                  </div>
                  <span className={`font-bold tabular-nums ${isTop ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    +{r.pts}
                  </span>
                </div>
              )
            })}
          </div>
          <RoundAnalysisSection
            tournamentId={tournamentId}
            roundLabel={label}
            matchIds={matchIds}
            initialText={analysisMap[label] ?? null}
            isAdmin={isAdmin}
          />
        </div>
      ))}
    </div>
  )
}
