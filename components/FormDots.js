'use client'
import { useState } from 'react'

function dotCls(pts) {
  if (pts === 4) return 'bg-yellow-400'
  if (pts === 1) return 'bg-green-500'
  return 'bg-red-400'
}

function ptsLabel(pts) {
  if (pts === 4) return { text: 'Точний рахунок', cls: 'text-yellow-400' }
  if (pts === 1) return { text: 'Правильний результат', cls: 'text-green-400' }
  return { text: 'Промах', cls: 'text-red-400' }
}

export default function FormDots({ form }) {
  const [hovered, setHovered] = useState(null)

  if (!form?.length) {
    return <span className="text-xs text-gray-300 dark:text-gray-600 italic">—</span>
  }

  return (
    <div className="flex gap-1">
      {form.map((entry, i) => {
        const label = ptsLabel(entry.pts)
        // Align tooltip: first 3 dots → left-aligned, last 3 → right-aligned, rest → centered
        const alignCls = i < 3 ? 'left-0 -translate-x-0' : i >= form.length - 3 ? 'right-0 translate-x-0' : 'left-1/2 -translate-x-1/2'

        return (
          <div
            key={i}
            className="relative"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className={`w-3 h-3 rounded-full ${dotCls(entry.pts)} inline-block flex-shrink-0 cursor-default transition-transform hover:scale-125`} />

            {hovered === i && (
              <div className={`absolute bottom-full mb-2 z-50 pointer-events-none ${alignCls}`}>
                <div className="bg-gray-900 dark:bg-gray-950 text-white rounded-xl px-3 py-2.5 shadow-2xl border border-white/10 min-w-[160px]">
                  {/* Teams */}
                  <div className="text-xs font-semibold text-white mb-1.5 leading-tight">
                    {entry.home} — {entry.away}
                  </div>
                  {/* Score row */}
                  <div className="flex items-center justify-between gap-4 text-xs mb-1">
                    <span className="text-gray-400">Рахунок</span>
                    <span className="font-mono font-bold text-white">
                      {entry.scoreH != null ? `${entry.scoreH}:${entry.scoreA}` : '—'}
                    </span>
                  </div>
                  {/* Prediction row */}
                  <div className="flex items-center justify-between gap-4 text-xs mb-1.5">
                    <span className="text-gray-400">Прогноз</span>
                    <span className="font-mono font-bold text-gray-200">
                      {entry.predH != null ? `${entry.predH}:${entry.predA}` : '—'}
                    </span>
                  </div>
                  {/* Result */}
                  <div className={`text-xs font-bold border-t border-white/10 pt-1.5 ${label.cls}`}>
                    {entry.pts === 4 ? '🎯' : entry.pts === 1 ? '✅' : '❌'} {label.text} · +{entry.pts} б.
                  </div>
                  {/* Arrow */}
                  <div className={`absolute top-full border-4 border-transparent border-t-gray-900 dark:border-t-gray-950 ${i < 3 ? 'left-3' : i >= form.length - 3 ? 'right-3' : 'left-1/2 -translate-x-1/2'}`} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
