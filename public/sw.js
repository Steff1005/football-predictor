const CACHE = 'predictor-v2'

// Only cache genuinely static shell assets (icons). HTML is never cached —
// it changes with every deployment and stale HTML breaks CSS chunk references.
const STATIC_SHELL = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // Never intercept Next.js internals or API routes
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) return

  // Navigation requests (HTML pages): always network-first.
  // Stale HTML causes CSS/JS hash mismatches after deployment → broken styles.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  // Static assets (icons etc.): cache-first, update in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()))
        }
        return response
      })
      return cached || network
    })
  )
})
