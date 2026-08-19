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

test('terminer la partie demande confirmation quand des scores sont saisis', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  w.confirm = () => false;
  click(w, '#openRank'); click(w, '#resetAll');
  assert.equal(grand(w), '5'); // refus : rien ne bouge, rien n'est archivé
  assert.equal(w.localStorage.getItem('scores-history-v1'), null);
  w.confirm = () => true;
  click(w, '#resetAll');
  assert.equal(grand(w), '0');
  assert.equal(JSON.parse(w.localStorage.getItem('scores-history-v1')).length, 1);
});

test('annulation : chaque geste est annulable, bouton masqué pile vide', () => {
  const w = loadPage('harmonies.html');
  assert.ok(w.document.getElementById('undoBtn').hidden);
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '[data-step="arbre.2"][data-by="1"]');
  assert.equal(grand(w), '12'); // 5 + 7
  assert.ok(!w.document.getElementById('undoBtn').hidden);
  click(w, '#undoBtn');
  assert.equal(grand(w), '5');
  click(w, '#undoBtn');
  assert.equal(grand(w), '0');
  assert.ok(w.document.getElementById('undoBtn').hidden);
});

test('annulation : une série de frappes dans un même champ = un seul cran', () => {
  const w = loadPage('wonderfulworld.html');
  type(w, '[data-num="fixes"]', '4');
  type(w, '[data-num="fixes"]', '42');
  assert.equal(grand(w), '42');
  click(w, '#undoBtn');
  assert.equal(grand(w), '0'); // retour avant la saisie entière, pas frappe par frappe
});

test('annulation : un toggle d\'extension (état hors feuille) est annulable', () => {
  const w = loadPage('7wonders.html');
  click(w, '[data-ext="leaders"]');
  assert.equal(w.document.querySelector('[data-ext="leaders"]').getAttribute('aria-pressed'), 'true');
  click(w, '#undoBtn');
  assert.equal(w.document.querySelector('[data-ext="leaders"]').getAttribute('aria-pressed'), 'false');
});

test('annulation : la pile est vidée quand la partie se termine', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank'); click(w, '#resetAll'); // confirm stubbé à true
  assert.ok(w.document.getElementById('undoBtn').hidden);
});

/* ---------- Partage du classement ---------- */
test('partage : bouton masqué sans score ou sans canal, texte partagé correct', () => {
  const w = loadPage('harmonies.html');
  click(w, '#openRank');
  assert.ok(w.document.getElementById('shareRank').hidden); // aucun score saisi
  click(w, '#closeRank');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank');
  assert.ok(w.document.getElementById('shareRank').hidden); // jsdom : ni share ni clipboard
  click(w, '#closeRank');

  let shared = null;
  w.navigator.share = data => { shared = data; return Promise.resolve(); };
  click(w, '#openRank');
  assert.ok(!w.document.getElementById('shareRank').hidden);
  click(w, '#shareRank');
  const lines = shared.text.split('\n');
  assert.equal(lines[0], 'Harmonies — ' + new w.Date().toLocaleDateString('fr-FR'));
  assert.equal(lines[1], '🏆 Joueur 1 — 5 pts');
  assert.equal(lines[2], '2. Joueur 2 — 0 pts');
});

test('partage : ex æquo tous vainqueurs, solo sans position', () => {
  const w = loadPage('harmonies.html');
  let shared = null;
  w.navigator.share = data => { shared = data; return Promise.resolve(); };
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '[data-tab="1"]');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank'); click(w, '#shareRank');
  assert.deepEqual(shared.text.split('\n').slice(1),
    ['🏆 Joueur 1 — 5 pts', '🏆 Joueur 2 — 5 pts']);
  click(w, '#closeRank');
  click(w, '#kill'); // confirm stubbé à true — reste un seul joueur
  click(w, '#openRank'); click(w, '#shareRank');
  assert.deepEqual(shared.text.split('\n').slice(1), ['Joueur 1 — 5 pts']);
});

test('partage : repli presse-papier avec confirmation sur le bouton', async () => {
  const w = loadPage('harmonies.html');
  let copied = null;
  w.navigator.clipboard = { writeText: t => { copied = t; return Promise.resolve(); } };
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank'); click(w, '#shareRank');
  await new Promise(r => setImmediate(r)); // laisser la promesse de copie se résoudre
  assert.match(copied, /^Harmonies — /);
  assert.equal(w.document.getElementById('shareRank').textContent, 'Classement copié ✓');
});

