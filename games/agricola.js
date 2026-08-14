/* Logique de score Agricola — pure, sans DOM (navigateur + Node).
   Barème officiel : chaque catégorie rapporte −1/1/2/3/4 points selon des seuils. */
(function(){
/* steps = [[seuil, points]] décroissants ; en dessous du plus petit seuil : −1 */
const tier = (n, steps) => { for(const [min, pts] of steps) if(n >= min) return pts; return -1; };
const SEUILS = {
  champs:    [[5,4],[4,3],[3,2],[2,1]],   // 0-1 → −1
  paturages: [[4,4],[3,3],[2,2],[1,1]],   // 0 → −1
  cereales:  [[8,4],[6,3],[4,2],[1,1]],   // en réserve + sur les champs
  legumes:   [[4,4],[3,3],[2,2],[1,1]],
  moutons:   [[8,4],[6,3],[4,2],[1,1]],
  sangliers: [[7,4],[5,3],[3,2],[1,1]],
  boeufs:    [[6,4],[4,3],[2,2],[1,1]]
};

const blank = () => ({
  champs:0, cereales:0, legumes:0,
  paturages:0, moutons:0, sangliers:0, boeufs:0, etables:0,
  vides:0, argile:0, pierre:0, personnes:2,
  cartes:0, bonus:0, mendicite:0
});

function score(d){
  const t = {};
  for(const k of Object.keys(SEUILS)) t[k] = tier(d[k], SEUILS[k]);
  const etables = d.etables;                       // +1 par étable clôturée
  const vides = -d.vides;                          // −1 par case inutilisée
  const maison = d.argile + 2*d.pierre;            // bois : 0
  const personnes = 3*d.personnes;
  const cartes = (+d.cartes||0) + (+d.bonus||0);
  const mendicite = -3*d.mendicite;
  const cultures = t.champs + t.cereales + t.legumes;
  const elevage = t.paturages + t.moutons + t.sangliers + t.boeufs + etables;
  const ferme = vides + maison + personnes;
  return {...t, etables, vides, maison, personnes, cartes, mendicite,
          cultures, elevage, ferme,
          total: cultures + elevage + ferme + cartes + mendicite};
}

const api = {blank, score, tier, SEUILS};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
