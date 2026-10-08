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
 * decisa da Andrea il 2026-09-22): vietata la forma di STATO — un participio o un
 * predicato che afferma un fatto compiuto oggi non vero, con la registrazione IAB
 * ancora aperta. AMMESSA la forma di RESPONSABILITA' — chi si occupa di fare la
 * registrazione (es. «la registrazione la gestiamo noi», «la CMP viene registrata da
 * noi presso IAB Europe»). Il riconoscimento sta in ac07-riconoscimento.ts, con la
 * forma scelta e i LIMITI NOTI (issue #56 e #57); la tabella di frasi che ne fissa il
 * comportamento e' in ac07-riconoscimento.spec.ts. Non allargare l'eccezione di
 * responsabilita' senza una decisione di Andrea.
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
import { violazioniAC7 } from './ac07-riconoscimento';

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
        const violazioni = violazioniAC7(testo);
        expect(
          violazioni,
          `nessun identificativo CMP IAB né affermazione di stato (registrata, certificata, approvata, ...) presso IAB Europe in ${luogo} di ${pagina.rotta}`,
        ).toEqual([]);
      }
    });
  }
});