test('partage : les extensions actives figurent dans l\'en-tête', () => {
  const w = loadPage('7wonders.html');
  let shared = null;
  w.navigator.share = data => { shared = data; return Promise.resolve(); };
  click(w, '[data-ext="leaders"]');
  click(w, '[data-ext="armada"]');
  click(w, '#openRank'); click(w, '#shareRank');
  assert.match(shared.text.split('\n')[0], /^7 Wonders \(Leaders, Armada\) — /);
});

/* ---------- Accessibilité ---------- */
test('accessibilité : classement en dialog, focus géré, Escape ferme', () => {
  const w = loadPage('harmonies.html');
  const dlg = w.document.querySelector('#rankSheet [role="dialog"]');
  assert.ok(dlg, 'panel du classement sans role=dialog');
  assert.equal(dlg.getAttribute('aria-modal'), 'true');
  click(w, '#openRank');
  assert.equal(w.document.activeElement, w.document.getElementById('closeRank')); // focus dans le dialog
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  assert.ok(!w.document.getElementById('rankSheet').classList.contains('open'));
  assert.equal(w.document.activeElement, w.document.getElementById('openRank')); // focus rendu à l'ouvreur
});

test('accessibilité : total en aria-live, tablist branché sur le tabpanel', () => {
  const w = loadPage('harmonies.html');
  assert.ok(w.document.querySelector('.bar .tot[aria-live="polite"]'));
  assert.equal(w.document.getElementById('sheetBody').getAttribute('role'), 'tabpanel');
  assert.equal(w.document.querySelector('#tabs .tab').getAttribute('aria-controls'), 'sheetBody');
});

test('accessibilité : flèches gauche/droite dans les onglets joueurs', () => {
  const w = loadPage('harmonies.html');
  const tabs = w.document.querySelectorAll('#tabs .tab');
  tabs[0].focus();
  const arrow = key => w.document.getElementById('tabs')
    .dispatchEvent(new w.KeyboardEvent('keydown', {key, bubbles: true}));
  arrow('ArrowRight');
  assert.equal(w.document.activeElement, tabs[1]);
  arrow('ArrowLeft');
  assert.equal(w.document.activeElement, tabs[0]);
  arrow('ArrowLeft'); // circulaire : revient au dernier (le bouton +)
  assert.equal(w.document.activeElement, tabs[tabs.length - 1]);
});

test('écriture localStorage impossible : bannière « sauvegarde impossible »', () => {
  const w = loadPage('harmonies.html');
  assert.equal(w.document.querySelector('.storage-warn'), null);
  w.Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  click(w, '[data-step="champs"][data-by="1"]');
  const warn = w.document.querySelector('.storage-warn');
  assert.ok(warn, 'bannière .storage-warn absente après un échec de sauvegarde');
  assert.match(warn.textContent, /[Ss]auvegarde impossible/);
  click(w, '[data-step="champs"][data-by="1"]'); // second échec : pas de doublon
  assert.equal(w.document.querySelectorAll('.storage-warn').length, 1);
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

test('7 wonders duel : stepper des Grands Temples plafonné à 3 (stepMax)', () => {
  const w = loadPage('7wondersduel.html');
  click(w, '[data-ext="pantheon"]');
  for (let i = 0; i < 5; i++) click(w, '[data-step="temples"][data-by="1"]');
  assert.equal(w.document.querySelector('[data-val="temples"]').textContent, '3');
});

/* ---------- Joueurs : ordre du tour et couleurs ---------- */
test('joueurs : réordonner le joueur courant (scores et sélection suivent), annulable', () => {
  const w = loadPage('harmonies.html');
  type(w, '#pname', 'Manu');
  click(w, '[data-step="champs"][data-by="1"]'); // Manu : 5 pts, en position 1
  assert.ok(w.document.getElementById('mvL').disabled);   // déjà premier
  assert.ok(!w.document.getElementById('mvR').disabled);
  click(w, '#mvR');
  const tabs = [...w.document.querySelectorAll('[data-tab]')];
  assert.ok(tabs[1].textContent.includes('Manu')); // passé en position 2
  assert.equal(grand(w), '5');                     // toujours sélectionné, avec ses points
  assert.ok(w.document.getElementById('mvR').disabled); // désormais dernier
  const saved = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.equal(saved.players[1].nom, 'Manu'); // ordre persisté
  click(w, '#undoBtn');
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].nom, 'Manu');
});

