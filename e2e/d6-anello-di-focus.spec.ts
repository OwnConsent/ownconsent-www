/**
 * D6 — Anello di focus: lo scarto garantito dalla cascata, non per convenzione
 * (ADR-0002 D6, con la divergenza D-2 gia' RATIFICATA da Andrea il 19/09/2026)
 *
 * Su ognuna delle 8 pagine, a 360×640 e 1280×800, con prefers-color-scheme chiaro e
 * scuro, si scorre con Tab ogni elemento focalizzabile e si leggono gli stili calcolati
 * dell'elemento attivo:
 *   - outline-style deve essere focus.ring-style
 *   - outline-width deve essere focus.ring-width
 *   - outline-offset deve essere focus.ring-offset
 *   - outline-color deve essere color.semantic.<tema>.focus-ring del tema corrente
 *
 * Divergenza D-2 (classe 2 delle divergenze ammesse — il documento fallisce un requisito
 * di accessibilita', si corregge il valore): D6 nell'ADR dice che l'anello atteso e'
 * sempre focus-ring. Preso alla lettera, questo fallirebbe WCAG 1.4.11 nel footer, dove
 * lo sfondo adiacente e' bg-inverse (2,38:1 in chiaro, 1,87:1 in scuro con focus-ring,
 * sotto 3:1). Per questo, per gli elementi dentro <footer>, il valore atteso e' l'alias
 * color.semantic.<tema>.focus-ring-on-inverse, gia' presente in contracts/design-tokens.json.
 * Il test confronta con l'alias in vigore per il contesto dell'elemento, non con un
 * valore letto una volta sola: fuori dal footer resta focus-ring.
 *
 * Tutti i valori attesi si leggono a runtime da contracts/design-tokens.json (tramite
 * e2e/pagine.ts::leggiDesignTokens, gia' esistente per L07 gruppo A) — non si copiano.
 * Lo stile reso si estrae con getComputedStyle sul documento servito (misura, non
 * deduzione da site/**, mai letto in questo file).
 *
 * Guardia anti-404: le pagine di L06/L04 non esistono ancora in questo lotto (tutte e 8
 * rispondono 404). Senza una guardia esplicita, una pagina di errore minimale non
 * avrebbe elementi focalizzabili e il test del focus non avrebbe nulla da osservare —
 * passerebbe a vuoto. Ogni test pretende prima che la pagina risponda 200 e abbia un
 * titolo reale, e solo dopo scorre con Tab.
 */

import { test, expect, type Page } from '@playwright/test';
import { PAGINE, leggiDesignTokens } from './pagine';

interface TokenColore {
  value: string;
}

interface DesignTokens {
  color: {
    semantic: {
      light: Record<string, TokenColore>;
      dark: Record<string, TokenColore>;
    };
  };
  focus: {
    'ring-width': { value: string };
    'ring-offset': { value: string };
    'ring-style': { value: string };
  };
}

const TOKENS = leggiDesignTokens() as DesignTokens;

