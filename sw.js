// sw.js — auto-update friendly
const RUNTIME = 'habit-mini-runtime-v1';

self.addEventListener('install', (event) => {
  // Activate immediately on install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== RUNTIME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for HTML (navigation) so updates appear without bumps.
// Stale-while-revalidate for everything else.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const accept = req.headers.get('accept') || '';

  // Treat navigations/HTML as network-first
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(RUNTIME).then(c => c.put('offline.html', copy)).catch(() => {});
          return resp;
        })
        .catch(async () => (await caches.match('offline.html')) || caches.match('/index.html'))
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(networkResp => {
        caches.open(RUNTIME).then(c => c.put(req, networkResp.clone())).catch(() => {});
        return networkResp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
