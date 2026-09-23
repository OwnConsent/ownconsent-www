// Sonda L14 (punti 1 e 2, L09-F2 e L09-F1): misura comportamentale del link "salta al
// contenuto" sulla build SERVITA (pnpm --dir site build, poi astro preview), via HTTP,
// con Playwright. Non misura sul sorgente.
//
// Punto 1 (L09-F2): dopo Tab poi Invio sul link, document.activeElement deve essere
// <main>, e il Tab successivo deve cadere sul primo elemento focalizzabile DENTRO <main>.
// Punto 2 (L09-F1): al primo Tab, il link deve essere interamente dentro la viewport e
// nessun punto del suo anello di focus deve essere coperto da un altro elemento (es.
// l'header). Anello di focus da contracts/design-tokens.json: ring-width 2px, ring-offset
// 2px -> il bordo esterno dell'anello e' il rettangolo dell'elemento espanso di 4px per
// lato (outline-offset sposta l'anello fuori dal bordo, poi l'anello stesso e' spesso
// ring-width).
//
// Uso: node sonda-salta-contenuto.mjs <baseURL> <out.json>
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const baseURL = process.argv[2];
const outFile = process.argv[3];
if (!baseURL || !outFile) {
  console.error('uso: node sonda-salta-contenuto.mjs <baseURL> <out.json>');
  process.exit(1);
}

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

const RING_WIDTH = 2;
const RING_OFFSET = 2;
const ESPANSIONE = RING_WIDTH + RING_OFFSET; // 4px per lato, bordo esterno dell'anello

function descrittoreElemento(handleInfo) {
  if (!handleInfo) return null;
  const { tag, id, className, testo } = handleInfo;
  return { tag, id: id || null, className: className || null, testo: (testo || '').trim().slice(0, 60) };
}

