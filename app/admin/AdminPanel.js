'use client'
import { useState, useEffect } from 'react'
import { updateMatch, updateProfile, mergeProfiles, fetchTournamentStats, syncAllProfileStats, fetchPredictionRegistry, fetchActivityData, syncMatches } from './actions'

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
  const [syncing,          setSyncing]          = useState(false)

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 5000) }

  async function handleSyncMatches() {
    setSyncing(true)
    const result = await syncMatches()
    setSyncing(false)
    if (result.error) { flash('Помилка: ' + result.error); return }
    const errTxt = result.errors?.length ? ` (помилки: ${result.errors.join(', ')})` : ''
    flash(`✅ Синхронізовано ${result.synced} матчів${errTxt}`)
    setTimeout(() => window.location.reload(), 1500)
  }

  function toLocalDatetimeInput(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function startEdit(m) {
    setEditing({ id: m.id, home_score: m.home_score ?? '', away_score: m.away_score ?? '', status: m.status, kickoff_at: toLocalDatetimeInput(m.kickoff_at) })
  }

  async function saveMatch() {
    setSaving(true)
    const result = await updateMatch(editing.id, {
      home_score: editing.home_score !== '' ? parseInt(editing.home_score) : null,
      away_score: editing.away_score !== '' ? parseInt(editing.away_score) : null,
      status: editing.status,
      kickoff_at: editing.kickoff_at ? new Date(editing.kickoff_at).toISOString() : undefined,
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
        <button
          onClick={handleSyncMatches}
          disabled={syncing}
          className={`${BTN_SM} ml-auto bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 disabled:opacity-50 transition-colors whitespace-nowrap`}
        >
          {syncing ? '⏳ Синхронізація…' : '🔄 Оновити матчі'}
        </button>
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
                    <div className="col-span-2 sm:col-span-4">
                      <label className="text-xs text-gray-400 mb-1 block">Дата та час (місцевий час)</label>
                      <input type="datetime-local" value={editing.kickoff_at}
                        onChange={e => setEditing(p => ({ ...p, kickoff_at: e.target.value }))}
                        className={INPUT} />
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
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">По турнірах</h3>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-2">
          {(tournaments ?? []).map(t => {
            const ms  = matchesByTournament[t.id] ?? { total: 0, finished: 0 }
            const pct = ms.total > 0 ? Math.round(ms.finished / ms.total * 100) : 0
            return (
              <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    t.is_active
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}>
                    {t.is_active ? 'Активний' : 'Завершено'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {ms.finished} / {ms.total} матчів зіграно ({pct}%)
                </p>
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                const ms  = matchesByTournament[t.id] ?? { total: 0, finished: 0 }
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

// ── Activity tab ────────────────────────────────────────────────────────────

const SETUP_SQL = `create table if not exists user_activity (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  last_seen   timestamptz not null default now(),
  last_device text not null default 'unknown',
  visit_days  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table user_activity enable row level security;
create policy "users_own" on user_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const secs  = Math.floor(diff / 1000)
  if (secs < 60)  return 'щойно'
  const mins  = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} хв`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} год`
  const days  = Math.floor(hours / 24)
  return `${days}д`
}

function ActivityTab() {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [elapsed,     setElapsed]     = useState(0)
  const [copied,      setCopied]      = useState(false)

  async function load() {
    setLoading(true)
    const result = await fetchActivityData()
    setLoading(false)
    setData(result)
    if (!result?.error && !result?.tableNotFound) {
      setLastRefresh(Date.now())
      setElapsed(0)
    }
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lastRefresh) return
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - lastRefresh) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [lastRefresh])

  function copySQL() {
    navigator.clipboard.writeText(SETUP_SQL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (data?.tableNotFound) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Потрібна міграція БД</p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            Таблиця <code className="font-mono bg-amber-500/10 px-1 rounded">user_activity</code> не існує.
            Виконай цей SQL у Supabase SQL Editor:
          </p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{SETUP_SQL}</pre>
          <button onClick={copySQL}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium transition-colors">
            {copied ? '✓ Скопійовано' : 'Копіювати SQL'}
          </button>
        </div>
      </div>
    )
  }

  if (data?.error) {
    return <p className="text-red-500 text-sm">{data.error}</p>
  }

  const now = Date.now()
  const cutoff30 = new Date()
  cutoff30.setDate(cutoff30.getDate() - 30)
  const cutoffStr = cutoff30.toISOString().slice(0, 10)

  const activityMap = {}
  ;(data?.activity ?? []).forEach(a => { activityMap[a.user_id] = a })
  const authMap = data?.authUsers ?? {}

  const rows = (data?.profiles ?? []).map(p => {
    const a    = activityMap[p.id]
    const auth = authMap[p.id]
    const lastSeen = a?.last_seen ?? auth?.last_sign_in_at ?? null
    const isOnline = lastSeen && (now - new Date(lastSeen).getTime()) < 6 * 60 * 1000

    let visits30d = 0, desktop = 0, mobile = 0, tablet = 0, pwa = 0
    for (const [day, counts] of Object.entries(a?.visit_days ?? {})) {
      if (day >= cutoffStr && typeof counts === 'object') {
        visits30d += Object.values(counts).reduce((s, n) => s + n, 0)
        desktop   += counts.desktop ?? 0
        mobile    += counts.mobile  ?? 0
        tablet    += counts.tablet  ?? 0
        pwa       += counts.pwa     ?? 0
      }
    }

    return { ...p, lastSeen, isOnline, visits30d, desktop, mobile, tablet, pwa, lastDevice: a?.last_device ?? null }
  }).sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
    if (!a.lastSeen && !b.lastSeen) return 0
    if (!a.lastSeen) return 1
    if (!b.lastSeen) return -1
    return new Date(b.lastSeen) - new Date(a.lastSeen)
  })

  const onlineCount = rows.filter(r => r.isOnline).length

  function pName(p) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Активність</h3>
          {onlineCount > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
              {onlineCount} онлайн
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400 dark:text-gray-600">оновлено {elapsed}с тому</span>
          )}
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors">
            {loading ? '…' : '↻ Оновити'}
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {rows.map(r => (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
            {/* Row 1: name + status */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{pName(r)}</div>
                {r.username && <div className="text-xs text-gray-400 dark:text-gray-500">@{r.username}</div>}
              </div>
              {r.isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full text-xs font-medium flex-shrink-0">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                  онлайн
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-full text-xs flex-shrink-0">
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full inline-block" />
                  офлайн
                </span>
              )}
            </div>
            {/* Row 2: last seen + visits + devices */}
            <div className="flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
              <span>{timeAgo(r.lastSeen)}</span>
              <div className="flex items-center gap-2">
                {r.visits30d > 0 && (
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{r.visits30d} відвід.</span>
                )}
                {(r.desktop + r.mobile + r.tablet + r.pwa) > 0 && (
                  <div className="flex items-center gap-1">
                    {r.pwa     > 0 && <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded font-medium">PWA {r.pwa}</span>}
                    {r.desktop > 0 && <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded font-medium">Д {r.desktop}</span>}
                    {r.mobile  > 0 && <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded font-medium">М {r.mobile}</span>}
                    {r.tablet  > 0 && <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded font-medium">П {r.tablet}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Учасник</th>
              <th className="text-center px-3 py-2.5">Статус</th>
              <th className="text-right px-3 py-2.5 whitespace-nowrap">Остання активність</th>
              <th className="text-right px-3 py-2.5 whitespace-nowrap">Відвід. / 30д</th>
              <th className="text-right px-4 py-2.5 whitespace-nowrap">Пристрої 30д</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-white">{pName(r)}</div>
                  {r.username && <div className="text-xs text-gray-400 dark:text-gray-500">@{r.username}</div>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {r.isOnline ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                      онлайн
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full inline-block" />
                      офлайн
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums text-xs">
                  {timeAgo(r.lastSeen)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-900 dark:text-white">
                  {r.visits30d > 0 ? r.visits30d : <span className="text-gray-300 dark:text-gray-700">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {(r.desktop + r.mobile + r.tablet + r.pwa) > 0 ? (
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      {r.pwa > 0 && (
                        <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded font-medium">PWA {r.pwa}</span>
                      )}
                      {r.desktop > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded font-medium">Д {r.desktop}</span>
                      )}
                      {r.mobile > 0 && (
                        <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded font-medium">М {r.mobile}</span>
                      )}
                      {r.tablet > 0 && (
                        <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded font-medium">П {r.tablet}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-700 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

const PWA_SQL = `create table if not exists pwa_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  event      text not null,
  platform   text not null default 'unknown',
  created_at timestamptz not null default now()
);
alter table pwa_events enable row level security;
create policy "insert_own" on pwa_events for insert with check (auth.uid() = user_id);
create policy "admin_select" on pwa_events for select using (true);`

const EVENT_LABEL = { shown: 'Побачив', dismissed: 'Відклав', never: 'Ніколи', installed: 'Встановив' }
const EVENT_CLS   = {
  shown:     'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  dismissed: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  never:     'bg-red-500/15 text-red-600 dark:text-red-400',
  installed: 'bg-green-500/15 text-green-600 dark:text-green-400',
}

function PwaTab({ profiles }) {
  const [events,  setEvents]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const [tableErr, setTableErr] = useState(false)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  function name(uid) {
    const p = profileMap[uid]
    return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.username || '—'
  }

  useEffect(() => {
    fetch('/api/pwa-events-admin')
      .then(r => r.json())
      .then(d => { if (d.tableNotFound) setTableErr(true); else setEvents(d.events ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function copySQL() {
    navigator.clipboard.writeText(PWA_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>

  if (tableErr) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Потрібна міграція БД</p>
          <p className="text-sm text-amber-700 dark:text-amber-500">Таблиця <code className="font-mono bg-amber-500/10 px-1 rounded">pwa_events</code> не існує.</p>
          <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{PWA_SQL}</pre>
          <button onClick={copySQL} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors">
            {copied ? '✅ Скопійовано' : 'Копіювати SQL'}
          </button>
        </div>
      </div>
    )
  }

  const eventTypes = ['shown', 'dismissed', 'never', 'installed']

  // Funnel counts — унікальні користувачі на кожну подію
  const uniqueByEvent = Object.fromEntries(eventTypes.map(e => [e, new Set()]))
  const byUser = {}
  for (const ev of events ?? []) {
    uniqueByEvent[ev.event]?.add(ev.user_id)
    if (!byUser[ev.user_id]) byUser[ev.user_id] = []
    byUser[ev.user_id].push(ev)
  }
  const counts = Object.fromEntries(eventTypes.map(e => [e, uniqueByEvent[e].size]))
  const shown = counts.shown || 1

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Funnel */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Воронка встановлення PWA</h3>
        <div className="space-y-3">
          {eventTypes.map(e => {
            const pct = Math.round((counts[e] / shown) * 100)
            return (
              <div key={e}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${EVENT_CLS[e]}`}>{EVENT_LABEL[e]}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono">{counts[e]} {e !== 'shown' ? `(${pct}%)` : ''}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${e === 'installed' ? 'bg-green-500' : e === 'never' ? 'bg-red-400' : e === 'dismissed' ? 'bg-yellow-400' : 'bg-blue-400'}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-user */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">По учасникам</h3>
        </div>
        {Object.keys(byUser).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-600">Подій ще немає — таблиця щойно створена</div>
        ) : (
          Object.entries(byUser)
            .sort((a, b) => {
              const order = ev => ev.some(e => e.event === 'installed') ? 0 : ev.some(e => e.event === 'never') ? 2 : 1
              return order(a[1]) - order(b[1])
            })
            .map(([uid, evs]) => {
              const last = evs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
              const installed = evs.some(e => e.event === 'installed')
              const never     = evs.some(e => e.event === 'never') && !installed
              const shownN    = evs.filter(e => e.event === 'shown').length
              return (
                <div key={uid} className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name(uid)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{last.platform} · показано {shownN}×</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                    installed ? EVENT_CLS.installed : never ? EVENT_CLS.never : EVENT_CLS.dismissed
                  }`}>
                    {installed ? '✅ Встановив' : never ? '❌ Ніколи' : '⏸ Відклав'}
                  </span>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}

// ── Tab analytics tab ─────────────────────────────────────────────────────────

const TAB_COLS = [
  { id: 'matches',       label: 'Матчі',      short: 'Матчі' },
  { id: 'preds',         label: 'Результати', short: 'Рез.' },
  { id: 'live',          label: '🔴 Live',    short: 'Live' },
  { id: 'standings',     label: 'Таблиця',    short: 'Табл.' },
  { id: 'rounds',        label: 'Тури',       short: 'Тури' },
  { id: 'dynamics',      label: '📈 Динаміка',short: '📈' },
]

const PERIODS = [
  { id: 'today', label: 'Сьогодні' },
  { id: '7',     label: '7 днів' },
  { id: '30',    label: '30 днів' },
  { id: 'all',   label: 'Весь час' },
]

function TabBadge({ n }) {
  if (!n) return <span className="text-gray-300 dark:text-gray-700 text-xs select-none">—</span>
  const cls = n >= 30 ? 'bg-green-500/20 text-green-600 dark:text-green-400'
            : n >= 10 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
            : n >= 3  ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'
            :            'bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-500'
  return (
    <span className={`inline-flex items-center justify-center min-w-[1.75rem] h-5 px-1.5 rounded-full text-xs font-bold tabular-nums ${cls}`}>
      {n}
    </span>
  )
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="text-gray-300 dark:text-gray-700 ml-0.5 text-[10px]">↕</span>
  return <span className="text-green-500 ml-0.5 text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
}

function CorrespondentTab({ profiles }) {
  const [events,   setEvents]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [tableErr, setTableErr] = useState(false)
  const [period,   setPeriod]   = useState('30')
  const [search,   setSearch]   = useState('')
  const [sortCol,  setSortCol]  = useState('total')
  const [sortDir,  setSortDir]  = useState('desc')

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  function pName(uid) {
    const p = profileMap[uid]
    if (!p) return '—'
    const base = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
    return base + (REGISTRY_SUFFIX[p.username] ?? '')
  }

  function load() {
    setLoading(true)
    fetch('/api/admin/tab-events')
      .then(r => r.json())
      .then(d => {
        if (d.tableNotFound) setTableErr(true)
        else setEvents(d.events ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>

  if (tableErr) {
    return (
      <div className="max-w-2xl">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">Таблиця tab_events не існує</p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">SQL запит було надано раніше. Запусти його у Supabase SQL Editor.</p>
        </div>
      </div>
    )
  }

  // Period cutoff
  const now = new Date()
  const cutoff = period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
               : period === '7'     ? new Date(now - 7  * 864e5).toISOString()
               : period === '30'    ? new Date(now - 30 * 864e5).toISOString()
               : null

  const filtered = (events ?? []).filter(e => !cutoff || e.created_at >= cutoff)

  // Aggregate per user
  const byUser = {}
  for (const ev of filtered) {
    const uid = ev.user_id
    if (!byUser[uid]) byUser[uid] = { total: 0, last: null }
    if (ev.event_type !== 'tab_open') continue
    const key = ev.metadata?.tab ?? 'unknown'
    byUser[uid][key] = (byUser[uid][key] ?? 0) + 1
    byUser[uid].total++
    if (!byUser[uid].last || ev.created_at > byUser[uid].last) byUser[uid].last = ev.created_at
  }

  // Per-tab totals
  const tabTotals = {}
  for (const col of TAB_COLS) {
    tabTotals[col.id] = filtered.filter(e =>
      e.event_type === 'tab_open' && e.metadata?.tab === col.id
    ).length
  }

  // Filter + sort rows
  let rows = (profiles ?? [])
    .map(p => ({ uid: p.id, total: 0, last: null, ...(byUser[p.id] ?? {}) }))
    .filter(r => !search.trim() || pName(r.uid).toLowerCase().includes(search.trim().toLowerCase()))

  rows.sort((a, b) => {
    const av = sortCol === 'last' ? (a.last ?? '') : (a[sortCol] ?? 0)
    const bv = sortCol === 'last' ? (b.last ?? '') : (b[sortCol] ?? 0)
    if (av < bv) return sortDir === 'desc' ? 1 : -1
    if (av > bv) return sortDir === 'desc' ? -1 : 1
    return 0
  })

  function fmtDate(ts) {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const totalFiltered = filtered.length
  const todayCount = (events ?? []).filter(e => e.created_at?.slice(0, 10) === now.toISOString().slice(0, 10)).length

  return (
    <div className="space-y-4">

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Подій за період" value={totalFiltered} />
        <StatCard label="Учасників" value={rows.length} />
        <StatCard label="Сьогодні" value={todayCount} />
        <StatCard
          label="Найактивніший"
          value={rows[0] ? pName(rows[0].uid).split(' ')[0] : '—'}
          sub={rows[0] ? `${rows[0].total} дій` : ''}
        />
      </div>

      {/* Per-tab totals strip */}
      <div className="flex gap-2 flex-wrap">
        {TAB_COLS.map(col => (
          <div key={col.id} className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">{col.label}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{tabTotals[col.id] || 0}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Period chips */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 w-fit">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                period === p.id
                  ? 'bg-green-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" placeholder="Пошук учасника…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
          />
        </div>

        <button onClick={load} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors self-start sm:self-auto whitespace-nowrap">
          ↻ Оновити
        </button>
      </div>

      {/* Table / cards */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600 text-sm">
          {search ? 'Нікого не знайдено' : 'Подій ще немає'}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {rows.map((r, idx) => (
              <div key={r.uid} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 flex-shrink-0">{idx + 1}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{pName(r.uid)}</span>
                  </div>
                  <span className="flex-shrink-0 text-base font-bold text-gray-900 dark:text-white">{r.total}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TAB_COLS.filter(c => r[c.id]).map(col => (
                    <span key={col.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-300 rounded-lg px-2 py-0.5">
                      <span className="text-gray-400 dark:text-gray-500">{col.short}</span>
                      <span className="font-bold">{r[col.id]}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(r.last)}</p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap w-8">#</th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-0.5 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                      Учасник <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                    </button>
                  </th>
                  {TAB_COLS.map(col => (
                    <th key={col.id} className="px-2 py-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      <button onClick={() => toggleSort(col.id)} className="flex items-center justify-center gap-0.5 w-full hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                        {col.short} <SortIcon col={col.id} sortCol={sortCol} sortDir={sortDir} />
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    <button onClick={() => toggleSort('total')} className="flex items-center justify-center gap-0.5 w-full hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                      Всього <SortIcon col="total" sortCol={sortCol} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    <button onClick={() => toggleSort('last')} className="flex items-center justify-end gap-0.5 w-full hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                      Остання дія <SortIcon col="last" sortCol={sortCol} sortDir={sortDir} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.uid} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-300 dark:text-gray-600 tabular-nums">{idx + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">{pName(r.uid)}</td>
                    {TAB_COLS.map(col => (
                      <td key={col.id} className="px-2 py-2.5 text-center"><TabBadge n={r[col.id]} /></td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-bold text-gray-900 dark:text-white tabular-nums">{r.total}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{fmtDate(r.last)}</td>
                  </tr>
                ))}
                {/* Totals footer */}
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80">
                  <td className="px-4 py-2.5" />
                  <td className="px-2 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Разом</td>
                  {TAB_COLS.map(col => (
                    <td key={col.id} className="px-2 py-2.5 text-center text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                      {tabTotals[col.id] || <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center text-sm font-bold text-gray-900 dark:text-white tabular-nums">{totalFiltered}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Registry tab ────────────────────────────────────────────────────────────

const REGISTRY_SUFFIX = {
  'oleksandr_shliakhtiuk2106': ' (П)',
  'oleksandr_shliakhtiuk':     ' (В)',
}

function RegistryTab({ profiles, tournaments }) {
  const [tournamentId, setTournamentId] = useState(
    (tournaments.find(t => t.is_active) ?? tournaments[0])?.id ?? ''
  )
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
      const diff = new Date(a.kickoff_at) - new Date(b.kickoff_at)
      return a.status === 'finished' ? -diff : diff
    })

  const presence       = new Set(predictions.map(p => `${p.user_id}|${p.match_id}`))
  const activeUserIds  = new Set(predictions.map(p => p.user_id))
  const activeProfiles = profiles.filter(p => activeUserIds.has(p.id))
  const userTotal      = {}
  predictions.forEach(p => { userTotal[p.user_id] = (userTotal[p.user_id] ?? 0) + 1 })

  function shortName(p) {
    const base = p.first_name && p.last_name ? `${p.first_name[0]}. ${p.last_name}` : p.first_name || p.username || '—'
    return base + (REGISTRY_SUFFIX[p.username] ?? '')
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

      {/* Mobile cards — one card per match */}
      {!loading && data && visibleMatches.length > 0 && activeProfiles.length > 0 && (
        <div className="sm:hidden space-y-2">
          {visibleMatches.map(m => {
            const rowTotal = activeProfiles.filter(p => presence.has(`${p.id}|${m.id}`)).length
            const allDone  = rowTotal === activeProfiles.length
            const noneDone = rowTotal === 0
            return (
              <div key={m.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-sm font-medium leading-tight ${m.status === 'finished' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                    {m.home_team} — {m.away_team}
                  </span>
                  <span className={`text-xs font-bold flex-shrink-0 ${
                    allDone ? 'text-green-500 dark:text-green-400' : noneDone ? 'text-gray-400 dark:text-gray-600' : 'text-amber-500 dark:text-amber-400'
                  }`}>{rowTotal}/{activeProfiles.length}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap mb-1.5">
                  {activeProfiles.map(p => {
                    const has = presence.has(`${p.id}|${m.id}`)
                    return (
                      <span key={p.id} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        has ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}>
                        {shortName(p)}
                      </span>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span>{matchDate(m)}</span>
                  <span className={REG_STATUS_COLOR[m.status] ?? 'text-gray-400'}>{REG_STATUS_LABEL[m.status] ?? m.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Desktop matrix table */}
      {!loading && data && visibleMatches.length > 0 && activeProfiles.length > 0 && (
        <div className="hidden sm:block overflow-auto rounded-xl border border-gray-200 dark:border-gray-800" style={{ maxHeight: '65vh' }}>
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <th className="sticky top-0 left-0 z-40 bg-gray-50 dark:bg-gray-900 text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200 dark:border-gray-800 min-w-[180px]">
                  Матч
                </th>
                <th className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 px-2 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap min-w-[44px]">
                  Дата
                </th>
                <th className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 px-2 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap min-w-[96px]">
                  Статус
                </th>
                {activeProfiles.map(p => (
                  <th key={p.id} className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 px-2 py-2.5 text-center min-w-[52px]">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{shortName(p)}</span>
                  </th>
                ))}
                <th className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center whitespace-nowrap">
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
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <td className="sticky bottom-0 left-0 z-40 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-800 whitespace-nowrap">
                  Всього прогнозів
                </td>
                <td className="sticky bottom-0 z-30 bg-gray-50 dark:bg-gray-900 px-2 py-2.5" />
                <td className="sticky bottom-0 z-30 bg-gray-50 dark:bg-gray-900 px-2 py-2.5" />
                {activeProfiles.map(p => (
                  <td key={p.id} className="sticky bottom-0 z-30 bg-gray-50 dark:bg-gray-900 px-2 py-2.5 text-center">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{userTotal[p.id] ?? 0}</span>
                  </td>
                ))}
                <td className="sticky bottom-0 z-30 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-center text-sm font-bold text-gray-700 dark:text-gray-300">
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

// ── Root panel ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'matches',        label: 'Матчі' },
  { id: 'profiles',       label: 'Учасники' },
  { id: 'merge',          label: 'Злиття профілів' },
  { id: 'analytics',      label: 'Аналітика' },
  { id: 'registry',       label: 'Реєстр' },
  { id: 'activity',       label: 'Активність' },
  { id: 'pwa',            label: 'PWA' },
  { id: 'correspondent',  label: '📊 Вкладки' },
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
      {tab === 'activity'  && <ActivityTab />}
      {tab === 'pwa'           && <PwaTab           profiles={profiles} />}
      {tab === 'correspondent' && <CorrespondentTab  profiles={profiles} />}
    </div>
  )
}
