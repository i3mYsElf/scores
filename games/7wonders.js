/* Logique de score 7 Wonders (base + extensions) — pure, sans DOM (navigateur + Node) */
(function(){
const blank = () => ({
  def:0, v1:0, v2:0, v3:0,                       // conflits militaires
  pieces:0,                                       // trésor
  merveille:0, civils:0, commerce:0, guildes:0,   // points de cartes
  compas:0, roue:0, tablette:0, jokers:0,         // science
  leaders:0,                                      // Leaders
  cities:0, dettes:0,                             // Cities
  naval:0, iles:0, flotte:0,                      // Armada
  edifice:0                                       // Édifice
});

/* Science : n² par symbole + 7 par set complet, jokers affectés au mieux (force brute) */
function bestScience(a,b,c,j){
  let best = 0;
  for(let i=0;i<=j;i++) for(let k=0;i+k<=j;k++){
    const x=a+i, y=b+k, z=c+(j-i-k);
    best = Math.max(best, x*x + y*y + z*z + 7*Math.min(x,y,z));
  }
  return best;
}

function score(d, exts){
  exts = exts || {};
  const militaire = -d.def + d.v1 + 3*d.v2 + 5*d.v3;
  const tresor = Math.floor(d.pieces/3);
  const science = bestScience(d.compas, d.roue, d.tablette, d.jokers);
  const merveille=+d.merveille||0, civils=+d.civils||0, commerce=+d.commerce||0, guildes=+d.guildes||0;
  const leaders = exts.leaders ? (+d.leaders||0) : 0;
  const cities  = exts.cities  ? (+d.cities||0) - d.dettes : 0;
  const armada  = exts.armada  ? (+d.naval||0) + (+d.iles||0) + (+d.flotte||0) : 0;
  const edifice = exts.edifice ? (+d.edifice||0) : 0;
  return {militaire, tresor, merveille, civils, commerce, guildes, science,
          leaders, cities, armada, edifice,
          total: militaire+tresor+merveille+civils+commerce+guildes+science
                 +leaders+cities+armada+edifice};
}

const api = {blank, score, bestScience};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
