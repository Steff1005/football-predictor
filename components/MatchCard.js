'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastProvider'
import { markDirty, markClean } from '../lib/unsaved-guard'

function StatsUrlEditor({ matchId, initialUrl }) {
  const [url, setUrl]       = useState(initialUrl ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]   = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  function openEdit() { setDraft(url); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  function cancelEdit() { setEditing(false) }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/update-stats-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, url: draft.trim() }),
    })
    setSaving(false)
    if (res.ok) { setUrl(draft.trim()); setEditing(false) }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancelEdit() }}
          placeholder="https://..."
          className="flex-1 min-w-0 text-xs px-2 py-1 rounded border border-orange-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none"
        />
        <button onClick={save} disabled={saving}
          className="text-green-500 hover:text-green-400 text-sm font-bold px-1 flex-shrink-0">✓</button>
        <button onClick={cancelEdit}
          className="text-gray-400 hover:text-gray-300 text-sm px-1 flex-shrink-0">✕</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 dark:bg-white/8 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/12 hover:bg-white/20 dark:hover:bg-white/15 hover:text-gray-900 dark:hover:text-white transition-all">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
            <path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Статистика
        </a>
      ) : (
        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
      )}
      <button onClick={openEdit} title="Змінити URL статистики"
        className="text-gray-300 dark:text-gray-600 hover:text-green-500 dark:hover:text-green-400 transition-colors text-xs leading-none">
        ✏
      </button>
    </div>
  )
}

let _cardSeq = 0

function getClean(value) {
  const digits = value.replace(/[^0-9]/g, '')
  // Only single digit 0-9: take the last typed character so new digit naturally replaces old
  return digits === '' ? '' : digits.slice(-1)
}

function pluralDays(n) {
  const mod10  = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'днів'
  if (mod10 === 1)                  return 'день'
  if (mod10 >= 2 && mod10 <= 4)     return 'дні'
  return 'днів'
}

function getDaysLabel(kickoffAt) {
  const diffMs    = new Date(kickoffAt) - new Date()
  const diffHours = diffMs / 3600000
  const diffDays  = Math.floor(diffHours / 24)
  if (diffHours < 1)  return { label: 'Скоро',                              color: 'bg-red-500/20 text-red-400' }
  if (diffHours < 24) return { label: `Через ${Math.floor(diffHours)}г`,    color: 'bg-red-500/20 text-red-400' }
  if (diffDays === 1) return { label: 'Завтра',                             color: 'bg-orange-500/20 text-orange-400' }
  if (diffDays <= 3)  return { label: `${diffDays} ${pluralDays(diffDays)}`, color: 'bg-orange-500/20 text-orange-400' }
  if (diffDays <= 7)  return { label: `${diffDays} ${pluralDays(diffDays)}`, color: 'bg-yellow-500/20 text-yellow-400' }
  return                     { label: `${diffDays} ${pluralDays(diffDays)}`, color: 'bg-white/10 text-gray-400' }
}

const blockKeys = e => {
  if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) e.preventDefault()
}

