'use client'
import { useEffect } from 'react'

export default function Error({ error, unstable_retry }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-6xl mb-6">⚠️</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Щось пішло не так</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
        Сталася непередбачена помилка. Спробуй ще раз або повернись на головну.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => unstable_retry()}
          className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-xl font-medium transition-colors"
        >
          Спробувати знову
        </button>
        <a
          href="/"
          className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
        >
          На головну
        </a>
      </div>
    </div>
  )
}
