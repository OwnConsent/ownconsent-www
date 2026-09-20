/**
 * N1 — Contenuto delle modalità
 *
 * Data la pagina SaaS (/saas/), quando leggo l'HTML servito, allora l'ultimo
 * blocco del contenuto principale, prima del footer, contiene «scrivici e ti
 * attiviamo noi» e un link mailto: all'indirizzo unico di contatto (N2) con
 * oggetto precompilato SaaS (?subject=SaaS); la pagina non contiene moduli, date,
 * liste d'attesa né la dicitura «in arrivo».
 *
 * Rese adottate: si veda e2e/ac33-hosted.spec.ts (stessa "resa_del_testo" per
 * "chiude con" e per l'indirizzo unico di contatto, condivisa da AC33/AC34/N1).
 */

import { test, expect } from '@playwright/test';
import { leggiDatiContatto } from './pagine';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

const ROTTA = '/saas/';

function escapeRegExp(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('N1: pagina SaaS — chiusura e mailto', () => {
  test('N1: l\'ultimo blocco del contenuto principale di /saas/, prima del footer, contiene «scrivici e ti attiviamo noi» e un mailto: con oggetto SaaS', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA);

    const main = $('main');
    expect(main.length, 'la pagina ha un <main>').toBeGreaterThan(0);
    const ultimoBlocco = main.children().last();
    expect(ultimoBlocco.length, "l'ultimo blocco del contenuto principale esiste").toBeGreaterThan(0);

    const testoBlocco = ultimoBlocco.text().replace(/\s+/g, ' ');
    expect(/scrivici\s+e\s+ti\s+attiviamo\s+noi/i.test(testoBlocco), '«scrivici e ti attiviamo noi»').toBe(true);

    const { indirizzo, oggetto } = leggiDatiContatto();
    const attesoMailto = new RegExp(
      `^mailto:${escapeRegExp(indirizzo)}\\?subject=${escapeRegExp(oggetto.saas ?? 'SaaS')}$`,
      'i',
    );
    const mailtoTrovato = ultimoBlocco
      .find('a[href^="mailto:"]')
      .map((_, el) => $(el).attr('href') ?? '')
      .get()
      .some((href) => attesoMailto.test(href));
    expect(
      mailtoTrovato,
      `l'ultimo blocco contiene un link mailto:${indirizzo}?subject=${oggetto.saas ?? 'SaaS'}`,
    ).toBe(true);
  });

  test('N1: /saas/ non contiene moduli, date, liste d\'attesa né la dicitura «in arrivo»', async ({ request }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA);

    expect($('form').length, 'nessun <form> nella pagina').toBe(0);
    expect($('input, textarea, select, button[type="submit"]').length, 'nessun controllo di modulo nella pagina').toBe(
      0,
    );

    const testo = $('body').text().replace(/\s+/g, ' ');
    expect(/in\s+arrivo/i.test(testo), 'nessuna dicitura «in arrivo»').toBe(false);
    expect(/lista\s+d['’]attesa|waitlist/i.test(testo), 'nessuna lista d\'attesa').toBe(false);
    expect(
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4}\b/i.test(
        testo,
      ),
      'nessuna data (es. di lancio o di apertura) nella pagina',
    ).toBe(false);
  });
});
