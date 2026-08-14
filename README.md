# Scores

Feuilles de score de jeux de société. PWA statique : installable, fonctionne hors-ligne, aucun build.

## Structure

```
index.html      accueil — menu des jeux
harmonies.html  feuille de score Harmonies
7wonders.html   feuille de score 7 Wonders (base + extensions activables)
wonderfulworld.html  feuille de score It's a Wonderful World
agricola.html   feuille de score Agricola (barème par seuils calculé)
games/          logique de score pure par jeu (blank/score), sans DOM — testable en Node
common.js       moteur de feuille partagé : joueurs/onglets, persistance, classement, événements
common.css      styles partagés (onglets joueurs, cartes, steppers, classement…)
tests/          tests : calculs (scores), pages réelles dans jsdom (pages), cohérence de la structure (consistency)
manifest.json   manifest PWA
sw.js           service worker (offline ; navigations en network-first)
icons/          icônes de l'app (SVG sources + PNG générés)
```

Chaque page de jeu charge `games/<jeu>.js` (la logique), `common.js` (le moteur), puis un script de configuration qui appelle `initSheet({...})` avec le rendu spécifique au jeu. Les scores sont persistés en `localStorage` sous une clé propre au jeu (`<jeu>-score-v1`).

## Ajouter un jeu

1. Créer `games/<jeu>.js` : `blank()` (l'état vierge d'un joueur) et `score(d)` (pur, sans DOM), exportés via le pattern `module.exports` / `globalThis.GameLogic` (copier un jeu existant).
2. Ajouter ses cas de test dans `tests/scores.test.js` (lancer avec `node --test`).
3. Créer `<jeu>.html` en partant de `wonderfulworld.html` comme modèle : head + header + `#sheetBody` seulement (le reste du chrome est injecté par `common.js`), puis `initSheet({key: '<jeu>-score-v1', blank, score, drawSheet, sums, rankParts, ...})` — voir les hooks documentés dans `common.js`.
4. Ajouter la carte du jeu dans `index.html` (bloc `<a class="game">` + clé dans la boucle d'aperçu), et si désiré un raccourci dans `manifest.json`.
5. Dans `sw.js` : ajouter `<jeu>.html` et `games/<jeu>.js` au `PRECACHE`, et incrémenter le nom de cache (`scores-vN`) pour purger l'ancien.

`tests/consistency.test.js` vérifie automatiquement les étapes 3 à 5 — un oubli fait échouer la CI.

## Développement local

```
npm install   # une fois — jsdom, uniquement pour les tests (aucune dépendance au runtime)
node --test   # calculs + pages + cohérence
npx serve .   # puis http://localhost:3000 — le service worker exige localhost ou HTTPS
```
