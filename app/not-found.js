import Link from 'next/link'

export const metadata = { title: '404 — Kickoff' }

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-7xl font-black text-gray-200 dark:text-gray-800 mb-2 select-none">404</p>
      <p className="text-5xl mb-6">🔍</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Сторінку не знайдено</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
        Можливо, посилання застаріло або сторінка була переміщена.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-xl font-medium transition-colors"
      >
        На головну
      </Link>
    </div>
  )
}
