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
  window.confirm = () => true; // jsdom ne l'implémente pas (falsy) — accepter par défaut
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

test('harmonies : Nouvelle partie garde les joueurs, Réinitialiser les remet à zéro', () => {
  const w = loadPage('harmonies.html');
  click(w, '#addP');
  type(w, '#pname', 'Manu');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank'); click(w, '#resetAll');
  assert.equal(grand(w), '0');                                        // scores remis à zéro
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 3); // joueurs conservés
  assert.ok(w.document.getElementById('tabs').textContent.includes('Manu')); // noms conservés
  click(w, '#openRank'); click(w, '#resetPlayers');
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 2); // retour à 2 joueurs
  assert.ok(!w.document.getElementById('tabs').textContent.includes('Manu')); // noms par défaut
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

/* ---------- Sea Salt & Paper ---------- */
test('sea salt & paper : manche calculée, validée, puis dernière chance', () => {
  const w = loadPage('seasaltpaper.html');
  for (let i = 0; i < 4; i++) click(w, '[data-step="poissons"][data-by="1"]');
  assert.equal(grand(w), '2'); // 2 paires
  click(w, '[data-multi="banc"]');
  assert.equal(grand(w), '6'); // + 1 pt par poisson
  click(w, '#addSir');
  type(w, '[data-sir="0"]', '3');
  assert.equal(grand(w), '9');
  click(w, '#valManche'); // la manche passe au cumul, les compteurs repartent à zéro
  assert.equal(grand(w), '9');
  const saved = JSON.parse(w.localStorage.getItem('seasaltpaper-score-v1'));
  assert.deepEqual(saved.players[0].d.manches, [9]);
  assert.equal(saved.players[0].d.poissons, 0);
  assert.deepEqual(saved.players[0].d.sirenes, []);
  // manche suivante : dernière chance perdue -> seul le bonus couleur compte
  click(w, '[data-step="crabes"][data-by="1"]');
  click(w, '[data-step="crabes"][data-by="1"]');
  assert.equal(grand(w), '10'); // 9 + 1 paire
  click(w, '[data-fin="perdu"]');
  assert.equal(grand(w), '9'); // les points de cartes ne comptent plus
  click(w, '[data-step="bonus"][data-by="1"]');
  assert.equal(grand(w), '10'); // 9 + bonus couleur
});

test('sea salt & paper : bandeau de fin de partie sur les manches validées seulement', () => {
  const save = m => JSON.stringify({players: [{nom: 'Manu', d: {manches: m}}, {nom: 'Léa', d: {}}], cur: 0, started: true, totals: [0, 0]});
  // 40 points validés à 2 joueurs : bandeau visible, nom et objectif affichés
  let w = loadPage('seasaltpaper.html', {'seasaltpaper-score-v1': save([25, 15])});
  let el = w.document.getElementById('objAtteint');
  assert.ok(!el.hidden);
  assert.ok(el.textContent.includes('Manu'));
  assert.ok(el.textContent.includes('40'));
  // 39 points : rien
  w = loadPage('seasaltpaper.html', {'seasaltpaper-score-v1': save([25, 14])});
  assert.ok(w.document.getElementById('objAtteint').hidden);
  // la manche en cours ne compte pas : 36 validés + 5 en cours -> toujours rien
  w = loadPage('seasaltpaper.html', {'seasaltpaper-score-v1': save([36])});
  for (let i = 0; i < 10; i++) click(w, '[data-step="crabes"][data-by="1"]'); // 5 paires
  assert.equal(grand(w), '41');
  assert.ok(w.document.getElementById('objAtteint').hidden);
  // à 3 joueurs l'objectif descend à 35 : le bandeau bascule après l'ajout
  click(w, '#addP');
  assert.ok(!w.document.getElementById('objAtteint').hidden);
  click(w, '#openRank');
  assert.ok(w.document.getElementById('rankList').textContent.includes('objectif atteint'));
});

test('sea salt & paper : steppers de collections plafonnés au paquet', () => {
  const w = loadPage('seasaltpaper.html');
  for (let i = 0; i < 5; i++) click(w, '[data-step="marins"][data-by="1"]');
  const d = JSON.parse(w.localStorage.getItem('seasaltpaper-score-v1')).players[0].d;
  assert.equal(d.marins, 2); // 2 marins dans le paquet
  assert.equal(grand(w), '5');
});

/* ---------- Accueil : aperçu « Partie en cours » ---------- */
test('accueil : visiter une feuille ne déclenche pas « Partie en cours »', () => {
  // sauvegarde TM créée par une simple visite : totaux à 20 (NT), aucune saisie
  const visite = JSON.stringify({players:[{nom:'Joueur 1',d:{}},{nom:'Joueur 2',d:{}}], cur:0, started:false, totals:[20,20]});
  const vraie = JSON.stringify({players:[{nom:'Manu',d:{}}], cur:0, started:true, totals:[42]});
  const w = loadPage('index.html', {'terraformingmars-score-v1': visite, 'harmonies-score-v1': vraie});
  assert.ok(!w.document.querySelector('[data-sub="terraformingmars"]').textContent.includes('Partie en cours'));
  assert.ok(w.document.querySelector('[data-sub="terraformingmars"]').textContent.includes('NT')); // sous-titre du registre
  assert.ok(w.document.querySelector('[data-sub="harmonies"]').textContent.includes('Partie en cours · Manu 42'));
});

