// Schermate documento-contro-prodotto di L14 (issue #8), scritte dalla sessione.
//   node docs/evidenza/8/l14/schermate.mjs <baseURL> <prima|dopo>
// Per ogni viewport: la piega della Home con il link di salto a fuoco (primo Tab), e la
// piega senza focus. Le misure numeriche stanno in misura-f1-*.json: queste servono
// all'occhio di Andrea, non al verdetto.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [baseURL, stato] = process.argv.slice(2);
const cartella = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schermate', stato);
mkdirSync(cartella, { recursive: true });

const browser = await chromium.launch();
for (const [vw, vh] of [
  [360, 640],
  [1280, 800],
]) {
  for (const tema of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: tema, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(baseURL + '/');
    await page.screenshot({ path: path.join(cartella, `home-${vw}x${vh}-${tema}-senza-focus.png`) });
    await page.keyboard.press('Tab');
    await page.screenshot({ path: path.join(cartella, `home-${vw}x${vh}-${tema}-salto-a-fuoco.png`) });
    await ctx.close();
  }
}
await browser.close();
console.log(cartella);
