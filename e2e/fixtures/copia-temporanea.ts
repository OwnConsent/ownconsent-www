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
 * ## Le tre garanzie che questo file dà a chi lo chiama
 *
 * Sono tre perché vengono da tre difetti misurati, e ognuna è scritta qui accanto al
 * codice che la mantiene. Se una di queste frasi smette di descrivere il codice, è il
 * commento a essere un bug (CLAUDE.md, «misura, non dedurre»).
 *
 * **(G1) La porta è stretta: se quella richiesta è occupata, l'avvio fallisce.**
 * `astro preview --port <n>` da solo NON la rispetta: su porta occupata ripiega in
 * silenzio su un'altra — misurato il 21/09, `Port 46111 is in use, trying another
 * one...` seguito da `ready ... http://127.0.0.1:46112/`, con il processo vivo e
 * uscita 0. Il ripiego viene da Vite, non da Astro, e per questo non esiste un flag
 * di `astro preview` che lo tolga: la leva è `vite.preview.strictPort`, che Astro
 * inoltra. Per stringerla senza toccare `site/`, la copia scrive nella *propria*
 * cartella il file `astro.collaudo-anteprima.config.mjs` — un involucro che importa la
 * configurazione della copia e le aggiunge quel solo campo — e avvia l'anteprima con
 * `--config` su quel file. Misurato con l'involucro: porta occupata -> uscita 1 e
 * `Port 46111 is already in use`; porta libera -> `ready` e `200` su `/robots.txt`.
 * `strictPort` riguarda solo il server di anteprima: la build della copia resta quella
 * prodotta dalla configurazione vera.
 *
 * **(G2) `attendiPronto()` verifica l'identità del server, non che qualcosa risponda.**
 * La versione precedente tornava su qualunque `risposta.status < 500`: il 404 di un
 * processo estraneo rimasto in ascolto su quella porta veniva accettato come se fosse
 * la copia, e AC6 e N2 potevano girare interi contro il server di un'altra worktree e
 * risultare verdi. Ora la copia interroga una pagina che, nella *propria* build,
 * contiene per forza il valore della fixture che ha appena sostituito (l'indirizzo di
 * `contatto-di-prova.json`, il canone di `listino-di-prova.json`) e pretende di
 * ritrovarlo nella risposta: un server che non è questa copia non ha quel valore, e la
 * partenza fallisce invece di proseguire contro il server sbagliato. Il marcatore si
 * legge dal file di fixture passato dal chiamante, non è scritto a mano qui.
 *
 * (G1) e (G2) servono tutte e due e nessuna basta da sola: (G2) non distingue questa
 * copia da un'altra costruita con la stessa fixture da un worker parallelo — le due
 * build contengono lo stesso marcatore — e (G1) non dice niente su chi risponda a una
 * porta che questo processo ha ottenuto e legato per davvero.
 *
 * **(G3) L'arresto non lascia niente in ascolto, nemmeno con Ctrl-C.**
 * `chiudi()` copre l'uscita ordinata, ma un'interruzione non esegue `test.afterAll`:
 * misurato in L08 (F14) che un `kill -INT` al gruppo lasciava un `astro preview`
 * orfano in ascolto e una copia in `/tmp` (prima copie=0 preview=0, dopo copie=1
 * preview=1). Quell'orfano è poi l'occupante che innescava (G1): i due difetti si
 * alimentavano. Ogni copia viva è quindi iscritta in un registro di modulo, e
 * `installaGestoriDiUscita()` aggancia `SIGINT`/`SIGTERM`/`SIGHUP` e `exit` per
 * chiudere il gruppo di processi e cancellare la cartella in modo sincrono — sincrono
 * perché dentro `exit` non c'è più un giro di event loop in cui completare una
 * promessa.
 *
 * ## Storia: i difetti chiusi nei giri precedenti
 *
 * - (b1) `astro preview` in Astro 7 si sgancia in un processo demone: il processo
 *   reale non restava figlio del gruppo con cui veniva spawnato qui, e
 *   `process.kill(-pid, 'SIGTERM')` sul gruppo del padre (`pnpm`, già uscito) non lo
 *   raggiungeva — misurato con `pgrep -fc 'astro.mjs[ ]preview'` ancora >0 dopo
 *   `chiudi()`. Corretto aggiungendo `--ignore-lock` all'array di `spawn()`: misurato
 *   che con quel flag il processo resta nello stesso gruppo e lo stesso `SIGTERM` lo
 *   termina davvero (giro del 20/09, voce qa-test-misura delle 18:46).
 * - (b2) era conseguenza diretta di (b1): un orfano restava in ascolto sulla porta
 *   fissa che AC6/N2 riusavano a ogni esecuzione, e `attendiPronto()` accettava la sua
 *   risposta come se fosse la copia nuova. Chiuso insieme a (b1) per la parte degli
 *   orfani; la parte per cui una risposta estranea veniva scambiata per quella giusta
 *   è rimasta aperta fino a (G2), qui sopra.
 * - (b3) la porta era un numero fisso scritto a mano nei due file di criteri (4322 per
 *   AC6, 4323 per N2). Con `fullyParallel: true` più copie possono essere costruite
 *   insieme da worker diversi e contendersi la stessa porta fissa: misurato prima di
 *   quel giro, `npx playwright test` -> 14 failed, e dopo la suite 2 processi
 *   `astro.mjs preview` orfani con cwd dentro una cartella `ownconsent-l07-`
 *   (deleted). Corretto: la porta non è più un parametro di chi chiama, la ottiene
 *   `portaLibera()` dal sistema operativo — stesso mezzo già in produzione in
 *   `playwright.config.ts::portaLibera()` per il webServer principale, duplicato qui
 *   come funzione locale invece di importato per non eseguire anche il codice di
 *   modulo di quel file di configurazione (lettura di `OWNCONSENT_E2E_PORT`,
 *   `defineConfig()`) solo per una funzione di poche righe.
 *
 * Fra la chiusura del socket di prova di `portaLibera()` e il `listen` di `astro
 * preview` resta una finestra in cui un altro processo può prendersi quella porta.
 * Non è eliminata — è resa innocua: prima portava a un verde contro il server
 * sbagliato, ora porta a un'uscita 1 di `astro preview` e a un errore esplicito da
 * `costruisciCopiaConFixture()`. La stessa finestra esiste ancora, e senza (G1), per
 * il webServer principale di `playwright.config.ts`: è fuori dal perimetro di questa
 * correzione ed è segnalata, non assorbita.
 */

