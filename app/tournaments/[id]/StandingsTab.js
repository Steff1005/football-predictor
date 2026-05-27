import Link from 'next/link'
import { Avatar, EmptyState, displayName } from './TournamentHelpers'
import ProbabilitySection from './ProbabilitySection'

export default function StandingsTab({ standings, roundLabels, roundPointsMap, probMatrix, upcomingCount }) {
  if (!standings.length) return <EmptyState icon="📊" text="Поки немає прогнозів" />

  const colMaxes = (roundLabels ?? []).map(label =>
    Math.max(0, ...standings.map(s => roundPointsMap?.[label]?.[s.uid] ?? 0))
  )

  return (
    <div className="space-y-6">
      {/* Mobile — cards */}
      <div className="sm:hidden space-y-2">
        {standings.map((s, i) => (
          <div key={s.uid} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 text-center text-lg">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm text-gray-400 dark:text-gray-500">{i + 1}</span>}
              </span>
              <Link href={`/players/${s.uid}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                <Avatar profile={s.profile} />
                <span className="font-medium text-gray-900 dark:text-white flex-1 min-w-0 truncate">{displayName(s.profile)}</span>
              </Link>
              <span className="font-bold text-green-500 dark:text-green-400 text-xl flex-shrink-0">{s.total}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500 pl-10">
              <span>Прогн: <b className="text-gray-600 dark:text-gray-300">{s.predictions}</b></span>
              <span>Рез: <b className="text-gray-600 dark:text-gray-300">{s.results}</b></span>
              <span className="text-blue-400">×1: <b>{s.results}</b></span>
              <span>Точних: <b className="text-gray-600 dark:text-gray-300">{s.exact}</b></span>
              <span className="text-blue-400">×4: <b>{s.exact * 4}</b></span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop — summary table */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide w-10">Місце</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Гравець</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Прогнози</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Прав. результати</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-blue-400 dark:text-blue-500 uppercase tracking-wide">Бали за результати</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Точні рахунки</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-blue-400 dark:text-blue-500 uppercase tracking-wide">Бали за точні</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Сума балів</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-3 py-3 text-center text-lg">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉'
                      : <span className="text-sm text-gray-400 dark:text-gray-500">{i + 1}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/players/${s.uid}`} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
                      <Avatar profile={s.profile} />
                      <span className="font-medium text-gray-900 dark:text-white">{displayName(s.profile)}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500 dark:text-gray-400">{s.predictions}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{s.results}</td>
                  <td className="px-3 py-3 text-right font-medium text-blue-600 dark:text-blue-400">{s.results}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{s.exact}</td>
                  <td className="px-3 py-3 text-right font-medium text-blue-600 dark:text-blue-400">{s.exact * 4}</td>
                  <td className="px-3 py-3 text-right font-bold text-green-500 dark:text-green-400 text-lg">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round-by-round breakdown */}
      {roundLabels?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Очки по стадіях</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900">Учасник</th>
                  {roundLabels.map(label => (
                    <th key={label} className="text-center px-1 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[60px] w-[60px]">{label}</th>
                  ))}
                  <th className="text-center px-1 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap min-w-[60px] w-[60px]">Загалом</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(s => (
                  <tr key={s.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                    <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900">
                      <Link href={`/players/${s.uid}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                        <Avatar profile={s.profile} />
                        <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{displayName(s.profile)}</span>
                      </Link>
                    </td>
                    {roundLabels.map((label, ci) => {
                      const pts   = roundPointsMap?.[label]?.[s.uid] ?? 0
                      const isMax = colMaxes[ci] > 0 && pts === colMaxes[ci]
                      return (
                        <td key={label} className={`text-center px-1 py-2.5 tabular-nums min-w-[60px] w-[60px] ${
                          isMax
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 font-bold'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {pts > 0 ? pts : '—'}
                        </td>
                      )
                    })}
                    <td className="text-center px-1 py-2.5 font-bold text-green-500 dark:text-green-400 tabular-nums min-w-[60px] w-[60px]">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {probMatrix && <ProbabilitySection probMatrix={probMatrix} remainingCount={upcomingCount} />}
    </div>
  )
}
