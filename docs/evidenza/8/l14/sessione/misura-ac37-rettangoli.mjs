// Uso: node docs/evidenza/8/l14/sessione/misura-ac37-rettangoli.mjs <baseURL>
// Sul mailto dell'informativa privacy: rettangoli per riga (getClientRects) contro il rettangolo
// di unione (getBoundingClientRect, quello che misura e2e/ac37-mobile-360.spec.ts), e line-height
// calcolata del genitore, a 360x640 e 1280x800.
import { chromium } from '@playwright/test';
const base = process.argv[2];
const browser = await chromium.launch();
for (const [w, h] of [[360, 640], [1280, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(base + '/legale/informativa-privacy/');
  const m = await page.evaluate(() => {
    const a = document.querySelector('main a[href^="mailto:"]');
    const u = a.getBoundingClientRect();
    return {
      display: getComputedStyle(a).display,
      line_height_genitore: getComputedStyle(a.parentElement).lineHeight,
      unione: { w: Math.round(u.width), h: Math.round(u.height) },
      righe: [...a.getClientRects()].map((r) => ({ w: Math.round(r.width), h: Math.round(r.height) })),
    };
  });
  console.log(`${w}x${h} ${JSON.stringify(m)}`);
  await page.close();
}
await browser.close();