import { mkdtempSync, cpSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
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
 * eseguirebbe anche il suo codice di modulo).
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

/* ------------------------------------------------------------------ (G1) porta stretta */

/** Scritto SOLO nella copia temporanea, mai in `site/`. Vedi (G1) in cima al file. */
const NOME_CONFIG_ANTEPRIMA = 'astro.collaudo-anteprima.config.mjs';

const SORGENTE_CONFIG_ANTEPRIMA = `// Generato da e2e/fixtures/copia-temporanea.ts dentro la copia temporanea del collaudo.
// Estende la configurazione della copia con vite.preview.strictPort: senza di esso
// \`astro preview --port <n>\` su porta occupata ripiega in silenzio su un'altra porta.
// Riguarda solo il server di anteprima: la build resta quella di ./astro.config.mjs.
import base from './astro.config.mjs';

export default {
  ...base,
  vite: {
    ...(base.vite ?? {}),
    preview: { ...(base.vite?.preview ?? {}), strictPort: true },
  },
};
`;

/* --------------------------------------------------------- (G3) arresto senza superstiti */

/** Copie con un server ancora in vita, da chiudere se il processo muore senza `chiudi()`. */
const copieVive = new Set<{ pid: number | null; radice: string }>();

let gestoriInstallati = false;

/**
 * Aggancia una volta sola i gestori che chiudono le copie rimaste vive quando questo
 * processo termina senza passare da `chiudi()` — il caso di Ctrl-C, dove
 * `test.afterAll` non viene eseguito (F14). La pulizia è sincrona: dentro `exit` non
 * c'è più un giro di event loop, quindi niente `await`, e `SIGKILL` invece di
 * `SIGTERM` perché non resta tempo per attendere l'uscita del gruppo.
 */
