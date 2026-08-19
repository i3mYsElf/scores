/* lib/stats.js — statistiques par joueur calculées depuis l'historique
   (scores-history-v1). Logique pure, sans DOM. */
(function(){
  /* history : tableau d'entrées {g, t, players:[{nom,total,pos?}]} déjà classées
     (le vainqueur en position 0, tiebreak compris — voir archive() de common.js ;
     pos ne figure que sur les ex æquo, une partie peut donc avoir plusieurs
     vainqueurs), de la plus récente à la plus ancienne.
     Retourne un tableau par joueur — noms regroupés sans tenir compte de la
     casse, la casse affichée est celle de la partie la plus récente — trié
     victoires puis parties décroissantes puis nom :
       {nom, parties, victoires, taux, bests:[{g, total, parties}]}
     - taux : % (arrondi) de victoires sur les parties multi-joueurs, null s'il
       n'y en a aucune — une partie solo compte comme partie mais ne se gagne pas.
     - bests : record par jeu (un total ne se compare qu'au sein d'un même jeu),
       jeu le plus joué d'abord, à égalité le plus récemment joué.
     lowWins (optionnel) : slugs des jeux où le plus petit total gagne — leur
       record est le minimum, pas le maximum. */
  function computeStats(history, lowWins){
    const low = new Set(lowWins || []);
    const byName = new Map(); // clé : nom en minuscules
    for(const e of Array.isArray(history) ? history : []){
      if(!e || !Array.isArray(e.players)) continue;
      e.players.forEach((p, i) => {
        if(!p || typeof p.nom !== 'string') return;
        const key = p.nom.toLocaleLowerCase('fr');
        let s = byName.get(key);
        if(!s){ s = {nom: p.nom, parties: 0, victoires: 0, multi: 0, bests: new Map()}; byName.set(key, s); }
        s.parties++;
        if(e.players.length > 1){ s.multi++; if((p.pos || i + 1) === 1) s.victoires++; }
        const total = +p.total || 0;
        const b = s.bests.get(e.g);
        if(!b) s.bests.set(e.g, {g: e.g, total, parties: 1}); // ordre d'insertion = récence
        else { b.parties++; if(low.has(e.g) ? total < b.total : total > b.total) b.total = total; }
      });
    }
    return [...byName.values()].map(s => ({
      nom: s.nom, parties: s.parties, victoires: s.victoires,
      taux: s.multi ? Math.round(100 * s.victoires / s.multi) : null,
      // tri stable : à égalité de parties, l'ordre d'insertion (récence) est conservé
      bests: [...s.bests.values()].sort((a, b) => b.parties - a.parties)
    })).sort((a, b) =>
      b.victoires - a.victoires || b.parties - a.parties || a.nom.localeCompare(b.nom));
  }

  const api = {computeStats};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameStats = api;
})();
