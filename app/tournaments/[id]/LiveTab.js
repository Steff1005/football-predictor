'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

const POLL_INTERVAL = 30_000

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

function PlayerAvatar({ profile }) {
  const name = displayName(profile)
  const initials = name === '—' ? '?' : name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-green-500/20 flex items-center justify-center">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className="text-xs font-bold text-green-600 dark:text-green-400">{initials}</span>
      }
    </div>
  )
}

// Poisson P(X = k) using log to avoid overflow for large k
function poissonP(k, lambda) {
  if (k < 0 || lambda <= 0) return k === 0 ? 1 : 0
  let log = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) log -= Math.log(i)
  return Math.exp(log)
}

// Returns { pct, exact, impossible, noTime }
function calcProb(predH, predA, curH, curA, kickoffAt) {
  const needH = predH - (curH ?? 0)
  const needA = predA - (curA ?? 0)
  if (needH < 0 || needA < 0) return { impossible: true }
  if (needH === 0 && needA === 0) return { exact: true }
  const elapsed   = Math.max(0, (Date.now() - new Date(kickoffAt)) / 60000)
  const remaining = Math.max(0, 90 - elapsed)
  if (remaining === 0) return { noTime: true }
  const muH = 1.7 * remaining / 90
  const muA = 1.3 * remaining / 90
  const p   = poissonP(needH, muH) * poissonP(needA, muA)
  return { pct: Math.round(p * 100) }
}

function ProbBadge({ predH, predA, curH, curA, kickoffAt }) {
  const r = calcProb(predH, predA, curH, curA, kickoffAt)
  const base = 'text-xs font-semibold rounded px-1.5 py-0.5 w-10 text-center inline-block flex-shrink-0'
  if (r.impossible) return <span className={`${base} bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600`}>✕</span>
  if (r.exact)      return <span className={`${base} bg-green-500/20 text-green-600 dark:text-green-400`}>🎯</span>
  if (r.noTime)     return <span className={`${base} bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500`}>—</span>
  const cls = r.pct >= 30
    ? 'bg-green-500/15 text-green-600 dark:text-green-400'
    : r.pct >= 10
      ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
      : 'bg-red-500/10 text-red-500 dark:text-red-400'
  return (
    <span className={`${base} tabular-nums ${cls}`}>
      {r.pct}%
    </span>
  )
}

