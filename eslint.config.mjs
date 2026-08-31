import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

/**
 * Lint rules for OptionArena.
 *
 * The custom rules below are not style preferences. Each one blocks a mistake
 * that has already cost us something, so the linter catches it rather than a
 * reviewer or, worse, a transaction.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', '.data/**', 'drizzle/**', 'next-env.d.ts'] },

  ...coreWebVitals,
  ...nextTypescript,
  prettier,

  {
    rules: {
      // Unused variables are usually a half-finished refactor. Allow a leading
      // underscore for the ones that are deliberate.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` in code that moves money hides exactly the bugs we care about.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    // Token math belongs in lib/thetanuts/decimals.ts and nowhere else.
    // Scattered parseUnits calls are how a trade sends a million times too much.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['lib/thetanuts/decimals.ts', 'lib/thetanuts/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'ethers',
              importNames: ['parseUnits', 'formatUnits', 'parseEther', 'formatEther'],
              message:
                'Token math goes through lib/thetanuts/decimals.ts, which reads decimals from ' +
                'the order and asserts magnitude before signing. See tasks/lessons.md rule 1.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
