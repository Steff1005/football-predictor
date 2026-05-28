'use client'
import { useState } from 'react'
import { getRoundLabel } from '../../../lib/round-sort'
import { formatMatchy } from '../../../lib/formatters'

const PAGE_SIZE = 20

export default function PlayerUpcomingPredictions({ items, isOwn }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const visible   = items.slice(0, shown)
  const remaining = items.length - shown

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-600">
        <p className="text-4xl mb-3">📅</p>
        <p>Заплановані матчі відсутні</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {visible.map(item => {
          const m          = item.match
          const kickoff    = new Date(m.kickoff_at)
          const dateStr    = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
          const timeStr    = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })
          const roundLabel = getRoundLabel(m.round)
          const showScore  = isOwn && item.hasPrediction && item.predicted_home !== null

          return (
            <div key={m.id} className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
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

              <div className={`grid ${showScore ? 'grid-cols-2' : 'grid-cols-1'} text-center pt-2 border-t border-gray-100 dark:border-gray-800`}>
                {showScore && (
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Мій прогноз</div>
                    <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      {item.predicted_home}:{item.predicted_away}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Прогноз</div>
                  <span className={`text-sm font-medium ${
                    item.hasPrediction
                      ? 'text-green-500 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {item.hasPrediction ? '✓ Є' : '— Немає'}
                  </span>
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
          Ще {Math.min(PAGE_SIZE, remaining)} з {formatMatchy(remaining)}
        </button>
      )}

      {shown > PAGE_SIZE && remaining === 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          Показано всі {formatMatchy(items.length)}
        </p>
      )}
    </>
  )
}