async function misuraPagina(browser, pagina, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const url = new URL(pagina.percorso, baseURL).toString();
  await page.goto(url, { waitUntil: 'load' });

  // Primo Tab: deve cadere sul link "salta al contenuto".
  await page.keyboard.press('Tab');
  const dopoPrimoTab = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    return {
      tag: el.tagName,
      id: el.id,
      className: el.className,
      testo: el.textContent,
      href: el.getAttribute ? el.getAttribute('href') : null,
    };
  });

  // Punto 2: rettangolo dell'elemento a fuoco (il link), rettangolo dell'header, viewport.
  const geometria = await page.evaluate(() => {
    const el = document.activeElement;
    const rect = el ? el.getBoundingClientRect() : null;
    const header = document.querySelector('header');
    const headerRect = header ? header.getBoundingClientRect() : null;
    return {
      elementoRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom } : null,
      headerRect: headerRect ? { x: headerRect.x, y: headerRect.y, width: headerRect.width, height: headerRect.height, top: headerRect.top, left: headerRect.left, right: headerRect.right, bottom: headerRect.bottom } : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });

  // Anello di focus: rettangolo dell'elemento espanso di RING_OFFSET + RING_WIDTH per lato.
  let anello = null;
  let anelloDentroViewport = null;
  let puntiAnelloCoperti = [];
  if (geometria.elementoRect) {
    const r = geometria.elementoRect;
    anello = {
      left: r.left - ESPANSIONE,
      top: r.top - ESPANSIONE,
      right: r.right + ESPANSIONE,
      bottom: r.bottom + ESPANSIONE,
    };
    anelloDentroViewport =
      anello.left >= 0 && anello.top >= 0 &&
      anello.right <= geometria.viewport.width && anello.bottom <= geometria.viewport.height;

    // Campiona punti lungo il perimetro dell'anello (bordo esterno) e verifica, con
    // elementsFromPoint, che il topmost sia il link a fuoco (o un suo discendente/il suo
    // testo), non un altro elemento come l'header.
    puntiAnelloCoperti = await page.evaluate(({ anello }) => {
      const el = document.activeElement;
      const campioni = [];
      const passi = 8;
      // bordo superiore, inferiore, sinistro, destro: campiona `passi` punti per lato.
      for (let i = 0; i <= passi; i++) {
        const fx = anello.left + ((anello.right - anello.left) * i) / passi;
        campioni.push([fx, anello.top]);
        campioni.push([fx, anello.bottom]);
      }
      for (let i = 0; i <= passi; i++) {
        const fy = anello.top + ((anello.bottom - anello.top) * i) / passi;
        campioni.push([anello.left, fy]);
        campioni.push([anello.right, fy]);
      }
      const risultati = [];
      for (const [x, y] of campioni) {
        // Punti fuori dal documento (coordinate negative o oltre la viewport) sono
        // segnalati a parte: elementFromPoint restituisce null lì.
        const dentroDoc = x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
        if (!dentroDoc) {
          risultati.push({ x, y, dentroViewport: false, coperto: null, elementoSopra: null });
          continue;
        }
        const stack = document.elementsFromPoint(x, y);
        const top = stack[0] || null;
        const eLink = el === top || (el && el.contains(top)) || (top && top.contains && top.contains(el));
        risultati.push({
          x,
          y,
          dentroViewport: true,
          coperto: !eLink,
          elementoSopra: top ? { tag: top.tagName, id: top.id, className: String(top.className || '') } : null,
        });
      }
      return risultati;
    }, { anello });
  }

  // Attiva il link (Invio) e misura dove va il focus.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  const dopoInvio = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? { tag: el.tagName, id: el.id, className: el.className } : null;
  });

  // Tab successivo: deve cadere sul primo elemento focalizzabile DENTRO <main>.
  await page.keyboard.press('Tab');
  const dopoTabSuccessivo = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const main = document.querySelector('main');
    return {
      tag: el.tagName,
      id: el.id,
      className: el.className,
      testo: (el.textContent || '').trim().slice(0, 60),
      href: el.getAttribute ? el.getAttribute('href') : null,
      dentroMain: !!(main && main.contains(el)),
    };
  });

  await context.close();

  const puntiCoperti = puntiAnelloCoperti.filter((p) => p.coperto);

  return {
    pagina: pagina.nome,
    percorso: pagina.percorso,
    viewport: viewport.nome,
    primo_tab: dopoPrimoTab,
    geometria,
    anello_di_focus: anello,
    anello_dentro_viewport: anelloDentroViewport,
    punti_anello_campionati: puntiAnelloCoperti.length,
    punti_anello_coperti: puntiCoperti.length,
    dettaglio_punti_coperti: puntiCoperti.slice(0, 5),
    dopo_invio_activeElement: dopoInvio,
    focus_su_main_dopo_invio: !!(dopoInvio && dopoInvio.tag === 'MAIN'),
    dopo_tab_successivo: dopoTabSuccessivo,
    tab_successivo_dentro_main: !!(dopoTabSuccessivo && dopoTabSuccessivo.dentroMain),
  };
}

const browser = await chromium.launch();
const risultati = [];
for (const pagina of PAGINE) {
  for (const viewport of VIEWPORT) {
    const r = await misuraPagina(browser, pagina, viewport);
    risultati.push(r);
    console.log(
      `${pagina.nome} @ ${viewport.nome}: primo_tab=${r.primo_tab?.className || r.primo_tab?.tag} ` +
      `anello_dentro_viewport=${r.anello_dentro_viewport} punti_coperti=${r.punti_anello_coperti}/${r.punti_anello_campionati} ` +
      `focus_su_main=${r.focus_su_main_dopo_invio} tab_dentro_main=${r.tab_successivo_dentro_main} (${r.dopo_tab_successivo?.tag}${r.dopo_tab_successivo?.id ? '#' + r.dopo_tab_successivo.id : ''})`
    );
  }
}
await browser.close();

writeFileSync(outFile, JSON.stringify(risultati, null, 2));
console.log(`scritto ${outFile}`);
