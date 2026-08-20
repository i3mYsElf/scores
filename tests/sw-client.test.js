/* Tests de sw-client.js — la moitié client du protocole de mise à jour, en
   miroir de tests/sw.test.js (la moitié SW) : enregistrement, bannière
   « Recharger » qui envoie SKIP_WAITING, rechargement unique sur
   controllerchange. Rejoué en jsdom avec un faux navigator.serviceWorker.
   location.reload est inforgeable en jsdom : le script est évalué avec un
   location d'emprunt passé en paramètre pour compter les rechargements. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const {read} = require('./helpers.js');

const SRC = read('sw-client.js');
const tick = () => new Promise(r => setImmediate(r)); // laisse register().then(...) se résoudre

/* faux worker (reg.installing / reg.waiting) */
function fakeWorker(){
  const listeners = {};
  return {
    state: 'installing',
    posted: [],
    postMessage(m){ this.posted.push(m); },
    addEventListener(t, fn){ (listeners[t] = listeners[t] || []).push(fn); },
    fire(t){ (listeners[t] || []).forEach(fn => fn()); }
  };
}

/* faux navigator.serviceWorker + registration */
function fakeSW({controller = null, waiting = null} = {}){
  const swListeners = {}, regListeners = {};
  const reg = {
    waiting, installing: null,
    addEventListener(t, fn){ (regListeners[t] = regListeners[t] || []).push(fn); },
    fire(t){ (regListeners[t] || []).forEach(fn => fn()); }
  };
  const sw = {
    controller,
    registered: [],
    register(url, opts){ this.registered.push([url, opts]); return Promise.resolve(reg); },
    addEventListener(t, fn){ (swListeners[t] = swListeners[t] || []).push(fn); },
    fire(t){ (swListeners[t] || []).forEach(fn => fn()); }
  };
  return {sw, reg};
}

async function load(sw, storage){
  const dom = new JSDOM('<!doctype html><html lang="fr"><body></body></html>',
    {url: 'http://localhost/', runScripts: 'outside-only'});
  const w = dom.window;
  w.__reloads = 0;
  if (sw) Object.defineProperty(w.navigator, 'serviceWorker', {value: sw, configurable: true});
  if (storage) Object.defineProperty(w.navigator, 'storage', {value: storage, configurable: true});
  w.eval(`(function(location){\n${SRC}\n})({reload(){ window.__reloads++; }})`);
  /* attendre le load naturel de jsdom (en émettre un second doublerait les
     listeners du script) ; s'il est déjà passé, le rejouer une fois */
  await new Promise(r => {
    if (w.document.readyState === 'complete'){ w.dispatchEvent(new w.Event('load')); r(); }
    else w.addEventListener('load', r);
  });
  await tick();
  return w;
}

const banner = w => w.document.getElementById('swUpdate');
const clickReload = w => w.document.getElementById('swReload')
  .dispatchEvent(new w.MouseEvent('click', {bubbles: true}));

test('sw-client : storage.persist demandé, SW enregistré sans cache HTTP', async () => {
  let persisted = 0;
  const {sw} = fakeSW();
  const w = await load(sw, {persist(){ persisted++; return Promise.resolve(true); }});
  assert.equal(persisted, 1);
  // pas de deepEqual : l'objet d'options vient du realm jsdom (autre prototype)
  assert.equal(sw.registered.length, 1);
  assert.equal(sw.registered[0][0], 'sw.js');
  assert.equal(sw.registered[0][1].updateViaCache, 'none');
  assert.equal(banner(w), null); // rien en attente : pas de bannière
});

test('sw-client : première installation -> pas de bannière (rien à mettre à jour)', async () => {
  const {sw, reg} = fakeSW(); // controller null = aucun SW ne contrôle encore la page
  const w = await load(sw);
  const worker = fakeWorker();
  reg.installing = worker;
  reg.fire('updatefound');
  worker.state = 'installed'; reg.waiting = worker;
  worker.fire('statechange');
  assert.equal(banner(w), null);
});

test('sw-client : nouvelle version installée -> bannière unique, Recharger envoie SKIP_WAITING', async () => {
  const {sw, reg} = fakeSW({controller: {}});
  const w = await load(sw);
  const worker = fakeWorker();
  reg.installing = worker;
  reg.fire('updatefound');
  worker.state = 'installed'; reg.waiting = worker;
  worker.fire('statechange');
  assert.ok(banner(w), 'bannière attendue');
  worker.fire('statechange'); // changement d’état suivant : pas de seconde bannière
  assert.equal(w.document.querySelectorAll('#swUpdate').length, 1);
  clickReload(w);
  assert.deepEqual(worker.posted, ['SKIP_WAITING']); // l’activation vient de l’utilisateur
  assert.equal(w.__reloads, 0); // pas de rechargement avant controllerchange
});

test('sw-client : version en attente d’une visite précédente -> bannière immédiate', async () => {
  const worker = fakeWorker();
  const {sw} = fakeSW({controller: {}, waiting: worker});
  const w = await load(sw);
  assert.ok(banner(w));
  clickReload(w);
  assert.deepEqual(worker.posted, ['SKIP_WAITING']);
});

test('sw-client : controllerchange recharge une seule fois (anti-boucle)', async () => {
  const {sw} = fakeSW({controller: {}});
  const w = await load(sw);
  sw.fire('controllerchange');
  sw.fire('controllerchange'); // un second changement ne doit pas boucler
  assert.equal(w.__reloads, 1);
});

test('sw-client : première installation (claim) ne recharge pas la page', async () => {
  const {sw} = fakeSW(); // controller null : la page n'était pas contrôlée
  const w = await load(sw);
  sw.fire('controllerchange'); // clients.claim() du tout premier SW
  assert.equal(w.__reloads, 0); // pas de flash de rechargement à la première visite
  sw.fire('controllerchange'); // vraie mise à jour ensuite : rechargement normal
  assert.equal(w.__reloads, 1);
});

test('sw-client : retour au premier plan -> vérification de mise à jour', async () => {
  const {sw, reg} = fakeSW({controller: {}});
  reg.updates = 0;
  reg.update = function(){ this.updates++; return Promise.resolve(); };
  const w = await load(sw);
  // jsdom répond 'prerender' : simuler une page réellement visible
  Object.defineProperty(w.document, 'visibilityState', {value: 'visible', configurable: true});
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(reg.updates, 1); // une PWA laissée ouverte revoit la bannière un jour
});

test('sw-client : updatefound sans installing, clic sans waiting -> pas de crash', async () => {
  const {sw, reg} = fakeSW({controller: {}, waiting: fakeWorker()});
  const w = await load(sw);
  reg.waiting = null;      // la version en attente a disparu entre-temps
  clickReload(w);          // le clic ne poste rien et ne plante pas
  reg.fire('updatefound'); // installing null : ignoré
  assert.ok(banner(w));
});
