/**
 * L09-F1 e L09-F2 — test di regressione COMPORTAMENTALI (issue #8, lotto L14).
 *
 * Scritti dalla decisione di Andrea (journal/2026-09-23/165208-orchestrator-decisione.json)
 * e dalla misura della sessione (journal/2026-09-23/165508-orchestrator-misura.json,
 * 165627-orchestrator-misura.json), non dall'implementazione: guardano BaseLayout.astro
 * solo per verificare le prove-by-reversion elencate sotto, non per copiare i valori qui.
 *
 * F1 — «al primo Tab, il link "Salta al contenuto" è interamente nella viewport e nessun
 * punto del suo anello di focus è coperto» — su 8 pagine (e2e/pagine.ts) x 2 viewport
 * (360x640, 1280x800).
 *
 * Metodo (NON elementFromPoint): un outline CSS non partecipa all'hit-testing del DOM,
 * quindi elementFromPoint/elementsFromPoint sui punti dell'anello restituisce la scatola
 * che sta SOTTO anche quando l'anello è dipinto sopra — è il metodo che in questo stesso
 * lotto ha dato due falsi «coperto» (journal/2026-09-23/165508-orchestrator-misura.json).
 * Il metodo validato, ripreso identico da docs/evidenza/8/l14/sonda-l14.mjs: una
 * schermata con il link a fuoco, lettura del colore nei punti campionati al centro della
 * fascia dell'anello (bordo del link + outline-offset + metà outline-width), confrontato
 * con l'outline-color calcolato (tolleranza per canale); un punto fuori dalla viewport
 * conta come non visibile per definizione. Lo stesso script sa dire "rosso": iniettando
 * un header sopra il link (position:relative;z-index:1) il metodo trova 36/36 punti non
 * visibili in tutte le combinazioni (docs/evidenza/8/l14/misura-f1-controllo-coperto.json).
 *
 * F1 include anche: il link non a fuoco deve avere area visibile 0 px² (bug corretto in
 * questo lotto — 5fd10e8 lasciava 640 px² visibili senza focus, contro
 * docs/design/00-sistema-e-componenti.md riga 30, «visibile solo al focus»).
 *
 * F2 — criterio di Andrea (journal/2026-09-23/165208-orchestrator-decisione.json, terzo
 * caso di un'istruzione corretta da una misura): dopo Tab sul link di salto e Invio,
 * document.activeElement è <main>; il Tab successivo va al primo elemento focalizzabile
 * che SEGUE l'inizio di <main> nell'ordine del documento — dentro <main> se ce n'è uno,
 * altrimenti il primo dopo (es. /confronto/: 0 link, 0 button, 0 tabindex dentro <main>,
 * quindi il Tab va al primo link del footer — corretto).
 *
 * Prove-by-reversion (fatte a mano dalla sessione di @qa-test, non incluse qui come
 * test eseguibili — vedi il comando in docs/evidenza/8/l14/qa-test/):
 * - BaseLayout.astro di 1ae5db2 (senza tabindex="-1" su <main>, anello che sporge oltre
 *   la viewport) deve far fallire sia F1 sia F2 su questo file.
 * - BaseLayout.astro di 5fd10e8 (link spostato anche senza focus) deve far fallire il
 *   test "non a fuoco fuori viewport".
 */

import { test, expect, type Page } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaPagina } from './guardia-esistenza';

const VIEWPORT: Array<[number, number]> = [
  [360, 640],
  [1280, 800],
];

const PUNTI_PER_LATO = 9;
const TOLLERANZA = 8;

function rgbDaCss(colore: string): number[] {
  const m = colore.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`colore CSS non riconosciuto: ${colore}`);
  return m[1]
    .split(',')
    .slice(0, 3)
    .map((x) => Math.round(Number(x)));
}

/**
 * Legge il colore dei punti indicati sulla schermata corrente, tramite un canvas nel
 * browser (stesso trucco di sonda-l14.mjs: nessuna libreria di immagini in Node).
 */
