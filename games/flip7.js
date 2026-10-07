/* Logique de score Flip 7 — pure, sans DOM (navigateur + Node).
   Jeu de push your luck : on pioche des cartes Numéro (0-12).
   - Un doublon = le joueur SAUTE (perd les points de la manche)
   - 7 Numéros différents = FLIP 7 (la manche s'arrête pour tous, +15 pts)
   - Cartes Bonus : +2/+4/+6/+8/+10 ou ×2 (double seulement les cartes Numéro)
   Score de la manche = (somme Numéros × 2 si ×2) + somme Bonus + 15 si Flip 7
   La partie se joue en manches jusqu'à ce qu'un joueur atteigne 200 pts. */
(function(){

const blank = () => ({
  total: 0,           // Score cumulé (objectif : 200 points)
  numbers: [],        // Cartes Numéro de la manche en cours (0-12)
  bonuses: [],        // Cartes Bonus de la manche en cours ('+2','+4','+6','+8','+10','x2')
  isOut: false,       // Le joueur a sauté cette manche (doublon reçu)
  hasFlipped: false   // Flip 7 réalisé pendant cette manche
});

/* Calcul du score pour un joueur.
   d : état du joueur (blank())
   Retourne les détails du score de la Manche EN COURS + le total cumulé.
   - Si le joueur a sauté (isOut), le score de la manche = 0.
   - Le ×2 ne double que les cartes Numéro (pas les Bonus, pas le Flip 7).
   - Le 0 est une carte Numéro mais ne rapporte pas de point. */
function score(d) {
  const numbersSum = d.numbers.reduce((a, v) => a + v, 0);
  const hasDouble = d.bonuses.includes('x2');
  const doubledSum = hasDouble ? numbersSum * 2 : numbersSum;
  
  // Somme des cartes Bonus (+2, +4, +6, +8, +10) — ×2 n'est pas un bonus numérique
  const bonusSum = d.bonuses
    .filter(b => b !== 'x2')
    .reduce((a, b) => a + parseInt(b), 0);
  
  // Flip 7 : 7 cartes Numéro DIFFÉRENTEs (le 0 ne compte pas comme numéro pour Flip 7)
  const uniqueNumbers = new Set(d.numbers.filter(n => n > 0));
  const flip7Bonus = (uniqueNumbers.size >= 7) ? 15 : 0;
  
  // Score de la manche : 0 si le joueur a sauté
  const roundTotal = d.isOut ? 0 : (doubledSum + bonusSum + flip7Bonus);
  
  return {
    numbers: numbersSum,
    doubled: hasDouble ? numbersSum : 0,
    bonuses: bonusSum,
    flip7: flip7Bonus,
    roundTotal: roundTotal,
    total: d.total + roundTotal
  };
}

/* Ajoute une carte Numéro à la manche en cours.
   - Si value > 0 et déjà présent → le joueur saute (isOut = true)
   - Si on atteint 7 numéros uniques (> 0) → Flip 7 (hasFlipped = true)
   Retourne :
     true  → continuer la manche
     false → le joueur a sauté (doublon)
     'flip7' → Flip 7 réalisé (manche terminée pour tous)
   Note : la carte 0 ne provoque pas de saut (mais ne compte pas pour Flip 7). */
function addNumber(d, value) {
  if (d.isOut) return false;
  
  if (value > 0 && d.numbers.includes(value)) {
    d.isOut = true;
    return false; // Sauté !
  }
  
  d.numbers.push(value);
  
  // Vérifier Flip 7 : 7 numéros uniques strictement > 0
  const uniqueNumbers = new Set(d.numbers.filter(n => n > 0));
  if (uniqueNumbers.size >= 7) {
    d.hasFlipped = true;
    return 'flip7';
  }
  
  return true; // Continuer
}

/* Ajoute une carte Bonus à la manche en cours.
   bonusType : '+2' | '+4' | '+6' | '+8' | '+10' | 'x2'
   Si le joueur a déjà sauté, la carte est ignorée. */
function addBonus(d, bonusType) {
  if (d.isOut) return;
  if (!d.bonuses.includes(bonusType)) {
    d.bonuses.push(bonusType);
  }
}

/* Valide la fin de la manche :
   - Ajoute le score de la manche au total cumulé
   - Réinitialise l'état pour la prochaine manche
   Retourne le score de la manche validée. */
function endRound(d) {
  const s = score(d);
  d.total = s.total;
  d.numbers = [];
  d.bonuses = [];
  d.isOut = false;
  d.hasFlipped = false;
  return s.roundTotal;
}

/* Nombre maximum de joueurs selon les règles officielles. */
const maxPlayers = () => 7;

/* Nettoyage d'anciennes sauvegardes : s'assurer que l'état est valide. */
const fixup = (d) => {
  if (d.total === undefined) d.total = 0;
  if (!Array.isArray(d.numbers)) d.numbers = [];
  if (!Array.isArray(d.bonuses)) d.bonuses = [];
  if (d.isOut === undefined) d.isOut = false;
  if (d.hasFlipped === undefined) d.hasFlipped = false;
};

const api = { blank, score, addNumber, addBonus, endRound, maxPlayers, fixup };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
