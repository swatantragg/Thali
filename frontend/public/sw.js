// Bumped to v2: drops all API caching. The previous version fell back to a
// cached /api/ response on network failure, which could replay one user's
// personal data to another on a shared device. We now NEVER touch /api/.
const CACHE = 'thali-v2';
const PRECACHE = ['/', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Let the app force-clear the cache (e.g. on logout / session expiry).
self.addEventListener('message', e => {
  if (e.data === 'clear-cache') {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never cache or serve API traffic from the SW — always go to the network.
  // Authenticated, user-specific data must never be persisted on the device.
  if (url.pathname.startsWith('/api/')) return;

  // Only handle same-origin static assets; let everything else pass through.
  if (url.origin !== self.location.origin) return;

  // Cache-first for static shell/assets.
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
