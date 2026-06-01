'use client'
import { useState, useEffect, useRef } from 'react'

const DISMISS_KEY = 'kickoff_install_dismissed'
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

export default function InstallPrompt({ userId }) {
  const [show, setShow]   = useState(false)
  const [ios, setIos]     = useState(false)
  const promptRef         = useRef(null)

  useEffect(() => {
    if (!userId) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (window.navigator.standalone) return   // iOS already installed

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return

    const onIOS = isIOS()

    if (onIOS) {
      // iOS Safari has no beforeinstallprompt — show manual instructions after delay
      setIos(true)
      setTimeout(() => setShow(true), 4000)
      return
    }

    // Android/Chrome: event was captured globally before React mounted
    if (window.__installPrompt) {
      promptRef.current = window.__installPrompt
      setTimeout(() => setShow(true), 3000)
      return
    }

    // Fallback: event might still fire (rare)
    const handler = e => {
      e.preventDefault()
      promptRef.current = e
      window.__installPrompt = e
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

        {ios ? (
          /* iOS: manual instructions */
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-lg leading-none mt-px">1.</span>
              <span>Натисни <strong className="text-gray-800 dark:text-gray-200">Поділитися</strong> <span className="text-base">⎙</span> внизу Safari</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg leading-none mt-px">2.</span>
              <span>Обери <strong className="text-gray-800 dark:text-gray-200">«На екран «Додому»»</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-lg leading-none mt-px">3.</span>
              <span>Натисни <strong className="text-gray-800 dark:text-gray-200">Додати</strong> — і готово!</span>
            </li>
          </ol>
        ) : (
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 mb-5">
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Швидкий запуск з іконки</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Сповіщення про результати</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Без браузерної панелі</li>
          </ul>
        )}

        <div className="flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Зрозуміло
          </button>
          {!ios && (
            <button
              onClick={install}
              className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-colors"
            >
              Встановити
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
