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
 *
 * Interpretazione di AC7 (docs/spec/issue-8.json, AC7, campo «interpretazione»,
 * decisa da Andrea il 2026-09-22): vietata la forma di STATO — un participio
 * passato («registrata», «certificata», «approvata») che afferma un fatto compiuto
 * oggi non vero, con la registrazione IAB ancora aperta. AMMESSA la forma di
 * RESPONSABILITÀ — chi si occupa di fare la registrazione (es. «la registrazione
 * la gestiamo noi», «chi registra la CMP presso IAB Europe»). Le due regex sotto
 * cercano solo la prima forma; non toccarle per far quadrare la seconda.
 *
 * Estensione L14 (punto 5 del mandato, issue #8): il test originale leggeva solo
 * $('body').text() — un punto cieco reale, non ipotetico: L13-F03
 * (journal/2026-09-22/110214-seo-consegna.json) ha trovato la violazione proprio
 * nella meta description di /saas/, mai nel body. Ora si verificano, per ciascuna
 * pagina: <title>, il content di OGNI <meta> in head che ha un attributo content
 * (un <meta charset> non ce l'ha ed è escluso correttamente), e il testo del body
 * — tre punti distinti, con il nome del punto nel messaggio di fallimento.
 *
 * Prova-by-reversion (fatta a mano da @qa-test, non eseguibile qui — vedi
 * docs/evidenza/8/l14/qa-test/): sostituendo site/src/pages/saas.astro con la
 * versione di 1ae5db2 (meta description «CMP registrata da OwnConsent presso IAB
 * Europe»), il test deve fallire SOLO su /saas/, punto meta[description].
 * Riferimento: docs/evidenza/8/l14/misura-f03-prima.txt, dove la stessa frase è
 * l'unica occorrenza trovata su tutte e 8 le pagine prima della correzione.
 */

import { test, expect } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

const IDENTIFICATIVO_CMP = /\bcmp[\s_-]?id\b\s*[:#]?\s*\d+/i;

const AFFERMAZIONE_REGISTRAZIONE_IAB = [
  /\biab\s*europe\b[^.]{0,100}\b(registrat\w*|certificat\w*|approvat\w*)\b/i,
  /\b(registrat\w*|certificat\w*|approvat\w*)\b[^.]{0,100}\biab\s*europe\b/i,
];

test.describe('AC7: nessuna registrazione IAB', () => {
  for (const pagina of PAGINE) {
    test(`AC7: ${pagina.nome} (${pagina.rotta}) — title, ogni meta di head e il body non mostrano un identificativo CMP IAB né un'affermazione di registrazione/certificazione/approvazione presso IAB Europe`, async ({
      request,
    }) => {
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);

      const puntiDaVerificare: Array<{ luogo: string; testo: string }> = [];

      const titolo = ($('title').first().text() || '').trim();
      puntiDaVerificare.push({ luogo: 'title', testo: titolo });

      $('head meta').each((_, elemento) => {
        const content = $(elemento).attr('content');
        if (content === undefined) return; // es. <meta charset>: nessun attributo content
        const nome =
          $(elemento).attr('name') ?? $(elemento).attr('property') ?? $(elemento).attr('http-equiv') ?? '(senza nome)';
        puntiDaVerificare.push({ luogo: `meta[${nome}]`, testo: content });
      });

      puntiDaVerificare.push({ luogo: 'body', testo: $('body').text().replace(/\s+/g, ' ') });

      for (const { luogo, testo } of puntiDaVerificare) {
        expect(
          IDENTIFICATIVO_CMP.test(testo),
          `nessun identificativo CMP IAB (es. "CMP ID: 123") in ${luogo} di ${pagina.rotta}`,
        ).toBe(false);

        const affermaRegistrazione = AFFERMAZIONE_REGISTRAZIONE_IAB.some((regex) => regex.test(testo));
        expect(
          affermaRegistrazione,
          `nessuna affermazione che OwnConsent sia registrata, certificata o approvata da IAB Europe in ${luogo} di ${pagina.rotta}`,
        ).toBe(false);
      }
    });
  }
});
