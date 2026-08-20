/* lib/history.js — lecture/écriture de l'historique des parties terminées
   (clé scores-history-v1) et re-tri d'une entrée après édition manuelle.
   Logique pure : le storage est passé en paramètre (localStorage dans les
   pages, un stub en test), comme lib/backup.js. */
(function(){
  const REG = (typeof module !== 'undefined' && module.exports)
    ? require('./registry.js') : globalThis.GameRegistry;
  const SHEET = (typeof module !== 'undefined' && module.exports)
    ? require('./sheet.js') : globalThis.GameSheet;

  function readHist(storage){
    try{
      const h = JSON.parse(storage.getItem(REG.HISTORY_KEY)) || [];
      return Array.isArray(h) ? h : [];
    }catch(e){ return []; }
  }

  /* true si écrit — false si le storage refuse (quota, indisponible) */
  function writeHist(storage, h){
    try{ storage.setItem(REG.HISTORY_KEY, JSON.stringify(h)); return true; }
    catch(e){ return false; }
  }

  /* Après édition manuelle d'une entrée : re-trier ses joueurs par total (tri
     stable, l'ordre existant départage) et recalculer les positions figées —
     par égalité de total seul, le départage du jeu n'étant pas recalculable.
     pos posée seulement quand elle dévie du rang (même convention qu'archive). */
  function reorderEntry(entry, lowWins){
    const items = (entry.players || []).map(p => ({p, s: {total: +(p && p.total) || 0}}));
    entry.players = SHEET.ranked(items, {lowWins}).map((it, i) => {
      const p = {...it.p};
      delete p.pos;
      if(it.pos !== i + 1) p.pos = it.pos;
      return p;
    });
  }

  const api = {readHist, writeHist, reorderEntry};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameHistory = api;
})();
