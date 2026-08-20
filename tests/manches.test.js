/* Tests de lib/manches.js — la partie pure du partagé Sea Salt & Paper / Skyjo :
   rankExtra, HTML de la liste des manches, mutations. Le câblage DOM est
   exercé par games.test.js via les deux pages. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {manchesRankExtra, manchesHtml, delManche, setManche} = require('../lib/manches.js');

test('manchesRankExtra : pluriel et absence', () => {
  assert.equal(manchesRankExtra({manches: []}), '');
  assert.equal(manchesRankExtra({manches: [5]}), ' · 1 manche');
  assert.equal(manchesRankExtra({manches: [5, -2]}), ' · 2 manches');
});

test('manchesHtml : signé ou non, état vide', () => {
  const signee = manchesHtml([7], true);
  assert.match(signee, /data-manche="0"/);
  assert.match(signee, /value="7"/);
  assert.ok(!signee.includes('min="0"')); // Skyjo : manches négatives permises
  assert.ok(manchesHtml([7], false).includes('min="0"')); // SSP : positives seulement
  assert.match(manchesHtml([], false), /Aucune manche/);
});

test('mutations pures : delManche et setManche (clamp selon signed)', () => {
  const d = {manches: [5, 8, 3]};
  delManche(d, 1);
  assert.deepEqual(d.manches, [5, 3]);
  setManche(d, 0, '-4', true);   // Skyjo : négatif permis
  assert.equal(d.manches[0], -4);
  setManche(d, 1, '-4', false);  // SSP : borné à 0
  assert.equal(d.manches[1], 0);
  setManche(d, 1, 'abc', false); // saisie illisible : 0
  assert.equal(d.manches[1], 0);
});
