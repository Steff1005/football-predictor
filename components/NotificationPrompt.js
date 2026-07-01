'use client'
import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'

const DISMISS_KEY = 'kickoff_push_dismissed'
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000
const NEVER_KEY   = 'kickoff_push_never'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function NotificationPrompt({ userId }) {
  const [show, setShow]       = useState(false)
  const [denied, setDenied]   = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (localStorage.getItem(NEVER_KEY)) return
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return

    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (sub) return // already subscribed on this device — nothing to prompt
        if (Notification.permission === 'denied') setDenied(true)
        setTimeout(() => setShow(true), 2500)
      })
      .catch(() => {})
  }, [userId])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  function never() {
    localStorage.setItem(NEVER_KEY, '1')
    setShow(false)
  }

  async function enable() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      setShow(false)
    } catch {
      if (Notification.permission === 'denied') setDenied(true)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center bg-black/40" onClick={dismiss}>
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <Bell size={26} className="text-green-500" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-base">Не пропускай матчі</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Увімкни сповіщення на цьому пристрої</p>
          </div>
        </div>

        {denied ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-5">
            Сповіщення заблоковані в браузері. Відкрий налаштування сайту, дозволь сповіщення — і повернися сюди.
          </p>
        ) : (
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 mb-5">
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Нагадування за 30 хв до матчу</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Результати щойно підрахують очки</li>
            <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Один клік — і готово</li>
          </ul>
        )}

        <div className="flex flex-col gap-2.5">
          {!denied && (
            <button
              onClick={enable}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {loading ? 'Вмикаємо…' : '🔔 Увімкнути сповіщення'}
            </button>
          )}
          <button
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Продовжити без сповіщень
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            onClick={never}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors underline underline-offset-2"
          >
            Більше не показувати
          </button>
        </div>
      </div>
    </div>
  )
}
