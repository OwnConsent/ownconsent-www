/**
 * L13-F02 — struttura dei titoli sulle 8 pagine servite (issue #8, lotto L14).
 *
 * NON è un criterio di accettazione: non ha un id `AC*`/`N*` e non compare in
 * docs/spec/issue-8.json. È un finding di misura di @seo (journal/2026-09-22/
 * 110044-seo-misura.json, F02, confermato dalla consegna 110214-seo-consegna.json):
 * axe-core 4.13.0 pubblica `heading-order` e `page-has-heading-one` con tag
 * `['cat.semantics', 'best-practice']`, non con un tag `wcag*`. e2e/ac40-wcag-a-aa.spec.ts
 * seleziona le regole SOLO per tag WCAG (`TAG_WCAG_A_AA`, riga 29 di quel file): le due
 * regole non vengono mai eseguite da AC40, per costruzione del filtro, non per un bug di
 * quel test. Questo file copre quel buco con un controllo indipendente da axe.
 *
 * Due proprietà, sulle 8 pagine di e2e/pagine.ts:
 * 1. esattamente un `<h1>` per pagina;
 * 2. nessun salto di livello in ordine di documento: un titolo h(n) non è mai seguito,
 *    nell'ordine in cui compaiono nell'HTML servito, da un titolo h(n+2) o di livello
 *    ancora più profondo, senza un h(n+1) intermedio. Una discesa (es. h3 -> h2) non è
 *    un salto: il vincolo riguarda solo la crescita di livello.
 *
 * Il controllo (`violazioniStrutturaTitoli`) è una funzione pura, indipendente dal DOM:
 * i due test in fondo al file la dimostrano capace di fallire — non per assunzione, ma
 * costruendo con `page.setContent` due pagine minime e malate in memoria (due `<h1>`;
 * `<h2>` seguito da `<h4>`) accanto al loro contrario sano, come richiesto dal mandato.
 */

import { test, expect, type Page } from '@playwright/test';
import { PAGINE } from './pagine';
import { guardiaEsistenzaRequest } from './guardia-esistenza';

/** Un titolo di livello n compare come tag `h${n}`: 1..6. */
type LivelloTitolo = 1 | 2 | 3 | 4 | 5 | 6;

interface SaltoLivello {
  indice: number;
  da: LivelloTitolo;
  a: LivelloTitolo;
}

/**
 * Trova i salti di livello in una sequenza di titoli presa in ordine di documento:
 * un elemento è un salto quando il suo livello supera di più di 1 quello del titolo
 * immediatamente precedente nella sequenza (h2 -> h4, non h2 -> h3 -> h4).
 */
function trovaSaltiLivello(livelli: LivelloTitolo[]): SaltoLivello[] {
  const salti: SaltoLivello[] = [];
  for (let i = 1; i < livelli.length; i++) {
    if (livelli[i] > livelli[i - 1] + 1) {
      salti.push({ indice: i, da: livelli[i - 1], a: livelli[i] });
    }
  }
  return salti;
}

/**
 * Le due proprietà di L13-F02 come messaggi di violazione (array vuoto = struttura
 * sana). Funzione pura: prende la sequenza dei livelli già estratta, non un documento.
 */
function violazioniStrutturaTitoli(livelli: LivelloTitolo[]): string[] {
  const violazioni: string[] = [];

  const numeroH1 = livelli.filter((l) => l === 1).length;
  if (numeroH1 !== 1) {
    violazioni.push(`atteso esattamente un <h1>, trovati ${numeroH1}`);
  }

  for (const salto of trovaSaltiLivello(livelli)) {
    violazioni.push(
      `salto di livello alla posizione ${salto.indice} in ordine di documento: h${salto.da} seguito da h${salto.a} senza h${salto.da + 1} intermedio`,
    );
  }

  return violazioni;
}

/** Estrae i livelli dei titoli, in ordine di documento, da un documento cheerio. */
function livelliDaCheerio($: ReturnType<typeof import('cheerio').load>): LivelloTitolo[] {
  return $('h1, h2, h3, h4, h5, h6')
    .toArray()
    .map((el) => Number(el.tagName.replace(/[^0-9]/g, '')) as LivelloTitolo);
}

