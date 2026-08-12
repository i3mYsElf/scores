# Scores

Feuilles de score de jeux de société. PWA statique : installable, fonctionne hors-ligne, aucun build.

## Structure

```
index.html      accueil — menu des jeux
harmonies.html  feuille de score Harmonies
common.css      styles partagés (onglets joueurs, cartes, steppers, classement…)
manifest.json   manifest PWA
sw.js           service worker (cache offline)
icons/          icônes de l'app (SVG sources + PNG générés)
```

Chaque jeu est une page autonome : le HTML/JS spécifique au barème du jeu vit dans sa page, le style vient de `common.css`, et les scores sont persistés en `localStorage` sous une clé propre au jeu (`<jeu>-score-v1`).

## Ajouter un jeu

1. Créer `<jeu>.html` en partant de `harmonies.html` comme modèle : garder le head (metas PWA + `common.css`), le lien retour `← Jeux`, la structure onglets/cartes/barre de total, et adapter le calcul du score ; utiliser la clé localStorage `<jeu>-score-v1`.
2. Ajouter la carte du jeu dans `index.html` (bloc `<a class="game" href="<jeu>.html">`).
3. Dans `sw.js` : ajouter `<jeu>.html` au `PRECACHE` **et incrémenter le nom de cache** (`scores-vN`) — obligatoire à chaque modification pour que les visiteurs reçoivent la mise à jour.

## Développement local

```
npx serve .
```

puis http://localhost:3000 — le service worker exige `localhost` ou HTTPS.
