/* Logique de score Flip 7 — pure, sans DOM (navigateur + Node).
   Jeu de push your luck : on pioche des cartes Numéro (0-12, une seule
   copie du 0 dans le paquet, donc le 0 ne fait jamais sauter).
   - Recevoir de la pioche un doublon d'une carte posée : avec une carte
     Seconde Chance en main, le doublon et la carte sont défaussés (une
     seule en main à la fois, défaussée en fin de manche même inutilisée) ;
     sans carte, le joueur SAUTE (perd les points de la manche). Cela se
     marque avec receiveDuplicate() — re-cliquer une carte posée ne fait
     jamais sauter, ça la retire (correction).
   - 7 Numéros DIFFÉRENTS (le 0 compte) = FLIP 7 : la manche s'arrête
     pour tous, +15 pts.
   - Cartes Bonus : +2/+4/+6/+8/+10 ou ×2 (double seulement les cartes Numéro).
   Score de la manche = (somme Numéros × 2 si ×2) + somme Bonus + 15 si Flip 7.
   d.manches garde le score de chaque manche validée (modifiable, comme la
   liste partagée de Skyjo/Sea Salt & Paper) ; la partie se joue jusqu'à ce
   qu'un joueur atteigne FIN_PARTIE points. */
(function(){

const FIN_PARTIE = 200; // la partie s'achève quand un cumul atteint 200 points

const blank = () => ({
  manches: [],         // Scores des manches validées
  numbers: [],         // Cartes Numéro de la manche en cours (0-12)
  bonuses: [],         // Cartes Bonus de la manche en cours ('+2','+4','+6','+8','+10','x2')
  secondChance: false, // Carte Action Seconde Chance en main (max une à la fois)
  isOut: false,        // Le joueur a sauté cette manche (doublon reçu)
  hasFlipped: false    // Flip 7 réalisé pendant cette manche
});

const n = v => +v || 0;

/* Calcul du score pour un joueur.
   d : état du joueur (blank())
   Retourne les détails du score de la Manche EN COURS + le total cumulé.
   - Si le joueur a sauté (isOut), le score de la manche = 0.
   - Le ×2 ne double que les cartes Numéro (pas les Bonus, pas le Flip 7).
   - Le 0 est une carte Numéro : il ne rapporte pas de point mais compte
     parmi les 7 numéros différents du Flip 7. */
function score(d) {
  const numbersSum = d.numbers.reduce((a, v) => a + n(v), 0);
  const hasDouble = d.bonuses.includes('x2');
  const doubledSum = hasDouble ? numbersSum * 2 : numbersSum;

  // Somme des cartes Bonus (+2, +4, +6, +8, +10) — ×2 n'est pas un bonus numérique
  const bonusSum = d.bonuses
    .filter(b => b !== 'x2')
    .reduce((a, b) => a + parseInt(b, 10), 0);

  // Flip 7 : 7 cartes Numéro différentes — le 0 compte
  const uniqueNumbers = new Set(d.numbers.map(n));
  const flip7Bonus = (uniqueNumbers.size >= 7) ? 15 : 0;

  // Score de la manche : 0 si le joueur a sauté
  const roundTotal = d.isOut ? 0 : (doubledSum + bonusSum + flip7Bonus);

  const precedentes = d.manches.reduce((a, v) => a + n(v), 0);

  return {
    numbers: numbersSum,
    doubled: hasDouble ? numbersSum : 0,
    bonuses: bonusSum,
    flip7: flip7Bonus,
    roundTotal: roundTotal,
    precedentes: precedentes,
    total: precedentes + roundTotal
  };
}

/* Touche une carte Numéro : l'ajoute à la manche, ou la RETIRE si elle est
   déjà posée (correction d'un misclic — un re-clic ne fait jamais sauter).
   - 7 numéros différents (0 compris) → Flip 7 : la manche s'arrête
     immédiatement pour ce joueur, plus aucune carte ensuite
   Le doublon réellement reçu dans la pioche se marque avec
   receiveDuplicate(), pas ici.
   Retourne :
     true     → carte ajoutée, manche en cours
     'removed'→ carte retirée de la manche (re-clic de correction)
     'flip7'  → Flip 7 réalisé (manche terminée pour tous)
     false    → la manche est déjà finie (sauté / Flip 7) : rien ne bouge */
function toggleNumber(d, value) {
  if (d.isOut || d.hasFlipped) return false;

  if (d.numbers.includes(value)) {
    d.numbers.splice(d.numbers.indexOf(value), 1);
    return 'removed';
  }

  d.numbers.push(value);

  // Vérifier Flip 7 : 7 numéros différents, le 0 compte
  const uniqueNumbers = new Set(d.numbers.map(n));
  if (uniqueNumbers.size >= 7) {
    d.hasFlipped = true;
    return 'flip7';
  }

  return true; // Continuer
}

/* Le joueur reçoit de la pioche une carte Numéro identique à une carte
   déjà posée (le doublon est défaussé, il n'entre jamais dans la rangée).
   - avec une Seconde Chance en main : la carte est défaussée avec le
     doublon, la manche continue (retourne 'saved')
   - sinon : le joueur saute (isOut = true, 0 point pour la manche)
   Ignoré si la manche est déjà finie (sauté ou Flip 7). */
function receiveDuplicate(d) {
  if (d.isOut || d.hasFlipped) return false;
  if (d.secondChance) {
    d.secondChance = false; // défaussée avec le doublon
    return 'saved';
  }
  d.isOut = true;
  return false; // Sauté !
}

/* Touche une carte Bonus : l'ajoute, ou la retire si elle est déjà posée
   (même correction que les cartes Numéro — une seule de chaque sorte dans
   le paquet, la rangée ne peut pas contenir deux fois la même).
   bonusType : '+2' | '+4' | '+6' | '+8' | '+10' | 'x2'
   Si le joueur a sauté ou réalisé un Flip 7, la manche est finie pour
   lui : la carte est ignorée. */
function toggleBonus(d, bonusType) {
  if (d.isOut || d.hasFlipped) return;
  const i = d.bonuses.indexOf(bonusType);
  if (i === -1) d.bonuses.push(bonusType);
  else d.bonuses.splice(i, 1);
}

/* Carte Action Seconde Chance : une seule en main à la fois, impossible
   après avoir sauté ou réalisé un Flip 7 (la manche est finie, les
   cartes d'un joueur sauté sont défaussées). */
function setSecondChance(d, on) {
  if (d.isOut || d.hasFlipped) return;
  d.secondChance = !!on;
}

/* Valide la fin de la manche :
   - Pousse le score de la manche dans la liste des manches validées
   - Réinitialise l'état pour la prochaine manche (la Seconde Chance est
     défaussée même si elle n'a pas servi)
   Retourne le score de la manche validée. */
function endRound(d) {
  const s = score(d);
  d.manches.push(s.roundTotal);
  d.numbers = [];
  d.bonuses = [];
  d.secondChance = false;
  d.isOut = false;
  d.hasFlipped = false;
  return s.roundTotal;
}

/* Nombre maximum de joueurs selon les règles officielles. */
const maxPlayers = () => 7;

/* Nettoyage d'anciennes sauvegardes : s'assurer que l'état est valide.
   Les sauvegardes d'avant les manches cumulées ne portaient qu'un total
   (number) : il devient une manche unique — le cumul est préservé, seul
   le détail manche par manche est perdu. Le champ total est le marqueur de
   l'ancien format (le nouveau ne l'écrit jamais) : normalizeD a déjà comblé
   manches par la forme vierge avant ce fixup, un tableau vide ne prouve
   donc rien. */
const fixup = (d) => {
  if (d.total !== undefined) {
    if (!Array.isArray(d.manches) || !d.manches.length) {
      const total = n(d.total);
      d.manches = total > 0 ? [total] : [];
    }
    delete d.total;
  }
  if (!Array.isArray(d.manches)) d.manches = [];
  else d.manches = d.manches.map(v => Math.max(0, n(v)));
  if (!Array.isArray(d.numbers)) d.numbers = [];
  if (!Array.isArray(d.bonuses)) d.bonuses = [];
  if (d.secondChance === undefined) d.secondChance = false;
  if (d.isOut === undefined) d.isOut = false;
  if (d.hasFlipped === undefined) d.hasFlipped = false;
};

const api = { blank, score, toggleNumber, receiveDuplicate, toggleBonus, setSecondChance, endRound, maxPlayers, fixup, FIN_PARTIE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