test('le flag started ne s\'active qu\'à une vraie saisie de score', () => {
  const w = loadPage('terraformingmars.html');
  click(w, '#addP'); // provoque une sauvegarde, mais sans saisie de score
  let saved = JSON.parse(w.localStorage.getItem('terraformingmars-score-v1'));
  assert.equal(!!saved.started, false);
  click(w, '[data-step="objectifs"][data-by="1"]');
  saved = JSON.parse(w.localStorage.getItem('terraformingmars-score-v1'));
  assert.equal(saved.started, true);
  click(w, '#openRank'); click(w, '#resetAll'); // nouvelle partie -> flag remis à zéro
  saved = JSON.parse(w.localStorage.getItem('terraformingmars-score-v1'));
  assert.equal(saved.started, false);
});

test('anciennes sauvegardes sans flag : dérivé de l\'écart à la feuille vierge', () => {
  // harmonies avec des points (ancien format) -> considérée commencée
  const legacy = JSON.stringify({players:[{nom:'Manu',d:{champs:2}}], cur:0, totals:[10]});
  const w = loadPage('harmonies.html', {'harmonies-score-v1': legacy});
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).started, true);
});

/* ---------- Terraforming Mars ---------- */
test('terraforming mars : NT de départ et 2e place selon le nombre de joueurs', () => {
  const w = loadPage('terraformingmars.html');
  assert.equal(grand(w), '20'); // NT de départ
  assert.equal(w.document.querySelector('[data-step="sec"]'), null); // 2 joueurs : pas de 2e place
  click(w, '#addP'); // 3 joueurs → la ligne apparaît
  assert.ok(w.document.querySelector('[data-step="sec"]'));
  click(w, '[data-step="sec"][data-by="1"]');
  assert.equal(grand(w), '22'); // 20 + 2
  click(w, '#kill'); // retour à 2 joueurs
  assert.equal(w.document.querySelector('[data-step="sec"]'), null);
});

/* ---------- Cascadia ---------- */
test('cascadia : les bonus de majorité se recalculent entre joueurs', () => {
  const w = loadPage('cascadia.html');
  for (let i = 0; i < 5; i++) click(w, '[data-step="montagnes"][data-by="1"]');
  assert.equal(grand(w), '7'); // 5 tuiles + 2 de majorité (2 joueurs)
  click(w, '[data-tab="1"]');
  for (let i = 0; i < 6; i++) click(w, '[data-step="montagnes"][data-by="1"]');
  assert.equal(grand(w), '8'); // 6 + 2 : la majorité a changé de main
  click(w, '[data-tab="0"]');
  assert.equal(grand(w), '5'); // le joueur 1 a perdu son bonus
  click(w, '[data-step="montagnes"][data-by="1"]');
  assert.equal(grand(w), '7'); // 6 + 1 : égalité au plus grand corridor
});

/* ---------- Steppers : appui long ---------- */
test('steppers : l\'appui long répète, le clic du relâchement ne compte pas double', async () => {
  const w = loadPage('harmonies.html');
  const btn = w.document.querySelector('[data-step="champs"][data-by="1"]');
  btn.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  await new Promise(r => setTimeout(r, 750)); // 400ms d'armement + quelques répétitions
  w.document.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  const held = JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].d.champs;
  assert.ok(held >= 2, `attendu au moins 2 crans, obtenu ${held}`);
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); // le clic natif émis au relâchement
  let d = JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].d;
  assert.equal(d.champs, held); // neutralisé : pas de cran en plus
  // un tap court reste un incrément simple
  btn.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  w.document.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d = JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].d;
  assert.equal(d.champs, held + 1);
});

/* ---------- Historique des parties ---------- */
test('reset : la partie est archivée dans scores-history-v1, classée', () => {
  const w = loadPage('harmonies.html');
  type(w, '#pname', 'Manu');
  click(w, '[data-step="champs"][data-by="1"]');   // Manu : 5 pts
  click(w, '[data-tab="1"]');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '[data-step="champs"][data-by="1"]');   // Joueur 2 : 10 pts
  click(w, '#openRank'); click(w, '#resetAll');
  const h = JSON.parse(w.localStorage.getItem('scores-history-v1'));
  assert.equal(h.length, 1);
  assert.equal(h[0].g, 'harmonies');
  assert.ok(h[0].t > 0);
  assert.deepEqual(h[0].players, [{nom: 'Joueur 2', total: 10}, {nom: 'Manu', total: 5}]);
  assert.equal(grand(w), '0'); // et la feuille repart bien à zéro
});

test('reset sans aucune saisie : rien n\'est archivé', () => {
  const w = loadPage('terraformingmars.html');
  click(w, '#openRank'); click(w, '#resetAll');
  assert.equal(w.localStorage.getItem('scores-history-v1'), null);
});

