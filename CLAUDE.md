# Scores — feuilles de score de jeux de société

PWA statique multi-jeux, hébergée sur GitHub Pages (https://i3myself.github.io/scores/).

## Contraintes non négociables

- **Vanilla, zéro build, zéro dépendance runtime** : pas de framework, pas de bundler. Le `package.json` n'existe que pour jsdom (tests). C'est un choix délibéré ; une migration Expo (React Native) est envisagée à terme comme projet séparé, préparée par l'isolation de la logique dans `games/`.
- **Chemins relatifs partout** (pages, manifest, SW, icônes) : le site est servi sous `/scores/` sur GitHub Pages.
- **Ne jamais casser les données persistées** : clés localStorage `<jeu>-score-v1`, format `{players:[{nom,d,c?}], cur, started, totals, ts, exts?}` (`c` = couleur du joueur, index 0-7 ; absent dans les anciennes sauvegardes → attribué par position) (`ts` = dernière utilisation, ordonne le menu de l'accueil), et `scores-history-v1`, tableau d'entrées `{g, t, players:[{nom,total,pos?}], exts?}` (historique des parties, écrit par `common.js` au reset ; `pos` = position figée, présente seulement sur les ex æquo ; `exts` = libellés des extensions actives, absent sans extension). Des parties réelles sont en cours sur téléphone. Toute évolution du format doit relire l'ancien (voir `fixup`/`restoreExtra` dans `common.js`).
- **Versionning du cache automatique** : `sw.js` garde `const VERSION = 'dev'` (ne jamais committer autre chose — un test l'impose) ; la CI stampe le SHA du commit au déploiement, ce qui purge les vieux caches à chaque mise en production. Le déploiement Pages passe par GitHub Actions et **n'a lieu que si les tests passent**. La nouvelle version du SW ne s'active que sur action utilisateur (bannière « Recharger » gérée par `sw-client.js`, chargé par toutes les pages) — pas de `skipWaiting` automatique.

## Architecture

- `games/<jeu>.js` — logique pure (`blank()`, `score(d)`), sans DOM. Double export : `module.exports` (tests Node) / `globalThis.GameLogic` (navigateur). Toute règle de calcul vit ici, jamais dans la page.
- `common.js` — moteur partagé : joueurs/onglets, persistance, classement, dispatch click/input, helpers (`rowStep`, `rowNum`, `sq`, `esc`). Les hooks de config sont documentés en tête de `initSheet`.
- `<jeu>.html` — head + header + `#sheetBody` + `initSheet({...})` avec le rendu spécifique. Le chrome commun (nom du joueur, barre de total, classement) est injecté par `common.js`. Aucune logique de score dans les pages.
- `lib/` — modules partagés qui ne sont pas des jeux (logique pure, double export comme les jeux) : `registry.js` (registre central `{slug, name, subtitle}` + `gameKey`/`gamePage`/`HISTORY_KEY`, source de vérité de la liste, tout nouveau jeu doit y être déclaré), `backup.js` (aperçus + export/import atomique, storage en paramètre), `stats.js` (statistiques par joueur depuis l'historique), `domino.js` (partagé Kingdomino/Queendomino : départage pur + rendu/interactions de la liste des domaines) et `manches.js` (partagé Sea Salt & Paper/Skyjo : liste des manches validées, rankExtra, bandeau de fin de partie) — ces deux-là sont les seules exceptions au « sans DOM », partie pure en tête et branchements DOM en bas. `games/` ne contient que des jeux — les tests de cohérence l'imposent.
- `index.html` — accueil : uniquement le menu des jeux, généré depuis `lib/registry.js` (vignettes SVG dans des `<template data-thumb>`, tri par dernière utilisation) + bouton Historique en haut à droite du header (`.tool`). Aperçus branchés sur `lib/backup.js`, le DOM seul reste dans la page.
- `history.html` — historique des parties terminées (`scores-history-v1` + registre), statistiques par joueur (`lib/stats.js`) et export/import des sauvegardes.
- **Échappement** : tout texte saisi par l'utilisateur injecté en `innerHTML` passe par `esc()` (les noms de joueurs, notamment).

## Ajouter un jeu

Suivre la recette du README (games/*.js → tests → registre → page → carte accueil + shortcut → PRECACHE). Modèle le plus simple : `wonderfulworld.html`. Vérifier le barème officiel du jeu (web) avant d'implémenter, ne pas se fier à la mémoire.

## Vérification avant push

1. `npm install` (une fois), puis `node --test` — sept familles de tests :
   - `tests/scores.test.js` : les barèmes (à compléter pour tout nouveau jeu)
   - `tests/backup.test.js` : la logique pure aperçus/export/import/CSV de `lib/backup.js`
   - `tests/stats.test.js` : les statistiques par joueur de `lib/stats.js`
   - `tests/pages.test.js` : les pages réelles dans jsdom (moteur, interactions, échappement, anciens formats de sauvegarde) — le chargeur `loadPage` et les helpers d'interaction vivent dans `tests/helpers.js` (partagés, pas un fichier de tests)
   - `tests/consistency.test.js` : la structure (PRECACHE, menu, clés, shortcuts, head commun identique sur toutes les pages) — attrape les oublis de la recette
   - `tests/sw.test.js` : les stratégies de cache de `sw.js` rejouées dans un bac à sable Node
   - `tests/sw-client.test.js` : la moitié client de la mise à jour (`sw-client.js` : bannière, SKIP_WAITING, anti-boucle de rechargement) rejouée en jsdom avec un faux `navigator.serviceWorker`
2. `node --check sw.js sw-client.js theme.js common.js games/*.js lib/*.js` et `npx eslint .` (la CI lance les deux)
3. Servir en local : `npx serve .` (le SW exige localhost ou HTTPS)

## Déploiement

Push sur `main` → workflow GitHub Actions : tests, puis (si verts) déploiement Pages avec la version de cache stampée au SHA du commit (~1-2 min). Vérifier ensuite que `https://i3myself.github.io/scores/sw.js` sert `const VERSION = '<sha>'` du commit poussé. Le réglage Pages du repo doit être sur « Source : GitHub Actions ».

## Design

Identité « Le Tableau » : noir/blanc + orange (`--accent`), double thème clair/sombre via `prefers-color-scheme` + bascule manuelle persistée (`theme.js` chargé bloquant dans le head de chaque page, `data-theme` sur `<html>`, clé `scores-theme-v1`, bouton sur l'accueil ; les deux blocs de tokens sombres de `common.css` doivent rester identiques — un test l'impose). Theme-color double dans les pages, aligné par `theme.js` quand un thème est forcé. Fonts : Anton (titres, uppercase) + Barlow (texte) via Google Fonts. Couleurs joueurs `--p1`…`--p8` lisibles sur les deux fonds ; couleurs « matière » des jeux (`--marron`, `--vert`…) conservées pour les jetons/vignettes. Icônes : sources SVG dans `icons/`, PNG régénérés via sharp (script `make-icons.js` en scratchpad). Vignettes de jeux : petits SVG inline dans `index.html`, jamais de visuel sous licence.
