/* Logique de score Odin — pure, sans DOM (navigateur + Node).
   Odin (Helvetiq, As d'Or 2025) : jeu de défausse en manches. À la fin de
   chaque manche, chaque joueur marque 1 point de PÉNALITÉ par carte restant
   en main. Le PLUS PETIT total gagne (lowWins dans le registre et la
   feuille) ; la partie s'achève quand un cumul atteint FIN_PARTIE points
   de pénalité (15 par défaut, ajustable de ±5 selon le livret). */
(function(){
const FIN_PARTIE = 15; // la partie s'achève quand un cumul atteint 15 points

const blank = () => ({manches: [], manche: 0});
// manches : points de pénalité des manches validées ; manche : cartes
// restant en main pour la manche en cours (1 pt chacune)

const n = v => +v || 0;

function score(d){
  const manche = Math.max(0, n(d.manche));
  const precedentes = d.manches.reduce((a, v) => a + n(v), 0);
  return {manche, precedentes, total: precedentes + manche};
}

/* Valide la manche de TOUS les joueurs d'un coup (la feuille déroule les
   onglets, mais la manche physique est commune) : les cartes restantes
   deviennent des points de pénalité, les mains repartent à zéro. */
function validerManches(players){
  players.forEach(p => {
    p.d.manches.push(Math.max(0, n(p.d.manche)));
    p.d.manche = 0;
  });
}

/* relecture d'anciennes sauvegardes : liste et types toujours valides */
const fixup = d => {
  if (!Array.isArray(d.manches)) d.manches = [];
  else d.manches = d.manches.map(v => Math.max(0, n(v)));
  d.manche = Math.max(0, n(d.manche));
};

/* 2 à 6 joueurs selon la boîte */
const maxPlayers = () => 6;

const api = {blank, score, fixup, validerManches, maxPlayers, FIN_PARTIE};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
