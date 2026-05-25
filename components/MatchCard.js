'use client'
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function MatchCard({ match, userPrediction, userId, highlight }) {
  const [home, setHome] = useState(userPrediction?.predicted_home ?? '')
  const [away, setAway] = useState(userPrediction?.predicted_away ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const awayRef = useRef(null)

  const isFinished = match.status === 'finished'
  const isPast = new Date(match.kickoff_at) < new Date()

  async function savePrediction() {
    if (!userId) { alert('Спочатку увійди в акаунт!'); return }
    if (home === '' || away === '') { alert('Введи рахунок для обох команд'); return }
    setSaving(true)
    const { error } = await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: match.id,
      predicted_home: parseInt(home),
      predicted_away: parseInt(away),
    }, { onConflict: 'user_id,match_id' })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    else alert('Помилка: ' + error.message)
  }

  const kickoff = new Date(match.kickoff_at)
  const dateStr = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
  const timeStr = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })

  const scoreOrInputs = isFinished ? (
    <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg font-bold text-lg text-gray-900 dark:text-white whitespace-nowrap">
      {match.home_score} : {match.away_score}
    </div>
  ) : (
    <div className="flex items-center gap-1">
      <input
        type="number" min="0" max="20"
        value={home}
        onChange={e => { setHome(e.target.value); if (e.target.value.length === 1) awayRef.current?.focus() }}
        disabled={isPast}
        className="no-spin w-10 h-10 sm:w-11 sm:h-11 text-center bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white text-base sm:text-lg disabled:opacity-40"
        placeholder="-"
      />
      <span className="text-gray-400 dark:text-gray-500 font-bold">:</span>
      <input
        ref={awayRef}
        type="number" min="0" max="20"
        value={away}
        onChange={e => setAway(e.target.value)}
        disabled={isPast}
        className="no-spin w-10 h-10 sm:w-11 sm:h-11 text-center bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white text-base sm:text-lg disabled:opacity-40"
        placeholder="-"
      />
    </div>
  )

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-3 sm:p-4 border ${
      highlight
        ? 'border-gray-200 dark:border-gray-700 border-l-[3px] border-l-amber-400/70 dark:border-l-amber-400/50'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Top row: date + status */}
      <div className="flex justify-between items-center mb-3 text-xs text-gray-400 dark:text-gray-500">
        <span>{dateStr}, {timeStr}</span>
        <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
          isFinished ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' :
          match.status === 'live' ? 'bg-red-500/20 text-red-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {isFinished ? 'Завершено' : match.status === 'live' ? '🔴 Live' : 'Скоро'}
        </span>
      </div>

      {/* Teams + score
          Mobile:  home row / score row / away row (vertical, full names)
          Desktop: home | score | away (horizontal, truncate if needed) */}
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-3">

        {/* Home team */}
        <div className="w-full sm:flex-1 flex items-center gap-2 sm:flex-row-reverse sm:min-w-0">
          {match.home_logo && (
            <img src={match.home_logo} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
          )}
          <span className="font-semibold text-gray-900 dark:text-white text-sm leading-tight sm:text-right sm:flex-1 sm:min-w-0 sm:truncate">
            {match.home_team}
          </span>
        </div>

        {/* Score / inputs — centered */}
        <div className="flex items-center justify-center gap-1 flex-shrink-0">
          {scoreOrInputs}
        </div>

        {/* Away team */}
        <div className="w-full sm:flex-1 flex items-center gap-2 sm:min-w-0">
          {match.away_logo && (
            <img src={match.away_logo} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
          )}
          <span className="font-semibold text-gray-900 dark:text-white text-sm leading-tight sm:flex-1 sm:min-w-0 sm:truncate">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Bottom row: saved prediction + button */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {userPrediction && !isFinished && (
            <span>Прогноз: {userPrediction.predicted_home}:{userPrediction.predicted_away}</span>
          )}
        </div>

        {isFinished && userPrediction ? (
          <div className={`px-3 py-1 rounded-full text-xs font-bold ml-auto ${
            userPrediction.points === 4 ? 'bg-yellow-500/20 text-yellow-400' :
            userPrediction.points === 1 ? 'bg-green-500/20 text-green-400' :
            'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {userPrediction.points === 4 ? '🎯 +4' :
             userPrediction.points === 1 ? '✅ +1' : '❌ 0'}
          </div>
        ) : !isFinished && !isPast ? (
          <button
            onClick={savePrediction}
            disabled={saving}
            className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
              saved ? 'bg-green-600 text-white' : 'bg-green-500 hover:bg-green-400 text-white'
            } disabled:opacity-50`}
          >
            {saving ? '...' : saved ? '✅ Збережено' : 'Зберегти'}
          </button>
        ) : isPast && !isFinished ? (
          <span className="text-xs text-gray-400 dark:text-gray-600 ml-auto">Закрито</span>
        ) : null}
      </div>
    </div>
  )
}
