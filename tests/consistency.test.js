/* Vérifie la cohérence de la structure multi-jeux, avec lib/registry.js comme
   source de vérité : chaque jeu du registre doit avoir sa logique dans games/,
   sa page, être précaché par le SW, listé sur l'accueil, et utiliser la clé
   localStorage attendue. Attrape les oublis de la recette « ajouter un jeu ». */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const {GAMES, gameKey, gamePage, HISTORY_KEY} = require('../lib/registry.js');

const precache = [...read('sw.js')
  .match(/PRECACHE = \[([^\]]*)\]/s)[1]
  .matchAll(/'([^']+)'/g)].map(m => m[1]);

const index = read('index.html');

test('au moins un jeu existe', () => {
  assert.ok(GAMES.length >= 3);
});

test('le registre et games/ coïncident exactement', () => {
  const onDisk = fs.readdirSync(path.join(ROOT, 'games'))
    .filter(f => f.endsWith('.js'))
    .map(f => path.basename(f, '.js'))
    .sort();
  const registered = GAMES.map(g => g.slug).sort();
  assert.deepEqual(onDisk, registered,
    'games/*.js et lib/registry.js doivent lister les mêmes jeux');
});

for (const {slug, name, subtitle, rules} of GAMES) {
  test(`${slug} : page présente et branchée partout`, () => {
    assert.ok(name && subtitle, `${slug} : name et subtitle requis dans le registre`);
    assert.match(rules || '', /^https:\/\//, `${slug} : URL de règles (https) requise dans le registre`);
    const page = gamePage(slug);
    assert.ok(fs.existsSync(path.join(ROOT, page)), `${page} manquant`);
    const html = read(page);
    assert.ok(html.includes(`games/${slug}.js`), `${page} ne charge pas games/${slug}.js`);
    assert.ok(html.includes('src="lib/registry.js"'), `${page} ne charge pas lib/registry.js`);
    assert.ok(html.indexOf('lib/registry.js') < html.indexOf('src="common.js"'),
      `${page} : lib/registry.js doit être chargé avant common.js`);
    assert.ok(html.includes(`'${gameKey(slug)}'`), `${page} n'utilise pas la clé ${gameKey(slug)}`);
    assert.ok(precache.includes(page), `${page} absent du PRECACHE de sw.js`);
    assert.ok(precache.includes(`games/${slug}.js`), `games/${slug}.js absent du PRECACHE de sw.js`);
    assert.ok(index.includes(`href="${page}"`), `${page} absent du menu index.html`);
    assert.ok(index.includes(`data-sub="${slug}"`), `aperçu data-sub="${slug}" absent de index.html`);
  });
}

test('la version du SW committée reste "dev" (stampée au déploiement)', () => {
  assert.ok(read('sw.js').includes("const VERSION = 'dev'"),
    "sw.js doit garder VERSION = 'dev' — le SHA est injecté par la CI au déploiement");
});

test('les fichiers communs sont précachés', () => {
  for (const f of ['.', 'common.css', 'common.js', 'sw-client.js', 'manifest.json', 'lib/registry.js', 'lib/backup.js', 'lib/stats.js', 'history.html']) {
    assert.ok(precache.includes(f), `${f} absent du PRECACHE`);
  }
});

/* Le sens inverse : une entrée du PRECACHE qui n'existe plus sur le disque fait
   échouer caches.addAll (tout-ou-rien) et donc l'installation entière du SW,
   silencieusement — le site ne se mettrait plus à jour offline. */
test('chaque entrée du PRECACHE existe sur le disque', () => {
  for (const f of precache) {
    assert.ok(fs.existsSync(path.join(ROOT, f === '.' ? 'index.html' : f)),
      `${f} précaché mais absent du disque`);
  }
});

test('toutes les pages ont lang="fr" et chargent sw-client.js', () => {
  for (const f of ['index.html', 'history.html', ...GAMES.map(g => gamePage(g.slug))]) {
    const html = read(f);
    assert.ok(html.includes('<html lang="fr">'), `${f} : <html lang="fr"> manquant`);
    assert.ok(html.includes('src="sw-client.js"'), `${f} ne charge pas sw-client.js`);
    assert.ok(html.includes('rel="stylesheet" crossorigin'),
      `${f} : la CSS Google Fonts doit être chargée avec crossorigin (cache offline du SW)`);
  }
});

test('la clé d\'historique du registre est celle qu\'écrit common.js', () => {
  assert.ok(read('common.js').includes(`'${HISTORY_KEY}'`),
    `common.js n'archive pas sous ${HISTORY_KEY}`);
});

test('les raccourcis du manifest couvrent les jeux et pointent vers des pages existantes', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const urls = (manifest.shortcuts || []).map(s => s.url);
  for (const s of manifest.shortcuts || []) {
    assert.ok(fs.existsSync(path.join(ROOT, s.url)), `shortcut ${s.url} sans page`);
  }
  for (const {slug} of GAMES) {
    assert.ok(urls.includes(gamePage(slug)), `pas de shortcut manifest pour ${slug}`);
  }
});
