/* Tests de l'accueil (index.html) dans jsdom : menu généré depuis le registre,
   aperçus « Partie en cours », ordre par dernière utilisation, bascule de
   thème (theme.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadPage, closeAll, click} = require('./helpers.js');
const {GAMES} = require('../lib/registry.js');

test.afterEach(closeAll);

test('accueil : cartes générées depuis le registre, vignettes clonées', () => {
  const w = loadPage('index.html');
  const cards = w.document.querySelectorAll('a.game');
  assert.equal(cards.length, GAMES.length);
  for (const card of cards){
    assert.ok(card.querySelector('.thumb svg'), `${card.getAttribute('href')} sans vignette SVG`);
    assert.ok(card.querySelector('b').textContent.length > 0);
  }
});

test('accueil : visiter une feuille ne déclenche pas « Partie en cours »', () => {
  // sauvegarde TM créée par une simple visite : totaux à 20 (NT), aucune saisie
  const visite = JSON.stringify({players:[{nom:'Joueur 1',d:{}},{nom:'Joueur 2',d:{}}], cur:0, started:false, totals:[20,20]});
  const vraie = JSON.stringify({players:[{nom:'Manu',d:{}}], cur:0, started:true, totals:[42]});
  const w = loadPage('index.html', {'terraformingmars-score-v1': visite, 'harmonies-score-v1': vraie});
  assert.ok(!w.document.querySelector('[data-sub="terraformingmars"]').textContent.includes('Partie en cours'));
  assert.ok(w.document.querySelector('[data-sub="terraformingmars"]').textContent.includes('NT')); // sous-titre du registre
  assert.ok(w.document.querySelector('[data-sub="harmonies"]').textContent.includes('Partie en cours · Manu 42'));
});

test('accueil : menu ordonné par dernière utilisation, Historique en dernier', () => {
  const save = ts => JSON.stringify({players: [{nom: 'Manu', d: {}}], cur: 0, started: false, totals: [0], ts});
  const w = loadPage('index.html', {'cascadia-score-v1': save(2000), 'agricola-score-v1': save(1000)});
  const hrefs = [...w.document.querySelectorAll('a.game')].map(a => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['cascadia.html', 'agricola.html', // par ts décroissant
    'harmonies.html', '7wonders.html', 'wonderfulworld.html', 'terraformingmars.html', 'seasaltpaper.html',
    'kingdomino.html', 'queendomino.html', '7wondersduel.html', 'skyjo.html']); // jamais ouverts : ordre du registre
  assert.ok(w.document.querySelector('a.tool[href="history.html"]')); // l'Historique vit dans le header
});

/* ---------- Thème ---------- */
test('thème : choix persisté appliqué avant le rendu, cycle du bouton, metas alignées', () => {
  const w = loadPage('index.html', {'scores-theme-v1': 'dark'});
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  w.document.querySelectorAll('meta[name="theme-color"]').forEach(m => assert.equal(m.content, '#141414'));
  click(w, '#themeBtn'); // sombre -> clair
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  assert.equal(w.localStorage.getItem('scores-theme-v1'), 'light');
  w.document.querySelectorAll('meta[name="theme-color"]').forEach(m => assert.equal(m.content, '#F4F4F1'));
  click(w, '#themeBtn'); // clair -> automatique
  assert.equal(w.document.documentElement.dataset.theme, undefined);
  assert.equal(w.localStorage.getItem('scores-theme-v1'), null);
  w.document.querySelectorAll('meta[name="theme-color"]').forEach(m =>
    assert.equal(m.content, m.getAttribute('media').includes('dark') ? '#141414' : '#F4F4F1')); // retour aux media queries
  click(w, '#themeBtn'); // automatique -> sombre
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  // une seule icône visible à la fois (hidden est sans effet sur les SVG — bug vu en prod)
  const visibles = [...w.document.querySelectorAll('#themeBtn [data-mode]')]
    .filter(el => el.style.display !== 'none');
  assert.equal(visibles.length, 1);
  assert.equal(visibles[0].dataset.mode, 'dark');
});

test('thème : les feuilles appliquent aussi le choix enregistré', () => {
  const w = loadPage('harmonies.html', {'scores-theme-v1': 'light'});
  assert.equal(w.document.documentElement.dataset.theme, 'light');
});
