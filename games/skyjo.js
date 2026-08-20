/* Logique de score Skyjo — pure, sans DOM (navigateur + Node).
   Jeu en manches cumulées où le PLUS PETIT total gagne (lowWins dans le
   registre et la feuille) : d.manches garde les manches validées (négatifs
   possibles, les cartes vont de −2 à 12), manche est la somme des cartes de
   la manche en cours, fini marque le joueur qui a retourné toutes ses cartes
   le premier. Règle officielle du doublement : si ce joueur n'a pas
   strictement le plus petit score de la manche, ses points de manche sont
   doublés — seulement s'ils sont positifs. */
(function(){
const FIN_PARTIE = 100; // la partie s'achève quand un cumul atteint 100 points

const blank = () => ({manches: [], manche: 0, fini: 0});

const n = v => +v || 0;

/* opts = {players} : les joueurs de la feuille ({d} au minimum), pour le
   doublement — d est comparé par identité pour exclure le joueur lui-même. */
function score(d, opts){
  const players = (opts && opts.players) || [];
  const brute = n(d.manche);
  const doublee = !!d.fini && brute > 0
    && players.some(p => p && p.d && p.d !== d && n(p.d.manche) <= brute);
  const manche = doublee ? brute * 2 : brute;
  const precedentes = d.manches.reduce((a, v) => a + n(v), 0);
  return {brute, doublee, manche, precedentes, total: precedentes + manche};
}

/* relecture d'anciennes sauvegardes : liste et types toujours valides */
const fixup = d => {
  if(!Array.isArray(d.manches)) d.manches = [];
  d.manche = n(d.manche);
  d.fini = d.fini ? 1 : 0;
};

/* Un seul « fermeur » par manche : marquer d désactive tous les autres */
function setFini(players, d, on){
  players.forEach(p => { p.d.fini = 0; });
  d.fini = on ? 1 : 0;
}

/* Valide la manche de TOUS les joueurs d'un coup : le doublement compare les
   manches en cours, figer l'un avant l'autre fausserait le calcul. */
function validerManches(players){
  const vals = players.map(p => score(p.d, {players}).manche);
  players.forEach((p, i) => { p.d.manches.push(vals[i]); p.d.manche = 0; p.d.fini = 0; });
}

const maxPlayers = () => 8;

const api = {blank, score, fixup, setFini, validerManches, maxPlayers, FIN_PARTIE};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
