'use client'
import { useEffect } from 'react'

const KEY = 'kickoff_tracked_at'
const TTL = 5 * 60 * 1000 // 5 minutes

export default function ActivityTracker({ userId }) {
  useEffect(() => {
    if (!userId) return

    function track() {
      const last = parseInt(localStorage.getItem(KEY) ?? '0')
      if (Date.now() - last < TTL) return
      localStorage.setItem(KEY, Date.now().toString())
      const standalone = window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone
      fetch('/api/track-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standalone }),
      }).catch(() => {})
    }

    track()

    function onVisible() {
      if (document.visibilityState === 'visible') track()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(track, TTL)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [userId])

  return null
}
