const CACHE = 'harmonies-v1';
const PRECACHE = [
  '.',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Polices Google : cache d'abord, mise à jour en arrière-plan (dispo offline après la 1re visite)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        const net = fetch(e.request)
          .then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })
          .catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Même origine : cache d'abord, mise à jour en arrière-plan, fallback sur l'index en navigation
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const isNav = e.request.mode === 'navigate';
        const hit = await c.match(e.request, { ignoreSearch: isNav });
        const net = fetch(e.request)
          .then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })
          .catch(() => hit || (isNav ? c.match('.') : undefined));
        return hit || net;
      })
    );
  }
});
