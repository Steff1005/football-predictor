'use client'
import { useState } from 'react'
import PredictionBadge from '../../components/PredictionBadge'
import { getRoundLabel } from '../../lib/round-sort'
import { formatPrognazy } from '../../lib/formatters'

const PAGE_SIZE = 20

export default function ProfilePredictions({ predictions }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const visible = predictions.slice(0, shown)
  const remaining = predictions.length - shown

  if (predictions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-600">
        <p className="text-4xl mb-3">📋</p>
        <p>Прогнозів ще немає</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {visible.map(p => {
          const m          = p.match
          const kickoff    = new Date(m.kickoff_at)
          const dateStr    = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
          const timeStr    = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })
          const roundLabel = getRoundLabel(m.round)
          const isFinished = m.status === 'finished'

          return (
            <div key={p.id} className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500 mb-2">
                <span>{dateStr}, {timeStr}</span>
                {roundLabel && <span>{roundLabel}</span>}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate text-right">{m.home_team}</span>
                  {m.home_logo && <img src={m.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">vs</span>
                <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
                  {m.away_logo && <img src={m.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.away_team}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 text-center pt-2 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Прогноз</div>
                  <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                    {p.predicted_home}:{p.predicted_away}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Рахунок</div>
                  <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                    {isFinished ? `${m.home_score}:${m.away_score}` : '—'}
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Статус</div>
                  <PredictionBadge pts={p.points} pending={!isFinished} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setShown(s => s + PAGE_SIZE)}
          className="w-full mt-4 py-3 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Ще {Math.min(PAGE_SIZE, remaining)} з {formatPrognazy(remaining)}
        </button>
      )}

      {shown > PAGE_SIZE && remaining === 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          Показано всі {formatPrognazy(predictions.length)}
        </p>
      )}
    </>
  )
}
