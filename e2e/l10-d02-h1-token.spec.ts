/**
 * L10-D02 — test di regressione (issue #8, lotto L14).
 *
 * Scritto dalla sessione (orchestrator) su richiesta esplicita di Andrea, non da
 * @qa-test; il codice che corregge D02 (site/src/styles/base.css, cd68e01) e' di
 * @frontend, quindi chi scrive questo test non e' chi ha scritto la correzione.
 *
 * Finding (docs/evidenza/8/l10/findings-design.json, D02): l'h1 era 36px a 1280x800
 * come a 360x640; typography.font-size.700 («h1 dal breakpoint md in su») era definito
 * e non applicato da nessuna regola.
 *
 * Criterio, dal contratto e non dall'implementazione: su ciascuna delle 8 pagine
 * (e2e/pagine.ts), il font-size CALCOLATO dell'h1 sull'HTML servito vale
 * typography.font-size.600 sotto breakpoint.md e typography.font-size.700 da
 * breakpoint.md in su. I valori si leggono a runtime da contracts/design-tokens.json
 * (in rem, convertiti con il font-size calcolato di <html> nella stessa pagina): nessun
 * px copiato qui.
 *
 * Prova-by-reversion (fatta a mano dalla sessione, output in
 * docs/evidenza/8/l14/sessione/): base.css con la regola @media (--bp-md) dell'h1 tolta,
 * cioe' l'h1 rimesso alla dimensione precedente, fa fallire gli 8 test a 1280x800 e
 * lascia verdi gli 8 a 360x640.
 */

import { test, expect } from '@playwright/test';
import { PAGINE, leggiDesignTokens } from './pagine';
import { guardiaEsistenzaPagina } from './guardia-esistenza';

interface Token {
  value: string;
}
interface Tokens {
  typography: { 'font-size': Record<string, Token> };
  breakpoint: Record<string, Token>;
}

const VIEWPORT: Array<[number, number]> = [
  [360, 640],
  [1280, 800],
];

function numero(valore: string, unita: 'rem' | 'px'): number {
  const m = valore.match(new RegExp(`^([0-9.]+)${unita}$`));
  if (!m) throw new Error(`token non in ${unita}: ${valore}`);
  return Number(m[1]);
}

const tokens = leggiDesignTokens() as Tokens;
const H1_SOTTO_MD_REM = numero(tokens.typography['font-size']['600'].value, 'rem');
const H1_DA_MD_REM = numero(tokens.typography['font-size']['700'].value, 'rem');
const MD_PX = numero(tokens.breakpoint.md.value, 'px');

test.describe("L10-D02: l'h1 usa font-size.600 sotto breakpoint.md e font-size.700 da breakpoint.md in su", () => {
  for (const pagina of PAGINE) {
    for (const [vw, vh] of VIEWPORT) {
      test(`D02: ${pagina.nome} (${pagina.rotta}) a ${vw}x${vh}`, async ({ page }) => {
        await page.setViewportSize({ width: vw, height: vh });
        await guardiaEsistenzaPagina(page, pagina.rotta);

        const misura = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return {
            h1: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
            radice: parseFloat(getComputedStyle(document.documentElement).fontSize),
          };
        });

        const token = vw >= MD_PX ? 'font-size.700' : 'font-size.600';
        const attesoPx = (vw >= MD_PX ? H1_DA_MD_REM : H1_SOTTO_MD_REM) * misura.radice;

        expect(misura.h1, `la pagina ${pagina.rotta} ha un h1`).not.toBeNull();
        expect(misura.h1, `font-size calcolato dell'h1 a ${vw}x${vh}: atteso ${token} = ${attesoPx}px`).toBe(attesoPx);
      });
    }
  }
});
