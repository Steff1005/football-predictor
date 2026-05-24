'use client'
import { useState } from 'react'

export default function RoundAnalysisSection({ tournamentId, roundLabel, matchIds, initialText, isAdmin }) {
  const [text,    setText]    = useState(initialText ?? null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/analyze-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, roundLabel, matchIds }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setText(data.analysis.analysis_text)
    } catch (e) {
      setError(e.message || 'Помилка генерації')
    } finally {
      setLoading(false)
    }
  }

  if (!text && !isAdmin) return null

  return (
    <div className="px-5 pb-5">
      {text && (
        <div className="bg-purple-50 dark:bg-purple-500/[0.07] rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-purple-400 dark:text-purple-500 uppercase tracking-wide mb-2">Аналіз туру</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      )}
      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading && <span className="w-3 h-3 border border-purple-500 border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Генерація…' : text ? 'Оновити аналіз' : 'Згенерувати аналіз'}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
