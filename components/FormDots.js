'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

function dotCls(pts) {
  if (pts === 4) return 'bg-yellow-400'
  if (pts === 1) return 'bg-green-500'
  return 'bg-red-400'
}

function Tooltip({ entry, anchorRect }) {
  const ref = useRef(null)
  const [style, setStyle] = useState({ opacity: 0 })

  useEffect(() => {
    if (!anchorRect || !ref.current) return
    const tw = ref.current.offsetWidth
    const th = ref.current.offsetHeight
    const vw = window.innerWidth
    const GAP = 6

    // Prefer above; fall back to below if not enough room
    const spaceAbove = anchorRect.top - GAP
    const showBelow  = spaceAbove < th + 12

    let top = showBelow
      ? anchorRect.bottom + GAP
      : anchorRect.top - GAP - th

    // Center on anchor, clamped to viewport
    let left = anchorRect.left + anchorRect.width / 2 - tw / 2
    left = Math.max(8, Math.min(vw - tw - 8, left))

    setStyle({ top, left, opacity: 1 })
  }, [anchorRect])

  const label = entry.pts === 4
    ? { text: 'Точний', cls: 'text-yellow-400', emoji: '🎯' }
    : entry.pts === 1
      ? { text: 'Результат', cls: 'text-green-400', emoji: '✅' }
      : { text: 'Промах', cls: 'text-red-400', emoji: '❌' }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', zIndex: 9999, pointerEvents: 'none', ...style }}
      className="transition-opacity duration-100"
    >
      <div className="bg-gray-900 dark:bg-gray-950 text-white rounded-xl shadow-2xl border border-white/10 px-3 py-2.5 w-44">
        <div className="text-xs font-semibold text-white mb-1.5 leading-snug">
          {entry.home} — {entry.away}
        </div>
        <div className="flex items-center justify-between text-xs mb-0.5">
          <span className="text-gray-400">⚽ Рахунок</span>
          <span className="font-mono font-bold text-white">
            {entry.scoreH != null ? `${entry.scoreH}:${entry.scoreA}` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400">🔮 Прогноз</span>
          <span className="font-mono font-bold text-gray-200">
            {entry.predH != null ? `${entry.predH}:${entry.predA}` : '—'}
          </span>
        </div>
        <div className={`text-xs font-bold border-t border-white/10 pt-1.5 ${label.cls}`}>
          {label.emoji} {label.text} · +{entry.pts} б.
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function FormDots({ form }) {
  const [hovered, setHovered] = useState(null) // { idx, rect }
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

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
          {mounted && hovered?.idx === i && (
            <Tooltip entry={entry} anchorRect={hovered.rect} />
          )}
        </div>
      ))}
    </div>
  )
}
