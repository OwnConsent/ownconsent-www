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
  BASE_STILE,
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

// Pagine di prova dei casi aggiunti dopo il collaudo della #105 (restano qui, nel test).
const GRANDE = 'display:block;width:200px;height:48px;padding:0;margin:0;border:0';
const PICCOLO = 'display:block;width:20px;height:20px;padding:0;border:0';
const HTML_PICCOLO_ISOLATO =
  BASE_STILE +
  `<button type="button" style="${PICCOLO};margin:0 0 20px 0">a</button>` +
  `<button type="button" style="${GRANDE}">grande</button>`;
// Il piccolo sta a 1px dal grande: centri lontani, ma il cerchio di raggio 12 tocca l'area.
const HTML_PICCOLO_ADIACENTE_A_GRANDE =
  BASE_STILE +
  `<button type="button" style="${PICCOLO};margin:0 0 1px 0">a</button>` +
  `<button type="button" style="${GRANDE}">grande</button>`;
// Il solo "testo" del genitore e' dentro style e script; link e pulsante (20x20, line-height 24) vicini.
const HTML_GENITORE_CON_SOLO_STYLE_E_SCRIPT =
  BASE_STILE +
  '<p><style>.x{color:red}</style><script>var a = 1;</script>' +
  '<a href="#s">Si</a><button type="button" style="width:20px;height:20px;padding:0;border:0">b</button></p>';
// Due link con lo stesso testo: il primo a 1px dal pulsante grande, il secondo lontano.
const HTML_DUE_LINK_STESSO_TESTO =
  BASE_STILE +
  `<a href="#1" style="${PICCOLO};margin:0 0 1px 0">Info</a>` +
  `<button type="button" style="${GRANDE};margin-bottom:60px">grande</button>` +
  `<a href="#2" style="${PICCOLO}">Info</a>`;

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

      // Precondizioni misurate: due bersagli non in linea, entrambi sotto 24x24, centri a meno di 24px.
      expect(bersagli).toHaveLength(2);
      expect(bersagli.map((b) => b.display)).toEqual(['block', 'inline-block']);
      for (const b of bersagli) {
        expect(b.rettangoli).toHaveLength(1);
        expect(b.rettangoli[0].width).toBeLessThan(24);
        expect(b.rettangoli[0].height).toBeLessThan(24);
      }
      const [p1, p2] = bersagli.map((b) => b.rettangoli[0]);
      expect(Math.hypot(p1.cx - p2.cx, p1.cy - p2.cy)).toBeLessThan(24);

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
      // Quale riga: la seconda (quella vicina al pulsante), non la prima.
      const [riga1, riga2] = link!.rettangoli;
      expect(riga2.cy).toBeGreaterThan(riga1.cy);
      expect(nonConformi[0].cy).toBe(riga2.cy);
    });

    test('#58: Spacing rende conforme un bersaglio non in linea sotto 24px, isolato dagli altri', async ({ page }) => {
      await page.setContent(HTML_PICCOLO_ISOLATO);
      const bersagli = await raccogliBersagli(page);
      expect(bersagli).toHaveLength(2);
      const piccolo = bersagli.find((b) => b.rettangoli[0].width < 24)!;
      expect(piccolo.display).toBe('block');
      expect(piccolo.rettangoli[0].height).toBeLessThan(24);

      expect(trovaNonConformi(bersagli)).toEqual([]);
      expect(regolaCheLoPromuove(piccolo, bersagli)).toBe('Spacing');
    });

    test('#58: Spacing contro un bersaglio grande confronta il cerchio di 24px con la sua AREA, non i centri', async ({
      page,
    }) => {
      await page.setContent(HTML_PICCOLO_ADIACENTE_A_GRANDE);
      const bersagli = await raccogliBersagli(page);
      const piccolo = bersagli.find((b) => b.rettangoli[0].width < 24)!;
      const grande = bersagli.find((b) => b.rettangoli[0].width >= 24)!;
      const rp = piccolo.rettangoli[0];
      const rg = grande.rettangoli[0];

      // Precondizioni misurate: centri a PIU' di 24px, ma il cerchio di raggio 12 del piccolo
      // tocca il rettangolo del grande (spazio verticale libero dal centro < 12px).
      expect(Math.hypot(rp.cx - rg.cx, rp.cy - rg.cy)).toBeGreaterThan(24);
      expect(rg.cy - rg.height / 2 - rp.cy).toBeLessThan(12);
      expect(rg.height).toBeGreaterThanOrEqual(24);

      const nonConformi = trovaNonConformi(bersagli);
      expect(nonConformi.map((n) => n.tag)).toEqual([piccolo.tag]);
    });

    test('#58: Inline non conta il testo di style e script come testo proprio del genitore', async ({ page }) => {
      await page.setContent(HTML_GENITORE_CON_SOLO_STYLE_E_SCRIPT);
      const bersagli = await raccogliBersagli(page);
      expect(bersagli).toHaveLength(2);
      // Precondizione misurata: il genitore ha textContent non vuoto (viene da style e script)...
      expect(await page.evaluate(() => (document.querySelector('p')!.textContent ?? '').trim().length)).toBeGreaterThan(0);
      // ...ma nessun testo proprio per l'ADR (condizione b).
      for (const b of bersagli) expect(b.genitoreConTestoProprio).toBe(false);

      expect(trovaNonConformi(bersagli).map((n) => n.tag).sort()).toEqual(['A', 'BUTTON']);
    });

    test('#58: due bersagli con lo stesso testo non si confondono nel report della regola', async ({ page }) => {
      await page.setContent(HTML_DUE_LINK_STESSO_TESTO);
      const bersagli = await raccogliBersagli(page);
      const link = bersagli.filter((b) => b.tag === 'A');
      expect(link.map((b) => b.estratto)).toEqual(['Info', 'Info']);

      // Il primo e' adiacente al pulsante grande (non conforme), il secondo e' lontano (Spacing).
      expect(link.map((b) => regolaCheLoPromuove(b, bersagli))).toEqual(['nessuna', 'Spacing']);
    });
  });
});
