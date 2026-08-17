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

/* Départage officiel : le plus grand domaine (en cases) */
const maxDomaine = d => d.domaines.reduce((a,m)=>Math.max(a, +m.c||0), 0);

const api = {blank, score, maxDomaine};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
