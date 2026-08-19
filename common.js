/* common.js — moteur partagé des feuilles de score.
   Chaque page de jeu charge games/<jeu>.js puis ce fichier, et appelle
   initSheet(config). Voir README pour la recette « ajouter un jeu ». */

const COLORS = ['var(--p1)','var(--p2)','var(--p3)','var(--p4)',
                'var(--p5)','var(--p6)','var(--p7)','var(--p8)'];

/* Clé de l'historique : celle du registre si lib/registry.js est chargé,
   littéral sinon — le même littéral que vérifie tests/consistency.test.js. */
const HISTORY_KEY = (typeof GameRegistry !== 'undefined' && GameRegistry.HISTORY_KEY) || 'scores-history-v1';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* accès par chemin pointé : 'arbre.0' ou 'pieces' — un seul niveau,
   la partie après le point est forcément un index de tableau (pas de 'a.b.c') */
function get(o,p){ const [a,b] = p.split('.'); return b===undefined ? o[a] : o[a][+b]; }
function set(o,p,v){ const [a,b] = p.split('.'); if(b===undefined) o[a]=v; else o[a][+b]=v; }

/* Écriture localStorage impossible (quota plein, navigation privée Safari,
   stockage bloqué…) : l'UI continue de fonctionner mais rien ne survivrait à un
   rechargement — l'utilisateur doit le savoir. Une seule bannière par session. */
let storageWarned = false;
function storageWarn(){
  if(storageWarned) return;
  storageWarned = true;
  document.body.insertAdjacentHTML('beforeend',
    '<div class="storage-warn" role="alert">Sauvegarde impossible — les scores seront perdus en quittant la page.</div>');
}

function sq(color){
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:7px"></span>`;
}

function rowStep(path, lab, sub, icon){
  return `<div class="row">
    ${icon?`<div class="icon">${icon}</div>`:''}
    <div class="lab">${lab}${sub?`<small>${sub}</small>`:''}</div>
    <div class="step">
      <button data-step="${path}" data-by="-1" aria-label="moins">−</button>
      <span class="val" data-val="${path}">0</span>
      <button data-step="${path}" data-by="1" aria-label="plus">+</button>
    </div></div>`;
}

function rowNum(d, path, lab, sub, signed){
  return `<div class="row">
    <div class="lab">${lab}${sub?`<small>${sub}</small>`:''}</div>
    <input class="num" data-num="${path}" type="number" ${signed?'':'min="0" inputmode="numeric"'} value="${get(d,path)}">
  </div>`;
}

/* config : {
     key, startPlayers, maxPlayers: ()=>N, blank,
     score(d, players) -> {..., total} — players permet les calculs
       inter-joueurs (majorités) ; la plupart des jeux l'ignorent
     drawSheet(d, ctx) -> html du corps de feuille,
     drawSheet(d, ctx) -> html du corps de feuille
     sums(s) -> {cléDataSum: valeur}                       (optionnel)
     afterDraw(d, ctx), afterRefresh(d, s)                 (optionnels)
     rankParts(s, d) -> [[label, valeur], ...]
     rankExtra(d) -> string, tiebreak(a, b) -> number      (optionnels)
     onClick(e, ctx) / onInput(e, ctx) -> bool « géré »    (optionnels)
     signed: Set de chemins autorisés en négatif           (optionnel)
     stepMin(path) -> minimum du stepper                   (optionnel)
     stepMax(path) -> maximum du stepper, undefined = illimité (optionnel ;
       appliqué aussi pendant l'appui long, contrairement à un plafond
       posé dans onClick qui ne voit pas la répétition automatique)
     extraState() -> objet fusionné dans la sauvegarde     (optionnel)
     restoreExtra(sauvegarde), fixup(d)                    (optionnels)
   } */
/* Au focus d'un champ, sélectionner la valeur existante : taper remplace
   (le 0 par défaut, notamment) au lieu d'insérer au point cliqué.
   Le setTimeout laisse passer le clic qui suit le focus (sinon il
   replacerait le curseur). */
