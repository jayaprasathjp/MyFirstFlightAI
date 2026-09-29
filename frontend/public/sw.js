// Offline support: network first, cached copy when offline, so the app and the I'm Lost card open without
// internet. Only same-origin GETs are cached; API calls go to the backend origin and are never cached here
// (the trip itself is kept in localStorage).
const CACHE = 'mff-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  )
})
