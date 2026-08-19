/* ESLint (flat config) — lint des .js seulement : sw.js, sw-client.js,
   common.js, games/, lib/, tests/ (les scripts inline des pages HTML ne sont
   pas couverts, ils sont exercés par tests/pages.test.js). */
import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores: ['node_modules/']},
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
        // globaux d'exécution du navigateur : posés par lib/* et games/* via globalThis
        GameLogic: 'readonly',
        GameRegistry: 'readonly',
        GameBackup: 'readonly',
        GameStats: 'readonly',
        GameDomino: 'readonly',
      },
    },
    rules: {
      // les catch volontairement silencieux du projet sont annotés ou signalent via bannière
      'no-empty': ['error', {allowEmptyCatch: true}],
      // helpers de common.js consommés par les pages, params d'API non utilisés
      'no-unused-vars': ['error', {args: 'none', caughtErrors: 'none', varsIgnorePattern: '^(esc|sq|rowStep|rowNum|get|set|initSheet)$'}],
    },
  },
];