export default function LiveTab({ liveMatches, predsByMatch, profileMap, tournamentId }) {
  const [matches, setMatches]     = useState(liveMatches)
  const [lastUpdated, setUpdated] = useState(Date.now())
  const [secAgo, setSecAgo]       = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef(null)

  const fetchScores = useCallback(async () => {
    if (!tournamentId || !liveMatches.length) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/live-scores?tournamentId=${tournamentId}`)
      if (!res.ok) return
      const { matches: fresh } = await res.json()
      if (!fresh?.length) return
      const freshMap = Object.fromEntries(fresh.map(m => [m.id, m]))
      setMatches(prev =>
        prev.map(m => freshMap[m.id]
          ? { ...m, home_score: freshMap[m.id].home_score, away_score: freshMap[m.id].away_score, status: freshMap[m.id].status, clock: freshMap[m.id].clock, halftime: freshMap[m.id].halftime }
          : m
        )
      )
      setUpdated(Date.now())
    } catch { /* network error — keep showing last known data */ }
    finally { setRefreshing(false) }
  }, [tournamentId, liveMatches.length])

  // Poll every 30 s, pause when tab is hidden
  useEffect(() => {
    function start() {
      timerRef.current = setInterval(fetchScores, POLL_INTERVAL)
    }
    function stop() {
      clearInterval(timerRef.current)
    }
    function onVisibility() {
      if (document.hidden) stop()
      else { fetchScores(); start() }
    }

    fetchScores()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [fetchScores])

  // Realtime: react instantly to DB score updates (fallback: 30s polling keeps working)
  useEffect(() => {
    if (!tournamentId || !liveMatches.length) return
    const channel = supabase
      .channel(`live-tab-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, ({ new: m }) => {
        setMatches(prev =>
          prev.map(p => p.id === m.id
            ? { ...p, home_score: m.home_score, away_score: m.away_score, status: m.status }
            : p
          )
        )
        setUpdated(Date.now())
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId, liveMatches.length])

  // "Updated N sec ago" ticker
  useEffect(() => {
    const id = setInterval(() => setSecAgo(Math.round((Date.now() - lastUpdated) / 1000)), 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  if (!liveMatches.length) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-600">
        <p className="text-5xl mb-4">🟡</p>
        <p>Зараз немає матчів, що тривають</p>
      </div>
    )
  }

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {refreshing ? 'Оновлення…' : `Оновлено ${secAgo} с тому`}
        </span>
        <button
          onClick={fetchScores}
          className="text-xs text-green-500 dark:text-green-400 hover:text-green-400 transition-colors flex items-center gap-1"
        >
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Оновити
        </button>
      </div>

      <div className="space-y-3">
        {matches.map(match => {
          const preds = (predsByMatch[match.id] ?? []).filter(p => profileMap[p.user_id])
          const kickoff = new Date(match.kickoff_at)
          const dateStr = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
          const timeStr = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })

          return (
            <div key={match.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

              {/* Match header */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">

                {/* Mobile */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr}, {timeStr}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${match.halftime ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' : 'bg-red-500/10 text-red-500 dark:text-red-400'}`}>
                      {match.halftime ? '⏸ Перерва' : `🔴 ${match.clock || 'Live'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 flex-shrink-0 flex flex-col items-center gap-1.5">
                      {match.home_logo ? <img src={match.home_logo} alt="" className="w-5 h-5 object-contain" /> : <div className="w-5 h-5" />}
                      {match.away_logo ? <img src={match.away_logo} alt="" className="w-5 h-5 object-contain" /> : <div className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{match.home_team}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{match.away_team}</span>
                    </div>
                    {(match.home_score != null && match.away_score != null) && (
                      <span className="text-lg font-bold tabular-nums text-red-500 dark:text-red-400 flex-shrink-0">
                        {match.home_score}:{match.away_score}
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop */}
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">{dateStr}, {timeStr}</span>

                  <div className="flex items-center gap-1.5 w-[35%] justify-end min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate text-right">{match.home_team}</span>
                    {match.home_logo && <img src={match.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                  </div>

                  <div className="w-[90px] flex flex-col items-center justify-center gap-0.5 flex-shrink-0">
                    {match.home_score != null && match.away_score != null ? (
                      <>
                        <span className="bg-red-500/10 rounded-md px-2.5 py-0.5 text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
                          {match.home_score} : {match.away_score}
                        </span>
                        <span className={`text-xs font-medium whitespace-nowrap ${match.halftime ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-400 dark:text-red-500'}`}>
                          {match.halftime ? '⏸ Перерва' : `🔴 ${match.clock || 'Live'}`}
                        </span>
                      </>
                    ) : (
                      <span className="bg-red-500/10 rounded-md px-2 py-0.5 text-xs font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">
                        🔴 {match.clock ?? 'Live'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 w-[35%] justify-start min-w-0">
                    {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{match.away_team}</span>
                  </div>

                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {preds.length} прогноз{preds.length === 1 ? '' : preds.length < 5 ? 'и' : 'ів'}
                  </span>
                </div>
              </div>

              {/* Predictions */}
              {preds.length === 0 ? (
                <div className="px-4 py-3 text-sm text-center text-gray-400 dark:text-gray-600">Прогнозів немає</div>
              ) : preds.map(pred => {
                const profile = profileMap[pred.user_id]
                const hasScore = match.home_score != null && match.away_score != null
                return (
                  <div key={pred.user_id} className="border-t border-gray-100 dark:border-white/10">
                    {/* Mobile row */}
                    <div className="sm:hidden flex items-center px-4 py-2 gap-3">
                      <Link href={`/players/${pred.user_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        <PlayerAvatar profile={profile} />
                        <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">{displayName(profile)}</span>
                      </Link>
                      <div className="w-11 flex-shrink-0 flex flex-col items-center">
                        <span className="font-mono text-sm font-semibold text-gray-500 dark:text-gray-400 leading-snug">{pred.predicted_home}</span>
                        <span className="font-mono text-sm font-semibold text-gray-500 dark:text-gray-400 leading-snug">{pred.predicted_away}</span>
                      </div>
                      {hasScore
                        ? <ProbBadge predH={pred.predicted_home} predA={pred.predicted_away} curH={match.home_score} curA={match.away_score} kickoffAt={match.kickoff_at} />
                        : <div className="w-10 flex-shrink-0" />}
                    </div>

                    {/* Desktop row */}
                    <div className="hidden sm:flex items-center px-4 py-2 gap-3">
                      <Link href={`/players/${pred.user_id}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        <PlayerAvatar profile={profile} />
                        <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">{displayName(profile)}</span>
                      </Link>
                      <span className="bg-gray-100 dark:bg-white/10 rounded-md px-2.5 py-0.5 font-mono text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0 min-w-[2.75rem] text-center">
                        {pred.predicted_home}:{pred.predicted_away}
                      </span>
                      {hasScore
                        ? <ProbBadge predH={pred.predicted_home} predA={pred.predicted_away} curH={match.home_score} curA={match.away_score} kickoffAt={match.kickoff_at} />
                        : <div className="w-16 flex-shrink-0" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
