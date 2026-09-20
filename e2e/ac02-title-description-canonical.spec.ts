/**
 * AC2 — Resa lato server e SEO
 *
 * Data ciascuna delle 8 pagine indicizzabili, quando leggo l'HTML servito, allora:
 * l'elemento html ha l'attributo lang="it"; il title e la meta description sono non
 * vuoti e diversi da quelli di ognuna delle altre pagine; c'è un link canonical con
 * URL assoluto che punta alla pagina stessa (percorso della pagina + dominio del
 * sito configurato — il segnaposto dichiarato, DP-19, letto a runtime da
 * site/src/dati/sito.json).
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE, urlCanonicoAtteso } from './pagine';

test.describe('AC2: lang, title, description e canonical', () => {
  for (const pagina of PAGINE) {
    test(`AC2: ${pagina.nome} (${pagina.rotta}) ha html lang="it"`, async ({ request }) => {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());
      expect($('html').attr('lang'), `lang di ${pagina.rotta}`).toBe('it');
    });

    test(`AC2: ${pagina.nome} (${pagina.rotta}) ha title e meta description non vuoti`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());

      const title = $('title').first().text().trim();
      const description = $('meta[name="description"]').attr('content')?.trim() ?? '';

      expect(title.length, `title non vuoto per ${pagina.rotta}`).toBeGreaterThan(0);
      expect(
        description.length,
        `meta description non vuota per ${pagina.rotta}`,
      ).toBeGreaterThan(0);
    });

    test(`AC2: ${pagina.nome} (${pagina.rotta}) ha un canonical assoluto che punta alla pagina stessa`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());
      const canonical = $('link[rel="canonical"]').attr('href');
      const atteso = urlCanonicoAtteso(pagina);

      expect(canonical, `canonical presente per ${pagina.rotta}`).toBeTruthy();
      expect(canonical, `canonical di ${pagina.rotta} punta alla pagina stessa`).toBe(atteso);
    });
  }

  test('AC2: title e meta description sono diversi fra ognuna delle 8 pagine', async ({
    request,
  }) => {
    const titoli: string[] = [];
    const descrizioni: string[] = [];

    for (const pagina of PAGINE) {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());
      titoli.push($('title').first().text().trim());
      descrizioni.push($('meta[name="description"]').attr('content')?.trim() ?? '');
    }

    expect(new Set(titoli).size, 'nessun title duplicato fra le 8 pagine').toBe(titoli.length);
    expect(
      new Set(descrizioni).size,
      'nessuna meta description duplicata fra le 8 pagine',
    ).toBe(descrizioni.length);
  });
});
