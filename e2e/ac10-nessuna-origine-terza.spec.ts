/**
 * AC10 — Nessuna richiesta verso un'origine diversa da quella del sito
 *
 * Dato lo stesso percorso di AC9 (profilo pulito, apertura di ciascuna pagina pubblica,
 * scorrimento fino in fondo, navigazione fra le pagine coi link del sito, senza
 * esprimere alcun consenso — docs/spec/issue-8.json, AC10.dato), quando registro tutte
 * le richieste di rete partite dal browser, allora nessuna richiesta parte verso
 * origini diverse da quelle di OwnConsent: nessun font, CDN, pixel o video incorporato.
 *
 * `resa_del_testo` di AC10: nella verifica, l'origine ammessa è quella che serve il
 * sito, cioè il `baseURL` di playwright.config.ts — prima della pubblicazione non
 * esiste un'altra origine di OwnConsent. Qui non è ricopiato come stringa: si usa il
 * fixture built-in `baseURL` di Playwright, che legge lo stesso valore dal config, per
 * non tenere una seconda fonte di verità (marcatura `ristretto` sulla issue).
 *
 * Il percorso è duplicato da AC9 invece che condiviso in un file di supporto — vedi
 * journal/2026-09-20/164235-qa-test-decisione.json.
 *
 * Come AC9, ogni pagina deve rispondere 200 e mostrare un contenuto reale prima che
 * l'assenza di richieste di terze parti sia considerata verificata: senza questo,
 * "nessuna richiesta verso terzi" sarebbe vera per il vuoto su una pagina che non
 * esiste ancora (L06/L04 non sono stati consegnati). L'esito atteso oggi è il
 * fallimento sulla prima pagina mancante.
 */

import { test, expect, type Page, type Request } from '@playwright/test';
import { PAGINE } from './pagine';

async function eseguiPercorsoCondiviso(page: Page): Promise<void> {
  for (let i = 0; i < PAGINE.length; i++) {
    const pagina = PAGINE[i];

    if (i === 0) {
      const risposta = await page.goto(pagina.rotta);
      expect(risposta, `risposta ricevuta per ${pagina.rotta}`).not.toBeNull();
      expect(risposta!.status(), `risposta 200 su ${pagina.rotta}`).toBe(200);
    } else {
      const precedente = PAGINE[i - 1];
      const link = page.locator(`a[href="${pagina.rotta}"]`).first();
      await expect(
        link,
        `un link verso ${pagina.rotta} è presente su ${precedente.rotta}, per navigare coi link del sito`,
      ).toBeVisible();

      const [risposta] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().resourceType() === 'document' && r.url().endsWith(pagina.rotta),
        ),
        link.click(),
      ]);
      expect(risposta.status(), `risposta 200 su ${pagina.rotta} (raggiunta da ${precedente.rotta})`).toBe(
        200,
      );
    }

    await expect(page.locator('h1'), `un h1 visibile su ${pagina.rotta}`).toBeVisible();
    const testo = (await page.locator('body').innerText()).trim();
    expect(testo.length, `corpo della pagina non vuoto su ${pagina.rotta}`).toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
}

test.describe('AC10: nessuna richiesta verso un\'origine diversa da quella del sito', () => {
  test('AC10: sul percorso completo, ogni richiesta di rete resta sull\'origine che serve il sito', async ({
    page,
    baseURL,
  }) => {
    expect(baseURL, 'baseURL configurato in playwright.config.ts').toBeTruthy();
    const origineAmmessa = new URL(baseURL!).origin;

    const richiesteAltraOrigine: string[] = [];
    page.on('request', (request: Request) => {
      const url = request.url();
      // Solo richieste di rete reali: data:/blob:/about: non partono verso un'altra
      // origine, non sono ciò che l'AC vuole escludere (font, CDN, pixel, video).
      if (!/^https?:\/\//i.test(url)) return;

      const origine = new URL(url).origin;
      if (origine !== origineAmmessa) {
        richiesteAltraOrigine.push(`${request.method()} ${url}`);
      }
    });

    await eseguiPercorsoCondiviso(page);

    expect(
      richiesteAltraOrigine,
      `nessuna richiesta verso un'origine diversa da ${origineAmmessa} durante il percorso completo`,
    ).toEqual([]);
  });
});
