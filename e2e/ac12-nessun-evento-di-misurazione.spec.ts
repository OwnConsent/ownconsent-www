/**
 * AC12 — Nessun evento di misurazione trasmesso senza consenso
 *
 * Dato lo stesso percorso di AC9, che comprende la pagina di confronto delle modalità
 * (e2e/pagine.ts → PAGINE include '/confronto/'), quando registro tutte le richieste di
 * rete partite dal browser, con URL e corpo, allora nessuna richiesta trasmette
 * l'evento `modalita_confrontata`, né nell'URL né nel corpo.
 *
 * Nota della spec (docs/spec/issue-8.json, AC12.nota): in questa consegna non si
 * emettono eventi di misurazione (DA-7). `contracts/events.json` non è toccato e non
 * serve a questo test: si verifica un'assenza, non la forma di un evento che ancora non
 * esiste.
 *
 * Il percorso è duplicato da AC9 invece che condiviso in un file di supporto — vedi
 * journal/2026-09-20/164235-qa-test-decisione.json.
 *
 * Come AC9 e AC10, ogni pagina deve rispondere 200 e mostrare un contenuto reale prima
 * che l'assenza dell'evento sia considerata verificata: senza questo, "nessuna
 * richiesta trasmette l'evento" sarebbe vera per il vuoto su una pagina che non esiste
 * ancora (L06/L04 non sono stati consegnati). L'esito atteso oggi è il fallimento sulla
 * prima pagina mancante — non su un'asserzione che oggi non verificherebbe niente.
 */

import { test, expect, type Page, type Request } from '@playwright/test';
import { PAGINE } from './pagine';

const EVENTO_VIETATO = 'modalita_confrontata';

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

test.describe(`AC12: nessuna richiesta trasmette l'evento ${EVENTO_VIETATO}`, () => {
  test(`AC12: sul percorso completo (con la pagina di confronto), nessuna richiesta porta ${EVENTO_VIETATO} in URL o corpo`, async ({
    page,
  }) => {
    const richiesteConEvento: string[] = [];
    page.on('request', (request: Request) => {
      const url = request.url();
      if (url.includes(EVENTO_VIETATO)) {
        richiesteConEvento.push(`URL ${request.method()} ${url}`);
        return;
      }
      const corpo = request.postData();
      if (corpo && corpo.includes(EVENTO_VIETATO)) {
        richiesteConEvento.push(`CORPO ${request.method()} ${url}: ${corpo}`);
      }
    });

    await eseguiPercorsoCondiviso(page);

    expect(
      richiesteConEvento,
      `nessuna richiesta trasmette ${EVENTO_VIETATO} né nell'URL né nel corpo durante il percorso completo`,
    ).toEqual([]);
  });
});
