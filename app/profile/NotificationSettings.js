'use client'
import { useState, useEffect, useRef } from 'react'
import { Bell, ChevronDown } from 'lucide-react'
import { useToast } from '../../components/ToastProvider'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

export default function NotificationSettings({ initialPrefs }) {
  const toast = useToast()
  const [isOpen, setIsOpen]       = useState(false)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [prefs, setPrefs]         = useState({
    notify_results: initialPrefs?.notify_results ?? true,
    notify_reminder: initialPrefs?.notify_reminder ?? true,
  })
  const subRef = useRef(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    setPermission(Notification.permission)
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        subRef.current = sub
        setSubscribed(!!sub)
      })
    })
  }, [])

  async function handleTogglePush(enable) {
    setLoading(true)
    try {
      if (enable) {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        })
        subRef.current = sub
        setPermission(Notification.permission)
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        })
        setSubscribed(true)
        toast('✅ Push-сповіщення увімкнено')
      } else {
        const sub = subRef.current || (await (await navigator.serviceWorker.ready).pushManager.getSubscription())
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
          subRef.current = null
        }
        setSubscribed(false)
        toast('Сповіщення вимкнено')
      }
    } catch (err) {
      toast('Помилка: ' + (err.message ?? 'невідома'), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handlePrefChange(key, value) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    await fetch('/api/push/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
  }

  if (!supported) return null

  const denied = permission === 'denied'

  return (
    <div>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <Bell size={12} />
        <span>Сповіщення</span>
        <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 space-y-4">

          {denied ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Сповіщення заблоковані в браузері. Дозвольте їх у налаштуваннях сайту і поверніться сюди.
            </p>
          ) : (
            <>
              {/* Master toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Push-сповіщення</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {subscribed ? 'Увімкнено на цьому пристрої' : 'Вимкнено на цьому пристрої'}
                  </p>
                </div>
                <Toggle checked={subscribed} onChange={handleTogglePush} disabled={loading} />
              </div>

              {/* Per-type settings — only shown when subscribed */}
              {subscribed && (
                <div className="space-y-3 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">Результати матчів</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Після підрахунку очок</p>
                    </div>
                    <Toggle
                      checked={prefs.notify_results}
                      onChange={v => handlePrefChange('notify_results', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">Нагадування перед матчем</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">За 1 год, якщо немає прогнозу</p>
                    </div>
                    <Toggle
                      checked={prefs.notify_reminder}
                      onChange={v => handlePrefChange('notify_reminder', v)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
