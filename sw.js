// sw.js — auto-update friendly (no manual cache bumping)
// Strategy:
//  • Network-first for navigations/HTML so new releases show up next launch.
//  • Stale-while-revalidate for all other requests.
//  • Cache a copy of index.html as an offline fallback.

const RUNTIME = 'habit-mini-runtime-v1';

self.addEventListener('install', (event) => {
  // Activate the new worker immediately
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // only cache GETs

  const accept = req.headers.get('accept') || '';

  // --- Network-first for navigations/HTML ---
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Keep a fresh offline copy of index.html
          const indexURL = new URL('index.html', self.registration.scope);
          const copy = resp.clone();
          caches.open(RUNTIME).then(c => c.put(indexURL, copy)).catch(() => {});
          return resp;
        })
        .catch(async () => {
          // Offline fallback to cached index.html
          const indexURL = new URL('index.html', self.registration.scope);
          const cached = await caches.match(indexURL);
          return (
            cached ||
            new Response('<!doctype html><title>Offline</title><h1>Offline</h1>', {
              headers: { 'Content-Type': 'text/html' }
            })
          );
        })
    );
    return;
  }

  // --- Stale-while-revalidate for everything else ---
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkResp) => {
          caches.open(RUNTIME).then(c => c.put(req, networkResp.clone())).catch(() => {});
          return networkResp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

