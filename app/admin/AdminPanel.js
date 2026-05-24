'use client'
import { useState } from 'react'
import { updateMatch, updateProfile, mergeProfiles } from './actions'

const INPUT  = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm'
const BTN_SM = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors'

const STATUS_LABEL = { finished: 'Завершено', live: '🔴 Live', scheduled: 'Заплановано' }
const STATUS_COLOR = {
  finished: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  live:      'bg-red-500/20 text-red-500 dark:text-red-400',
  scheduled: 'bg-green-500/20 text-green-500 dark:text-green-400',
}

// ── Shared flash message ────────────────────────────────────────────────────

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

function MatchesTab({ matches, setMatches }) {
  const [editing,      setEditing]      = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [recalcId,     setRecalcId]     = useState(null)
  const [filter,       setFilter]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [msg,          setMsg]          = useState('')

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
      const res  = await fetch(`/api/recalculate/${matchId}`, { method: 'POST' })
      const data = await res.json()
      if (data.error) flash('Помилка: ' + data.error)
      else flash(`✅ Перераховано ${data.updated} прогнозів (${data.profilesAffected ?? 0} гравців)`)
    } catch (e) {
      flash('Помилка: ' + e.message)
    }
    setRecalcId(null)
  }

  const visible = matches.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (filter) {
      const q = filter.toLowerCase()
      if (!m.home_team?.toLowerCase().includes(q) && !m.away_team?.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <Flash msg={msg} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text" placeholder="Пошук команди…"
          value={filter} onChange={e => setFilter(e.target.value)}
          className={INPUT + ' sm:w-64'}
        />
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
          const dateStr   = kickoff.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
          const timeStr   = kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })

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
                  {/* Match info */}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{dateStr} {timeStr}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[match.status] ?? STATUS_COLOR.scheduled}`}>
                        {STATUS_LABEL[match.status] ?? match.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
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

function MergeTab({ profiles, setProfiles }) {
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [merging,  setMerging]  = useState(false)
  const [msg,      setMsg]      = useState('')

  const source = profiles.find(p => p.id === sourceId)
  const target = profiles.find(p => p.id === targetId)

  function profileLabel(p) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
    return `${name} (${p.total_points ?? 0} балів, ${p.total_predictions ?? 0} прогн.)`
  }

  async function handleMerge() {
    if (!sourceId || !targetId || sourceId === targetId) return
    const ok = window.confirm(
      `Злити "${source?.username}" → "${target?.username}"?\n\nВсі прогнози з вихідного профілю будуть перенесені до цільового. При конфлікті збережуться прогнози цільового профілю.\n\nЦя дія незворотна!`
    )
    if (!ok) return

    setMerging(true)
    setMsg('')
    const result = await mergeProfiles(sourceId, targetId)
    setMerging(false)

    if (result.error) {
      setMsg('Помилка: ' + result.error)
      return
    }

    setProfiles(prev =>
      prev
        .filter(p => p.id !== sourceId)
        .map(p => p.id === targetId && result.target ? { ...p, ...result.target } : p)
    )
    setSourceId('')
    setTargetId('')
    setMsg(`✅ Злиття завершено. Перенесено: ${result.moved}, пропущено конфліктів: ${result.skipped ?? 0}.`)
  }

  const canMerge = sourceId && targetId && sourceId !== targetId

  return (
    <div className="max-w-lg">
      <Flash msg={msg} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Переносить усі прогнози з вихідного профілю до цільового, потім видаляє вихідний.
          При конфлікті (обидва зробили прогноз на один матч) зберігається прогноз <em>цільового</em> профілю.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 block">
              Вихідний профіль (буде видалено)
            </label>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} className={INPUT}>
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
            <select value={targetId} onChange={e => setTargetId(e.target.value)} className={INPUT}>
              <option value="">— Оберіть профіль —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} disabled={p.id === sourceId}>{profileLabel(p)}</option>
              ))}
            </select>
          </div>
        </div>

        {canMerge && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            ⚠️ Прогнози <strong>{source?.username ?? source?.first_name}</strong> будуть додані до профілю <strong>{target?.username ?? target?.first_name}</strong>. Вихідний профіль зникне.
          </div>
        )}

        <button
          onClick={handleMerge}
          disabled={!canMerge || merging}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 disabled:cursor-not-allowed">
          {merging ? 'Обробка…' : '🔀 Злити профілі'}
        </button>
      </div>
    </div>
  )
}

// ── Root panel ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'matches',  label: 'Матчі' },
  { id: 'profiles', label: 'Учасники' },
  { id: 'merge',    label: 'Злиття профілів' },
]

export default function AdminPanel({ matches: initMatches, profiles: initProfiles }) {
  const [tab,      setTab]      = useState('matches')
  const [matches,  setMatches]  = useState(initMatches)
  const [profiles, setProfiles] = useState(initProfiles)

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

      {tab === 'matches'  && <MatchesTab  matches={matches}   setMatches={setMatches} />}
      {tab === 'profiles' && <ProfilesTab profiles={profiles} setProfiles={setProfiles} />}
      {tab === 'merge'    && <MergeTab    profiles={profiles} setProfiles={setProfiles} />}
    </div>
  )
}
