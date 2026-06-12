'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { getLiveStatus } from '../../lib/liveStatus'

function statusCls(v) {
  if (v === 'good')            return 'bg-green-500/10 text-green-600 dark:text-green-400'
  if (v === 'ok')              return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
  if (v === 'warning')         return 'bg-orange-500/10 text-orange-500 dark:text-orange-400'
  if (v === 'danger')          return 'bg-red-500/10 text-red-500 dark:text-red-400'
  if (v === 'near-impossible') return 'bg-red-500/5 text-red-400 dark:text-red-500'
  if (v === 'impossible')      return 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'
  return 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500'
}

const POLL_INTERVAL = 30_000

// ── Components ────────────────────────────────────────────────────────────────

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

function PlayerAvatar({ profile }) {
  const name     = displayName(profile)
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

function ProbBadge({ predH, predA, curH, curA, kickoffAt }) {
  if (curH == null || curA == null) return <div className="flex-shrink-0" />
  const elapsed = Math.max(0, (Date.now() - new Date(kickoffAt)) / 60000)
  const { label, variant, pulse, pct } = getLiveStatus(predH - curH, predA - curA, elapsed)

  const mob  = pct != null ? `${pct}%` : '—'
  const desk = pct != null ? `${label} · ${pct}%` : label

  if (variant === 'exact') {
    return (
      <span
        className="text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 inline-block animate-prob-glow whitespace-nowrap min-w-[2.5rem] text-center"
        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}
      >
        <span className="animate-prob-shimmer">
          <span className="sm:hidden">{mob}</span>
          <span className="hidden sm:inline">{desk}</span>
        </span>
      </span>
    )
  }

  if (variant === 'impossible') {
    return (
      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 inline-block whitespace-nowrap min-w-[2.5rem] text-center bg-gray-100 dark:bg-white/5">
        <span className="sm:hidden font-bold text-red-400">×</span>
        <span className="hidden sm:inline text-gray-400 dark:text-gray-600">Неможливо</span>
      </span>
    )
  }

  return (
    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 inline-block whitespace-nowrap min-w-[2.5rem] text-center ${statusCls(variant)} ${pulse ? 'animate-status-pulse' : ''}`}>
      <span className="sm:hidden">{mob}</span>
      <span className="hidden sm:inline">{desk}</span>
    </span>
  )
}

function MatchCard({ match, preds, profileMap }) {
  const kickoff  = new Date(match.kickoff_at)
  const dateStr  = kickoff.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  const timeStr  = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  const filtered = (preds ?? []).filter(p => profileMap[p.user_id])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
            {match.home_score != null && match.away_score != null && (
              <span className="text-lg font-bold tabular-nums text-red-500 dark:text-red-400 flex-shrink-0">
                {match.home_score}:{match.away_score}
              </span>
            )}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:grid grid-cols-[6rem_1fr_90px_1fr] gap-x-2 items-center">
          <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr}, {timeStr}</span>
          <div className="flex items-center gap-1.5 justify-end min-w-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate text-right">{match.home_team}</span>
            {match.home_logo && <img src={match.home_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
          </div>
          <div className="flex flex-col items-center justify-center gap-0.5">
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
          <div className="flex items-center gap-1.5 min-w-0">
            {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{match.away_team}</span>
            <span className="ml-auto pl-2 flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {filtered.length} прогноз{filtered.length === 1 ? '' : filtered.length < 5 ? 'и' : 'ів'}
            </span>
          </div>
        </div>
      </div>

      {/* Predictions */}
      {filtered.length === 0 ? (
        <div className="px-4 py-3 text-sm text-center text-gray-400 dark:text-gray-600">Прогнозів немає</div>
      ) : filtered.map(pred => {
        const profile   = profileMap[pred.user_id]
        const isWinning = match.home_score === pred.predicted_home && match.away_score === pred.predicted_away

        return (
          <div
            key={pred.user_id}
            className={`border-t border-gray-100 dark:border-white/10 transition-colors ${
              isWinning ? 'bg-green-500/5 dark:bg-green-500/8' : ''
            }`}
          >
            {/* Mobile */}
            <div className="sm:hidden flex items-center px-4 py-2 gap-3">
              <Link href={`/players/${pred.user_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                <PlayerAvatar profile={profile} />
                <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">{displayName(profile)}</span>
              </Link>
              <span className={`font-mono text-sm font-semibold flex-shrink-0 tabular-nums ${isWinning ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {pred.predicted_home}:{pred.predicted_away}
              </span>
              <ProbBadge predH={pred.predicted_home} predA={pred.predicted_away} curH={match.home_score} curA={match.away_score} kickoffAt={match.kickoff_at} />
            </div>

            {/* Desktop */}
            <div className="hidden sm:grid grid-cols-[6rem_1fr_90px_1fr] gap-x-2 items-center px-4 py-2">
              <Link href={`/players/${pred.user_id}`} className="col-span-2 flex items-center gap-2 min-w-0 hover:opacity-75 transition-opacity">
                <PlayerAvatar profile={profile} />
                <span className="text-sm text-gray-900 dark:text-white min-w-0 truncate">{displayName(profile)}</span>
              </Link>
              <div className="flex items-center justify-center">
                <span className={`rounded-md px-2.5 py-0.5 font-mono text-sm font-semibold text-center transition-colors tabular-nums ${
                  isWinning
                    ? 'bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/30'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'
                }`}>
                  {pred.predicted_home}:{pred.predicted_away}
                </span>
              </div>
              <div className="flex items-center">
                <ProbBadge predH={pred.predicted_home} predA={pred.predicted_away} curH={match.home_score} curA={match.away_score} kickoffAt={match.kickoff_at} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LiveAllClient({ groups: initialGroups }) {
  const [groups, setGroups]         = useState(initialGroups)
  const [lastUpdated, setUpdated]   = useState(Date.now())
  const [secAgo, setSecAgo]         = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const timerRef                    = useRef(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/live-scores?all=true')
      if (!res.ok) return
      const { matches: fresh } = await res.json()
      if (!fresh?.length) return
      const freshMap = Object.fromEntries(fresh.map(m => [m.id, m]))
      setGroups(prev => prev.map(g => ({
        ...g,
        matches: g.matches.map(m =>
          freshMap[m.id]
            ? { ...m, home_score: freshMap[m.id].home_score, away_score: freshMap[m.id].away_score, status: freshMap[m.id].status, clock: freshMap[m.id].clock, halftime: freshMap[m.id].halftime }
            : m
        ),
      })))
      setUpdated(Date.now())
    } catch { /* keep last known data */ }
    finally { setRefreshing(false) }
  }, [])

  // Poll scores every 30s
  useEffect(() => {
    function start() { timerRef.current = setInterval(fetchAll, POLL_INTERVAL) }
    function stop()  { clearInterval(timerRef.current) }
    function onVis() { document.hidden ? stop() : (fetchAll(), start()) }
    fetchAll()
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [fetchAll])

  // "N с тому" counter
  useEffect(() => {
    const id = setInterval(() => setSecAgo(Math.round((Date.now() - lastUpdated) / 1000)), 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          Live
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {refreshing ? 'Оновлення…' : `${secAgo} с тому`}
          </span>
          <button
            onClick={fetchAll}
            className="text-xs text-green-500 dark:text-green-400 hover:text-green-400 transition-colors flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Оновити
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map(({ tournament, matches, predsByMatch, profileMap }) => (
          <div key={tournament.id}>
            <div className="flex items-center gap-2 mb-3">
              {tournament.logo && (
                <img src={tournament.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
              )}
              <Link
                href={`/tournaments/${tournament.id}?tab=live`}
                className="text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-green-500 dark:hover:text-green-400 transition-colors"
              >
                {tournament.name}
              </Link>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                · {matches.length} матч{matches.length === 1 ? '' : matches.length < 5 ? 'і' : 'ів'}
              </span>
            </div>

            <div className="space-y-3">
              {matches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  preds={predsByMatch[match.id]}
                  profileMap={profileMap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
