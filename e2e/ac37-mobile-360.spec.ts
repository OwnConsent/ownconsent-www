/**
 * AC37 — Mobile 360×640 con touch: niente scroll orizzontale, testo leggibile, target
 * tattili adeguati
 *
 * Data una viewport di 360×640 CSS px con emulazione touch, quando apro ciascuna delle
 * 8 pagine pubbliche, allora:
 *  - non c'è scorrimento orizzontale (la larghezza di scorrimento del documento non
 *    supera la larghezza della viewport);
 *  - il testo del corpo ha una dimensione calcolata di almeno 16px;
 *  - ogni elemento interattivo misura almeno 24×24 CSS px oppure rispetta la
 *    spaziatura di WCAG 2.2 criterio 2.5.8 (target sotto misura ammesso solo se un
 *    cerchio di 24px centrato su di esso non si sovrappone al cerchio equivalente del
 *    target adiacente più vicino — equivalente a una distanza centro-centro ≥ 24px).
 *
 * Tutto misurato con le API del browser sul documento servito (getComputedStyle,
 * getBoundingClientRect, scrollWidth), mai dedotto da una classe letta in `site/`
 * (CLAUDE.md: «stile reso → si estraggono i computed style [...], non si assumono»).
 */

import { test, expect } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaPagina } from './guardia-esistenza';

const VIEWPORT_MOBILE = { width: 360, height: 640 };

interface ElementoDiTesto {
  tag: string;
  estratto: string;
  fontSizePx: number;
}

interface ElementoInterattivo {
  tag: string;
  estratto: string;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

test.describe('AC37: mobile 360×640 con touch', () => {
  test.use({ viewport: VIEWPORT_MOBILE, hasTouch: true });

  for (const pagina of PAGINE) {
    test(`AC37: ${pagina.nome} (${pagina.rotta}) non ha scorrimento orizzontale`, async ({ page }) => {
      await guardiaEsistenzaPagina(page, pagina.rotta);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        scrollWidth,
        `document.documentElement.scrollWidth (${scrollWidth}) non supera la larghezza della viewport, clientWidth (${clientWidth}), su ${pagina.rotta}`,
      ).toBeLessThanOrEqual(clientWidth);
    });

    test(`AC37: ${pagina.nome} (${pagina.rotta}) ha testo del corpo con dimensione calcolata >= 16px`, async ({
      page,
    }) => {
      await guardiaEsistenzaPagina(page, pagina.rotta);

      const elementiPiccoli: ElementoDiTesto[] = await page.evaluate(() => {
        function eVisibile(el: Element): boolean {
          const stile = getComputedStyle(el);
          if (stile.display === 'none' || stile.visibility === 'hidden' || parseFloat(stile.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }

        const risultato: ElementoDiTesto[] = [];
        const tutti = document.body.querySelectorAll('*');
        for (const el of Array.from(tutti)) {
          if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
          if (!eVisibile(el)) continue;

          const testoDiretto = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => (n.textContent ?? '').trim())
            .join('');
          if (testoDiretto.length === 0) continue;

          const fontSizePx = parseFloat(getComputedStyle(el).fontSize);
          if (fontSizePx < 16) {
            risultato.push({ tag: el.tagName, estratto: testoDiretto.slice(0, 60), fontSizePx });
          }
        }
        return risultato;
      });

      expect(
        elementiPiccoli,
        `elementi di testo con dimensione calcolata < 16px su ${pagina.rotta}: ${JSON.stringify(elementiPiccoli)}`,
      ).toEqual([]);
    });

    test(`AC37: ${pagina.nome} (${pagina.rotta}) ha ogni elemento interattivo >= 24×24 CSS px oppure conforme alla spaziatura WCAG 2.5.8`, async ({
      page,
    }) => {
      await guardiaEsistenzaPagina(page, pagina.rotta);

      const elementi: ElementoInterattivo[] = await page.evaluate(() => {
        function eVisibile(el: Element): boolean {
          const stile = getComputedStyle(el);
          if (stile.display === 'none' || stile.visibility === 'hidden' || parseFloat(stile.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }

        const selettore = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
        const nodi = Array.from(document.querySelectorAll(selettore)).filter(eVisibile);

        return nodi.map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            estratto: (el.textContent ?? '').trim().slice(0, 40),
            width: rect.width,
            height: rect.height,
            cx: rect.x + rect.width / 2,
            cy: rect.y + rect.height / 2,
          };
        });
      });

      const nonConformi: Array<ElementoInterattivo & { distanzaMinima: number | null }> = [];

      for (let i = 0; i < elementi.length; i++) {
        const el = elementi[i];
        const misuraOk = el.width >= 24 && el.height >= 24;
        if (misuraOk) continue;

        let distanzaMinima: number | null = null;
        for (let j = 0; j < elementi.length; j++) {
          if (i === j) continue;
          const altro = elementi[j];
          const distanza = Math.hypot(el.cx - altro.cx, el.cy - altro.cy);
          if (distanzaMinima === null || distanza < distanzaMinima) distanzaMinima = distanza;
        }

        const spaziaturaOk = distanzaMinima === null || distanzaMinima >= 24;
        if (!spaziaturaOk) {
          nonConformi.push({ ...el, distanzaMinima });
        }
      }

      expect(
        nonConformi,
        `elementi interattivi sotto 24×24px e senza spaziatura WCAG 2.5.8 (distanza centro-centro >= 24px) dal più vicino, su ${pagina.rotta}: ${JSON.stringify(nonConformi)}`,
      ).toEqual([]);
    });
  }
});
