// Sonda di L13-F03 in L14 (issue #8), scritta dalla sessione (orchestrator).
// Cerca, nell'HTML servito delle 8 pagine, ogni frase che accosta IAB Europe a
// registrat*/certificat*/approvat* — in <title>, nel content di OGNI <meta> e nel testo
// del <body> — con le due regex di e2e/ac07-nessuna-registrazione-iab.spec.ts, e le
// stampa tutte: la classificazione stato/responsabilita' (docs/spec/issue-8.json, AC7,
// «interpretazione») e' di chi legge, non della sonda.
//
//   node docs/evidenza/8/l14/sonda-f03.mjs <baseURL>

import * as cheerio from 'cheerio';

const baseURL = process.argv[2];
const ROTTE = ['/', '/saas/', '/hosted/', '/on-premise/', '/confronto/', '/legale/termini-di-servizio/', '/legale/informativa-privacy/', '/legale/cookie-policy/'];
const REGEX = [
  /[^.]{0,80}\biab\s*europe\b[^.]{0,100}\b(registrat\w*|certificat\w*|approvat\w*)\b[^.]{0,40}/gi,
  /[^.]{0,80}\b(registrat\w*|certificat\w*|approvat\w*)\b[^.]{0,100}\biab\s*europe\b[^.]{0,40}/gi,
];

let totale = 0;
for (const rotta of ROTTE) {
  const risposta = await fetch(baseURL + rotta);
  const $ = cheerio.load(await risposta.text());
  const luoghi = [['title', $('title').text()]];
  $('head meta[content]').each((_, el) => {
    const nome = $(el).attr('name') ?? $(el).attr('property') ?? $(el).attr('http-equiv') ?? 'meta';
    luoghi.push([`meta ${nome}`, $(el).attr('content')]);
  });
  luoghi.push(['body', $('body').text().replace(/\s+/g, ' ')]);
  for (const [dove, testo] of luoghi) {
    // Ogni frase che nomina IAB Europe, anche quando le regex di AC7 non la prendono
    // («registra», «registri»): servono tutte per classificare stato e responsabilita'.
    for (const m of testo.matchAll(/[^.]*\biab\s*europe\b[^.]*/gi)) console.log(`   frase IAB | ${rotta} | ${dove} | ${m[0].trim()}`);
    const trovate = new Set();
    for (const r of REGEX) for (const m of testo.matchAll(r)) trovate.add(m[0].trim());
    for (const t of trovate) {
      totale++;
      console.log(`AC7 REGEX | ${risposta.status} ${rotta} | ${dove} | ${t}`);
    }
  }
  console.log(`${risposta.status} ${rotta} | meta in head: ${luoghi.length - 2}`);
}
console.log(`occorrenze: ${totale}`);
