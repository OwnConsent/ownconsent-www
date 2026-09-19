// Valida la forma di listino.json alla build (ADR-0002 D4): una chiave sconosciuta o un
// tipo sbagliato fanno fallire la build. Importato una volta da astro.config.mjs (effetto
// collaterale eseguito ad ogni build/dev) cosicché nessuna pagina possa saltare il controllo.
import listino from '../dati/listino.json' with { type: 'json' };

const EUR_RE = /^\d+\.\d{2}$/;

function validaEuro(valore, contesto) {
  if (valore === null) return;
  if (typeof valore !== 'string' || !EUR_RE.test(valore)) {
    throw new Error(
      `listino.json: ${contesto} deve essere null o una stringa decimale "NN.NN", trovato ${JSON.stringify(valore)}`,
    );
  }
}

function validaChiavi(oggetto, chiaviAttese, contesto) {
  for (const chiave of Object.keys(oggetto)) {
    if (!chiaviAttese.has(chiave)) {
      throw new Error(`listino.json: ${contesto} ha una chiave sconosciuta "${chiave}"`);
    }
  }
}

function validaPianoSaas(piano, indice) {
  if (typeof piano !== 'object' || piano === null) {
    throw new Error(`listino.json: saas.piani[${indice}] non è un oggetto`);
  }
  validaChiavi(piano, new Set(['nome', 'tetto_richieste', 'canone_mensile_eur']), `saas.piani[${indice}]`);
  validaEuro(piano.canone_mensile_eur, `saas.piani[${indice}].canone_mensile_eur`);
}

function validaTagliaHosted(taglia, indice) {
  if (typeof taglia !== 'object' || taglia === null) {
    throw new Error(`listino.json: hosted.taglie[${indice}] non è un oggetto`);
  }
  validaChiavi(
    taglia,
    new Set(['nome', 'disco_gb', 'memoria_gb', 'cpu', 'prezzo_eur']),
    `hosted.taglie[${indice}]`,
  );
  validaEuro(taglia.prezzo_eur, `hosted.taglie[${indice}].prezzo_eur`);
}

export function validaListino() {
  if (!Array.isArray(listino.saas?.piani)) {
    throw new Error('listino.json: saas.piani deve essere una lista');
  }
  listino.saas.piani.forEach(validaPianoSaas);
  if (!Array.isArray(listino.hosted?.taglie)) {
    throw new Error('listino.json: hosted.taglie deve essere una lista');
  }
  listino.hosted.taglie.forEach(validaTagliaHosted);
  validaEuro(listino['on-premise']?.licenza_annuale_eur, 'on-premise.licenza_annuale_eur');
}

export function daDefinireOStringa(valore) {
  return valore === null || valore === undefined ? 'da definire' : valore;
}

validaListino();

export default listino;