async function coloriNeiPunti(page: Page, punti: number[][]): Promise<number[][]> {
  const png = await page.screenshot();
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  return await page.evaluate(
    async ({ dataUrl, punti }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return punti.map(([x, y]) =>
        Array.from(ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)),
      );
    },
    { dataUrl, punti },
  );
}

interface MisuraF1 {
  classeAFuoco: string;
  dentroViewport: boolean;
  nonVisibili: string[];
  puntiTotali: number;
}

async function misuraF1(page: Page, rotta: string, vw: number, vh: number): Promise<MisuraF1> {
  await page.setViewportSize({ width: vw, height: vh });
  await guardiaEsistenzaPagina(page, rotta);
  await page.keyboard.press('Tab');

  const stato = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    return {
      classe: a.className,
      outlineColor: cs.outlineColor,
      outlineWidth: parseFloat(cs.outlineWidth),
      outlineOffset: parseFloat(cs.outlineOffset),
      link: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
    };
  });

  const d = stato.outlineOffset + stato.outlineWidth / 2;
  const L = stato.link;
  const [x0, y0, x1, y1] = [L.left - d, L.top - d, L.right + d, L.bottom + d];
  const dentroViewport = x0 >= 0 && y0 >= 0 && x1 <= vw && y1 <= vh;

  const punti: number[][] = [];
  for (let i = 0; i < PUNTI_PER_LATO; i++) {
    const t = (i + 0.5) / PUNTI_PER_LATO;
    punti.push(
      [x0 + t * (x1 - x0), y0],
      [x0 + t * (x1 - x0), y1],
      [x0, y0 + t * (y1 - y0)],
      [x1, y0 + t * (y1 - y0)],
    );
  }

  const dentro = punti.filter(([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh);
  const colori = await coloriNeiPunti(page, dentro);
  const atteso = rgbDaCss(stato.outlineColor);

  const nonVisibili: string[] = [];
  let j = 0;
  for (const p of punti) {
    if (!(p[0] >= 0 && p[1] >= 0 && p[0] < vw && p[1] < vh)) {
      nonVisibili.push(`(${p[0].toFixed(1)},${p[1].toFixed(1)}) fuori viewport`);
      continue;
    }
    const c = colori[j++];
    if (c.some((v, k) => Math.abs(v - atteso[k]) > TOLLERANZA)) {
      nonVisibili.push(
        `(${p[0].toFixed(1)},${p[1].toFixed(1)}) colore letto [${c.join(',')}] atteso [${atteso.join(',')}]`,
      );
    }
  }

  return { classeAFuoco: stato.classe, dentroViewport, nonVisibili, puntiTotali: punti.length };
}

async function areaVisibileNonAFuoco(page: Page, rotta: string, vw: number, vh: number): Promise<number> {
  await page.setViewportSize({ width: vw, height: vh });
  await guardiaEsistenzaPagina(page, rotta);
  return await page.evaluate(() => {
    const el = document.querySelector('.salta-al-contenuto');
    if (!el) return -1; // guardia: l'elemento deve esistere, un -1 fa fallire l'asserzione sotto
    const r = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    return Math.round(w * h);
  });
}

interface MisuraF2 {
  tagDopoInvio: string;
  idDopoInvio: string;
  atteso: { tag: string; testo: string } | null;
  ugualeAllAtteso: boolean;
  primaDiMain: boolean;
  tagTrovato: string;
  testoTrovato: string;
}

async function misuraF2(page: Page, rotta: string, vw: number, vh: number): Promise<MisuraF2> {
  await page.setViewportSize({ width: vw, height: vh });
  await guardiaEsistenzaPagina(page, rotta);

  await page.keyboard.press('Tab'); // fuoco sul link "Salta al contenuto"
  await page.keyboard.press('Enter'); // attiva il link

  const dopoInvio = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    return { tag: a.tagName, id: a.id };
  });

  const atteso = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const selettore = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]';
    const focalizzabili = [...document.querySelectorAll<HTMLElement>(selettore)].filter((el) => {
      if (el.tabIndex < 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
    const cheSeguonoMain = focalizzabili.filter(
      (el) =>
        el === main ||
        (main.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) !== 0,
    );
    const primo = cheSeguonoMain[0] as HTMLElement | undefined;
    (window as unknown as { __l09f2Atteso: HTMLElement | null }).__l09f2Atteso = primo ?? null;
    return primo ? { tag: primo.tagName, testo: (primo.textContent || '').trim().slice(0, 60) } : null;
  });

  await page.keyboard.press('Tab');

  const risultato = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const main = document.querySelector('main')!;
    const attesoEl = (window as unknown as { __l09f2Atteso: HTMLElement | null }).__l09f2Atteso;
    return {
      tag: a.tagName,
      testo: (a.textContent || '').trim().slice(0, 60),
      ugualeAllAtteso: a === attesoEl,
      primaDiMain: !!(main.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING),
    };
  });

  return {
    tagDopoInvio: dopoInvio.tag,
    idDopoInvio: dopoInvio.id,
    atteso,
    ugualeAllAtteso: risultato.ugualeAllAtteso,
    primaDiMain: risultato.primaDiMain,
    tagTrovato: risultato.tag,
    testoTrovato: risultato.testo,
  };
}

