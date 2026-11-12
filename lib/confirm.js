/* lib/confirm.js — confirm()/alert() natifs remplacés pour les pages sans
   moteur (history.html) : sur iOS/PWA les dialogues natifs sont bruts, hors
   marque et perdent le focus au retour — le moteur (common.js) les a déjà
   remplacés par une feuille maison, celle-ci réutilise le même langage
   (overlay .sheet + .panel, boutons .go-danger/.share/.close de common.css).
   ask() en Promise : Escape, le fond et Annuler résolvent faux ; seul le
   bouton d'action résout vrai ; focus ouvert sur Annuler (le choix sûr) puis
   rendu à l'appelant ; piège de Tab dans le panneau. note() : bandeau bref
   (3 s) empilé dans le conteneur des bannières, une note à la fois —
   résultats d'import, erreurs de stockage. Double export comme les autres
   modules de lib/ (couvert par les tests jsdom de history.html). */
(function(){
  let sheet = null, resolver = null, opener = null;

  function ensureSheet(){
    if(sheet) return sheet;
    document.body.insertAdjacentHTML('beforeend', `
  <div class="sheet" id="gameConfirm">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="gameConfirmTitle"><div class="in">
      <h2 class="title" id="gameConfirmTitle" style="font-size:24px;margin-bottom:14px"></h2>
      <p class="hint" id="gameConfirmMsg" style="font-size:15px;margin:0 0 18px"></p>
      <button class="go-danger" id="gameConfirmOk" type="button"></button>
      <button class="close" id="gameConfirmCancel" type="button">Annuler</button>
    </div></div>
  </div>`);
    sheet = document.getElementById('gameConfirm');
    sheet.addEventListener('click', e=>{
      if(e.target === sheet) close(false); // le fond annule
    });
    document.getElementById('gameConfirmOk').addEventListener('click', ()=> close(true));
    document.getElementById('gameConfirmCancel').addEventListener('click', ()=> close(false));
    document.addEventListener('keydown', e=>{
      if(!sheet.classList.contains('open')) return;
      if(e.key === 'Escape'){ close(false); return; }
      if(e.key === 'Tab'){
        const f = [...sheet.querySelectorAll('button')];
        const first = f[0], last = f[f.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
    return sheet;
  }

  function close(run){
    const r = resolver; resolver = null;
    sheet.classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    const op = opener; opener = null;
    if(op && op.isConnected && !op.hidden) op.focus(); // l'appelant peut avoir disparu (re-rendu)
    if(r) r(run);
  }

  /* ask({title, msg, ok, danger}) -> Promise<boolean>.
     danger (défaut) : action destructive, bouton rouge plein (.go-danger) ;
     danger:false : action ordinaire, contour accent (.share). */
  function ask(opts){
    return new Promise(resolve=>{
      if(resolver) resolver(false); // jamais deux feuilles empilées : la première annule
      ensureSheet();
      document.getElementById('gameConfirmTitle').textContent = opts.title;
      document.getElementById('gameConfirmMsg').textContent = opts.msg || '';
      const ok = document.getElementById('gameConfirmOk');
      ok.textContent = opts.ok || 'Confirmer';
      ok.className = opts.danger === false ? 'share' : 'go-danger';
      resolver = resolve;
      opener = document.activeElement;
      sheet.classList.add('open');
      document.documentElement.classList.add('no-scroll'); // fige la liste dessous
      document.getElementById('gameConfirmCancel').focus();
    });
  }

  /* note(msg, danger) : bandeau éphémère — danger pour les échecs (rouge),
     sinon le style neutre des bannières système. */
  let noteTimer = null;
  function note(msg, danger){
    let b = document.getElementById('banners');
    if(!b){
      b = document.createElement('div');
      b.id = 'banners'; b.className = 'banners'; // même conteneur que common.js / sw-client.js
      document.body.appendChild(b);
    }
    const old = b.querySelector('.game-note');
    if(old) old.remove(); // une note à la fois
    b.insertAdjacentHTML('beforeend',
      `<div class="${danger ? 'storage-warn' : 'sw-update'} game-note" role="status"><span>${msg}</span></div>`);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(()=>{
      const n = document.querySelector('.game-note');
      if(n) n.remove();
    }, 3000);
  }

  const api = {ask, note};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameConfirm = api;
})();
