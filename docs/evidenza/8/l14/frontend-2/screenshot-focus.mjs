import { chromium } from '@playwright/test';
const [,, url, out, w, h] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(url);
await page.keyboard.press('Tab');
await page.screenshot({ path: out });
await browser.close();
