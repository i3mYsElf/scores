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
     arbitraire, et de façon atomique : tout est préparé avant la première
     écriture, et si le storage refuse en cours de route (quota plein…), les
     clés déjà écrites sont restaurées à leur valeur d'avant l'import.
     Retourne le nombre de sauvegardes restaurées. Erreurs distinguées par
     err.code : 'format' (fichier invalide, rien d'écrit) / 'storage'
     (écriture impossible, état restauré). */
  function applyBackup(storage, o){
    if(!o || o.app !== 'scores' || typeof o.data !== 'object' || !o.data){
      const err = new Error('format inattendu'); err.code = 'format'; throw err;
    }
    const allowed = new Set(backupKeys());
    const writes = Object.entries(o.data)
      .filter(([k]) => allowed.has(k))
      .map(([k, v]) => [k, JSON.stringify(v)]);
    const before = writes.map(([k]) => [k, storage.getItem(k)]);
    try{
      for(const [k, v] of writes) storage.setItem(k, v);
    }catch(e){
      for(const [k, old] of before){
        try{ old === null ? storage.removeItem(k) : storage.setItem(k, old); }catch(e2){}
      }
      const err = new Error('écriture impossible'); err.code = 'storage'; throw err;
    }
    return writes.length;
  }

  /* Historique en CSV (séparateur ; pour les tableurs français) : une ligne
     par joueur et par partie. names : {slug: nom affiché} (registre). */
  function historyCsv(h, names){
    const cell = v => {
      const s = String(v == null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = [['date', 'jeu', 'position', 'joueur', 'total']];
    for(const e of Array.isArray(h) ? h : []){
      if(!e || !Array.isArray(e.players)) continue;
      const date = e.t ? new Date(e.t).toISOString().slice(0, 16).replace('T', ' ') : '';
      const jeu = (names && names[e.g]) || e.g || '';
      e.players.forEach((p, i) =>
        rows.push([date, jeu, i + 1, (p && p.nom) || '?', +(p && p.total) || 0]));
    }
    return rows.map(r => r.map(cell).join(';')).join('\r\n');
  }

  const api = {backupKeys, previewLabel, historyLabel, buildBackup, applyBackup, historyCsv};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameBackup = api;
})();
