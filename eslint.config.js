// Configurazione minima per il progetto di collaudo alla radice (ADR-0002 D8).
// Copre e2e/**, tests/perf/** e i file di configurazione TypeScript alla radice.
// Non tocca site/: quel progetto ha la propria configurazione (L05).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**', 'site/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
