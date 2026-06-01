'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

const POLL_INTERVAL = 30_000
const LAMBDA_HOME   = 1.4   // avg home goals per 90 min
const LAMBDA_AWAY   = 1.1   // avg away goals per 90 min

// ── Math ─────────────────────────────────────────────────────────────────────

function poisson(k, lambda) {
  if (k < 0 || lambda <= 0) return k === 0 ? 1 : 0
  // log-space to avoid overflow
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

function calcProb(ph, pa, ch, ca, kickoffAt, now) {
  if (ch == null || ca == null) return null       // no score yet
  if (ph < ch || pa < ca)       return 0          // impossible
  const elapsed   = (now - new Date(kickoffAt)) / 60000
  const remaining = Math.max(0, Math.min(90, 90 - elapsed))
  if (remaining === 0) return ph === ch && pa === ca ? 1 : 0
  const muH = LAMBDA_HOME * remaining / 90
  const muA = LAMBDA_AWAY * remaining / 90
  return poisson(ph - ch, muH) * poisson(pa - ca, muA)
}

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

function ProbBadge({ prob, isWinning }) {
  if (prob === null) return <div className="w-[58px] flex-shrink-0" />

  const pct = Math.round(prob * 100)

  // 🎯 Score currently matches prediction — always show glow regardless of %
  if (isWinning) {
    return (
      <div className="w-[58px] flex-shrink-0 flex justify-end">
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums animate-prob-glow"
          style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}
        >
          <span className="text-[10px]">🎯</span>
          <span className="animate-prob-shimmer">{pct}%</span>
        </span>
      </div>
    )
  }

  if (prob === 0) {
    return (
      <div className="w-[58px] flex-shrink-0 flex justify-end">
        <span className="text-[11px] text-gray-300 dark:text-gray-700 font-medium tabular-nums select-none">✕ 0%</span>
      </div>
    )
  }

  const color = pct >= 10
    ? 'text-green-500 dark:text-green-400'
    : pct >= 3
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-red-400 dark:text-red-500'

  return (
    <div className="w-[58px] flex-shrink-0 flex justify-end">
      <span className={`text-[11px] font-semibold tabular-nums select-none ${color}`}>
        {pct}%
      </span>
    </div>
  )
}

function MatchCard({ match, preds, profileMap }) {
  const now = Date.now()
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
            <span className="bg-red-500/10 rounded-full px-2.5 py-0.5 text-xs font-semibold text-red-500 dark:text-red-400">
              🔴 Матч триває
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
              <span className="text-lg font-bold tabular-nums text-red-500 dark:text-red-400">
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
          <div className="w-[80px] flex justify-center flex-shrink-0">
            {match.home_score != null && match.away_score != null ? (
              <span className="bg-red-500/10 rounded-md px-2.5 py-0.5 text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
                {match.home_score} : {match.away_score}
              </span>
            ) : (
              <span className="bg-red-500/10 rounded-md px-2 py-0.5 text-xs font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">
                🔴 Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 w-[35%] min-w-0">
            {match.away_logo && <img src={match.away_logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{match.away_team}</span>
          </div>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {filtered.length} прогноз{filtered.length === 1 ? '' : filtered.length < 5 ? 'и' : 'ів'}
          </span>
        </div>
      </div>

      {/* Predictions */}
      {filtered.length === 0 ? (
        <div className="px-4 py-3 text-sm text-center text-gray-400 dark:text-gray-600">Прогнозів немає</div>
      ) : filtered.map(pred => {
        const profile = profileMap[pred.user_id]
        const prob    = calcProb(
          pred.predicted_home, pred.predicted_away,
          match.home_score,    match.away_score,
          match.kickoff_at,    now
        )
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
              <div className="flex-shrink-0 flex flex-col items-center w-9">
                <span className={`font-mono text-sm font-semibold leading-snug ${isWinning ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {pred.predicted_home}
                </span>
                <span className={`font-mono text-sm font-semibold leading-snug ${isWinning ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {pred.predicted_away}
                </span>
              </div>
              <ProbBadge prob={prob} isWinning={isWinning} />
            </div>

            {/* Desktop */}
            <div className="hidden sm:flex items-center px-4 py-2 gap-3">
              <Link href={`/players/${pred.user_id}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                <PlayerAvatar profile={profile} />
                <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">{displayName(profile)}</span>
              </Link>
              <span className={`rounded-md px-2.5 py-0.5 font-mono text-sm font-semibold flex-shrink-0 min-w-[2.75rem] text-center transition-colors ${
                isWinning
                  ? 'bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/30'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'
              }`}>
                {pred.predicted_home}:{pred.predicted_away}
              </span>
              <ProbBadge prob={prob} isWinning={isWinning} />
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
            ? { ...m, home_score: freshMap[m.id].home_score, away_score: freshMap[m.id].away_score, status: freshMap[m.id].status }
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
