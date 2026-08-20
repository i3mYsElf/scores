# Scores — feuilles de score de jeux de société

PWA statique multi-jeux, hébergée sur GitHub Pages (https://i3myself.github.io/scores/).

## Contraintes non négociables

- **Vanilla, zéro build, zéro dépendance runtime** : pas de framework, pas de bundler. Le `package.json` n'existe que pour jsdom (tests). C'est un choix délibéré ; une migration Expo (React Native) est envisagée à terme comme projet séparé, préparée par l'isolation de la logique dans `games/`.
- **Chemins relatifs partout** (pages, manifest, SW, icônes) : le site est servi sous `/scores/` sur GitHub Pages.
- **Ne jamais casser les données persistées** : clés localStorage `<jeu>-score-v1`, format `{players:[{nom,d,c?}], cur, started, totals, ts, exts?}` (`c` = couleur du joueur, index 0-7 ; absent dans les anciennes sauvegardes → attribué par position) (`ts` = dernière utilisation, ordonne le menu de l'accueil), et `scores-history-v1`, tableau d'entrées `{g, t, players:[{nom,total,pos?}], exts?}` (historique des parties, écrit par `common.js` au reset ; `pos` = position figée, présente seulement sur les ex æquo ; `exts` = libellés des extensions actives, absent sans extension). Des parties réelles sont en cours sur téléphone. Toute évolution du format doit relire l'ancien (voir `fixup`/`restoreExtra` dans `common.js`).
- **Versionning du cache automatique** : `sw.js` garde `const VERSION = 'dev'` (ne jamais committer autre chose — un test l'impose) ; la CI stampe le SHA du commit au déploiement, ce qui purge les vieux caches à chaque mise en production. Le déploiement Pages passe par GitHub Actions et **n'a lieu que si les tests passent**. La nouvelle version du SW ne s'active que sur action utilisateur (bannière « Recharger » gérée par `sw-client.js`, chargé par toutes les pages) — pas de `skipWaiting` automatique.

## Architecture

- `games/<jeu>.js` — logique pure (`blank()`, `score(d, opts)` avec `opts = {players, exts}` ignorable, `maxPlayers(exts)`), sans DOM. Double export : `module.exports` (tests Node) / `globalThis.GameLogic` (navigateur). Toute règle de calcul vit ici, jamais dans la page (validation de manche, plafonds, barèmes compris).
- `common.js` — moteur partagé : joueurs/onglets, persistance, extensions (hook `exts: {defauts, labels, migrate?}` — état, persistance, libellés d'archive et clic `[data-ext]` gérés par le moteur, la page rend `ctx.extSeg()`), dispatch click/input, helpers (`rowStep`, `rowNum`, `sq`, `esc`). Les hooks de config sont documentés en tête de `initSheet`. Les boutons de configuration portent `data-config` : ils ne marquent pas la partie « commencée ».
- `<jeu>.html` — head + header + `#sheetBody` + `initSheet({...})` avec le rendu spécifique. Le chrome commun (nom du joueur, barre de total, classement) est injecté par `common.js`. Aucune logique de score dans les pages.
- `lib/` — modules partagés qui ne sont pas des jeux (logique pure, double export comme les jeux) : `registry.js` (registre central `{slug, name, subtitle, rules, lowWins?}` + `gameKey`/`gamePage`/`HISTORY_KEY`, source de vérité de la liste, tout nouveau jeu doit y être déclaré), `html.js` (`esc`/`sq`, chargé par toutes les pages avant `common.js`), `sheet.js` (partie pure du moteur : classement `ranked` avec ex æquo, `archiveEntry`, `shareText`, `normalizeD` — prépare aussi Expo), `history.js` (lecture/écriture de l'historique + re-tri d'une entrée éditée, storage en paramètre), `backup.js` (aperçus + export/import atomique, storage en paramètre), `stats.js` (statistiques par joueur depuis l'historique), `domino.js` (partagé Kingdomino/Queendomino : départage pur + rendu/interactions de la liste des domaines) et `manches.js` (partagé Sea Salt & Paper/Skyjo : liste des manches, `manchesFor(signed)` renvoie les hooks préconfigurés) — `domino.js`/`manches.js` sont les seules exceptions au « sans DOM », partie pure en tête et branchements DOM en bas. `games/` ne contient que des jeux — les tests de cohérence l'imposent.
- `index.html` — accueil : uniquement le menu des jeux, généré depuis `lib/registry.js` (vignettes SVG dans des `<template data-thumb>`, tri par dernière utilisation) + bouton Historique en haut à droite du header (`.tool`). Aperçus branchés sur `lib/backup.js`, le DOM seul reste dans la page.
- `history.html` — historique des parties terminées (`scores-history-v1` + registre), statistiques par joueur (`lib/stats.js`) et export/import des sauvegardes.
- **Échappement** : tout texte saisi par l'utilisateur injecté en `innerHTML` passe par `esc()` (les noms de joueurs, notamment).

## Ajouter un jeu

Suivre la recette du README (games/*.js → tests → registre → page → carte accueil + shortcut → PRECACHE). Modèle le plus simple : `wonderfulworld.html`. Vérifier le barème officiel du jeu (web) avant d'implémenter, ne pas se fier à la mémoire.

## Vérification avant push

1. `npm install` (une fois), puis `npm test` — les familles de tests :
   - `tests/scores.test.js` : les barèmes de `games/*` (à compléter pour tout nouveau jeu)
   - `tests/sheet.test.js`, `tests/history.test.js` (moitié pure), `tests/backup.test.js`, `tests/stats.test.js`, `tests/manches.test.js`, `tests/domino.test.js` : les modules de `lib/` en Node
   - `tests/engine.test.js` : le moteur `common.js` dans jsdom (harmonies.html en fixture) — annulation, persistance et vieux formats, échappement, partage, accessibilité, multi-onglets
   - `tests/games.test.js` : le câblage propre à chaque page de jeu + un test de fumée générique sur tout le registre
   - `tests/home.test.js` et la moitié jsdom de `tests/history.test.js` : accueil (menu, thème) et page historique
   - `tests/consistency.test.js` : la structure (PRECACHE dérivé des src réels des pages, menu, clés, shortcuts, head commun identique, README à jour) — attrape les oublis de la recette
   - `tests/sw.test.js` / `tests/sw-client.test.js` : les deux moitiés de la mise à jour du SW
   - le chargeur `loadPage` et les helpers d'interaction vivent dans `tests/helpers.js` (partagé, pas un fichier de tests) ; chaque fichier jsdom déclare `test.afterEach(closeAll)`
2. `npm run lint` — ESLint, scripts inline des pages HTML compris (eslint-plugin-html) ; `npm run check` enchaîne lint + tests comme la CI
3. Servir en local : `npm run serve` (le SW exige localhost ou HTTPS)

## Déploiement

Push sur `main` → workflow GitHub Actions : tests, puis (si verts) déploiement Pages avec la version de cache stampée au SHA du commit (~1-2 min). La dernière étape du workflow vérifie elle-même que `https://i3myself.github.io/scores/sw.js` sert `const VERSION = '<sha court>'` du commit poussé. `workflow_dispatch` permet de redéployer sans commit. Le réglage Pages du repo doit être sur « Source : GitHub Actions ».

## Design

Identité « Le Tableau » : noir/blanc + orange (`--accent`), double thème clair/sombre via `prefers-color-scheme` + bascule manuelle persistée (`theme.js` chargé bloquant dans le head de chaque page, `data-theme` sur `<html>`, clé `scores-theme-v1`, bouton sur l'accueil ; les deux blocs de tokens sombres de `common.css` doivent rester identiques — un test l'impose). Theme-color double dans les pages, aligné par `theme.js` quand un thème est forcé. Fonts : Anton (titres, uppercase) + Barlow (texte) via Google Fonts. Couleurs joueurs `--p1`…`--p8` lisibles sur les deux fonds ; couleurs « matière » des jeux (`--marron`, `--vert`…) conservées pour les jetons/vignettes. Icônes : sources SVG dans `icons/`, PNG régénérés via sharp (script `make-icons.js` en scratchpad). Vignettes de jeux : petits SVG inline dans `index.html`, jamais de visuel sous licence.
