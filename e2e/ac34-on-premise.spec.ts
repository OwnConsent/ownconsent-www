/**
 * AC34 — Contenuto delle modalità
 *
 * Data la pagina On-premise (/on-premise/), quando leggo l'HTML servito, allora:
 * - dice che il cliente installa sul proprio hardware;
 * - dice che paga una licenza annuale;
 * - dice che la registrazione della CMP presso IAB Europe la fa il cliente, a
 *   proprio nome;
 * - l'ultimo blocco del contenuto principale, prima del footer, contiene
 *   «si attiva parlando con noi» e un link mailto: all'indirizzo unico di contatto
 *   (N2) con oggetto precompilato On-premise (?subject=On-premise);
 * - nella pagina non ci sono moduli né la dicitura «in arrivo».
 *
 * Rese adottate: si veda e2e/ac33-hosted.spec.ts (stessa "resa_del_testo" per
 * "chiude con" e per l'indirizzo unico di contatto, condivisa da AC33/AC34/N1).
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { leggiDatiContatto } from './pagine';

const ROTTA = '/on-premise/';

function escapeRegExp(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('AC34: pagina On-premise', () => {
  test('AC34: /on-premise/ dice che il cliente installa sul proprio hardware', async ({ request }) => {
    const risposta = await request.get(ROTTA);
    expect(risposta.status(), `GET ${ROTTA}`).toBe(200);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(
      /install\w*[^.]{0,80}(proprio\s+hardware|propria\s+infrastruttura|propri\s+server)|(proprio\s+hardware|propria\s+infrastruttura|propri\s+server)[^.]{0,80}install\w*/i.test(
        testo,
      ),
      'il cliente installa sul proprio hardware',
    ).toBe(true);
  });

  test('AC34: /on-premise/ dice che si paga una licenza annuale', async ({ request }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(/licenza\s+annuale/i.test(testo), 'licenza annuale').toBe(true);
  });

  test('AC34: /on-premise/ dice che la registrazione della CMP presso IAB Europe la fa il cliente, a proprio nome', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(/\biab\s*europe\b/i.test(testo), 'menziona IAB Europe').toBe(true);
    expect(/\bregistr(a|azione)\w*\b/i.test(testo), 'menziona la registrazione (non "registrata/certificata/approvata", AC7)').toBe(
      true,
    );
    expect(/il\s+cliente/i.test(testo), 'è il cliente a registrare').toBe(true);
    expect(/proprio\s+nome/i.test(testo), 'a proprio nome').toBe(true);
  });

  test('AC34: l\'ultimo blocco del contenuto principale di /on-premise/, prima del footer, contiene «si attiva parlando con noi» e un mailto: con oggetto On-premise', async ({
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
      `^mailto:${escapeRegExp(indirizzo)}\\?subject=${escapeRegExp(oggetto['on-premise'] ?? 'On-premise')}$`,
      'i',
    );
    const mailtoTrovato = ultimoBlocco
      .find('a[href^="mailto:"]')
      .map((_, el) => $(el).attr('href') ?? '')
      .get()
      .some((href) => attesoMailto.test(href));
    expect(
      mailtoTrovato,
      `l'ultimo blocco contiene un link mailto:${indirizzo}?subject=${oggetto['on-premise'] ?? 'On-premise'}`,
    ).toBe(true);
  });

  test('AC34: /on-premise/ non contiene moduli né la dicitura «in arrivo»', async ({ request }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());

    expect($('form').length, 'nessun <form> nella pagina').toBe(0);
    const testo = $('body').text().replace(/\s+/g, ' ');
    expect(/in\s+arrivo/i.test(testo), 'nessuna dicitura «in arrivo»').toBe(false);
  });
});
