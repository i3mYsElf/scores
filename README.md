# Scores

Feuilles de score de jeux de société. PWA statique : installable, fonctionne hors-ligne, aucun build.

## Structure

```
index.html      accueil — menu des jeux généré depuis le registre (trié par usage), aperçus « Partie en cours », bouton Historique
history.html    parties terminées (détail, édition, suppression) + statistiques par joueur + export/import JSON + export CSV (clé scores-history-v1)
harmonies.html  feuille de score Harmonies
7wonders.html   feuille de score 7 Wonders (base + extensions activables)
wonderfulworld.html  feuille de score It's a Wonderful World
agricola.html   feuille de score Agricola (barème par seuils calculé)
cascadia.html   feuille de score Cascadia (bonus de majorité inter-joueurs automatiques)
terraformingmars.html  feuille de score Terraforming Mars
seasaltpaper.html  feuille de score Sea Salt & Paper (manches cumulées, paliers calculés)
kingdomino.html    feuille de score Kingdomino (domaines cases × couronnes)
queendomino.html   feuille de score Queendomino (domaines + bâtiments + pièces)
7wondersduel.html  feuille de score 7 Wonders Duel (base + Panthéon + Agora activables)
games/          logique de score pure par jeu (blank/score), sans DOM — testable en Node (rien d'autre que des jeux)
lib/registry.js registre central des jeux (slug, nom, sous-titre) — source de vérité de la liste
lib/backup.js   aperçus « Partie en cours » + export/import — logique pure, storage en paramètre
lib/stats.js    statistiques par joueur depuis l'historique — logique pure
lib/domino.js   partagé Kingdomino/Queendomino : domaines cases × couronnes (départage, rendu de liste, interactions)
common.js       moteur de feuille partagé : joueurs/onglets, persistance, classement, événements
common.css      styles partagés (onglets joueurs, cartes, steppers, classement…)
tests/          tests : calculs (scores), aperçus/backup (backup), statistiques (stats), pages réelles dans jsdom (pages), cohérence de la structure (consistency), stratégies du service worker (sw)
manifest.json   manifest PWA
sw.js           service worker (offline ; navigations en network-first ; nouvelle version activée sur demande)
sw-client.js    enregistrement du SW + bannière « Nouvelle version disponible » + storage.persist (chargé par toutes les pages)
404.html        page introuvable servie par GitHub Pages (autonome, liens absolus)
icons/          icônes de l'app (SVG sources + PNG générés)
```

Chaque page de jeu charge `games/<jeu>.js` (la logique), `common.js` (le moteur), puis un script de configuration qui appelle `initSheet({...})` avec le rendu spécifique au jeu. Les scores sont persistés en `localStorage` sous une clé propre au jeu (`<jeu>-score-v1`).

## Ajouter un jeu

1. Créer `games/<jeu>.js` : `blank()` (l'état vierge d'un joueur) et `score(d)` (pur, sans DOM), exportés via le pattern `module.exports` / `globalThis.GameLogic` (copier un jeu existant).
2. Ajouter ses cas de test dans `tests/scores.test.js` (lancer avec `node --test`).
3. Déclarer le jeu dans `lib/registry.js` (`slug`, `name`, `subtitle`) — l'accueil, l'historique, l'export et les tests s'en servent.
4. Créer `<jeu>.html` en partant de `wonderfulworld.html` comme modèle : head + header + `#sheetBody` seulement (le reste du chrome est injecté par `common.js`), puis `initSheet({key: '<jeu>-score-v1', blank, score, drawSheet, sums, rankParts, ...})` — voir les hooks documentés dans `common.js`.
5. Ajouter la vignette du jeu dans `index.html` : une `<template data-thumb="<jeu>">` contenant son petit SVG — la carte du menu (nom, sous-titre, aperçu) est générée depuis le registre. Ajouter aussi son raccourci dans `manifest.json`.
6. Dans `sw.js` : ajouter `<jeu>.html` et `games/<jeu>.js` au `PRECACHE` (la version du cache est stampée automatiquement au déploiement, rien à incrémenter).

`tests/consistency.test.js` vérifie automatiquement les étapes 3 à 6 — un oubli fait échouer la CI.

## Déploiement

Push sur `main` → GitHub Actions lance les tests puis, s'ils passent, déploie sur GitHub Pages en stampant la version du cache avec le SHA du commit (`sw.js` reste en `VERSION = 'dev'` dans le repo). Un push avec des tests rouges ne se déploie pas.

## Développement local

```
npm install   # une fois — jsdom + eslint, uniquement pour les tests et le lint (aucune dépendance au runtime)
node --test   # calculs + pages + cohérence + service worker
npx eslint .  # lint (aussi en CI)
npx serve .   # puis http://localhost:3000 — le service worker exige localhost ou HTTPS
```
