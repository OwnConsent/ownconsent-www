// Unica funzione che costruisce un link mailto: dal file di contenuto di N2
// (ADR-0002 D3). L'oggetto si codifica con encodeURIComponent; nessuna pagina legale
// passa una modalità, quindi il suo mailto non ha oggetto (DP-29).
import contatto from '../dati/contatto.json';

export type Modalita = keyof typeof contatto.oggetto;

export function mailto(modalita?: Modalita): string {
  const base = `mailto:${contatto.indirizzo}`;
  if (!modalita) return base;
  const oggetto = contatto.oggetto[modalita];
  return `${base}?subject=${encodeURIComponent(oggetto)}`;
}
