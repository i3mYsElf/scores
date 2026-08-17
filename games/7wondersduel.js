/* Logique de score 7 Wonders Duel — pure, sans DOM (navigateur + Node).
   Décompte civil uniquement : une suprématie (militaire, scientifique,
   politique avec Agora) termine la partie sans décompte. */
(function(){
const TEMPLES = [0, 5, 12, 21]; // Panthéon : PV pour 0, 1, 2 ou 3 Grands Temples

const blank = () => ({
  civils:0, science:0, commerce:0, guildes:0, // PV imprimés sur les cartes
  merveilles:0, progres:0,                    // merveilles construites, jetons Progrès
  pieces:0,                                   // 1 PV par lot de 3 pièces
  milZone:0,                                  // zone du pion Conflit : 0, 2, 5 ou 10 PV
  divinites:0, temples:0,                     // Panthéon : PV des divinités, Grands Temples (0-3)
  senat:0                                     // Agora : PV des chambres du Sénat contrôlées
});

function score(d, exts = {}){
  const civils = +d.civils||0, science = +d.science||0,
        commerce = +d.commerce||0, guildes = +d.guildes||0,
        merveilles = +d.merveilles||0, progres = +d.progres||0;
  const tresor = Math.floor((+d.pieces||0)/3);
  const militaire = +d.milZone||0;
  const pantheon = exts.pantheon
    ? (+d.divinites||0) + TEMPLES[Math.min(3, +d.temples||0)] : 0;
  const agora = exts.agora ? (+d.senat||0) : 0;
  return {civils, science, commerce, guildes, merveilles, progres,
          tresor, militaire, pantheon, agora,
          total: civils + science + commerce + guildes + merveilles + progres
               + tresor + militaire + pantheon + agora};
}

const api = {blank, score, TEMPLES};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
