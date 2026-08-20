/* Tests du moteur commun (common.js) dans jsdom, harmonies.html en fixture :
   steppers et appui long, annulation, persistance et vieux formats, échappement,
   partage, accessibilité, joueurs, multi-onglets, archive. Les comportements
   propres à chaque jeu vivent dans games.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadPage, closeAll, click, type, grand} = require('./helpers.js');
const {GAMES} = require('../lib/registry.js');

test.afterEach(closeAll);

/* ---------- Steppers, persistance, reset ---------- */
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

test('noms de joueurs échappés (onglets et classement)', () => {
  const w = loadPage('harmonies.html');
  type(w, '#pname', '<img src=x onerror=alert(1)>');
  assert.ok(w.document.getElementById('tabs').innerHTML.includes('&lt;img'));
  assert.equal(w.document.querySelector('#tabs img'), null);
  click(w, '#openRank');
  assert.equal(w.document.querySelector('#rankList img'), null);
});

test('persistance écrite et relecture ancien format (sans totals)', () => {
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

test('relecture : un tableau abîmé dans la sauvegarde est réaligné (pas de NaN)', () => {
  // arbre tronqué et non numérique : normalizeD (lib/sheet.js) réaligne sur la forme vierge
  const save = JSON.stringify({players: [{nom: 'Manu', d: {arbre: ['x'], champs: 1}}], cur: 0, started: true, totals: [5]});
  const w = loadPage('harmonies.html', {'harmonies-score-v1': save});
  assert.equal(grand(w), '5'); // jamais NaN
  click(w, '[data-step="arbre.2"][data-by="1"]'); // l'index 2 existe de nouveau
  assert.equal(grand(w), '12');
});

test('Nouvelle partie garde les joueurs, Réinitialiser les remet à zéro', () => {
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

/* ---------- Annulation ---------- */
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

test('annulation : annuler la première saisie rend la partie non commencée', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).started, true);
  click(w, '#undoBtn');
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).started, false);
  click(w, '#openRank'); click(w, '#resetAll'); // partie jamais commencée : rien à archiver
  assert.equal(w.localStorage.getItem('scores-history-v1'), null);

  const w2 = loadPage('wonderfulworld.html'); // même chose via un champ numérique
  type(w2, '[data-num="fixes"]', '4');
  click(w2, '#undoBtn');
  assert.equal(JSON.parse(w2.localStorage.getItem('wonderfulworld-score-v1')).started, false);
});

test('annulation : started revient à l\'état du snapshot, pas toujours à faux', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#undoBtn'); // annule le 2e cran : la partie reste commencée
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).started, true);
  click(w, '#undoBtn'); // annule le 1er : plus rien de commencé
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).started, false);
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
  assert.ok(warn.closest('#banners'), 'la bannière vit dans le conteneur empilable #banners');
  click(w, '[data-step="champs"][data-by="1"]'); // second échec : pas de doublon
  assert.equal(w.document.querySelectorAll('.storage-warn').length, 1);
  click(w, '.storage-warn .bclose'); // refermable
  assert.equal(w.document.querySelector('.storage-warn'), null);
});

test('accessibilité : onglets nommés (ids), panneau relié, tabindex glissant, focus conservé', () => {
  const w = loadPage('harmonies.html');
  const tabs = [...w.document.querySelectorAll('#tabs .tab[role="tab"]')];
  assert.deepEqual(tabs.map(t => t.id), ['tab-0', 'tab-1']);
  assert.equal(w.document.getElementById('sheetBody').getAttribute('aria-labelledby'), 'tab-0');
  assert.deepEqual(tabs.map(t => t.tabIndex), [0, -1]); // seul l'onglet courant est tabbable
  assert.equal(w.document.getElementById('addP').closest('[role="tablist"]'), null); // « + » hors tablist
  // activer un onglet au clavier : le focus suit au lieu de retomber sur <body>
  tabs[1].focus();
  tabs[1].dispatchEvent(new w.MouseEvent('click', {bubbles: true}));
  assert.equal(w.document.activeElement, w.document.querySelector('#tabs [data-tab="1"]'));
  assert.equal(w.document.getElementById('sheetBody').getAttribute('aria-labelledby'), 'tab-1');
});

test('accessibilité : steppers et champs numériques portent un nom accessible', () => {
  const w = loadPage('harmonies.html');
  assert.match(w.document.querySelector('[data-step="champs"][data-by="1"]').getAttribute('aria-label'), /plus.*Champs/);
  assert.match(w.document.querySelector('[data-step="champs"][data-by="-1"]').getAttribute('aria-label'), /moins.*Champs/);
  assert.ok(w.document.querySelector('[data-num="animaux"]').getAttribute('aria-label'));
});

