/* Logique de score Queendomino — pure, sans DOM (navigateur + Node) */
(function(){
const blank = () => ({
  domaines:[{c:0,k:0}],  // un domaine = c cases × k couronnes (la reine = +1 couronne)
  batFixes:0,            // bâtiments : PV fixes imprimés
  batTours:0,            // bâtiments : PV liés aux tours
  batChevaliers:0,       // bâtiments : PV liés aux chevaliers
  quetes:0,              // tuiles quêtes en jeu (variable selon la mise en place)
  pieces:0               // 1 PV par lot de 3 pièces
});

function score(d){
  const domaines = d.domaines.reduce((a,m)=>a + (+m.c||0)*(+m.k||0), 0);
  const batiments = (+d.batFixes||0) + (+d.batTours||0) + (+d.batChevaliers||0);
  const quetes = +d.quetes || 0;
  const tresor = Math.floor((+d.pieces||0)/3);
  return {domaines, batiments, quetes, tresor,
          total: domaines + batiments + quetes + tresor};
}

/* Départage officiel : le plus grand domaine (en cases) */
const maxDomaine = d => d.domaines.reduce((a,m)=>Math.max(a, +m.c||0), 0);

const api = {blank, score, maxDomaine};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
