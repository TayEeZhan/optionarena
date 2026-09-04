import { defineConfig } from 'vitest/config';

/**
 * Test configuration.
 *
 * The `react-server` condition is the important part. Every module under
 * `lib/` that can reach the signing key imports `server-only`, which resolves
 * to a module that throws unless the bundler asks for the `react-server`
 * export. Next.js and our scripts both ask for it; Vitest does not by default,
 * so without this nothing under `lib/thetanuts`, `lib/agent` or `lib/signals`
 * could be unit tested at all.
 */
export default defineConfig({
  resolve: {
    conditions: ['react-server', 'node', 'import', 'default'],
  },
  ssr: {
    resolve: {
      conditions: ['react-server', 'node', 'import', 'default'],
    },
  },
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
