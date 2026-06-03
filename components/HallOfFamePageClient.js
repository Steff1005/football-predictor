'use client'
import { useState } from 'react'
import Avatar from './Avatar'

function displayName(p) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.username || '—'
}
function getInitials(p) {
  const n = displayName(p)
  return n === '—' ? '?' : n.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const RANK_STYLE = [
  { medal: '🥇', row: 'bg-yellow-500/5 border-l-[3px] border-l-yellow-400', pts: 'text-yellow-500 dark:text-yellow-400', avatarCls: 'w-10 h-10', nameCls: 'text-base font-bold text-gray-900 dark:text-white' },
  { medal: '🥈', row: 'border-l-[3px] border-l-gray-400',                   pts: 'text-gray-500 dark:text-gray-300',       avatarCls: 'w-8 h-8',   nameCls: 'text-sm font-medium text-gray-800 dark:text-gray-200' },
  { medal: '🥉', row: 'border-l-[3px] border-l-orange-400/70',              pts: 'text-orange-600 dark:text-orange-400',   avatarCls: 'w-8 h-8',   nameCls: 'text-sm font-medium text-gray-800 dark:text-gray-200' },
]

const TABS = [
  { key: 'winners', label: 'Переможці турнірів' },
  { key: 'medals',  label: 'Медальний залік' },
]

export default function HallOfFamePageClient({ enriched, medalRows, tournamentLogos }) {
  const [tab, setTab] = useState('winners')

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm font-medium py-2 px-5 rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Winners per tournament ─────────────────────────── */}
      {tab === 'winners' && (
        <div className="space-y-5">
          {enriched.map(({ tournament, lastDate, standings }) => {
            const top3 = standings.slice(0, 3)
            const rest = standings.length - top3.length
            const dateLabel = lastDate
              ? new Date(lastDate).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
              : null

            return (
              <div key={tournament.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/10">
                  {tournamentLogos[tournament.league_id] && (
                    <img src={tournamentLogos[tournament.league_id]} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg leading-tight truncate">{tournament.name}</h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {[dateLabel, `${standings.length} учасник${standings.length === 1 ? '' : standings.length < 5 ? 'и' : 'ів'}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <a href={`/tournaments/${tournament.id}?tab=standings`}
                    className="text-xs text-green-500 hover:text-green-400 font-medium whitespace-nowrap flex-shrink-0 transition-colors">
                    Таблиця →
                  </a>
                </div>
                <div>
                  {top3.map((row, i) => {
                    const s = RANK_STYLE[i]
                    return (
                      <a key={row.uid} href={`/players/${row.uid}`}
                        className={`flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${s.row}`}>
                        <span className="text-xl w-6 text-center flex-shrink-0 leading-none">{s.medal}</span>
                        <Avatar url={row.profile?.avatar_url} initials={getInitials(row.profile)} sizeCls={s.avatarCls} textCls="text-xs" />
                        <span className={`flex-1 min-w-0 truncate ${s.nameCls}`}>{displayName(row.profile)}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                            🎯 {row.exact} &nbsp;✅ {row.results}
                          </span>
                          <span className={`font-bold text-base tabular-nums ${s.pts}`}>{row.total}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
                {rest > 0 && (
                  <div className="px-5 py-2.5 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
                    <a href={`/tournaments/${tournament.id}?tab=standings`}
                      className="text-xs text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors">
                      + ще {rest} учасник{rest === 1 ? '' : rest < 5 ? 'и' : 'ів'} →
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab 2: Medal tally ────────────────────────────────────── */}
      {tab === 'medals' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {medalRows.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-600">
              <p className="text-4xl mb-3">🏅</p>
              <p className="text-sm">Поки немає даних</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b-2 border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                <span className="w-5 sm:w-6 text-center">#</span>
                <span className="flex-1">Учасник</span>
                <div className="flex items-center border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-3 gap-0">
                  <span className="w-8 sm:w-10 text-center text-base leading-none">🥇</span>
                  <span className="w-8 sm:w-10 text-center text-base leading-none">🥈</span>
                  <span className="w-8 sm:w-10 text-center text-base leading-none">🥉</span>
                  <span className="w-8 sm:w-10 text-center">∑</span>
                </div>
              </div>

              {medalRows.map((r, i) => {
                const counts = [r.gold, r.silver, r.bronze]
                const cls = [
                  r.gold   ? 'text-yellow-500 dark:text-yellow-400 font-bold' : 'text-gray-200 dark:text-gray-800',
                  r.silver ? 'text-gray-500 dark:text-gray-300 font-bold'     : 'text-gray-200 dark:text-gray-800',
                  r.bronze ? 'text-orange-500 dark:text-orange-400 font-bold' : 'text-gray-200 dark:text-gray-800',
                ]
                return (
                  <a key={r.uid} href={`/players/${r.uid}`}
                    className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
                      i === 0 ? 'bg-yellow-500/5' : ''
                    }`}>
                    <span className="w-5 sm:w-6 text-center text-xs font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                    <Avatar url={r.profile?.avatar_url} initials={getInitials(r.profile)} sizeCls="w-7 h-7 sm:w-9 sm:h-9" textCls="text-[10px] sm:text-xs" />
                    <span className="flex-1 min-w-0 font-medium text-gray-900 dark:text-white truncate">{displayName(r.profile)}</span>
                    <div className="flex items-center border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-3 gap-0 flex-shrink-0">
                      {counts.map((count, mi) => (
                        <span key={mi} className={`w-8 sm:w-10 text-center text-sm tabular-nums ${cls[mi]}`}>
                          {count || '—'}
                        </span>
                      ))}
                      <span className="w-8 sm:w-10 text-center text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums">{r.total}</span>
                    </div>
                  </a>
                )
              })}
            </>
          )}
        </div>
      )}
    </>
  )
}
