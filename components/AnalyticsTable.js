'use client'
import { useState, useMemo } from 'react'
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

const SORTS = [
  { key: 'res',    label: '% рез.',   title: 'Відсоток правильних результатів' },
  { key: 'exact',  label: '% точн.',  title: 'Відсоток точних рахунків' },
  { key: 'points', label: 'Бали',     title: 'Загальна сума балів' },
  { key: 'preds',  label: 'Прогнози', title: 'Кількість зіграних прогнозів' },
]

export default function AnalyticsTable({ rows, userAnalytics, userId }) {
  const router   = useRouter()
  const [sortBy, setSortBy] = useState('res')

  const sorted = useMemo(() => {
    const copy = rows.map(p => {
      const an = userAnalytics[p.id] ?? { scored: 0, exact: 0, correct: 0 }
      return { ...p, _an: an }
    })
    if (sortBy === 'res')    copy.sort((a, b) => pct(b._an.correct, b._an.scored) - pct(a._an.correct, a._an.scored) || b.total_points - a.total_points)
    if (sortBy === 'exact')  copy.sort((a, b) => pct(b._an.exact, b._an.scored) - pct(a._an.exact, a._an.scored) || b.total_points - a.total_points)
    if (sortBy === 'points') copy.sort((a, b) => b.total_points - a.total_points)
    if (sortBy === 'preds')  copy.sort((a, b) => b._an.scored - a._an.scored)
    return copy
  }, [rows, userAnalytics, sortBy])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">

      {/* Sort controls */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Сортування:</span>
        {SORTS.map(s => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            title={s.title}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${
              sortBy === s.key
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {s.label}{sortBy === s.key && <span className="ml-0.5 text-green-500">↓</span>}
          </button>
        ))}
      </div>

      <div className="flex">
        {/* Fixed: # + Учасник */}
        <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Учасник</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
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
                <th title="Відсоток правильно вгаданих результатів" className={`px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px] ${sortBy === 'res' ? 'text-green-500 dark:text-green-400' : ''}`}>% рез.</th>
                <th title="Кількість правильно вгаданих результатів" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">Рез.</th>
                <th title="Відсоток точно вгаданих рахунків" className={`px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px] ${sortBy === 'exact' ? 'text-green-500 dark:text-green-400' : ''}`}>% точн.</th>
                <th title="Кількість точно вгаданих рахунків" className="px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px]">Точних</th>
                <th title="Кількість зіграних прогнозів" className={`px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px] ${sortBy === 'preds' ? 'text-green-500 dark:text-green-400' : ''}`}>Прогн.</th>
                <th title="Загальна сума балів" className={`px-2 py-2.5 text-right whitespace-nowrap min-w-[60px] w-[60px] font-semibold ${sortBy === 'points' ? 'text-green-500 dark:text-green-400' : 'text-green-500 dark:text-green-400'}`}>Бали</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const an     = p._an
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
    </div>
  )
}