test('partie « oubliée » terminée plus tard : archivée à la date de la sauvegarde', () => {
  const save = JSON.stringify({players: [{nom: 'Manu', d: {champs: 2}}], cur: 0, started: true, totals: [10], ts: 12345});
  // rouverte juste pour terminer : aucune saisie -> datée du ts sauvegardé
  const w = loadPage('harmonies.html', {'harmonies-score-v1': save});
  click(w, '#openRank'); click(w, '#resetAll');
  assert.equal(JSON.parse(w.localStorage.getItem('scores-history-v1'))[0].t, 12345);
  // même sauvegarde mais une saisie avant le reset -> datée de maintenant
  const w2 = loadPage('harmonies.html', {'harmonies-score-v1': save});
  click(w2, '[data-step="champs"][data-by="1"]');
  click(w2, '#openRank'); click(w2, '#resetAll');
  assert.ok(JSON.parse(w2.localStorage.getItem('scores-history-v1'))[0].t > 12345);
});

/* ---------- Confirmations destructrices ---------- */
test('réinitialiser les joueurs : confirmation requise si la partie est commencée', () => {
  const w = loadPage('harmonies.html');
  type(w, '#pname', 'Manu');
  click(w, '[data-step="champs"][data-by="1"]');
  w.confirm = () => false; // refus
  click(w, '#openRank'); click(w, '#resetPlayers');
  assert.equal(grand(w), '5'); // rien n'a bougé
  assert.ok(w.document.getElementById('tabs').textContent.includes('Manu'));
  assert.equal(w.localStorage.getItem('scores-history-v1'), null); // rien archivé
  w.confirm = () => true; // accepté
  click(w, '#resetPlayers');
  assert.equal(grand(w), '0');
  assert.ok(!w.document.getElementById('tabs').textContent.includes('Manu'));
  assert.equal(JSON.parse(w.localStorage.getItem('scores-history-v1')).length, 1);
});

test('retirer un joueur : confirmation seulement si sa feuille n\'est pas vierge', () => {
  const w = loadPage('harmonies.html');
  let asked = 0;
  w.confirm = () => { asked++; return true; };
  click(w, '#kill'); // joueur vierge : retiré sans question
  assert.equal(asked, 0);
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 1);
  click(w, '#addP');
  click(w, '[data-step="champs"][data-by="1"]');
  w.confirm = () => { asked++; return false; };
  click(w, '#kill'); // joueur avec des scores, refus : toujours là
  assert.equal(asked, 1);
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 2);
  assert.equal(grand(w), '5');
});

/* ---------- Lien vers les règles officielles ---------- */
test('feuilles : lien règles du registre dans le header', () => {
  const {GAMES} = require('../lib/registry.js');
  const w = loadPage('harmonies.html');
  const a = w.document.querySelector('header a.rules');
  assert.ok(a, 'lien .rules absent du header');
  assert.equal(a.getAttribute('href'), GAMES.find(g => g.slug === 'harmonies').rules);
  assert.equal(a.getAttribute('target'), '_blank');
});

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

/* ---------- Menu par usage, noms mémorisés, statistiques ---------- */
test('accueil : menu ordonné par dernière utilisation, Historique en dernier', () => {
  const save = ts => JSON.stringify({players: [{nom: 'Manu', d: {}}], cur: 0, started: false, totals: [0], ts});
  const w = loadPage('index.html', {'cascadia-score-v1': save(2000), 'agricola-score-v1': save(1000)});
  const hrefs = [...w.document.querySelectorAll('a.game')].map(a => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['cascadia.html', 'agricola.html', // par ts décroissant
    'harmonies.html', '7wonders.html', 'wonderfulworld.html', 'terraformingmars.html', 'seasaltpaper.html']); // jamais ouverts : ordre du registre
  assert.ok(w.document.querySelector('a.tool[href="history.html"]')); // l'Historique vit dans le header
});

test('une interaction écrit ts (dernière utilisation) dans la sauvegarde', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  assert.ok(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).ts > 0);
});

test('feuilles : suggestions de noms depuis l\'historique (datalist)', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 2, players: [{nom: 'Léa', total: 80}, {nom: 'Joueur 2', total: 60}]},
    {g: 'harmonies', t: 1, players: [{nom: 'Manu', total: 50}, {nom: 'Léa', total: 40}]}
  ]);
  const w = loadPage('harmonies.html', {'scores-history-v1': hist});
  const opts = [...w.document.querySelectorAll('#pnames option')].map(o => o.value);
  assert.deepEqual(opts, ['Léa', 'Manu']); // uniques, ordre de récence, « Joueur N » exclus
});

test('history.html : carte Statistiques (victoires, record), absente si vide', () => {
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
  assert.ok(rows[0].textContent.includes('record 112 (Harmonies)'));
  const w2 = loadPage('history.html');
  assert.equal(w2.document.getElementById('statsCard').innerHTML, '');
});

/* ---------- Export / import des sauvegardes (page Historique) ---------- */
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
