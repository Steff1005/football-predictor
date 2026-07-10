'use client'
import { useState, useRef, useLayoutEffect } from 'react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

function roundLabel(key) {
  const m = key.match(/(?:GROUP_STAGE_|Regular Season - )0*(\d+)/i)
  if (m) return { long: `Тур ${m[1]}`, short: `Т${m[1]}` }
  const map = {
    LAST_32:        { long: 'R32',        short: 'R32' },
    LAST_16:        { long: 'R16',        short: 'R16' },
    QUARTER_FINALS: { long: '¼ фін.',     short: '¼'   },
    SEMI_FINALS:    { long: '½ фін.',     short: '½'   },
    THIRD_PLACE:    { long: 'За 3 місце', short: '3/4' },
    FINAL:          { long: 'Фінал',      short: 'Фін' },
  }
  return map[key] ?? { long: key, short: key.slice(0, 4) }
}

function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}

export default function DynamicsBumpChart({ rounds, rows }) {
  const [hov, setHov]       = useState(null)
  const [chartW, setChartW] = useState(0)
  const chartRef = useRef(null)

  useLayoutEffect(() => {
    if (!chartRef.current) return
    // Measure immediately so first paint already has the correct width (no jump)
    setChartW(chartRef.current.getBoundingClientRect().width)
    const ro = new ResizeObserver(([e]) => setChartW(e.contentRect.width))
    ro.observe(chartRef.current)
    return () => ro.disconnect()
  }, [])

  if (!rounds?.length || !rows?.length) return null

  const byStart = [...rows].sort((a, b) => a.rounds[0].rank - b.rounds[0].rank)
  const colorOf = Object.fromEntries(byStart.map((row, i) => [row.uid, COLORS[i % COLORS.length]]))

  const n       = rows.length
  const r       = rounds.length
  const ROW     = 52           // matches number table h-[52px] for row-level alignment
  const MIN_COL = 52

  // W fills the scrollable area exactly — same as w-full in the number table.
  // COL is exact (no floor) so dots and HTML headers sit at identical x positions.
  const W   = chartW > 0 ? Math.max(r * MIN_COL, chartW) : r * MIN_COL
  const COL = W / r

  const MB  = 10
  const H   = n * ROW + MB

  // No ML/MR margins — column centers are at (ri + 0.5) * COL, matching the number table
  const xOf = ri   => (ri + 0.5) * COL
  const yOf = rank => (rank - 1) * ROW + ROW / 2

  return (
    <div className="flex">

      {/* Fixed left — identical structure to number table's fixed column */}
      <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
          Учасник
        </div>
        {byStart.map(row => {
          const color = colorOf[row.uid]
          const isDim = hov !== null && hov !== row.uid
          return (
            <div
              key={row.uid}
              className="flex items-center gap-2 px-3 cursor-pointer select-none"
              style={{ height: ROW, opacity: isDim ? 0.35 : 1, transition: 'opacity .15s' }}
              onMouseEnter={() => setHov(row.uid)}
              onMouseLeave={() => setHov(null)}
            >
              {/* Invisible w-4 spacer keeps column width identical to number table's rank# cell */}
              <span className="w-4 flex-shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap text-sm">{pdn(row.profile)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable: HTML header + SVG (both same W → scroll together) */}
      <div ref={chartRef} className="overflow-x-auto scrollbar-hide flex-1 min-w-0">

        {/* Round-label header — same style as thead in the number table */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide"
          style={{ minWidth: W }}>
          {rounds.map(rk => {
            const { long, short } = roundLabel(rk)
            return (
              <div key={rk} className="py-2.5 text-center whitespace-nowrap flex-shrink-0"
                style={{ width: COL }}>
                <span className="hidden sm:inline">{long}</span>
                <span className="sm:hidden">{short}</span>
              </div>
            )
          })}
        </div>

        {/* SVG hidden until chartW is measured — prevents SSR layout jump */}
        <svg width={W} height={H} style={{ minWidth: W, display: 'block', visibility: chartW > 0 ? 'visible' : 'hidden' }}>

          {/* Horizontal guide lines at row centres */}
          {Array.from({ length: n }, (_, i) => (
            <line key={i}
              x1={0} y1={yOf(i + 1)} x2={W} y2={yOf(i + 1)}
              stroke="#e5e7eb" strokeWidth={1}
              className="dark:[stroke:#374151]"
            />
          ))}

          {/* Lines */}
          {rows.map(row => {
            const color  = colorOf[row.uid]
            const isDim  = hov !== null && hov !== row.uid
            const isHov  = hov === row.uid
            const points = row.rounds.map((c, ri) => `${xOf(ri)},${yOf(c.rank)}`).join(' ')
            return (
              <polyline key={row.uid}
                points={points}
                fill="none" stroke={color}
                strokeWidth={isHov ? 3.5 : 2}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={isDim ? 0.12 : 1}
                style={{ transition: 'opacity .15s, stroke-width .1s' }}
              />
            )
          })}

          {/* Dots with rank number + invisible wide hit area */}
          {rows.map(row => {
            const color = colorOf[row.uid]
            const isDim = hov !== null && hov !== row.uid
            const isHov = hov === row.uid
            const dotR  = isHov ? 14 : 12
            return (
              <g key={row.uid}
                opacity={isDim ? 0.12 : 1}
                style={{ transition: 'opacity .15s', cursor: 'pointer' }}
                onMouseEnter={() => setHov(row.uid)}
                onMouseLeave={() => setHov(null)}
                onTouchStart={() => setHov(v => v === row.uid ? null : row.uid)}
              >
                {row.rounds.map((cell, ri) => {
                  const cx = xOf(ri)
                  const cy = yOf(cell.rank)
                  return (
                    <g key={ri}>
                      <circle
                        cx={cx} cy={cy} r={dotR}
                        fill={color} stroke="white" strokeWidth={isHov ? 2 : 1.5}
                        style={{ transition: 'r .1s' }}
                      >
                        <title>{pdn(row.profile)} — {roundLabel(rounds[ri]).short}: #{cell.rank}, {cell.cumPoints} б</title>
                      </circle>
                      <text
                        x={cx} y={cy}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={10} fontWeight={700} fill="white"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >{cell.rank}</text>
                    </g>
                  )
                })}
                {/* Wide invisible hit area for easier hover between dots */}
                <polyline
                  points={row.rounds.map((c, ri) => `${xOf(ri)},${yOf(c.rank)}`).join(' ')}
                  fill="none" stroke="transparent" strokeWidth={24}
                  strokeLinejoin="round"
                />
              </g>
            )
          })}

        </svg>
      </div>

    </div>
  )
}
