// Endpoint proprio (ADR-0002 D2, D9): nessuna regola esclude le 8 pagine indicizzabili.
import type { APIRoute } from 'astro';
import sito from '../dati/sito.json';

export const GET: APIRoute = () => {
  const sitemap = new URL('/sitemap.xml', sito.url).toString();
  const corpo = `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
  return new Response(corpo, {
    headers: { 'Content-Type': 'text/plain' },
  });
};
