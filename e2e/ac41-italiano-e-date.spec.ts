/**
 * AC41 — Mobile, prestazioni, accessibilità, lingua
 *
 * Data ciascuna delle 8 pagine pubbliche, quando leggo i testi dell'HTML servito,
 * allora tutti i testi delle pagine sono in italiano, e ogni data è nel formato
 * gg/mm/aaaa.
 *
 * Rilevare "è scritto in italiano" per via automatica, in generale, non è
 * verificabile con gli artefatti di questo progetto (nessuna libreria di
 * rilevamento lingua è committata). Questo file verifica la parte del criterio che
 * è meccanicamente osservabile dall'HTML servito, usata come proxy diretto della
 * frase della spec:
 *   - nessun elemento marcato esplicitamente con una lingua diversa da it/it-*
 *     (un lang="en" su un frammento sarebbe testo non italiano, marcato come tale);
 *   - nessuna data in formato non gg/mm/aaaa (ISO aaaa-mm-gg, mese in inglese, o
 *     mm/dd/aaaa riconoscibile dal secondo numero > 12).
 * Il resto del criterio (assenza di parole non italiane non marcate) resta una
 * voce di gate: vedi journal.
 */

import { test, expect } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

const MESI_INGLESI =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;

test.describe('AC41: italiano e formato data', () => {
  for (const pagina of PAGINE) {
    test(`AC41: ${pagina.nome} (${pagina.rotta}) non ha elementi marcati con una lingua diversa da it`, async ({
      request,
    }) => {
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);

      const linguaEstranea = $('[lang]').filter((_, el) => {
        const lang = ($(el).attr('lang') ?? '').toLowerCase();
        return lang !== '' && lang !== 'it' && !lang.startsWith('it-');
      });

      expect(
        linguaEstranea.length,
        `nessun elemento con lang diverso da it/it-* in ${pagina.rotta}`,
      ).toBe(0);
    });

    test(`AC41: ${pagina.nome} (${pagina.rotta}) non ha date in formato ISO o con mese in inglese`, async ({
      request,
    }) => {
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);
      const testo = $('body').text();

      const dateIso = testo.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
      expect(dateIso, `nessuna data in formato aaaa-mm-gg in ${pagina.rotta}`).toEqual([]);

      const mesiInglesi = testo.match(MESI_INGLESI) ?? [];
      expect(mesiInglesi, `nessun mese in inglese in ${pagina.rotta}`).toEqual([]);
    });

    test(`AC41: ${pagina.nome} (${pagina.rotta}) — ogni data con separatore "/" è nel formato gg/mm/aaaa`, async ({
      request,
    }) => {
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);
      const testo = $('body').text();

      const dateConSlash = [...testo.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];

      for (const match of dateConSlash) {
        const [dataIntera, giornoStr, meseStr] = match;
        const giorno = Number(giornoStr);
        const mese = Number(meseStr);

        expect(
          mese,
          `in "${dataIntera}" (${pagina.rotta}) il secondo numero è un mese valido (<=12): non è mm/dd/aaaa`,
        ).toBeLessThanOrEqual(12);
        expect(
          giorno,
          `in "${dataIntera}" (${pagina.rotta}) il primo numero è un giorno valido (<=31)`,
        ).toBeLessThanOrEqual(31);
      }
    });
  }
});
