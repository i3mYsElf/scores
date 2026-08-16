/* Vérifie la cohérence de la structure multi-jeux, avec games/registry.js comme
   source de vérité : chaque jeu du registre doit avoir sa logique dans games/,
   sa page, être précaché par le SW, listé sur l'accueil, et utiliser la clé
   localStorage attendue. Attrape les oublis de la recette « ajouter un jeu ». */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const {GAMES, gameKey, gamePage, HISTORY_KEY} = require('../games/registry.js');

const precache = [...read('sw.js')
  .match(/PRECACHE = \[([^\]]*)\]/s)[1]
  .matchAll(/'([^']+)'/g)].map(m => m[1]);

const index = read('index.html');

test('au moins un jeu existe', () => {
  assert.ok(GAMES.length >= 3);
});

test('le registre et games/ coïncident exactement', () => {
  const LIBS = ['registry.js', 'backup.js']; // modules de games/ qui ne sont pas des jeux
  const onDisk = fs.readdirSync(path.join(ROOT, 'games'))
    .filter(f => f.endsWith('.js') && !LIBS.includes(f))
    .map(f => path.basename(f, '.js'))
    .sort();
  const registered = GAMES.map(g => g.slug).sort();
  assert.deepEqual(onDisk, registered,
    'games/*.js et games/registry.js doivent lister les mêmes jeux');
});

for (const {slug, name, subtitle} of GAMES) {
  test(`${slug} : page présente et branchée partout`, () => {
    assert.ok(name && subtitle, `${slug} : name et subtitle requis dans le registre`);
    const page = gamePage(slug);
    assert.ok(fs.existsSync(path.join(ROOT, page)), `${page} manquant`);
    const html = read(page);
    assert.ok(html.includes(`games/${slug}.js`), `${page} ne charge pas games/${slug}.js`);
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
  for (const f of ['.', 'common.css', 'common.js', 'manifest.json', 'games/registry.js', 'games/backup.js', 'history.html']) {
    assert.ok(precache.includes(f), `${f} absent du PRECACHE`);
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
