/**
 * N2 — Indirizzo di contatto: unico e sostituibile
 *
 * Tre momenti (docs/spec/issue-8.json N2; resa N2; ADR-0002 D3/D4):
 *
 * 1. prima della modifica: l'indirizzo di `site/src/dati/contatto.json` (D3) compare in
 *    un solo file sorgente di `site/`. La ricerca è SOLO una ricerca di stringa
 *    (`grep -rl -F`, conta i file, non ne stampa le righe): è l'unica lettura di
 *    `site/` che N2 autorizza. Sulla build normale (webServer principale, porta 4321),
 *    ogni link di contatto sulle pagine SaaS/Hosted/On-premise è un mailto: con
 *    l'oggetto di modalità (?subject=SaaS|Hosted|On-premise), e sulle pagine legali è
 *    un mailto: senza oggetto precompilato (DP-29).
 *
 * 2. si sostituisce l'indirizzo con `e2e/fixtures/contatto-di-prova.json` in una copia
 *    temporanea di `site/`+`contracts/` (ADR-0002 D4, `e2e/fixtures/copia-temporanea.ts`),
 *    costruita e servita su una porta ottenuta dal sistema operativo (mai scritta a
 *    mano qui: si usa `copia.baseURL`): mai una modifica sul posto.
 *
 * 3. dopo: sulla copia, il nuovo indirizzo compare in ogni link di contatto con il
 *    proprio oggetto dove previsto, e il vecchio indirizzo non compare in nessun HTML
 *    servito dalla copia.
 */

import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import * as cheerio from 'cheerio';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGINE, leggiDatiContatto, type DatiContatto } from './pagine';
import { costruisciCopiaConFixture, type CopiaTemporanea } from './fixtures/copia-temporanea';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RADICE_REPO = path.resolve(DIR, '..');
const PERCORSO_FIXTURE = path.join(DIR, 'fixtures', 'contatto-di-prova.json');

// N2.allora nomina esplicitamente solo queste due famiglie di pagine: le tre di
// modalità (con oggetto di modalità) e le tre legali (senza oggetto). Home e Confronto
// non sono nominate: il test non assume che abbiano un link mailto:, per non dedurre
// dal codice di site/ ciò che la spec non dichiara.
const ROTTA_MODALITA: Record<string, string> = {
  '/saas/': 'saas',
  '/hosted/': 'hosted',
  '/on-premise/': 'on-premise',
};
const PAGINE_DA_VERIFICARE = PAGINE.filter(
  (pagina) => ROTTA_MODALITA[pagina.rotta] !== undefined || pagina.rotta.startsWith('/legale/'),
);

