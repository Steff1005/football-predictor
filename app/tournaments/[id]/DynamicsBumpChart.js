'use client'
import { useState, useRef, useLayoutEffect } from 'react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

function roundShort(key) {
  const m = key.match(/GROUP_STAGE_(\d+)/)
  if (m) return `Т${m[1]}`
  return { LAST_32: 'R32', LAST_16: 'R16', QUARTER_FINALS: '¼', SEMI_FINALS: '½', THIRD_PLACE: '3/4', FINAL: 'Фін' }[key] ?? key.slice(0, 4)
}

function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}

export default function DynamicsBumpChart({ rounds, rows }) {
  const [hov, setHov] = useState(null)
  const [chartW, setChartW] = useState(0)
  const chartRef = useRef(null)

  useLayoutEffect(() => {
    if (!chartRef.current) return
    const ro = new ResizeObserver(([e]) => setChartW(e.contentRect.width))
    ro.observe(chartRef.current)
    return () => ro.disconnect()
  }, [])

  if (!rounds?.length || !rows?.length) return null

  const n       = rows.length
  const r       = rounds.length
  const ROW     = 44
  const MIN_COL = 52
  const ML      = 4
  const MR      = 12
  // MT matches the <th> height of the number table above (py-2.5 + text-xs ≈ 37px)
  const MT      = 37
  const MB      = 10

  const COL = chartW > 0
    ? Math.max(MIN_COL, Math.floor((chartW - ML - MR) / r))
    : MIN_COL

  const W = ML + r * COL + MR
  const H = MT + n * ROW + MB

  const xOf = ri   => ML + ri * COL + COL / 2
  const yOf = rank => MT + (rank - 1) * ROW + ROW / 2

  return (
    <div className="flex">

      {/* Fixed left — same structure as the number table above for column alignment */}
      <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-800">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">Учасник</span>
        </div>
        {rows.map((row, ui) => {
          const color = COLORS[ui % COLORS.length]
          const isDim = hov !== null && hov !== row.uid
          return (
            <div
              key={row.uid}
              className={`flex items-center gap-2 px-3 border-b border-gray-100 dark:border-gray-800/50 last:border-0 cursor-pointer select-none ${ui % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/30'}`}
              style={{ height: ROW, opacity: isDim ? 0.35 : 1, transition: 'opacity .15s' }}
              onMouseEnter={() => setHov(row.uid)}
              onMouseLeave={() => setHov(null)}
            >
              <span className="tabular-nums text-xs text-gray-400 dark:text-gray-500 w-4 flex-shrink-0 text-right">{ui + 1}</span>
              {/* Same size as avatar in the number table (w-6 h-6) */}
              <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap text-sm">{pdn(row.profile)}</span>
            </div>
          )
        })}
      </div>

      {/* Scrollable SVG chart */}
      <div ref={chartRef} className="overflow-x-auto scrollbar-hide flex-1 min-w-0">
        <svg width={W} height={H} style={{ minWidth: W, display: 'block' }}>

          {/* Horizontal guide lines */}
          {Array.from({ length: n }, (_, i) => (
            <line key={i}
              x1={ML} y1={yOf(i + 1)} x2={W - MR} y2={yOf(i + 1)}
              stroke="#e5e7eb" strokeWidth={1}
              className="dark:[stroke:#374151]"
            />
          ))}

          {/* Column headers — vertically centred in MT */}
          {rounds.map((rk, ri) => (
            <text key={ri}
              x={xOf(ri)} y={MT / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={10} fill="#9ca3af"
            >{roundShort(rk)}</text>
          ))}

          {/* Lines */}
          {rows.map((row, ui) => {
            const color  = COLORS[ui % COLORS.length]
            const isDim  = hov !== null && hov !== row.uid
            const isHov  = hov === row.uid
            const points = row.rounds.map((c, ri) => `${xOf(ri)},${yOf(c.rank)}`).join(' ')
            return (
              <polyline key={ui}
                points={points}
                fill="none" stroke={color}
                strokeWidth={isHov ? 3.5 : 2}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={isDim ? 0.12 : 1}
                style={{ transition: 'opacity .15s, stroke-width .1s' }}
              />
            )
          })}

          {/* Dots + invisible wide hit area */}
          {rows.map((row, ui) => {
            const color = COLORS[ui % COLORS.length]
            const isDim = hov !== null && hov !== row.uid
            const isHov = hov === row.uid
            return (
              <g key={ui}
                opacity={isDim ? 0.12 : 1}
                style={{ transition: 'opacity .15s', cursor: 'pointer' }}
                onMouseEnter={() => setHov(row.uid)}
                onMouseLeave={() => setHov(null)}
                onTouchStart={() => setHov(v => v === row.uid ? null : row.uid)}
              >
                {row.rounds.map((cell, ri) => (
                  <circle key={ri}
                    cx={xOf(ri)} cy={yOf(cell.rank)}
                    r={isHov ? 6 : 4.5}
                    fill={color} stroke="white" strokeWidth={isHov ? 2 : 1.5}
                    style={{ transition: 'r .1s' }}
                  >
                    <title>{pdn(row.profile)} — {roundShort(rounds[ri])}: #{cell.rank}, {cell.cumPoints} б</title>
                  </circle>
                ))}
                <polyline
                  points={row.rounds.map((c, ri) => `${xOf(ri)},${yOf(c.rank)}`).join(' ')}
                  fill="none" stroke="transparent" strokeWidth={18}
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
