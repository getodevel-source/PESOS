import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vitest 4 supports tsconfig paths natively via resolve.tsconfigPaths,
  // so the deprecated vite-tsconfig-paths plugin is no longer needed.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.next/**',
      '**/out/**',
    ],
    // Coverage: enable with `npm run test:coverage`. Excludes the pure
    // mock files (no real logic) and the test files themselves. No
    // thresholds yet — the project's coverage story is brand new and
    // most files (UI components) are untested. Thresholds will be
    // tightened incrementally as more tests are added.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/lib/supabase-client.ts',
        'src/lib/sqlite-db.ts',
      ],
    },
  },
})