function installaGestoriDiUscita(): void {
  if (gestoriInstallati) return;
  gestoriInstallati = true;

  const pulisci = (): void => {
    for (const copia of copieVive) {
      if (copia.pid !== null) {
        try {
          // Gruppo intero (spawn con detached:true): pnpm + astro preview.
          process.kill(-copia.pid, 'SIGKILL');
        } catch {
          // Gruppo già terminato: niente da fermare.
        }
      }
      try {
        rmSync(copia.radice, { recursive: true, force: true });
      } catch {
        // Cartella già sparita: niente da cancellare.
      }
    }
    copieVive.clear();
  };

  process.on('exit', pulisci);
  for (const segnale of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(segnale, () => {
      pulisci();
      // Registrare un gestore toglie il comportamento predefinito del segnale: l'uscita
      // va rifatta a mano, con il codice convenzionale 128 + numero del segnale.
      process.exit(segnale === 'SIGINT' ? 130 : segnale === 'SIGTERM' ? 143 : 129);
    });
  }
}

/* -------------------------------------------------------------- (G2) identità del server */

export type FixtureSostituita = 'listino' | 'contatto';

const NOME_FILE: Record<FixtureSostituita, string> = {
  listino: 'listino.json',
  contatto: 'contatto.json',
};

/**
 * Per ogni fixture: la rotta da interrogare e come ricavare, dal file di fixture, il
 * valore che quella rotta deve contenere nella build della copia. È l'identità di (G2):
 * la copia sa cosa ha scritto nella propria build e pretende di ritrovarlo.
 *
 * Entrambe puntano a `/saas/`: è la pagina che mostra sia il canone del primo piano SaaS
 * (AC6, `ListinoStruttura.astro`) sia il `mailto:` di contatto con l'oggetto di modalità
 * (N2). Una sola rotta per due criteri, verificata dalla prima misura di questo giro.
 */
const IDENTITA: Record<FixtureSostituita, { rotta: string; campo: string; estrai(dati: unknown): unknown }> = {
  listino: {
    rotta: '/saas/',
    campo: 'saas.piani[0].canone_mensile_eur',
    estrai: (dati) => (dati as { saas?: { piani?: { canone_mensile_eur?: unknown }[] } })?.saas?.piani?.[0]
      ?.canone_mensile_eur,
  },
  contatto: {
    rotta: '/saas/',
    campo: 'indirizzo',
    estrai: (dati) => (dati as { indirizzo?: unknown })?.indirizzo,
  },
};

/**
 * Legge dal file di fixture il valore che la build della copia dovrà contenere. Se non
 * c'è, si ferma qui invece di costruire una copia la cui identità non è verificabile:
 * un controllo di identità che non può fallire non è un controllo.
 */
function marcatoreDiIdentita(fixture: FixtureSostituita, percorsoFixture: string): { rotta: string; marcatore: string } {
  const { rotta, campo, estrai } = IDENTITA[fixture];
  const dati: unknown = JSON.parse(readFileSync(percorsoFixture, 'utf-8'));
  const valore = estrai(dati);
  if (typeof valore !== 'string' || valore.length === 0) {
    throw new Error(
      `la fixture ${percorsoFixture} non ha un valore utilizzabile in ${campo}: senza di esso ` +
        `attendiPronto() non può distinguere questa copia da un altro server in ascolto sulla stessa porta`,
    );
  }
  return { rotta, marcatore: valore };
}

export interface CopiaTemporanea {
  /** Radice della copia temporanea: contiene site/ e contracts/ agli stessi percorsi relativi dell'originale. */
  radice: string;
  /** Base URL del server di anteprima di questa copia (porta ottenuta dal sistema operativo, diversa a ogni chiamata). */
  baseURL: string;
  /** Ferma il server di anteprima e cancella la cartella temporanea. */
  chiudi(): Promise<void>;
}

/**
 * Attende che a `url` risponda **questa** copia, non un server qualsiasi: `200` e il
 * marcatore di (G2) dentro il corpo. Si ferma prima della scadenza se il processo di
 * anteprima è uscito — con (G1) è quello che succede su porta occupata, e aspettare
 * altri due minuti un server che non arriverà non aggiunge informazione.
 *
 * L'errore dice quale dei tre casi si è verificato: nessuna risposta, una risposta che
 * non è questa copia, o un processo morto con il suo output.
 */
