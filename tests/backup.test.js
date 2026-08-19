/* Tests unitaires de lib/backup.js : logique pure des aperçus et de
   l'export/import, sans DOM — le storage est un stub en mémoire. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {backupKeys, previewLabel, historyLabel, buildBackup, applyBackup, historyCsv} = require('../lib/backup.js');
const {GAMES, HISTORY_KEY} = require('../lib/registry.js');

const mem = init => {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    m
  };
};

test('backupKeys : une clé par jeu du registre + l\'historique', () => {
  const keys = backupKeys();
  assert.equal(keys.length, GAMES.length + 1);
  assert.ok(keys.includes('harmonies-score-v1'));
  assert.ok(keys.includes(HISTORY_KEY));
});

test('previewLabel : partie commencée, joueurs et totaux affichés', () => {
  assert.equal(previewLabel({started: true, players: [{nom: 'Manu'}, {nom: ''}], totals: [42, 7]}),
    'Partie en cours · Manu 42 · ? 7');
});

test('previewLabel : les totaux nuls ou négatifs comptent (Agricola démarre à -1)', () => {
  assert.equal(previewLabel({started: true, players: [{nom: 'Manu'}], totals: [0]}),
    'Partie en cours · Manu 0');
  assert.equal(previewLabel({started: true, players: [{nom: 'Manu'}], totals: [-3]}),
    'Partie en cours · Manu -3');
});

test('previewLabel : null si non commencée, vide ou malformée', () => {
  assert.equal(previewLabel(null), null);
  assert.equal(previewLabel({started: false, players: [{nom: 'Manu'}], totals: [42]}), null); // simple visite
  assert.equal(previewLabel({started: true, players: [{nom: 'Manu'}]}), null);                // sans totals
});

test('historyLabel : accord singulier/pluriel, null si vide', () => {
  assert.equal(historyLabel([{}]), '1 partie terminée');
  assert.equal(historyLabel([{}, {}, {}]), '3 parties terminées');
  assert.equal(historyLabel([]), null);
  assert.equal(historyLabel(null), null);
});

test('buildBackup : clés connues et présentes uniquement, valeurs re-parsées', () => {
  const s = mem({
    'harmonies-score-v1': JSON.stringify({players: [{nom: 'Manu', d: {}}], cur: 0, started: true, totals: [42]}),
    [HISTORY_KEY]: JSON.stringify([{g: 'harmonies', t: 1, players: []}]),
    'evil-key': '"pwned"',
    'cascadia-score-v1': 'pas du JSON' // corrompue : ignorée sans casser l'export
  });
  const b = buildBackup(s);
  assert.equal(b.app, 'scores');
  assert.equal(b.version, 1);
  assert.deepEqual(Object.keys(b.data).sort(), ['harmonies-score-v1', HISTORY_KEY].sort());
  assert.equal(b.data['harmonies-score-v1'].totals[0], 42);
});

test('applyBackup : n\'écrit que les clés autorisées, compte les restaurations', () => {
  const s = mem();
  const n = applyBackup(s, {app: 'scores', version: 1, data: {
    'cascadia-score-v1': {players: [{nom: 'Manu', d: {}}], cur: 0, started: true, totals: [77]},
    'evil-key': 'pwned'
  }});
  assert.equal(n, 1);
  assert.equal(s.getItem('evil-key'), null);
  assert.equal(JSON.parse(s.getItem('cascadia-score-v1')).totals[0], 77);
});

test('applyBackup : rejette un format inattendu sans rien écrire (code format)', () => {
  const s = mem();
  assert.throws(() => applyBackup(s, {hello: 'world'}), err => err.code === 'format');
  assert.throws(() => applyBackup(s, null), err => err.code === 'format');
  assert.throws(() => applyBackup(s, {app: 'scores', data: null}), err => err.code === 'format');
  assert.equal(s.m.size, 0);
});

test('historyCsv : une ligne par joueur, noms du registre, champs échappés', () => {
  const csv = historyCsv([
    {g: 'cascadia', t: Date.UTC(2026, 7, 19, 10, 30), players: [{nom: 'Manu', total: 84}, {nom: 'Léa;"chat"', total: 70}]},
    {g: 'jeuinconnu', players: [{nom: null, total: undefined}]},
  ], {cascadia: 'Cascadia'});
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'date;jeu;position;joueur;total');
  assert.equal(lines[1], '2026-08-19 10:30;Cascadia;1;Manu;84');
  assert.equal(lines[2], '2026-08-19 10:30;Cascadia;2;"Léa;""chat""";70'); // ; et " échappés façon CSV
  assert.equal(lines[3], ';jeuinconnu;1;?;0'); // slug inconnu tel quel, valeurs manquantes tolérées
  assert.equal(historyCsv(null).split('\r\n').length, 1); // historique invalide : en-tête seule
});

test('applyBackup : atomique — un échec d\'écriture restaure l\'état d\'avant (code storage)', () => {
  const s = mem({'harmonies-score-v1': '"ancienne"'});
  let calls = 0;
  const flaky = {
    getItem: s.getItem,
    removeItem: s.removeItem,
    setItem: (k, v) => { if(++calls === 2) throw new Error('QuotaExceededError'); s.setItem(k, v); }
  };
  assert.throws(() => applyBackup(flaky, {app: 'scores', version: 1, data: {
    'harmonies-score-v1': {players: [], cur: 0},
    'cascadia-score-v1':  {players: [], cur: 0},
  }}), err => err.code === 'storage');
  assert.equal(s.getItem('harmonies-score-v1'), '"ancienne"'); // clé écrite puis restaurée
  assert.equal(s.getItem('cascadia-score-v1'), null);          // clé absente restée absente
});