test('joueurs : tap sur la pastille = couleur libre suivante, jamais celle d\'un autre', () => {
  const w = loadPage('harmonies.html'); // couleurs initiales : 0 et 1
  click(w, '#swatch'); // joueur 1 : 0 -> saute 1 (pris) -> 2
  let s = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.equal(s.players[0].c, 2);
  assert.equal(s.players[1].c, 1);
  click(w, '[data-tab="1"]');
  click(w, '#swatch'); // joueur 2 : 1 -> saute 2 (pris) -> 3
  s = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.equal(s.players[1].c, 3);
});

test('joueurs : ancienne sauvegarde sans couleurs relue avec les couleurs par position', () => {
  const legacy = JSON.stringify({players: [{nom: 'A', d: {}}, {nom: 'B', d: {}}], cur: 0, started: true, totals: [0, 0]});
  const w = loadPage('harmonies.html', {'harmonies-score-v1': legacy});
  const s = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.deepEqual(s.players.map(p => p.c), [0, 1]);
});

/* ---------- Thème ---------- */
test('thème : choix persisté appliqué avant le rendu, cycle du bouton, metas alignées', () => {
  const w = loadPage('index.html', {'scores-theme-v1': 'dark'});
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  w.document.querySelectorAll('meta[name="theme-color"]').forEach(m => assert.equal(m.content, '#141414'));
  click(w, '#themeBtn'); // sombre -> clair
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  assert.equal(w.localStorage.getItem('scores-theme-v1'), 'light');
  w.document.querySelectorAll('meta[name="theme-color"]').forEach(m => assert.equal(m.content, '#F4F4F1'));
  click(w, '#themeBtn'); // clair -> automatique
  assert.equal(w.document.documentElement.dataset.theme, undefined);
  assert.equal(w.localStorage.getItem('scores-theme-v1'), null);
  w.document.querySelectorAll('meta[name="theme-color"]').forEach(m =>
    assert.equal(m.content, m.getAttribute('media').includes('dark') ? '#141414' : '#F4F4F1')); // retour aux media queries
  click(w, '#themeBtn'); // automatique -> sombre
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  // une seule icône visible à la fois (hidden est sans effet sur les SVG — bug vu en prod)
  const visibles = [...w.document.querySelectorAll('#themeBtn [data-mode]')]
    .filter(el => el.style.display !== 'none');
  assert.equal(visibles.length, 1);
  assert.equal(visibles[0].dataset.mode, 'dark');
});

test('thème : les feuilles appliquent aussi le choix enregistré', () => {
  const w = loadPage('harmonies.html', {'scores-theme-v1': 'light'});
  assert.equal(w.document.documentElement.dataset.theme, 'light');
});

