/**
 * tests/perf/misura-laboratorio.ts
 *
 * Attuazione del metodo di laboratorio dichiarato in
 * `contracts/perf-budgets.json` → `$metodo_laboratorio_pagine_pubbliche` (AC39, DV-4,
 * ADR-0001). Non contiene soglie: quelle si leggono dal contratto a chiave, a runtime,
 * dal test che le confronta (`tests/perf/ac39-budget-pagine-pubbliche.spec.ts`).
 *
 * Perché i byte di JS/CSS si leggono dalle risposte HTTP e non dal disco: leggere la
 * cartella di output della build su disco richiederebbe sapere dove sia (dipende da
 * `astro.config.mjs`, sorgente vietata in questo lotto) o assumerlo per convenzione —
 * una deduzione, non una misura. Il server di anteprima (`astro preview`, avviato da
 * `playwright.config.ts`) serve staticamente l'artefatto di build senza trasformarlo:
 * i byte ricevuti da `response.body()` durante la navigazione della pagina realmente
 * servita SONO l'artefatto di build, letti allo stesso modo con cui il resto del
 * progetto legge il documento servito (CLAUDE.md: «si estraggono i computed style dal
 * documento servito via HTTP, non si assumono»). Decisione registrata in
 * journal/2026-09-20/170059-qa-test-decisione.json.
 *
 * I parametri numerici del metodo (viewport, fattore di CPU throttling, i tre valori
 * di rete, il numero di esecuzioni) si estraggono a runtime dalla prosa del contratto
 * con espressioni regolari, invece di essere ricopiati come costanti: se il contratto
 * cambia questi numeri, l'estrazione li segue senza toccare questo file.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Browser, Page } from '@playwright/test';

const RADICE_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function leggiJson<T>(percorsoRelativoAllaRadice: string): T {
  const percorsoAssoluto = path.join(RADICE_REPO, percorsoRelativoAllaRadice);
  return JSON.parse(readFileSync(percorsoAssoluto, 'utf-8')) as T;
}

export interface SoglieLaboratorioPagine {
  js_iniziale_gzip_kb: number;
  css_gzip_kb: number;
  lcp_ms_lab_mediana: number;
  cls_lab_mediana: number;
}

export interface PerfBudgets {
  pagine_pubbliche: SoglieLaboratorioPagine & Record<string, unknown>;
  [chiave: string]: unknown;
}

/** Legge contracts/perf-budgets.json a runtime, per intero. Non si copiano soglie qui. */
export function leggiPerfBudgets(): PerfBudgets {
  return leggiJson<PerfBudgets>('contracts/perf-budgets.json');
}

export interface CondizioniLaboratorio {
  viewport: { width: number; height: number };
  cpuThrottlingRate: number;
  rete: { latency: number; downloadThroughput: number; uploadThroughput: number };
  esecuzioni: number;
}

/**
 * Estrae i parametri del metodo di laboratorio dalla prosa di
 * `$metodo_laboratorio_pagine_pubbliche` nel contratto. Lancia un errore esplicito
 * (da trattare come gate, non da aggirare) se il contratto non è nel formato atteso:
 * un contratto illeggibile con questo metodo non va interpretato a occhio dentro il
 * test.
 */
