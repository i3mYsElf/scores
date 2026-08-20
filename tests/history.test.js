/* Tests de l'historique des parties : lib/history.js en Node (lecture/écriture,
   re-tri d'une entrée éditée) puis history.html dans jsdom (rendu, filtres,
   édition, export/import). */
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadPage, closeAll, click, type} = require('./helpers.js');
const {readHist, writeHist, reorderEntry} = require('../lib/history.js');
const {HISTORY_KEY} = require('../lib/registry.js');

test.afterEach(closeAll);

/* ---------- lib/history.js (pur) ---------- */
const stub = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v))
  };
};

test('readHist : historique absent, invalide ou illisible -> tableau vide', () => {
  assert.deepEqual(readHist(stub()), []);
  assert.deepEqual(readHist(stub({[HISTORY_KEY]: '{"pas":"un tableau"}'})), []);
  assert.deepEqual(readHist(stub({[HISTORY_KEY]: '{corrompu'})), []);
});

test('writeHist : aller-retour, et false si le storage refuse', () => {
  const s = stub();
  const h = [{g: 'skyjo', t: 1, players: [{nom: 'Manu', total: 12}]}];
  assert.equal(writeHist(s, h), true);
  assert.deepEqual(readHist(s), h);
  assert.equal(writeHist({setItem(){ throw new Error('plein'); }}, h), false);
});

test('reorderEntry : re-tri par total, pos figée sur les ex æquo seulement', () => {
  const entry = {g: 'harmonies', players: [
    {nom: 'A', total: 5, pos: 1}, // pos d'archive obsolète après édition
    {nom: 'B', total: 9},
    {nom: 'C', total: 9}
  ]};
  reorderEntry(entry, false);
  // convention d'archive : pos seulement quand elle dévie du rang (ex æquo)
  assert.deepEqual(entry.players.map(p => [p.nom, p.total, p.pos]),
    [['B', 9, undefined], ['C', 9, 1], ['A', 5, undefined]]);
});

test('reorderEntry : lowWins inverse le sens (Skyjo)', () => {
  const entry = {g: 'skyjo', players: [{nom: 'A', total: 40}, {nom: 'B', total: 12}]};
  reorderEntry(entry, true);
  assert.deepEqual(entry.players.map(p => p.nom), ['B', 'A']);
});

