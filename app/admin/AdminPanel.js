'use client'
import { useState, useEffect } from 'react'
import { updateMatch, updateProfile, mergeProfiles, fetchTournamentStats, syncAllProfileStats, fetchPredictionRegistry } from './actions'

const INPUT  = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm'
const BTN_SM = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors'

const STATUS_LABEL = { finished: 'Завершено', live: '🔴 Live', scheduled: 'Заплановано' }
const STATUS_COLOR = {
  finished: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  live:      'bg-red-500/20 text-red-500 dark:text-red-400',
  scheduled: 'bg-green-500/20 text-green-500 dark:text-green-400',
}

function Flash({ msg }) {
  if (!msg) return null
  const isErr = msg.startsWith('Помилка')
  return (
    <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${
      isErr
        ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
        : 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
    }`}>{msg}</div>
  )
}

// ── Matches tab ─────────────────────────────────────────────────────────────

function MatchesTab({ matches, setMatches, tournaments }) {
  const [editing,          setEditing]          = useState(null)
  const [saving,           setSaving]           = useState(false)
  const [recalcId,         setRecalcId]         = useState(null)
  const [filter,           setFilter]           = useState('')
  const [statusFilter,     setStatusFilter]     = useState('all')
  const [tournamentFilter, setTournamentFilter] = useState('all')
  const [msg,              setMsg]              = useState('')

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 4000) }

  function startEdit(m) {
    setEditing({ id: m.id, home_score: m.home_score ?? '', away_score: m.away_score ?? '', status: m.status })
  }

  async function saveMatch() {
    setSaving(true)
    const result = await updateMatch(editing.id, {
      home_score: editing.home_score !== '' ? parseInt(editing.home_score) : null,
      away_score: editing.away_score !== '' ? parseInt(editing.away_score) : null,
      status: editing.status,
    })
    setSaving(false)
    if (result.error) { flash('Помилка: ' + result.error); return }
    setMatches(prev => prev.map(m => m.id === editing.id ? { ...m, ...result.match } : m))
    setEditing(null)
    flash('✅ Матч оновлено')
  }

  async function recalculate(matchId) {
    setRecalcId(matchId)
    try {
      const res  = await fetch(`/api/recalculate/${matchId}`)
      const data = await res.json()
      if (data.error) flash('Помилка: ' + data.error)
      else flash(`✅ Перераховано ${data.updated} прогнозів`)
    } catch (e) {
      flash('Помилка: ' + e.message)
    }
    setRecalcId(null)
  }

  const STATUS_ORDER = { scheduled: 0, live: 1, finished: 2 }

  const visible = matches
    .filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (tournamentFilter !== 'all' && m.tournament_id !== tournamentFilter) return false
      if (filter) {
        const q = filter.toLowerCase()
        if (!m.home_team?.toLowerCase().includes(q) && !m.away_team?.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
      if (statusDiff !== 0) return statusDiff
      return new Date(a.kickoff_at) - new Date(b.kickoff_at)
    })

  const tournamentMap = {}
  ;(tournaments ?? []).forEach(t => { tournamentMap[t.id] = t.name })

  return (
    <div>
      <Flash msg={msg} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <input
          type="text" placeholder="Пошук команди…"
          value={filter} onChange={e => setFilter(e.target.value)}
          className={INPUT + ' sm:w-56'}
        />
        <select value={tournamentFilter} onChange={e => setTournamentFilter(e.target.value)}
          className={INPUT + ' sm:w-48'}>
          <option value="all">Всі турніри</option>
          {(tournaments ?? []).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className={INPUT + ' sm:w-44'}>
          <option value="all">Всі статуси</option>
          <option value="scheduled">Заплановані</option>
          <option value="live">Live</option>
          <option value="finished">Завершені</option>
        </select>
        <span className="text-sm text-gray-400 dark:text-gray-500 self-center">
          {visible.length} / {matches.length} матчів
        </span>
      </div>

      <div className="space-y-2">
        {visible.map(match => {
          const isEditing = editing?.id === match.id
          const kickoff   = new Date(match.kickoff_at)
          const dateStr   = kickoff.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Kyiv' })
          const timeStr   = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })

          return (
            <div key={match.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              {isEditing ? (
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">
                    {match.home_team} <span className="text-gray-400">vs</span> {match.away_team}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Гол 1</label>
                      <input type="number" min="0" max="30" value={editing.home_score}
                        onChange={e => setEditing(p => ({ ...p, home_score: e.target.value }))}
                        className={INPUT + ' text-center font-bold text-lg'} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Гол 2</label>
                      <input type="number" min="0" max="30" value={editing.away_score}
                        onChange={e => setEditing(p => ({ ...p, away_score: e.target.value }))}
                        className={INPUT + ' text-center font-bold text-lg'} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 mb-1 block">Статус</label>
                      <select value={editing.status}
                        onChange={e => setEditing(p => ({ ...p, status: e.target.value }))}
                        className={INPUT}>
                        <option value="scheduled">Заплановано</option>
                        <option value="live">Live</option>
                        <option value="finished">Завершено</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveMatch} disabled={saving}
                      className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving ? '…' : 'Зберегти'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {match.home_team}
                      <span className="mx-1.5 font-mono text-gray-500 dark:text-gray-400">
                        {match.home_score != null && match.away_score != null
                          ? `${match.home_score}:${match.away_score}`
                          : '–:–'}
                      </span>
                      {match.away_team}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr} {timeStr}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[match.status] ?? STATUS_COLOR.scheduled}`}>
                        {STATUS_LABEL[match.status] ?? match.status}
                      </span>
                      {tournamentMap[match.tournament_id] && (
                        <span className="text-xs text-gray-400 dark:text-gray-600 truncate max-w-[140px]">
                          {tournamentMap[match.tournament_id]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(match)}
                      className={`${BTN_SM} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300`}>
                      Редагувати
                    </button>
                    {match.status === 'finished' && (
                      <button onClick={() => recalculate(match.id)} disabled={recalcId === match.id}
                        className={`${BTN_SM} bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 disabled:opacity-50`}>
                        {recalcId === match.id ? '…' : 'Перерахувати'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600">Матчів не знайдено</div>
        )}
      </div>
    </div>
  )
}

// ── Profiles tab ────────────────────────────────────────────────────────────

function ProfilesTab({ profiles, setProfiles }) {
  const [editing, setEditing] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 4000) }

  function startEdit(p) {
    setEditing({ id: p.id, first_name: p.first_name || '', last_name: p.last_name || '', username: p.username || '' })
  }

  async function saveProfileData() {
    setSaving(true)
    const result = await updateProfile(editing.id, {
      first_name: editing.first_name,
      last_name:  editing.last_name,
      username:   editing.username,
    })
    setSaving(false)
    if (result.error) { flash('Помилка: ' + result.error); return }
    setProfiles(prev => prev.map(p => p.id === editing.id ? { ...p, ...result.profile } : p))
    setEditing(null)
    flash('✅ Профіль оновлено')
  }

  return (
    <div>
      <Flash msg={msg} />
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">{profiles.length} учасників</p>

      <div className="space-y-2">
        {profiles.map(profile => {
          const isEditing = editing?.id === profile.id
          const fullName  = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—'

          return (
            <div key={profile.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              {isEditing ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    {[['Імʼя', 'first_name'], ['Прізвище', 'last_name'], ['Нікнейм', 'username']].map(([label, key]) => (
                      <div key={key}>
                        <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                        <input type="text" value={editing[key]}
                          onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                          className={INPUT} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveProfileData} disabled={saving}
                      className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      {saving ? '…' : 'Зберегти'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{fullName}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      @{profile.username || '—'} · {profile.total_points ?? 0} балів · {profile.total_predictions ?? 0} прогнозів
                    </div>
                  </div>
                  <button onClick={() => startEdit(profile)}
                    className={`${BTN_SM} bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0`}>
                    Редагувати
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Merge tab ───────────────────────────────────────────────────────────────

function MergeTab({ profiles, setProfiles, setTab }) {
  const [sourceId,     setSourceId]     = useState('')
  const [targetId,     setTargetId]     = useState('')
  const [merging,      setMerging]      = useState(false)
  const [confirmStep,  setConfirmStep]  = useState(false)
  const [msg,          setMsg]          = useState('')

  const source = profiles.find(p => p.id === sourceId)
  const target = profiles.find(p => p.id === targetId)

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 6000) }

  function profileLabel(p) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
    return `${name} (${p.total_points ?? 0} балів, ${p.total_predictions ?? 0} прогн.)`
  }

  function profileDisplay(p) {
    if (!p) return '—'
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
    return name + (p.username ? ` (@${p.username})` : '')
  }

  async function executeMerge() {
    setMerging(true)
    setMsg('')
    const result = await mergeProfiles(sourceId, targetId)
    setMerging(false)
    setConfirmStep(false)

    if (result.error) {
      flash('Помилка: ' + result.error)
      return
    }

    setProfiles(prev =>
      prev
        .filter(p => p.id !== sourceId)
        .map(p => p.id === targetId && result.target ? { ...p, ...result.target } : p)
    )
    setSourceId('')
    setTargetId('')
    flash(`✅ Злиття завершено. Перенесено ${result.moved} прогнозів.`)
    setTimeout(() => setTab('profiles'), 2000)
  }

  const canMerge = sourceId && targetId && sourceId !== targetId

  return (
    <div className="max-w-lg">
      <Flash msg={msg} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Переносить усі прогнози з вихідного профілю до цільового, потім видаляє вихідний.
          При конфлікті залишається прогноз <em>вихідного</em> профілю.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 block">
              Вихідний профіль (буде видалено)
            </label>
            <select value={sourceId} onChange={e => { setSourceId(e.target.value); setConfirmStep(false) }} className={INPUT}>
              <option value="">— Оберіть профіль —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} disabled={p.id === targetId}>{profileLabel(p)}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-center text-gray-300 dark:text-gray-600 text-xl select-none">↓</div>

          <div>
            <label className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 block">
              Цільовий профіль (залишиться)
            </label>
            <select value={targetId} onChange={e => { setTargetId(e.target.value); setConfirmStep(false) }} className={INPUT}>
              <option value="">— Оберіть профіль —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} disabled={p.id === sourceId}>{profileLabel(p)}</option>
              ))}
            </select>
          </div>
        </div>

        {confirmStep ? (
          <div className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4 space-y-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ Підтвердити злиття?</p>
            <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
              <div>Видалити: <strong>{profileDisplay(source)}</strong></div>
              <div>Зберегти: <strong>{profileDisplay(target)}</strong></div>
            </div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              Дія незворотна.
            </p>
            <div className="flex gap-2">
              <button onClick={executeMerge} disabled={merging}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors">
                {merging ? 'Обробка…' : 'Підтвердити злиття'}
              </button>
              <button onClick={() => setConfirmStep(false)} disabled={merging}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <>
            {canMerge && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                ⚠️ Прогнози <strong>{profileDisplay(source)}</strong> будуть перенесені до <strong>{profileDisplay(target)}</strong>. Вихідний профіль зникне.
              </div>
            )}
            <button
              onClick={() => canMerge && setConfirmStep(true)}
              disabled={!canMerge}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 disabled:cursor-not-allowed">
              🔀 Злити профілі
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Analytics tab ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center">
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function AnalyticsTab({ matches, profiles: initProfiles, tournaments, setProfiles }) {
  const [profiles,      setLocalProfiles] = useState(initProfiles)
  const [tourneyStats,  setTourneyStats]  = useState(null)
  const [loadingStats,  setLoadingStats]  = useState(false)
  const [syncing,       setSyncing]       = useState(false)
  const [syncMsg,       setSyncMsg]       = useState('')

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    const result = await syncAllProfileStats()
    setSyncing(false)
    if (result.error) {
      setSyncMsg('Помилка: ' + result.error)
    } else {
      setSyncMsg(`✅ Синхронізовано ${result.updated} профілів`)
      // Reload profiles so the table reflects fresh totals
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  const totalPredictions = profiles.reduce((s, p) => s + (p.total_predictions ?? 0), 0)
  const totalPoints      = profiles.reduce((s, p) => s + (p.total_points ?? 0), 0)
  const finishedMatches  = matches.filter(m => m.status === 'finished').length

  const tournamentMap = {}
  ;(tournaments ?? []).forEach(t => { tournamentMap[t.id] = t })

  // Group matches by tournament
  const matchesByTournament = {}
  for (const m of matches) {
    if (!matchesByTournament[m.tournament_id]) matchesByTournament[m.tournament_id] = { total: 0, finished: 0 }
    matchesByTournament[m.tournament_id].total++
    if (m.status === 'finished') matchesByTournament[m.tournament_id].finished++
  }

  async function loadStats() {
    setLoadingStats(true)
    try {
      const stats = await fetchTournamentStats()
      setTourneyStats(stats)
    } finally {
      setLoadingStats(false)
    }
  }

  const top5 = [...profiles].slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Загальна статистика</h3>
          <div className="flex items-center gap-3">
            {syncMsg && <span className="text-sm text-green-600 dark:text-green-400">{syncMsg}</span>}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Синхронізація…' : '🔄 Синхронізувати статистику'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">
          Якщо кількість прогнозів в адмінці не збігається з профілем гравця — натисни кнопку вище.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Учасників" value={profiles.length} />
          <StatCard label="Прогнозів зроблено" value={totalPredictions.toLocaleString()} />
          <StatCard label="Матчів" value={matches.length} sub={`${finishedMatches} завершено`} />
          <StatCard label="Загалом балів" value={totalPoints.toLocaleString()} />
        </div>
      </div>

      {/* Top 5 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Топ-5 учасників</h3>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                <th className="text-left px-4 py-2.5">Місце</th>
                <th className="text-left px-4 py-2.5">Учасник</th>
                <th className="text-right px-4 py-2.5">Балів</th>
                <th className="text-right px-4 py-2.5">Прогнозів</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((p, i) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
                return (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                    <td className="px-4 py-2.5 text-base">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-400 text-sm">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-green-500 dark:text-green-400">{p.total_points ?? 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">{p.total_predictions ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tournament breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">По турнірах</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                <th className="text-left px-4 py-2.5">Турнір</th>
                <th className="text-center px-3 py-2.5">Матчів</th>
                <th className="text-center px-3 py-2.5">Завершено</th>
                <th className="text-center px-3 py-2.5">Статус</th>
              </tr>
            </thead>
            <tbody>
              {(tournaments ?? []).map(t => {
                const ms = matchesByTournament[t.id] ?? { total: 0, finished: 0 }
                const pct = ms.total > 0 ? Math.round(ms.finished / ms.total * 100) : 0
                return (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{t.name}</td>
                    <td className="text-center px-3 py-2.5 text-gray-600 dark:text-gray-300">{ms.total}</td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-gray-600 dark:text-gray-300">{ms.finished}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-600 ml-1">({pct}%)</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.is_active
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {t.is_active ? 'Активний' : 'Завершено'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Registry tab ────────────────────────────────────────────────────────────

const REG_STATUS_LABEL = { finished: 'Завершено', live: 'Live', scheduled: 'Заплановано' }
const REG_STATUS_COLOR = {
  finished: 'text-gray-400 dark:text-gray-500',
  live:     'text-red-500 dark:text-red-400',
  scheduled:'text-green-500 dark:text-green-400',
}
const REG_STATUS_SORT  = { scheduled: 0, live: 1, finished: 2 }

function RegistryTab({ profiles, tournaments }) {
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? '')
  const [statusFilter, setStatusFilter] = useState('scheduled')
  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function load(tid) {
    if (!tid) return
    setLoading(true)
    setError('')
    setData(null)
    const result = await fetchPredictionRegistry(tid)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setData(result)
  }

  useEffect(() => { load(tournamentId) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTournamentChange(tid) {
    setTournamentId(tid)
    load(tid)
  }

  const allMatches  = data?.matches ?? []
  const predictions = data?.predictions ?? []

  const visibleMatches = allMatches
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .sort((a, b) => {
      const sd = (REG_STATUS_SORT[a.status] ?? 3) - (REG_STATUS_SORT[b.status] ?? 3)
      if (sd !== 0) return sd
      return new Date(a.kickoff_at) - new Date(b.kickoff_at)
    })

  const presence       = new Set(predictions.map(p => `${p.user_id}|${p.match_id}`))
  const activeUserIds  = new Set(predictions.map(p => p.user_id))
  const activeProfiles = profiles.filter(p => activeUserIds.has(p.id))
  const userTotal      = {}
  predictions.forEach(p => { userTotal[p.user_id] = (userTotal[p.user_id] ?? 0) + 1 })

  function shortName(p) {
    if (p.first_name && p.last_name) return `${p.first_name[0]}. ${p.last_name}`
    return p.first_name || p.username || '—'
  }

  function matchDate(m) {
    return new Date(m.kickoff_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Kyiv' })
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <select value={tournamentId} onChange={e => handleTournamentChange(e.target.value)} className={INPUT + ' sm:w-64'}>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={INPUT + ' sm:w-44'}>
          <option value="all">Всі статуси</option>
          <option value="scheduled">Заплановані</option>
          <option value="live">Live</option>
          <option value="finished">Завершені</option>
        </select>
        {data && (
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {visibleMatches.length}/{allMatches.length} матчів · {activeProfiles.length} учасників · {predictions.length} прогнозів
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && data && visibleMatches.length === 0 && (
        <p className="text-center py-12 text-gray-400 dark:text-gray-600">
          {allMatches.length === 0 ? 'Матчів у цьому турнірі немає' : 'Немає матчів з обраним фільтром'}
        </p>
      )}

      {!loading && data && visibleMatches.length > 0 && activeProfiles.length > 0 && (
        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800" style={{ maxHeight: '65vh' }}>
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <th className="sticky left-0 z-40 bg-gray-50 dark:bg-gray-900 text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200 dark:border-gray-800 min-w-[180px]">
                  Матч
                </th>
                <th className="px-2 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap min-w-[44px]">
                  Дата
                </th>
                <th className="px-2 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap min-w-[96px]">
                  Статус
                </th>
                {activeProfiles.map(p => (
                  <th key={p.id} className="px-2 py-2.5 text-center min-w-[52px]">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{shortName(p)}</span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">
                  Всього
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleMatches.map((m, i) => {
                const rowTotal = activeProfiles.filter(p => presence.has(`${p.id}|${m.id}`)).length
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${
                      i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 px-3 py-2 border-r border-gray-200 dark:border-gray-800">
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        m.status === 'finished' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {m.home_team} — {m.away_team}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {matchDate(m)}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <span className={`text-xs font-medium ${REG_STATUS_COLOR[m.status] ?? 'text-gray-400'}`}>
                        {REG_STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </td>
                    {activeProfiles.map(p => {
                      const has = presence.has(`${p.id}|${m.id}`)
                      return (
                        <td key={p.id} className="px-2 py-2 text-center">
                          {has
                            ? <span className="text-green-500 text-base leading-none" title="Є прогноз">✓</span>
                            : <span className="text-gray-300 dark:text-gray-700 text-xs">—</span>
                          }
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-bold ${
                        rowTotal === activeProfiles.length
                          ? 'text-green-500 dark:text-green-400'
                          : rowTotal === 0
                            ? 'text-gray-400 dark:text-gray-600'
                            : 'text-amber-500 dark:text-amber-400'
                      }`}>
                        {rowTotal}/{activeProfiles.length}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="sticky bottom-0 z-30 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <td className="sticky left-0 z-40 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-800 whitespace-nowrap">
                  Всього прогнозів
                </td>
                <td className="px-2 py-2.5" />
                <td className="px-2 py-2.5" />
                {activeProfiles.map(p => (
                  <td key={p.id} className="px-2 py-2.5 text-center">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{userTotal[p.id] ?? 0}</span>
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                  {predictions.length}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Root panel ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'matches',   label: 'Матчі' },
  { id: 'profiles',  label: 'Учасники' },
  { id: 'merge',     label: 'Злиття профілів' },
  { id: 'analytics', label: 'Аналітика' },
  { id: 'registry',  label: 'Реєстр' },
]

export default function AdminPanel({ matches: initMatches, profiles: initProfiles, tournaments: initTournaments }) {
  const [tab,         setTab]         = useState('matches')
  const [matches,     setMatches]     = useState(initMatches)
  const [profiles,    setProfiles]    = useState(initProfiles)
  const tournaments = initTournaments ?? []

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-green-500 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'matches'   && <MatchesTab   matches={matches}   setMatches={setMatches} tournaments={tournaments} />}
      {tab === 'profiles'  && <ProfilesTab  profiles={profiles} setProfiles={setProfiles} />}
      {tab === 'merge'     && <MergeTab     profiles={profiles} setProfiles={setProfiles} setTab={setTab} />}
      {tab === 'analytics' && <AnalyticsTab matches={matches}   profiles={profiles} tournaments={tournaments} setProfiles={setProfiles} />}
      {tab === 'registry'  && <RegistryTab  profiles={profiles} tournaments={tournaments} />}
    </div>
  )
}