document.addEventListener('focusin', e => {
  if(e.target.tagName === 'INPUT'){
    setTimeout(() => e.target.select(), 0);
  }
});

/* Chrome commun à toutes les feuilles : nom du joueur, barre de total,
   sheet de classement. Le lien vers les règles officielles (registre chargé
   par la page) va en haut à droite du header, en face du « ← Jeux » — c'est
   pendant la saisie qu'on consulte les règles, pas au classement. */
function injectChrome(slug){
  const reg = (typeof GameRegistry !== 'undefined')
    && GameRegistry.GAMES.find(g => g.slug === slug);
  const back = document.querySelector('header .back');
  if(reg && reg.rules && back){
    back.insertAdjacentHTML('afterend',
      `<a class="rules" href="${esc(reg.rules)}" target="_blank" rel="noopener">Règles ↗</a>`);
  }
  document.getElementById('sheetBody').setAttribute('role', 'tabpanel');
  document.getElementById('sheetBody').insertAdjacentHTML('beforebegin', `
  <div class="whois">
    <button class="swatch" id="swatch" type="button" aria-label="Changer la couleur de ce joueur" title="Changer la couleur"></button>
    <input id="pname" aria-label="Nom du joueur" autocomplete="off" autocapitalize="words" spellcheck="false" list="pnames">
    <datalist id="pnames"></datalist>
    <button class="mv" id="mvL" type="button" aria-label="Avancer ce joueur dans l'ordre du tour" title="Avancer dans l'ordre" hidden>◂</button>
    <button class="mv" id="mvR" type="button" aria-label="Reculer ce joueur dans l'ordre du tour" title="Reculer dans l'ordre" hidden>▸</button>
    <button class="kill" id="kill" title="Retirer ce joueur" hidden>×</button>
  </div>`);
  document.body.insertAdjacentHTML('beforeend', `
  <div class="bar">
    <div class="inner">
      <div class="tot" aria-live="polite"><b id="grand">0</b><span id="whoTot"></span></div>
      <button class="undo" id="undoBtn" aria-label="Annuler la dernière saisie" title="Annuler la dernière saisie" hidden>↺</button>
      <button class="go" id="openRank">Classement</button>
    </div>
  </div>
  <div class="sheet" id="rankSheet">
    <div class="panel" role="dialog" aria-modal="true" aria-label="Classement"><div class="in">
      <h2 class="title" style="font-size:24px;margin-bottom:14px">Classement</h2>
      <div id="rankList"></div>
      <button class="close" id="closeRank">Retour à la saisie</button>
      <button class="reset" id="resetAll">Terminer la partie (mêmes joueurs)</button>
      <button class="reset" id="resetPlayers">Réinitialiser joueurs et scores</button>
      <p class="hint" style="text-align:center;margin-top:6px">La partie en cours est archivée dans l'historique.</p>
    </div></div>
  </div>`);
}

