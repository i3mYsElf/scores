/* Logique de score It's a Wonderful World — pure, sans DOM (navigateur + Node) */
(function(){
const blank = () => ({
  fixes:0,                 // PV imprimés sur les cartes
  mults:[{v:0,n:0}],       // cartes multiplicatrices : v PV × n
  financiers:0, generaux:0,// jetons personnages (1 PV chacun)
  cartes:0                 // cartes construites — départage uniquement
});

function score(d){
  const fixes = +d.fixes || 0;
  const mults = d.mults.reduce((a,m)=>a + (+m.v||0)*(+m.n||0), 0);
  const financiers = d.financiers, generaux = d.generaux;
  return {fixes, mults, financiers, generaux,
          total: fixes + mults + financiers + generaux};
}

/* relecture d'anciennes sauvegardes : toujours au moins une ligne de multiplicateur */
const fixup = d => { if(!Array.isArray(d.mults) || !d.mults.length) d.mults = [{v:0,n:0}]; };

const maxPlayers = () => 5;

const api = {blank, score, fixup, maxPlayers};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
