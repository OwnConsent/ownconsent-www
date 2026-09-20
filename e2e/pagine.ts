/**
 * e2e/pagine.ts
 *
 * Elenco delle 8 pagine indicizzabili (issue #8, `pagine_in_perimetro`) con le rotte
 * trascritte da ADR-0002 D2 — l'unico artefatto che le comanda, non `site/src/pages/`
 * (CLAUDE.md: non si scrive codice guardando l'implementazione).
 *
 * Le funzioni `leggi*` leggono a runtime i soli quattro file di dati consentiti per
 * questo lotto (L07 gruppo A):
 *   - site/src/dati/sito.json
 *   - site/src/dati/contatto.json
 *   - site/src/dati/listino.json
 *   - contracts/design-tokens.json
 *
 * Nessun valore di questi file è copiato qui: si legge dal filesystem ad ogni
 * chiamata, così un cambio di segnaposto (gate G3) non richiede toccare i test.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface Pagina {
  nome: string;
  rotta: string;
  mostraPrezzi: boolean;
}

/**
 * Le 8 rotte, con la barra finale (ADR-0002 D2: `trailingSlash: 'always'`).
 * Ordine e nomi come in `docs/spec/issue-8.json` → `pagine_in_perimetro`.
 */
export const PAGINE: Pagina[] = [
  { nome: 'Home', rotta: '/', mostraPrezzi: false },
  { nome: 'SaaS', rotta: '/saas/', mostraPrezzi: true },
  { nome: 'Hosted', rotta: '/hosted/', mostraPrezzi: true },
  { nome: 'On-premise', rotta: '/on-premise/', mostraPrezzi: true },
  { nome: 'Confronto modalità e listino', rotta: '/confronto/', mostraPrezzi: true },
  { nome: 'Termini di servizio (bozza)', rotta: '/legale/termini-di-servizio/', mostraPrezzi: false },
  { nome: 'Informativa privacy (bozza)', rotta: '/legale/informativa-privacy/', mostraPrezzi: false },
  { nome: 'Cookie policy (bozza)', rotta: '/legale/cookie-policy/', mostraPrezzi: false },
];

const RADICE_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function leggiJson<T>(percorsoRelativoAllaRadice: string): T {
  const percorsoAssoluto = path.join(RADICE_REPO, percorsoRelativoAllaRadice);
  return JSON.parse(readFileSync(percorsoAssoluto, 'utf-8')) as T;
}

export interface DatiSito {
  url: string;
}

/** Legge site/src/dati/sito.json a runtime (non copiarne il valore nei test). */
export function leggiDatiSito(): DatiSito {
  return leggiJson<DatiSito>('site/src/dati/sito.json');
}

export interface DatiContatto {
  indirizzo: string;
  oggetto: Record<string, string>;
}

/** Legge site/src/dati/contatto.json a runtime. */
export function leggiDatiContatto(): DatiContatto {
  return leggiJson<DatiContatto>('site/src/dati/contatto.json');
}

export interface DatiListino {
  saas: { piani: unknown[] };
  hosted: { taglie: unknown[] };
  'on-premise': { licenza_annuale_eur: string | null };
}

/** Legge site/src/dati/listino.json a runtime. */
export function leggiDatiListino(): DatiListino {
  return leggiJson<DatiListino>('site/src/dati/listino.json');
}

/** Legge contracts/design-tokens.json a runtime. */
export function leggiDesignTokens(): unknown {
  return leggiJson('contracts/design-tokens.json');
}

/**
 * URL assoluto canonical atteso per una pagina: dominio da site/src/dati/sito.json
 * (segnaposto dichiarato, ADR-0002 D3) + rotta della pagina.
 */
export function urlCanonicoAtteso(pagina: Pagina): string {
  const { url } = leggiDatiSito();
  const base = url.replace(/\/+$/, '');
  return `${base}${pagina.rotta}`;
}