async function attendiPronto(opzioni: {
  url: string;
  marcatore: string;
  timeoutMs: number;
  processo: ChildProcess;
  leggiOutput(): string;
}): Promise<void> {
  const { url, marcatore, timeoutMs, processo, leggiOutput } = opzioni;
  const scadenza = Date.now() + timeoutMs;
  let diagnosi = 'nessuna risposta dalla porta';

  while (Date.now() < scadenza) {
    if (processo.exitCode !== null || processo.signalCode !== null) {
      throw new Error(
        `il server della copia temporanea è uscito prima di essere pronto ` +
          `(codice ${String(processo.exitCode)}, segnale ${String(processo.signalCode)}) su ${url}. ` +
          `Con vite.preview.strictPort questo è ciò che accade se la porta richiesta è occupata ` +
          `da un altro processo. Output del comando:\n${leggiOutput()}`,
      );
    }
    try {
      const risposta = await fetch(url);
      if (risposta.status === 200) {
        const corpo = await risposta.text();
        if (corpo.includes(marcatore)) return;
        diagnosi =
          `qualcosa risponde 200 su quella porta ma non è questa copia: il marcatore «${marcatore}», ` +
          `che la build di questa copia contiene per forza, non compare nella risposta`;
      } else {
        diagnosi = `ultima risposta: stato ${risposta.status}`;
      }
    } catch (errore) {
      diagnosi = `nessuna risposta dalla porta: ${String(errore)}`;
    }
    await new Promise((risolvi) => setTimeout(risolvi, 500));
  }

  throw new Error(
    `server della copia temporanea non pronto entro ${timeoutMs}ms su ${url}: ${diagnosi}. ` +
      `Output del comando:\n${leggiOutput()}`,
  );
}

/**
 * Ferma il gruppo di processi (pnpm + astro preview, avviati con `--ignore-lock`
 * perché restino nello stesso gruppo, misurato: vedi (b1) in cima al file) e
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
 * copia pronta, con le tre garanzie (G1) porta stretta, (G2) identità verificata e
 * (G3) arresto senza superstiti descritte in cima al file. La porta di ascolto la
 * ottiene questa funzione dal sistema operativo (`portaLibera()`): chi chiama non la
 * passa e non la presume, usa solo `baseURL` nel valore restituito. Chi chiama DEVE
 * invocare `chiudi()` (es. in `test.afterAll`) per fermare il server e cancellare la
 * cartella temporanea; se il processo muore prima, ci pensano i gestori di (G3).
 */
export async function costruisciCopiaConFixture(opzioni: {
  fixture: FixtureSostituita;
  percorsoFixture: string;
}): Promise<CopiaTemporanea> {
  const { fixture, percorsoFixture } = opzioni;

  // Prima di copiare qualunque cosa: se il marcatore di identità non si può leggere,
  // non ha senso costruire la copia.
  const { rotta, marcatore } = marcatoreDiIdentita(fixture, percorsoFixture);

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

  // (G1): scritto dopo la build, così la build resta quella della configurazione vera.
  writeFileSync(path.join(cartellaSite, NOME_CONFIG_ANTEPRIMA), SORGENTE_CONFIG_ANTEPRIMA);

  const porta = await portaLibera();

  installaGestoriDiUscita();

  const processo: ChildProcess = spawn(
    'pnpm',
    [
      'preview',
      '--config',
      NOME_CONFIG_ANTEPRIMA,
      '--port',
      String(porta),
      '--host',
      '127.0.0.1',
      '--ignore-lock',
    ],
    { cwd: cartellaSite, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  // L'output serve solo a spiegare un avvio fallito: se ne tiene la coda, non tutto.
  let output = '';
  const accumula = (pezzo: Buffer) => {
    output = (output + pezzo.toString('utf-8')).slice(-8_000);
  };
  processo.stdout?.on('data', accumula);
  processo.stderr?.on('data', accumula);

  const iscrizione = { pid: processo.pid ?? null, radice };
  copieVive.add(iscrizione);

  const baseURL = `http://127.0.0.1:${porta}`;
  try {
    await attendiPronto({
      url: `${baseURL}${rotta}`,
      marcatore,
      timeoutMs: 120_000,
      processo,
      leggiOutput: () => output,
    });
  } catch (errore) {
    await fermaProcesso(processo);
    copieVive.delete(iscrizione);
    rmSync(radice, { recursive: true, force: true });
    throw errore;
  }

  return {
    radice,
    baseURL,
    async chiudi() {
      await fermaProcesso(processo);
      copieVive.delete(iscrizione);
      rmSync(radice, { recursive: true, force: true });
    },
  };
}
