'use client'
import { useState, useEffect, useRef } from 'react'

const DISMISS_KEY = 'kickoff_install_dismissed'
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000

export default function InstallPrompt({ userId }) {
  const [show, setShow]   = useState(false)
  const promptRef         = useRef(null)

  useEffect(() => {
    if (!userId) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (window.navigator.standalone) return

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return

    const handler = e => {
      e.preventDefault()
      promptRef.current = e
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [userId])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  async function install() {
    if (!promptRef.current) return
    promptRef.current.prompt()
    const { outcome } = await promptRef.current.userChoice
    if (outcome === 'accepted') setShow(false)
    else dismiss()
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center" onClick={dismiss}>
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-4">
          <img src="/icons/icon-96x96.png" alt="" className="w-14 h-14 rounded-2xl flex-shrink-0" />
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-base">Встановити Kickoff</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Як справжній додаток на телефон</p>
          </div>
        </div>

        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 mb-5">
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Швидкий запуск з іконки</li>
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Сповіщення про результати</li>
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Працює без браузерної панелі</li>
        </ul>

        <div className="flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Пізніше
          </button>
          <button
            onClick={install}
            className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-colors"
          >
            Встановити
          </button>
        </div>
      </div>
    </div>
  )
}
