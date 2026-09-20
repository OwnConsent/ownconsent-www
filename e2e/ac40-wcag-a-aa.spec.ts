/**
 * AC40 — Controllo automatico con le regole WCAG 2.2 di livello A e AA
 *
 * dato: ciascuna delle 8 pagine pubbliche, compresi i contrassegni «pagina dimostrativa»
 *       e «bozza» dove presenti
 * quando: eseguo un controllo automatico con le regole WCAG 2.2 di livello A e AA
 * allora: non risulta alcuna violazione
 *
 * Lo strumento e' @axe-core/playwright (gia' dipendenza della radice). Il risultato e'
 * l'output dello strumento, non un giudizio di questo file: nessun disable(), nessun
 * filtro di violazioni per "irrilevanza". I tag scelti coprono i livelli A+AA cumulativi
 * fino a WCAG 2.2 (axe-core 4.x non pubblica ancora un tag "wcag22a" separato per i pochi
 * criteri di livello A aggiunti in 2.2 — sono in pratica gia' coperti dalle regole delle
 * versioni precedenti che axe implementa; nessuna regola viene esclusa da questo elenco,
 * solo selezionata per tag).
 *
 * Guardia anti-404: le pagine di L06/L04 non esistono ancora in questo lotto (tutte e 8
 * rispondono 404). Un controllo axe lanciato comunque su una pagina di errore minimale
 * non troverebbe violazioni e farebbe passare AC40 a vuoto — misurato durante questo
 * lotto: la 404 servita da Astro qui e' un solo <pre>Path: ...</pre>, senza heading ne'
 * landmark. Per questo ogni test pretende prima che la pagina risponda 200 e abbia un
 * titolo reale, e solo dopo esegue il controllo.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGINE } from './pagine';

const TAG_WCAG_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('AC40: controllo automatico WCAG 2.2 A/AA su tutte le pagine pubbliche', () => {
  for (const pagina of PAGINE) {
    test(`AC40: ${pagina.nome} (${pagina.rotta}) risponde 200 con contenuto reale e non ha violazioni WCAG 2.2 A/AA`, async ({
      page,
    }) => {
      const risposta = await page.goto(pagina.rotta);

      expect(
        risposta?.status(),
        `${pagina.rotta} deve rispondere 200 prima di poter essere controllata con axe (altrimenti il test passerebbe a vuoto su una pagina di errore)`,
      ).toBe(200);

      const titolo = page.locator('h1, h2').first();
      await expect(
        titolo,
        `${pagina.rotta} deve avere almeno un titolo reale (h1 o h2): senza questo la pagina servita potrebbe essere una pagina di errore minimale, non il contenuto atteso`,
      ).toBeVisible();

      const risultati = await new AxeBuilder({ page }).withTags(TAG_WCAG_A_AA).analyze();

      expect(
        risultati.violations,
        `violazioni WCAG 2.2 A/AA su ${pagina.rotta} (output axe-core, non filtrato): ${JSON.stringify(
          risultati.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            nodi: v.nodes.map((n) => n.target),
          })),
          null,
          1,
        )}`,
      ).toEqual([]);
    });
  }
});
