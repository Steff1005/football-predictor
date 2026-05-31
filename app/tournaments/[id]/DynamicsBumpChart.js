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
  // Left margin sized to fit the longest participant name (≈5.5px per char at font-size 10)
  const maxNameLen = Math.max(...rows.map(row => pdn(row.profile).length))
  const ML      = Math.max(60, Math.round(maxNameLen * 5.5) + 14)
  const MR      = 12
  const MT      = 26
  const MB      = 10

  const COL = chartW > 0
    ? Math.max(MIN_COL, Math.floor((chartW - ML - MR) / r))
    : MIN_COL

  const W = ML + r * COL + MR
  const H = MT + n * ROW + MB

  const xOf = ri   => ML + ri * COL + COL / 2
  const yOf = rank => MT + (rank - 1) * ROW + ROW / 2

  return (
    <div ref={chartRef} className="overflow-x-auto scrollbar-hide">
      <svg width={W} height={H} style={{ minWidth: W, display: 'block' }}>

        {/* Horizontal guide lines */}
        {Array.from({ length: n }, (_, i) => (
          <line key={i}
            x1={ML} y1={yOf(i + 1)} x2={W - MR} y2={yOf(i + 1)}
            stroke="#e5e7eb" strokeWidth={1}
            className="dark:[stroke:#374151]"
          />
        ))}

        {/* Column headers */}
        {rounds.map((rk, ri) => (
          <text key={ri}
            x={xOf(ri)} y={MT - 10}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill="#9ca3af"
          >{roundShort(rk)}</text>
        ))}

        {/* Name labels — positioned at each participant's starting rank */}
        {rows.map((row, ui) => {
          const color     = COLORS[ui % COLORS.length]
          const startRank = row.rounds[0].rank
          const isDim     = hov !== null && hov !== row.uid
          const isHov     = hov === row.uid
          return (
            <text key={ui}
              x={ML - 10} y={yOf(startRank)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={10} fontWeight={isHov ? 600 : 400}
              fill={color}
              opacity={isDim ? 0.2 : 1}
              style={{ transition: 'opacity .15s', cursor: 'pointer', userSelect: 'none' }}
              onMouseEnter={() => setHov(row.uid)}
              onMouseLeave={() => setHov(null)}
            >{pdn(row.profile)}</text>
          )
        })}

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
  )
}
