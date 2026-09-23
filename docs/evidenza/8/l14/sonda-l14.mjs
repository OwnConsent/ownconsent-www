// Sonda di L14 (issue #8), scritta dalla sessione (orchestrator), non da un agente.
// Misura sull'HTML servito, via HTTP, i criteri di chiusura di L09-F1, L09-F2 e L10-D02.
//
//   node docs/evidenza/8/l14/sonda-l14.mjs <baseURL> <etichetta> [controllo]
//
// Scrive docs/evidenza/8/l14/misura-<etichetta>.json.
//
// F1 — metodo a pixel, non a hit-testing. Un outline non partecipa al hit-testing:
// elementFromPoint sui punti dell'anello restituisce la scatola che sta sotto, anche
// quando l'anello e' dipinto sopra (e' il metodo fallito due volte in questo lotto).
// Qui si fa una schermata con il link a fuoco e si legge il colore dei punti al centro
// della fascia dell'anello (bordo del link + offset + meta' spessore). Un punto e'
// «visibile» se il suo colore coincide, entro TOLLERANZA per canale, con l'outline-color
// calcolato; un punto fuori dalla viewport e' «non visibile» per definizione.
// Con [controllo] la sonda inietta un header posizionato sopra il link, per mostrare
// che il metodo sa dire rosso quando l'anello e' davvero coperto.
//
// F2 — criterio di Andrea (journal/2026-09-23/165208-orchestrator-decisione.json):
// dopo Invio sul link, activeElement e' <main>; il Tab successivo va al primo elemento
// focalizzabile che SEGUE l'inizio di <main> nell'ordine del documento (dentro <main> se
// ce n'e' uno, altrimenti il primo dopo).

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [baseURL, etichetta, controllo] = process.argv.slice(2);
if (!baseURL || !etichetta) {
  console.error('uso: node sonda-l14.mjs <baseURL> <etichetta> [controllo]');
  process.exit(2);
}

const PAGINE = [
  ['home', '/'],
  ['saas', '/saas/'],
  ['hosted', '/hosted/'],
  ['on-premise', '/on-premise/'],
  ['confronto', '/confronto/'],
  ['termini-di-servizio', '/legale/termini-di-servizio/'],
  ['informativa-privacy', '/legale/informativa-privacy/'],
  ['cookie-policy', '/legale/cookie-policy/'],
];
const VIEWPORT = [
  [360, 640],
  [1280, 800],
];
const TEMI = ['light', 'dark'];
const PUNTI_PER_LATO = 9;
const TOLLERANZA = 8;

const CONTROLLO_CSS =
  '.intestazione{position:relative;z-index:1;background:rgb(255,0,255)}';

function rgb(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
  return m.slice(1)[0].split(',').slice(0, 3).map((x) => Math.round(Number(x)));
}

const browser = await chromium.launch();
const lettore = await (await browser.newContext()).newPage();

async function pixel(png, punti, vw, vh) {
  await lettore.setViewportSize({ width: vw, height: vh });
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  return await lettore.evaluate(
    async ({ dataUrl, punti }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return punti.map(([x, y]) => Array.from(ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)));
    },
    { dataUrl, punti },
  );
}

