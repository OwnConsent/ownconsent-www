/**
 * AC8 — Footer con i tre link legali, risposta 200, contrassegno «bozza»
 *
 * Data ciascuna delle 8 pagine pubbliche, quando leggo il footer nell'HTML servito,
 * seguo i suoi link alle pagine legali e apro ciascuna delle tre a viewport 360×640 e
 * a 1280×800, allora: il footer contiene un link a Termini di servizio, Informativa
 * privacy e Cookie policy; ogni link porta a una risposta 200; ognuna delle tre pagine
 * legali mostra un contrassegno con la parola «bozza», visibile senza scorrere a
 * entrambe le viewport.
 *
 * Le tre rotte legali attese vengono da e2e/pagine.ts (già accettato sul ramo, prodotto
 * dal gruppo A dalla tabella `pagine_in_perimetro` della #8), non da `site/`.
 *
 * «Visibile senza scorrere» si misura con `boundingBox()` rispetto alla viewport,
 * subito dopo il caricamento e senza scroll (CLAUDE.md: si estrae, non si assume).
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE } from './pagine';

const VIEWPORT_MOBILE = { width: 360, height: 640 };
const VIEWPORT_DESKTOP = { width: 1280, height: 800 };

const PAGINE_LEGALI = PAGINE.filter((p) => p.rotta.startsWith('/legale/'));

const LINK_LEGALI_ATTESI = [
  { etichetta: /termini di servizio/i, rotta: PAGINE_LEGALI.find((p) => p.rotta.includes('termini'))!.rotta },
  { etichetta: /informativa privacy/i, rotta: PAGINE_LEGALI.find((p) => p.rotta.includes('privacy'))!.rotta },
  { etichetta: /cookie policy/i, rotta: PAGINE_LEGALI.find((p) => p.rotta.includes('cookie'))!.rotta },
];

test.describe('AC8: il footer di ogni pagina ha i tre link legali, con risposta 200', () => {
  for (const pagina of PAGINE) {
    for (const link of LINK_LEGALI_ATTESI) {
      test(`AC8: il footer di ${pagina.nome} (${pagina.rotta}) linka "${link.etichetta.source}" verso ${link.rotta}`, async ({
        request,
      }) => {
        const risposta = await request.get(pagina.rotta);
        const $ = cheerio.load(await risposta.text());
        const footer = $('footer');
        expect(footer.length, `un elemento <footer> è presente su ${pagina.rotta}`).toBeGreaterThan(0);

        const ancora = footer.find(`a[href="${link.rotta}"]`);
        expect(
          ancora.length,
          `il footer di ${pagina.rotta} ha un link con href="${link.rotta}"`,
        ).toBeGreaterThan(0);
        expect(
          ancora.first().text().trim(),
          `il testo del link a ${link.rotta} nel footer di ${pagina.rotta} nomina "${link.etichetta.source}"`,
        ).toMatch(link.etichetta);
      });
    }
  }

  for (const link of LINK_LEGALI_ATTESI) {
    test(`AC8: la rotta legale ${link.rotta} risponde 200`, async ({ request }) => {
      const risposta = await request.get(link.rotta);
      expect(risposta.status(), `risposta per ${link.rotta}`).toBe(200);
    });
  }
});

for (const viewport of [VIEWPORT_MOBILE, VIEWPORT_DESKTOP]) {
  test.describe(`AC8: contrassegno «bozza» sulle pagine legali a ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    for (const pagina of PAGINE_LEGALI) {
      test(`AC8: ${pagina.nome} (${pagina.rotta}) mostra il contrassegno «bozza» visibile senza scorrere`, async ({
        page,
      }) => {
        await page.goto(pagina.rotta);

        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY, `nessuno scroll prima della misura su ${pagina.rotta}`).toBe(0);

        const contrassegno = page.getByText(/bozza/i).first();
        await expect(
          contrassegno,
          `contrassegno «bozza» presente su ${pagina.rotta}`,
        ).toBeVisible();

        const riquadro = await contrassegno.boundingBox();
        expect(riquadro, `boundingBox leggibile per il contrassegno su ${pagina.rotta}`).not.toBeNull();

        const box = riquadro!;
        expect(
          box.y,
          `il contrassegno su ${pagina.rotta} inizia dentro la viewport (non sopra)`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          box.y + box.height,
          `il contrassegno su ${pagina.rotta} finisce dentro l'altezza della viewport (${viewport.height}px), senza scorrere`,
        ).toBeLessThanOrEqual(viewport.height);
        expect(
          box.x,
          `il contrassegno su ${pagina.rotta} inizia dentro la larghezza della viewport`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          box.x + box.width,
          `il contrassegno su ${pagina.rotta} finisce dentro la larghezza della viewport (${viewport.width}px)`,
        ).toBeLessThanOrEqual(viewport.width);
      });
    }
  });
}
