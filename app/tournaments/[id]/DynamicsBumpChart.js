'use client'
import { useState } from 'react'

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

  if (!rounds?.length || !rows?.length) return null

  const n    = rows.length
  const r    = rounds.length
  const ROW  = 44
  const COL  = 68
  const ML   = 22   // left margin (rank numbers)
  const MR   = 12
  const MT   = 26   // top margin (column headers)
  const MB   = 10

  const W = ML + r * COL + MR
  const H = MT + n * ROW + MB

  const xOf = ri   => ML + ri * COL + COL / 2
  const yOf = rank => MT + (rank - 1) * ROW + ROW / 2

  return (
    <div>
      {/* Chart */}
      <div className="overflow-x-auto scrollbar-hide">
        <svg width={W} height={H} style={{ minWidth: W, display: 'block' }}>

          {/* Horizontal guide lines per rank */}
          {Array.from({ length: n }, (_, i) => (
            <line key={i}
              x1={ML} y1={yOf(i + 1)} x2={W - MR} y2={yOf(i + 1)}
              stroke="#e5e7eb" strokeWidth={1}
              className="dark:[stroke:#374151]"
            />
          ))}

          {/* Rank axis labels */}
          {Array.from({ length: n }, (_, i) => (
            <text key={i}
              x={ML - 5} y={yOf(i + 1)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={10} fill="#d1d5db"
            >{i + 1}</text>
          ))}

          {/* Column headers */}
          {rounds.map((rk, ri) => (
            <text key={ri}
              x={xOf(ri)} y={MT - 10}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={10} fill="#9ca3af"
            >{roundShort(rk)}</text>
          ))}

          {/* Lines — drawn first (below dots) */}
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

          {/* Dots + hit areas */}
          {rows.map((row, ui) => {
            const color  = COLORS[ui % COLORS.length]
            const isDim  = hov !== null && hov !== row.uid
            const isHov  = hov === row.uid
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
                {/* Wide invisible stroke for easier hover */}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {rows.map((row, ui) => (
          <button key={row.uid}
            className="flex items-center gap-1.5 text-xs"
            style={{
              opacity: hov !== null && hov !== row.uid ? 0.3 : 1,
              transition: 'opacity .15s',
            }}
            onMouseEnter={() => setHov(row.uid)}
            onMouseLeave={() => setHov(null)}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[ui % COLORS.length] }} />
            <span className="text-gray-600 dark:text-gray-300 font-medium">{pdn(row.profile)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
