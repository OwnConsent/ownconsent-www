/**
 * AC4 — Contenuto delle modalità
 *
 * Data la pagina di confronto delle modalità e listino (/confronto/), quando leggo
 * l'HTML servito, allora per ciascuna fra SaaS, Hosted e On-premise la pagina indica:
 * (1) cosa riceve il cliente; (2) come paga; (3) chi registra la CMP presso IAB
 * Europe; (4) come si attiva — una sola riga della tabella, con una cella per
 * modalità, e ognuna delle tre celle dice «scrivici».
 *
 * Perché si legge la STRUTTURA e non la prosa. Il punto (4) di AC4 dice «una sola riga
 * della tabella, con una cella per modalità»: il criterio stesso dichiara che il
 * confronto è una tabella, quindi l'associazione fra un fatto e la modalità a cui
 * appartiene è quella che la tabella dichiara — riga per il fatto, colonna per la
 * modalità — non la distanza in caratteri fra due parole. Due misure hanno smentito la
 * lettura a prossimità che questo file usava prima:
 *
 * - cercare un'intestazione h1..h4 con il nome esatto della modalità pretende una resa
 *   che la pagina non ha e non deve avere: docs/spec/issue-8.json, rese_del_testo/AC4,
 *   dice che il testo di (1) «non è prescritto» e che renderne vincolante una forma
 *   particolare «sarebbe aggiungere un requisito»;
 * - `$('main').text()` incolla le celle senza separatore. Sull'HTML servito il testo
 *   contiene «...taglia di disco, memoria e CPULicenza annuale...» e
 *   «...OwnConsentIn definizione...», quindi `/\bcpu\b/i` e `/\bownconsent\b/i` non
 *   corrispondono: il test era rosso per un artefatto della propria lettura, non per un
 *   difetto del prodotto.
 *
 * Qui i tre test leggono la cella all'incrocio fra la riga del fatto e la colonna della
 * modalità (`cellaDi`). L'indice di colonna non è scritto a mano: si ricava dall'ordine
 * dei `th[scope="col"]`, così un riordino delle colonne resta visibile al test.
 *
 * Nota sul confine con AC7: i termini usati qui per (3) sono le forme
 * verbo/sostantivo "registra"/"registrazione" (chi esegue la registrazione della
 * CMP presso IAB Europe per conto del cliente), non le forme participiali
 * "registrata/certificata/approvata" che AC7 vieta riferite a OwnConsent come
 * prodotto. Le due cose sono fatti diversi (si veda il commento di AC7).
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

const ROTTA = '/confronto/';
const MODALITA = ['SaaS', 'Hosted', 'On-premise'] as const;

function normalizza(testo: string): string {
  return testo.replace(/\s+/g, ' ').trim();
}

/**
 * Testo della cella all'incrocio fra la riga `etichettaRiga` e la colonna `modalita`
 * della tabella di confronto. Se una delle quattro cose che servono manca — la
 * tabella, la colonna, la riga, la cella — il test fallisce dicendo quale.
 */
function cellaDi($: cheerio.CheerioAPI, etichettaRiga: RegExp, modalita: string): string {
  // (1) La tabella di confronto è quella che ha un th[scope="col"] per ciascuna delle
  //     tre modalità: si identifica per quello che dichiara, non per una classe CSS.
  const tabella = $('table')
    .filter((_, elemento) => {
      const colonne = $(elemento)
        .find('thead th[scope="col"]')
        .map((__, th) => normalizza($(th).text()).toLowerCase())
        .get();
      return MODALITA.every((nome) => colonne.includes(nome.toLowerCase()));
    })
    .first();
  expect(
    tabella.length,
    `su ${ROTTA} esiste una tabella con un th[scope="col"] per ciascuna di ${MODALITA.join(', ')}`,
  ).toBe(1);

  // (2) L'indice di colonna viene dall'ordine dei th[scope="col"], non da un numero
  //     scritto a mano: un riordino delle colonne non passa inosservato.
  const colonne = tabella
    .find('thead th[scope="col"]')
    .map((_, th) => normalizza($(th).text()))
    .get();
  const indice = colonne.findIndex((nome) => nome.toLowerCase() === modalita.toLowerCase());
  expect(
    indice,
    `la tabella di confronto ha una colonna «${modalita}» (colonne trovate: ${colonne.join(' | ')})`,
  ).toBeGreaterThanOrEqual(0);

  // (3) La riga è quella la cui intestazione di riga corrisponde a `etichettaRiga`.
  const etichetteRiga = tabella
    .find('tbody tr th[scope="row"]')
    .map((_, th) => normalizza($(th).text()))
    .get();
  const riga = tabella
    .find('tbody tr')
    .filter((_, tr) => etichettaRiga.test(normalizza($(tr).find('th[scope="row"]').first().text())))
    .first();
  expect(
    riga.length,
    `la tabella di confronto ha una riga con intestazione ${etichettaRiga} (righe trovate: ${etichetteRiga.join(' | ')})`,
  ).toBe(1);

  // (4) La cella è la td a quell'indice di colonna dentro quella riga.
  const celle = riga.find('td');
  expect(
    celle.length,
    `la riga ${etichettaRiga} ha una cella per la colonna «${modalita}» (indice ${indice}, celle trovate: ${celle.length})`,
  ).toBeGreaterThan(indice);

  return normalizza(celle.eq(indice).text());
}

