/* common.js — moteur partagé des feuilles de score.
   Chaque page de jeu charge games/<jeu>.js puis ce fichier, et appelle
   initSheet(config). Voir README pour la recette « ajouter un jeu ». */

const COLORS = ['var(--p1)','var(--p2)','var(--p3)','var(--p4)',
                'var(--p5)','var(--p6)','var(--p7)','var(--p8)'];

/* Clé de l'historique : celle du registre si lib/registry.js est chargé,
   littéral sinon — le même littéral que vérifie tests/consistency.test.js. */
const HISTORY_KEY = (typeof GameRegistry !== 'undefined' && GameRegistry.HISTORY_KEY) || 'scores-history-v1';

/* esc/sq : lib/html.js (chargé avant ce fichier par toutes les pages de jeu),
   réexposés en fonctions globales — les pages les consomment dans leurs
   template strings (une déclaration function traverse le harnais jsdom,
   contrairement à un const de premier niveau) */
function esc(s){ return GameHtml.esc(s); }
function sq(color){ return GameHtml.sq(color); }

/* accès par chemin pointé : 'arbre.0' ou 'pieces' — un seul niveau,
   la partie après le point est forcément un index de tableau (pas de 'a.b.c') */
function get(o,p){ const [a,b] = p.split('.'); return b===undefined ? o[a] : o[a][+b]; }
function set(o,p,v){ const [a,b] = p.split('.'); if(b===undefined) o[a]=v; else o[a][+b]=v; }

/* Écriture localStorage impossible (quota plein, navigation privée Safari,
   stockage bloqué…) : l'UI continue de fonctionner mais rien ne survivrait à un
   rechargement — l'utilisateur doit le savoir. Une seule bannière par session. */
/* conteneur commun des bannières (partagé avec sw-client.js, même id) :
   elles s'empilent au lieu de se recouvrir */
function bannerHost(){
  let b = document.getElementById('banners');
  if(!b){
    b = document.createElement('div');
    b.id = 'banners'; b.className = 'banners';
    document.body.appendChild(b);
  }
  return b;
}

let storageWarned = false;
function storageWarn(msg){
  if(storageWarned) return;
  storageWarned = true;
  bannerHost().insertAdjacentHTML('beforeend',
    `<div class="storage-warn" role="alert"><span>${msg || 'Sauvegarde impossible — les scores seront perdus en quittant la page.'}</span>
     <button class="bclose" type="button" aria-label="Fermer">×</button></div>`);
  const warn = bannerHost().querySelector('.storage-warn');
  warn.querySelector('.bclose').addEventListener('click', ()=> warn.remove());
}

function rowStep(path, lab, sub, icon){
  // aria-label contextualisé : vingt « plus »/« moins » identiques ne se distinguent pas au lecteur d'écran
  return `<div class="row">
    ${icon?`<div class="icon">${icon}</div>`:''}
    <div class="lab">${lab}${sub?`<small>${sub}</small>`:''}</div>
    <div class="step">
      <button data-step="${path}" data-by="-1" aria-label="moins — ${lab}">−</button>
      <span class="val" data-val="${path}">0</span>
      <button data-step="${path}" data-by="1" aria-label="plus — ${lab}">+</button>
    </div></div>`;
}

function rowNum(d, path, lab, sub, signed){
  return `<div class="row">
    <div class="lab">${lab}${sub?`<small>${sub}</small>`:''}</div>
    <input class="num" data-num="${path}" type="number" ${signed?'':'min="0" inputmode="numeric"'} value="${+get(d,path)||0}" aria-label="${lab}">
  </div>`;
}

