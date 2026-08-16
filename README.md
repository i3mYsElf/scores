# Scores

Feuilles de score de jeux de société. PWA statique : installable, fonctionne hors-ligne, aucun build.

## Structure

```
index.html      accueil — menu des jeux, aperçus « Partie en cours », export/import des sauvegardes
history.html    historique des parties terminées (clé scores-history-v1, alimentée au reset)
harmonies.html  feuille de score Harmonies
7wonders.html   feuille de score 7 Wonders (base + extensions activables)
wonderfulworld.html  feuille de score It's a Wonderful World
agricola.html   feuille de score Agricola (barème par seuils calculé)
cascadia.html   feuille de score Cascadia (bonus de majorité inter-joueurs automatiques)
terraformingmars.html  feuille de score Terraforming Mars
games/          logique de score pure par jeu (blank/score), sans DOM — testable en Node
games/registry.js  registre central des jeux (slug, nom, sous-titre) — source de vérité de la liste
games/backup.js    aperçus « Partie en cours » + export/import — logique pure, storage en paramètre
games/stats.js     statistiques par joueur depuis l'historique — logique pure
common.js       moteur de feuille partagé : joueurs/onglets, persistance, classement, événements
common.css      styles partagés (onglets joueurs, cartes, steppers, classement…)
tests/          tests : calculs (scores), aperçus/backup (backup), statistiques (stats), pages réelles dans jsdom (pages), cohérence de la structure (consistency)
manifest.json   manifest PWA
sw.js           service worker (offline ; navigations en network-first)
icons/          icônes de l'app (SVG sources + PNG générés)
```

Chaque page de jeu charge `games/<jeu>.js` (la logique), `common.js` (le moteur), puis un script de configuration qui appelle `initSheet({...})` avec le rendu spécifique au jeu. Les scores sont persistés en `localStorage` sous une clé propre au jeu (`<jeu>-score-v1`).

## Ajouter un jeu

1. Créer `games/<jeu>.js` : `blank()` (l'état vierge d'un joueur) et `score(d)` (pur, sans DOM), exportés via le pattern `module.exports` / `globalThis.GameLogic` (copier un jeu existant).
2. Ajouter ses cas de test dans `tests/scores.test.js` (lancer avec `node --test`).
3. Déclarer le jeu dans `games/registry.js` (`slug`, `name`, `subtitle`) — l'accueil, l'historique, l'export et les tests s'en servent.
4. Créer `<jeu>.html` en partant de `wonderfulworld.html` comme modèle : head + header + `#sheetBody` seulement (le reste du chrome est injecté par `common.js`), puis `initSheet({key: '<jeu>-score-v1', blank, score, drawSheet, sums, rankParts, ...})` — voir les hooks documentés dans `common.js`.
5. Ajouter la carte du jeu dans `index.html` (bloc `<a class="game">` avec `<small data-sub="<jeu>">` — le sous-titre et l'aperçu viennent du registre) et son raccourci dans `manifest.json`.
6. Dans `sw.js` : ajouter `<jeu>.html` et `games/<jeu>.js` au `PRECACHE` (la version du cache est stampée automatiquement au déploiement, rien à incrémenter).

`tests/consistency.test.js` vérifie automatiquement les étapes 3 à 6 — un oubli fait échouer la CI.

## Déploiement

Push sur `main` → GitHub Actions lance les tests puis, s'ils passent, déploie sur GitHub Pages en stampant la version du cache avec le SHA du commit (`sw.js` reste en `VERSION = 'dev'` dans le repo). Un push avec des tests rouges ne se déploie pas.

## Développement local

```
npm install   # une fois — jsdom, uniquement pour les tests (aucune dépendance au runtime)
node --test   # calculs + pages + cohérence
npx serve .   # puis http://localhost:3000 — le service worker exige localhost ou HTTPS
```