test.describe('AC4: confronto delle tre modalità', () => {
  /*
   * L'etichetta della riga non è prescritta dalla spec: AC4 chiede che la pagina indichi
   * «cosa riceve il cliente», non come si chiami la riga che lo dice. Il test accetta la
   * famiglia /cosa\s+ricev/i (ricevi, riceve, ricevono...). È un limite noto e va
   * scritto: una riga che dicesse la stessa cosa con un'altra parola — «cosa ottieni» —
   * farebbe fallire il test senza che il criterio sia violato. Del contenuto si verifica
   * solo che esista e non sia banale, perché rese_del_testo/AC4 dichiara il testo non
   * prescritto.
   */
  test('AC4: /confronto/ indica per ciascuna modalità cosa riceve il cliente (cella non banale, testo non prescritto)', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA);

    for (const modalita of MODALITA) {
      const cella = cellaDi($, /cosa\s+ricev/i, modalita);
      expect(
        cella.length,
        `la cella «cosa riceve il cliente» di ${modalita} ha contenuto non banale (letto: «${cella}»)`,
      ).toBeGreaterThan(20);
    }
  });

  test('AC4: /confronto/ indica come paga ciascuna modalità (SaaS canone mensile a volume, Hosted a taglia, On-premise licenza annuale)', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA);

    const saas = cellaDi($, /come\s+pagh/i, 'SaaS');
    expect(saas, 'SaaS: canone mensile').toMatch(/canone\s+mensile/i);
    expect(saas, 'SaaS: piani per volume di richieste').toMatch(/volume\s+di\s+richieste/i);

    const hosted = cellaDi($, /come\s+pagh/i, 'Hosted');
    expect(hosted, 'Hosted: taglia di disco').toMatch(/disco/i);
    expect(hosted, 'Hosted: taglia di memoria').toMatch(/memoria/i);
    expect(hosted, 'Hosted: taglia di CPU').toMatch(/cpu/i);

    const onPremise = cellaDi($, /come\s+pagh/i, 'On-premise');
    expect(onPremise, 'On-premise: licenza annuale').toMatch(/licenza\s+annuale/i);
  });

  test('AC4: /confronto/ indica chi registra la CMP presso IAB Europe per ciascuna modalità (SaaS: OwnConsent; On-premise: il cliente a proprio nome; Hosted: in definizione)', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA);
    const etichetta = /chi\s+registra.*iab\s*europe/i;

    expect(cellaDi($, etichetta, 'SaaS'), 'SaaS: registra OwnConsent').toMatch(/ownconsent/i);
    expect(cellaDi($, etichetta, 'Hosted'), 'Hosted: «in definizione»').toMatch(/in\s+definizione/i);
    expect(cellaDi($, etichetta, 'On-premise'), 'On-premise: il cliente a proprio nome').toMatch(
      /proprio\s+nome/i,
    );
  });

  test('AC4: /confronto/ ha una sola riga «come si attiva» con una cella per modalità, e ognuna delle tre celle dice «scrivici»', async ({
    request,
  }) => {
    const $ = await guardiaEsistenzaRequest(request, ROTTA);

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