test('accessibilité : le piège de focus du dialog ignore les boutons cachés', () => {
  const w = loadPage('harmonies.html');
  click(w, '#openRank'); // aucun canal de partage : #shareRank est hidden
  assert.ok(w.document.getElementById('shareRank').hidden);
  assert.ok(w.document.documentElement.classList.contains('no-scroll')); // fond verrouillé
  // Shift+Tab depuis le premier bouton visible boucle sur le dernier, sans passer par le caché
  w.document.getElementById('closeRank').focus();
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Tab', shiftKey: true, bubbles: true}));
  assert.equal(w.document.activeElement, w.document.getElementById('resetPlayers'));
  click(w, '#closeRank');
  assert.ok(!w.document.documentElement.classList.contains('no-scroll'));
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

/* ---------- Multi-onglets ---------- */
test('multi-onglets : une écriture externe recharge la feuille au lieu de l\'écraser', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  // un autre onglet écrit un nouvel état (l'événement storage ne vient jamais de l'onglet écrivain)
  const autre = JSON.stringify({players: [{nom: 'Ailleurs', d: {}}], cur: 0, started: true, totals: [0], ts: 1});
  w.localStorage.setItem('harmonies-score-v1', autre);
  w.dispatchEvent(new w.StorageEvent('storage', {key: 'harmonies-score-v1', newValue: autre}));
  assert.equal(w.document.getElementById('pname').value, 'Ailleurs');
  assert.ok(w.document.getElementById('undoBtn').hidden); // pile d'annulation vidée
});

test('multi-onglets : une suppression externe vide la feuille au lieu de la ressusciter', () => {
  const w = loadPage('harmonies.html');
  type(w, '#pname', 'Manu');
  click(w, '[data-step="champs"][data-by="1"]');
  // un import (history.html) ou un autre onglet supprime la sauvegarde
  w.localStorage.removeItem('harmonies-score-v1');
  w.dispatchEvent(new w.StorageEvent('storage', {key: 'harmonies-score-v1', newValue: null}));
  assert.equal(grand(w), '0');
  assert.equal(w.document.getElementById('pname').value, 'Joueur 1');
  const s = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.equal(s.started, false); // la feuille réécrite est vierge, pas l'ancien état mémoire
});

/* ---------- started, ts, sauvegardes abîmées ---------- */
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

test('extensions et face du plateau : configurer ne marque pas la partie commencée', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-ext="esprits"]');
  click(w, '[data-face="B"]');
  const s = JSON.parse(w.localStorage.getItem('harmonies-score-v1'));
  assert.equal(!!s.started, false); // pas de « Partie en cours » pour un simple réglage
  assert.equal(s.exts.esprits, true); // mais la configuration est bien enregistrée
  assert.equal(s.players[0].d.face, 'B');
});

test('ts : ouvrir une feuille sans rien saisir ne la fait pas remonter dans le menu', () => {
  // feuille jamais utilisée : pas de dernière utilisation
  const w = loadPage('harmonies.html');
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).ts, 0);
  click(w, '[data-step="champs"][data-by="1"]'); // première vraie saisie
  assert.ok(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).ts > 0);
  // partie en cours rouverte sans y toucher : le ts d'origine est conservé
  const save = JSON.stringify({players:[{nom:'Manu', d:{champs:1}}], cur:0, started:true, totals:[5], ts: 123});
  const w2 = loadPage('harmonies.html', {'harmonies-score-v1': save});
  assert.equal(JSON.parse(w2.localStorage.getItem('harmonies-score-v1')).ts, 123);
});

test('sauvegarde illisible : copie conservée et bannière, pas d\'écrasement silencieux', () => {
  const w = loadPage('harmonies.html', {'harmonies-score-v1': '{pas du JSON'});
  assert.equal(w.localStorage.getItem('harmonies-score-v1-corrupt'), '{pas du JSON');
  assert.ok(w.document.querySelector('.storage-warn'));
  assert.equal(grand(w), '0'); // la feuille repart de zéro
});

test('sauvegarde forgée : une chaîne dans un champ numérique ne sort pas de l\'attribut', () => {
  const save = JSON.stringify({players: [{nom: 'Manu',
    d: {animaux: '"><img src=x onerror=window.__pwned=1>'}}], cur: 0, started: true, totals: [0]});
  const w = loadPage('harmonies.html', {'harmonies-score-v1': save});
  assert.equal(w.document.querySelector('img'), null); // la valeur est coercée en nombre à l'injection
  assert.equal(w.document.querySelector('[data-num="animaux"]').value, '0');
});

/* ---------- Champs : nom du joueur et numériques ---------- */
test('nom du joueur : vider le champ reste possible, le défaut revient au blur', () => {
  const w = loadPage('harmonies.html');
  const pname = w.document.getElementById('pname');
  pname.focus();
  type(w, '#pname', ''); // l'utilisateur efface tout pour retaper
  assert.equal(pname.value, ''); // pas de « Joueur 1 » imposé sous le curseur
  type(w, '#pname', 'Manu');
  pname.dispatchEvent(new w.Event('change', {bubbles: true}));
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].nom, 'Manu');
  type(w, '#pname', ''); // laissé vide au blur : nom par défaut restauré
  pname.dispatchEvent(new w.Event('change', {bubbles: true}));
  assert.equal(pname.value, 'Joueur 1');
  assert.equal(JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].nom, 'Joueur 1');
});