/** Estrae i livelli dei titoli, in ordine di documento, dal DOM reso in `page`. */
async function livelliDaPagina(page: Page): Promise<LivelloTitolo[]> {
  const tag = await page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((el) => el.tagName.toLowerCase()),
  );
  return tag.map((t) => Number(t.replace(/[^0-9]/g, '')) as LivelloTitolo);
}

test.describe('L13-F02: un solo h1 e nessun salto di livello, sulle 8 pagine servite (finding di @seo, non un AC)', () => {
  for (const pagina of PAGINE) {
    test(`L13-F02: ${pagina.nome} (${pagina.rotta}) — un h1, nessun salto`, async ({ request }) => {
      const $ = await guardiaEsistenzaRequest(request, pagina.rotta);
      const livelli = livelliDaCheerio($);

      const violazioni = violazioniStrutturaTitoli(livelli);
      expect(
        violazioni,
        `struttura dei titoli di ${pagina.rotta} (sequenza osservata: ${livelli.map((l) => `h${l}`).join(' > ')})`,
      ).toEqual([]);
    });
  }
});

test.describe('L13-F02: il controllo sa fallire — due casi malati costruiti in memoria con page.setContent', () => {
  test('caso malato: due <h1> nella stessa pagina — il controllo lo rifiuta, il contrario sano lo accetta', async ({
    page,
  }) => {
    const htmlMalato = `<!doctype html><html><body>
      <h1>Primo titolo</h1>
      <p>Testo</p>
      <h1>Secondo titolo</h1>
    </body></html>`;
    await page.setContent(htmlMalato);
    const livelliMalati = await livelliDaPagina(page);
    expect(livelliMalati, 'estratti due h1 dal DOM costruito in memoria').toEqual([1, 1]);

    const violazioniMalato = violazioniStrutturaTitoli(livelliMalati);
    expect(violazioniMalato, 'due <h1> devono produrre una violazione, non passare in silenzio').toEqual([
      'atteso esattamente un <h1>, trovati 2',
    ]);

    // Contrario sano: stesso documento con un solo <h1> — nessuna violazione.
    const htmlSano = `<!doctype html><html><body>
      <h1>Primo titolo</h1>
      <p>Testo</p>
      <h2>Sezione</h2>
    </body></html>`;
    await page.setContent(htmlSano);
    const livelliSani = await livelliDaPagina(page);
    expect(violazioniStrutturaTitoli(livelliSani), 'un solo <h1> non deve produrre questa violazione').toEqual([]);
  });

  test('caso malato: <h2> seguito da <h4> senza <h3> intermedio — il controllo lo rifiuta, il contrario sano lo accetta', async ({
    page,
  }) => {
    const htmlMalato = `<!doctype html><html><body>
      <h1>Titolo</h1>
      <h2>Sezione</h2>
      <h4>Sottosezione saltata</h4>
    </body></html>`;
    await page.setContent(htmlMalato);
    const livelliMalati = await livelliDaPagina(page);
    expect(livelliMalati, 'estratti h1, h2, h4 dal DOM costruito in memoria').toEqual([1, 2, 4]);

    const violazioniMalato = violazioniStrutturaTitoli(livelliMalati);
    expect(violazioniMalato, 'h2 seguito da h4 deve produrre una violazione di salto').toEqual([
      'salto di livello alla posizione 2 in ordine di documento: h2 seguito da h4 senza h3 intermedio',
    ]);

    // Contrario sano: stesso documento con l'h3 intermedio — nessuna violazione. Include
    // anche una discesa (h3 -> h2) per confermare che scendere di livello non è un salto.
    const htmlSano = `<!doctype html><html><body>
      <h1>Titolo</h1>
      <h2>Sezione</h2>
      <h3>Sottosezione</h3>
      <h4>Dettaglio</h4>
      <h2>Altra sezione</h2>
    </body></html>`;
    await page.setContent(htmlSano);
    const livelliSani = await livelliDaPagina(page);
    expect(livelliSani).toEqual([1, 2, 3, 4, 2]);
    expect(violazioniStrutturaTitoli(livelliSani), 'una discesa di livello non è un salto e non deve produrre violazioni').toEqual(
      [],
    );
  });
});
