import { defineConfig } from '@playwright/test';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/**
 * Radice del progetto di collaudo: la cartella di QUESTO file, non `process.cwd()`.
 * Serve ad ancorare `testIgnore` (vedi il commento sopra `testIgnore`).
 */
const RADICE = path.dirname(fileURLToPath(import.meta.url));

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
  /*
   * `testDir: '.'` fa della radice del repository la radice della raccolta, e `testMatch`
   * non li ancora all'inizio del percorso: `e2e/**` combacia anche con
   * `.claude/worktrees/<qualcosa>/e2e/`. Ogni worktree di un agente e' un checkout
   * completo con il proprio `node_modules`, quindi i suoi file di test risolvono una
   * *seconda copia* di `@playwright/test` e la raccolta muore prima di cominciare.
   *
   * Misurato in questa worktree, con una worktree annidata creata apposta:
   *
   *     $ pnpm exec playwright test --list          # nessuna worktree annidata
   *     Total: 252 tests in 24 files                # exit=0
   *
   *     $ git worktree add --detach .claude/worktrees/prova-riproduzione HEAD
   *     $ (cd .claude/worktrees/prova-riproduzione && pnpm install)
   *     $ pnpm exec playwright test --list
   *     Error: Requiring @playwright/test second time
   *     Total: 0 tests in 0 files                   # exit=1
   *
   * Una occorrenza per file raccolto due volte: 24 con una worktree annidata, 208 sulla
   * checkout principale con nove (misura di L08, ripresa nella #42). Finche' esiste una
   * worktree, in locale la suite non parte: non e' rumore, e' un exit 1 con zero test.
   *
   * `node_modules/**` e' una guardia, non una correzione: oggi non cambia nulla, ed e'
   * misurato. Sotto `node_modules/` e `site/node_modules/` ci sono 9 file `*.spec.ts`
   * (di `entities`, `css-what`), ma nessuno sta in una cartella `e2e/` o `tests/perf/`,
   * quindi `testMatch` non li prende gia' adesso. Il pattern serve al primo pacchetto
   * che portera' i propri test in una cartella con quel nome: un test di un pacchetto
   * non e' un test di questo repository.
   *
   * **Perche' il primo pattern e' ancorato a `RADICE` e il secondo no.** Playwright
   * confronta `testMatch` e `testIgnore` con il percorso ASSOLUTO del file, e a un
   * pattern relativo antepone `**\/`. Scritto `'**\/.claude/**'`, il pattern non esclude
   * «la cartella `.claude` del progetto»: esclude qualunque percorso che *contenga* un
   * segmento `.claude` — e la radice di ogni worktree di agente lo contiene, perche' le
   * worktree stanno in `.claude/worktrees/`. Misurato: eseguito da dentro una worktree,
   * `pnpm exec playwright test --list` rispondeva `No tests found`, `Total: 0 tests in 0
   * files`, exit=1. Sarebbe stato verde sulla checkout principale e avrebbe spento la
   * suite proprio dove lavorano gli agenti. `node_modules` invece resta non ancorato:
   * nessun segmento del percorso di questo progetto si chiama cosi', e il pattern deve
   * valere anche per `site/node_modules/`.
   */
  testIgnore: [path.join(RADICE, '.claude/**'), '**/node_modules/**'],
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