const risultati = [];
for (const tema of TEMI) {
  for (const [vw, vh] of VIEWPORT) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, colorScheme: tema, deviceScaleFactor: 1 });
    for (const [nome, rotta] of PAGINE) {
      const page = await ctx.newPage();
      const risposta = await page.goto(baseURL + rotta);
      if (controllo) await page.addStyleTag({ content: CONTROLLO_CSS });

      // Stato non a fuoco: quanta parte del link e' dentro la viewport.
      const nonAFuoco = await page.evaluate(() => {
        const r = document.querySelector('.salta-al-contenuto').getBoundingClientRect();
        const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, area_visibile_px2: Math.round(w * h) };
      });

      // F1: primo Tab.
      await page.keyboard.press('Tab');
      const f1 = await page.evaluate(() => {
        const a = document.activeElement;
        const cs = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        const off = parseFloat(cs.outlineOffset);
        const w = parseFloat(cs.outlineWidth);
        const esterno = { left: r.left - off - w, top: r.top - off - w, right: r.right + off + w, bottom: r.bottom + off + w };
        return {
          primo_tab: a.className || a.tagName,
          outline_color: cs.outlineColor,
          outline_width: w,
          outline_offset: off,
          link: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          anello_esterno: esterno,
          dentro_viewport: esterno.left >= 0 && esterno.top >= 0 && esterno.right <= innerWidth && esterno.bottom <= innerHeight,
        };
      });
      const d = f1.outline_offset + f1.outline_width / 2;
      const L = f1.link;
      const [x0, y0, x1, y1] = [L.left - d, L.top - d, L.right + d, L.bottom + d];
      const punti = [];
      for (let i = 0; i < PUNTI_PER_LATO; i++) {
        const t = (i + 0.5) / PUNTI_PER_LATO;
        punti.push([x0 + t * (x1 - x0), y0], [x0 + t * (x1 - x0), y1], [x0, y0 + t * (y1 - y0)], [x1, y0 + t * (y1 - y0)]);
      }
      const png = await page.screenshot();
      const dentro = punti.filter(([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh);
      const colori = await pixel(png, dentro, vw, vh);
      const atteso = rgb(f1.outline_color);
      const nonVisibili = [];
      let j = 0;
      for (const p of punti) {
        if (!(p[0] >= 0 && p[1] >= 0 && p[0] < vw && p[1] < vh)) {
          nonVisibili.push({ punto: p, perche: 'fuori viewport' });
          continue;
        }
        const c = colori[j++];
        if (c.some((v, k) => Math.abs(v - atteso[k]) > TOLLERANZA)) nonVisibili.push({ punto: p, perche: 'colore', letto: c });
      }

      // F2: Invio sul link, poi Tab.
      await page.keyboard.press('Enter');
      const dopoInvio = await page.evaluate(() => {
        const a = document.activeElement;
        return { tag: a.tagName, id: a.id };
      });
      const atteso2 = await page.evaluate(() => {
        const main = document.querySelector('main');
        const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]';
        const tutti = [...document.querySelectorAll(sel)].filter((el) => {
          if (el.tabIndex < 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        });
        const positivi = tutti.filter((el) => el.tabIndex > 0).length;
        const dopo = tutti.filter((el) => el === main || main.compareDocumentPosition(el) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY));
        const primo = dopo[0];
        window.__atteso = primo;
        return {
          tabindex_positivi: positivi,
          focalizzabili_in_main: tutti.filter((el) => main.contains(el)).length,
          atteso: primo ? { tag: primo.tagName, testo: primo.textContent.trim().slice(0, 40), dentro_main: main.contains(primo) } : null,
        };
      });
      await page.keyboard.press('Tab');
      const f2 = await page.evaluate(() => {
        const a = document.activeElement;
        const main = document.querySelector('main');
        return {
          tab_successivo: { tag: a.tagName, testo: a.textContent.trim().slice(0, 40), dentro_main: main.contains(a) },
          uguale_all_atteso: a === window.__atteso,
          prima_di_main: !!(main.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING),
        };
      });

      // D02
      const h1 = await page.evaluate(() => {
        const h = document.querySelectorAll('h1');
        return { quanti: h.length, font_size: h[0] ? getComputedStyle(h[0]).fontSize : null };
      });

      risultati.push({
        pagina: nome,
        rotta,
        http: risposta.status(),
        viewport: `${vw}x${vh}`,
        tema,
        f1: {
          ...f1,
          link_non_a_fuoco: nonAFuoco,
          punti_campionati: punti.length,
          punti_non_visibili: nonVisibili.length,
          dettaglio_non_visibili: nonVisibili,
          chiuso: f1.dentro_viewport && nonVisibili.length === 0,
        },
        f2: {
          dopo_invio: dopoInvio,
          ...atteso2,
          ...f2,
          chiuso: dopoInvio.tag === 'MAIN' && f2.uguale_all_atteso && !f2.prima_di_main,
        },
        d02_h1: h1,
      });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();

const qui = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(qui, `misura-${etichetta}.json`);
writeFileSync(file, JSON.stringify({ baseURL, etichetta, controllo: !!controllo, tolleranza: TOLLERANZA, risultati }, null, 1) + '\n');

const righe = risultati.map(
  (r) =>
    `${r.pagina.padEnd(20)} ${r.viewport.padEnd(9)} ${r.tema.padEnd(5)} http=${r.http} ` +
    `F1 dentro=${r.f1.dentro_viewport} non_visibili=${r.f1.punti_non_visibili}/${r.f1.punti_campionati} area_non_a_fuoco=${r.f1.link_non_a_fuoco.area_visibile_px2} | ` +
    `F2 invio=${r.f2.dopo_invio.tag} tab=${r.f2.tab_successivo.tag}:${r.f2.tab_successivo.testo.slice(0, 18)} in_main=${r.f2.tab_successivo.dentro_main} atteso=${r.f2.uguale_all_atteso} | h1=${r.d02_h1.quanti}x${r.d02_h1.font_size}`,
);
console.log(righe.join('\n'));
const f1ok = risultati.filter((r) => r.f1.chiuso).length;
const f2ok = risultati.filter((r) => r.f2.chiuso).length;
console.log(`F1 chiuso ${f1ok}/${risultati.length}; F2 chiuso ${f2ok}/${risultati.length}; file ${path.relative(process.cwd(), file)}`);
