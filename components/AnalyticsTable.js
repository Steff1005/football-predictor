'use client'
import { useRouter } from 'next/navigation'
import Avatar from './Avatar'

function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0 }
function fmtNum(n) { return n == null ? '0' : new Intl.NumberFormat('uk-UA').format(n) }
function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}
function pini(p) {
  return pdn(p).split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

export default function AnalyticsTable({ rows, userAnalytics, userId }) {
  const router = useRouter()

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 flex">

      {/* Fixed: # + Учасник */}
      <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2.5 whitespace-nowrap">Учасник</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const isMe = p.id === userId
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/players/${p.id}`)}
                  className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs text-gray-400 dark:text-gray-500 w-4 flex-shrink-0 text-right">{i + 1}</span>
                      <Avatar url={p.avatar_url} initials={pini(p)} sizeCls="w-6 h-6" textCls="text-[10px]" />
                      <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Scrollable: stat columns */}
      <div className="overflow-x-auto scrollbar-hide flex-1 min-w-0">
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              <th title="Відсоток правильно вгаданих результатів" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">
                % рез. <span className="text-green-400">↓</span>
              </th>
              <th title="Кількість правильно вгаданих результатів" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">Рез.</th>
              <th title="Відсоток точно вгаданих рахунків" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">% точн.</th>
              <th title="Кількість точно вгаданих рахунків" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">Точних</th>
              <th title="Кількість зіграних прогнозів" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">Прогн.</th>
              <th title="Загальна сума балів" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px] font-semibold text-green-500 dark:text-green-400">Бали</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const an     = userAnalytics[p.id] ?? { scored: 0, exact: 0, correct: 0 }
              const scored = an.scored
              const corPct = pct(an.correct, scored)
              const exPct  = pct(an.exact, scored)
              const isMe   = p.id === userId
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/players/${p.id}`)}
                  className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
                >
                  <td className="px-2 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400 min-w-[60px] w-[60px]">{corPct}%</td>
                  <td className="px-2 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400 min-w-[60px] w-[60px]">{an.correct}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-yellow-500 dark:text-yellow-400 min-w-[60px] w-[60px]">{exPct}%</td>
                  <td className="px-2 py-3 text-right tabular-nums text-yellow-500 dark:text-yellow-400 min-w-[60px] w-[60px]">{an.exact}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300 min-w-[60px] w-[60px]">{fmtNum(scored)}</td>
                  <td className="px-2 py-3 text-right font-bold text-green-500 dark:text-green-400 tabular-nums min-w-[60px] w-[60px]">{fmtNum(p.total_points)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
