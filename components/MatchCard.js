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

  return (
    <div className={`bg-gray-900 rounded-xl p-5 border ${isFinished ? 'border-gray-700' : 'border-gray-800'}`}>
      <div className="flex justify-between items-center mb-4 text-xs text-gray-500">
        <span>{match.round}</span>
        <span>{new Date(match.kickoff_at).toLocaleString('uk-UA')}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          isFinished ? 'bg-gray-700 text-gray-400' :
          match.status === 'live' ? 'bg-red-500/20 text-red-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {isFinished ? 'Завершено' : match.status === 'live' ? '🔴 LIVE' : 'Заплановано'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-semibold text-white">{match.home_team}</span>
            {match.home_logo && <img src={match.home_logo} alt="" className="w-8 h-8 object-contain" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFinished ? (
            <div className="bg-gray-800 px-4 py-2 rounded-lg font-bold text-xl text-white">
              {match.home_score} : {match.away_score}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <input type="number" min="0" max="20" value={home}
                onChange={e => setHome(e.target.value)} disabled={isPast}
                className="w-12 text-center bg-gray-800 border border-gray-700 rounded-lg py-2 font-bold text-white disabled:opacity-40"
                placeholder="0" />
              <span className="text-gray-500 font-bold">:</span>
              <input type="number" min="0" max="20" value={away}
                onChange={e => setAway(e.target.value)} disabled={isPast}
                className="w-12 text-center bg-gray-800 border border-gray-700 rounded-lg py-2 font-bold text-white disabled:opacity-40"
                placeholder="0" />
            </div>
          )}
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            {match.away_logo && <img src={match.away_logo} alt="" className="w-8 h-8 object-contain" />}
            <span className="font-semibold text-white">{match.away_team}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {userPrediction && (
            <span>Твій прогноз: {userPrediction.predicted_home}:{userPrediction.predicted_away}</span>
          )}
        </div>
        {isFinished && userPrediction ? (
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            userPrediction.points === 4 ? 'bg-yellow-500/20 text-yellow-400' :
            userPrediction.points === 1 ? 'bg-green-500/20 text-green-400' :
            'bg-gray-700 text-gray-400'
          }`}>
            {userPrediction.points === 4 ? '🎯 +4 бали' :
             userPrediction.points === 1 ? '✅ +1 бал' : '❌ 0 балів'}
          </div>
        ) : !isFinished && !isPast ? (
          <button onClick={savePrediction} disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              saved ? 'bg-green-600 text-white' : 'bg-green-500 hover:bg-green-400 text-white'
            } disabled:opacity-50`}>
            {saving ? 'Збереження...' : saved ? '✅ Збережено!' : 'Зберегти прогноз'}
          </button>
        ) : isPast && !isFinished ? (
          <span className="text-xs text-gray-600">Прийом прогнозів закрито</span>
        ) : null}
      </div>
    </div>
  )
}