const CACHE_STATIC = 'kickoff-static-v4'
const CACHE_PAGES  = 'kickoff-pages-v1'
const CACHE_API    = 'kickoff-api-v1'
const KNOWN_CACHES = new Set([CACHE_STATIC, CACHE_PAGES, CACHE_API])

// Pre-cache at install: offline fallback + app icons
const PRECACHE = [
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(c => c.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !KNOWN_CACHES.has(k)).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  // Never intercept cross-origin
  if (url.origin !== self.location.origin) return

  // /api/live-scores — stale-while-revalidate (serve cached, refresh in background)
  if (url.pathname.startsWith('/api/live-scores')) {
    event.respondWith(
      caches.open(CACHE_API).then(async cache => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request).then(res => {
          if (res.ok) cache.put(event.request, res.clone())
          return res
        }).catch(() => null)
        if (cached) {
          event.waitUntil(networkFetch)
          return cached
        }
        return await networkFetch || Response.error()
      })
    )
    return
  }

  // Skip all other API routes
  if (url.pathname.startsWith('/api/')) return

  // _next/static: cache-first forever (content-hashed filenames, safe to cache indefinitely)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(event.request, res.clone()))
          return res
        })
      )
    )
    return
  }

  // Icons and static images: cache-first, revalidate in background
  if (url.pathname.startsWith('/icons/') || /\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(res => {
          if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(event.request, res.clone()))
          return res
        })
        return cached || network
      })
    )
    return
  }

  // Navigation (HTML pages): network-first; on failure serve cached page or /offline.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Cache tournament and standings pages for offline browsing (stale-while-revalidate)
          if (res.ok && (
            url.pathname.startsWith('/tournaments') ||
            url.pathname === '/' ||
            url.pathname === '/hall-of-fame'
          )) {
            caches.open(CACHE_PAGES).then(c => c.put(event.request, res.clone()))
          }
          return res
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          return cached || caches.match('/offline.html')
        })
    )
    return
  }
})

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { return }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Kickoff', {
      body: data.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: { url: data.url ?? '/tournaments' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/tournaments'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const existing = cls.find(c => c.url.includes(url) && 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
