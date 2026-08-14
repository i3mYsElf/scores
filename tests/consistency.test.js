/* Vérifie la cohérence de la structure multi-jeux : chaque jeu de games/
   doit avoir sa page, être précaché par le SW, listé sur l'accueil, et
   utiliser la clé localStorage attendue. Attrape les oublis de la recette
   « ajouter un jeu » du README. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const games = fs.readdirSync(path.join(ROOT, 'games'))
  .filter(f => f.endsWith('.js'))
  .map(f => path.basename(f, '.js'));

const precache = [...read('sw.js')
  .match(/PRECACHE = \[([^\]]*)\]/s)[1]
  .matchAll(/'([^']+)'/g)].map(m => m[1]);

const index = read('index.html');

test('au moins un jeu existe', () => {
  assert.ok(games.length >= 3);
});

for (const g of games) {
  test(`${g} : page présente et branchée partout`, () => {
    const page = `${g}.html`;
    assert.ok(fs.existsSync(path.join(ROOT, page)), `${page} manquant`);
    const html = read(page);
    assert.ok(html.includes(`games/${g}.js`), `${page} ne charge pas games/${g}.js`);
    assert.ok(html.includes(`'${g}-score-v1'`), `${page} n'utilise pas la clé ${g}-score-v1`);
    assert.ok(precache.includes(page), `${page} absent du PRECACHE de sw.js`);
    assert.ok(precache.includes(`games/${g}.js`), `games/${g}.js absent du PRECACHE de sw.js`);
    assert.ok(index.includes(`href="${page}"`), `${page} absent du menu index.html`);
    assert.ok(index.includes(`${g}-score-v1`), `clé ${g}-score-v1 absente de l'aperçu index.html`);
  });
}

test('les fichiers communs sont précachés', () => {
  for (const f of ['.', 'common.css', 'common.js', 'manifest.json']) {
    assert.ok(precache.includes(f), `${f} absent du PRECACHE`);
  }
});

test('les raccourcis du manifest pointent vers des pages existantes', () => {
  const manifest = JSON.parse(read('manifest.json'));
  for (const s of manifest.shortcuts || []) {
    assert.ok(fs.existsSync(path.join(ROOT, s.url)), `shortcut ${s.url} sans page`);
  }
});
