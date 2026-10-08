/**
 * AC7 — tabella di frasi che fissa il comportamento del riconoscimento
 * (e2e/ac07-riconoscimento.ts). Issue #56 (falsi verdi) e #57 (falso rosso).
 * Le frasi stanno qui, esplicite: chi legge capisce il caso senza aprire altro.
 * Regola di riferimento: docs/spec/issue-8.json, AC7, «interpretazione».
 * Nessun server: logica pura.
 */
import { test, expect } from '@playwright/test';
import { violazioniAC7 } from './ac07-riconoscimento';

const STATO: Array<[string, string]> = [
  ['#56', 'OwnConsent è iscritta al registro CMP di IAB Europe.'],
  ['#56', 'CMP autorizzata da IAB Europe.'],
  ['#56', 'OwnConsent è accreditata presso IAB Europe.'],
  ['#56', 'OwnConsent è riconosciuta da IAB Europe.'],
  ['#56', "OwnConsent figura nell'elenco CMP di IAB Europe."],
  ['#56 oltre 100 caratteri', 'OwnConsent è registrata ' + 'x'.repeat(101) + ' presso IAB Europe.'],
  ['#56 su due frasi', 'OwnConsent è registrata. Lo ha confermato IAB Europe.'],
  ['#56 identificativo', 'cmpId=1234'],
  ['controllo originale', 'CMP ID: 1234'],
  ['controllo originale', 'La CMP è registrata presso IAB Europe.'],
  ['controllo originale', 'CMP certificata da IAB Europe.'],
  ['controllo originale', 'IAB Europe ha approvato OwnConsent: CMP approvata.'],
  ['conservativo: agente IAB', 'La CMP viene registrata da IAB Europe.'],
  ['conservativo: senza agente', 'La CMP viene registrata presso IAB Europe.'],
  ['conservativo: agente IAB elisione', "La CMP viene registrata dall'IAB Europe."],
  ['conservativo: agente IAB elisione tipografica', 'La CMP viene registrata dall’IAB Europe.'],
];

const AMMESSE: Array<[string, string]> = [
  ['#57 passiva di responsabilità', 'la CMP viene registrata da noi presso IAB Europe'],
  ['#57 attiva di responsabilità', 'la registrazione della CMP presso IAB Europe la gestiamo noi'],
  ['responsabilità, agente con elisione', "La CMP viene registrata dall'agenzia presso IAB Europe."],
  ['responsabilità, apostrofo tipografico', 'La CMP viene registrata dall’agenzia presso IAB Europe.'],
  ['responsabilità, on-premise', 'La CMP viene registrata dal cliente a proprio nome presso IAB Europe.'],
  ['conformità allo standard', 'OwnConsent è conforme a IAB TCF v2.2 e v2.3, specifiche di IAB Europe.'],
  ['nessun IAB', 'La tua scelta è stata registrata.'],
  ['tabella di confronto', 'Chi registra la CMP presso IAB Europe: noi, il cliente.'],
];

for (const [origine, frase] of STATO) {
  test(`AC7 riconoscimento: stato vietato (${origine}) — «${frase.length > 80 ? frase.slice(0, 30) + '…' + frase.slice(-25) : frase}»`, () => {
    expect(violazioniAC7(frase)).not.toEqual([]);
  });
}

for (const [origine, frase] of AMMESSE) {
  test(`AC7 riconoscimento: ammessa (${origine}) — «${frase}»`, () => {
    expect(violazioniAC7(frase)).toEqual([]);
  });
}
