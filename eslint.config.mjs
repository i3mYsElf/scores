/* ESLint (flat config) — lint des .js ET des scripts inline des pages HTML
   (eslint-plugin-html, dev uniquement) : la config initSheet et le rendu des
   pages représentent une part majeure du code applicatif. */
import js from '@eslint/js';
import globals from 'globals';
import html from 'eslint-plugin-html';

/* globaux d'exécution posés par lib/*, games/* (globalThis) et common.js
   (fonctions globales consommées par les scripts inline des pages) */
const appGlobals = {
  GameLogic: 'readonly',
  GameRegistry: 'readonly',
  GameHtml: 'readonly',
  GameSheet: 'readonly',
  GameHistory: 'readonly',
  GameBackup: 'readonly',
  GameStats: 'readonly',
  GameDomino: 'readonly',
  GameManches: 'readonly',
  Theme: 'readonly',
};

const rules = {
  // les catch volontairement silencieux du projet sont annotés ou signalent via bannière
  'no-empty': ['error', {allowEmptyCatch: true}],
  'no-unused-vars': ['error', {args: 'none', caughtErrors: 'none'}],
  eqeqeq: ['error', 'always', {null: 'ignore'}], // v == null teste null ET undefined, idiome assumé
  'no-var': 'error',
  'prefer-const': 'error',
  'no-shadow': 'error',
};

export default [
  {ignores: ['node_modules/']},
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {...globals.browser, ...globals.node, ...globals.serviceworker, ...appGlobals},
    },
    rules,
  },
  {
    // l'API que common.js expose aux pages (fonctions globales « non utilisées » ici)
    files: ['common.js'],
    rules: {
      'no-unused-vars': ['error', {args: 'none', caughtErrors: 'none',
        varsIgnorePattern: '^(esc|sq|rowStep|rowNum|get|set|initSheet)$'}],
    },
  },
  {
    // scripts inline des pages : mêmes règles, plus l'API de common.js en lecture
    files: ['**/*.html'],
    plugins: {html},
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser, ...appGlobals,
        sq: 'readonly', rowStep: 'readonly', rowNum: 'readonly', initSheet: 'readonly',
      },
    },
    rules,
  },
];
