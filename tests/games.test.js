/* Tests des pages de jeux dans jsdom : le câblage propre à chaque jeu
   (interactions, plafonds, départages, extensions). Les barèmes purs vivent
   dans scores.test.js, le moteur commun dans engine.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadPage, closeAll, click, type, grand} = require('./helpers.js');
const {GAMES, gamePage, gameKey} = require('../lib/registry.js');

test.afterEach(closeAll);

/* ---------- Fumée : chaque jeu du registre ---------- */
/* Attrape une page mal câblée (drawSheet qui jette, hook manquant) même sans
   test dédié — agricola.html n'en avait aucun avant ce balayage. */
for (const {slug} of GAMES) {
  test(`${slug} : la page se charge, total vierge numérique, sauvegarde écrite`, () => {
    const w = loadPage(gamePage(slug));
    assert.match(grand(w), /^-?\d+$/); // jamais NaN ni undefined
    const s = JSON.parse(w.localStorage.getItem(gameKey(slug)));
    assert.ok(Array.isArray(s.players) && s.players.length >= 1);
    assert.equal(!!s.started, false); // visiter n'est pas jouer
  });
}

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

test('7 wonders : départage officiel au trésor (pièces)', () => {
  const w = loadPage('7wonders.html');
  type(w, '[data-num="civils"]', '10');
  click(w, '[data-step="pieces"][data-by="1"]');   // 1 pièce -> 0 pt de trésor
  click(w, '[data-tab="1"]');
  type(w, '[data-num="civils"]', '10');
  click(w, '[data-step="pieces"][data-by="1"]');
  click(w, '[data-step="pieces"][data-by="1"]');   // 2 pièces -> 0 pt aussi
  click(w, '#openRank');
  assert.ok(w.document.querySelector('#rankList .rank.win .nm').textContent.startsWith('Joueur 2'));
  assert.equal(w.document.querySelectorAll('#rankList .rank.win').length, 1);
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
  const el = w.document.getElementById('objAtteint');
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

test('sea salt & paper : départage officiel aux points de la dernière manche', () => {
  const save = JSON.stringify({players: [
    {nom: 'Ana', d: {manches: [10], crabes: 10}},  // manche en cours 5, total 15
    {nom: 'Bob', d: {manches: [5],  crabes: 20}}   // manche en cours 10, total 15
  ], cur: 0, started: true, totals: [15, 15]});
  const w = loadPage('seasaltpaper.html', {'seasaltpaper-score-v1': save});
  click(w, '#openRank');
  assert.ok(w.document.querySelector('#rankList .rank.win .nm').textContent.startsWith('Bob'));
  assert.equal(w.document.querySelectorAll('#rankList .rank.win').length, 1);
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

test('cascadia : ancienne sauvegarde sans flag started — feuille vierge scorée hors joueurs', () => {
  /* load() évalue score(blank(), …) pour dériver started : cette feuille
     vierge n'appartient pas à players, le jeu doit rendre le score brut
     (sans bonus de majorité) au lieu de reposer sur un findIndex à -1 */
  const save = JSON.stringify({players: [{nom: 'Manu', d: {montagnes: 5}}, {nom: 'Léa', d: {}}],
    cur: 0, totals: [7, 0]});
  const w = loadPage('cascadia.html', {'cascadia-score-v1': save});
  assert.equal(grand(w), '7'); // 5 tuiles + 2 de majorité
  assert.equal(JSON.parse(w.localStorage.getItem('cascadia-score-v1')).started, true);
});

/* ---------- Kingdomino ---------- */
test('kingdomino : domaines dynamiques et bonus de variantes', () => {
  const w = loadPage('kingdomino.html');
  type(w, '[data-dc="0"]', '6');
  type(w, '[data-dk="0"]', '2');
  assert.equal(grand(w), '12');
  assert.equal(w.document.querySelector('[data-dtot="0"]').textContent, '12');
  click(w, '#addDom');
  assert.equal(w.document.querySelectorAll('[data-dc]').length, 2);
  type(w, '[data-dc="1"]', '4');
  type(w, '[data-dk="1"]', '1');
  assert.equal(grand(w), '16');
  click(w, '[data-bonus="harmonie"]');
  assert.equal(grand(w), '21');
  click(w, '[data-bonus="milieu"]');
  assert.equal(grand(w), '31');
  click(w, '[data-bonus="harmonie"]'); // désactivé
  assert.equal(grand(w), '26');
  const saved = JSON.parse(w.localStorage.getItem('kingdomino-score-v1'));
  assert.equal(saved.players[0].d.harmonie, false);
  assert.equal(saved.players[0].d.milieu, true);
  click(w, '[data-deldom="0"]');
  assert.equal(grand(w), '14'); // 4×1 + 10
});

test('kingdomino : extension Age of Giants — défis, 5e joueur, bonus remplacés', () => {
  const w = loadPage('kingdomino.html');
  assert.ok(w.document.querySelector('[data-bonus="harmonie"]')); // variantes visibles sans extension
  click(w, '[data-ext="geants"]');
  assert.equal(w.document.querySelector('[data-bonus="harmonie"]'), null); // remplacées par les défis
  type(w, '[data-num="defis.0"]', '12');
  type(w, '[data-num="defis.1"]', '7');
  assert.equal(grand(w), '19');
  assert.ok(JSON.parse(w.localStorage.getItem('kingdomino-score-v1')).exts.geants); // persisté
  // 5e joueur possible avec l'extension
  click(w, '#addP'); click(w, '#addP'); click(w, '#addP');
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 5);
  assert.equal(w.document.getElementById('addP'), null); // plafond atteint
  // désactivation : retour à 4 joueurs max, défis ignorés au total
  click(w, '[data-ext="geants"]');
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 4);
});

test('kingdomino : sauvegarde Age of Giants relue (extension active, défis comptés)', () => {
  const save = JSON.stringify({players: [{nom: 'A', d: {domaines: [{c:3,k:2}], defis: [5,0]}}],
    cur: 0, started: true, totals: [11], exts: {geants: true}});
  const w = loadPage('kingdomino.html', {'kingdomino-score-v1': save});
  assert.equal(grand(w), '11'); // 6 de domaines + 5 de défi
  assert.equal(w.document.querySelector('[data-ext="geants"]').getAttribute('aria-pressed'), 'true');
});

test('kingdomino : départage au plus grand domaine', () => {
  const w = loadPage('kingdomino.html');
  type(w, '[data-dc="0"]', '4'); type(w, '[data-dk="0"]', '3'); // 12 pts, plus grand domaine 4
  click(w, '[data-tab="1"]');
  type(w, '[data-dc="0"]', '6'); type(w, '[data-dk="0"]', '2'); // 12 pts, plus grand domaine 6
  click(w, '#openRank');
  assert.ok(w.document.querySelector('#rankList .rank.win .nm').textContent.startsWith('Joueur 2'));
});

test('kingdomino : égalité de total et de plus grand domaine -> ex æquo', () => {
  const w = loadPage('kingdomino.html');
  type(w, '[data-dc="0"]', '4'); type(w, '[data-dk="0"]', '3');
  click(w, '[data-tab="1"]');
  type(w, '[data-dc="0"]', '4'); type(w, '[data-dk="0"]', '3'); // départage muet
  click(w, '#openRank');
  assert.deepEqual([...w.document.querySelectorAll('#rankList .pos')].map(e => e.textContent),
    ['1', '1']);
  assert.equal(w.document.querySelectorAll('#rankList .rank.win').length, 2);
});

/* ---------- Queendomino ---------- */
test('queendomino : bâtiments, quêtes et pièces par lot de 3', () => {
  const w = loadPage('queendomino.html');
  type(w, '[data-dc="0"]', '4'); type(w, '[data-dk="0"]', '2');
  type(w, '[data-num="batFixes"]', '6');
  type(w, '[data-num="batTours"]', '3');
  type(w, '[data-num="batChevaliers"]', '2');
  type(w, '[data-num="quetes"]', '5');
  for (let i = 0; i < 8; i++) click(w, '[data-step="pieces"][data-by="1"]');
  assert.equal(grand(w), String(8 + 11 + 5 + 2));
});

/* ---------- 7 Wonders Duel ---------- */
test('7 wonders duel : décompte civil, zone militaire exclusive, 2 joueurs max', () => {
  const w = loadPage('7wondersduel.html');
  assert.equal(w.document.querySelectorAll('[data-tab]').length, 2);
  assert.equal(w.document.getElementById('addP'), null); // 2 joueurs max
  type(w, '[data-num="civils"]', '18');
  for (let i = 0; i < 7; i++) click(w, '[data-step="pieces"][data-by="1"]');
  assert.equal(grand(w), '20'); // 18 + 7÷3
  click(w, '[data-zone="5"]');
  assert.equal(grand(w), '25');
  click(w, '[data-zone="2"]'); // les zones s'excluent
  assert.equal(grand(w), '22');
});

test('7 wonders duel : toggles Panthéon/Agora, plafond des temples, persistance des exts', () => {
  const w = loadPage('7wondersduel.html');
  assert.equal(w.document.querySelector('[data-num="divinites"]'), null);
  click(w, '[data-ext="pantheon"]');
  assert.ok(w.document.querySelector('[data-num="divinites"]'));
  for (let i = 0; i < 5; i++) click(w, '[data-step="temples"][data-by="1"]');
  assert.equal(grand(w), '21'); // plafonné à 3 temples
  const saved = JSON.parse(w.localStorage.getItem('7wondersduel-score-v1'));
  assert.equal(saved.players[0].d.temples, 3);
  assert.equal(saved.exts.pantheon, true);
  click(w, '[data-ext="agora"]');
  type(w, '[data-num="senat"]', '6');
  assert.equal(grand(w), '27');
  click(w, '[data-ext="pantheon"]'); // désactivée : ses points ne comptent plus
  assert.equal(grand(w), '6');
});

test('7 wonders duel : stepper des Grands Temples plafonné à 3 (stepMax)', () => {
  const w = loadPage('7wondersduel.html');
  click(w, '[data-ext="pantheon"]');
  for (let i = 0; i < 5; i++) click(w, '[data-step="temples"][data-by="1"]');
  assert.equal(w.document.querySelector('[data-val="temples"]').textContent, '3');
});

test('7 wonders duel : départage aux points civils (bleus)', () => {
  const w = loadPage('7wondersduel.html');
  type(w, '[data-num="civils"]', '10');
  type(w, '[data-num="science"]', '20');
  click(w, '[data-tab="1"]');
  type(w, '[data-num="civils"]', '20');
  type(w, '[data-num="science"]', '10');
  click(w, '#openRank');
  assert.ok(w.document.querySelector('#rankList .rank.win .nm').textContent.startsWith('Joueur 2'));
});

/* ---------- Skyjo ---------- */
test('skyjo : doublement automatique du fermeur, classement au plus petit total', () => {
  const w = loadPage('skyjo.html');
  type(w, '[data-num="manche"]', '8');
  assert.equal(grand(w), '8');
  click(w, '[data-fini]');
  assert.equal(grand(w), '16'); // l'autre joueur est à 0 ≤ 8 : manche doublée
  assert.ok(!w.document.getElementById('doubleInfo').hidden);
  click(w, '#openRank');
  const win = w.document.querySelector('#rankList .rank.win .nm');
  assert.ok(win.textContent.startsWith('Joueur 2')); // 0 pt : le plus petit total gagne
});

test('skyjo : un seul fermeur par manche, valider fige le doublement pour tous', () => {
  const w = loadPage('skyjo.html');
  type(w, '[data-num="manche"]', '8');
  click(w, '[data-fini]');
  click(w, '[data-tab="1"]');
  type(w, '[data-num="manche"]', '3');
  click(w, '[data-fini]'); // le Joueur 2 devient fermeur : le Joueur 1 ne l'est plus
  click(w, '[data-tab="0"]');
  assert.equal(w.document.querySelector('[data-fini]').getAttribute('aria-pressed'), 'false');
  assert.equal(grand(w), '8'); // plus fermeur : plus de doublement
  click(w, '[data-tab="1"]');
  click(w, '#valManche'); // Joueur 2 fermeur avec 3 < 8 : pas doublé
  const saved = JSON.parse(w.localStorage.getItem('skyjo-score-v1'));
  assert.deepEqual(saved.players.map(p => p.d.manches), [[8], [3]]);
  assert.deepEqual(saved.players.map(p => p.d.fini), [0, 0]);
  // manche validée éditable, négatifs permis (cartes de −2 à 12)
  type(w, '[data-manche="0"]', '-4');
  assert.equal(grand(w), '-4');
});

test('skyjo : bandeau de fin de partie quand un cumul atteint 100', () => {
  const save = JSON.stringify({players: [
    {nom: 'Manu', d: {manches: [60, 41], manche: 0, fini: 0}},
    {nom: 'Léa',  d: {manches: [20, 30], manche: 0, fini: 0}}], cur: 0, started: true, totals: [101, 50]});
  const w = loadPage('skyjo.html', {'skyjo-score-v1': save});
  const el = w.document.getElementById('finPartie');
  assert.ok(!el.hidden);
  assert.match(el.textContent, /Manu.*100/);
});

test('skyjo : archive et partage classent au plus petit total', () => {
  const w = loadPage('skyjo.html');
  type(w, '[data-num="manche"]', '12');
  click(w, '[data-tab="1"]');
  type(w, '[data-num="manche"]', '5');
  let shared = null;
  w.navigator.share = data => { shared = data; return Promise.resolve(); };
  click(w, '#openRank'); click(w, '#shareRank');
  assert.deepEqual(shared.text.split('\n').slice(1),
    ['🏆 Joueur 2 — 5 pts', '2. Joueur 1 — 12 pts']);
  click(w, '#resetAll'); // confirm stubbé à true
  const h = JSON.parse(w.localStorage.getItem('scores-history-v1'));
  assert.deepEqual(h[0].players.map(p => [p.nom, p.total]), [['Joueur 2', 5], ['Joueur 1', 12]]);
});

/* ---------- Harmonies : extension Esprits de la nature ---------- */
test('harmonies : extension Esprits de la nature — ligne conditionnelle, points, archive', () => {
  const w = loadPage('harmonies.html');
  assert.equal(w.document.querySelector('[data-num="esprit"]'), null); // masquée sans extension
  click(w, '[data-ext="esprits"]');
  type(w, '[data-num="esprit"]', '4');
  assert.equal(grand(w), '4');
  assert.ok(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).exts.esprits); // persisté
  click(w, '#openRank'); click(w, '#resetAll');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('scores-history-v1'))[0].exts,
    ['Esprits de la nature']);
  // désactivée : la ligne disparaît et ses points ne comptent plus
  const w2 = loadPage('harmonies.html');
  click(w2, '[data-ext="esprits"]');
  type(w2, '[data-num="esprit"]', '4');
  click(w2, '[data-ext="esprits"]');
  assert.equal(grand(w2), '0');
  assert.equal(w2.document.querySelector('[data-num="esprit"]'), null);
});

