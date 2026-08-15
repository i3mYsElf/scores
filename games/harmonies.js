/* Logique de score Harmonies — pure, sans DOM (navigateur + Node) */
(function(){
const RIVER = [0, 0, 2, 5, 8, 11, 15]; // 0..6 jetons

const blank = () => ({
  arbre:[0,0,0], mont:[0,0,0], champs:0, batiments:0,
  face:'A', riviere:0, iles:1, animaux:0, esprit:0
});

/* migration : les anciennes sauvegardes stockaient une valeur par carte animal */
function fixup(d){
  if(Array.isArray(d.animaux)) d.animaux = d.animaux.reduce((a,b)=>a+(+b||0),0);
}

function score(d){
  const arbre = d.arbre[0]*1 + d.arbre[1]*3 + d.arbre[2]*7;
  const mont  = d.mont[0]*1  + d.mont[1]*3  + d.mont[2]*7;
  const champs = d.champs*5, batiments = d.batiments*5;
  const eau = d.face === 'A'
    ? (d.riviere > 6 ? 15 + (d.riviere-6)*4 : RIVER[d.riviere] || 0)
    : d.iles*5;
  const animaux = +d.animaux || 0;
  const esprit = +d.esprit || 0;
  return {arbre, mont, champs, batiments, eau, animaux, esprit,
          total: arbre+mont+champs+batiments+eau+animaux+esprit};
}

const api = {blank, score, fixup};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
