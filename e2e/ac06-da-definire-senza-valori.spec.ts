/**
 * AC6 — Listino senza valori: «da definire», e configurazione di prova
 *
 * Due metà (docs/spec/issue-8.json AC6; resa "segnaposto_dichiarati"; ADR-0002 D4):
 *
 * - build normale: `site/src/dati/listino.json` oggi non contiene alcun valore (DP-21).
 *   Sulle pagine che mostrano il listino, al posto di ogni valore mancante deve
 *   comparire «da definire», e l'HTML servito non deve contenere alcun importo in euro
 *   né alcun numero di richieste, GB, memoria o CPU (vale anche per la licenza
 *   On-premise, non solo per SaaS/Hosted: la resa lo rende esplicito). Questa metà usa
 *   il webServer principale di playwright.config.ts (baseURL, porta 4321).
 *
 * - build con la configurazione di prova: `e2e/fixtures/listino-di-prova.json` prende
 *   il posto di `listino.json` in una copia temporanea di `site/`+`contracts/`
 *   (ADR-0002 D4, `e2e/fixtures/copia-temporanea.ts`), costruita e servita su una porta
 *   diversa (4322). I valori di quella configurazione devono comparire nell'HTML
 *   servito dalla copia. I valori sono cifre ripetute (111111…, 222222…, 333333…):
 *   riconoscibili a colpo d'occhio come finti, non assomigliano a un prezzo plausibile.
 */

import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import * as cheerio from 'cheerio';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGINE } from './pagine';
import { costruisciCopiaConFixture, type CopiaTemporanea } from './fixtures/copia-temporanea';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PERCORSO_FIXTURE = path.join(DIR, 'fixtures', 'listino-di-prova.json');
const PORTA_COPIA = 4322;

const PAGINE_LISTINO = PAGINE.filter((pagina) => pagina.mostraPrezzi);

// Importo in euro nel testo reso: cifre seguite/precedute da simbolo € o dalla parola "eur".
const RE_IMPORTO_EURO = /(\d[\d.,]*\s*(?:€|eur\b)|(?:€|eur\b)\s*\d[\d.,]*)/i;
// Numero legato a una delle quattro unità che AC6 vieta quando non proviene dalla configurazione.
const RE_NUMERO_CON_UNITA = /\b\d[\d.,]*\s*(gb|cpu|vcpu|richieste)\b/i;

/** Rimuove tutto tranne le cifre: robusto a separatori di migliaia/decimali diversi. */
function soloCifre(testo: string): string {
  return testo.replace(/\D/g, '');
}

test.describe('AC6: listino senza valori (build normale, DP-21)', () => {
  for (const pagina of PAGINE_LISTINO) {
    test(`AC6: ${pagina.nome} (${pagina.rotta}) mostra «da definire» e nessun importo o numero non configurato`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      expect(risposta.status(), `GET ${pagina.rotta}`).toBe(200);
      const $ = cheerio.load(await risposta.text());
      const testo = $('body').text().replace(/\s+/g, ' ');
      expect(testo.length, `${pagina.rotta} ha contenuto nel body`).toBeGreaterThan(0);

      expect(/da\s+definire/i.test(testo), `«da definire» presente su ${pagina.rotta}`).toBe(true);
      expect(RE_IMPORTO_EURO.test(testo), `nessun importo in euro su ${pagina.rotta} (trovato invece un match)`).toBe(
        false,
      );
      expect(
        RE_NUMERO_CON_UNITA.test(testo),
        `nessun numero di richieste/GB/memoria/CPU su ${pagina.rotta} (trovato invece un match)`,
      ).toBe(false);
    });
  }
});

test.describe('AC6: configurazione di prova (copia temporanea, listino-di-prova.json)', () => {
  test.describe.configure({ timeout: 600_000 });

  let copia: CopiaTemporanea;
  let contestoRichieste: APIRequestContext;

  test.beforeAll(async () => {
    copia = await costruisciCopiaConFixture({
      fixture: 'listino',
      percorsoFixture: PERCORSO_FIXTURE,
      porta: PORTA_COPIA,
    });
    contestoRichieste = await pwRequest.newContext({ baseURL: copia.baseURL });
  });

  test.afterAll(async () => {
    await contestoRichieste?.dispose();
    await copia?.chiudi();
  });

  // Cifre attese per rotta: dalla configurazione di prova (e2e/fixtures/listino-di-prova.json),
  // spogliate di ogni separatore, così il confronto non assume un formato di visualizzazione.
  const CIFRE_ATTESE_PER_ROTTA: Record<string, string[]> = {
    '/saas/': [soloCifre('111111')],
    '/hosted/': [soloCifre('222222')],
    '/on-premise/': [soloCifre('333333.33')],
    '/confronto/': [soloCifre('111111'), soloCifre('222222'), soloCifre('333333.33')],
  };

  for (const pagina of PAGINE_LISTINO) {
    test(`AC6: ${pagina.nome} (${pagina.rotta}) sulla copia con fixture mostra i valori di prova`, async () => {
      const risposta = await contestoRichieste.get(pagina.rotta);
      expect(risposta.status(), `GET ${pagina.rotta} sulla copia con fixture`).toBe(200);
      const $ = cheerio.load(await risposta.text());
      const testo = $('body').text().replace(/\s+/g, ' ');
      expect(testo.length, `${pagina.rotta} ha contenuto nel body sulla copia`).toBeGreaterThan(0);

      const cifre = soloCifre(testo);
      const attese = CIFRE_ATTESE_PER_ROTTA[pagina.rotta] ?? [];
      expect(attese.length, `cifre di prova attese note per ${pagina.rotta}`).toBeGreaterThan(0);
      for (const sequenza of attese) {
        expect(cifre.includes(sequenza), `la cifra di prova ${sequenza} compare su ${pagina.rotta}`).toBe(true);
      }
    });
  }
});
