/* Logique de score Kingdomino — pure, sans DOM (navigateur + Node) */
(function(){
const blank = () => ({
  domaines:[{c:0,k:0}],        // un domaine = c cases × k couronnes
  harmonie:false, milieu:false // variantes : +5 royaume complet, +10 château au centre
});

function score(d){
  const domaines = d.domaines.reduce((a,m)=>a + (+m.c||0)*(+m.k||0), 0);
  const bonus = (d.harmonie ? 5 : 0) + (d.milieu ? 10 : 0);
  return {domaines, bonus, total: domaines + bonus};
}

/* Le départage (plus grand domaine) est partagé avec Queendomino : lib/domino.js */
const api = {blank, score};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
