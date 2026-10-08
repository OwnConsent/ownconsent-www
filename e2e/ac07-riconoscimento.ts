/**
 * AC7 — riconoscimento delle violazioni (logica pura, senza I/O).
 *
 * Regola di riferimento: docs/spec/issue-8.json, AC7, campo «interpretazione»
 * (Andrea, 2026-09-22): vietata la forma di STATO (un participio o un predicato che
 * afferma un fatto compiuto sulla registrazione presso IAB Europe), ammessa la forma
 * di RESPONSABILITA' (chi si occupa della registrazione).
 *
 * FORMA SCELTA (issue #56 e #57). Non e' piu' "parole della violazione gia' vista a
 * distanza fissa". Il riconoscimento ha tre parti:
 *   1. struttura: si lavora per FRASE (confine: . ! ? ; seguiti da spazio, cosi' "v2.2"
 *      non spezza). Nessuna distanza in caratteri: la frase intera conta, quindi una
 *      frase lunga non nasconde piu' la violazione. Un predicato di stato nella frase
 *      precedente o seguente a quella che nomina IAB Europe conta come la stessa
 *      affermazione ("E' registrata. Lo ha confermato IAB Europe.");
 *   2. lessico di stato: il verbo/participio e' una famiglia di predicati di stato
 *      (registrat-, certificat-, approvat-, iscritt-, autorizzat-, accreditat-,
 *      riconosciut-, ... , "figura", "registro/elenco CMP"). E' ancora un elenco
 *      CHIUSO, ma piu' largo, ed e' la parte meno robusta: vedi i limiti;
 *   3. eccezione di responsabilita': un participio preceduto da "viene/vengono/verra'"
 *      e seguito da un agente "da X" con X diverso da IAB e' un processo di cui si
 *      dice chi e' responsabile, non un fatto compiuto ("la CMP viene registrata da
 *      noi presso IAB Europe"). "registrazione" (nome) non e' mai uno stato.
 *
 * LIMITI NOTI (cio' che questo riconoscimento continua a NON vedere o a vedere male):
 *   - un predicato di stato fuori dall'elenco (sinonimo non previsto, un'altra
 *     lingua, una perifrasi: "ha superato la verifica di IAB Europe", "e' nel
 *     programma CMP di IAB Europe") resta verde. Un elenco piu' lungo sposta il
 *     problema, non lo chiude;
 *   - l'affermazione senza nominare "IAB Europe" ("e' registrata presso l'ente
 *     europeo del TCF", "iscritta al registro TCF") non e' vista;
 *   - l'identificativo in forme diverse da "CMP ID / cmpId / ID CMP" seguito da
 *     cifre (es. "CMP n. 1234" non e' visto; il numero in lettere nemmeno);
 *   - la frase divisa in piu' di due frasi, o con IAB Europe a due frasi di distanza;
 *   - l'eccezione di responsabilita' e' stretta apposta: richiede "viene/vengono/
 *     verra'" piu' un agente "da X". Altre forme di responsabilita' (es. "sara'
 *     registrata da noi", "va registrata dal cliente") sono viste come stato (rosso)
 *     finche' Andrea non dice dove passa il confine: sono domande aperte, non regole;
 *   - e' piu' severo della regola di riferimento nei casi ambigui (un predicato di
 *     stato nella frase vicina a IAB Europe ma riferito ad altro, es. "la tua scelta
 *     e' registrata. IAB Europe definisce il TCF."): falso rosso accettato qui,
 *     perche' sulle 8 pagine servite il caso non si presenta (misurato dalla suite).
 */

export const IDENTIFICATIVO_CMP = /\b(?:cmp[\s_-]?id|id[\s_-]?cmp)\b["']?[\s:#=.nº°]{0,6}["']?\s*\d+/i;

const IAB_EUROPE = /\biab\s*europe\b/i;

const PREDICATI_DI_STATO = new RegExp(
  [
    '(?:registrat|certificat|approvat|iscritt|autorizzat|accreditat|riconosciut|omologat|validat|convalidat|abilitat|qualificat|censit|elencat|listat|ammess)[aeoi]',
    'figur(?:a|ano)',
  ]
    .map((p) => `\\b${p}\\b`)
    .join('|') +
    // il "registro/elenco CMP" afferma che la CMP e' iscritta in un elenco
    '|\\b(?:registro|elenco|albo|lista)\\s+(?:delle\\s+)?cmp\\b|\\bcmp\\s+(?:registry|list)\\b',
  'gi',
);

const VENIRE_PRIMA = /\b(?:viene|vengono|venga|vengano|verr[àa]|verranno)\s+(?:[\wàèéìòù']+\s+){0,2}$/i;
const AGENTE_DOPO = /\bda(?:(?:l|llo|lla|i|gli|lle)?\s+|ll['’])([^\s,;]+)/i;

function frasi(testo: string): string[] {
  return testo.split(/(?<=[.!?;])\s+/).filter((f) => f.length > 0);
}

/** Vero se l'occorrenza e' un processo con un responsabile che non e' IAB (forma ammessa). */
function eResponsabilita(frase: string, inizio: number, fine: number): boolean {
  if (!VENIRE_PRIMA.test(frase.slice(0, inizio))) return false;
  const agente = frase.slice(fine).match(AGENTE_DOPO);
  return agente !== null && !/^iab/i.test(agente[1]);
}

/** Elenco dei motivi per cui il testo viola AC7 (vuoto = nessuna violazione). */
export function violazioniAC7(testo: string): string[] {
  const motivi: string[] = [];
  if (IDENTIFICATIVO_CMP.test(testo)) motivi.push('identificativo CMP');

  const fr = frasi(testo);
  fr.forEach((frase, i) => {
    const vicinoIab = [fr[i - 1], frase, fr[i + 1]].some((f) => f !== undefined && IAB_EUROPE.test(f));
    if (!vicinoIab) return;
    for (const m of frase.matchAll(PREDICATI_DI_STATO)) {
      if (eResponsabilita(frase, m.index ?? 0, (m.index ?? 0) + m[0].length)) continue;
      motivi.push(`stato "${m[0]}" vicino a IAB Europe`);
    }
  });
  return motivi;
}
