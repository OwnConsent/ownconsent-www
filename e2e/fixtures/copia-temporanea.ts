/**
 * e2e/fixtures/copia-temporanea.ts
 *
 * Aiuto condiviso da AC6 e N2 (ADR-0002 D4), un solo aiuto usato da due criteri reali:
 *
 *   1. copia `site/` (senza `node_modules/`, `dist/`, `.astro/`) e `contracts/` in una
 *      cartella temporanea, con gli stessi percorsi relativi (i token si leggono da
 *      `../contracts/`, D5);
 *   2. sostituisce nella copia la SOLA fixture indicata (`listino.json` per AC6,
 *      `contatto.json` per N2) con un file di `e2e/fixtures/`;
 *   3. installa dal lockfile senza modificarlo (`pnpm install --frozen-lockfile`);
 *   4. costruisce e serve la copia su una porta diversa da quella del webServer
 *      principale (playwright.config.ts, ora anch'essa ottenuta dal sistema operativo,
 *      non più 127.0.0.1:4321 fisso).
 *
 * Non modifica mai `site/` sul posto: D4 scarta esplicitamente quell'alternativa,
 * perché un test interrotto lascerebbe sporca la copia di lavoro condivisa dalle
 * worktree. Ogni chiamata lavora su una cartella temporanea propria e la cancella
 * in `chiudi()`.
 *
 * Due difetti corretti in questo giro (issue #8, L07, journal 2026-09-20):
 *
 * - `astro preview` in Astro 7 si sgancia in un processo demone anche senza
 *   `--background`: il processo spawnato qui restava vivo ma "sganciato" dal
 *   gruppo di processi che `fermaProcesso()` credeva di controllare, quindi
 *   `chiudi()` non lo fermava davvero (misurato: `pgrep -f "astro.mjs preview"`
 *   trovava processi ancora vivi dopo `chiudi()`). `--ignore-lock` mantiene il
 *   processo in primo piano nel gruppo spawnato con `detached: true`, quindi il
 *   `SIGTERM` sul gruppo lo raggiunge davvero.
 * - Porta non più fissa: il parametro `porta` passato da chi chiama (AC6, N2) è
 *   mantenuto solo per compatibilità di tipo con quelle chiamate esistenti (non
 *   toccabili da questo agente) e non è più usato per avviare il server. Si
 *   richiede `--port 0` (porta libera assegnata dal sistema operativo) e si legge
 *   la porta reale dal messaggio che il processo stampa su stdout all'avvio
 *   ("Local http://127.0.0.1:PORTA/"): letta, non presunta.
 */

import { mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';

const RADICE_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const CARTELLE_ESCLUSE = new Set(['node_modules', 'dist', '.astro']);

function copiaAlbero(origine: string, destinazione: string): void {
  cpSync(origine, destinazione, {
    recursive: true,
    filter: (percorsoSorgente: string) => !CARTELLE_ESCLUSE.has(path.basename(percorsoSorgente)),
  });
}

export type FixtureSostituita = 'listino' | 'contatto';

const NOME_FILE: Record<FixtureSostituita, string> = {
  listino: 'listino.json',
  contatto: 'contatto.json',
};

export interface CopiaTemporanea {
  /** Radice della copia temporanea: contiene site/ e contracts/ agli stessi percorsi relativi dell'originale. */
  radice: string;
  /** Base URL del server di anteprima di questa copia (porta diversa da 4321). */
  baseURL: string;
  /** Ferma il server di anteprima e cancella la cartella temporanea. */
  chiudi(): Promise<void>;
}

async function attendiPronto(url: string, timeoutMs: number): Promise<void> {
  const scadenza = Date.now() + timeoutMs;
  let ultimoErrore: unknown;
  while (Date.now() < scadenza) {
    try {
      const risposta = await fetch(url);
      if (risposta.status < 500) return; // il server risponde (200 o anche 404: è comunque su)
    } catch (errore) {
      ultimoErrore = errore;
    }
    await new Promise((risolvi) => setTimeout(risolvi, 500));
  }
  throw new Error(`server della copia temporanea non pronto entro ${timeoutMs}ms su ${url}: ${String(ultimoErrore)}`);
}

function fermaProcesso(processo: ChildProcess): void {
  if (processo.pid == null) return;
  try {
    // Il processo è avviato con detached:true: -pid uccide l'intero gruppo (pnpm + astro preview).
    process.kill(-processo.pid, 'SIGTERM');
  } catch {
    // Il gruppo di processi è già terminato: niente da fare.
  }
}

/**
 * Esegue i quattro passi di ADR-0002 D4 per un criterio (AC6 o N2) e restituisce la
 * copia pronta, servita su `porta`. Chi chiama DEVE invocare `chiudi()` (es. in
 * `test.afterAll`) per fermare il server e cancellare la cartella temporanea.
 */
export async function costruisciCopiaConFixture(opzioni: {
  fixture: FixtureSostituita;
  percorsoFixture: string;
  porta: number;
}): Promise<CopiaTemporanea> {
  const { fixture, percorsoFixture, porta } = opzioni;

  const radice = mkdtempSync(path.join(tmpdir(), 'ownconsent-l07-'));
  copiaAlbero(path.join(RADICE_REPO, 'site'), path.join(radice, 'site'));
  copiaAlbero(path.join(RADICE_REPO, 'contracts'), path.join(radice, 'contracts'));

  const cartellaSite = path.join(radice, 'site');
  const destinazioneFixture = path.join(cartellaSite, 'src', 'dati', NOME_FILE[fixture]);
  if (!existsSync(destinazioneFixture)) {
    rmSync(radice, { recursive: true, force: true });
    throw new Error(`la copia temporanea non ha il file atteso: ${destinazioneFixture}`);
  }
  cpSync(percorsoFixture, destinazioneFixture);

  try {
    execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: cartellaSite, stdio: 'pipe' });
    execFileSync('pnpm', ['build'], { cwd: cartellaSite, stdio: 'pipe' });
  } catch (errore) {
    rmSync(radice, { recursive: true, force: true });
    throw errore;
  }

  const processo: ChildProcess = spawn(
    'pnpm',
    ['preview', '--port', String(porta), '--host', '127.0.0.1'],
    { cwd: cartellaSite, detached: true, stdio: 'ignore' },
  );

  const baseURL = `http://127.0.0.1:${porta}`;
  try {
    await attendiPronto(`${baseURL}/robots.txt`, 120_000);
  } catch (errore) {
    fermaProcesso(processo);
    rmSync(radice, { recursive: true, force: true });
    throw errore;
  }

  return {
    radice,
    baseURL,
    async chiudi() {
      fermaProcesso(processo);
      rmSync(radice, { recursive: true, force: true });
    },
  };
}
