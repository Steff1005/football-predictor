'use client'
import { useState } from 'react'

function dotCls(pts) {
  if (pts === 4) return 'bg-yellow-400'
  if (pts === 1) return 'bg-green-500'
  return 'bg-red-400'
}

function ptsLabel(pts) {
  if (pts === 4) return { text: 'Точний', cls: 'text-yellow-400' }
  if (pts === 1) return { text: 'Результат', cls: 'text-green-400' }
  return { text: 'Промах', cls: 'text-red-400' }
}

function ptsEmoji(pts) {
  if (pts === 4) return '🎯'
  if (pts === 1) return '✅'
  return '❌'
}

// Tooltip rendered with fixed positioning to escape any overflow:hidden parent
function Tooltip({ entry, rect }) {
  if (!rect) return null

  const TOOLTIP_W = 168
  const GAP = 8

  // Decide above vs below based on space
  const showBelow = rect.top < 120 // not enough room above (header ~60px + tooltip ~80px)

  const top    = showBelow ? rect.bottom + GAP : rect.top - GAP
  const rawLeft = rect.left + rect.width / 2
  // Clamp so tooltip doesn't leave the viewport
  const left   = Math.max(TOOLTIP_W / 2 + 8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - TOOLTIP_W / 2 - 8, rawLeft))
  const arrowLeft = rawLeft - (left - TOOLTIP_W / 2) // arrow position relative to tooltip box

  const label = ptsLabel(entry.pts)

  return (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        transform: showBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        zIndex: 9999,
        width: TOOLTIP_W,
        pointerEvents: 'none',
      }}
    >
      <div className="bg-gray-900 dark:bg-gray-950 text-white rounded-xl shadow-2xl border border-white/10 px-3 py-2.5">
        {/* Teams */}
        <div className="text-xs font-semibold text-white mb-1.5 leading-snug">
          {entry.home} — {entry.away}
        </div>
        {/* Score */}
        <div className="flex items-center justify-between text-xs mb-0.5">
          <span className="text-gray-400">⚽ Рахунок</span>
          <span className="font-mono font-bold text-white">
            {entry.scoreH != null ? `${entry.scoreH}:${entry.scoreA}` : '—'}
          </span>
        </div>
        {/* Prediction */}
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400">🔮 Прогноз</span>
          <span className="font-mono font-bold text-gray-200">
            {entry.predH != null ? `${entry.predH}:${entry.predA}` : '—'}
          </span>
        </div>
        {/* Result */}
        <div className={`text-xs font-bold border-t border-white/10 pt-1.5 ${label.cls}`}>
          {ptsEmoji(entry.pts)} {label.text} · +{entry.pts} б.
        </div>
      </div>
      {/* Arrow */}
      {showBelow
        ? <div style={{ left: arrowLeft, transform: 'translateX(-50%)' }} className="absolute bottom-full border-4 border-transparent border-b-gray-900 dark:border-b-gray-950" />
        : <div style={{ left: arrowLeft, transform: 'translateX(-50%)' }} className="absolute top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-950" />
      }
    </div>
  )
}

export default function FormDots({ form }) {
  const [hovered, setHovered] = useState(null) // { idx, rect }

  if (!form?.length) {
    return <span className="text-xs text-gray-300 dark:text-gray-600 italic">—</span>
  }

  return (
    <div className="flex gap-1">
      {form.map((entry, i) => (
        <div
          key={i}
          className="relative"
          onMouseEnter={e => setHovered({ idx: i, rect: e.currentTarget.getBoundingClientRect() })}
          onMouseLeave={() => setHovered(null)}
        >
          <span className={`w-3 h-3 rounded-full ${dotCls(entry.pts)} inline-block flex-shrink-0 cursor-default transition-transform hover:scale-125`} />
          {hovered?.idx === i && <Tooltip entry={entry} rect={hovered.rect} />}
        </div>
      ))}
    </div>
  )
}
