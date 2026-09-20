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
 *   4. costruisce e serve la copia su una porta ottenuta dal sistema operativo, diversa
 *      sia da quella del webServer principale (playwright.config.ts) sia da quella di
 *      ogni altra copia in corso.
 *
 * Non modifica mai `site/` sul posto: D4 scarta esplicitamente quell'alternativa,
 * perché un test interrotto lascerebbe sporca la copia di lavoro condivisa dalle
 * worktree. Ogni chiamata lavora su una cartella temporanea propria e la cancella
 * in `chiudi()`.
 *
 * Tre difetti misurati e corretti in due giri (issue #8, L07, journal 2026-09-20):
 *
 * - (b1) `astro preview` in Astro 7 si sgancia in un processo demone: il processo
 *   reale non restava figlio del gruppo con cui veniva spawnato qui, e
 *   `process.kill(-pid, 'SIGTERM')` sul gruppo del padre (`pnpm`, già uscito) non lo
 *   raggiungeva — misurato con `pgrep -fc 'astro.mjs[ ]preview'` ancora >0 dopo
 *   `chiudi()`. Corretto aggiungendo `--ignore-lock` all'array di `spawn()`: misurato
 *   che con quel flag il processo resta nello stesso gruppo e lo stesso `SIGTERM` lo
 *   termina davvero (giro precedente, voce qa-test-misura delle 18:46).
 * - (b2) era conseguenza diretta di (b1): un orfano restava in ascolto sulla porta
 *   fissa che AC6/N2 riusavano a ogni esecuzione, e `attendiPronto()` accettava la sua
 *   risposta come se fosse la copia nuova. Chiuso insieme a (b1): senza orfani vivi,
 *   non c'è più nessuno a rispondere al posto della copia corrente.
 * - (b3), questo giro: anche con (b1)/(b2) chiusi, la porta restava un numero fisso
 *   scritto a mano nei due file di criteri (4322 per AC6, 4323 per N2). Con
 *   `fullyParallel: true` più copie possono essere costruite insieme da worker
 *   diversi (lo stesso file di criterio eseguito su worker paralleli, o AC6 e N2 in
 *   corso nello stesso momento) e contendersi la stessa porta fissa: misurato prima
 *   di questo giro, `npx playwright test` -> 14 failed, e dopo la suite 2 processi
 *   `astro.mjs preview` orfani con cwd dentro una cartella `ownconsent-l07-` (deleted).
 *   Corretto qui: la porta non è più un parametro di chi chiama, la ottiene questa
 *   funzione dal sistema operativo (bind su 0, si legge quella assegnata, si chiude
 *   il socket di prova) — stesso mezzo già in produzione in
 *   `playwright.config.ts::portaLibera()` per il webServer principale, duplicato qui
 *   come funzione locale invece di importato per non eseguire anche il codice di
 *   modulo di quel file di configurazione (lettura di `OWNCONSENT_E2E_PORT`,
 *   `defineConfig()`) solo per una funzione di poche righe.
 *
 *   FINESTRA DI RISCHIO dichiarata, non assorbita: fra la chiusura del socket di
 *   prova e l'avvio di `astro preview --port <n>` la porta letta potrebbe essere
 *   presa da un altro processo (compresa un'altra copia temporanea che la chiede
 *   nello stesso istante). In quel caso `astro preview` fallisce l'avvio e
 *   `attendiPronto()` scade con un errore esplicito su quell'URL: un fallimento
 *   rumoroso, mai una risposta sbagliata scambiata per quella giusta, perché
 *   `attendiPronto()` non ha comunque mai verificato *quale* processo risponde, solo
 *   che l'URL risponda. Stessa finestra già accettata implicitamente da
 *   `playwright.config.ts` per il webServer principale: non è un rischio nuovo, è lo
 *   stesso mezzo esteso al secondo punto del codice che ne aveva bisogno.
 */

import { mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
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

/**
 * Chiede al sistema operativo una porta libera su 127.0.0.1 e la restituisce: letta,
 * non presunta (stesso mezzo di `playwright.config.ts::portaLibera()`, duplicato qui
 * perché i due file non condividono un modulo comune e importare la configurazione
 * eseguirebbe anche il suo codice di modulo). Vedi la finestra di rischio dichiarata
 * in cima al file.
 */
function portaLibera(): Promise<number> {
  return new Promise((risolvi, rifiuta) => {
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

export type FixtureSostituita = 'listino' | 'contatto';

const NOME_FILE: Record<FixtureSostituita, string> = {
  listino: 'listino.json',
  contatto: 'contatto.json',
};

export interface CopiaTemporanea {
  /** Radice della copia temporanea: contiene site/ e contracts/ agli stessi percorsi relativi dell'originale. */
  radice: string;
  /** Base URL del server di anteprima di questa copia (porta ottenuta dal sistema operativo, diversa a ogni chiamata). */
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
 * spegnimento.
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
 * copia pronta. La porta di ascolto la ottiene questa funzione dal sistema operativo
 * (`portaLibera()`, sopra): chi chiama non la passa e non la presume, usa solo
 * `baseURL` nel valore restituito. Chi chiama DEVE invocare `chiudi()` (es. in
 * `test.afterAll`) per fermare il server e cancellare la cartella temporanea.
 */
export async function costruisciCopiaConFixture(opzioni: {
  fixture: FixtureSostituita;
  percorsoFixture: string;
}): Promise<CopiaTemporanea> {
  const { fixture, percorsoFixture } = opzioni;

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

  const porta = await portaLibera();

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
