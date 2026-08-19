/* Tests unitaires de lib/stats.js : statistiques par joueur depuis
   l'historique, logique pure sans DOM. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {computeStats} = require('../lib/stats.js');

test('agrégation : parties, victoires, taux, record par jeu', () => {
  const s = computeStats([
    {g: 'cascadia',  t: 3, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 2, players: [{nom: 'Léa', total: 112}, {nom: 'Manu', total: 90}]},
    {g: 'agricola',  t: 1, players: [{nom: 'Manu', total: 41}, {nom: 'Léa', total: 39}]},
  ]);
  assert.deepEqual(s, [
    {nom: 'Manu', parties: 3, victoires: 2, taux: 67, bests: [
      {g: 'cascadia',  total: 84, parties: 1},
      {g: 'harmonies', total: 90, parties: 1},
      {g: 'agricola',  total: 41, parties: 1},
    ]},
    {nom: 'Léa', parties: 3, victoires: 1, taux: 33, bests: [
      {g: 'cascadia',  total: 70,  parties: 1},
      {g: 'harmonies', total: 112, parties: 1},
      {g: 'agricola',  total: 39,  parties: 1},
    ]},
  ]);
});

test('partie solo : compte comme partie, pas comme victoire, taux null', () => {
  const s = computeStats([{g: 'cascadia', t: 1, players: [{nom: 'Manu', total: 60}]}]);
  assert.deepEqual(s, [{nom: 'Manu', parties: 1, victoires: 0, taux: null,
    bests: [{g: 'cascadia', total: 60, parties: 1}]}]);
});

test('noms regroupés sans tenir compte de la casse, casse la plus récente affichée', () => {
  const s = computeStats([
    {g: 'cascadia', t: 2, players: [{nom: 'MANU', total: 50}, {nom: 'Léa', total: 40}]}, // la plus récente
    {g: 'cascadia', t: 1, players: [{nom: 'Léa', total: 45}, {nom: 'manu', total: 30}]},
  ]);
  assert.equal(s.length, 2);
  assert.deepEqual(s.find(x => x.nom === 'MANU'),
    {nom: 'MANU', parties: 2, victoires: 1, taux: 50,
     bests: [{g: 'cascadia', total: 50, parties: 2}]});
});

test('bests : le jeu le plus joué d\'abord, records séparés par jeu', () => {
  const s = computeStats([
    {g: 'agricola',         t: 3, players: [{nom: 'Manu', total: 41},  {nom: 'Léa', total: 50}]},
    {g: 'terraformingmars', t: 2, players: [{nom: 'Manu', total: 120}, {nom: 'Léa', total: 90}]},
    {g: 'agricola',         t: 1, players: [{nom: 'Manu', total: 38},  {nom: 'Léa', total: 44}]},
  ]);
  // 2 parties d'Agricola contre 1 de TM : le record mis en avant est celui
  // d'Agricola, même si le total TM est plus haut — les totaux ne se comparent
  // pas entre jeux différents.
  assert.deepEqual(s.find(x => x.nom === 'Manu').bests, [
    {g: 'agricola',         total: 41,  parties: 2},
    {g: 'terraformingmars', total: 120, parties: 1},
  ]);
});

test('tri : victoires desc, puis parties desc, puis nom', () => {
  const s = computeStats([
    {g: 'cascadia', t: 3, players: [{nom: 'Zoé', total: 10}, {nom: 'Ana', total: 5}]},
    {g: 'cascadia', t: 2, players: [{nom: 'Ana', total: 12}, {nom: 'Zoé', total: 8}]},
    {g: 'cascadia', t: 1, players: [{nom: 'Bob', total: 1}]},
  ]);
  assert.deepEqual(s.map(x => x.nom), ['Ana', 'Zoé', 'Bob']); // 1 victoire chacune, égalité de parties -> alpha ; Bob 0 victoire
});

test('ex æquo : pos figé par archive() -> une victoire pour chaque premier, exts toléré', () => {
  const s = computeStats([
    {g: 'cascadia', t: 2, players: [
      {nom: 'Manu', total: 80}, {nom: 'Léa', total: 80, pos: 1}, {nom: 'Bob', total: 60, pos: 3}]},
    {g: 'cascadia', t: 1, exts: ['Variante'], players: [{nom: 'Bob', total: 90}, {nom: 'Manu', total: 70}]},
  ]);
  // 1 victoire chacun ; Bob et Manu 2 parties (alpha), Léa 1 partie mais 100 %
  assert.deepEqual(s.map(x => [x.nom, x.victoires, x.taux]),
    [['Bob', 1, 50], ['Manu', 1, 50], ['Léa', 1, 100]]);
});

test('entrées malformées ignorées, historique vide ou invalide toléré', () => {
  assert.deepEqual(computeStats([]), []);
  assert.deepEqual(computeStats(null), []);
  const s = computeStats([
    {g: 'cascadia'},                                  // sans players
    {g: 'cascadia', players: [{total: 5}, null]},     // joueur sans nom / null
    {g: 'cascadia', players: [{nom: 'Manu', total: 7}, {nom: 'Léa'}]}, // total manquant -> 0
  ]);
  assert.deepEqual(s, [
    {nom: 'Manu', parties: 1, victoires: 1, taux: 100, bests: [{g: 'cascadia', total: 7, parties: 1}]},
    {nom: 'Léa',  parties: 1, victoires: 0, taux: 0,   bests: [{g: 'cascadia', total: 0, parties: 1}]},
  ]);
});
