/* Logique de score Cascadia — pure, sans DOM (navigateur + Node).
   Les bonus de majorité d'habitats se calculent entre joueurs :
   2 joueurs : +2 au plus grand corridor (égalité : +1 chacun) ;
   3-4 joueurs : +3 au plus grand, +1 au deuxième ; les égalités partagent
   la cagnotte (3+1 au premier rang) arrondie à l'inférieur, donc égalité
   à 2 → +2 chacun, à 3+ → +1 chacun, égalité au 2e rang → 0. */
(function(){
const WILDLIFE = ['ours','wapitis','saumons','buses','renards'];
const HABITATS = ['montagnes','forets','prairies','marais','rivieres'];

const blank = () => ({
  ours:0, wapitis:0, saumons:0, buses:0, renards:0,   // points des cartes faune
  montagnes:0, forets:0, prairies:0, marais:0, rivieres:0, // plus grand corridor
  nature:0                                             // jetons nature (1 pt, départage)
});

/* allD : les états `d` de tous les joueurs, dans l'ordre.
   Retourne, pour chaque joueur, {habitat: bonus}. */
function habitatBonuses(allD){
  const n = allD.length;
  const bonuses = allD.map(()=>Object.fromEntries(HABITATS.map(h=>[h,0])));
  if(n < 2) return bonuses;
  for(const h of HABITATS){
    const sizes = allD.map(d=>+d[h]||0);
    const max = Math.max(...sizes);
    if(max < 1) continue;
    const firsts = sizes.flatMap((s,i)=>s===max?[i]:[]);
    if(n === 2){
      const each = firsts.length > 1 ? 1 : 2;
      firsts.forEach(i=>bonuses[i][h] = each);
      continue;
    }
    if(firsts.length > 1){
      const each = Math.floor(4/firsts.length); // cagnotte 3+1 partagée
      firsts.forEach(i=>bonuses[i][h] = each);
      continue;
    }
    bonuses[firsts[0]][h] = 3;
    const rest = sizes.filter((_,i)=>i!==firsts[0]);
    const second = Math.max(...rest);
    if(second >= 1){
      const seconds = sizes.flatMap((s,i)=>s===second && i!==firsts[0] ? [i] : []);
      if(seconds.length === 1) bonuses[seconds[0]][h] = 1; // égalité au 2e rang : 0
    }
  }
  return bonuses;
}

/* opts = {players} : d est retrouvé par identité parmi les joueurs pour ses
   bonus de majorité — une feuille hors joueurs (blank() du moteur, pour
   détecter une feuille vierge) est scorée sans bonus. */
function score(d, opts){
  const players = (opts && opts.players) || [];
  const i = players.findIndex(p => p && p.d === d);
  const bonuses = i >= 0 ? habitatBonuses(players.map(p => p.d))[i] : {};
  const faune = WILDLIFE.reduce((a,k)=>a+(+d[k]||0), 0);
  const habitats = HABITATS.reduce((a,k)=>a+(+d[k]||0), 0);
  const bonus = HABITATS.reduce((a,k)=>a+(bonuses[k]||0), 0);
  const nature = d.nature;
  return {faune, habitats, bonus, nature, total: faune+habitats+bonus+nature};
}

const maxPlayers = () => 4;

const api = {blank, score, habitatBonuses, maxPlayers};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
