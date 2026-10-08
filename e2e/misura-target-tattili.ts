/**
 * e2e/misura-target-tattili.ts
 *
 * Misura e giudizio dei target tattili per AC37, secondo ADR-0005
 * («Definizione operativa dell'eccezione Inline») e WCAG 2.2 criterio 2.5.8.
 *
 * Due passi separati, perche' la regola sia leggibile e provabile senza browser:
 *  1. `raccogliBersagli(page)` misura nel documento SERVITO (getComputedStyle,
 *     getClientRects): niente giudizio, solo fatti.
 *  2. `trovaNonConformi(bersagli)` giudica, in Node, con queste regole e nessun'altra:
 *     - la misura e' per rettangolo di `getClientRects()`, MAI sull'unione di
 *       `getBoundingClientRect()` (un link che va a capo ha piu' righe);
 *     - un rettangolo di almeno 24x24 CSS px e' conforme;
 *     - eccezione Inline (ADR-0005): display inizia con "inline", il genitore ha testo
 *       proprio (textContent tolti gli elementi interattivi, dopo il trim non vuoto),
 *       e OGNI rettangolo ha altezza <= line-height calcolata del genitore + 1px;
 *     - eccezione Spacing (WCAG 2.5.8): il cerchio di 24px di diametro centrato sul
 *       rettangolo sotto misura non interseca un ALTRO bersaglio. Contro un rettangolo
 *       di almeno 24x24 si confronta con la sua AREA (distanza dal centro al rettangolo
 *       >= 12px); contro un altro rettangolo sotto misura si confronta con il suo
 *       cerchio (distanza fra i centri >= 24px). Il centro-centro da solo sarebbe piu'
 *       indulgente contro un bersaglio grande (finding del collaudo sulla #105);
 *     - Equivalent, Essential e User agent control NON sono concesse dal test
 *       (ADR-0005): un bersaglio che le invoca fallisce.
 *
 * Limiti noti: i rettangoli dello stesso bersaglio non contano come vicini fra loro; lo
 * Spacing si applica per rettangolo (l'ADR non lo dice); con line-height non numerica
 * ("normal") il bersaglio non e' Inline; il cerchio e' centrato sul rettangolo di riga,
 * non sul riquadro dell'elemento.
 */

import type { Page } from '@playwright/test';

export const SOGLIA_PX = 24;

