/**
 * AC39 — Budget di laboratorio sulle pagine pubbliche
 *
 * Dato l'artefatto di build servito in locale e contracts/perf-budgets.json come si
 * trova al momento della verifica, quando misuro in laboratorio ciascuna delle 8
 * pagine pubbliche (e2e/pagine.ts → PAGINE), allora ciascuna pagina sta entro
 * pagine_pubbliche.js_iniziale_gzip_kb e pagine_pubbliche.css_gzip_kb (peso gzip
 * dell'artefatto di build) e entro pagine_pubbliche.lcp_ms_lab_mediana e
 * pagine_pubbliche.cls_lab_mediana (mediana di 5 esecuzioni di laboratorio, metodo in
 * $metodo_laboratorio_pagine_pubbliche). Le soglie si leggono dal contratto a runtime,
 * per chiave — non sono copiate qui: se il file cambia, valgono i valori del file
 * (docs/spec/issue-8.json, AC39).
 *
 * pagine_pubbliche.lcp_ms_p75 e pagine_pubbliche.cls_p75 NON si verificano: sono dati
 * di campo (RUM), inesistenti prima del lancio (DV-4, $nota_dati_di_campo del
 * contratto). Un test che li confrontasse sarebbe sbagliato per costruzione.
 *
 * Difesa contro il falso verde da 404 (gate G3 di questo lotto): le pagine di vendita
 * (L06) e le bozze legali (L04) non esistono ancora, quindi le rotte rispondono 404.
 * Su una pagina inesistente il peso di JS/CSS è zero e l'LCP è velocissimo — i budget
 * passerebbero senza aver misurato niente. Ogni test qui sotto pretende PRIMA che la
 * pagina esista (risposta 200 e un <main> con contenuto non banale) e SOLO DOPO misura
 * e confronta con i budget. Oggi falliscono sull'esistenza della pagina, non su un
 * numero: il journal (journal/2026-09-20/**) dichiara esplicitamente quali test
 * passano pieni e quali passerebbero solo per vuoto, se non ci fosse questa guardia.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE } from '../e2e/pagine';
import { leggiPerfBudgets, misuraPaginaInLaboratorio } from './misura-laboratorio';

// Il metodo di laboratorio (5 esecuzioni, ciascuna con CPU 4x e rete limitata, cariche
// una pagina intera ciascuna) è lento per costruzione: timeout generoso di tooling,
// non una soglia del contratto.
const TIMEOUT_TEST_MISURA_MS = 180_000;

test.describe('AC39: budget di laboratorio sulle pagine pubbliche', () => {
  for (const pagina of PAGINE) {
    test(`AC39: ${pagina.nome} (${pagina.rotta}) sta entro i budget di peso e di laboratorio di contracts/perf-budgets.json`, async ({
      page,
      browser,
      baseURL,
    }) => {
      test.setTimeout(TIMEOUT_TEST_MISURA_MS);
      if (!baseURL) throw new Error('baseURL mancante nella configurazione Playwright');

      // 1) La pagina esiste davvero: risposta 200 e contenuto atteso presente.
      //    Senza questa guardia un 404 misurerebbe zero byte e un LCP finto-veloce,
      //    e il budget passerebbe senza aver verificato nulla (gate G3).
      const risposta = await page.goto(pagina.rotta, { waitUntil: 'load' });
      expect(risposta?.status(), `GET ${pagina.rotta}`).toBe(200);

      const html = await page.content();
      const $ = cheerio.load(html);
      const testoMain = ($('main').text() || '').replace(/\s+/g, ' ').trim();
      expect(
        testoMain.length,
        `<main> di ${pagina.rotta} ha contenuto non banale (trovato: ${JSON.stringify(testoMain.slice(0, 80))})`,
      ).toBeGreaterThan(20);

      // 2) Solo ora si misura: 5 esecuzioni a freddo, throttling CPU/rete, LCP e CLS
      //    letti dal metodo dichiarato nel contratto.
      const soglie = leggiPerfBudgets().pagine_pubbliche;
      const misura = await misuraPaginaInLaboratorio(browser, baseURL, pagina.rotta);

      expect(
        misura.statoPrimaEsecuzione,
        `stato HTTP durante la misura di laboratorio di ${pagina.rotta}`,
      ).toBe(200);

      expect(
        misura.jsInizialeGzipKb,
        `js_iniziale_gzip_kb misurato ${misura.jsInizialeGzipKb.toFixed(2)} KB contro soglia ${soglie.js_iniziale_gzip_kb} KB (${pagina.rotta})`,
      ).toBeLessThanOrEqual(soglie.js_iniziale_gzip_kb);

      expect(
        misura.cssGzipKb,
        `css_gzip_kb misurato ${misura.cssGzipKb.toFixed(2)} KB contro soglia ${soglie.css_gzip_kb} KB (${pagina.rotta})`,
      ).toBeLessThanOrEqual(soglie.css_gzip_kb);

      expect(
        misura.lcpMsMediana,
        `lcp_ms_lab_mediana: nessun campione LCP valido su ${misura.esecuzioni} esecuzioni per ${pagina.rotta} (campioni: ${JSON.stringify(misura.lcpCampioniMs)})`,
      ).not.toBeNull();
      expect(
        misura.lcpMsMediana as number,
        `lcp_ms_lab_mediana misurato ${misura.lcpMsMediana} ms (mediana di ${misura.esecuzioni}: ${JSON.stringify(misura.lcpCampioniMs)}) contro soglia ${soglie.lcp_ms_lab_mediana} ms (${pagina.rotta})`,
      ).toBeLessThanOrEqual(soglie.lcp_ms_lab_mediana);

      expect(
        misura.clsMediana,
        `cls_lab_mediana misurato ${misura.clsMediana} (mediana di ${misura.esecuzioni}: ${JSON.stringify(misura.clsCampioni)}) contro soglia ${soglie.cls_lab_mediana} (${pagina.rotta})`,
      ).toBeLessThanOrEqual(soglie.cls_lab_mediana);
    });
  }
});
