'use client'
import { useRouter, usePathname } from 'next/navigation'

export default function TournamentFilter({ tournaments, current }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <select
      value={current}
      onChange={e => router.push(`${pathname}?tournament=${e.target.value}`)}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
    >
      <option value="all">Всі турніри</option>
      {tournaments.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )
}