/* config : {
     slug (identité du jeu dans le registre — la clé localStorage
       <slug>-score-v1 en découle via gameKey),
     startPlayers, blank,
     maxPlayers: (exts)=>N — celui de games/<jeu>.js (peut dépendre des extensions)
     score(d, opts) -> {..., total} — signature commune à tous les jeux :
       opts = {players, exts}, players pour les calculs inter-joueurs
       (majorités, doublement), exts l'état des extensions ; la plupart
       des jeux ignorent opts
     exts: {defauts, labels, migrate(s, exts)?} — extensions du jeu   (optionnel)
       le moteur possède l'état (ctx.exts), sa persistance (clé exts de la
       sauvegarde), les libellés archivés et le clic sur les boutons
       [data-ext] ; la page rend ctx.extSeg() dans drawSheet ; migrate
       détecte une extension dans une sauvegarde d'avant le champ exts
     drawSheet(d, ctx) -> html du corps de feuille
     sums(s) -> {cléDataSum: valeur}                       (optionnel)
     afterDraw(d, ctx), afterRefresh(d, s, ctx)            (optionnels)
     rankParts(s, d) -> [[label, valeur], ...]
     rankExtra(d, ctx) -> string, tiebreak(a, b) -> number (optionnels ;
       tiebreak ne doit lire que a.d/a.s et b.d/b.s — jamais a.total,
       absent des objets du classement ; 0 = ex æquo, affiché comme tel)
     lowWins: true — le plus petit total gagne (Skyjo) ;   (optionnel)
       poser aussi le drapeau sur l'entrée du registre (historique, stats)
     onClick(e, ctx) / onInput(e, ctx) -> bool « géré »    (optionnels)
     signed: Set de chemins autorisés en négatif           (optionnel)
     stepMin(path) -> minimum du stepper                   (optionnel)
     stepMax(path) -> maximum du stepper, undefined = illimité (optionnel ;
       appliqué aussi pendant l'appui long, contrairement à un plafond
       posé dans onClick qui ne voit pas la répétition automatique)
     extraState() -> objet fusionné dans la sauvegarde     (optionnel)
     restoreExtra(sauvegarde), fixup(d)                    (optionnels)
     extLabels() -> libellés des extensions actives        (optionnel ;
       archivés avec la partie et mis dans le texte partagé — des libellés
       stables, pour que les entrées d'historique se comparent entre elles)
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
      <button class="share" id="shareRank" type="button" hidden>Partager le classement</button>
      <button class="close" id="closeRank">Retour à la saisie</button>
      <button class="reset" id="resetAll">Terminer la partie (mêmes joueurs)</button>
      <button class="reset" id="resetPlayers">Réinitialiser joueurs et scores</button>
      <p class="hint" style="text-align:center;margin-top:6px">La partie en cours est archivée dans l'historique.</p>
    </div></div>
  </div>`);
}

function initSheet(cfg){
  const slug = cfg.slug;
  const key = typeof GameRegistry !== 'undefined'
    ? GameRegistry.gameKey(slug) : slug + '-score-v1';
  injectChrome(slug);
  const reg = (typeof GameRegistry !== 'undefined')
    && GameRegistry.GAMES.find(g => g.slug === slug);
  const gameName = (reg && reg.name) || slug;
  /* extensions (hook cfg.exts) : état possédé par le moteur, persistance et
     clic compris — la page ne fournit que le rendu (ctx.extSeg) */
  let exts = cfg.exts ? {...cfg.exts.defauts} : undefined;
  const extLabels = () => cfg.exts
    ? Object.keys(cfg.exts.labels).filter(k => exts[k]).map(k => cfg.exts.labels[k])
    : (cfg.extLabels ? cfg.extLabels() : []);
  const maxP = () => (cfg.maxPlayers || (()=>4))(exts);
  /* le score d'une feuille, signature commune score(d, {players, exts}) */
  const sc = d => cfg.score(d, {players, exts});
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
    get exts(){ return exts; },
    /* segment des boutons d'extensions, rendu par la page dans drawSheet */
    extSeg(){
      return `<div class="seg">${Object.entries(cfg.exts.labels).map(([k, lab]) =>
        `<button data-ext="${k}" data-config aria-pressed="${!!exts[k]}">${lab}</button>`).join('')}</div>`;
    },
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
     l'état complet du moment : joueurs, extensions, joueur courant, drapeau
     de partie commencée (annuler la toute première saisie rend la feuille
     « non commencée » : rien à archiver, pas d'aperçu « Partie en cours »). */
  const undoStack = [];
  let lastInputTarget = null;
  function snap(){
    lastInputTarget = null;
    undoStack.push(JSON.stringify({players, cur, started,
      ...(cfg.exts ? {exts} : {}), ...(cfg.extraState ? cfg.extraState() : {})}));
    if(undoStack.length > 30) undoStack.shift();
  }
  function undo(){
    if(!undoStack.length) return;
    const s = JSON.parse(undoStack.pop());
    if(cfg.exts) exts = {...cfg.exts.defauts, ...(s.exts || {})};
    if(cfg.restoreExtra) cfg.restoreExtra(s);
    players = s.players;
    started = !!s.started;
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
      localStorage.setItem(key, JSON.stringify({
        players, cur, started, totals: players.map(p=>sc(p.d).total),
        ...(cfg.exts ? {exts} : {}),
        /* dernière vraie interaction — l'accueil ordonne le menu avec : ouvrir
           une feuille sans rien saisir ne la fait pas remonter (ni ne décale la
           date d'archive d'une partie rouverte juste pour être terminée) */
        ts: touched ? Date.now() : (loadedTs || 0),
        ...(cfg.extraState ? cfg.extraState() : {})
      }));
    }catch(e){ storageWarn(); }
  }
  function load(){
    let raw = null;
    try{
      raw = localStorage.getItem(key);
      if(raw === null) return;
      const s = JSON.parse(raw);
      if(!s || !Array.isArray(s.players) || !s.players.length) throw new Error('format inattendu');
      loadedTs = +s.ts || 0; // avant le premier save(), qui écrase ts
      if(cfg.exts){
        exts = {...cfg.exts.defauts, ...(s.exts || {})};
        // sauvegarde d'avant les extensions : laisser le jeu les détecter
        if(!s.exts && cfg.exts.migrate) cfg.exts.migrate(s, exts);
      }
      if(cfg.restoreExtra) cfg.restoreExtra(s);
      players = s.players.slice(0, maxP()).map((p,i)=>({
        nom: p.nom || 'Joueur '+(i+1),
        // clés manquantes et tableaux abîmés réparés (lib/sheet.js), puis fixup du jeu
        d: GameSheet.normalizeD(cfg.blank(), p.d),
        // anciennes sauvegardes sans couleur : par position, comme avant
        c: Number.isInteger(p.c) && p.c >= 0 && p.c < COLORS.length ? p.c : i
      }));
      if(cfg.fixup) players.forEach(p=>cfg.fixup(p.d));
      cur = Math.min(+s.cur || 0, players.length-1);
      if(s.started !== undefined) started = !!s.started;
      else{
        // ancienne sauvegarde sans le flag : partie commencée si un total dévie de la feuille vierge
        const base = sc(cfg.blank()).total;
        started = Array.isArray(s.totals) ? s.totals.some(t => t !== base) : true;
      }
    }catch(e){
      /* sauvegarde illisible : la mettre de côté avant que le premier save()
         ne l'écrase, et prévenir plutôt que d'écraser en silence */
      try{ if(raw !== null) localStorage.setItem(key + '-corrupt', raw); }catch(e2){}
      storageWarn('Sauvegarde illisible — la feuille repart de zéro (copie conservée).');
    }
  }

  /* ---------- rendu ---------- */
  function drawSheet(){
    document.getElementById('sheetBody').innerHTML = cfg.drawSheet(players[cur].d, ctx);
    if(cfg.afterDraw) cfg.afterDraw(players[cur].d, ctx);
    refresh();
  }

  function refresh(){
    const d = players[cur].d, s = sc(d);
    document.querySelectorAll('[data-val]').forEach(el=>{ el.textContent = get(d, el.dataset.val); });
    /* resynchroniser les champs libres avec la valeur stockée (un négatif tapé
       dans un champ non signé est borné à 0) — jamais celui en cours de frappe */
    document.querySelectorAll('input[data-num]').forEach(el=>{
      if(el !== document.activeElement) el.value = +get(d, el.dataset.num) || 0;
    });
    const sums = cfg.sums ? cfg.sums(s) : {};
    document.querySelectorAll('[data-sum]').forEach(el=>{
      if(sums[el.dataset.sum] !== undefined) el.textContent = sums[el.dataset.sum] + ' pts';
    });
    if(cfg.afterRefresh) cfg.afterRefresh(d, s, ctx);
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
    /* le rôle tablist ne doit contenir que des tabs : le bouton « + » vit à côté,
       display:contents laisse les onglets participer au flex de #tabs.
       tabindex glissant : seul l'onglet courant est dans l'ordre de tabulation,
       les flèches circulent (listener plus bas). */
    t.innerHTML = `<div role="tablist" style="display:contents">`
      + players.map((p,i)=>`
      <button class="tab" role="tab" id="tab-${i}" data-tab="${i}" aria-selected="${i===cur}" aria-controls="sheetBody" tabindex="${i===cur?0:-1}" style="color:${i===cur?'var(--bg)':COLORS[p.c]}">
        <span class="dot" style="color:${COLORS[p.c]}"></span>${esc(p.nom)}
        <span class="pts">${sc(p.d).total}</span>
      </button>`).join('')
      + `</div>`
      + (players.length < maxP() ? `<button class="tab add" id="addP" title="Ajouter un joueur">+</button>` : '');
    document.getElementById('sheetBody').setAttribute('aria-labelledby', 'tab-' + cur);
    /* ne jamais réécrire le champ pendant que l'utilisateur y tape : vider le
       champ le remplirait aussitôt du nom par défaut, caret déplacé en fin */
    const pname = document.getElementById('pname');
    if(document.activeElement !== pname) pname.value = players[cur].nom;
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
  let wakeLock = null, wakeLockPending = false;
  async function syncWakeLock(){
    if(!('wakeLock' in navigator) || wakeLockPending) return;
    try{
      if(started && !wakeLock && document.visibilityState === 'visible'){
        wakeLockPending = true; // un seul request en vol (refresh à chaque frappe) : pas de second verrou qui fuirait
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', ()=>{ wakeLock = null; });
      } else if(!started && wakeLock){ wakeLock.release(); wakeLock = null; }
    }catch(e){}
    wakeLockPending = false;
  }
  document.addEventListener('visibilitychange', syncWakeLock);

  /* Le classement (lib/sheet.js, competition ranking 1,1,3) — l'unique
     constructeur, consommé par l'archive, le panneau et le texte partagé :
     trois vues du même tri, jamais trois tris. */
  const ranked = () => GameSheet.ranked(
    players.map(p => ({nom: p.nom, c: p.c, d: p.d, s: sc(p.d)})),
    {lowWins: cfg.lowWins, tiebreak: cfg.tiebreak});

  /* Archive la partie dans l'historique global (clé scores-history-v1, lue par
     history.html) : classement figé au moment du reset, si des scores ont été saisis.
     Datée de la dernière vraie interaction : Date.now() si on vient de jouer,
     le ts de la sauvegarde chargée si on rouvre juste pour terminer. */
  function archive(){
    if(!started) return;
    try{
      const entry = GameSheet.archiveEntry(ranked(), {
        slug, t: touched ? Date.now() : (loadedTs || Date.now()),
        exts: extLabels(),
        rankParts: cfg.rankParts,
        rankExtra: d => cfg.rankExtra ? cfg.rankExtra(d, ctx) : ''
      });
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      h.unshift(entry);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 200)));
      fillNameSuggestions();
    }catch(e){ storageWarn(); }
  }

  function showRank(){
    document.getElementById('rankList').innerHTML = ranked().map(it=>{
      const parts = cfg.rankParts(it.s, it.d).filter(x=>x[1]).map(x=>x[0]+' '+x[1]).join(' · ')
                    || 'Aucun point saisi';
      const extra = cfg.rankExtra ? cfg.rankExtra(it.d, ctx) : '';
      return `<div class="rank ${it.pos===1?'win':''}">
        <span class="pos">${it.pos}</span>
        <span class="nm" style="color:${COLORS[it.c]}">${esc(it.nom)}<small>${parts}${extra}</small></span>
        <span class="pt">${it.s.total}</span></div>`;
    }).join('');
    document.getElementById('rankSheet').classList.add('open');
    document.documentElement.classList.add('no-scroll'); // pas de scroll du fond derrière le panneau
    // partage : seulement si des scores ont été saisis et qu'un canal existe
    document.getElementById('shareRank').hidden =
      !started || !(navigator.share || navigator.clipboard);
    document.getElementById('closeRank').focus(); // le dialog prend le focus à l'ouverture
  }

  /* Texte du classement pour partage (le groupe de la soirée) — même tri que
     le panneau (lib/sheet.js). */
  function shareText(){
    return GameSheet.shareText(ranked(), {
      gameName, exts: extLabels(),
      date: new Date().toLocaleDateString('fr-FR')
    });
  }

  /* Partage natif si disponible, copie dans le presse-papier sinon (le bouton
     n'apparaît que si l'un des deux existe). L'annulation du partage par
     l'utilisateur n'est pas une erreur. */
  let shareResetTimer = null;
  async function shareRank(){
    const text = shareText();
    if(navigator.share){
      try{ await navigator.share({text}); }catch(e){}
      return;
    }
    try{
      await navigator.clipboard.writeText(text);
      const b = document.getElementById('shareRank');
      b.textContent = 'Classement copié ✓';
      clearTimeout(shareResetTimer);
      shareResetTimer = setTimeout(()=>{ b.textContent = 'Partager le classement'; }, 1500);
    }catch(e){}
  }

  function closeRank(){
    document.getElementById('rankSheet').classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    document.getElementById('openRank').focus(); // rendre le focus au bouton qui a ouvert
  }

  /* Clavier : Escape ferme le classement, Tab reste dans le dialog tant qu'il
     est ouvert (piège de focus léger sur ses boutons). */
  document.addEventListener('keydown', e=>{
    const sheet = document.getElementById('rankSheet');
    if(!sheet.classList.contains('open')) return;
    if(e.key === 'Escape'){ closeRank(); return; }
    if(e.key === 'Tab'){
      // un bouton caché (#shareRank sans canal de partage) casserait le piège
      const f = [...sheet.querySelectorAll('button')].filter(b => !b.hidden);
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
    // second doigt ou bouton secondaire : inerte (undefined = événement synthétique, accepté)
    if(!st || e.isPrimary === false || e.button > 0) return;
    stopHold(); // jamais deux timers en vol (pointerup perdu, pointeurs mêlés) : l'interval fuirait
    if(gestureSnapped && !holdFired) undoStack.pop(); // geste précédent avorté sans clic : son snapshot est inutile
    snap(); gestureSnapped = true; // l'appui entier (clic ou répétition longue) = un cran d'annulation
    holdFired = false;
    holdTimer = setTimeout(()=>{
      holdFired = true; started = true; touched = true;
      doStep(st);
      holdInt = setInterval(()=>doStep(st), 110);
    }, 400);
  });
  document.addEventListener('pointerup', stopHold);
  document.addEventListener('pointercancel', ()=>{
    stopHold();
    /* geste avorté (scroll, doigt glissé) : aucun clic ne suivra — retirer le
       snapshot, sauf si la répétition longue a déjà saisi des crans */
    if(gestureSnapped && !holdFired) undoStack.pop();
    gestureSnapped = false; holdFired = false;
  });

  document.addEventListener('click', e=>{
    /* snap toujours avant de poser started : le snapshot doit capturer l'état
       d'avant le geste pour que l'annuler rende la feuille non commencée */
    const sb = e.target.closest && e.target.closest('#sheetBody button');
    if(sb && sb.dataset.step === undefined){ // les steppers sont snapshotés au pointerdown
      snap();
      /* data-config (extensions, face du plateau…) : de la configuration, pas
         une saisie — ne marque pas la partie comme commencée */
      if(sb.dataset.config === undefined) started = touched = true;
    }
    if(cfg.exts){
      const ext = e.target.closest && e.target.closest('[data-ext]');
      if(ext){
        exts[ext.dataset.ext] = !exts[ext.dataset.ext];
        ctx.trimToMax(); // le plafond de joueurs peut dépendre des extensions
        drawSheet(); return;
      }
    }
    if(cfg.onClick && cfg.onClick(e, ctx)) return;
    const st = e.target.closest('[data-step]');
    if(st){
      if(holdFired){ holdFired = false; gestureSnapped = false; return; }
      if(!gestureSnapped) snap(); // clic sans pointerdown (clavier, événement synthétique)
      gestureSnapped = false;
      started = touched = true;
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
    if(tab){
      // drawTabs reconstruit les onglets : re-focaliser celui qui vient d'être
      // activé au clavier, sinon le focus retombe sur <body>
      const hadFocus = document.activeElement && document.activeElement.closest
        && document.activeElement.closest('#tabs');
      cur = +tab.dataset.tab; drawSheet();
      if(hadFocus) document.querySelector(`#tabs [data-tab="${cur}"]`).focus();
      return;
    }
    if(e.target.id === 'addP'){ players.push(mk('Joueur '+(players.length+1))); cur = players.length-1; drawSheet(); return; }
    if(e.target.id === 'kill'){
      const p = players[cur];
      // même heuristique que le legacy started : la feuille dévie-t-elle de la vierge ?
      // (limite assumée : un joueur revenu exactement au total vierge n'est pas détecté)
      const dirty = sc(p.d).total !== sc(cfg.blank()).total;
      if(dirty && !confirm(`Retirer ${p.nom} ? Ses scores seront perdus.`)) return;
      players.splice(cur,1); cur = 0; drawSheet(); return;
    }
    if(e.target.id === 'openRank'){ showRank(); return; }
    if(e.target.id === 'shareRank'){ shareRank(); return; }
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
      // une série de frappes dans un même champ = un seul cran d'annulation ;
      // snap avant started, pour la même raison que dans le handler click
      if(e.target !== lastInputTarget){ snap(); lastInputTarget = e.target; }
      if(e.target.id !== 'pname') started = touched = true;
    }
    if(cfg.onInput && cfg.onInput(e, ctx)) return;
    const d = players[cur].d;
    if(e.target.id === 'pname'){ players[cur].nom = e.target.value; refresh(); return; }
    if(e.target.dataset.num !== undefined){
      const p = e.target.dataset.num, v = +e.target.value || 0;
      set(d, p, (cfg.signed && cfg.signed.has(p)) ? v : Math.max(0, v));
      refresh();
    }
  });

  /* Au blur (événement change) : redonner son nom par défaut à un joueur laissé
     sans nom (le vider est permis pendant la frappe), et resynchroniser un champ
     numérique avec la valeur stockée. */
  document.addEventListener('change', e=>{
    if(e.target.id === 'pname'){
      if(!e.target.value.trim()) players[cur].nom = 'Joueur '+(cur+1);
      e.target.value = players[cur].nom;
      refresh(); return;
    }
    if(e.target.dataset && e.target.dataset.num !== undefined) refresh();
  });

  /* Un autre onglet a modifié la sauvegarde de ce jeu (l'événement storage ne
     se déclenche jamais dans l'onglet qui écrit) : recharger son état plutôt
     que de l'écraser au prochain refresh. Une suppression (import, autre onglet)
     repart d'une feuille vierge au lieu de ressusciter l'état en mémoire. */
  window.addEventListener('storage', e => {
    if(e.key !== key) return;
    undoStack.length = 0;
    if(e.newValue === null){
      if(cfg.exts) exts = {...cfg.exts.defauts};
      players = Array.from({length: cfg.startPlayers || 2}, (_,i)=>mk('Joueur '+(i+1), i));
      cur = 0; started = false; touched = false; loadedTs = 0;
      drawSheet(); return;
    }
    load(); drawSheet();
  });

  load();
  fillNameSuggestions();
  drawSheet();

  // enregistrement du SW, bannière de mise à jour et storage.persist : sw-client.js
  return ctx;
}