test.describe('L09-F1: al primo Tab il link di salto è interamente in viewport e il suo anello di focus non è coperto', () => {
  for (const pagina of PAGINE) {
    for (const [vw, vh] of VIEWPORT) {
      test(`F1: ${pagina.nome} (${pagina.rotta}) a ${vw}x${vh}`, async ({ page }) => {
        const misura = await misuraF1(page, pagina.rotta, vw, vh);

        expect(misura.classeAFuoco, 'al primo Tab il fuoco è sul link "salta al contenuto"').toContain(
          'salta-al-contenuto',
        );
        expect(misura.dentroViewport, `l'anello di focus del link di salto è interamente dentro la viewport ${vw}x${vh}`).toBe(
          true,
        );
        expect(
          misura.nonVisibili,
          `nessun punto dell'anello di focus coperto o fuori viewport (su ${misura.puntiTotali} punti campionati)`,
        ).toEqual([]);
      });
    }
  }
});

test.describe('L09-F1: il link di salto NON a fuoco resta fuori dalla viewport (visibile solo al focus)', () => {
  for (const pagina of PAGINE) {
    for (const [vw, vh] of VIEWPORT) {
      test(`F1 non a fuoco: ${pagina.nome} (${pagina.rotta}) a ${vw}x${vh} — area visibile 0 px²`, async ({ page }) => {
        const area = await areaVisibileNonAFuoco(page, pagina.rotta, vw, vh);
        expect(area, 'area visibile del link "salta al contenuto" quando non è a fuoco, in px²').toBe(0);
      });
    }
  }
});

test.describe("L09-F2: dopo Invio sul link di salto il fuoco è su <main>, il Tab successivo va al primo focalizzabile che segue l'inizio di <main>", () => {
  for (const pagina of PAGINE) {
    for (const [vw, vh] of VIEWPORT) {
      test(`F2: ${pagina.nome} (${pagina.rotta}) a ${vw}x${vh}`, async ({ page }) => {
        const misura = await misuraF2(page, pagina.rotta, vw, vh);

        expect(misura.tagDopoInvio, 'dopo Invio sul link di salto, document.activeElement è <main>').toBe('MAIN');
        expect(misura.idDopoInvio, "l'elemento a fuoco dopo Invio è #contenuto").toBe('contenuto');

        expect(
          misura.atteso,
          "esiste almeno un elemento focalizzabile che segue l'inizio di <main> (dentro <main>, oppure — come su /confronto/ — nel resto del documento, es. il footer)",
        ).not.toBeNull();

        expect(
          misura.ugualeAllAtteso,
          `il Tab successivo va al primo elemento focalizzabile che SEGUE l'inizio di <main> nell'ordine del documento — atteso ${JSON.stringify(
            misura.atteso,
          )}, trovato {"tag":"${misura.tagTrovato}","testo":"${misura.testoTrovato}"}`,
        ).toBe(true);

        expect(
          misura.primaDiMain,
          'il Tab successivo non deve tornare a un elemento che precede <main> (niente ripercorso di Header)',
        ).toBe(false);
      });
    }
  }
});
