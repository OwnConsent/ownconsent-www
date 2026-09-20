import { defineConfig } from '@playwright/test';

/**
 * Progetto di collaudo alla radice (ADR-0002 D8).
 *
 * `webServer` costruisce ed espone la build di produzione: L07 verifica la build
 * servita, non `astro dev` (ADR-0002 D9). I test di `e2e/**` girano contro questo
 * server; i test di `tests/perf/**` (misura di laboratorio di AC39) usano lo stesso
 * server ma gestiscono da soli isolamento delle esecuzioni e limitazione di rete/CPU
 * (contracts/perf-budgets.json, $metodo_laboratorio_pagine_pubbliche).
 *
 * I test di AC6 e N2 (e2e/fixtures/copia-temporanea.ts) NON usano questo server: per
 * loro serve una copia temporanea di site/ e contracts/ con una fixture sostituita,
 * costruita e servita su una porta diversa (ADR-0002 D4). Questo webServer resta
 * quello della build di produzione "normale", con la configurazione di listino.json
 * e contatto.json com'è nel repository.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/perf/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --dir site build && pnpm --dir site preview --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321/robots.txt',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
