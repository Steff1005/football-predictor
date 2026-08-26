'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SLOTS, SLOT_KEYS } from '@/lib/season-2026'

function Select({ slot, value, onChange, teams, taken, posLabel }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
        {posLabel ? `${posLabel} · ` : ''}{slot.label}
      </span>
      <select
        value={value ?? ''}
        onChange={e => onChange(slot.key, e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <option value="">— обрати команду —</option>
        {teams.map(t => (
          // Команда, вже зайнята в іншому місці таблиці, лишається видимою, але недоступною
          <option key={t.id} value={t.id} disabled={taken.has(t.id) && t.id !== value}>
            {t.name}{taken.has(t.id) && t.id !== value ? ' (вже обрана)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function SeasonPredictionForm({ league, relPos }) {
  const router = useRouter()
  const [values, setValues] = useState(Object.fromEntries(SLOT_KEYS.map(k => [k, null])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  function set(key, val) {
    setValues(v => ({ ...v, [key]: val }))
    setError(null)
  }

  // Топ-4 і виліт не можуть перетинатися; сюрпризи — вільні (це окрема номінація)
  const tableKeys = SLOT_KEYS.filter(k => !k.startsWith('positive') && !k.startsWith('negative'))
  const takenTable = useMemo(
    () => new Set(tableKeys.map(k => values[k]).filter(Boolean)),
    [values] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const filled = SLOT_KEYS.filter(k => values[k]).length
  const complete = filled === SLOT_KEYS.length

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/season-predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_code: league.code, ...values }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Не вдалося зберегти')
      router.refresh()
    } catch (e) {
      setError(e.message)
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  const posLabelFor = slot =>
    slot.group === 'rel' ? String(relPos[slot.relIdx]) : slot.group === 'top' ? null : null

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <strong>Прогноз зберігається один раз.</strong> Після збереження картка стає незмінною —
          редагувати чи видалити її не можна. Перевір усе перед збереженням.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🏆 Топ-4</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {SLOTS.filter(s => s.group === 'top').map(s => (
            <Select key={s.key} slot={s} value={values[s.key]} onChange={set}
              teams={league.teams} taken={takenTable} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">🔻 Три останні місця</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {SLOTS.filter(s => s.group === 'rel').map(s => (
            <Select key={s.key} slot={s} value={values[s.key]} onChange={set}
              teams={league.teams} taken={takenTable} posLabel={posLabelFor(s)} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">✨ Сюрпризи сезону</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {SLOTS.filter(s => s.group === 'surp').map(s => (
            <Select key={s.key} slot={s} value={values[s.key]} onChange={set}
              teams={league.teams} taken={new Set()} />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={!complete}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
        >
          {complete ? 'Зберегти прогноз' : `Заповнено ${filled} з ${SLOT_KEYS.length}`}
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-900 dark:text-white font-semibold mb-3">
            Зберегти назавжди? Змінити прогноз потім буде неможливо.
          </p>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white font-semibold text-sm transition-colors">
              {saving ? 'Зберігаємо…' : 'Так, зберегти'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={saving}
              className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Назад
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
