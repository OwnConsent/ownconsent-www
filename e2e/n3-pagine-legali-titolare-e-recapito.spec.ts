/**
 * N3 — Prezzi, IAB, pagine legali
 *
 * Data la bozza dell'informativa privacy e le altre due pagine legali (termini di
 * servizio, cookie policy), quando leggo l'HTML servito di ciascuna, allora:
 * - l'informativa privacy identifica il titolare del trattamento con il
 *   segnaposto dichiarato dell'identità del titolare e contiene un link mailto:
 *   all'unico indirizzo di contatto (N2) senza oggetto precompilato;
 * - in nessuna delle tre pagine legali un link mailto: ha un oggetto precompilato
 *   (nessun ?subject=) e nessuna contiene un recapito diverso da quell'indirizzo.
 *
 * Resa: il testo esatto del segnaposto dell'identità del titolare non è dato
 * dalla spec (docs/spec/issue-8.json, segnaposto_dichiarati: «la comunica
 * Andrea», nessun formato prescritto). Il test verifica quindi solo che esista,
 * nell'informativa privacy, un punto che nomina il "titolare del trattamento"
 * seguito da un contenuto non banale (identificazione presente) — non una
 * formulazione o un segnaposto specifico. Questo limite è annotato anche nel
 * journal come voce di tipo `gate`.
 */

import { test, expect } from '@playwright/test';
import { leggiDatiContatto } from './pagine';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

const ROTTA_PRIVACY = '/legale/informativa-privacy/';
const ROTTE_LEGALI = [
  { nome: 'Termini di servizio (bozza)', rotta: '/legale/termini-di-servizio/' },
  { nome: 'Informativa privacy (bozza)', rotta: ROTTA_PRIVACY },
  { nome: 'Cookie policy (bozza)', rotta: '/legale/cookie-policy/' },
];

function escapeRegExp(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Testo che segue la prima occorrenza (case-insensitive) di "titolare del trattamento". */
function testoDopoTitolare(testoPagina: string): string {
  const indice = testoPagina.search(/titolare\s+del\s+trattamento/i);
  if (indice < 0) return '';
  return testoPagina.slice(indice, indice + 300);
}

test.describe('N3: pagine legali — titolare e recapito unico', () => {
  test('N3: /legale/informativa-privacy/ identifica il titolare del trattamento (segnaposto dichiarato, testo non prescritto)', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA_PRIVACY);
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    const dopo = testoDopoTitolare(testo);
    expect(dopo.length, 'la pagina nomina "titolare del trattamento" seguito da del contenuto').toBeGreaterThan(30);
  });

  test('N3: /legale/informativa-privacy/ contiene un link mailto: all\'indirizzo unico di contatto, senza oggetto precompilato', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA_PRIVACY);
    const { indirizzo } = leggiDatiContatto();

    const attesoMailtoSenzaOggetto = new RegExp(`^mailto:${escapeRegExp(indirizzo)}$`, 'i');
    const trovato = $('a[href^="mailto:"]')
      .map((_, el) => $(el).attr('href') ?? '')
      .get()
      .some((href) => attesoMailtoSenzaOggetto.test(href));

    expect(trovato, `un link mailto:${indirizzo} senza ?subject= nell'informativa privacy`).toBe(true);
  });

  for (const pagina of ROTTE_LEGALI) {
    test(`N3: ${pagina.nome} (${pagina.rotta}) — nessun mailto: con oggetto precompilato e nessun recapito diverso dall'indirizzo unico`, async ({
      request,
    }) => {
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);
      const { indirizzo } = leggiDatiContatto();

      const hrefMailto = $('a[href^="mailto:"]')
        .map((_, el) => $(el).attr('href') ?? '')
        .get();

      for (const href of hrefMailto) {
        expect(/\?subject=/i.test(href), `${href} non ha oggetto precompilato`).toBe(false);
      }

      const indirizziDiversi = hrefMailto
        .map((href) => href.replace(/^mailto:/i, '').split('?')[0])
        .filter((ind) => ind.toLowerCase() !== indirizzo.toLowerCase());
      expect(indirizziDiversi, `nessun mailto: verso un indirizzo diverso da ${indirizzo}`).toEqual([]);

      const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');
      const emailNelTesto = [...testo.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0]);
      const emailDiverse = emailNelTesto.filter((email) => email.toLowerCase() !== indirizzo.toLowerCase());
      expect(emailDiverse, `nessun indirizzo email nel testo diverso da ${indirizzo}`).toEqual([]);
    });
  }
});
