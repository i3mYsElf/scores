/* theme.js — bascule manuelle clair/sombre, persistée (clé scores-theme-v1,
   valeurs 'light'/'dark' ; absente = thème système, comme avant).
   Chargé bloquant dans le <head> de toutes les pages, avant le premier rendu,
   pour éviter un flash du mauvais thème. L'UI de bascule vit sur l'accueil
   (index.html) via globalThis.Theme. */
(function(){
  const KEY = 'scores-theme-v1';
  const COLORS = {light: '#F4F4F1', dark: '#141414'};

  function stored(){
    try{
      const t = localStorage.getItem(KEY);
      return t === 'light' || t === 'dark' ? t : null;
    }catch(e){ return null; }
  }

  /* Pose (ou retire) data-theme sur <html> et aligne les <meta theme-color> :
     thème forcé -> les deux metas prennent sa couleur (sinon la barre système
     suivrait encore le thème du système) ; auto -> chaque meta retrouve la
     couleur de son media query. */
  function apply(t){
    if(t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
      const media = m.getAttribute('media') || '';
      m.content = t ? COLORS[t] : COLORS[media.includes('dark') ? 'dark' : 'light'];
    });
  }

  function set(t){
    try{ t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); }catch(e){}
    apply(t);
  }

  apply(stored());
  // un autre onglet a changé le thème : suivre
  window.addEventListener('storage', e => { if(e.key === KEY) apply(stored()); });

  globalThis.Theme = {KEY, get: stored, set};
})();
