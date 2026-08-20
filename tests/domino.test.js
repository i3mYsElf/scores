/* Tests de lib/domino.js — la partie pure du partagé Kingdomino/Queendomino :
   départage au plus grand domaine, relecture d'anciennes sauvegardes, HTML de
   la liste. Le câblage DOM est exercé par games.test.js via les deux pages. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {maxDomaine, fixupDomaines, domsTiebreak, domsRankExtra, domsHtml} = require('../lib/domino.js');

test('maxDomaine et départage au plus grand domaine', () => {
  const d = {domaines: [{c:3,k:2},{c:7,k:0},{c:5,k:1}]};
  assert.equal(maxDomaine(d), 7);
  const petit = {domaines: [{c:4,k:1}]};
  assert.ok(domsTiebreak({d: petit}, {d}) > 0); // le plus grand domaine gagne
  assert.equal(domsRankExtra(d), ' · plus grand domaine 7 cases');
  assert.equal(domsRankExtra({domaines: []}), '');
});

test('fixupDomaines : une sauvegarde sans domaines retrouve une ligne vierge', () => {
  const vide = {};
  fixupDomaines(vide);
  assert.deepEqual(vide.domaines, [{c:0,k:0}]);
  fixupDomaines(vide); // idempotent
  assert.deepEqual(vide.domaines, [{c:0,k:0}]);
});

test('domsHtml : une ligne par domaine, valeurs coercées en nombres', () => {
  const html = domsHtml([{c:6,k:2}, {c:'x',k:null}]);
  assert.match(html, /data-dc="0"[^>]*value="6"/);
  assert.match(html, /data-dk="0"[^>]*value="2"/);
  assert.match(html, /data-dc="1"[^>]*value="0"/); // valeur abîmée -> 0, jamais de chaîne brute
  assert.match(html, /data-deldom="1"/);
});
