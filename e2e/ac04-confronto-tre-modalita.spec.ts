/**
 * AC4 — Contenuto delle modalità
 *
 * Data la pagina di confronto delle modalità e listino (/confronto/), quando leggo
 * l'HTML servito, allora per ciascuna fra SaaS, Hosted e On-premise la pagina indica:
 * (1) cosa riceve il cliente; (2) come paga; (3) chi registra la CMP presso IAB
 * Europe; (4) come si attiva — una sola riga della tabella, con una cella per
 * modalità, e ognuna delle tre celle dice «scrivici».
 *
 * Nota sulla resa (docs/spec/issue-8.json, rese_del_testo/AC4): il testo di (1) non
 * è prescritto dalla issue. Il test verifica solo che esista, per ciascuna
 * modalità, una sezione con contenuto non banale associata al suo nome — non una
 * formulazione specifica.
 *
 * Nota sul confine con AC7: i termini usati qui per (3) sono le forme
 * verbo/sostantivo "registra"/"registrazione" (chi esegue la registrazione della
 * CMP presso IAB Europe per conto del cliente), non le forme participiali
 * "registrata/certificata/approvata" che AC7 vieta riferite a OwnConsent come
 * prodotto. Le due cose sono fatti diversi (si veda il commento di AC7).
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';

const ROTTA = '/confronto/';
const MODALITA = ['SaaS', 'Hosted', 'On-premise'] as const;

/** true se una occorrenza di `a` e una di `b` cadono entro `finestra` caratteri. */
function vicini(testo: string, a: RegExp, b: RegExp, finestra = 150): boolean {
  const occA = [...testo.matchAll(new RegExp(a.source, a.flags.includes('g') ? a.flags : a.flags + 'g'))];
  const occB = [...testo.matchAll(new RegExp(b.source, b.flags.includes('g') ? b.flags : b.flags + 'g'))];
  for (const x of occA) {
    for (const y of occB) {
      if (Math.abs((x.index ?? 0) - (y.index ?? 0)) <= finestra) return true;
    }
  }
  return false;
}

/** Testo della sezione che segue l'intestazione con il nome esatto della modalità. */
function testoSezione($: cheerio.CheerioAPI, nomeModalita: string): string {
  const intestazione = $('h1,h2,h3,h4')
    .filter((_, el) => $(el).text().trim().toLowerCase() === nomeModalita.toLowerCase())
    .first();
  if (!intestazione.length) return '';
  let testo = '';
  let cursore = intestazione.next();
  let passi = 0;
  while (cursore.length && !/^h[1-4]$/i.test((cursore.prop('tagName') as string) ?? '') && passi < 50) {
    testo += ` ${cursore.text()}`;
    cursore = cursore.next();
    passi += 1;
  }
  return testo.replace(/\s+/g, ' ').trim();
}

test.describe('AC4: confronto delle tre modalità', () => {
  test('AC4: /confronto/ indica per ciascuna modalità cosa riceve il cliente (sezione dedicata non banale)', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    expect(risposta.status(), `GET ${ROTTA}`).toBe(200);
    const $ = cheerio.load(await risposta.text());

    for (const modalita of MODALITA) {
      const sezione = testoSezione($, modalita);
      expect(
        sezione.length,
        `esiste una sezione per "${modalita}" con contenuto (cosa riceve il cliente, testo non prescritto)`,
      ).toBeGreaterThan(30);
    }
  });

  test('AC4: /confronto/ indica come paga ciascuna modalità (SaaS canone mensile a volume, Hosted a taglia, On-premise licenza annuale)', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(vicini(testo, /\bsaas\b/i, /canone\s+mensile/i, 400), 'SaaS: canone mensile').toBe(true);
    expect(vicini(testo, /canone\s+mensile/i, /volume\s+di\s+richieste|piani?\s+(a|per)\s+volume/i, 200), 'SaaS: piani per volume di richieste').toBe(true);

    expect(vicini(testo, /\bhosted\b/i, /\bdisco\b/i, 400), 'Hosted: taglia di disco').toBe(true);
    expect(vicini(testo, /\bhosted\b/i, /\bmemoria\b/i, 400), 'Hosted: taglia di memoria').toBe(true);
    expect(vicini(testo, /\bhosted\b/i, /\bcpu\b/i, 400), 'Hosted: taglia di CPU').toBe(true);

    expect(vicini(testo, /on-premise/i, /licenza\s+annuale/i, 400), 'On-premise: licenza annuale').toBe(true);
  });

  test('AC4: /confronto/ indica chi registra la CMP presso IAB Europe per ciascuna modalità (SaaS: OwnConsent; On-premise: il cliente a proprio nome; Hosted: in definizione)', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());
    const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

    expect(
      vicini(testo, /\biab\s*europe\b/i, /\bregistr(a|azione)\w*\b/i, 200) &&
        vicini(testo, /\bregistr(a|azione)\w*\b/i, /\bownconsent\b/i, 200),
      'SaaS: OwnConsent registra la CMP presso IAB Europe',
    ).toBe(true);

    expect(
      vicini(testo, /\biab\s*europe\b/i, /\bregistr(a|azione)\w*\b/i, 200) &&
        vicini(testo, /\bregistr(a|azione)\w*\b/i, /proprio\s+nome/i, 200),
      'On-premise: il cliente registra la CMP presso IAB Europe a proprio nome',
    ).toBe(true);

    expect(
      vicini(testo, /\biab\s*europe\b/i, /in\s+definizione/i, 200),
      'Hosted: chi registra la CMP presso IAB Europe è «in definizione»',
    ).toBe(true);
  });

  test('AC4: /confronto/ ha una sola riga «come si attiva» con una cella per modalità, e ognuna delle tre celle dice «scrivici»', async ({
    request,
  }) => {
    const risposta = await request.get(ROTTA);
    const $ = cheerio.load(await risposta.text());

    const celleScrivici = $('td, th').filter((_, el) => /\bscrivici\b/i.test($(el).text()));
    expect(celleScrivici.length, 'tre celle contengono «scrivici», una per modalità').toBe(3);

    const righeUniche = new Set(
      celleScrivici
        .map((_, el) => $(el).closest('tr').get(0))
        .get()
        .filter(Boolean),
    );
    expect(righeUniche.size, 'le tre celle «scrivici» stanno nella stessa riga della tabella').toBe(1);
  });
});
