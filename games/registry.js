/* games/registry.js — registre central des jeux : source de vérité de la liste,
   consommée par l'accueil (aperçus, export/import), l'historique et les tests
   de cohérence. Données pures, sans DOM. Ce n'est pas un jeu : pas de blank/score. */
(function(){
  const GAMES = [
    {slug: 'harmonies',        name: 'Harmonies',              subtitle: 'Feuille de fin de partie'},
    {slug: '7wonders',         name: '7 Wonders',              subtitle: 'Base et extensions'},
    {slug: 'wonderfulworld',   name: "It's a Wonderful World", subtitle: 'Cartes et multiplicateurs'},
    {slug: 'agricola',         name: 'Agricola',               subtitle: 'Barème par seuils calculé'},
    {slug: 'cascadia',         name: 'Cascadia',               subtitle: "Majorités d'habitats automatiques"},
    {slug: 'terraformingmars', name: 'Terraforming Mars',      subtitle: 'NT, objectifs, récompenses, plateau'}
  ];

  const gameKey  = slug => slug + '-score-v1';
  const gamePage = slug => slug + '.html';
  const HISTORY_KEY = 'scores-history-v1';

  const api = {GAMES, gameKey, gamePage, HISTORY_KEY};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameRegistry = api;
})();
