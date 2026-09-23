import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
await page.goto('http://localhost:4321/');
await page.keyboard.press('Tab');
const info = await page.evaluate(() => {
  function styleOf(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName, cls: el.className,
      position: cs.position, zIndex: cs.zIndex, transform: cs.transform,
      isolation: cs.isolation, filter: cs.filter, opacity: cs.opacity,
      willChange: cs.willChange, mixBlendMode: cs.mixBlendMode,
      display: cs.display, contain: cs.contain,
    };
  }
  const link = document.querySelector('.salta-al-contenuto');
  const header = document.querySelector('header');
  const nomeSito = document.querySelector('.nome-sito');
  const body = document.body;
  const html = document.documentElement;
  return {
    link: styleOf(link),
    header: styleOf(header),
    nomeSito: styleOf(nomeSito),
    body: styleOf(body),
    html: styleOf(html),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
