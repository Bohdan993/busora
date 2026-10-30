// ESLint flat config (ESLint 9). The codebase is CommonJS Node (require /
// module.exports / module-alias). Formatting is owned by Prettier — this config
// only catches real code-quality problems (undefined vars, unreachable code,
// unused vars, …), so the two don't fight.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    // Not ours / generated / data — mirror .prettierignore.
    ignores: [
      'node_modules/**',
      'assets/**',
      'logs/**',
      'languages/**',
      'postman/**',
      'coverage/**',
      // Gitignored / not part of the repo — exclude so local lint matches CI
      // (which only checks out tracked files).
      'database/seeders/**'
    ]
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Server code logs to the console intentionally.
      'no-console': 'off',
      // Unused vars are a warning, not a hard error — don't block CI on a stray
      // import while it's being cleaned up. `_`-prefixed names are ignored
      // (common for unused middleware args like `next` / error `_req`).
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none'
        }
      ],
      // Empty catch blocks are sometimes deliberate (best-effort cleanup).
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // --- Pre-existing debt (ratchet) -------------------------------------
      // These fire across the legacy codebase. Downgraded to warnings so they
      // surface in every lint run without blocking CI, while genuinely new
      // breakage (no-undef, no-unreachable, syntax, no-dupe-keys,
      // no-unsafe-optional-chaining, …) still hard-fails. Burn these down,
      // then promote each back to 'error'.
      //
      // no-unsafe-optional-chaining: BURNED DOWN — all 38 sites fixed, so it
      // stays at the recommended 'error' (new violations fail CI).
      'no-useless-escape': 'warn', // 31 — cosmetic
      'no-prototype-builtins': 'warn' // 12 — prefer Object.hasOwn / .call
    }
  },

  {
    // Tests use the Node built-in test runner globals.
    files: ['**/*.test.js', '**/*.spec.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];
