'use client'
import { useState, useMemo } from 'react'
import Avatar from './Avatar'

function fmtNum(n) {
  return n == null ? '0' : new Intl.NumberFormat('uk-UA').format(n)
}
function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}
function pini(p) {
  return pdn(p).split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}
function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0 }

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-xl leading-none">🥇</span>
  if (rank === 2) return <span className="text-xl leading-none">🥈</span>
  if (rank === 3) return <span className="text-xl leading-none">🥉</span>
  return <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{rank}</span>
}

function FormDot({ pts }) {
  if (pts === 4)  return <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block flex-shrink-0" title="4 бали" />
  if (pts === 1)  return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block flex-shrink-0" title="1 бал" />
  return            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block flex-shrink-0" title="0 балів" />
}

const SORTS = [
  { key: 'ppp',    label: 'PPP' },
  { key: 'points', label: 'Бали' },
  { key: 'preds',  label: 'Прогнози' },
  { key: 'exact',  label: 'Точних %' },
]

export default function LeaderboardTable({ rows, formData, trend, analytics, userId }) {
  const [sortBy, setSortBy] = useState('ppp')

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (sortBy === 'ppp')    copy.sort((a, b) => b.efficiency - a.efficiency)
    if (sortBy === 'points') copy.sort((a, b) => b.total_points - a.total_points)
    if (sortBy === 'preds')  copy.sort((a, b) => b.total_predictions - a.total_predictions)
    if (sortBy === 'exact') {
      copy.sort((a, b) => {
        const anA = analytics[a.id] ?? { scored: 0, exact: 0 }
        const anB = analytics[b.id] ?? { scored: 0, exact: 0 }
        const pctA = pct(anA.exact, anA.scored)
        const pctB = pct(anB.exact, anB.scored)
        if (pctB !== pctA) return pctB - pctA
        return b.total_points - a.total_points
      })
    }
    return copy
  }, [rows, sortBy, analytics])

  const maxEfficiency = rows[0]?.efficiency ?? 1

  if (rows.length === 0) {
    return <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">Ще немає учасників</div>
  }

  return (
    <>
      {/* Sort controls */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">Сортування:</span>
        {SORTS.map(s => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${
              sortBy === s.key
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <table className="w-full text-sm hidden sm:table">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
            <th className="w-10 px-3 py-2.5 text-center">#</th>
            <th className="px-3 py-2.5 text-left">Учасник</th>
            <th className="px-3 py-2.5 text-left whitespace-nowrap">Форма</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap">
              {sortBy === 'points' ? 'Бали' : sortBy === 'preds' ? 'Прогнози' : sortBy === 'exact' ? 'Точних %' : 'PPP'}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, idx) => {
            const isMe     = p.id === userId
            const form     = formData[p.id] ?? []
            const trendVal = trend[p.id]
            const trendDir = trendVal !== undefined
              ? (trendVal > p.efficiency + 0.05 ? 1 : trendVal < p.efficiency - 0.05 ? -1 : 0)
              : null
            const barWidth = Math.round(p.efficiency / maxEfficiency * 100)
            const an       = analytics[p.id] ?? { scored: 0, exact: 0 }

            return (
              <tr key={p.id}
                className={`border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 animate-fade-in ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
                style={{ animationDelay: `${idx * 30}ms` }}>
                <td className="px-3 py-3 text-center"><RankBadge rank={idx + 1} /></td>
                <td className="px-3 py-3">
                  <a href={`/players/${p.id}`} className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
                    <Avatar url={p.avatar_url} initials={pini(p)} sizeCls="w-8 h-8" textCls="text-xs" />
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                    </span>
                  </a>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    {form.length > 0
                      ? form.map((e, i) => <FormDot key={i} pts={e.pts} />)
                      : <span className="text-xs text-gray-300 dark:text-gray-600 italic">—</span>
                    }
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {sortBy === 'points' && (
                    <span className="font-bold text-green-500 dark:text-green-400 tabular-nums float-right">{fmtNum(p.total_points)}</span>
                  )}
                  {sortBy === 'preds' && (
                    <span className="font-bold text-gray-700 dark:text-gray-200 tabular-nums float-right">{fmtNum(p.total_predictions)}</span>
                  )}
                  {sortBy === 'exact' && (
                    <span className="font-bold text-yellow-500 dark:text-yellow-400 tabular-nums float-right">{pct(an.exact, an.scored)}%</span>
                  )}
                  {sortBy === 'ppp' && (
                    <div>
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        {trendDir !== null && (
                          <span className={`text-xs font-semibold ${trendDir > 0 ? 'text-green-500' : trendDir < 0 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {trendDir > 0 ? '↑' : trendDir < 0 ? '↓' : '—'}
                          </span>
                        )}
                        <span className="font-bold text-green-500 dark:text-green-400 tabular-nums">{p.efficiency.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right whitespace-nowrap mb-1.5">
                        {fmtNum(p.total_points)} б. · {fmtNum(p.total_predictions)} прогн.
                      </div>
                      <div className="h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="sm:hidden">
        {sorted.map((p, idx) => {
          const isMe     = p.id === userId
          const form     = formData[p.id] ?? []
          const trendVal = trend[p.id]
          const trendDir = trendVal !== undefined
            ? (trendVal > p.efficiency + 0.05 ? 1 : trendVal < p.efficiency - 0.05 ? -1 : 0)
            : null
          const barWidth = Math.round(p.efficiency / maxEfficiency * 100)
          const an       = analytics[p.id] ?? { scored: 0, exact: 0 }

          return (
            <div key={p.id}
              className={`px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 animate-fade-in ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
              style={{ animationDelay: `${idx * 30}ms` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 flex-shrink-0 text-center"><RankBadge rank={idx + 1} /></div>
                <a href={`/players/${p.id}`}
                  className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <Avatar url={p.avatar_url} initials={pini(p)} sizeCls="w-8 h-8" textCls="text-xs" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                  </span>
                </a>
                <div className="flex-shrink-0 text-right ml-1">
                  {sortBy === 'points' && (
                    <span className="font-bold text-green-500 dark:text-green-400 text-sm tabular-nums">{fmtNum(p.total_points)} б.</span>
                  )}
                  {sortBy === 'preds' && (
                    <span className="font-bold text-gray-700 dark:text-gray-200 text-sm tabular-nums">{fmtNum(p.total_predictions)}</span>
                  )}
                  {sortBy === 'exact' && (
                    <span className="font-bold text-yellow-500 dark:text-yellow-400 text-sm tabular-nums">{pct(an.exact, an.scored)}%</span>
                  )}
                  {sortBy === 'ppp' && (
                    <div>
                      <div className="flex items-center justify-end gap-1">
                        {trendDir !== null && (
                          <span className={`text-xs font-semibold ${trendDir > 0 ? 'text-green-500' : trendDir < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {trendDir > 0 ? '↑' : trendDir < 0 ? '↓' : '—'}
                          </span>
                        )}
                        <span className="font-bold text-green-500 dark:text-green-400 text-sm tabular-nums">{p.efficiency.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtNum(p.total_points)} б. · {fmtNum(p.total_predictions)} прогн.</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="pl-9 mt-1.5">
                {form.length > 0 && (
                  <div className="flex gap-1 mb-1.5">
                    {form.map((e, i) => <FormDot key={i} pts={e.pts} />)}
                  </div>
                )}
                <div className="h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
