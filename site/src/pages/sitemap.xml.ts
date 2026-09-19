// Endpoint proprio (ADR-0002 D2, D9): elenca esattamente le 8 rotte indicizzabili,
// con lo stesso URL assoluto dei canonical (AC3).
import type { APIRoute } from 'astro';
import { urlAssoluto } from '../lib/canonical';
import { ROTTE_INDICIZZABILI } from '../lib/rotte';

export const GET: APIRoute = () => {
  const voci = ROTTE_INDICIZZABILI.map((rotta) => `  <url><loc>${urlAssoluto(rotta)}</loc></url>`).join('\n');
  const corpo = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${voci}\n</urlset>\n`;
  return new Response(corpo, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
