# Scores — feuilles de score de jeux de société

PWA statique multi-jeux, hébergée sur GitHub Pages (https://i3myself.github.io/scores/).

## Contraintes non négociables

- **Vanilla, zéro build, zéro dépendance runtime** : pas de framework, pas de bundler, pas de package.json. C'est un choix délibéré ; une migration Expo (React Native) est envisagée à terme comme projet séparé, préparée par l'isolation de la logique dans `games/`.
- **Chemins relatifs partout** (pages, manifest, SW, icônes) : le site est servi sous `/scores/` sur GitHub Pages.
- **Ne jamais casser les données persistées** : clés localStorage `<jeu>-score-v1`, format `{players:[{nom,d}], cur, totals, exts?}`. Des parties réelles sont en cours sur téléphone. Toute évolution du format doit relire l'ancien (voir `fixup`/`restoreExtra` dans `common.js`).
- **Incrémenter `scores-vN` dans `sw.js` à chaque modification de fichiers précachés** (les navigations sont en network-first, mais le bump purge les vieux caches et rafraîchit les assets).

## Architecture

- `games/<jeu>.js` — logique pure (`blank()`, `score(d)`), sans DOM. Double export : `module.exports` (tests Node) / `globalThis.GameLogic` (navigateur). Toute règle de calcul vit ici, jamais dans la page.
- `common.js` — moteur partagé : joueurs/onglets, persistance, classement, dispatch click/input, helpers (`rowStep`, `rowNum`, `sq`, `esc`). Les hooks de config sont documentés en tête de `initSheet`.
- `<jeu>.html` — squelette HTML + `initSheet({...})` avec le rendu spécifique. Aucune logique de score.
- `index.html` — accueil/menu ; lit les clés localStorage pour l'aperçu « Partie en cours ».
- **Échappement** : tout texte saisi par l'utilisateur injecté en `innerHTML` passe par `esc()` (les noms de joueurs, notamment).

## Ajouter un jeu

Suivre la recette du README (games/*.js → tests → page → carte accueil → PRECACHE + bump). Modèle le plus simple : `wonderfulworld.html`. Vérifier le barème officiel du jeu (web) avant d'implémenter, ne pas se fier à la mémoire.

## Vérification avant push

1. `node --test` (tests des calculs, à compléter pour tout nouveau jeu/barème)
2. `node --check sw.js common.js games/*.js`
3. Smoke test navigateur si le moteur ou une page a changé : jsdom en scratchpad (charger la page, cliquer un stepper, vérifier le total et l'échappement des noms)
4. Servir en local : `npx serve .` (le SW exige localhost ou HTTPS)

## Déploiement

Push sur `main` = déploiement GitHub Pages automatique (~30-60 s) + CI GitHub Actions (`node --test`). Vérifier ensuite que `https://i3myself.github.io/scores/sw.js` sert bien la nouvelle version de cache.

## Design

Palette et composants dans `common.css` (fond `#131E1C`, or `#DFB149`, couleurs joueurs `--p1`…`--p8`). Fonts : Fraunces (titres) + Karla (texte) via Google Fonts. Icônes : sources SVG dans `icons/`, PNG régénérés via sharp (script `make-icons.js` en scratchpad). Vignettes de jeux : petits SVG inline dans `index.html`, jamais de visuel sous licence.
