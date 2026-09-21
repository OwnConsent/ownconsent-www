/**
 * tests/perf/prova-l12-stampa-variabilita.spec.ts
 *
 * PROVA — NON MERGIARE. Spec temporaneo del lotto L12 (issue #8), unico scopo:
 * stampare nel log del job `prova-variabilita` i numeri misurati da
 * `misuraPaginaInLaboratorio` (tests/perf/misura-laboratorio.ts) per ciascuna delle 8
 * pagine di e2e/pagine.ts, senza asserzioni. Serve alla misura di variabilita' chiesta
 * da docs/adr/0003-contesto-ci.md, D3: 5 esecuzioni consecutive dello stesso SHA sul
 * runner di GitHub, per estrarre lcp_ms_lab_mediana (e di seguito cls_lab_mediana,
 * js_iniziale_gzip_kb, css_gzip_kb) da 5 log diversi con `gh run view --log | grep`.
 *
 * `tests/perf/ac39-budget-pagine-pubbliche.spec.ts` non stampa i numeri quando passa
 * (asserisce soltanto): questo spec non asserisce nulla apposta, cosi' il job non
 * diventa mai rosso per un budget superato — la domanda di questo giro e' "quanto
 * varia", non "supera la soglia". Il fallimento resta possibile solo se la misura
 * stessa non riesce a produrre un numero (throw), che va comunque nel log.
 *
 * Una riga sola per pagina, prefissata `PROVA-L12` per essere facile da isolare con
 * grep, con tutti i campioni (non solo la mediana) cosi' la variabilita' si legge
 * anche dentro una singola esecuzione.
 */

import { test } from '@playwright/test';
import { PAGINE } from '../../e2e/pagine';
import { leggiPerfBudgets, misuraPaginaInLaboratorio } from './misura-laboratorio';

const TIMEOUT_TEST_MISURA_MS = 180_000;

test.describe('PROVA L12 — stampa variabilita di laboratorio (NON MERGIARE)', () => {
  for (const pagina of PAGINE) {
    test(`PROVA-L12 stampa ${pagina.nome} (${pagina.rotta})`, async ({ browser, baseURL }) => {
      test.setTimeout(TIMEOUT_TEST_MISURA_MS);
      if (!baseURL) throw new Error('baseURL mancante nella configurazione Playwright');

      const soglie = leggiPerfBudgets().pagine_pubbliche;
      const misura = await misuraPaginaInLaboratorio(browser, baseURL, pagina.rotta);

      const riga = {
        rotta: pagina.rotta,
        stato_prima_esecuzione: misura.statoPrimaEsecuzione,
        js_iniziale_gzip_kb: Number(misura.jsInizialeGzipKb.toFixed(3)),
        css_gzip_kb: Number(misura.cssGzipKb.toFixed(3)),
        lcp_ms_lab_mediana: misura.lcpMsMediana,
        lcp_ms_campioni: misura.lcpCampioniMs,
        cls_lab_mediana: Number(misura.clsMediana.toFixed(6)),
        cls_campioni: misura.clsCampioni.map((v) => Number(v.toFixed(6))),
        soglia_lcp_ms_lab_mediana: soglie.lcp_ms_lab_mediana,
        soglia_cls_lab_mediana: soglie.cls_lab_mediana,
        soglia_js_iniziale_gzip_kb: soglie.js_iniziale_gzip_kb,
        soglia_css_gzip_kb: soglie.css_gzip_kb,
      };

      // Una riga sola, JSON compatto: `grep '^PROVA-L12 ' log | sed 's/^PROVA-L12 //' | jq .`
      // eslint-disable-next-line no-console
      console.log(`PROVA-L12 ${JSON.stringify(riga)}`);
    });
  }
});
