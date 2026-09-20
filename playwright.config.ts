import { defineConfig } from '@playwright/test';
import net from 'node:net';

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
 *
 * Correzione dei due difetti di infrastruttura (issue #8, lotto L07, misurati nel
 * journal di questo giro):
 *
 * - Astro 7 `astro preview` si sgancia in un processo in background (daemon con le
 *   proprie `stop`/`status`/`logs`); il comando in primo piano esce con 0 subito dopo
 *   averlo avviato, e Playwright dichiara il webServer morto in anticipo
 *   ("Process from config.webServer exited early"). `--ignore-lock` cambia questo
 *   comportamento: misurato che con quel flag il processo resta in primo piano per
 *   tutta la vita del server (verificato bloccando il comando oltre il timeout di
 *   prova), quindi Playwright lo traccia e lo termina correttamente a fine suite.
 *   Lo stesso flag evita anche di arrendersi al lock file di un preview altrui.
 * - Porta non più fissa (4321 scritto a mano): un'esecuzione non deve poter riusare,
 *   né per coincidenza né per un lock file, il server di un'altra worktree. La porta
 *   si ottiene dal sistema operativo (bind su 0, poi si legge quella assegnata) e si
 *   passa sia al comando (`--port`) sia all'URL di lettura (`url`/`baseURL`): letta,
 *   non presunta.
 * - Nessun `reuseExistingServer`: con una porta diversa a ogni esecuzione non c'è
 *   nulla di significativo da riusare, e riusare per coincidenza un server orfano di
 *   un'altra worktree è esattamente il difetto misurato in questo giro.
 */

/** Chiede al sistema operativo una porta libera su 127.0.0.1 e la restituisce. */
async function portaLibera(): Promise<number> {
  return await new Promise((risolvi, rifiuta) => {
    const server = net.createServer();
    server.on('error', rifiuta);
    server.listen(0, '127.0.0.1', () => {
      const indirizzo = server.address();
      if (indirizzo === null || typeof indirizzo === 'string') {
        server.close();
        rifiuta(new Error('impossibile leggere la porta assegnata dal sistema operativo'));
        return;
      }
      const { port } = indirizzo;
      server.close(() => risolvi(port));
    });
  });
}

/*
 * Playwright ricarica questo file di configurazione una volta per processo worker,
 * non una volta sola: misurato che, senza questa cautela, ogni ricarica chiamava di
 * nuovo `portaLibera()` e otteneva una porta diversa da quella su cui il webServer
 * era davvero in ascolto (i worker si connettevano a una porta libera ma vuota, non
 * al server). La variabile d'ambiente è il modo per far concordare tutte le ricariche
 * sulla stessa porta ottenuta una sola volta dal processo che carica per primo: i
 * processi figli (worker e webServer stesso) ereditano l'ambiente di chi li avvia.
 */
const PORTA = process.env.OWNCONSENT_E2E_PORT
  ? Number(process.env.OWNCONSENT_E2E_PORT)
  : await (async () => {
      const assegnata = await portaLibera();
      process.env.OWNCONSENT_E2E_PORT = String(assegnata);
      return assegnata;
    })();

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/perf/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm --dir site build && pnpm --dir site preview --port ${PORTA} --host 127.0.0.1 --ignore-lock`,
    url: `http://127.0.0.1:${PORTA}/robots.txt`,
    timeout: 180_000,
  },
});
