/**
 * e2e/guardia-esistenza.ts
 *
 * Guardia di esistenza condivisa (L07, issue #8, richiesta di Andrea): «ogni test ha la
 * guardia di esistenza — 200, poi h1 presente e non vuoto, poi l'asserzione vera. Vale
 * anche per i criteri in forma negativa».
 *
 * Perché serve anche sui criteri in forma negativa ("non compare X"): se la rotta si
 * rompe (404, errore), "X non compare" torna vera per il vuoto — il test resterebbe
 * verde mentre il sito è rotto. La guardia costringe il test a fallire prima, su
 * un'esistenza mancante, invece di concludere qualunque cosa sull'assenza di X.
 *
 * Forma approvata da Andrea, presa da tests/perf/ac39-budget-pagine-pubbliche.spec.ts
 * (righe 45-72): due asserzioni SEPARATE, non una condizione composta. Se una fallisce,
 * il messaggio dice quale delle due è saltata, senza dover aprire il codice del test. Il
 * messaggio dell'h1 distingue esplicitamente «nessun h1 nell'HTML servito» (l'elemento
 * non c'è) da «h1 presente ma vuoto» (c'è ma senza testo): due difetti diversi.
 *
 * Due modi di recuperare la pagina, perché i test del progetto usano entrambi:
 * - guardiaEsistenzaRequest: fixture `request` di Playwright (client HTTP puro, nessun
 *   JavaScript eseguito) + cheerio — usato dalla maggioranza dei file;
 * - guardiaEsistenzaPagina: fixture `page` di Playwright (browser reale), per i test che
 *   devono continuare a misurare nel DOM renderizzato (viewport, computed style, axe,
 *   focus...) — AC37, e già in uso (non da questo file) in AC40, D6, AC9/AC10/AC12.
 *
 * Entrambe leggono l'HTML SERVITO (risposta HTTP / page.content() prima di qualunque
 * assunzione sull'idratazione), coerente con CLAUDE.md: «il contenuto deve essere
 * nell'HTML servito, non comparire dopo l'idratazione».
 */

import { expect, type APIRequestContext, type Page } from '@playwright/test';
import * as cheerio from 'cheerio';

/** Motivo per cui l'h1 non supera la guardia: l'elemento non c'è, oppure c'è ma è vuoto. */
function motivoAssenzaH1(numeroElementiH1: number): string {
  return numeroElementiH1 === 0 ? "nessun h1 nell'HTML servito" : 'h1 presente ma vuoto';
}

/**
 * GET di `rotta` con la fixture `request`: asserisce 200, poi un h1 presente e non
 * vuoto nell'HTML servito — due asserzioni separate. Restituisce il documento cheerio
 * già caricato, perché il chiamante prosegua con le proprie asserzioni vere senza
 * rifare il parsing.
 */
export async function guardiaEsistenzaRequest(
  request: APIRequestContext,
  rotta: string,
): Promise<cheerio.CheerioAPI> {
  const risposta = await request.get(rotta);
  expect(risposta.status(), `GET ${rotta}`).toBe(200);

  const $ = cheerio.load(await risposta.text());
  const h1 = $('h1').first();
  const testoH1 = (h1.text() || '').replace(/\s+/g, ' ').trim();
  expect(testoH1.length, `<h1> di ${rotta}: ${motivoAssenzaH1(h1.length)}`).toBeGreaterThan(0);

  return $;
}

/**
 * Naviga a `rotta` con la fixture `page`: asserisce 200, poi un h1 presente e non vuoto
 * nell'HTML servito (letto da `page.content()` subito dopo la navigazione, non dal DOM
 * dopo un'eventuale idratazione). Non restituisce nulla: il chiamante continua a operare
 * su `page` per le proprie misure.
 */
export async function guardiaEsistenzaPagina(page: Page, rotta: string): Promise<void> {
  const risposta = await page.goto(rotta);
  expect(risposta?.status(), `GET ${rotta}`).toBe(200);

  const html = await page.content();
  const $ = cheerio.load(html);
  const h1 = $('h1').first();
  const testoH1 = (h1.text() || '').replace(/\s+/g, ' ').trim();
  expect(testoH1.length, `<h1> di ${rotta}: ${motivoAssenzaH1(h1.length)}`).toBeGreaterThan(0);
}
