/**
 * AC1 — Resa lato server e SEO
 *
 * Dato il sito costruito e avviato, quando richiedo via HTTP GET, senza eseguire
 * JavaScript, ciascuna delle 8 pagine indicizzabili, allora la risposta è 200 e
 * l'HTML servito contiene già l'h1, il testo principale della pagina e i link alle
 * pagine SaaS, Hosted e On-premise.
 *
 * Il fixture `request` di Playwright è un client HTTP puro: non esegue JavaScript e
 * non idrata nulla, quindi misura esattamente l'HTML servito dal server.
 */

import { test, expect } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

const ROTTE_MODALITA = ['/saas/', '/hosted/', '/on-premise/'];

test.describe('AC1: resa lato server', () => {
  for (const pagina of PAGINE) {
    test(`AC1: ${pagina.nome} (${pagina.rotta}) risponde 200 e l'HTML servito contiene h1, testo principale e i link a SaaS, Hosted, On-premise`, async ({
      request,
    }) => {
      // Guardia di esistenza: 200 e un h1 non vuoto. Qui coincide con parte
      // dell'asserzione vera di AC1 (che pretende esattamente questo), quindi non è
      // una duplicazione: il testo dell'h1 restituito serve al confronto sotto.
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);

      const h1 = $('h1').first().text().trim();

      const testoPagina = ($('main').text() || $('body').text()).trim();
      expect(
        testoPagina.length,
        "l'HTML servito contiene testo principale oltre al solo h1",
      ).toBeGreaterThan(h1.length);

      const hrefPresenti = $('a[href]')
        .map((_, el) => ($(el).attr('href') ?? '').split('#')[0])
        .get();

      for (const rottaModalita of ROTTE_MODALITA) {
        const presente = hrefPresenti.some(
          (href) => href === rottaModalita || href.endsWith(rottaModalita),
        );
        expect(
          presente,
          `l'HTML servito di ${pagina.rotta} contiene un link a ${rottaModalita}`,
        ).toBe(true);
      }
    });
  }
});
