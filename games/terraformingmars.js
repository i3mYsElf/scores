/* Logique de score Terraforming Mars — pure, sans DOM (navigateur + Node).
   NT de départ : 20. Récompenses : 5 PV la 1re place, 2 PV la 2e —
   sauf à 2 joueurs où la 2e place ne rapporte rien. Départage : mégacrédits. */
(function(){
const blank = () => ({
  tr:20,                    // niveau de terraformation final
  objectifs:0,              // objectifs revendiqués (5 PV chacun)
  prem:0, sec:0,            // récompenses : 1res places (5 PV), 2es places (2 PV)
  forets:0,                 // tuiles forêt (1 PV chacune)
  villes:0,                 // PV de villes (1 par forêt adjacente, tout propriétaire)
  cartes:0,                 // PV des cartes (peut être négatif)
  mc:0                      // mégacrédits restants — départage uniquement
});

function score(d, nPlayers){
  const nt = +d.tr || 0;
  const objectifs = 5*d.objectifs;
  const recompenses = 5*d.prem + (nPlayers === 2 ? 0 : 2*d.sec);
  const plateau = d.forets + (+d.villes||0);
  const cartes = +d.cartes || 0;
  return {nt, objectifs, recompenses, plateau, cartes,
          total: nt + objectifs + recompenses + plateau + cartes};
}

const api = {blank, score};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
