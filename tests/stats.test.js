/* Tests unitaires de games/stats.js : statistiques par joueur depuis
   l'historique, logique pure sans DOM. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {computeStats} = require('../games/stats.js');

test('agrégation : parties, victoires (position 0), record avec jeu', () => {
  const s = computeStats([
    {g: 'cascadia',  t: 3, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 2, players: [{nom: 'Léa', total: 112}, {nom: 'Manu', total: 90}]},
    {g: 'agricola',  t: 1, players: [{nom: 'Manu', total: 41}, {nom: 'Léa', total: 39}]},
  ]);
  assert.deepEqual(s, [
    {nom: 'Manu', parties: 3, victoires: 2, best: {g: 'harmonies', total: 90}},
    {nom: 'Léa',  parties: 3, victoires: 1, best: {g: 'harmonies', total: 112}},
  ]);
});

test('partie solo : compte comme partie, pas comme victoire', () => {
  const s = computeStats([{g: 'cascadia', t: 1, players: [{nom: 'Manu', total: 60}]}]);
  assert.deepEqual(s, [{nom: 'Manu', parties: 1, victoires: 0, best: {g: 'cascadia', total: 60}}]);
});

test('tri : victoires desc, puis parties desc, puis nom', () => {
  const s = computeStats([
    {g: 'cascadia', t: 3, players: [{nom: 'Zoé', total: 10}, {nom: 'Ana', total: 5}]},
    {g: 'cascadia', t: 2, players: [{nom: 'Ana', total: 12}, {nom: 'Zoé', total: 8}]},
    {g: 'cascadia', t: 1, players: [{nom: 'Bob', total: 1}]},
  ]);
  assert.deepEqual(s.map(x => x.nom), ['Ana', 'Zoé', 'Bob']); // 1 victoire chacune, égalité de parties -> alpha ; Bob 0 victoire
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
    {nom: 'Manu', parties: 1, victoires: 1, best: {g: 'cascadia', total: 7}},
    {nom: 'Léa',  parties: 1, victoires: 0, best: {g: 'cascadia', total: 0}},
  ]);
});