export function leggiCondizioniLaboratorio(): CondizioniLaboratorio {
  const contratto = leggiPerfBudgets() as Record<string, any>;
  const metodo = contratto['$metodo_laboratorio_pagine_pubbliche'];
  if (!metodo || typeof metodo !== 'object') {
    throw new Error(
      "contracts/perf-budgets.json: manca o non è un oggetto '$metodo_laboratorio_pagine_pubbliche' — gate, non si indovina il metodo.",
    );
  }

  const dispositivo: unknown = metodo.dispositivo;
  const rete: unknown = metodo.rete;
  const esecuzioni: unknown = metodo.esecuzioni;

  if (typeof dispositivo !== 'string' || typeof rete !== 'string' || typeof esecuzioni !== 'number') {
    throw new Error(
      "contracts/perf-budgets.json: '$metodo_laboratorio_pagine_pubbliche' non ha i campi attesi (dispositivo: string, rete: string, esecuzioni: number) — gate.",
    );
  }

  const viewportMatch = dispositivo.match(/Viewport\s+(\d+)x(\d+)/i);
  const cpuMatch = dispositivo.match(/CPU throttling\s+(\d+(?:[.,]\d+)?)x/i);
  const latencyMatch = rete.match(/latency\s*=\s*(\d+(?:[.,]\d+)?)/i);
  const downloadMatch = rete.match(/downloadThroughput\s*=\s*(\d+(?:[.,]\d+)?)/i);
  const uploadMatch = rete.match(/uploadThroughput\s*=\s*(\d+(?:[.,]\d+)?)/i);

  if (!viewportMatch || !cpuMatch || !latencyMatch || !downloadMatch || !uploadMatch) {
    throw new Error(
      "contracts/perf-budgets.json: non riesco a estrarre viewport/CPU/rete dalla prosa di '$metodo_laboratorio_pagine_pubbliche' — il metodo del contratto non è attuabile come scritto (gate, CLAUDE.md: 'non adattare il metodo alla misura').",
    );
  }

  const numero = (s: string) => Number(s.replace(',', '.'));

  return {
    viewport: { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) },
    cpuThrottlingRate: numero(cpuMatch[1]),
    rete: {
      latency: numero(latencyMatch[1]),
      downloadThroughput: numero(downloadMatch[1]),
      uploadThroughput: numero(uploadMatch[1]),
    },
    esecuzioni,
  };
}

interface RisorsaCatturata {
  url: string;
  tipo: 'script' | 'stylesheet';
  bytes: Buffer;
}

interface EsitoEsecuzione {
  status: number | null;
  lcpMs: number | null;
  cls: number;
  risorse: RisorsaCatturata[];
}

/**
 * Polling su condizione, non attesa a tempo fisso: legge ripetutamente il candidato
 * LCP finché resta stabile per una finestra di quiete, invece di dormire un tempo
 * arbitrario sperando che sia bastato. Il contratto chiede di leggere l'ultima entry
 * dopo `load` «quando non arrivano più entry nuove»: qui si verifica quella
 * condizione invece di assumerla.
 */
async function attendiCandidatoLCPStabile(
  page: Page,
  finestraQuieteMs = 400,
  intervalMs = 100,
  timeoutMs = 8000,
): Promise<number | null> {
  let precedente: number | null | undefined = undefined;
  let stabileDaMs = 0;
  const inizio = Date.now();
  while (Date.now() - inizio < timeoutMs) {
    const attuale: number | null = await page.evaluate(() => (window as any).__lcpValue ?? null);
    if (attuale === precedente) {
      stabileDaMs += intervalMs;
      if (stabileDaMs >= finestraQuieteMs) return attuale;
    } else {
      stabileDaMs = 0;
      precedente = attuale;
    }
    await page.waitForTimeout(intervalMs);
  }
  return precedente ?? null;
}

/**
 * Un'unica esecuzione a freddo (isolamento richiesto dal contratto): nuovo
 * `browser.newContext()` senza storage/cookie/cache condivisi con altre esecuzioni,
 * CPU e rete emulate via CDP, cattura delle risposte script/stylesheet stesso-origine
 * caricate durante il caricamento iniziale, LCP letto dopo `load` a stabilità e CLS
 * sommato su tutta la sessione di caricamento.
 */
async function eseguiUnaVolta(
  browser: Browser,
  urlAssoluto: string,
  condizioni: CondizioniLaboratorio,
): Promise<EsitoEsecuzione> {
  const origine = new URL(urlAssoluto).origin;
  const context = await browser.newContext({
    viewport: condizioni.viewport,
    serviceWorkers: 'block',
  });

  const risorse: RisorsaCatturata[] = [];
  const page = await context.newPage();

  page.on('response', (response) => {
    const richiesta = response.request();
    const tipoRisorsa = richiesta.resourceType();
    if (tipoRisorsa !== 'script' && tipoRisorsa !== 'stylesheet') return;
    if (!response.url().startsWith(origine)) return; // solo stesso-origine
    response
      .body()
      .then((corpo) => {
        risorse.push({ url: response.url(), tipo: tipoRisorsa as 'script' | 'stylesheet', bytes: corpo });
      })
      .catch(() => {
        // risposta non più leggibile (redirect, navigazione successiva): ignorata.
      });
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: condizioni.rete.latency,
    downloadThroughput: condizioni.rete.downloadThroughput,
    uploadThroughput: condizioni.rete.uploadThroughput,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: condizioni.cpuThrottlingRate });

  await page.addInitScript(() => {
    (window as any).__clsValue = 0;
    (window as any).__lcpValue = null;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            (window as any).__clsValue += entry.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* browser senza supporto: __clsValue resta 0 */
    }
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const ultima = entries[entries.length - 1] as any;
        if (ultima) (window as any).__lcpValue = ultima.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      /* browser senza supporto: __lcpValue resta null */
    }
  });

  let status: number | null;
  try {
    const risposta = await page.goto(urlAssoluto, { waitUntil: 'load' });
    status = risposta ? risposta.status() : null;
  } catch {
    status = null;
  }

  const lcpMs = status === 200 ? await attendiCandidatoLCPStabile(page) : null;
  // Piccola attesa perché eventuali risposte in volo al momento della lettura di CLS
  // finiscano di essere processate dal listener 'response' prima di leggere l'array.
  await page.waitForTimeout(100);
  const cls: number = await page.evaluate(() => (window as any).__clsValue ?? 0);

  await context.close();

  return { status, lcpMs, cls, risorse };
}