function escapeRegExp(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function regexMailtoAtteso(indirizzo: string, oggetto: string | undefined): RegExp {
  return oggetto
    ? new RegExp(`^mailto:${escapeRegExp(indirizzo)}\\?subject=${escapeRegExp(oggetto)}$`, 'i')
    : new RegExp(`^mailto:${escapeRegExp(indirizzo)}$`, 'i');
}

function linkMailtoDi($: cheerio.CheerioAPI): string[] {
  return $('a[href^="mailto:"]')
    .map((_, elemento) => $(elemento).attr('href') ?? '')
    .get();
}

test.describe('N2: prima della modifica — indirizzo unico e link mailto: della build normale', () => {
  test("N2: l'indirizzo di contatto compare in un solo file sorgente di site/", () => {
    const { indirizzo } = leggiDatiContatto();
    // Solo conteggio dei file: -l elenca i nomi, mai il contenuto delle righe trovate.
    const output = execFileSync(
      'grep',
      [
        '-rl',
        '--exclude-dir=node_modules',
        '--exclude-dir=dist',
        '--exclude-dir=.astro',
        '-F',
        indirizzo,
        path.join(RADICE_REPO, 'site'),
      ],
      { encoding: 'utf-8' },
    ).trim();
    const file = output.length ? output.split('\n') : [];
    expect(file.length, `l'indirizzo compare in un solo file sorgente di site/ (trovati: ${file.join(', ') || 'nessuno'})`).toBe(
      1,
    );
    expect(file[0], "il file è site/src/dati/contatto.json (ADR-0002 D3, resa di N2)").toBe(
      path.join(RADICE_REPO, 'site', 'src', 'dati', 'contatto.json'),
    );
  });

  for (const pagina of PAGINE_DA_VERIFICARE) {
    test(`N2: ${pagina.nome} (${pagina.rotta}) ha link mailto: all'indirizzo unico, con l'oggetto atteso`, async ({
      request,
    }) => {
      const risposta = await request.get(pagina.rotta);
      expect(risposta.status(), `GET ${pagina.rotta}`).toBe(200);
      const $ = cheerio.load(await risposta.text());
      const { indirizzo, oggetto }: DatiContatto = leggiDatiContatto();

      const link = linkMailtoDi($);
      expect(link.length, `almeno un link mailto: su ${pagina.rotta}`).toBeGreaterThan(0);

      const chiaveModalita = ROTTA_MODALITA[pagina.rotta];
      const atteso = regexMailtoAtteso(indirizzo, chiaveModalita ? oggetto[chiaveModalita] : undefined);

      expect(
        link.every((href) => atteso.test(href)),
        `ogni link mailto: su ${pagina.rotta} è verso ${indirizzo}` +
          (chiaveModalita ? ` con oggetto ${oggetto[chiaveModalita]}` : ' senza oggetto') +
          ` (trovati: ${link.join(', ')})`,
      ).toBe(true);
    });
  }
});

test.describe('N2: dopo la sostituzione — copia temporanea con contatto-di-prova.json', () => {
  test.describe.configure({ timeout: 600_000 });

  let copia: CopiaTemporanea;
  let contestoRichieste: APIRequestContext;
  let indirizzoVecchio: string;
  let fixtureNuova: DatiContatto;

  test.beforeAll(async () => {
    indirizzoVecchio = leggiDatiContatto().indirizzo;
    fixtureNuova = JSON.parse(readFileSync(PERCORSO_FIXTURE, 'utf-8')) as DatiContatto;
    expect(fixtureNuova.indirizzo, 'la fixture N2 usa un indirizzo diverso da quello attuale').not.toBe(
      indirizzoVecchio,
    );

    copia = await costruisciCopiaConFixture({
      fixture: 'contatto',
      percorsoFixture: PERCORSO_FIXTURE,
    });
    contestoRichieste = await pwRequest.newContext({ baseURL: copia.baseURL });
  });

  test.afterAll(async () => {
    await contestoRichieste?.dispose();
    await copia?.chiudi();
  });

  for (const pagina of PAGINE_DA_VERIFICARE) {
    test(`N2: ${pagina.nome} (${pagina.rotta}) sulla copia — nuovo indirizzo nei link, vecchio assente dall'HTML`, async () => {
      const risposta = await contestoRichieste.get(pagina.rotta);
      expect(risposta.status(), `GET ${pagina.rotta} sulla copia con fixture`).toBe(200);
      const html = await risposta.text();
      expect(html.length, `${pagina.rotta} ha contenuto sulla copia`).toBeGreaterThan(0);

      expect(html.includes(indirizzoVecchio), `il vecchio indirizzo (${indirizzoVecchio}) non compare su ${pagina.rotta}`).toBe(
        false,
      );

      const $ = cheerio.load(html);
      const link = linkMailtoDi($);
      expect(link.length, `almeno un link mailto: su ${pagina.rotta} sulla copia`).toBeGreaterThan(0);

      const chiaveModalita = ROTTA_MODALITA[pagina.rotta];
      const atteso = regexMailtoAtteso(
        fixtureNuova.indirizzo,
        chiaveModalita ? fixtureNuova.oggetto[chiaveModalita] : undefined,
      );

      expect(
        link.every((href) => atteso.test(href)),
        `ogni link mailto: su ${pagina.rotta} sulla copia è verso il nuovo indirizzo` +
          (chiaveModalita ? ` con oggetto ${fixtureNuova.oggetto[chiaveModalita]}` : ' senza oggetto') +
          ` (trovati: ${link.join(', ')})`,
      ).toBe(true);
    });
  }
});
