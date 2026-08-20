/* Tests de lib/sheet.js — la partie pure du moteur de feuille : normalisation
   des sauvegardes, classement avec ex æquo, entrée d'historique, texte de
   partage. Complète tests/pages.test.js, qui exerce le câblage dans jsdom. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {normalizeD, ranked, archiveEntry, shareText} = require('../lib/sheet.js');

/* ---------- normalizeD ---------- */
test('normalizeD : clés manquantes prises de la feuille vierge', () => {
  const blank = {a: 0, b: 5, arbre: [0, 0, 0]};
  const d = normalizeD(blank, {a: 3});
  assert.deepEqual(d, {a: 3, b: 5, arbre: [0, 0, 0]});
});

test('normalizeD : tableau fixe abîmé réaligné (longueur et nombres)', () => {
  const blank = {arbre: [0, 0, 0], defis: [0, 0]};
  assert.deepEqual(normalizeD(blank, {arbre: [5]}).arbre, [5, 0, 0]);
  assert.deepEqual(normalizeD(blank, {arbre: ['x', 2, null]}).arbre, [0, 2, 0]);
  assert.deepEqual(normalizeD(blank, {arbre: 'junk'}).arbre, [0, 0, 0]);
  assert.deepEqual(normalizeD(blank, {defis: [1, 2, 3]}).defis, [1, 2]);
});

test('normalizeD : tableaux variables laissés aux fixup des jeux', () => {
  const blank = {manches: [], domaines: [{c: 0, k: 0}]};
  const d = normalizeD(blank, {manches: [5, -2], domaines: [{c: 3, k: 1}]});
  assert.deepEqual(d.manches, [5, -2]); // longueur variable : intact
  assert.deepEqual(d.domaines, [{c: 3, k: 1}]); // éléments objets : intact
  // absent ou invalide : la forme vierge est clonée, jamais partagée
  const vide = normalizeD(blank, {});
  vide.domaines[0].c = 9;
  assert.equal(blank.domaines[0].c, 0);
});

/* ---------- ranked ---------- */
const it = (nom, total, extra) => ({nom, d: {}, s: {total, ...extra}});

test('ranked : competition ranking 1,1,3 sur les ex æquo', () => {
  const list = ranked([it('A', 5), it('B', 9), it('C', 9), it('D', 2)]);
  assert.deepEqual(list.map(x => [x.nom, x.pos]), [['B', 1], ['C', 1], ['A', 3], ['D', 4]]);
});

test('ranked : lowWins inverse le sens (Skyjo)', () => {
  const list = ranked([it('A', 40), it('B', 12)], {lowWins: true});
  assert.deepEqual(list.map(x => x.nom), ['B', 'A']);
  assert.equal(list[0].pos, 1);
});

test('ranked : le tiebreak sépare des totaux égaux, sans lui ex æquo', () => {
  const items = [it('A', 9, {mc: 3}), it('B', 9, {mc: 7})];
  const sans = ranked(items);
  assert.deepEqual(sans.map(x => x.pos), [1, 1]);
  const avec = ranked(items, {tiebreak: (a, b) => b.s.mc - a.s.mc});
  assert.deepEqual(avec.map(x => [x.nom, x.pos]), [['B', 1], ['A', 2]]);
});

/* ---------- archiveEntry ---------- */
test('archiveEntry : pos figée sur les ex æquo seulement, parts filtrées, exts si actives', () => {
  const list = ranked([it('A', 9), it('B', 9), it('C', 2)]);
  const entry = archiveEntry(list, {
    slug: 'jeu', t: 123, exts: ['Ext'],
    rankParts: s => [['Points', s.total], ['Bonus', 0]], // les zéros sont filtrés
    rankExtra: () => ''
  });
  assert.equal(entry.g, 'jeu');
  assert.equal(entry.t, 123);
  assert.deepEqual(entry.exts, ['Ext']);
  assert.equal(entry.players[0].pos, undefined); // 1er au rang 1 : pos implicite
  assert.equal(entry.players[1].pos, 1);         // ex æquo : pos figée
  assert.equal(entry.players[2].pos, undefined);
  assert.deepEqual(entry.players[0].parts, [['Points', 9]]);
});

test('archiveEntry : sans extension ni détail, entrée minimale', () => {
  const entry = archiveEntry(ranked([it('A', 0)]), {
    slug: 'jeu', t: 1, exts: [], rankParts: () => []
  });
  assert.deepEqual(entry, {g: 'jeu', t: 1, players: [{nom: 'A', total: 0}]});
});

/* ---------- shareText ---------- */
test('shareText : 🏆 pour chaque vainqueur, extensions et date en tête', () => {
  const list = ranked([it('A', 5), it('B', 9), it('C', 9)]);
  const txt = shareText(list, {gameName: 'Jeu', exts: ['Ext'], date: '20/08/2026'});
  assert.equal(txt.split('\n')[0], 'Jeu (Ext) — 20/08/2026');
  assert.match(txt, /🏆 B — 9 pts/);
  assert.match(txt, /🏆 C — 9 pts/);
  assert.match(txt, /3\. A — 5 pts/);
});

test('shareText : en solo, pas de position', () => {
  const txt = shareText(ranked([it('A', 42)]), {gameName: 'Jeu', exts: [], date: 'd'});
  assert.equal(txt.split('\n')[1], 'A — 42 pts');
});
