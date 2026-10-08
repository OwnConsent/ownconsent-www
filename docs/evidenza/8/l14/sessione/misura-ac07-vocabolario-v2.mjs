// Uso: node docs/evidenza/8/l14/sessione/misura-ac07-vocabolario-v2.mjs <spec-vecchio.ts> e2e/ac07-riconoscimento.ts
// Estende misura-ac07-vocabolario.mjs: stesse frasi delle issue #56 e #57, applicate al test VECCHIO
// (regex estratte dal file, come nello strumento originale) e al NUOVO (funzione violazioniAC7 importata
// da e2e/ac07-riconoscimento.ts; richiede Node >= 22.18 per togliere i tipi).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const src = readFileSync(process.argv[2], 'utf-8');
const IDENTIFICATIVO_CMP = eval(src.match(/const IDENTIFICATIVO_CMP = (\/.*\/[a-z]*);/)[1]);
const blocco = src.match(/const AFFERMAZIONE_REGISTRAZIONE_IAB = \[([\s\S]*?)\];/)[1];
const AFF = blocco.split('\n').map((r) => r.trim().replace(/,$/, '')).filter((r) => r.startsWith('/')).map((r) => eval(r));
const { violazioniAC7 } = await import(pathToFileURL(resolve(process.argv[3])).href);

// [frase, atteso nel nuovo: 'ROSSO' | 'verde']
const frasi = [
  ['OwnConsent è iscritta al registro CMP di IAB Europe.', 'ROSSO'],
  ['CMP autorizzata da IAB Europe.', 'ROSSO'],
  ['OwnConsent è accreditata presso IAB Europe.', 'ROSSO'],
  ['OwnConsent è riconosciuta da IAB Europe.', 'ROSSO'],
  ["OwnConsent figura nell'elenco CMP di IAB Europe.", 'ROSSO'],
  ['OwnConsent è registrata ' + 'x'.repeat(101) + ' presso IAB Europe.', 'ROSSO'],
  ['OwnConsent è registrata. Lo ha confermato IAB Europe.', 'ROSSO'],
  ['cmpId=1234', 'ROSSO'],
  ['CMP ID: 1234', 'ROSSO'],
  ['la CMP viene registrata da noi presso IAB Europe', 'verde'],
  ['la registrazione della CMP presso IAB Europe la gestiamo noi', 'verde'],
];
let ok = true;
console.log('esito vecchio -> nuovo | atteso nuovo | frase');
for (const [f, atteso] of frasi) {
  const vecchio = IDENTIFICATIVO_CMP.test(f) || AFF.some((r) => r.test(f)) ? 'ROSSO' : 'verde';
  const nuovo = violazioniAC7(f).length > 0 ? 'ROSSO' : 'verde';
  if (nuovo !== atteso) ok = false;
  const mostra = f.length > 90 ? f.slice(0, 40) + ' [' + f.length + ' caratteri] ' + f.slice(-30) : f;
  console.log(`${vecchio} -> ${nuovo} | ${atteso}${nuovo === atteso ? '' : ' !!DIVERGE'} | ${mostra}`);
}
console.log(ok ? "TUTTE le frasi hanno l'esito atteso nel test nuovo" : 'ALCUNE frasi divergono');
process.exit(ok ? 0 : 1);
