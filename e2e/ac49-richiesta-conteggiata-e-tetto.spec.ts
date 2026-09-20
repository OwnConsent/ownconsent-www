/**
 * AC49 — Contenuto delle modalità
 *
 * Data la pagina SaaS e la pagina di confronto delle modalità e listino, quando
 * leggo l'HTML servito di ciascuna delle due, allora ciascuna spiega che: una
 * richiesta conteggiata è una scrittura di consenso, cioè la creazione o
 * l'aggiornamento di una scelta registrata; i caricamenti del banner, le letture
 * della configurazione e le risposte dalla cache non si contano; superare il
 * tetto non interrompe il servizio; non ci sono addebiti automatici per
 * l'eccedenza; il cliente viene avvisato prima che raggiunga il tetto; se il
 * superamento si ripete, al cliente viene proposto un cambio di piano, deciso da
 * una persona.
 *
 * In nessuna delle 8 pagine pubbliche compare una percentuale o una soglia di
 * avviso, né il contatto oltre il 120%.
 *
 * Resa adottata (docs/spec/issue-8.json, rese_del_testo/AC49, confermata da
 * Andrea): il divieto è su percentuali/soglie riferite ad avvisi, consumo o
 * tetto, e sul 120% letterale — il simbolo % di per sé è ammesso (es. «riduce del
 * 40% il tempo di configurazione»). Il test cerca una percentuale VICINA a
 * "avviso/soglia/consumo/tetto", non ogni percentuale.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';
import { PAGINE } from './pagine';

const ROTTE_DA_SPIEGARE = ['/saas/', '/confronto/'];

/** true se una occorrenza di `a` e una di `b` cadono entro `finestra` caratteri. */
function vicini(testo: string, a: RegExp, b: RegExp, finestra = 200): boolean {
  const occA = [...testo.matchAll(new RegExp(a.source, 'gi'))];
  const occB = [...testo.matchAll(new RegExp(b.source, 'gi'))];
  for (const x of occA) {
    for (const y of occB) {
      if (Math.abs((x.index ?? 0) - (y.index ?? 0)) <= finestra) return true;
    }
  }
  return false;
}

test.describe('AC49: richiesta conteggiata, cosa non si conta, comportamento sul tetto', () => {
  for (const rotta of ROTTE_DA_SPIEGARE) {
    test(`AC49: ${rotta} spiega cos'è una richiesta conteggiata (scrittura di consenso: creazione o aggiornamento di una scelta registrata)`, async ({
      request,
    }) => {
      const risposta = await request.get(rotta);
      expect(risposta.status(), `GET ${rotta}`).toBe(200);
      const $ = cheerio.load(await risposta.text());
      const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

      expect(/scrittura\s+di\s+consenso/i.test(testo), '«scrittura di consenso»').toBe(true);
      expect(
        vicini(testo, /creazion\w*|creare|crea\b/i, /scelta\s+registrat\w*|aggiornamento\s+di\s+una\s+scelta|aggiornare\s+una\s+scelta/i, 120),
        'creazione o aggiornamento di una scelta registrata',
      ).toBe(true);
    });

    test(`AC49: ${rotta} spiega che caricamenti del banner, letture della configurazione e risposte dalla cache non si contano`, async ({
      request,
    }) => {
      const risposta = await request.get(rotta);
      const $ = cheerio.load(await risposta.text());
      const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

      const nonSiConta = /non\s+(si\s+)?contan?o|non\s+vengono\s+conteggiat\w*|non\s+incidono\s+sul\s+conteggio/i;

      expect(vicini(testo, /banner/i, nonSiConta, 150), 'i caricamenti del banner non si contano').toBe(true);
      expect(
        vicini(testo, /lettur\w*\s+(della\s+)?configurazione|configurazione[^.]{0,30}lettur\w*/i, nonSiConta, 150),
        'le letture della configurazione non si contano',
      ).toBe(true);
      expect(vicini(testo, /\bcache\b/i, nonSiConta, 150), 'le risposte dalla cache non si contano').toBe(true);
    });

    test(`AC49: ${rotta} spiega che superare il tetto non interrompe il servizio e non ci sono addebiti automatici per l'eccedenza`, async ({
      request,
    }) => {
      const risposta = await request.get(rotta);
      const $ = cheerio.load(await risposta.text());
      const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

      expect(
        vicini(testo, /super(are|amento|a)\w*[^.]{0,20}tetto|tetto[^.]{0,20}super(are|amento|a)\w*/i, /non\s+interrompe/i, 150),
        'superare il tetto non interrompe il servizio',
      ).toBe(true);
      expect(
        /nessun\s+addebit\w*\s+automatic\w*|non\s+ci\s+sono\s+addebit\w*\s+automatic\w*|non[^.]{0,30}addebit\w*\s+automatic\w*/i.test(
          testo,
        ),
        'non ci sono addebiti automatici per l\'eccedenza',
      ).toBe(true);
    });

    test(`AC49: ${rotta} spiega che il cliente viene avvisato prima di raggiungere il tetto, e che un superamento ripetuto porta a un cambio di piano deciso da una persona`, async ({
      request,
    }) => {
      const risposta = await request.get(rotta);
      const $ = cheerio.load(await risposta.text());
      const testo = ($('main').text() || $('body').text()).replace(/\s+/g, ' ');

      expect(
        vicini(testo, /avvis\w*/i, /tetto/i, 200) && vicini(testo, /avvis\w*/i, /prima/i, 100),
        'il cliente viene avvisato prima di raggiungere il tetto',
      ).toBe(true);

      expect(
        vicini(testo, /cambio\s+di\s+piano/i, /persona|operatore|umano/i, 150),
        'un cambio di piano è deciso da una persona',
      ).toBe(true);
      expect(
        /ripet\w*|di\s+nuovo|più\s+volte|reiterat\w*/i.test(testo),
        'il cambio di piano è legato a un superamento che si ripete, non al primo',
      ).toBe(true);
    });
  }

  for (const pagina of PAGINE) {
    test(`AC49: ${pagina.nome} (${pagina.rotta}) non mostra percentuali o soglie riferite ad avvisi/consumo/tetto, né il 120%`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      const $ = cheerio.load(await risposta.text());
      const testo = $('body').text().replace(/\s+/g, ' ');

      expect(/120\s?%/.test(testo), 'nessun «120%» nel testo').toBe(false);

      const percentuale = /\d{1,3}(?:[.,]\d+)?\s?%/g;
      const sogliaOAvviso = /soglia|avviso|avvisat\w*|consumo|tetto/i;
      expect(
        vicini(testo, percentuale, sogliaOAvviso, 60),
        'nessuna percentuale/soglia riferita ad avvisi, consumo o tetto (il simbolo % da solo, es. "riduce del 40%", è ammesso)',
      ).toBe(false);
    });
  }
});