test('harmonies : sauvegarde d\'avant l\'extension avec esprits saisis -> auto-activée, total conservé', () => {
  const save = JSON.stringify({players: [{nom: 'Manu', d: {champs: 1, esprit: 3}}],
    cur: 0, started: true, totals: [8]});
  const w = loadPage('harmonies.html', {'harmonies-score-v1': save});
  assert.equal(grand(w), '8'); // 5 + 3 : rien n'est perdu
  assert.equal(w.document.querySelector('[data-ext="esprits"]').getAttribute('aria-pressed'), 'true');
  // sans esprit saisi : extension inactive par défaut
  const save2 = JSON.stringify({players: [{nom: 'Manu', d: {champs: 1}}], cur: 0, started: true, totals: [5]});
  const w2 = loadPage('harmonies.html', {'harmonies-score-v1': save2});
  assert.equal(w2.document.querySelector('[data-ext="esprits"]').getAttribute('aria-pressed'), 'false');
});

/* ---------- Flip 7 ---------- */
test('flip7 : re-cliquer une carte posée la retire (correction, jamais de saut)', () => {
  const w = loadPage('flip7.html');
  click(w, '[data-number="12"]');
  click(w, '[data-number="10"]');
  assert.equal(grand(w), '22');
  click(w, '[data-number="12"]'); // re-clic de correction : retrait, pas de saut
  assert.equal(grand(w), '10');
  assert.ok(!w.document.getElementById('sheetBody').textContent.includes('SAUTÉ'));
  click(w, '[data-bonus="+4"]');
  assert.equal(grand(w), '14');
  click(w, '[data-bonus="+4"]'); // les cartes Bonus se retirent aussi
  assert.equal(grand(w), '10');
});