export default function MatchCard({ match, userPrediction, userId, highlight, isAdmin = false }) {
  const toast = useToast()
  const [home, setHome] = useState(userPrediction?.predicted_home ?? '')
  const [away, setAway] = useState(userPrediction?.predicted_away ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(!!userPrediction)
  const awayRef       = useRef(null)
  const mobileAwayRef = useRef(null)
  const cardId        = useRef(null)
  if (cardId.current === null) cardId.current = ++_cardSeq

  const isFinished = match.status === 'finished'
  const isPast     = new Date(match.kickoff_at) < new Date()
  const isValid    = home !== '' && away !== '' && Number(home) >= 0 && Number(away) >= 0 && Number(home) <= 9 && Number(away) <= 9
  const isDirty    = !saved && !isPast && !isFinished && (home !== '' || away !== '')

  useEffect(() => {
    const id = cardId.current
    if (isDirty) {
      markDirty(id)
      return () => markClean(id)
    } else {
      markClean(id)
    }
  }, [isDirty])

  async function savePrediction() {
    if (!userId) { toast('Спочатку увійди в акаунт', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: match.id,
      predicted_home: parseInt(home),
      predicted_away: parseInt(away),
    }, { onConflict: 'user_id,match_id' })
    setSaving(false)
    if (!error) setSaved(true)
    else toast('Помилка: ' + error.message, 'error')
  }

  const kickoff = new Date(match.kickoff_at)
  const dateStr = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' })
  const timeStr = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })

  const { label: daysLabel, color: daysColor } = (!isFinished && match.status !== 'live')
    ? getDaysLabel(match.kickoff_at)
    : { label: '', color: '' }

  const mobileInputCls  = 'no-spin w-10 h-9 text-center bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white text-base disabled:opacity-40 flex-shrink-0'
  const desktopInputCls = 'no-spin w-9 h-9 text-center bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white text-base disabled:opacity-40'

  // Fixed width so "Зберегти" ↔ "✓ Збережено" don't shift layout
  const saveBtnCls = `min-w-[120px] text-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 disabled:opacity-40 ${
    saved
      ? 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300'
      : 'bg-green-500 hover:bg-green-400 text-white'
  }`
  const saveBtnLabel = saving ? '...' : saved ? '✓ Збережено' : 'Зберегти'

  const badge = isFinished && userPrediction ? (
    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
      userPrediction.points === 4 ? 'bg-yellow-500/20 text-yellow-400' :
      userPrediction.points === 1 ? 'bg-green-500/20 text-green-400' :
      'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
    }`}>
      {userPrediction.points === 4 ? '🎯 +4' :
       userPrediction.points === 1 ? '✅ +1' : '❌ 0'}
    </div>
  ) : null

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-2 sm:p-3 border ${
      highlight
        ? 'border-gray-200 dark:border-gray-700 border-l-[3px] border-l-amber-400/70 dark:border-l-amber-400/50'
        : 'border-gray-200 dark:border-gray-700'
    }`}>

      {/* Top row: date + dirty indicator + status badge */}
      <div className="flex justify-between items-center mb-2 text-xs text-gray-400 dark:text-gray-500">
        <span suppressHydrationWarning>{dateStr}, {timeStr}</span>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-amber-500 dark:text-amber-400 font-medium">● не збережено</span>
          )}
          <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
            isFinished              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' :
            match.status === 'live' ? 'bg-red-500/20 text-red-400' :
                                      daysColor
          }`}>
            {isFinished ? 'Завершено' : match.status === 'live' ? '🔴 Live' : daysLabel}
          </span>
        </div>
      </div>

      {/* ── Mobile layout (< sm) ────────────────────────────────────── */}
      <div className="sm:hidden">
        {isFinished ? (
          <div className="space-y-2 mb-2">
            <div className="flex items-center gap-2">
              {match.home_logo && <img src={match.home_logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
              <span className="font-semibold text-sm text-gray-900 dark:text-white">{match.home_team}</span>
            </div>
            <div className="flex justify-center">
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1.5 rounded-lg font-bold text-xl text-gray-900 dark:text-white">
                {match.home_score} : {match.away_score}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {match.away_logo && <img src={match.away_logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
              <span className="font-semibold text-sm text-gray-900 dark:text-white">{match.away_team}</span>
            </div>
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              {match.home_logo && <img src={match.home_logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
              <span className="font-semibold text-sm text-gray-900 dark:text-white flex-1 min-w-0">{match.home_team}</span>
              <input
                type="number" inputMode="numeric" min="0" max="9" value={home}
                onChange={e => {
                  const c = getClean(e.target.value)
                  setHome(c); setSaved(false)
                  if (c.length === 1) mobileAwayRef.current?.focus()
                }}
                onKeyDown={blockKeys}
                disabled={isPast}
                className={mobileInputCls}
                placeholder="-"
              />
            </div>
            <div className="flex justify-end my-0.5">
              <span className="w-10 text-center text-gray-400 dark:text-gray-500 font-bold text-sm leading-none">:</span>
            </div>
            <div className="flex items-center gap-2">
              {match.away_logo && <img src={match.away_logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
              <span className="font-semibold text-sm text-gray-900 dark:text-white flex-1 min-w-0">{match.away_team}</span>
              <input
                ref={mobileAwayRef}
                type="number" inputMode="numeric" min="0" max="9" value={away}
                onChange={e => { setAway(getClean(e.target.value)); setSaved(false) }}
                onKeyDown={blockKeys}
                disabled={isPast}
                className={mobileInputCls}
                placeholder="-"
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          {isAdmin
            ? <StatsUrlEditor matchId={match.id} initialUrl={match.flashscore_url} />
            : match.flashscore_url
              ? <a href={match.flashscore_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 dark:bg-white/8 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/12 hover:bg-white/20 dark:hover:bg-white/15 transition-all">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
                    <path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Статистика
                </a>
              : <span />}
          {badge ?? (!isFinished && !isPast ? (
            <button onClick={savePrediction} disabled={saving || !isValid} className={saveBtnCls}>
              {saveBtnLabel}
            </button>
          ) : isPast && !isFinished ? (
            <span className="text-xs text-gray-400 dark:text-gray-600">Закрито</span>
          ) : null)}
        </div>
      </div>

      {/* ── Desktop layout (≥ sm) ────────────────────────────────────── */}
      <div className="hidden sm:block">
        {/* Teams row: flex-1 | score | flex-1 — score always at exact center */}
        <div className="flex items-center gap-3">
          {/* Home: name right-aligned, logo at right edge */}
          <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
            <span className="font-semibold text-gray-900 dark:text-white text-sm text-right truncate">{match.home_team}</span>
            {match.home_logo && <img src={match.home_logo} alt="" className="w-7 h-5 object-contain flex-shrink-0" />}
          </div>

          {/* Score or inputs — fixed width, never shifts */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFinished ? (
              <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg font-bold text-base text-gray-900 dark:text-white whitespace-nowrap">
                {match.home_score} : {match.away_score}
              </div>
            ) : (
              <>
                <input
                  type="number" inputMode="numeric" min="0" max="9" value={home}
                  onChange={e => {
                    const c = getClean(e.target.value)
                    setHome(c); setSaved(false)
                    if (c.length === 1) awayRef.current?.focus()
                  }}
                  onKeyDown={blockKeys}
                  disabled={isPast}
                  className={desktopInputCls}
                  placeholder="-"
                />
                <span className="text-gray-400 dark:text-gray-500 font-bold">:</span>
                <input
                  ref={awayRef}
                  type="number" inputMode="numeric" min="0" max="9" value={away}
                  onChange={e => { setAway(getClean(e.target.value)); setSaved(false) }}
                  onKeyDown={blockKeys}
                  disabled={isPast}
                  className={desktopInputCls}
                  placeholder="-"
                />
              </>
            )}
          </div>

          {/* Away: logo at left edge, name left-aligned */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            {match.away_logo && <img src={match.away_logo} alt="" className="w-7 h-5 object-contain flex-shrink-0" />}
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{match.away_team}</span>
          </div>
        </div>

        {/* Action row: stats link left, save button right */}
        <div className="flex items-center justify-between mt-1">
          {isAdmin
            ? <StatsUrlEditor matchId={match.id} initialUrl={match.flashscore_url} />
            : match.flashscore_url
              ? <a href={match.flashscore_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 dark:bg-white/8 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/12 hover:bg-white/20 dark:hover:bg-white/15 transition-all">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
                    <path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Статистика
                </a>
              : <span />}
          {badge ?? (!isFinished && !isPast ? (
            <button onClick={savePrediction} disabled={saving || !isValid} className={saveBtnCls}>
              {saveBtnLabel}
            </button>
          ) : isPast && !isFinished ? (
            <span className="text-xs text-gray-400 dark:text-gray-600">Закрито</span>
          ) : null)}
        </div>
      </div>
    </div>
  )
}
