// Uso: node docs/evidenza/8/l14/sessione/misura-ac07-vocabolario.mjs e2e/ac07-nessuna-registrazione-iab.spec.ts
// Applica le regex di e2e/ac07-nessuna-registrazione-iab.spec.ts (estratte dal file su origin/main) a frasi di prova.
import { readFileSync } from 'node:fs';
const src = readFileSync(process.argv[2], 'utf-8');
const idSrc = src.match(/const IDENTIFICATIVO_CMP = (\/.*\/[a-z]*);/)[1];
const blocco = src.match(/const AFFERMAZIONE_REGISTRAZIONE_IAB = \[([\s\S]*?)\];/)[1];
const IDENTIFICATIVO_CMP = eval(idSrc);
const AFF = blocco.split('\n').map((r) => r.trim().replace(/,$/, '')).filter((r) => r.startsWith('/')).map((r) => eval(r));
const frasi = [
  'OwnConsent è iscritta al registro CMP di IAB Europe.',
  'CMP autorizzata da IAB Europe.',
  'OwnConsent è accreditata presso IAB Europe.',
  'OwnConsent è riconosciuta da IAB Europe.',
  'OwnConsent figura nell\'elenco CMP di IAB Europe.',
  'OwnConsent è registrata ' + 'x'.repeat(101) + ' presso IAB Europe.',
  'OwnConsent è registrata. Lo ha confermato IAB Europe.',
  'cmpId=1234',
  'CMP ID: 1234',
  'la CMP viene registrata da noi presso IAB Europe',
  'la registrazione della CMP presso IAB Europe la gestiamo noi',
];
console.log(`regex: ${AFF.length} affermazione + 1 identificativo`);
for (const f of frasi) {
  const rosso = IDENTIFICATIVO_CMP.test(f) || AFF.some((r) => r.test(f));
  console.log(`${rosso ? 'ROSSO' : 'verde'} | ${f.length > 90 ? f.slice(0, 40) + ' [' + f.length + ' caratteri] ' + f.slice(-30) : f}`);
}