/** "#7A4B00" -> "rgb(122, 75, 0)", come lo riporta getComputedStyle nel browser. */
function esadecimaleARgb(hex: string): string {
  const pulito = hex.replace('#', '');
  const r = parseInt(pulito.slice(0, 2), 16);
  const g = parseInt(pulito.slice(2, 4), 16);
  const b = parseInt(pulito.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

type Tema = 'light' | 'dark';

interface Viewport {
  nome: string;
  width: number;
  height: number;
}

const VIEWPORTS: Viewport[] = [
  { nome: '360x640', width: 360, height: 640 },
  { nome: '1280x800', width: 1280, height: 800 },
];

const TEMI: Tema[] = ['light', 'dark'];

const RING_WIDTH_ATTESO = parseFloat(TOKENS.focus['ring-width'].value);
const RING_OFFSET_ATTESO = parseFloat(TOKENS.focus['ring-offset'].value);
const RING_STYLE_ATTESO = TOKENS.focus['ring-style'].value;

const SELETTORE_FOCALIZZABILE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

interface LetturaFocus {
  tag: string;
  estratto: string;
  dentroFooter: boolean;
  outlineStyle: string;
  outlineWidthPx: number;
  outlineOffsetPx: number;
  outlineColor: string;
}

async function leggiAnelliDiFocus(page: Page): Promise<LetturaFocus[]> {
  const numeroFocalizzabili = await page.evaluate((sel) => document.querySelectorAll(sel).length, SELETTORE_FOCALIZZABILE);

  const letture: LetturaFocus[] = [];
  for (let i = 0; i < numeroFocalizzabili; i++) {
    await page.keyboard.press('Tab');
    const lettura = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const stile = getComputedStyle(el);
      return {
        tag: el.tagName,
        estratto: (el.textContent ?? '').trim().slice(0, 40),
        dentroFooter: el.closest('footer') !== null,
        outlineStyle: stile.outlineStyle,
        outlineWidthPx: parseFloat(stile.outlineWidth),
        outlineOffsetPx: parseFloat(stile.outlineOffset),
        outlineColor: stile.outlineColor,
      };
    });
    if (lettura) letture.push(lettura);
  }
  return letture;
}

for (const viewport of VIEWPORTS) {
  for (const tema of TEMI) {
    test.describe(`D6: anello di focus — ${viewport.nome}, tema ${tema}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: tema });

      const focusRingAtteso = esadecimaleARgb(TOKENS.color.semantic[tema]['focus-ring'].value);
      const focusRingInverseAtteso = esadecimaleARgb(TOKENS.color.semantic[tema]['focus-ring-on-inverse'].value);

      for (const pagina of PAGINE) {
        test(`D6: ${pagina.nome} (${pagina.rotta}) — ogni elemento focalizzabile ha l'anello atteso per il proprio contesto`, async ({
          page,
        }) => {
          const risposta = await page.goto(pagina.rotta);

          expect(
            risposta?.status(),
            `${pagina.rotta} deve rispondere 200 prima di poter scorrere il focus (altrimenti il test passerebbe a vuoto, senza elementi focalizzabili)`,
          ).toBe(200);

          const titolo = page.locator('h1, h2').first();
          await expect(
            titolo,
            `${pagina.rotta} deve avere almeno un titolo reale: senza questo potrebbe essere una pagina di errore minimale`,
          ).toBeVisible();

          const letture = await leggiAnelliDiFocus(page);

          expect(
            letture.length,
            `${pagina.rotta} non ha restituito alcun elemento focalizzabile da controllare: il test non avrebbe nulla da osservare`,
          ).toBeGreaterThan(0);

          const nonConformi = letture
            .map((l) => {
              const coloreAtteso = l.dentroFooter ? focusRingInverseAtteso : focusRingAtteso;
              const problemi: string[] = [];
              if (l.outlineStyle !== RING_STYLE_ATTESO) {
                problemi.push(`outline-style='${l.outlineStyle}' atteso '${RING_STYLE_ATTESO}'`);
              }
              if (l.outlineWidthPx !== RING_WIDTH_ATTESO) {
                problemi.push(`outline-width=${l.outlineWidthPx}px atteso ${RING_WIDTH_ATTESO}px`);
              }
              if (l.outlineOffsetPx !== RING_OFFSET_ATTESO) {
                problemi.push(`outline-offset=${l.outlineOffsetPx}px atteso ${RING_OFFSET_ATTESO}px`);
              }
              if (l.outlineColor !== coloreAtteso) {
                problemi.push(
                  `outline-color='${l.outlineColor}' atteso '${coloreAtteso}' (${l.dentroFooter ? 'focus-ring-on-inverse, dentro footer — D-2' : 'focus-ring'})`,
                );
              }
              return { ...l, problemi };
            })
            .filter((l) => l.problemi.length > 0);

          expect(
            nonConformi,
            `elementi con anello di focus non conforme su ${pagina.rotta} (${viewport.nome}, ${tema}): ${JSON.stringify(nonConformi, null, 1)}`,
          ).toEqual([]);
        });
      }
    });
  }
}