test('champ numérique : un négatif saisi dans un champ non signé revient à 0 à l\'écran', () => {
  const w = loadPage('harmonies.html');
  type(w, '[data-num="animaux"]', '-5');
  const el = w.document.querySelector('[data-num="animaux"]');
  el.dispatchEvent(new w.Event('change', {bubbles: true}));
  assert.equal(el.value, '0'); // la valeur affichée suit la valeur stockée (bornée à 0)
  assert.equal(grand(w), '0');
});

/* ---------- Steppers : appui long ---------- */
test('steppers : l\'appui long répète, le clic du relâchement ne compte pas double', () => {
  const w = loadPage('harmonies.html');
  /* horloge maîtrisée : on ne capture que l'armement de 400ms du moteur (le
     focusin pose aussi des setTimeout(…, 0) — filtrer par délai évite de
     déclencher le mauvais callback) */
  const timers = [];
  let tick = null;
  w.setTimeout = (fn, ms) => { if (ms === 400) timers.push(fn); return timers.length; };
  w.clearTimeout = () => {};
  w.setInterval = fn => { tick = fn; return 1; };
  w.clearInterval = () => { tick = null; };

  const btn = w.document.querySelector('[data-step="champs"][data-by="1"]');
  btn.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  timers.pop()(); // l'armement échoit : premier cran + départ de la répétition
  tick(); tick(); // deux répétitions
  w.document.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  let d = JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].d;
  assert.equal(d.champs, 3); // 1 (armement) + 2 (répétitions), sauvé au relâchement
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); // le clic natif émis au relâchement
  d = JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].d;
  assert.equal(d.champs, 3); // neutralisé : pas de cran en plus
  // un tap court (relâché avant l'armement) reste un incrément simple
  btn.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
  w.document.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  d = JSON.parse(w.localStorage.getItem('harmonies-score-v1')).players[0].d;
  assert.equal(d.champs, 4);
});

test('steppers : un second appui n\'abandonne jamais un timer en vol', () => {
  const w = loadPage('harmonies.html');
  // stubs fonctionnels : on suit les timers réellement actifs
  const timers = new Map(), intervals = new Map();
  let nextId = 1;
  w.setTimeout = fn => { const id = nextId++; timers.set(id, fn); return id; };
  w.clearTimeout = id => timers.delete(id);
  w.setInterval = fn => { const id = nextId++; intervals.set(id, fn); return id; };
  w.clearInterval = id => intervals.delete(id);
  const a = w.document.querySelector('[data-step="champs"][data-by="1"]');
  const b = w.document.querySelector('[data-step="batiments"][data-by="1"]');
  a.dispatchEvent(new w.Event('pointerdown', {bubbles: true}));
  b.dispatchEvent(new w.Event('pointerdown', {bubbles: true})); // second doigt
  assert.equal(timers.size, 1); // l'armement du premier appui a été annulé, pas perdu
  [...timers.values()].forEach(fn => fn()); // l'armement restant échoit : répétition
  assert.equal(intervals.size, 1);
  w.document.dispatchEvent(new w.Event('pointerup', {bubbles: true}));
  assert.equal(intervals.size, 0); // plus aucune répétition orpheline
});

test('steppers : un geste avorté (pointercancel) ne laisse pas de cran d\'annulation fantôme', () => {
  const w = loadPage('harmonies.html');
  const btn = w.document.querySelector('[data-step="champs"][data-by="1"]');
  btn.dispatchEvent(new w.Event('pointerdown', {bubbles: true}));
  w.document.dispatchEvent(new w.Event('pointercancel', {bubbles: true})); // scroll : le geste avorte
  click(w, '[data-step="champs"][data-by="1"]'); // puis une vraie saisie
  assert.equal(grand(w), '5');
  click(w, '#undoBtn');
  assert.equal(grand(w), '0');
  assert.ok(w.document.getElementById('undoBtn').hidden); // un seul cran : pas de snapshot fantôme
});

/* ---------- Archive dans l'historique ---------- */
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

test('archive : la ventilation [libellé, valeur] de chaque joueur est conservée', () => {
  const w = loadPage('harmonies.html');
  click(w, '[data-step="champs"][data-by="1"]');
  click(w, '#openRank'); click(w, '#resetAll'); // confirm stubbé à true
  const e = JSON.parse(w.localStorage.getItem('scores-history-v1'))[0];
  assert.ok(Array.isArray(e.players[0].parts), 'parts manquant sur le vainqueur');
  assert.ok(e.players[0].parts.some(x => x[1] === 5)); // le champ saisi vaut 5 pts
  assert.equal(e.players[1].parts, undefined); // joueur sans point : pas de ventilation
});

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

/* ---------- Divers ---------- */
test('feuilles : lien règles du registre dans le header', () => {
  const w = loadPage('harmonies.html');
  const a = w.document.querySelector('header a.rules');
  assert.ok(a, 'lien .rules absent du header');
  assert.equal(a.getAttribute('href'), GAMES.find(g => g.slug === 'harmonies').rules);
  assert.equal(a.getAttribute('target'), '_blank');
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
