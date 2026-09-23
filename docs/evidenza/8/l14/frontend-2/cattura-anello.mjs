// Cattura screenshot + geometria del link "salta al contenuto" a fuoco, per le 8 pagine
// x 2 viewport, tema chiaro forzato. Il campionamento pixel dell'anello lo fa lo script
// Python .work/l14/analizza-anello.py (PIL disponibile, nessun decoder PNG scritto a mano
// in Node: pngjs non e' nel lockfile e non lo aggiungo per una misura una tantum).
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const [, , baseURL, outDir] = process.argv;
mkdirSync(outDir, { recursive: true });

const PAGINE = [
  { nome: 'home', percorso: '/' },
  { nome: 'saas', percorso: '/saas/' },
  { nome: 'hosted', percorso: '/hosted/' },
  { nome: 'on-premise', percorso: '/on-premise/' },
  { nome: 'confronto', percorso: '/confronto/' },
  { nome: 'termini-di-servizio', percorso: '/legale/termini-di-servizio/' },
  { nome: 'informativa-privacy', percorso: '/legale/informativa-privacy/' },
  { nome: 'cookie-policy', percorso: '/legale/cookie-policy/' },
];
const VIEWPORT = [
  { nome: '360x640', width: 360, height: 640 },
  { nome: '1280x800', width: 1280, height: 800 },
];

const browser = await chromium.launch();
const manifest = [];
for (const pagina of PAGINE) {
  for (const vp of VIEWPORT) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto(new URL(pagina.percorso, baseURL).toString(), { waitUntil: 'load' });
    await page.keyboard.press('Tab');
    const geometria = await page.evaluate(() => {
      const el = document.activeElement;
      const rect = el ? el.getBoundingClientRect() : null;
      const header = document.querySelector('header');
      const headerRect = header ? header.getBoundingClientRect() : null;
      return {
        elemento: el ? { tag: el.tagName, className: el.className } : null,
        rect: rect ? { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
        headerRect: headerRect ? { top: headerRect.top, left: headerRect.left, right: headerRect.right, bottom: headerRect.bottom } : null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });
    const fname = `${outDir}/${pagina.nome}-${vp.nome}.png`;
    await page.screenshot({ path: fname });
    await context.close();
    manifest.push({ pagina: pagina.nome, viewport: vp.nome, png: fname, ...geometria });
    console.log(`${pagina.nome} @ ${vp.nome}: catturato, rect=${JSON.stringify(geometria.rect)}`);
  }
}
await browser.close();
writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`manifest scritto in ${outDir}/manifest.json`);
