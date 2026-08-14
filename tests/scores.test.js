const test = require('node:test');
const assert = require('node:assert/strict');

const harmonies = require('../games/harmonies.js');
const wonders = require('../games/7wonders.js');
const iaww = require('../games/wonderfulworld.js');
const agricola = require('../games/agricola.js');

/* ---------- Harmonies ---------- */
test('Harmonies : arbres et montagnes (1/3/7)', () => {
  const d = harmonies.blank();
  d.arbre = [1,1,1]; d.mont = [0,2,1];
  const s = harmonies.score(d);
  assert.equal(s.arbre, 11);
  assert.equal(s.mont, 13);
});

test('Harmonies : barème rivière (face A)', () => {
  const d = harmonies.blank();
  const eau = n => { d.riviere = n; return harmonies.score(d).eau; };
  assert.deepEqual([0,1,2,3,4,5,6].map(eau), [0,0,2,5,8,11,15]);
  assert.equal(eau(8), 15 + 2*4); // +4 par jeton au-delà de 6
});

test('Harmonies : îles (face B), minimum 1', () => {
  const d = harmonies.blank();
  d.face = 'B'; d.iles = 3;
  assert.equal(harmonies.score(d).eau, 15);
});

test('Harmonies : total complet', () => {
  const d = harmonies.blank();
  d.arbre = [0,0,2]; d.champs = 2; d.riviere = 4; d.animaux = [8, 5]; d.esprit = 3;
  assert.equal(harmonies.score(d).total, 14 + 10 + 8 + 13 + 3);
});

/* ---------- 7 Wonders ---------- */
test('7 Wonders : science sans joker', () => {
  assert.equal(wonders.bestScience(3,3,3,0), 48); // 27+27... n²×3 + 7×3
  assert.equal(wonders.bestScience(2,0,0,0), 4);
});

test('7 Wonders : jokers affectés au mieux', () => {
  assert.equal(wonders.bestScience(1,1,1,1), 13);  // (2,1,1) = 4+1+1+7
  assert.equal(wonders.bestScience(2,2,1,1), 26);  // complète le set : (2,2,2) = 12+14
  assert.equal(wonders.bestScience(0,0,0,3), 10);  // (1,1,1) = 3+7 bat (3,0,0) = 9
});

test('7 Wonders : trésor et militaire', () => {
  const d = wonders.blank();
  d.pieces = 17; d.def = 2; d.v3 = 1;
  const s = wonders.score(d);
  assert.equal(s.tresor, 5);
  assert.equal(s.militaire, 3);
});

test('7 Wonders : extensions inactives = 0, actives comptées', () => {
  const d = wonders.blank();
  d.naval = -4; d.iles = 6; d.flotte = 5; d.cities = 10; d.dettes = 3;
  assert.equal(wonders.score(d, {}).total, 0);
  assert.equal(wonders.score(d, {armada:true}).armada, 7);
  assert.equal(wonders.score(d, {cities:true}).cities, 7);
});

/* ---------- It's a Wonderful World ---------- */
test('IAWW : fixes + multiplicateurs + personnages', () => {
  const d = iaww.blank();
  d.fixes = 23; d.mults = [{v:2,n:4},{v:3,n:2},{v:1,n:5}]; d.financiers = 3; d.generaux = 2;
  const s = iaww.score(d);
  assert.equal(s.mults, 19);
  assert.equal(s.total, 47);
});

test('IAWW : feuille vide = 0', () => {
  assert.equal(iaww.score(iaww.blank()).total, 0);
});

/* ---------- Agricola ---------- */
test('Agricola : seuils par catégorie (bornes exactes)', () => {
  const {tier, SEUILS} = agricola;
  const serie = (cat, ns) => ns.map(n => tier(n, SEUILS[cat]));
  assert.deepEqual(serie('champs',    [0,1,2,3,4,5,9]), [-1,-1,1,2,3,4,4]);
  assert.deepEqual(serie('paturages', [0,1,2,3,4,9]),   [-1,1,2,3,4,4]);
  assert.deepEqual(serie('cereales',  [0,1,3,4,5,6,7,8]), [-1,1,1,2,2,3,3,4]);
  assert.deepEqual(serie('legumes',   [0,1,2,3,4]),     [-1,1,2,3,4]);
  assert.deepEqual(serie('moutons',   [0,1,4,6,8]),     [-1,1,2,3,4]);
  assert.deepEqual(serie('sangliers', [0,1,2,3,5,7]),   [-1,1,1,2,3,4]);
  assert.deepEqual(serie('boeufs',    [0,1,2,4,6]),     [-1,1,2,3,4]);
});

test('Agricola : feuille de départ (famille de 2, tout à zéro)', () => {
  // 7 catégories à −1, cases vides à 0 saisies, 2 personnes = +6
  assert.equal(agricola.score(agricola.blank()).total, -7 + 6);
});

test('Agricola : exemple complet', () => {
  const d = agricola.blank();
  Object.assign(d, {champs:3, cereales:5, legumes:1, paturages:2, moutons:4,
    sangliers:0, boeufs:2, etables:1, vides:2, argile:3, pierre:0,
    personnes:4, cartes:7, bonus:2, mendicite:1});
  const s = agricola.score(d);
  assert.equal(s.cultures, 2+2+1);
  assert.equal(s.elevage, 2+2-1+2+1);
  assert.equal(s.ferme, -2+3+12);
  assert.equal(s.cartes, 9);
  assert.equal(s.mendicite, -3);
  assert.equal(s.total, 5+6+13+9-3);
});
