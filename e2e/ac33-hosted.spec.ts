/**
 * AC33 — Contenuto delle modalità
 *
 * Data la pagina Hosted (/hosted/), quando leggo l'HTML servito, allora:
 * - dice che l'istanza ha risorse dedicate e dati separati da quelli degli altri
 *   clienti;
 * - dice che il costo dipende dalla taglia di disco, memoria e CPU, con
 *   «da definire» per ogni valore non configurato;
 * - dice che chi registra la CMP presso IAB Europe è «in definizione»;
 * - l'ultimo blocco del contenuto principale, prima del footer, contiene
 *   «si attiva parlando con noi» e un link mailto: all'indirizzo unico di contatto
 *   (N2) con oggetto precompilato Hosted (?subject=Hosted);
 * - nella pagina non ci sono moduli né la dicitura «in arrivo».
 *
 * Rese adottate (docs/spec/issue-8.json, rese_del_testo/"AC33, AC34, N1"):
 * - «chiude con» = l'ultimo figlio diretto di <main> (il footer è comune a tutte le
 *   pagine, AC8, e non fa parte della chiusura — stessa lettura di AC1, che usa
 *   $('main') come contenuto principale);
 * - l'indirizzo di contatto si legge da site/src/dati/contatto.json a runtime
 *   (leggiDatiContatto()), non si copia nel test.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { leggiDatiContatto } from './pagine';

const ROTTA = '/hosted/';

function escapeRegExp(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('AC33: pagina Hosted', () => {
  test('AC33: /hosted/ dice che l\'istanza ha risorse dedicate e dati separati dagli altri clienti', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    expect(risposta.status(), `GET ${ROTTA}`).toBe(200);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(/risorse\s+dedicat\w*/i.test(testo), 'risorse dedicate').toBe(true);
    expect(
      /dati\s+separat\w*|separazione\s+dei\s+dati|isolat\w*\s+dagli\s+altri\s+client\w*|dati[^.]{0,40}altri\s+client\w*/i.test(
        testo,
      ),
      'dati separati da quelli degli altri clienti',
    ).toBe(true);
  });

  test('AC33: /hosted/ dice che il costo dipende dalla taglia di disco, memoria e CPU, con «da definire» per i valori non configurati', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(/\bdisco\b/i.test(testo), 'menziona il disco').toBe(true);
    expect(/\bmemoria\b/i.test(testo), 'menziona la memoria').toBe(true);
    expect(/\bcpu\b/i.test(testo), 'menziona la CPU').toBe(true);
    expect(/«?da\s+definire»?/i.test(testo), '«da definire» per i valori non configurati').toBe(true);
  });

  test('AC33: /hosted/ dice che chi registra la CMP presso IAB Europe è «in definizione»', async ({ request }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(/\biab\s*europe\b/i.test(testo), 'menziona IAB Europe').toBe(true);
    expect(/in\s+definizione/i.test(testo), '«in definizione»').toBe(true);
  });

  test('AC33: l\'ultimo blocco del contenuto principale di /hosted/, prima del footer, contiene «si attiva parlando con noi» e un mailto: con oggetto Hosted', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());

    const main = $('main');
    expect(main.length, 'la pagina ha un <main>').toBeGreaterThan(0);
    const ultimoBlocco = main.children().last();
    expect(ultimoBlocco.length, "l'ultimo blocco del contenuto principale esiste").toBeGreaterThan(0);

    const testoBlocco = ultimoBlocco.text().replace(/\s+/g, ' ');
    expect(/si\s+attiva\s+parlando\s+con\s+noi/i.test(testoBlocco), '«si attiva parlando con noi»').toBe(true);

    const { indirizzo, oggetto } = leggiDatiContatto();
    const attesoMailto = new RegExp(
      `^mailto:${escapeRegExp(indirizzo)}\\?subject=${escapeRegExp(oggetto.hosted ?? 'Hosted')}$`,
      'i',
    );
    const mailtoTrovato = ultimoBlocco
      .find('a[href^="mailto:"]')
      .map((_, el) => $(el).attr('href') ?? '')
      .get()
      .some((href) => attesoMailto.test(href));
    expect(
      mailtoTrovato,
      `l'ultimo blocco contiene un link mailto:${indirizzo}?subject=${oggetto.hosted ?? 'Hosted'}`,
    ).toBe(true);
  });

  test('AC33: /hosted/ non contiene moduli né la dicitura «in arrivo»', async ({ request }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());

    expect($('form').length, 'nessun <form> nella pagina').toBe(0);
    const testo = $('body').text().replace(/\s+/g, ' ');
    expect(/in\s+arrivo/i.test(testo), 'nessuna dicitura «in arrivo»').toBe(false);
  });
});
