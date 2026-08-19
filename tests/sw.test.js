/* Tests comportementaux de sw.js : les stratégies de cache (précache atomique,
   network-first pour les navigations, stale-while-revalidate, polices Google),
   l'activation sur demande (SKIP_WAITING) et la purge des vieux caches — dans
   un bac à sable Node qui rejoue les événements du service worker. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {read} = require('./helpers.js');

const SRC = read('sw.js');
const SCOPE = 'https://example.test/scores/';

/* Charge sw.js avec self/caches/location/fetch factices.
   Le stub de Cache stocke par URL absolue (comme le vrai Cache résout les
   chemins relatifs contre le scope) et ignore toujours la query — le seul
   usage d'ignoreSearch dans sw.js. */
function loadSW(){
  const norm = u => {
    const href = new URL(typeof u === 'string' ? u : u.url, SCOPE).href;
    return href.split('?')[0];
  };
  const stores = new Map(); // nom de cache -> Map(url -> response)
  const cacheFor = name => {
    if(!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      addAll: async urls => { for(const u of urls) m.set(norm(u), {ok: true, precached: u}); },
      match: async req => m.get(norm(req)),
      put: async (req, r) => { m.set(norm(req), r); },
    };
  };
  const caches = {
    open: async name => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
  const listeners = {};
  const self = {
    addEventListener: (t, f) => { listeners[t] = f; },
    skipWaiting: () => { self.skipped = true; },
    clients: {claim: () => { self.claimed = true; }},
    skipped: false, claimed: false,
  };
  const sandbox = {fetch: async () => { throw new Error('réseau non stubbé'); }};
  new Function('self', 'caches', 'location', 'fetch', SRC)(
    self, caches, new URL(SCOPE), (...a) => sandbox.fetch(...a));
  return {self, listeners, stores, sandbox, norm};
}

async function install(sw){
  const e = {waitUntil(p){ this.p = p; }};
  sw.listeners.install(e);
  await e.p;
}

async function dispatchFetch(sw, request){
  const e = {
    request,
    response: undefined,
    waited: [],
    respondWith(p){ this.response = p; },
    waitUntil(p){ this.waited.push(p); },
  };
  sw.listeners.fetch(e);
  const r = e.response === undefined ? undefined : await e.response;
  await Promise.allSettled(e.waited);
  return r;
}

const req = (url, mode = 'no-cors', method = 'GET') => ({url, mode, method});
const netResponse = extra => ({ok: true, type: 'basic', clone(){ return this; }, ...extra});

test('sw : install précache tout, sans skipWaiting ; SKIP_WAITING l\'active', async () => {
  const sw = loadSW();
  await install(sw);
  const cache = sw.stores.get('scores-dev');
  assert.ok(cache.size >= 30, `précache trop petit (${cache.size})`);
  assert.ok(cache.has(SCOPE), 'la racine (« . ») doit être précachée');
  assert.ok(!sw.self.skipped, 'pas de skipWaiting automatique à l\'install');
  sw.listeners.message({data: 'SKIP_WAITING'});
  assert.ok(sw.self.skipped);
  sw.listeners.message({data: 'autre chose'});
});

test('sw : activate purge les caches des anciennes versions et prend le contrôle', async () => {
  const sw = loadSW();
  sw.stores.set('scores-vieux', new Map());
  await install(sw);
  const e = {waitUntil(p){ this.p = p; }};
  sw.listeners.activate(e);
  await e.p;
  assert.ok(!sw.stores.has('scores-vieux'));
  assert.ok(sw.stores.has('scores-dev'));
  assert.ok(sw.self.claimed);
});

test('sw : navigation en ligne = réseau d\'abord, réponse mise en cache', async () => {
  const sw = loadSW();
  await install(sw);
  const net = netResponse({marker: 'frais'});
  sw.sandbox.fetch = async () => net;
  const r = await dispatchFetch(sw, req(SCOPE + 'harmonies.html', 'navigate'));
  assert.equal(r, net);
  assert.equal(sw.stores.get('scores-dev').get(SCOPE + 'harmonies.html'), net);
});

test('sw : navigation hors-ligne = cache, page inconnue = accueil', async () => {
  const sw = loadSW();
  await install(sw);
  sw.sandbox.fetch = async () => { throw new Error('offline'); };
  const page = await dispatchFetch(sw, req(SCOPE + 'harmonies.html?src=shortcut', 'navigate'));
  assert.equal(page.precached, 'harmonies.html'); // servie du précache, query ignorée
  const inconnue = await dispatchFetch(sw, req(SCOPE + 'nexistepas.html', 'navigate'));
  assert.equal(inconnue.precached, '.'); // secours : la racine
});

test('sw : polices Google — la CSS opaque est mise en cache puis servie hors-ligne', async () => {
  const sw = loadSW();
  await install(sw);
  const url = 'https://fonts.googleapis.com/css2?family=Anton';
  // 1re visite : réponse opaque (link sans crossorigin d'une vieille page en cache)
  const opaque = {ok: false, type: 'opaque', clone(){ return this; }};
  sw.sandbox.fetch = async () => opaque;
  assert.equal(await dispatchFetch(sw, req(url, 'no-cors')), opaque);
  // hors-ligne ensuite : servie depuis le cache malgré r.ok === false
  sw.sandbox.fetch = async () => { throw new Error('offline'); };
  assert.equal(await dispatchFetch(sw, req(url, 'no-cors')), opaque);
});

test('sw : asset même origine en stale-while-revalidate', async () => {
  const sw = loadSW();
  await install(sw);
  // déjà précaché : le hit est servi, le réseau tourne en arrière-plan (waitUntil)
  const frais = netResponse({marker: 'v2'});
  sw.sandbox.fetch = async () => frais;
  const r = await dispatchFetch(sw, req(SCOPE + 'common.css'));
  assert.equal(r.precached, 'common.css');
  // la version fraîche a remplacé le hit pour la prochaine fois
  assert.equal(sw.stores.get('scores-dev').get(SCOPE + 'common.css'), frais);
});

test('sw : non-GET et cross-origin hors polices passent au réseau sans interception', async () => {
  const sw = loadSW();
  await install(sw);
  sw.sandbox.fetch = async () => { throw new Error('ne doit pas être appelé par le SW'); };
  assert.equal(await dispatchFetch(sw, req(SCOPE, 'no-cors', 'POST')), undefined);
  assert.equal(await dispatchFetch(sw, req('https://autre.example/x.js')), undefined);
});
