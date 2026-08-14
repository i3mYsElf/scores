/* Tests d'intégration des pages réelles dans jsdom : moteur commun (common.js),
   interactions, échappement des noms, persistance et relecture d'anciens formats. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

function loadPage(file, storage) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + file, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  for (const [k, v] of Object.entries(storage || {})) window.localStorage.setItem(k, v);
  // exécute les scripts dans l'ordre du document (src résolus sur le disque)
  for (const s of window.document.querySelectorAll('script')) {
    const code = s.src ? fs.readFileSync(path.join(ROOT, new URL(s.src).pathname), 'utf8') : s.textContent;
    window.eval(code);
  }
  return window;
}
const click = (w, sel) => w.document.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const type = (w, sel, val) => {
  const el = w.document.querySelector(sel);
  el.value = val;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
};
const grand = w => w.document.getElementById('grand').textContent;

/* ---------- Harmonies ---------- */
test('harmonies : steppers, faces eau, minimum îles', () => {
  const w = loadPage('harmonies.html');
  assert.equal(grand(w), '0');
  click(w, '[data-step="arbre.2"][data-by="1"]');
  assert.equal(grand(w), '7');
  click(w, '[data-face="B"]');
  assert.equal(grand(w), '12'); // +5, toujours au moins 1 île
  click(w, '[data-step="iles"][data-by="-1"]');
  assert.equal(grand(w), '12'); // ne descend pas sous 1
});

test('harmonies : noms de joueurs échappés (onglets et classement)', () => {
  const w = loadPage('harmonies.html');
  type(w, '#pname', '<img src=x onerror=alert(1)>');
  assert.ok(w.document.getElementById('tabs').innerHTML.includes('&lt;img'));
  assert.equal(w.document.querySelector('#tabs img'), null);
  click(w, '#openRank');
  assert.equal(w.document.querySelector('#rankList img'), null);
});

test('harmonies : persistance écrite et relecture ancien format (sans totals)', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  const saved = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.equal(saved.players[0].d.champs, 1);
  assert.equal(saved.totals[0], 5);

  const legacy = JSON.stringify({ players: [{ nom: 'Manu', d: { arbre: [0, 0, 1], mont: [0, 0, 0], champs: 0, batiments: 0, face: 'A', riviere: 3, iles: 1, animaux: [4], esprit: 0 } }], cur: 0 });
  const w2 = loadPage('harmonies.html', { 'harmonies-score-v1': legacy });
  assert.equal(grand(w2), '16'); // 7 + 5 + 4
  assert.equal(w2.document.getElementById('pname').value, 'Manu');
});

/* ---------- 7 Wonders ---------- */
test('7 wonders : trésor, science avec joker', () => {
  const w = loadPage('7wonders.html');
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 3);
  for (let i = 0; i < 5; i++) click(w, '[data-step="pieces"][data-by="1"]');
  assert.equal(grand(w), '1');
  click(w, '[data-step="compas"][data-by="1"]');
  click(w, '[data-step="roue"][data-by="1"]');
  click(w, '[data-step="jokers"][data-by="1"]');
  assert.equal(grand(w), '11'); // set complété par le joker : 3×1 + 7, + 1 de trésor
});

test('7 wonders : toggle Cities (carte, 8e joueur, persistance des exts)', () => {
  const w = loadPage('7wonders.html');
  assert.equal(w.document.querySelector('[data-num="cities"]'), null);
  click(w, '[data-ext="cities"]');
  assert.ok(w.document.querySelector('[data-num="cities"]'));
  for (let i = 0; i < 5; i++) { if (w.document.getElementById('addP')) click(w, '#addP'); }
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 8);
  click(w, '[data-ext="cities"]');
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 7);
  const saved = JSON.parse(w.localStorage.getItem('7wonders-score-v1'));
  assert.equal(saved.exts.cities, false);
});

/* ---------- It's a Wonderful World ---------- */
test('iaww : multiplicateurs et personnages', () => {
  const w = loadPage('wonderfulworld.html');
  type(w, '[data-num="fixes"]', '23');
  type(w, '[data-mv="0"]', '2');
  type(w, '[data-mn="0"]', '4');
  assert.equal(grand(w), '31');
  assert.equal(w.document.querySelector('[data-mtot="0"]').textContent, '8');
  click(w, '#addMult');
  assert.equal(w.document.querySelectorAll('[data-mv]').length, 2);
  click(w, '[data-step="financiers"][data-by="1"]');
  assert.equal(grand(w), '32');
});

test('iaww : départage par cartes construites à égalité de points', () => {
  const w = loadPage('wonderfulworld.html');
  type(w, '[data-num="fixes"]', '32');
  click(w, '[data-tab="1"]');
  type(w, '[data-num="fixes"]', '32');
  click(w, '[data-step="cartes"][data-by="1"]');
  click(w, '#openRank');
  const first = w.document.querySelector('#rankList .rank.win .nm').textContent;
  assert.ok(first.startsWith('Joueur 2'));
});
