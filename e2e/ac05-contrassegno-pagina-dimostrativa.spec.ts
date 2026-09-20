/**
 * AC5 — Contrassegno di pagina dimostrativa sui prezzi
 *
 * Dato che i prezzi non sono dichiarati definitivi (CLAUDE.md: «i prezzi non sono
 * definiti [...] ogni pagina che li mostra porta un contrassegno visibile»), quando
 * apro ciascuna delle pagine con `mostraPrezzi: true` (SaaS, Hosted, On-premise,
 * Confronto modalità e listino — e2e/pagine.ts, dalla tabella di docs/spec/issue-8.json)
 * a viewport 360×640 e a 1280×800, allora la pagina contiene un contrassegno con le
 * parole «pagina dimostrativa», visibile senza scorrere.
 *
 * «Visibile senza scorrere» si misura, non si assume (CLAUDE.md): si legge la
 * posizione dell'elemento nella viewport con `boundingBox()`, subito dopo il
 * caricamento e senza aver scrollato, non una classe CSS letta da `site/`.
 */

import { test, expect } from '@playwright/test';
import { PAGINE } from './pagine';

const VIEWPORT_MOBILE = { width: 360, height: 640 };
const VIEWPORT_DESKTOP = { width: 1280, height: 800 };

const PAGINE_CON_PREZZI = PAGINE.filter((p) => p.mostraPrezzi);

for (const viewport of [VIEWPORT_MOBILE, VIEWPORT_DESKTOP]) {
  test.describe(`AC5: contrassegno «pagina dimostrativa» a ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    for (const pagina of PAGINE_CON_PREZZI) {
      test(`AC5: ${pagina.nome} (${pagina.rotta}) mostra il contrassegno visibile senza scorrere`, async ({
        page,
      }) => {
        await page.goto(pagina.rotta);

        // Non deve essere avvenuto alcuno scroll: la misura di visibilità è valida solo
        // rispetto alla posizione di caricamento della pagina.
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY, `nessuno scroll prima della misura su ${pagina.rotta}`).toBe(0);

        const contrassegno = page.getByText(/pagina dimostrativa/i).first();
        await expect(
          contrassegno,
          `contrassegno «pagina dimostrativa» presente su ${pagina.rotta}`,
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
