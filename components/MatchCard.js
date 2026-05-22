'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MatchCard({ match, userPrediction, userId }) {
  const [home, setHome] = useState(userPrediction?.predicted_home ?? '')
  const [away, setAway] = useState(userPrediction?.predicted_away ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
  const dateStr = kickoff.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
  const timeStr = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`bg-gray-900 rounded-xl p-4 border ${
      isFinished ? 'border-gray-700' : 'border-gray-800'
    }`}>
      {/* Верхній рядок: тур + дата + статус */}
      <div className="flex justify-between items-center mb-3 text-xs text-gray-500">
        <span className="truncate max-w-[120px]">{match.round?.replace('GROUP_', 'Гр. ') || ''}</span>
        <span>{dateStr} {timeStr}</span>
        <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
          isFinished ? 'bg-gray-700 text-gray-400' :
          match.status === 'live' ? 'bg-red-500/20 text-red-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {isFinished ? 'Фінал' : match.status === 'live' ? '🔴 Live' : 'Скоро'}
        </span>
      </div>

      {/* Команди і рахунок — вертикально на мобілі */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Хазяї */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="font-semibold text-white text-sm sm:text-base truncate text-right">
            {match.home_team}
          </span>
          {match.home_logo && (
            <img src={match.home_logo} alt="" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
          )}
        </div>

        {/* Центр: рахунок або форма прогнозу */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isFinished ? (
            <div className="bg-gray-800 px-3 py-1.5 rounded-lg font-bold text-lg text-white whitespace-nowrap">
              {match.home_score} : {match.away_score}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="20"
                value={home}
                onChange={e => setHome(e.target.value)}
                disabled={isPast}
                className="w-11 h-11 text-center bg-gray-800 border border-gray-700 rounded-lg font-bold text-white text-lg disabled:opacity-40"
                placeholder="0"
              />
              <span className="text-gray-500 font-bold">:</span>
              <input
                type="number" min="0" max="20"
                value={away}
                onChange={e => setAway(e.target.value)}
                disabled={isPast}
                className="w-11 h-11 text-center bg-gray-800 border border-gray-700 rounded-lg font-bold text-white text-lg disabled:opacity-40"
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Гості */}
        <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
          {match.away_logo && (
            <img src={match.away_logo} alt="" className="w-7 h-7 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
          )}
          <span className="font-semibold text-white text-sm sm:text-base truncate">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Нижній рядок: прогноз + кнопка */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 truncate">
          {userPrediction && !isFinished && (
            <span>Прогноз: {userPrediction.predicted_home}:{userPrediction.predicted_away}</span>
          )}
        </div>

        {isFinished && userPrediction ? (
          <div className={`px-3 py-1 rounded-full text-xs font-bold ml-auto ${
            userPrediction.points === 4 ? 'bg-yellow-500/20 text-yellow-400' :
            userPrediction.points === 1 ? 'bg-green-500/20 text-green-400' :
            'bg-gray-700 text-gray-400'
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
          <span className="text-xs text-gray-600 ml-auto">Закрито</span>
        ) : null}
      </div>
    </div>
  )
}