test('flip7 : doublon reçu — sauvé par la Seconde Chance, puis sauté', () => {
  const w = loadPage('flip7.html');
  click(w, '[data-number="12"]');
  click(w, '[data-number="10"]');
  assert.equal(grand(w), '22');
  assert.equal(w.document.getElementById('valNumbers').textContent, '22');
  // carte Seconde Chance en main : le doublon reçu est défaussé, pas de saut
  click(w, '[data-sc]');
  click(w, '[data-dup]');
  assert.equal(grand(w), '22'); // pas de saut, la rangée est intacte
  assert.ok(w.document.getElementById('sheetBody').textContent.includes('Doublon défaussé'));
  assert.equal(w.document.querySelector('[data-sc]').getAttribute('aria-pressed'), 'false'); // consommée
  // un deuxième doublon reçu sans carte : saut, 0 point pour la manche
  click(w, '[data-dup]');
  assert.ok(w.document.getElementById('sheetBody').textContent.includes('SAUTÉ'));
  click(w, '#endRoundBtn');
  assert.equal(grand(w), '0');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('flip7-score-v1')).players[0].d.manches, [0]);
});

test('flip7 : validation de manche, puis édition de la liste', () => {
  const w = loadPage('flip7.html');
  click(w, '[data-number="0"]');
  for (let i = 1; i <= 6; i++) click(w, `[data-number="${i}"]`);
  // 0+1+…+6 : 7 numéros différents (le 0 compte), Flip 7 déclenché
  assert.ok(w.document.getElementById('sheetBody').textContent.includes('FLIP 7'));
  assert.equal(grand(w), '36'); // 1+2+…+6 (le 0 vaut 0) + 15
  // la manche s'arrête : plus aucune carte cliquable
  assert.ok(w.document.querySelector('[data-number="9"]').disabled);
  assert.ok(w.document.querySelector('[data-bonus="+2"]').disabled);
  assert.ok(w.document.querySelector('[data-sc]').disabled);
  click(w, '#endRoundBtn');
  const saved = JSON.parse(w.localStorage.getItem('flip7-score-v1'));
  assert.deepEqual(saved.players[0].d.manches, [36]);
  assert.equal(saved.players[0].d.numbers.length, 0);
  // la manche validée est corrigible dans la liste
  type(w, '[data-manche="0"]', '30');
  assert.equal(grand(w), '30');
});

