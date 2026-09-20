/**
 * AC53 — Contenuto delle modalità
 *
 * Data ciascuna delle 8 pagine pubbliche, quando leggo l'HTML servito, allora
 * nessuna pagina presenta un limite di frequenza delle richieste come
 * caratteristica di un piano, differenzia i piani per limite di frequenza o offre
 * di aumentarlo a pagamento.
 *
 * Nota: CLAUDE.md descrive il piano SaaS come fatturato "a canone mensile, piani
 * per volume di richieste" — un tetto di quantità nel tempo, non un limite di
 * frequenza (richieste al secondo/minuto). Il criterio vieta il secondo, non il
 * primo: il test cerca il vocabolario della frequenza/rate-limit, non quello del
 * volume/quota.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE } from './pagine';

const LIMITE_DI_FREQUENZA =
  /\b(limite\s+di\s+frequenza|rate[\s-]?limit\w*|richieste\s+al\s+secondo|richieste\s+al\s+minuto|frequenza\s+delle\s+richieste|throttl\w*)\b/i;

test.describe('AC53: nessun limite di frequenza delle richieste', () => {
  for (const pagina of PAGINE) {
    test(`AC53: ${pagina.nome} (${pagina.rotta}) non presenta un limite di frequenza delle richieste`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());
      const testo = $('body').text().replace(/\s+/g, ' ');

      expect(
        LIMITE_DI_FREQUENZA.test(testo),
        `nessun limite di frequenza delle richieste (caratteristica di piano, differenziatore o upsell) in ${pagina.rotta}`,
      ).toBe(false);
    });
  }
});
