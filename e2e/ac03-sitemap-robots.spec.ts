/**
 * AC3 — Resa lato server e SEO
 *
 * Dato il sito avviato, quando richiedo /sitemap.xml e /robots.txt, allora la
 * sitemap elenca tutte e sole le 8 pagine indicizzabili, ciascuna con lo stesso URL
 * assoluto del suo canonical (AC2), e robots.txt non contiene regole che escludano
 * alcuna di esse.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE, urlCanonicoAtteso } from './pagine';

test.describe('AC3: sitemap e robots', () => {
  test('AC3: /sitemap.xml elenca tutte e sole le 8 pagine indicizzabili, con lo stesso URL del canonical', async ({
    request,
  }) => {
    const risposta = await request.get('/sitemap.xml');
    expect(risposta.status(), 'GET /sitemap.xml').toBe(200);

    const xml = await risposta.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const urlSitemap = $('url > loc')
      .map((_, el) => $(el).text().trim())
      .get();

    const urlAttesi = PAGINE.map((pagina) => urlCanonicoAtteso(pagina));

    expect(
      [...urlSitemap].sort(),
      'la sitemap elenca esattamente gli URL canonical delle 8 pagine, nessuno mancante e nessuno in più',
    ).toEqual([...urlAttesi].sort());

    expect(
      new Set(urlSitemap).size,
      'nessun URL duplicato nella sitemap',
    ).toBe(urlSitemap.length);
  });

  test('AC3: /robots.txt non contiene regole che escludano alcuna delle 8 pagine indicizzabili', async ({
    request,
  }) => {
    const risposta = await request.get('/robots.txt');
    expect(risposta.status(), 'GET /robots.txt').toBe(200);

    const testo = await risposta.text();
    const prefissiDisallow = testo
      .split('\n')
      .map((riga) => riga.trim())
      .filter((riga) => /^disallow:/i.test(riga))
      .map((riga) => riga.replace(/^disallow:/i, '').trim())
      .filter((prefisso) => prefisso.length > 0);

    for (const pagina of PAGINE) {
      const esclusa = prefissiDisallow.some((prefisso) => pagina.rotta.startsWith(prefisso));
      expect(
        esclusa,
        `nessuna regola Disallow di robots.txt esclude ${pagina.rotta}`,
      ).toBe(false);
    }
  });
});