test('flip7 : bandeau de fin de partie quand un cumul atteint 200', () => {
  const save = JSON.stringify({players: [
    {nom: 'Manu', d: {manches: [120, 85]}},
    {nom: 'Léa',  d: {manches: [40, 30]}}], cur: 0, started: true, totals: [205, 70]});
  const w = loadPage('flip7.html', {'flip7-score-v1': save});
  const el = w.document.getElementById('finPartie');
  assert.ok(!el.hidden);
  assert.match(el.textContent, /Manu.*200/);
  // corriger une manche sous le seuil fait disparaître le bandeau
  type(w, '[data-manche="1"]', '60');
  assert.ok(el.hidden);
  assert.equal(grand(w), '180');
});

test('flip7 : ancienne sauvegarde au total cumulé -> migrée, rien n\'est perdu', () => {
  const save = JSON.stringify({players: [{nom: 'Manu', d: {total: 50, numbers: [12, 10], bonuses: [], isOut: false, hasFlipped: false}}],
    cur: 0, started: true, totals: [72]});
  const w = loadPage('flip7.html', {'flip7-score-v1': save});
  assert.equal(grand(w), '72'); // 50 + 12 + 10
  const saved = JSON.parse(w.localStorage.getItem('flip7-score-v1'));
  assert.deepEqual(saved.players[0].d.manches, [50]);
  assert.equal('total' in saved.players[0].d, false);
  assert.equal(w.document.querySelector('[data-manche="0"]').value, '50');
});

