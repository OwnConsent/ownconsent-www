/**
 * AC9 — Nessun cookie, nessuno storage prima del consenso
 *
 * Dato un browser con profilo pulito (Playwright: ogni test parte da un BrowserContext
 * nuovo, non riusato — CLAUDE.md regola 1: "il sito della CMP rispetta la propria CMP"),
 * quando apro ciascuna pagina pubblica (e2e/pagine.ts → PAGINE, dalla tabella di
 * docs/spec/issue-8.json), scorro fino in fondo e navigo fra le pagine con i link del
 * sito, senza esprimere alcun consenso, allora nessun cookie viene impostato, e nulla
 * viene scritto in localStorage, sessionStorage, IndexedDB o Cache Storage.
 *
 * Il percorso è quello che AC9, AC10 e AC12 condividono per dichiarazione della spec
 * (AC10.dato e AC12.dato = "lo stesso percorso di AC9"); qui è duplicato invece di
 * condiviso in un file di supporto — decisione in
 * journal/2026-09-20/164235-qa-test-decisione.json.
 *
 * Ogni pagina, prima di essere considerata "aperta", deve rispondere 200 e mostrare un
 * contenuto reale (un h1 visibile, corpo non vuoto): altrimenti "nessun cookie" sarebbe
 * vera per il vuoto, su una pagina che non esiste ancora (L06/L04 non sono stati
 * consegnati). Oggi questo test è atteso fallire proprio lì, sulla prima pagina mancante
 * — non sull'asserzione di assenza di storage, che oggi non verificherebbe niente di
 * reale.
 *
 * La navigazione fra le pagine usa il link reale presente nel DOM della pagina corrente
 * (locator su `a[href="<rotta>"]`), non il nome descrittivo di PAGINE: quel nome è
 * un'etichetta di comodo per i test, non è detto coincida col testo del link nel sito
 * (site/** non si legge, CLAUDE.md).
 */

import { test, expect, type Page } from '@playwright/test';
import { PAGINE } from './pagine';

/**
 * Percorso condiviso da AC9/AC10/AC12: apre in sequenza tutte le PAGINE nello stesso
 * `page` (stesso profilo), partendo dalla prima con `goto` e raggiungendo le successive
 * cliccando il link reale verso la rotta attesa. Per ciascuna pagina verifica prima che
 * la risposta sia 200 e che ci sia un contenuto reale, poi scorre fino in fondo.
 *
 * Non esprime alcun consenso: nessun click su bottoni di accettazione/rifiuto.
 */
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

    // Contenuto reale presente: non solo una risposta 200 su una pagina vuota.
    await expect(page.locator('h1'), `un h1 visibile su ${pagina.rotta}`).toBeVisible();
    const testo = (await page.locator('body').innerText()).trim();
    expect(testo.length, `corpo della pagina non vuoto su ${pagina.rotta}`).toBeGreaterThan(0);

    // Scorro fino in fondo, senza esprimere alcun consenso.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
}

test.describe('AC9: nessun cookie, nessuno storage prima del consenso', () => {
  test('AC9: profilo pulito, tutte le pagine aperte e scorse, nessun cookie e nessuno storage scritto', async ({
    page,
    context,
  }) => {
    await eseguiPercorsoCondiviso(page);

    const cookie = await context.cookies();
    expect(cookie, 'nessun cookie impostato dopo il percorso completo, senza consenso espresso').toEqual([]);

    const storage = await page.evaluate(async () => {
      const indexedDbs =
        'indexedDB' in window && 'databases' in indexedDB ? await indexedDB.databases() : [];
      const cacheKeys = 'caches' in window ? await caches.keys() : [];
      return {
        localStorageCount: window.localStorage.length,
        sessionStorageCount: window.sessionStorage.length,
        indexedDbCount: indexedDbs.length,
        cacheStorageCount: cacheKeys.length,
      };
    });

    expect(storage.localStorageCount, 'localStorage vuoto dopo il percorso').toBe(0);
    expect(storage.sessionStorageCount, 'sessionStorage vuoto dopo il percorso').toBe(0);
    expect(storage.indexedDbCount, 'nessun database IndexedDB creato dopo il percorso').toBe(0);
    expect(storage.cacheStorageCount, 'nessuna Cache Storage creata dopo il percorso').toBe(0);
  });
});