/* ---------- history.html : rendu ---------- */
test('history.html : rendu depuis le registre, vainqueur en tête, noms échappés', () => {
  const hist = JSON.stringify([
    {g: 'cascadia', t: 1755300000000, players: [{nom: '<img src=x onerror=alert(1)>', total: 80}, {nom: 'Manu', total: 60}]},
    {g: 'jeuinconnu', t: 0, players: [{nom: 'Solo', total: 12}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const cards = w.document.querySelectorAll('#historyList .card');
  assert.equal(cards.length, 2);
  assert.ok(cards[0].querySelector('h2').textContent.includes('Cascadia')); // slug -> nom via le registre
  assert.equal(cards[0].querySelector('.rank.win .pt').textContent, '80');
  assert.equal(w.document.querySelector('#historyList img'), null); // échappement
  assert.ok(cards[1].querySelector('h2').textContent.includes('jeuinconnu')); // slug inconnu : affiché tel quel
  assert.ok(!w.document.getElementById('clearHist').hidden);
});

test('history.html : état vide', () => {
  const w = loadPage('history.html');
  assert.ok(w.document.getElementById('historyList').textContent.includes('Aucune partie'));
  assert.ok(w.document.getElementById('clearHist').hidden);
});

test('history.html : carte Statistiques (victoires, taux, record du jeu le plus joué), absente si vide', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 2, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 1, players: [{nom: 'Léa', total: 112}, {nom: 'Manu', total: 90}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const rows = w.document.querySelectorAll('#statsCard .rank');
  assert.equal(rows.length, 2);
  // 1 victoire et 2 parties chacune -> égalité, tri alphabétique : Léa d'abord
  assert.ok(rows[0].querySelector('.nm').textContent.startsWith('Léa'));
  assert.ok(rows[0].querySelector('.pt').textContent.startsWith('1'));
  assert.ok(rows[0].textContent.includes('50 % de victoires'));
  // record du jeu le plus joué (égalité 1-1 -> le plus récent : Cascadia), pas le max inter-jeux
  assert.ok(rows[0].textContent.includes('record 70 (Cascadia)'));
  const w2 = loadPage('history.html');
  assert.equal(w2.document.getElementById('statsCard').innerHTML, '');
});

test('history.html : détail archivé replié par défaut, déplié au toucher, échappé', () => {
  const hist = JSON.stringify([{g: 'harmonies', t: 1, players: [
    {nom: 'Manu', total: 12, parts: [['Arbres', 7], ['<img src=x onerror=alert(1)>', 5]], extra: ' · 3 jetons'},
    {nom: 'Léa', total: 8} // ancienne entrée sans parts : tolérée
  ]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const card = w.document.querySelector('#historyList .card');
  assert.ok(card.classList.contains('hasDetail'));
  assert.ok(!card.classList.contains('open')); // replié par défaut (CSS)
  assert.ok(card.querySelector('.nm small').textContent.includes('Arbres 7'));
  assert.ok(card.querySelector('.nm small').textContent.includes('3 jetons'));
  assert.equal(card.querySelector('.nm small img'), null); // parts importées échappées
  click(w, '#historyList .card h2');
  assert.ok(card.classList.contains('open'));
  click(w, '#historyList .card h2');
  assert.ok(!card.classList.contains('open'));
});

test('history.html : positions figées rendues, plusieurs vainqueurs surlignés', () => {
  const hist = JSON.stringify([
    {g: 'harmonies', t: 2, players: [
      {nom: 'Manu', total: 80}, {nom: 'Léa', total: 80, pos: 1}, {nom: 'Bob', total: 60, pos: 3}]},
    {g: 'cascadia', t: 1, players: [{nom: 'Manu', total: 50}, {nom: 'Léa', total: 40}]} // ancienne entrée sans pos
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const cards = w.document.querySelectorAll('#historyList .card');
  assert.deepEqual([...cards[0].querySelectorAll('.pos')].map(e => e.textContent), ['1', '1', '3']);
  assert.equal(cards[0].querySelectorAll('.rank.win').length, 2);
  assert.equal(cards[1].querySelectorAll('.rank.win').length, 1); // comportement d'avant
});

test('history.html : extensions dans le détail replié, échappées, dépliable sans parts', () => {
  const hist = JSON.stringify([{g: '7wonders', t: 1, exts: ['Cities', '<img src=x onerror=alert(1)>'],
    players: [{nom: 'Manu', total: 50}, {nom: 'Léa', total: 40}]}]); // aucun parts
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const card = w.document.querySelector('#historyList .card');
  assert.ok(card.classList.contains('hasDetail')); // dépliable grâce aux extensions seules
  assert.ok(!card.classList.contains('open'));     // replié par défaut (CSS)
  assert.ok(card.querySelector('.exts').textContent.includes('Cities'));
  assert.equal(card.querySelector('.exts img'), null); // libellés importés échappés
  click(w, '#historyList .card h2');
  assert.ok(card.classList.contains('open'));
});

/* ---------- history.html : édition, suppression ---------- */
test('history.html : édition d\'une entrée (nom, total), re-triée au total', () => {
  const hist = JSON.stringify([{g: 'cascadia', t: 1, players: [
    {nom: 'Manu', total: 50}, {nom: 'Lae', total: 40}
  ]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  click(w, '[data-edit="0"]');
  assert.ok(w.document.querySelector('[data-enom="0"]')); // mode édition
  w.document.querySelector('[data-enom="1"]').value = 'Léa';
  w.document.querySelector('[data-etot="1"]').value = '60';
  click(w, '[data-esave="0"]');
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.deepEqual(e.players.map(p => [p.nom, p.total]), [['Léa', 60], ['Manu', 50]]);
  const rows = w.document.querySelectorAll('#historyList .rank');
  assert.ok(rows[0].textContent.includes('Léa')); // re-rendu, nouveau vainqueur en tête
});

test('history.html : édition — pos recalculé par égalité de total, obsolète purgé', () => {
  const hist = JSON.stringify([{g: 'cascadia', t: 1, players: [
    {nom: 'Manu', total: 50}, {nom: 'Léa', total: 40, pos: 1} // pos incohérent volontaire
  ]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  click(w, '[data-edit="0"]');
  w.document.querySelector('[data-etot="1"]').value = '50'; // égalité après édition
  click(w, '[data-esave="0"]');
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.equal(e.players[0].pos, undefined);
  assert.equal(e.players[1].pos, 1);
  assert.equal(w.document.querySelectorAll('#historyList .rank.win').length, 2);
});

test('history.html : rééditer une partie Skyjo re-trie au plus petit total', () => {
  const hist = JSON.stringify([{g: 'skyjo', t: 1,
    players: [{nom: 'Léa', total: 40}, {nom: 'Manu', total: 60}]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  click(w, '[data-edit="0"]');
  type(w, '[data-etot="0"]', '70'); // Léa passe à 70 : Manu (60) repasse devant
  click(w, '[data-esave="0"]');
  const h = JSON.parse(w.localStorage.getItem('scores-history-v1'));
  assert.deepEqual(h[0].players.map(p => [p.nom, p.total]), [['Manu', 60], ['Léa', 70]]);
});

test('history.html : suppression d\'une seule entrée, avec confirmation', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 2, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 1, players: [{nom: 'Léa', total: 112}, {nom: 'Manu', total: 90}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  w.confirm = () => false;
  click(w, '[data-del="0"]');
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 2); // refus : rien ne bouge
  w.confirm = () => true;
  click(w, '[data-del="0"]');
  const h = JSON.parse(w.localStorage.getItem('scores-history-v1'));
  assert.equal(h.length, 1);
  assert.equal(h[0].g, 'harmonies'); // c'est bien la 1re entrée qui a sauté
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 1);
});

test('history.html : bouton CSV visible seulement avec des parties', () => {
  const w = loadPage('history.html');
  assert.ok(w.document.getElementById('csvBtn').hidden);
  const w2 = loadPage('history.html',
    {'scores-history-v1': JSON.stringify([{g: 'cascadia', t: 1, players: [{nom: 'Manu', total: 1}]}])});
  assert.ok(!w2.document.getElementById('csvBtn').hidden);
});

/* ---------- Export / import des sauvegardes ---------- */
test('historique : buildBackup n\'embarque que les clés connues et présentes', () => {
  const w = loadPage('history.html', {
    'harmonies-score-v1': JSON.stringify({players: [{nom: 'Manu', d: {}}], cur: 0, started: true, totals: [42]}),
    'scores-history-v1': JSON.stringify([{g: 'harmonies', t: 1, players: []}]),
    'evil-key': '"pwned"'
  });
  const b = w.buildBackup();
  assert.equal(b.app, 'scores');
  assert.deepEqual(Object.keys(b.data).sort(), ['harmonies-score-v1', 'scores-history-v1']);
  assert.equal(b.data['harmonies-score-v1'].totals[0], 42);
});

test('historique : applyBackup restaure les clés connues, ignore le reste, re-rend la page', () => {
  const w = loadPage('history.html');
  const n = w.applyBackup({app: 'scores', version: 1, data: {
    'cascadia-score-v1': {players: [{nom: 'Manu', d: {}}], cur: 0, started: true, totals: [77]},
    'scores-history-v1': [{g: 'cascadia', t: 5, players: [{nom: 'Manu', total: 77}, {nom: 'Léa', total: 60}]}],
    'evil-key': 'pwned'
  }});
  assert.equal(n, 2);
  assert.equal(w.localStorage.getItem('evil-key'), null);
  assert.equal(JSON.parse(w.localStorage.getItem('cascadia-score-v1')).totals[0], 77);
  assert.ok(w.document.getElementById('histSub').textContent.includes('1 partie terminée')); // compteur re-rendu
  assert.ok(w.document.getElementById('historyList').textContent.includes('Manu'));          // liste re-rendue
});

test('historique : applyBackup rejette un format inattendu sans toucher au storage', () => {
  const w = loadPage('history.html', {'harmonies-score-v1': '{"players":[{"nom":"Manu","d":{}}],"cur":0}'});
  assert.throws(() => w.applyBackup({hello: 'world'}));
  assert.ok(w.localStorage.getItem('harmonies-score-v1').includes('Manu'));
});

/* ---------- Filtres ---------- */
const setFilter = (w, id, val) => {
  const sel = w.document.getElementById(id);
  sel.value = val;
  sel.dispatchEvent(new w.Event('change', {bubbles: true}));
};

test('history.html : filtres par jeu et par joueur — liste, stats et compteur filtrés', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 3, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 2, players: [{nom: 'Léa', total: 112}, {nom: 'Bob', total: 90}]},
    {g: 'cascadia',  t: 1, players: [{nom: 'léa', total: 60}, {nom: 'Bob', total: 50}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  assert.ok(!w.document.getElementById('filters').hidden);
  setFilter(w, 'filterG', 'harmonies');
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 1);
  assert.ok(w.document.getElementById('histSub').textContent.includes('1 partie'));
  assert.ok(!w.document.getElementById('statsCard').textContent.includes('Manu')); // stats filtrées
  setFilter(w, 'filterG', '');
  setFilter(w, 'filterP', 'léa'); // clé insensible à la casse : Léa et léa
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 3);
  setFilter(w, 'filterG', 'harmonies'); // combiné : harmonies + Manu = rien
  setFilter(w, 'filterP', 'manu');
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 0);
  assert.ok(w.document.getElementById('historyList').textContent.includes('Aucune partie ne correspond'));
  assert.ok(!w.document.getElementById('csvBtn').hidden);   // export/effacement : historique complet
  assert.ok(!w.document.getElementById('clearHist').hidden);
});

test('history.html : filtres masqués sans historique', () => {
  const w = loadPage('history.html');
  assert.ok(w.document.getElementById('filters').hidden);
});

test('history.html : suppression sous filtre -> la bonne entrée du tableau stocké', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 3, players: [{nom: 'Manu', total: 84}]},
    {g: 'harmonies', t: 2, players: [{nom: 'Léa', total: 112}]},
    {g: 'cascadia',  t: 1, players: [{nom: 'Bob', total: 60}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  setFilter(w, 'filterG', 'harmonies');
  click(w, '[data-del="1"]'); // l'index porté est celui du tableau stocké
  assert.deepEqual(JSON.parse(w.localStorage.getItem('scores-history-v1')).map(e => e.g),
    ['cascadia', 'cascadia']);
});