function pesoGzipKb(risorse: RisorsaCatturata[], tipo: 'script' | 'stylesheet'): number {
  const viste = new Set<string>();
  let totaleBytes = 0;
  for (const r of risorse) {
    if (r.tipo !== tipo) continue;
    if (viste.has(r.url)) continue;
    viste.add(r.url);
    totaleBytes += zlib.gzipSync(r.bytes).length;
  }
  return totaleBytes / 1024;
}

/** Mediana (p50). Lancia un errore su campione vuoto: niente falso zero silenzioso. */
export function mediana(numeri: number[]): number {
  if (numeri.length === 0) {
    throw new Error('mediana: nessun campione da cui calcolarla');
  }
  const ordinati = [...numeri].sort((a, b) => a - b);
  const meta = Math.floor(ordinati.length / 2);
  if (ordinati.length % 2 === 0) return (ordinati[meta - 1] + ordinati[meta]) / 2;
  return ordinati[meta];
}

export interface RisultatoMisuraPagina {
  rotta: string;
  statoPrimaEsecuzione: number | null;
  jsInizialeGzipKb: number;
  cssGzipKb: number;
  lcpMsMediana: number | null;
  clsMediana: number;
  lcpCampioniMs: (number | null)[];
  clsCampioni: number[];
  esecuzioni: number;
}

/**
 * Esegue il metodo di laboratorio completo per una pagina: N esecuzioni a freddo
 * (N dal contratto), mediana di LCP e CLS, peso gzip di JS/CSS iniziali dalla prima
 * esecuzione (il peso dell'artefatto è statico: non ha senso mediarlo su più
 * esecuzioni identiche, solo i tempi variano per rumore).
 */
export async function misuraPaginaInLaboratorio(
  browser: Browser,
  baseURL: string,
  rotta: string,
): Promise<RisultatoMisuraPagina> {
  const condizioni = leggiCondizioniLaboratorio();
  const urlAssoluto = `${baseURL.replace(/\/+$/, '')}${rotta}`;

  const lcpCampioniMs: (number | null)[] = [];
  const clsCampioni: number[] = [];
  let risorsePrimaEsecuzione: RisorsaCatturata[] = [];
  let statoPrimaEsecuzione: number | null = null;

  for (let i = 0; i < condizioni.esecuzioni; i++) {
    const esito = await eseguiUnaVolta(browser, urlAssoluto, condizioni);
    if (i === 0) {
      risorsePrimaEsecuzione = esito.risorse;
      statoPrimaEsecuzione = esito.status;
    }
    lcpCampioniMs.push(esito.lcpMs);
    clsCampioni.push(esito.cls);
  }

  const campioniLCPValidi = lcpCampioniMs.filter((v): v is number => typeof v === 'number');

  return {
    rotta,
    statoPrimaEsecuzione,
    jsInizialeGzipKb: pesoGzipKb(risorsePrimaEsecuzione, 'script'),
    cssGzipKb: pesoGzipKb(risorsePrimaEsecuzione, 'stylesheet'),
    lcpMsMediana: campioniLCPValidi.length > 0 ? mediana(campioniLCPValidi) : null,
    clsMediana: mediana(clsCampioni),
    lcpCampioniMs,
    clsCampioni,
    esecuzioni: condizioni.esecuzioni,
  };
}
