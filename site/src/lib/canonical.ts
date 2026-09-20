// Unica funzione che costruisce l'URL assoluto di una rotta, usata da canonical (pagine)
// e da sitemap.xml.ts (ADR-0002 D2). Legge il dominio del sito da un solo punto.
import sito from '../dati/sito.json';

export function urlAssoluto(percorso: string): string {
  return new URL(percorso, sito.url).toString();
}