/* ---------- Odin ---------- */
test('odin : cartes restantes en pénalité, validation pour tous, classement inversé', () => {
  const w = loadPage('odin.html');
  for (let i = 0; i < 3; i++) click(w, '[data-step="manche"][data-by="1"]');
  assert.equal(grand(w), '3');
  click(w, '[data-tab="1"]');
  for (let i = 0; i < 5; i++) click(w, '[data-step="manche"][data-by="1"]');
  assert.equal(grand(w), '5');
  click(w, '#valManche'); // la manche physique est commune : tous les onglets d'un coup
  const saved = JSON.parse(w.localStorage.getItem('odin-score-v1'));
  assert.deepEqual(saved.players[0].d.manches, [3]);
  assert.deepEqual(saved.players[1].d.manches, [5]);
  assert.equal(saved.players[0].d.manche, 0);
  assert.ok(w.document.getElementById('finPartie').hidden);
  // lowWins : le plus petit total gagne
  click(w, '#openRank');
  assert.ok(w.document.querySelector('#rankList .rank.win .nm').textContent.startsWith('Joueur 1'));
});

test('odin : bandeau de fin de partie à 15 points de pénalité', () => {
  const save = JSON.stringify({players: [
    {nom: 'Manu', d: {manches: [8, 7]}},
    {nom: 'Léa',  d: {manches: [4, 3]}}], cur: 0, started: true, totals: [15, 7]});
  const w = loadPage('odin.html', {'odin-score-v1': save});
  const el = w.document.getElementById('finPartie');
  assert.ok(!el.hidden);
  assert.match(el.textContent, /Manu.*15/);
  // la manche en cours ne compte jamais : 14 validés + 1 en main = pas de bandeau
  const save2 = JSON.stringify({players: [
    {nom: 'Manu', d: {manches: [14], manche: 1}}], cur: 0, started: true, totals: [15]});
  const w2 = loadPage('odin.html', {'odin-score-v1': save2});
  assert.ok(w2.document.getElementById('finPartie').hidden);
  assert.equal(grand(w2), '15'); // le total affiché comprend la manche en cours
});
