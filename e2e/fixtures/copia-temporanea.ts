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
 * Due difetti misurati e corretti in questo giro (issue #8, L07, journal
 * 2026-09-20, giornata di qa-test — corregge il tentativo incompleto lasciato
 * dalla sessione precedente, che aveva scritto QUESTO commento senza applicare
 * il fix al codice sottostante: misurato, non dedotto, prima di fidarsene):
 *
 * - (b1) `astro preview` in Astro 7 si sgancia in un processo demone: il
 *   processo reale non resta figlio del gruppo con cui viene spawnato qui, e
 *   `process.kill(-pid, 'SIGTERM')` sul gruppo del padre (`pnpm`, già uscito)
 *   non lo raggiunge — misurato con `pgrep -fc 'astro.mjs[ ]preview'` ancora >0
 *   dopo `chiudi()`, e con `readlink /proc/<pid>/cwd` che mostra la cartella
 *   temporanea già cancellata (il processo è vivo, orfano, con cwd `(deleted)`).
 *   `--ignore-lock` mantiene davvero il processo nello stesso gruppo (misurato:
 *   con il flag, lo stesso `SIGTERM` sul gruppo lo termina; senza, no) — ma
 *   quel flag non era mai stato aggiunto all'array di `spawn()` qui sotto,
 *   solo descritto in questo commento. È la correzione di questo giro.
 * - (b2) conseguenza diretta di (b1), non un difetto distinto: un orfano di
 *   (b1) resta in ascolto sulla porta fissa che AC6/N2 riusano a ogni
 *   esecuzione (4322, 4323). `attendiPronto()` verifica solo che *qualcuno*
 *   risponda su quell'URL, non che sia il processo appena avviato da questa
 *   chiamata: un orfano precedente risponde al posto della copia nuova e il
 *   test verifica involontariamente la build di un'esecuzione passata.
 *   Verificato con una build manuale (rsync di `site/`+`contracts/`, fixture
 *   sostituita, `pnpm build`) che la sostituzione arriva correttamente a
 *   `dist/` quando non c'è un orfano a rispondere al posto suo: il meccanismo
 *   di sostituzione era già corretto, il sintomo veniva tutto da (b1).
 *   `chiudi()` ora attende l'uscita reale del processo (evento `exit`, con un
 *   `SIGKILL` di riserva) prima di cancellare la cartella temporanea e
 *   restituire il controllo a chi chiama, così due esecuzioni di fila non
 *   possono trovare la porta ancora occupata da quella precedente.
 * - Il parametro `porta` resta quello passato da chi chiama (AC6: 4322, N2:
 *   4323, letterali nei rispettivi file di spec) e viene usato così com'è per
 *   avviare il server: niente `--port 0`, perché niente qui legge lo stdout
 *   del processo (`stdio: 'ignore'`) per scoprire una porta assegnata a
 *   caso — quella strada non è mai stata implementata, nonostante un
 *   commento precedente la descrivesse come se lo fosse.
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

/**
 * Ferma il gruppo di processi (pnpm + astro preview, avviati con `--ignore-lock`
 * perché restino nello stesso gruppo, misurato: vedi commento in cima al file) e
 * NON restituisce il controllo finché il processo non è uscito davvero — non al
 * primo istante in cui `SIGTERM` è stato inviato. Senza questa attesa, `chiudi()`
 * poteva restituire il controllo mentre l'astro.mjs preview era ancora in fase di
 * spegnimento: una seconda esecuzione sulla stessa porta fissa (AC6: 4322, N2:
 * 4323) poteva allora trovarla ancora occupata.
 */
function fermaProcesso(processo: ChildProcess): Promise<void> {
  return new Promise((risolvi) => {
    if (processo.pid == null || processo.exitCode !== null || processo.signalCode !== null) {
      risolvi();
      return;
    }
    const pid = processo.pid;
    let risolto = false;
    const concludi = () => {
      if (risolto) return;
      risolto = true;
      clearTimeout(timeoutSigkill);
      risolvi();
    };
    // Riserva: se SIGTERM non basta entro 5s, SIGKILL sul gruppo prima di arrendersi.
    const timeoutSigkill = setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Il gruppo è già terminato nel frattempo: niente da fare.
      }
    }, 5_000);
    processo.once('exit', concludi);
    try {
      // Il processo è avviato con detached:true: -pid uccide l'intero gruppo (pnpm + astro preview).
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Il gruppo di processi è già terminato: niente da fermare, e niente evento 'exit' in arrivo.
      concludi();
    }
  });
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
    ['preview', '--port', String(porta), '--host', '127.0.0.1', '--ignore-lock'],
    { cwd: cartellaSite, detached: true, stdio: 'ignore' },
  );

  const baseURL = `http://127.0.0.1:${porta}`;
  try {
    await attendiPronto(`${baseURL}/robots.txt`, 120_000);
  } catch (errore) {
    await fermaProcesso(processo);
    rmSync(radice, { recursive: true, force: true });
    throw errore;
  }

  return {
    radice,
    baseURL,
    async chiudi() {
      await fermaProcesso(processo);
      rmSync(radice, { recursive: true, force: true });
    },
  };
}