/* ---------- Multi-onglets ---------- */
test('multi-onglets : une écriture externe recharge la feuille au lieu de l\'écraser', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  // un autre onglet écrit un nouvel état (l'événement storage ne vient jamais de l'onglet écrivain)
  const autre = JSON.stringify({players: [{nom: 'Ailleurs', d: {}}], cur: 0, started: true, totals: [0], ts: 1});
  w.localStorage.setItem('harmonies-score-v1', autre);
  w.dispatchEvent(new w.StorageEvent('storage', {key: 'harmonies-score-v1'}));
  assert.equal(w.document.getElementById('pname').value, 'Ailleurs');
  assert.ok(w.document.getElementById('undoBtn').hidden); // pile d'annulation vidée
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
  assert.deepEqual(h[0].players.map(p => ({nom: p.nom, total: p.total})),
    [{nom: 'Joueur 2', total: 10}, {nom: 'Manu', total: 5}]); // la ventilation (parts) est testée à part
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

test('accueil : cartes générées depuis le registre, vignettes clonées', () => {
  const w = loadPage('index.html');
  const {GAMES} = require('../lib/registry.js');
  const cards = w.document.querySelectorAll('a.game');
  assert.equal(cards.length, GAMES.length);
  for (const card of cards){
    assert.ok(card.querySelector('.thumb svg'), `${card.getAttribute('href')} sans vignette SVG`);
    assert.ok(card.querySelector('b').textContent.length > 0);
  }
});

/* ---------- Menu par usage, noms mémorisés, statistiques ---------- */
test('accueil : menu ordonné par dernière utilisation, Historique en dernier', () => {
  const save = ts => JSON.stringify({players: [{nom: 'Manu', d: {}}], cur: 0, started: false, totals: [0], ts});
  const w = loadPage('index.html', {'cascadia-score-v1': save(2000), 'agricola-score-v1': save(1000)});
  const hrefs = [...w.document.querySelectorAll('a.game')].map(a => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['cascadia.html', 'agricola.html', // par ts décroissant
    'harmonies.html', '7wonders.html', 'wonderfulworld.html', 'terraformingmars.html', 'seasaltpaper.html',
    'kingdomino.html', 'queendomino.html', '7wondersduel.html']); // jamais ouverts : ordre du registre
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

test('history.html : carte Statistiques (victoires, taux, record du jeu le plus joué), absente si vide', () => {
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
  assert.ok(rows[0].textContent.includes('50 % de victoires'));
  // record du jeu le plus joué (égalité 1-1 -> le plus récent : Cascadia), pas le max inter-jeux
  assert.ok(rows[0].textContent.includes('record 70 (Cascadia)'));
  const w2 = loadPage('history.html');
  assert.equal(w2.document.getElementById('statsCard').innerHTML, '');
});

test('archive : la ventilation [libellé, valeur] de chaque joueur est conservée', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank'); click(w, '#resetAll'); // confirm stubbé à true
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.ok(Array.isArray(e.players[0].parts), 'parts manquant sur le vainqueur');
  assert.ok(e.players[0].parts.some(x => x[1] === 5)); // le champ saisi vaut 5 pts
  assert.equal(e.players[1].parts, undefined); // joueur sans point : pas de ventilation
});

test('history.html : détail archivé replié par défaut, déplié au toucher, échappé', () => {
  const hist = JSON.stringify([{g: 'harmonies', t: 1, players: [
    {nom: 'Manu', total: 12, parts: [['Arbres', 7], ['<img src=x onerror=alert(1)>', 5]], extra: ' · 3 jetons'},
    {nom: 'Léa', total: 8} // ancienne entrée sans parts : tolérée
  ]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const card = w.document.querySelector('#historyList .card');
  assert.ok(card.classList.contains('hasDetail'));
  assert.ok(!card.classList.contains('open')); // replié par défaut (CSS)
  assert.ok(card.querySelector('.nm small').textContent.includes('Arbres 7'));
  assert.ok(card.querySelector('.nm small').textContent.includes('3 jetons'));
  assert.equal(card.querySelector('.nm small img'), null); // parts importées échappées
  click(w, '#historyList .card h2');
  assert.ok(card.classList.contains('open'));
  click(w, '#historyList .card h2');
  assert.ok(!card.classList.contains('open'));
});

test('history.html : édition d\'une entrée (nom, total), re-triée au total', () => {
  const hist = JSON.stringify([{g: 'cascadia', t: 1, players: [
    {nom: 'Manu', total: 50}, {nom: 'Lae', total: 40}
  ]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  click(w, '[data-edit="0"]');
  assert.ok(w.document.querySelector('[data-enom="0"]')); // mode édition
  w.document.querySelector('[data-enom="1"]').value = 'Léa';
  w.document.querySelector('[data-etot="1"]').value = '60';
  click(w, '[data-esave="0"]');
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.deepEqual(e.players.map(p => [p.nom, p.total]), [['Léa', 60], ['Manu', 50]]);
  const rows = w.document.querySelectorAll('#historyList .rank');
  assert.ok(rows[0].textContent.includes('Léa')); // re-rendu, nouveau vainqueur en tête
});

test('history.html : suppression d\'une seule entrée, avec confirmation', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 2, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 1, players: [{nom: 'Léa', total: 112}, {nom: 'Manu', total: 90}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  w.confirm = () => false;
  click(w, '[data-del="0"]');
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 2); // refus : rien ne bouge
  w.confirm = () => true;
  click(w, '[data-del="0"]');
  const h = JSON.parse(w.localStorage.getItem('scores-history-v1'));
  assert.equal(h.length, 1);
  assert.equal(h[0].g, 'harmonies'); // c'est bien la 1re entrée qui a sauté
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 1);
});

test('history.html : bouton CSV visible seulement avec des parties', () => {
  const w = loadPage('history.html');
  assert.ok(w.document.getElementById('csvBtn').hidden);
  const w2 = loadPage('history.html',
    {'scores-history-v1': JSON.stringify([{g: 'cascadia', t: 1, players: [{nom: 'Manu', total: 1}]}])});
  assert.ok(!w2.document.getElementById('csvBtn').hidden);
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

/* ---------- Ex æquo : positions partagées (1, 1, 3) ---------- */
test('ex æquo sans départage : positions partagées au classement et figées à l\'archive', () => {
  const w = loadPage('harmonies.html');
  click(w, '#addP'); // 3 joueurs, le 3e reste à 0
  click(w, '[data-tab="0"]');
  click(w, '[data-step="champs"][data-by="1"]');   // Joueur 1 : 5
  click(w, '[data-tab="1"]');
  click(w, '[data-step="champs"][data-by="1"]');   // Joueur 2 : 5
  click(w, '#openRank');
  assert.deepEqual([...w.document.querySelectorAll('#rankList .pos')].map(e => e.textContent),
    ['1', '1', '3']);
  assert.equal(w.document.querySelectorAll('#rankList .rank.win').length, 2);
  click(w, '#resetAll');
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.equal(e.players[0].pos, undefined); // égal au rang : non écrit
  assert.equal(e.players[1].pos, 1);         // ex æquo figé
  assert.equal(e.players[2].pos, undefined);
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

test('history.html : positions figées rendues, plusieurs vainqueurs surlignés', () => {
  const hist = JSON.stringify([
    {g: 'harmonies', t: 2, players: [
      {nom: 'Manu', total: 80}, {nom: 'Léa', total: 80, pos: 1}, {nom: 'Bob', total: 60, pos: 3}]},
    {g: 'cascadia', t: 1, players: [{nom: 'Manu', total: 50}, {nom: 'Léa', total: 40}]} // ancienne entrée sans pos
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const cards = w.document.querySelectorAll('#historyList .card');
  assert.deepEqual([...cards[0].querySelectorAll('.pos')].map(e => e.textContent), ['1', '1', '3']);
  assert.equal(cards[0].querySelectorAll('.rank.win').length, 2);
  assert.equal(cards[1].querySelectorAll('.rank.win').length, 1); // comportement d'avant
});

test('history.html : édition — pos recalculé par égalité de total, obsolète purgé', () => {
  const hist = JSON.stringify([{g: 'cascadia', t: 1, players: [
    {nom: 'Manu', total: 50}, {nom: 'Léa', total: 40, pos: 1} // pos incohérent volontaire
  ]}]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  click(w, '[data-edit="0"]');
  w.document.querySelector('[data-etot="1"]').value = '50'; // égalité après édition
  click(w, '[data-esave="0"]');
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.equal(e.players[0].pos, undefined);
  assert.equal(e.players[1].pos, 1);
  assert.equal(w.document.querySelectorAll('#historyList .rank.win').length, 2);
});

/* ---------- Extensions recopiées dans l'historique ---------- */
test('archive : extensions actives recopiées en libellés lisibles', () => {
  const w = loadPage('7wonders.html');
  click(w, '[data-ext="leaders"]');
  click(w, '[data-ext="cities"]');
  type(w, '[data-num="civils"]', '10');
  click(w, '#openRank'); click(w, '#resetAll');
  assert.deepEqual(JSON.parse(w.localStorage.getItem('scores-history-v1'))[0].exts,
    ['Leaders', 'Cities']);

  const w2 = loadPage('kingdomino.html');
  click(w2, '[data-ext="geants"]');
  type(w2, '[data-dc="0"]', '4'); type(w2, '[data-dk="0"]', '2');
  click(w2, '#openRank'); click(w2, '#resetAll');
  assert.deepEqual(JSON.parse(w2.localStorage.getItem('scores-history-v1'))[0].exts,
    ['Age of Giants']);
});

test('archive : extension désactivée ou jeu sans extension -> pas de champ exts', () => {
  const w = loadPage('kingdomino.html');
  click(w, '[data-ext="geants"]');
  click(w, '[data-ext="geants"]'); // désactivée avant la fin
  type(w, '[data-dc="0"]', '4'); type(w, '[data-dk="0"]', '2');
  click(w, '#openRank'); click(w, '#resetAll');
  assert.equal(JSON.parse(w.localStorage.getItem('scores-history-v1'))[0].exts, undefined);

  const w2 = loadPage('harmonies.html'); // extension présente mais inactive
  click(w2, '[data-step="champs"][data-by="1"]');
  click(w2, '#openRank'); click(w2, '#resetAll');
  assert.equal(JSON.parse(w2.localStorage.getItem('scores-history-v1'))[0].exts, undefined);
});

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

test('history.html : extensions dans le détail replié, échappées, dépliable sans parts', () => {
  const hist = JSON.stringify([{g: '7wonders', t: 1, exts: ['Cities', '<img src=x onerror=alert(1)>'],
    players: [{nom: 'Manu', total: 50}, {nom: 'Léa', total: 40}]}]); // aucun parts
  const w = loadPage('history.html', {'scores-history-v1': hist});
  const card = w.document.querySelector('#historyList .card');
  assert.ok(card.classList.contains('hasDetail')); // dépliable grâce aux extensions seules
  assert.ok(!card.classList.contains('open'));     // replié par défaut (CSS)
  assert.ok(card.querySelector('.exts').textContent.includes('Cities'));
  assert.equal(card.querySelector('.exts img'), null); // libellés importés échappés
  click(w, '#historyList .card h2');
  assert.ok(card.classList.contains('open'));
});

/* ---------- Filtres de l'historique ---------- */
const setFilter = (w, id, val) => {
  const sel = w.document.getElementById(id);
  sel.value = val;
  sel.dispatchEvent(new w.Event('change', {bubbles: true}));
};

test('history.html : filtres par jeu et par joueur — liste, stats et compteur filtrés', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 3, players: [{nom: 'Manu', total: 84}, {nom: 'Léa', total: 70}]},
    {g: 'harmonies', t: 2, players: [{nom: 'Léa', total: 112}, {nom: 'Bob', total: 90}]},
    {g: 'cascadia',  t: 1, players: [{nom: 'léa', total: 60}, {nom: 'Bob', total: 50}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  assert.ok(!w.document.getElementById('filters').hidden);
  setFilter(w, 'filterG', 'harmonies');
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 1);
  assert.ok(w.document.getElementById('histSub').textContent.includes('1 partie'));
  assert.ok(!w.document.getElementById('statsCard').textContent.includes('Manu')); // stats filtrées
  setFilter(w, 'filterG', '');
  setFilter(w, 'filterP', 'léa'); // clé insensible à la casse : Léa et léa
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 3);
  setFilter(w, 'filterG', 'harmonies'); // combiné : harmonies + Manu = rien
  setFilter(w, 'filterP', 'manu');
  assert.equal(w.document.querySelectorAll('#historyList .card').length, 0);
  assert.ok(w.document.getElementById('historyList').textContent.includes('Aucune partie ne correspond'));
  assert.ok(!w.document.getElementById('csvBtn').hidden);   // export/effacement : historique complet
  assert.ok(!w.document.getElementById('clearHist').hidden);
});

test('history.html : filtres masqués sans historique', () => {
  const w = loadPage('history.html');
  assert.ok(w.document.getElementById('filters').hidden);
});

test('history.html : suppression sous filtre -> la bonne entrée du tableau stocké', () => {
  const hist = JSON.stringify([
    {g: 'cascadia',  t: 3, players: [{nom: 'Manu', total: 84}]},
    {g: 'harmonies', t: 2, players: [{nom: 'Léa', total: 112}]},
    {g: 'cascadia',  t: 1, players: [{nom: 'Bob', total: 60}]}
  ]);
  const w = loadPage('history.html', {'scores-history-v1': hist});
  setFilter(w, 'filterG', 'harmonies');
  click(w, '[data-del="1"]'); // l'index porté est celui du tableau stocké
  assert.deepEqual(JSON.parse(w.localStorage.getItem('scores-history-v1')).map(e => e.g),
    ['cascadia', 'cascadia']);
});
