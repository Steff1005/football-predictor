'use client'
import { confirmLeave } from '../../../lib/unsaved-guard'

const TABS = [
  { id: 'matches',   label: 'Матчі',           short: 'Матчі' },
  { id: 'preds',     label: 'Результати',       short: 'Результати' },
  { id: 'standings', label: 'Турнірна таблиця', short: 'Таблиця' },
  { id: 'rounds',    label: 'По турах',         short: 'Тури' },
]

export default function TournamentTabs({ id, activeTab }) {
  return (
    <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none">
      {TABS.map(t => (
        <a key={t.id} href={`/tournaments/${id}?tab=${t.id}`}
          onClick={e => {
            if (!confirmLeave('Є незбережений прогноз. Перейти на іншу вкладку?')) {
              e.preventDefault()
            }
          }}
          className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
            activeTab === t.id
              ? 'bg-green-500 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}>
          <span className="sm:hidden">{t.short}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </a>
      ))}
    </div>
  )
}
