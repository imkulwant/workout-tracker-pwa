import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Layer boundaries from docs/PLAN.md (Repository structure and operating rules 9 and 10).
// features -> data -> domain, and domain depends on nothing.
const REACT_PACKAGES = [
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  'react-router',
  'react-router/*',
  'dexie-react-hooks',
]
const DEXIE_PACKAGES = ['dexie', 'dexie/*']
const UI_LAYERS = ['**/features/**', '**/app/**', '**/ui/**']

const restrict = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
})

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  // domain is pure: no React, Dexie, or any other layer (rule 10).
  restrict(
    ['src/domain/**/*.{ts,tsx}'],
    [
      {
        group: [...REACT_PACKAGES, ...DEXIE_PACKAGES],
        message: 'src/domain must stay pure: no React or Dexie imports.',
      },
      {
        group: [...UI_LAYERS, '**/data/**', '**/platform/**'],
        message:
          'src/domain depends on nothing: it cannot import other layers.',
      },
    ],
  ),
  // data may use domain, but never the UI (features call data, not the reverse).
  restrict(
    ['src/data/**/*.{ts,tsx}'],
    [
      {
        group: REACT_PACKAGES,
        message: 'src/data must not import React.',
      },
      {
        group: UI_LAYERS,
        message: 'src/data cannot import the UI layers.',
      },
    ],
  ),
  // UI code reaches data only through repositories, never Dexie directly (rule 9).
  restrict(
    ['src/{app,ui,features}/**/*.{ts,tsx}'],
    [
      {
        group: [...DEXIE_PACKAGES, '**/data/db', '**/data/db.*'],
        message:
          'UI code must access data through src/data/repositories, never Dexie or db directly.',
      },
    ],
  ),
  prettier,
)
