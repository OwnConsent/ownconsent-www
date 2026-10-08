/**
 * AC37 — Mobile 360×640 con touch: niente scroll orizzontale, testo leggibile, target
 * tattili adeguati
 *
 * Data una viewport di 360×640 CSS px con emulazione touch, quando apro ciascuna delle
 * 8 pagine pubbliche, allora:
 *  - non c'è scorrimento orizzontale (la larghezza di scorrimento del documento non
 *    supera la larghezza della viewport);
 *  - il testo del corpo ha una dimensione calcolata di almeno 16px;
 *  - ogni elemento interattivo misura almeno 24×24 CSS px, oppure è in linea nel testo
 *    (eccezione Inline, definizione operativa di ADR-0005), oppure rispetta la
 *    spaziatura di WCAG 2.2 criterio 2.5.8 (target sotto misura ammesso solo se un
 *    cerchio di 24px centrato su di esso non si sovrappone al cerchio equivalente del
 *    target adiacente più vicino — equivalente a una distanza centro-centro ≥ 24px).
 *    La misura è per rettangolo di getClientRects(), mai sull'unione di
 *    getBoundingClientRect(). Nessun'altra eccezione è concessa dal test (issue #58).
 *
 * Tutto misurato con le API del browser sul documento servito (getComputedStyle,
 * getClientRects, scrollWidth), mai dedotto da una classe letta in `site/`
 * (CLAUDE.md: «stile reso → si estraggono i computed style [...], non si assumono»).
 */

import { test, expect } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaPagina } from './guardia-esistenza';
import {
  raccogliBersagli,
  trovaNonConformi,
  regolaCheLoPromuove,
  HTML_DUE_LINK_IN_LINEA,
  HTML_BLOCCHI_PICCOLI,
  HTML_LINK_A_CAPO_FUORI_DA_INLINE,
} from './misura-target-tattili';

const VIEWPORT_MOBILE = { width: 360, height: 640 };

interface ElementoDiTesto {
  tag: string;
  estratto: string;
  fontSizePx: number;
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

      const bersagli = await raccogliBersagli(page);
      const nonConformi = trovaNonConformi(bersagli);

      expect(
        nonConformi,
        `rettangoli di elementi interattivi sotto 24×24px, né in linea (ADR-0005) né con spaziatura WCAG 2.5.8 (distanza centro-centro >= 24px), su ${pagina.rotta}: ${JSON.stringify(nonConformi)}`,
      ).toEqual([]);
    });
  }

  test.describe('AC37: regressione #58 (pagine di prova costruite dal test)', () => {
    test('#58: due link in linea nella stessa frase, alti < 24px e a centri < 24px, sono conformi per Inline', async ({
      page,
    }) => {
      await page.setContent(HTML_DUE_LINK_IN_LINEA);
      const bersagli = await raccogliBersagli(page);

      // Precondizioni del caso, misurate: se non valgono, il caso non prova quello che dice.
      expect(bersagli).toHaveLength(2);
      for (const b of bersagli) expect(b.rettangoli.every((r) => r.height < 24)).toBe(true);
      const [r1, r2] = bersagli.map((b) => b.rettangoli[0]);
      expect(Math.hypot(r1.cx - r2.cx, r1.cy - r2.cy)).toBeLessThan(24);

      expect(trovaNonConformi(bersagli)).toEqual([]);
      expect(bersagli.map((b) => regolaCheLoPromuove(b, bersagli))).toEqual(['Inline', 'Inline']);
    });

    test('#58: bersagli non in linea sotto 24×24 e senza spaziatura restano non conformi', async ({ page }) => {
      await page.setContent(HTML_BLOCCHI_PICCOLI);
      const bersagli = await raccogliBersagli(page);

      expect(bersagli).toHaveLength(2);
      expect(bersagli.map((b) => b.display)).toEqual(['block', 'inline-block']);

      const nonConformi = trovaNonConformi(bersagli);
      expect(nonConformi.map((n) => n.tag).sort()).toEqual(['A', 'BUTTON']);
    });

    test("#58: un link a capo fuori dalle condizioni Inline si misura per riga, non sull'unione", async ({
      page,
    }) => {
      await page.setContent(HTML_LINK_A_CAPO_FUORI_DA_INLINE);
      const bersagli = await raccogliBersagli(page);
      const link = bersagli.find((b) => b.tag === 'A');
      expect(link, 'il link di prova esiste').toBeDefined();

      // Precondizioni misurate: due righe da meno di 24px la cui unione supera 24px.
      expect(link!.rettangoli).toHaveLength(2);
      expect(link!.rettangoli.every((r) => r.height < 24)).toBe(true);
      const unioneAltezza =
        Math.max(...link!.rettangoli.map((r) => r.cy + r.height / 2)) -
        Math.min(...link!.rettangoli.map((r) => r.cy - r.height / 2));
      expect(unioneAltezza).toBeGreaterThanOrEqual(24);
      // Fuori da Inline perche' il genitore non ha testo proprio (ADR, condizione b).
      expect(link!.genitoreConTestoProprio).toBe(false);

      const nonConformi = trovaNonConformi(bersagli);
      expect(nonConformi.filter((n) => n.tag === 'A')).toHaveLength(1);
      expect(nonConformi.every((n) => n.tag === 'A' && n.height < 24)).toBe(true);
    });
  });
});
