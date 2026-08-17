/* lib/registry.js — registre central des jeux : source de vérité de la liste,
   consommée par l'accueil (aperçus), l'historique et les tests de cohérence.
   Données pures, sans DOM. */
(function(){
  /* rules : règles officielles chez l'éditeur (PDF FR quand il existe, sinon
     PDF EN, sinon page éditeur), affichées dans le panneau Classement des
     feuilles. URLs vérifiées en août 2026. */
  const GAMES = [
    {slug: 'harmonies',        name: 'Harmonies',              subtitle: 'Feuille de fin de partie',
     rules: 'https://cdn.svc.asmodee.net/production-libellud/uploads/2024/12/HARMONIES_Rules_FR.pdf'},
    {slug: '7wonders',         name: '7 Wonders',              subtitle: 'Base et extensions',
     rules: 'https://cdn.svc.asmodee.net/production-rprod/storage/downloads/games/7wonders/fr/sev-fr02-rules-1716387275nDwy0.pdf'},
    {slug: 'wonderfulworld',   name: "It's a Wonderful World", subtitle: 'Cartes et multiplicateurs',
     rules: 'https://www.laboitedejeu.fr/wp-content/uploads/2021/04/IWW-Rules-FR.pdf'},
    {slug: 'agricola',         name: 'Agricola',               subtitle: 'Barème par seuils calculé',
     rules: 'https://lookout-spiele.de/en/games/agricola.html'}, // pas de PDF FR officiel en ligne
    {slug: 'cascadia',         name: 'Cascadia',               subtitle: "Majorités d'habitats automatiques",
     rules: 'https://www.alderac.com/wp-content/uploads/2025/04/Cascadia_BaseGame_Rulebook_Optimized.pdf'}, // pas de PDF FR officiel en ligne
    {slug: 'terraformingmars', name: 'Terraforming Mars',      subtitle: 'NT, objectifs, récompenses, plateau',
     rules: 'https://fryxgames.se/wp-content/uploads/2023/04/TMRULESFINAL.pdf'}, // pas de PDF FR officiel en ligne
    {slug: 'seasaltpaper',     name: 'Sea Salt & Paper',       subtitle: 'Manches cumulées, paliers calculés',
     rules: 'https://studiobombyx.com/assets/SSAP_rulebook_FR-3.pdf'}
  ];

  const gameKey  = slug => slug + '-score-v1';
  const gamePage = slug => slug + '.html';
  const HISTORY_KEY = 'scores-history-v1';

  const api = {GAMES, gameKey, gamePage, HISTORY_KEY};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameRegistry = api;
})();
