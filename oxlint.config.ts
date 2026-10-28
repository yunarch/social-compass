import { defineConfig } from 'oxlint';

export default defineConfig({
  ignorePatterns: ['src/module_bindings'],
  categories: {
    correctness: 'error',
    perf: 'error',
  },
  options: {
    reportUnusedDisableDirectives: 'warn',
  },
});