export interface RettangoloMisurato {
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface BersaglioMisurato {
  /** Posizione nell'ordine del documento: identifica il bersaglio anche con testo uguale. */
  indice: number;
  tag: string;
  estratto: string;
  display: string;
  /** Condizione (b) dell'ADR: il genitore ha testo proprio non interattivo. */
  genitoreConTestoProprio: boolean;
  /** line-height calcolata del genitore in px; null se non e' un numero (es. "normal"). */
  lineHeightGenitorePx: number | null;
  rettangoli: RettangoloMisurato[];
}

export interface RettangoloNonConforme extends RettangoloMisurato {
  indice: number;
  tag: string;
  estratto: string;
  distanzaMinima: number | null;
}

export async function raccogliBersagli(page: Page): Promise<BersaglioMisurato[]> {
  return await page.evaluate(() => {
    const selettore =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

    function eVisibile(el: Element): boolean {
      const stile = getComputedStyle(el);
      if (stile.display === 'none' || stile.visibility === 'hidden' || parseFloat(stile.opacity) === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function genitoreHaTestoProprio(genitore: Element): boolean {
      const copia = genitore.cloneNode(true) as Element;
      // style e script hanno textContent ma non sono testo letto da nessuno.
      for (const el of Array.from(copia.querySelectorAll(selettore + ', style, script'))) el.remove();
      return (copia.textContent ?? '').trim().length > 0;
    }

    return Array.from(document.querySelectorAll(selettore))
      .filter(eVisibile)
      .map((el, indice) => {
        const genitore = el.parentElement;
        const lh = genitore ? parseFloat(getComputedStyle(genitore).lineHeight) : NaN;
        return {
          indice,
          tag: el.tagName,
          estratto: (el.textContent ?? '').trim().slice(0, 40),
          display: getComputedStyle(el).display,
          genitoreConTestoProprio: genitore ? genitoreHaTestoProprio(genitore) : false,
          lineHeightGenitorePx: Number.isFinite(lh) ? lh : null,
          rettangoli: Array.from(el.getClientRects())
            .filter((r) => r.width > 0 && r.height > 0)
            .map((r) => ({ width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 })),
        };
      });
  });
}

/** Eccezione Inline come la definisce ADR-0005, condizioni (a), (b), (c). */
export function eInLinea(b: BersaglioMisurato): boolean {
  if (!b.display.startsWith('inline')) return false;
  if (!b.genitoreConTestoProprio) return false;
  if (b.lineHeightGenitorePx === null) return false;
  return b.rettangoli.every((r) => r.height <= b.lineHeightGenitorePx! + 1);
}

/**
 * Distanza "fra cerchi" di 24px: contro un rettangolo >= 24x24 e' la distanza dal centro di
 * `r` al rettangolo `ra` piu' 12px (raggio del cerchio), contro uno piu' piccolo e' la
 * distanza fra i centri. Lo Spacing e' soddisfatto se vale almeno SOGLIA_PX.
 */
export function distanzaEquivalente(r: RettangoloMisurato, ra: RettangoloMisurato): number {
  if (ra.width >= SOGLIA_PX && ra.height >= SOGLIA_PX) {
    const dx = Math.max(Math.abs(r.cx - ra.cx) - ra.width / 2, 0);
    const dy = Math.max(Math.abs(r.cy - ra.cy) - ra.height / 2, 0);
    return Math.hypot(dx, dy) + SOGLIA_PX / 2;
  }
  return Math.hypot(r.cx - ra.cx, r.cy - ra.cy);
}

export function trovaNonConformi(bersagli: BersaglioMisurato[]): RettangoloNonConforme[] {
  const risultato: RettangoloNonConforme[] = [];

  bersagli.forEach((b, i) => {
    if (eInLinea(b)) return;

    for (const r of b.rettangoli) {
      if (r.width >= SOGLIA_PX && r.height >= SOGLIA_PX) continue;

      let distanzaMinima: number | null = null;
      bersagli.forEach((altro, j) => {
        if (i === j) return;
        for (const ra of altro.rettangoli) {
          const d = distanzaEquivalente(r, ra);
          if (distanzaMinima === null || d < distanzaMinima) distanzaMinima = d;
        }
      });

      const spaziaturaOk = distanzaMinima === null || distanzaMinima >= SOGLIA_PX;
      if (!spaziaturaOk) risultato.push({ indice: b.indice, tag: b.tag, estratto: b.estratto, ...r, distanzaMinima });
    }
  });

  return risultato;
}

/** Quale regola promuove un bersaglio: 'dimensione', 'Inline', 'Spacing' o 'nessuna'. */
export function regolaCheLoPromuove(b: BersaglioMisurato, tutti: BersaglioMisurato[]): string {
  if (b.rettangoli.every((r) => r.width >= SOGLIA_PX && r.height >= SOGLIA_PX)) return 'dimensione';
  if (eInLinea(b)) return 'Inline';
  return trovaNonConformi(tutti).some((n) => n.indice === b.indice) ? 'nessuna' : 'Spacing';
}

// Pagine di prova costruite dal test (page.setContent) per la prova per reversione della
// issue #58. Non toccano site/. Ogni caso dichiara il proprio HTML in chiaro.
export const BASE_STILE =
  '<style>body{margin:0;padding:8px;font:16px/24px sans-serif}p,ul{margin:0;padding:0}li{list-style:none;font:16px/17px sans-serif;width:120px}</style>';

// Due link in linea nella stessa frase, alti < 24px, centri a < 24px: conformi per Inline.
export const HTML_DUE_LINK_IN_LINEA =
  BASE_STILE + '<p>Scegli <a href="#si">Si</a> <a href="#no">No</a> per continuare.</p>';

// Bersagli NON in linea (block / inline-block) sotto 24x24, adiacenti: non conformi.
export const HTML_BLOCCHI_PICCOLI =
  BASE_STILE +
  '<button type="button" style="display:block;width:20px;height:20px;padding:0;margin:0;border:0">a</button>' +
  '<a href="#b" style="display:inline-block;width:20px;height:20px;vertical-align:top">b</a>';

// Link a capo su due righe da 17px (unione 34px) nel <li> senza testo proprio (condizione
// (b) dell'ADR non soddisfatta: non e' in linea). Sotto, un pulsante 24x24 (conforme per dimensione). L'unione
// supera 24px, le righe no: la seconda riga sta a meno di 24px dal pulsante.
export const HTML_LINK_A_CAPO_FUORI_DA_INLINE =
  BASE_STILE +
  '<ul><li style="width:30px"><a href="#x">abc def</a></li></ul>' +
  '<button type="button" style="display:block;width:24px;height:24px;padding:0;margin:0;border:0">ok</button>';
