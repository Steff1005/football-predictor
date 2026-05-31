function roundLabel(key) {
  const m = key.match(/GROUP_STAGE_(\d+)/)
  if (m) return { long: `Тур ${m[1]}`, short: `Т${m[1]}` }
  const map = {
    LAST_32:        { long: 'R32',       short: 'R32' },
    LAST_16:        { long: 'R16',       short: 'R16' },
    QUARTER_FINALS: { long: '¼ фін.',    short: '¼'   },
    SEMI_FINALS:    { long: '½ фін.',    short: '½'   },
    THIRD_PLACE:    { long: 'За 3 місце',short: '3/4' },
    FINAL:          { long: 'Фінал',     short: 'Фін' },
  }
  return map[key] ?? { long: key, short: key.slice(0, 4) }
}

function cellCls(rank) {
  if (rank === 1) return 'bg-yellow-400/20 ring-1 ring-yellow-400/50 text-yellow-700 dark:text-yellow-400 font-bold'
  if (rank === 2) return 'bg-gray-200/70 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-semibold'
  if (rank === 3) return 'bg-orange-400/10 ring-1 ring-orange-400/30 text-orange-700 dark:text-orange-400 font-semibold'
  return 'text-gray-400 dark:text-gray-500'
}

function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}

function pini(p) {
  return pdn(p).split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

export default function DynamicsTab({ rounds, rows }) {
  if (!rounds?.length || !rows?.length) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-600 text-sm">
        Недостатньо даних — потрібно мінімум 2 завершених тури
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Позиції учасників після кожного туру (бали — накопичувальні)
      </p>

      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 flex">

        {/* Fixed: participant column */}
        <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left whitespace-nowrap">Учасник</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const p = row.profile
                return (
                  <tr key={row.uid}
                    className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 h-[52px] ${i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                    <td className="px-3 py-0">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-xs text-gray-400 dark:text-gray-500 w-4 flex-shrink-0 text-right">{i + 1}</span>
                        <a href={`/players/${row.uid}`} className="flex items-center gap-1.5 hover:opacity-75 transition-opacity">
                          {p?.avatar_url
                            ? <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            : <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-green-600 dark:text-green-400">{pini(p)}</div>
                          }
                          <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{pdn(p)}</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Scrollable: round columns */}
        <div className="overflow-x-auto scrollbar-hide flex-1 min-w-0">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                {rounds.map(rk => {
                  const { long, short } = roundLabel(rk)
                  return (
                    <th key={rk} title={long} className="px-1 py-2.5 text-center whitespace-nowrap min-w-[52px]">
                      <span className="hidden sm:inline">{long}</span>
                      <span className="sm:hidden">{short}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.uid}
                  className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 h-[52px] ${i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                  {row.rounds.map((cell, ri) => (
                    <td key={ri} className="px-1 py-0 text-center min-w-[52px]">
                      <div className={`inline-flex items-center justify-center gap-0.5 rounded-md px-2 py-0.5 tabular-nums text-sm leading-5 ${cellCls(cell.rank)}`}>
                        <span>{cell.rank}</span>
                        {cell.delta !== null && cell.delta !== 0 && (
                          <span className={`text-[9px] font-bold leading-none mt-px ${cell.delta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                            {cell.delta > 0 ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-300 dark:text-gray-600 tabular-nums mt-0.5">
                        {cell.cumPoints}б
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
