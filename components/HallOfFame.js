'use client'
import { useState } from 'react'
import Avatar from './Avatar'

function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}
function pini(p) {
  return pdn(p).split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}
function fmtNum(n) {
  return n == null ? '0' : new Intl.NumberFormat('uk-UA').format(n)
}

const TABS = [
  { key: 'winners', label: 'Переможці турнірів' },
  { key: 'medals',  label: 'Медальний залік' },
]

function MedalBadge({ count, emoji }) {
  if (!count) return <span className="w-6 text-center text-xs text-gray-300 dark:text-gray-700">—</span>
  return (
    <span className="flex items-center gap-0.5">
      <span className="text-sm leading-none">{emoji}</span>
      <span className="text-xs font-bold tabular-nums text-gray-700 dark:text-gray-200">{count}</span>
    </span>
  )
}

export default function HallOfFame({ finishedTournaments, hofRankings, medalRows, tournamentLogos, leagueEmoji }) {
  const [tab, setTab] = useState('winners')

  if (!finishedTournaments?.length) return null

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">🏆 Зал слави</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Winners per tournament ─────────────────────────────── */}
      {tab === 'winners' && (
        <div className="space-y-3">
          {finishedTournaments.map(t => {
            const top = hofRankings[t.id] ?? []
            return (
              <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <a href={`/tournaments/${t.id}`}
                  className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  {tournamentLogos[t.league_id]
                    ? <img src={tournamentLogos[t.league_id]} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                    : <span className="text-base leading-none">{leagueEmoji[t.league_id] ?? '🏆'}</span>
                  }
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 group-hover:text-green-500 dark:group-hover:text-green-400 transition-colors truncate">{t.name}</span>
                  <span className="text-gray-300 dark:text-gray-600 text-xs flex-shrink-0">→</span>
                </a>
                {top.length > 0 ? (
                  <div className="px-4 py-2.5 space-y-1.5">
                    {top.map((r, i) => (
                      <a key={r.uid} href={`/players/${r.uid}`}
                        className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                        <span className="text-base leading-none w-5 text-center flex-shrink-0">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                        </span>
                        <Avatar url={r.profile?.avatar_url} initials={pini(r.profile)} sizeCls="w-6 h-6" textCls="text-[10px]" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">{pdn(r.profile)}</span>
                        <span className="text-sm font-bold text-green-500 dark:text-green-400 flex-shrink-0">{fmtNum(r.pts)}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-600">Немає даних</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab 2: Medal tally ────────────────────────────────────────── */}
      {tab === 'medals' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {medalRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-600">Немає даних</div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                <div className="flex-1">Учасник</div>
                <div className="flex gap-3 items-center">
                  <span className="w-8 text-center">🥇</span>
                  <span className="w-8 text-center">🥈</span>
                  <span className="w-8 text-center">🥉</span>
                  <span className="w-6 text-right">∑</span>
                </div>
              </div>
              {medalRows.map((r, i) => (
                <a key={r.uid} href={`/players/${r.uid}`}
                  className="flex items-center px-4 py-2.5 border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors gap-2">
                  {/* Rank + avatar + name */}
                  <span className="text-sm w-4 flex-shrink-0 text-center text-gray-400 dark:text-gray-500 font-medium">{i + 1}</span>
                  <Avatar url={r.profile?.avatar_url} initials={pini(r.profile)} sizeCls="w-6 h-6" textCls="text-[10px]" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">{pdn(r.profile)}</span>
                  {/* Medals */}
                  <div className="flex gap-3 items-center flex-shrink-0">
                    <span className="w-8 text-center">
                      <MedalBadge count={r.gold}   emoji="🥇" />
                    </span>
                    <span className="w-8 text-center">
                      <MedalBadge count={r.silver} emoji="🥈" />
                    </span>
                    <span className="w-8 text-center">
                      <MedalBadge count={r.bronze} emoji="🥉" />
                    </span>
                    <span className="w-6 text-right text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">{r.total}</span>
                  </div>
                </a>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
