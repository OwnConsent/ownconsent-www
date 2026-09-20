/**
 * AC7 — Prezzi, IAB, pagine legali
 *
 * Data ciascuna delle 8 pagine pubbliche, quando leggo l'HTML servito, allora non
 * compare un identificativo CMP IAB, né l'affermazione che OwnConsent sia
 * registrata, certificata o approvata da IAB Europe.
 *
 * Nota: il progetto descrive OwnConsent come conforme a IAB TCF v2.2/v2.3
 * (CLAUDE.md) — una dichiarazione di conformità allo standard non è la stessa cosa
 * di un'affermazione di registrazione/certificazione/approvazione presso IAB
 * Europe, che è ciò che questo criterio vieta. Il test cerca quest'ultima, non la
 * prima.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE } from './pagine';

const IDENTIFICATIVO_CMP = /\bcmp[\s_-]?id\b\s*[:#]?\s*\d+/i;

const AFFERMAZIONE_REGISTRAZIONE_IAB = [
  /\biab\s*europe\b[^.]{0,100}\b(registrat\w*|certificat\w*|approvat\w*)\b/i,
  /\b(registrat\w*|certificat\w*|approvat\w*)\b[^.]{0,100}\biab\s*europe\b/i,
];

test.describe('AC7: nessuna registrazione IAB', () => {
  for (const pagina of PAGINE) {
    test(`AC7: ${pagina.nome} (${pagina.rotta}) non mostra un identificativo CMP IAB né un'affermazione di registrazione/certificazione/approvazione presso IAB Europe`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());
      const testo = $('body').text().replace(/\s+/g, ' ');

      expect(
        IDENTIFICATIVO_CMP.test(testo),
        `nessun identificativo CMP IAB (es. "CMP ID: 123") nel testo di ${pagina.rotta}`,
      ).toBe(false);

      const affermaRegistrazione = AFFERMAZIONE_REGISTRAZIONE_IAB.some((regex) => regex.test(testo));
      expect(
        affermaRegistrazione,
        `nessuna affermazione che OwnConsent sia registrata, certificata o approvata da IAB Europe in ${pagina.rotta}`,
      ).toBe(false);
    });
  }
});
