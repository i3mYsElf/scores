/* games/stats.js — statistiques par joueur calculées depuis l'historique
   (scores-history-v1). Logique pure, sans DOM. Ce n'est pas un jeu. */
(function(){
  /* history : tableau d'entrées {g, t, players:[{nom,total}]} déjà classées
     (le vainqueur en position 0, tiebreak compris — voir archive() de common.js).
     Retourne un tableau par joueur (clé = nom exact), trié victoires puis
     parties décroissantes puis nom :
       {nom, parties, victoires, best:{g, total}}
     Une partie solo compte comme partie mais pas comme victoire. */
  function computeStats(history){
    const byName = new Map();
    for(const e of Array.isArray(history) ? history : []){
      if(!e || !Array.isArray(e.players)) continue;
      e.players.forEach((p, i) => {
        if(!p || typeof p.nom !== 'string') return;
        let s = byName.get(p.nom);
        if(!s){ s = {nom: p.nom, parties: 0, victoires: 0, best: null}; byName.set(p.nom, s); }
        s.parties++;
        if(i === 0 && e.players.length > 1) s.victoires++;
        const total = +p.total || 0;
        if(!s.best || total > s.best.total) s.best = {g: e.g, total};
      });
    }
    return [...byName.values()].sort((a,b) =>
      b.victoires - a.victoires || b.parties - a.parties || a.nom.localeCompare(b.nom));
  }

  const api = {computeStats};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameStats = api;
})();
