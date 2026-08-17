/* lib/backup.js — aperçus « Partie en cours » et export/import des sauvegardes.
   Logique pure, sans DOM : le storage est passé en paramètre (localStorage dans
   les pages, un stub en test). */
(function(){
  const REG = (typeof module !== 'undefined' && module.exports)
    ? require('./registry.js') : globalThis.GameRegistry;

  const backupKeys = () => [...REG.GAMES.map(g => REG.gameKey(g.slug)), REG.HISTORY_KEY];

  /* Sous-titre d'une carte de l'accueil pour une sauvegarde parsée, ou null si
     la partie n'est pas commencée (une feuille juste visitée ne compte pas).
     Le flag started fait foi seul : les totaux ne disent rien (une feuille
     d'Agricola commencée reste négative, une feuille de TM vierge vaut 20). */
  function previewLabel(s){
    if(!(s && s.started && Array.isArray(s.players) && Array.isArray(s.totals))) return null;
    return 'Partie en cours · ' + s.players.map((p,i) => (p.nom || '?') + ' ' + (s.totals[i] || 0)).join(' · ');
  }

  /* Sous-titre de la carte Historique, ou null si l'historique est vide. */
  function historyLabel(h){
    if(!Array.isArray(h) || !h.length) return null;
    return h.length + (h.length > 1 ? ' parties terminées' : ' partie terminée');
  }

  function buildBackup(storage){
    const data = {};
    for(const k of backupKeys()){
      const v = storage.getItem(k);
      if(v !== null){ try{ data[k] = JSON.parse(v); }catch(e){} }
    }
    return {app: 'scores', version: 1, date: new Date().toISOString(), data};
  }

  /* N'écrit que les clés connues (jeux du registre + historique), jamais de clé
     arbitraire. Retourne le nombre de sauvegardes restaurées. */
  function applyBackup(storage, o){
    if(!o || o.app !== 'scores' || typeof o.data !== 'object' || !o.data) throw new Error('format inattendu');
    const allowed = new Set(backupKeys());
    let n = 0;
    for(const [k,v] of Object.entries(o.data)){
      if(allowed.has(k)){ storage.setItem(k, JSON.stringify(v)); n++; }
    }
    return n;
  }

  const api = {backupKeys, previewLabel, historyLabel, buildBackup, applyBackup};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameBackup = api;
})();