function initSheet(cfg){
  const slug = cfg.key.replace('-score-v1','');
  injectChrome(slug);
  const maxP = cfg.maxPlayers || (()=>4);
  /* c : couleur du joueur (index dans COLORS) — attachée au joueur, pas à sa
     position, pour survivre au réordonnancement. Sans c explicite : première
     couleur libre. */
  const freeColor = () => {
    const used = new Set(players.map(p => p.c));
    for(let i = 0; i < COLORS.length; i++) if(!used.has(i)) return i;
    return players.length % COLORS.length;
  };
  const mk = (nom, c) => ({nom, d: cfg.blank(), c: c !== undefined ? c : freeColor()});
  let players = Array.from({length: cfg.startPlayers || 2}, (_,i)=>mk('Joueur '+(i+1), i));
  let cur = 0;

  const ctx = {
    get d(){ return players[cur].d; },
    get players(){ return players; },
    refresh, redraw: drawSheet,
    trimToMax(){
      if(players.length > maxP()){ players = players.slice(0, maxP()); cur = Math.min(cur, players.length-1); }
    }
  };

  /* ---------- annulation ---------- */
  /* Un cran par « geste » : un appui sur un stepper (court ou long — snapshoté
     au pointerdown, la répétition automatique compte pour un seul cran), un
     bouton de la feuille (segment, ajout/suppression de ligne), une série de
     frappes dans un même champ, ou un renommage. La pile vit en mémoire
     seulement (elle couvre le geste malheureux, pas l'archéologie) et restaure
     l'état complet du moment : joueurs, extensions, joueur courant. */
  let undoStack = [], lastInputTarget = null;
  function snap(){
    lastInputTarget = null;
    undoStack.push(JSON.stringify({players, cur, ...(cfg.extraState ? cfg.extraState() : {})}));
    if(undoStack.length > 30) undoStack.shift();
  }
  function undo(){
    if(!undoStack.length) return;
    const s = JSON.parse(undoStack.pop());
    if(cfg.restoreExtra) cfg.restoreExtra(s);
    players = s.players;
    cur = Math.min(+s.cur || 0, players.length - 1);
    lastInputTarget = null;
    drawSheet();
  }

  /* ---------- persistance ---------- */
  /* started : vrai dès la première saisie de score — l'accueil s'en sert pour
     l'aperçu « Partie en cours » (les totaux ne suffisent pas : une feuille
     vierge de Terraforming Mars vaut déjà 20 points de NT). */
  let started = false;
  /* Date de la partie « oubliée » : si la feuille est rouverte plus tard juste
     pour être terminée, l'archive est datée de la dernière vraie utilisation
     (le ts de la sauvegarde chargée), pas du jour du reset. */
  let touched = false, loadedTs = 0;
  function save(){
    try{
      localStorage.setItem(cfg.key, JSON.stringify({
        players, cur, started, totals: players.map(p=>cfg.score(p.d, players).total),
        ts: Date.now(), // dernière utilisation — l'accueil ordonne le menu avec
        ...(cfg.extraState ? cfg.extraState() : {})
      }));
    }catch(e){ storageWarn(); }
  }
  function load(){
    try{
      const s = JSON.parse(localStorage.getItem(cfg.key));
      if(!s || !Array.isArray(s.players) || !s.players.length) return;
      loadedTs = +s.ts || 0; // avant le premier save(), qui écrase ts
      if(cfg.restoreExtra) cfg.restoreExtra(s);
      players = s.players.slice(0, maxP()).map((p,i)=>({
        nom: p.nom || 'Joueur '+(i+1),
        d: {...cfg.blank(), ...p.d},
        // anciennes sauvegardes sans couleur : par position, comme avant
        c: Number.isInteger(p.c) && p.c >= 0 && p.c < COLORS.length ? p.c : i
      }));
      if(cfg.fixup) players.forEach(p=>cfg.fixup(p.d));
      cur = Math.min(+s.cur || 0, players.length-1);
      if(s.started !== undefined) started = !!s.started;
      else{
        // ancienne sauvegarde sans le flag : partie commencée si un total dévie de la feuille vierge
        const base = cfg.score(cfg.blank(), players).total;
        started = Array.isArray(s.totals) ? s.totals.some(t => t !== base) : true;
      }
    }catch(e){}
  }

  /* ---------- rendu ---------- */
  function drawSheet(){
    document.getElementById('sheetBody').innerHTML = cfg.drawSheet(players[cur].d, ctx);
    if(cfg.afterDraw) cfg.afterDraw(players[cur].d, ctx);
    refresh();
  }

  function refresh(){
    const d = players[cur].d, s = cfg.score(d, players);
    document.querySelectorAll('[data-val]').forEach(el=>{ el.textContent = get(d, el.dataset.val); });
    const sums = cfg.sums ? cfg.sums(s) : {};
    document.querySelectorAll('[data-sum]').forEach(el=>{
      if(sums[el.dataset.sum] !== undefined) el.textContent = sums[el.dataset.sum] + ' pts';
    });
    if(cfg.afterRefresh) cfg.afterRefresh(d, s);
    document.getElementById('grand').textContent = s.total;
    document.getElementById('whoTot').textContent = 'points · ' + players[cur].nom;
    document.getElementById('undoBtn').hidden = !undoStack.length;
    drawTabs();
    // pendant la répétition d'appui long (un cran/110ms), une seule écriture au relâchement
    if(holdInt){ saveDirty = true; } else { save(); saveDirty = false; }
    syncWakeLock();
  }

  function drawTabs(){
    const t = document.getElementById('tabs');
    t.innerHTML = players.map((p,i)=>`
      <button class="tab" role="tab" data-tab="${i}" aria-selected="${i===cur}" aria-controls="sheetBody" style="color:${i===cur?'var(--bg)':COLORS[p.c]}">
        <span class="dot" style="color:${COLORS[p.c]}"></span>${esc(p.nom)}
        <span class="pts">${cfg.score(p.d, players).total}</span>
      </button>`).join('')
      + (players.length < maxP() ? `<button class="tab add" id="addP" title="Ajouter un joueur">+</button>` : '');
    document.getElementById('pname').value = players[cur].nom;
    document.getElementById('swatch').style.background = COLORS[players[cur].c];
    document.getElementById('kill').hidden = players.length < 2;
    const mvL = document.getElementById('mvL'), mvR = document.getElementById('mvR');
    mvL.hidden = mvR.hidden = players.length < 2;
    mvL.disabled = cur === 0;
    mvR.disabled = cur === players.length - 1;
  }

  /* Suggestions de noms au renommage : derniers joueurs vus dans l'historique,
     par partie la plus récente, noms par défaut exclus (datalist natif). */
  function fillNameSuggestions(){
    try{
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      const seen = [];
      for(const e of h) for(const p of (e.players || []))
        if(p && p.nom && !/^Joueur \d+$/.test(p.nom) && !seen.includes(p.nom)) seen.push(p.nom);
      document.getElementById('pnames').innerHTML =
        seen.slice(0, 8).map(n=>`<option value="${esc(n)}">`).join('');
    }catch(e){}
  }

  /* Écran maintenu allumé tant qu'une partie est en cours (flag started).
     L'OS libère le lock quand l'app passe en arrière-plan : on le redemande
     au retour via visibilitychange. */
  let wakeLock = null;
  async function syncWakeLock(){
    if(!('wakeLock' in navigator)) return;
    try{
      if(started && !wakeLock && document.visibilityState === 'visible'){
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', ()=>{ wakeLock = null; });
      } else if(!started && wakeLock){ wakeLock.release(); wakeLock = null; }
    }catch(e){}
  }
  document.addEventListener('visibilitychange', syncWakeLock);

  /* Archive la partie dans l'historique global (clé scores-history-v1, lue par
     history.html) : classement figé au moment du reset, si des scores ont été saisis.
     Datée de la dernière vraie interaction : Date.now() si on vient de jouer,
     le ts de la sauvegarde chargée si on rouvre juste pour terminer. */
  function archive(){
    if(!started) return;
    try{
      /* Chaque joueur archive aussi sa ventilation, figée en paires
         [libellé, valeur] prêtes à afficher (mêmes libellés que le classement) :
         l'historique ne sait pas re-calculer un barème. Champs additifs —
         les anciennes entrées sans parts/extra restent valides. */
      const list = players.map(p=>{
        const s = cfg.score(p.d, players);
        return {nom:p.nom, total:s.total, d:p.d, s};
      })
        .sort((a,b)=> b.total - a.total || (cfg.tiebreak ? cfg.tiebreak(a,b) : 0))
        .map(p=>{
          const entry = {nom:p.nom, total:p.total};
          const parts = cfg.rankParts(p.s, p.d).filter(x=>x[1]);
          if(parts.length) entry.parts = parts;
          const extra = cfg.rankExtra ? cfg.rankExtra(p.d) : '';
          if(extra) entry.extra = extra;
          return entry;
        });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      h.unshift({g: slug, t: touched ? Date.now() : (loadedTs || Date.now()), players: list});
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 200)));
      fillNameSuggestions();
    }catch(e){ storageWarn(); }
  }

  function showRank(){
    const list = players.map(p=>({...p, s:cfg.score(p.d, players), c:COLORS[p.c]}))
      .sort((a,b)=> b.s.total - a.s.total || (cfg.tiebreak ? cfg.tiebreak(a,b) : 0));
    document.getElementById('rankList').innerHTML = list.map((p,i)=>{
      const parts = cfg.rankParts(p.s, p.d).filter(x=>x[1]).map(x=>x[0]+' '+x[1]).join(' · ')
                    || 'Aucun point saisi';
      const extra = cfg.rankExtra ? cfg.rankExtra(p.d) : '';
      return `<div class="rank ${i===0?'win':''}">
        <span class="pos">${i+1}</span>
        <span class="nm" style="color:${p.c}">${esc(p.nom)}<small>${parts}${extra}</small></span>
        <span class="pt">${p.s.total}</span></div>`;
    }).join('');
    document.getElementById('rankSheet').classList.add('open');
    document.getElementById('closeRank').focus(); // le dialog prend le focus à l'ouverture
  }

  function closeRank(){
    document.getElementById('rankSheet').classList.remove('open');
    document.getElementById('openRank').focus(); // rendre le focus au bouton qui a ouvert
  }

  /* Clavier : Escape ferme le classement, Tab reste dans le dialog tant qu'il
     est ouvert (piège de focus léger sur ses boutons). */
  document.addEventListener('keydown', e=>{
    const sheet = document.getElementById('rankSheet');
    if(!sheet.classList.contains('open')) return;
    if(e.key === 'Escape'){ closeRank(); return; }
    if(e.key === 'Tab'){
      const f = sheet.querySelectorAll('button');
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });

  /* Clavier : flèches gauche/droite pour circuler dans les onglets joueurs. */
  document.getElementById('tabs').addEventListener('keydown', e=>{
    if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = [...document.querySelectorAll('#tabs .tab')];
    const i = tabs.indexOf(document.activeElement);
    if(i < 0) return;
    e.preventDefault();
    tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].focus();
  });

  /* ---------- interactions ---------- */
  function doStep(st){
    const d = players[cur].d;
    const p = st.dataset.step, min = cfg.stepMin ? cfg.stepMin(p) : 0;
    const max = cfg.stepMax ? cfg.stepMax(p) : undefined;
    set(d, p, Math.max(min, Math.min(max === undefined ? Infinity : max, get(d,p) + (+st.dataset.by))));
    refresh();
  }

  /* Appui long sur un stepper : répétition automatique après 400ms, puis toutes
     les 110ms. Le clic émis au relâchement est neutralisé (holdFired) pour ne
     pas compter un cran de plus. */
  let holdTimer = null, holdInt = null, holdFired = false, gestureSnapped = false, saveDirty = false;
  function stopHold(){
    clearTimeout(holdTimer); clearInterval(holdInt); holdTimer = holdInt = null;
    if(saveDirty){ saveDirty = false; save(); }
  }
  document.addEventListener('pointerdown', e=>{
    const st = e.target.closest && e.target.closest('[data-step]');
    if(!st) return;
    snap(); gestureSnapped = true; // l'appui entier (clic ou répétition longue) = un cran d'annulation
    holdFired = false;
    holdTimer = setTimeout(()=>{
      holdFired = true; started = true; touched = true;
      doStep(st);
      holdInt = setInterval(()=>doStep(st), 110);
    }, 400);
  });
  document.addEventListener('pointerup', stopHold);
  document.addEventListener('pointercancel', stopHold);

  document.addEventListener('click', e=>{
    const sb = e.target.closest && e.target.closest('#sheetBody button');
    if(sb){
      started = touched = true;
      if(sb.dataset.step === undefined) snap(); // les steppers sont snapshotés au pointerdown
    }
    if(cfg.onClick && cfg.onClick(e, ctx)) return;
    const st = e.target.closest('[data-step]');
    if(st){
      if(holdFired){ holdFired = false; gestureSnapped = false; return; }
      if(!gestureSnapped) snap(); // clic sans pointerdown (clavier, événement synthétique)
      gestureSnapped = false;
      doStep(st); return;
    }
    if(e.target.id === 'undoBtn'){ undo(); return; }
    if(e.target.id === 'swatch'){
      // couleur libre suivante (jamais celle d'un autre joueur) — annulable
      const used = new Set(players.filter((_,i)=>i!==cur).map(p=>p.c));
      for(let k = 1; k < COLORS.length; k++){
        const cand = (players[cur].c + k) % COLORS.length;
        if(!used.has(cand)){ snap(); players[cur].c = cand; refresh(); break; }
      }
      return;
    }
    if(e.target.id === 'mvL' || e.target.id === 'mvR'){
      const j = cur + (e.target.id === 'mvL' ? -1 : 1);
      if(j < 0 || j >= players.length) return;
      snap();
      [players[cur], players[j]] = [players[j], players[cur]];
      cur = j; // le joueur déplacé reste sélectionné
      drawSheet(); return;
    }
    const tab = e.target.closest('[data-tab]');
    if(tab){ cur = +tab.dataset.tab; drawSheet(); return; }
    if(e.target.id === 'addP'){ players.push(mk('Joueur '+(players.length+1))); cur = players.length-1; drawSheet(); return; }
    if(e.target.id === 'kill'){
      const p = players[cur];
      // même heuristique que le legacy started : la feuille dévie-t-elle de la vierge ?
      // (limite assumée : un joueur revenu exactement au total vierge n'est pas détecté)
      const dirty = cfg.score(p.d, players).total !== cfg.score(cfg.blank(), players).total;
      if(dirty && !confirm(`Retirer ${p.nom} ? Ses scores seront perdus.`)) return;
      players.splice(cur,1); cur = 0; drawSheet(); return;
    }
    if(e.target.id === 'openRank'){ showRank(); return; }
    if(e.target.id === 'closeRank' || e.target.id === 'rankSheet'){ closeRank(); return; }
    if(e.target.id === 'resetAll'){
      if(started && !confirm('Terminer la partie ? Elle sera archivée dans l\'historique et les scores remis à zéro.')) return;
      archive();
      undoStack.length = 0; // nouvelle partie : rien à annuler
      players = players.map(p=>mk(p.nom, p.c)); cur = 0; started = false; // noms et couleurs conservés
      closeRank(); drawSheet(); return;
    }
    if(e.target.id === 'resetPlayers'){
      if(started && !confirm('Réinitialiser les joueurs et les scores ? La partie en cours sera archivée dans l\'historique.')) return;
      archive();
      undoStack.length = 0; // nouvelle partie : rien à annuler
      players = Array.from({length: cfg.startPlayers || 2}, (_,i)=>mk('Joueur '+(i+1), i)); cur = 0; started = false;
      closeRank(); drawSheet(); return;
    }
  });

  document.addEventListener('input', e=>{
    if(e.target.closest && (e.target.closest('#sheetBody input') || e.target.id === 'pname')){
      if(e.target.id !== 'pname') started = touched = true;
      // une série de frappes dans un même champ = un seul cran d'annulation
      if(e.target !== lastInputTarget){ snap(); lastInputTarget = e.target; }
    }
    if(cfg.onInput && cfg.onInput(e, ctx)) return;
    const d = players[cur].d;
    if(e.target.id === 'pname'){ players[cur].nom = e.target.value || 'Joueur '+(cur+1); refresh(); return; }
    if(e.target.dataset.num !== undefined){
      const p = e.target.dataset.num, v = +e.target.value || 0;
      set(d, p, (cfg.signed && cfg.signed.has(p)) ? v : Math.max(0, v));
      refresh();
    }
  });

  /* Un autre onglet a modifié la sauvegarde de ce jeu (l'événement storage ne
     se déclenche jamais dans l'onglet qui écrit) : recharger son état plutôt
     que de l'écraser au prochain refresh. */
  window.addEventListener('storage', e => {
    if(e.key !== cfg.key) return;
    undoStack.length = 0;
    load(); drawSheet();
  });

  load();
  fillNameSuggestions();
  drawSheet();

  // enregistrement du SW, bannière de mise à jour et storage.persist : sw-client.js
  return ctx;
}
