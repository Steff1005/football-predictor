import Link from 'next/link'
import { Avatar, displayName } from './TournamentHelpers'
import { pluralMatches } from './TournamentHelpers'

function probCellCls(pct) {
  if (pct === 0) return 'text-gray-300 dark:text-gray-700'
  if (pct < 10)  return 'text-gray-500 dark:text-gray-400'
  if (pct < 25)  return 'bg-green-500/15 text-green-700 dark:text-green-400'
  if (pct < 50)  return 'bg-green-500/30 text-green-700 dark:text-green-300 font-semibold'
  if (pct < 75)  return 'bg-green-500/55 text-white font-bold'
  return                 'bg-green-500 text-white font-bold'
}

function placeLabel(p) {
  return p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}`
}

export default function ProbabilitySection({ probMatrix, remainingCount }) {
  if (!probMatrix?.length) return null

  const n = probMatrix.length
  const activePlaces = Array.from({ length: n }, (_, i) => i + 1)
    .filter(place => probMatrix.some(row => (row.probs[place] ?? 0) > 0))

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Прогноз підсумкових місць</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {remainingCount === 1 ? 'Залишився 1 матч' : `Залишилось ${remainingCount} ${pluralMatches(remainingCount)}`}
          {' · '}на основі поточних балів та макс. можливого приросту
        </p>
      </div>

      {/* Mobile: card per participant */}
      <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
        {probMatrix.map(row => (
          <div key={row.uid} className="px-4 py-3">
            <Link href={`/players/${row.uid}`} className="flex items-center gap-2.5 mb-2 hover:opacity-75 transition-opacity">
              <Avatar profile={row.profile} />
              <span className="font-medium text-gray-900 dark:text-white text-sm flex-1 min-w-0 truncate">
                {displayName(row.profile)}
              </span>
            </Link>
            <div className="flex flex-wrap gap-1.5">
              {activePlaces.map(place => {
                const pct = row.probs[place] ?? 0
                if (pct === 0) return null
                return (
                  <span key={place} className={`px-2.5 py-1 rounded-lg text-xs tabular-nums ${probCellCls(pct)}`}>
                    {placeLabel(place)}: {pct}%
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto scrollbar-hide">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide sticky left-0 bg-white dark:bg-gray-900 min-w-[160px]">
                Учасник
              </th>
              {activePlaces.map(place => (
                <th key={place} className="text-center px-2 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[64px]">
                  {placeLabel(place)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probMatrix.map(row => (
              <tr key={row.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900 z-10">
                  <Link href={`/players/${row.uid}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                    <Avatar profile={row.profile} />
                    <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {displayName(row.profile)}
                    </span>
                  </Link>
                </td>
                {activePlaces.map(place => {
                  const pct = row.probs[place] ?? 0
                  return (
                    <td key={place} className={`text-center px-2 py-2.5 tabular-nums min-w-[64px] ${probCellCls(pct)}`}>
                      {pct > 0 ? `${pct}%` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
