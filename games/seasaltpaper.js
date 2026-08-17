/* Logique de score Sea Salt & Paper — pure, sans DOM (navigateur + Node).
   Jeu en manches cumulées : d.manches garde les manches validées, le reste
   décrit la manche en cours (nombres de CARTES, les paires sont calculées). */
(function(){
/* Paliers des collections : index = nombre de cartes, clampé au max du paquet */
const COQUILLAGES = [0, 0, 2, 4, 6, 8, 10]; // 6 cartes max
const POULPES     = [0, 0, 3, 6, 9, 12];    // 5 max
const PINGOUINS   = [0, 1, 3, 5];           // 3 max
const MARINS      = [0, 0, 5];              // 2 max

/* Objectif de fin de partie selon le nombre de joueurs (règle officielle) :
   la partie s'achève à la fin de la manche où un joueur l'atteint. */
const OBJECTIFS = {2: 40, 3: 35, 4: 30};
const objectif = nb => OBJECTIFS[nb] || 30;

const blank = () => ({
  manches: [],                                            // scores des manches validées
  crabes:0, bateaux:0, poissons:0, nageurs:0, requins:0,  // duos : 1 pt la paire
  coquillages:0, poulpes:0, pingouins:0, marins:0,        // collections à paliers
  phare:0, banc:0, colonie:0, capitaine:0,                // multiplicateurs (0/1)
  sirenes: [],           // une entrée par sirène : cartes de sa couleur majoritaire
  bonus: 0,              // bonus couleur (cartes de la couleur majoritaire)
  fin: 'stop'            // 'stop' | 'gagne' (pts + bonus) | 'perdu' (bonus seul)
});

const n = v => Math.max(0, +v || 0);
const palier = (bareme, v) => bareme[Math.min(n(v), bareme.length - 1)];

function score(d){
  const duos = Math.floor(n(d.crabes)/2) + Math.floor(n(d.bateaux)/2)
             + Math.floor(n(d.poissons)/2) + Math.min(n(d.nageurs), n(d.requins));
  const collections = palier(COQUILLAGES, d.coquillages) + palier(POULPES, d.poulpes)
                    + palier(PINGOUINS, d.pingouins) + palier(MARINS, d.marins);
  const mult = (d.phare ? n(d.bateaux) : 0) + (d.banc ? n(d.poissons) : 0)
             + (d.colonie ? 2*n(d.pingouins) : 0) + (d.capitaine ? 3*n(d.marins) : 0);
  const sirenes = d.sirenes.slice(0, 4).reduce((a, v) => a + n(v), 0);
  const pts = duos + collections + mult + sirenes;
  const bonus = n(d.bonus);
  const manche = d.fin === 'perdu' ? bonus : d.fin === 'gagne' ? pts + bonus : pts;
  const precedentes = d.manches.reduce((a, v) => a + n(v), 0);
  return {duos, collections, mult, sirenes, pts, bonus, manche, precedentes,
          total: precedentes + manche};
}

const api = {blank, score, objectif};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.GameLogic = api;
})();
