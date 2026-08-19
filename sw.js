const VERSION = 'dev'; // remplacé par le SHA du commit au déploiement (voir ci.yml)
const CACHE = 'scores-' + VERSION;
const PRECACHE = [
  '.',
  'harmonies.html',
  '7wonders.html',
  'wonderfulworld.html',
  'agricola.html',
  'cascadia.html',
  'terraformingmars.html',
  'seasaltpaper.html',
  'kingdomino.html',
  'queendomino.html',
  '7wondersduel.html',
  'skyjo.html',
  'history.html',
  'common.css',
  'common.js',
  'sw-client.js',
  'theme.js',
  'lib/registry.js',
  'lib/backup.js',
  'lib/stats.js',
  'lib/domino.js',
  'lib/manches.js',
  'games/harmonies.js',
  'games/7wonders.js',
  'games/wonderfulworld.js',
  'games/agricola.js',
  'games/cascadia.js',
  'games/terraformingmars.js',
  'games/seasaltpaper.js',
  'games/kingdomino.js',
  'games/queendomino.js',
  'games/7wondersduel.js',
  'games/skyjo.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
});

// La nouvelle version attend le feu vert de l'utilisateur (bannière « Recharger »
// de sw-client.js) : un skipWaiting automatique mélangerait l'ancien HTML déjà
// affiché avec les assets de la nouvelle version en pleine partie.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
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

  // Cache d'abord, mise à jour en arrière-plan. Le waitUntil est crucial sur iOS :
  // WebKit tue le SW dès la réponse rendue, sans lui la mise à jour n'aboutit jamais.
  const staleWhileRevalidate = () =>
    caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request);
      // type 'opaque' : réponse cross-origin sans CORS (status masqué, r.ok faux) —
      // le cas de la CSS Google Fonts chargée sans crossorigin par d'anciennes pages ;
      // on la met en cache quand même, sinon les polices ne sont jamais dispo offline.
      const net = fetch(e.request)
        .then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; })
        .catch(() => hit);
      if (hit) { e.waitUntil(net.then(() => {}, () => {})); return hit; }
      return net;
    });

  // Polices Google (dispo offline après la 1re visite)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate());
    return;
  }

  if (url.origin !== location.origin) return;

  // Navigations : réseau d'abord (toujours frais en ligne), cache en secours (offline)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        try {
          const r = await fetch(e.request);
          if (r.ok) c.put(e.request, r.clone());
          return r;
        } catch (err) {
          return (await c.match(e.request, { ignoreSearch: true })) || c.match('.');
        }
      })
    );
    return;
  }

  // Assets même origine : cache d'abord, mise à jour en arrière-plan
  e.respondWith(staleWhileRevalidate());
});
