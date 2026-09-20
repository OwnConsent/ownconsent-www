/**
 * Tre modi di sbagliare misura, trovati davvero in L07 — issue #8, richiesta di Andrea.
 *
 * ATTENZIONE A CHI LEGGE (in particolare il gate di L12): questi test NON sono criteri
 * di accettazione della issue #8. Non hanno un id `AC*`/`N*` perché non ne verificano
 * uno: verificano il METODO di misura del collaudo stesso — tre famiglie di difetti che
 * fanno sembrare valida una misura che non lo è. Non toccano `site/`, non aprono una
 * pagina del sito: costruiscono da soli, in memoria, il caso sano e il caso malato per
 * ciascun difetto (page.setContent / stringhe cheerio), come richiesto.
 *
 * Struttura a prova-by-reversion per ciascuno dei tre (CLAUDE.md: «un bug è corretto
 * quando esiste un test che, rimettendo il codice com'era, fallisce»): il modo giusto
 * di misurare passa sul caso sano E rifiuta il caso malato; il modo sbagliato di
 * misurare, sullo stesso caso malato, dà un falso verde — e lo dimostriamo esplicitamente,
 * non lo diamo per assunto.
 */

import { test, expect } from '@playwright/test';
import * as cheerio from 'cheerio';

test.describe('Modi di sbagliare misura (strumenti di L07, non prodotto)', () => {
  test('1. Un build verde che non esercita il codice sotto esame', async () => {
    // Verità di terra: il controllo "vero" (quello che guarda davvero il contenuto)
    // registra se è stato raggiunto. È l'unico modo di distinguere "verde" da
    // "verde perché non ha guardato niente".
    let esaminata: boolean;
    function controlloVero(html: string): void {
      esaminata = true;
      expect(html.includes('CIFRA-VIETATA'), 'nessuna cifra vietata nel contenuto').toBe(false);
    }

    // MALATO — il modo sbagliato di misurare: se non c'è contenuto (pagina rotta, es.
    // un 404 con corpo vuoto), il controllo si limita a non fare nulla e a uscire senza
    // eccezioni. La suite riporta "passato", ma il percorso sotto esame non è mai stato
    // attraversato: esattamente il difetto della guardia anti-404 di questo lotto, che
    // in tests/perf/ ha nascosto due bug di percorso perché il codice sotto esame non
    // veniva mai raggiunto.
    function controlloIngenuo(html: string): void {
      if (html.trim() === '') {
        return; // "niente da controllare": esce verde in silenzio
      }
      controlloVero(html);
    }

    // SANO — il modo giusto di misurare: una guardia di esistenza (lo stesso principio
    // di e2e/guardia-esistenza.ts) che dichiara fallito il caso in cui il percorso non è
    // stato raggiunto, invece di lasciarlo passare per il vuoto.
    function controlloConGuardia(html: string): void {
      expect(html.trim().length, 'guardia di esistenza: pagina vuota, percorso non raggiunto').toBeGreaterThan(0);
      controlloVero(html);
    }

    const paginaRotta = ''; // rappresenta un 404 / errore: nessun contenuto servito
    const paginaSana = '<html><body><h1>Prezzi</h1><p>Da definire</p></body></html>';

    // 1a. Il modo sbagliato, sulla pagina rotta: esce verde (nessuna eccezione)...
    esaminata = false;
    expect(() => controlloIngenuo(paginaRotta), 'il controllo ingenuo NON deve sollevare eccezioni sulla pagina rotta').not.toThrow();
    // ...ma NON ha esaminato nulla: il verde non significa "attraversato".
    expect(esaminata, 'falso verde: il controllo ingenuo ha detto "ok" senza aver guardato il contenuto').toBe(false);

    // 1b. Lo stesso caso malato, con la guardia: deve fallire (rosso), rendendo visibile
    // che il percorso non è stato raggiunto, invece di scomparire nel "niente da fare".
    esaminata = false;
    let fallitoComeAtteso = false;
    let messaggioErrore = '';
    try {
      controlloConGuardia(paginaRotta);
    } catch (errore) {
      fallitoComeAtteso = true;
      messaggioErrore = String(errore);
    }
    expect(fallitoComeAtteso, 'il controllo con guardia deve fallire sulla pagina rotta, non uscire verde').toBe(true);
    expect(messaggioErrore, 'il messaggio deve dire che il percorso non è stato raggiunto').toContain(
      'percorso non raggiunto',
    );
    expect(esaminata, 'la guardia ferma il controllo PRIMA del contenuto vero: coerente, non ha esaminato nulla').toBe(
      false,
    );

    // 1c. Sul caso sano, la guardia lascia passare E il contenuto viene davvero esaminato:
    // verde che è anche "attraversato", non solo verde.
    esaminata = false;
    expect(() => controlloConGuardia(paginaSana), 'sul caso sano il controllo con guardia non deve fallire').not.toThrow();
    expect(esaminata, 'sul caso sano il contenuto è stato davvero esaminato').toBe(true);
  });

  test("2. Le entità HTML (&#39;) falsificano una ricerca di numeri sul sorgente grezzo", async () => {
    // Un apostrofo italiano scritto come entità numerica: "dell'abbonamento" diventa
    // "dell&#39;abbonamento" nel sorgente. Rilevante per AC6, che vieta «alcun [...]
    // numero di richieste, GB, memoria o CPU che non provenga dalla configurazione»:
    // l'italiano è pieno di apostrofi (dell', l', un'offerta...).
    const htmlGrezzo =
      "<!doctype html><html><body><p>Confronto</p><p>Il prezzo dell&#39;abbonamento è da definire.</p></body></html>";

    // MALATO — il modo sbagliato di misurare: cercare cifre nel sorgente grezzo (la
    // stringa HTML così com'è, mai passata da un parser che decodifica le entità).
    const cifreNelSorgenteGrezzo = htmlGrezzo.match(/\d+/g) ?? [];
    expect(
      cifreNelSorgenteGrezzo,
      'la ricerca sul sorgente grezzo trova "39": è l\'entità dell\'apostrofo, non un numero',
    ).toContain('39');

    // SANO — il modo giusto di misurare: decodificare l'HTML (cheerio, come fa già
    // e2e/ac06-da-definire-senza-valori.spec.ts e guardia-esistenza.ts) e cercare le
    // cifre nel TESTO RESO, dove l'entità è tornata ad essere l'apostrofo che è.
    const $ = cheerio.load(htmlGrezzo);
    const testoReso = $('body').text();
    expect(testoReso, 'il testo reso contiene l\'apostrofo vero, non l\'entità').toContain("dell'abbonamento");

    const cifreNelTestoReso = testoReso.match(/\d+/g) ?? [];
    expect(
      cifreNelTestoReso,
      'nessuna cifra nel testo reso: "39" era solo l\'entità dell\'apostrofo, non un numero reale',
    ).toEqual([]);
  });

  test('3. Un regex con DOTALL (flag s) scavalca il confine fra due elementi', async () => {
    // Due frasi innocue, ciascuna nel proprio <p>, che non hanno nulla in comune se non
    // stare una dopo l'altra nel documento. Nessuna delle due contiene, da sola, la
    // frase "listino segreto".
    const html = `<!doctype html>
<html><body>
<p>Guarda il listino</p>
<p>segreto per i soli early adopter</p>
</body></html>`;

    const $ = cheerio.load(html);

    // MALATO — il modo sbagliato di misurare: un regex con DOTALL applicato al testo
    // CONTINUO di tutta la pagina. Con il flag "s" il "." copre anche l'a capo fra i due
    // </p><p>, quindi ".*" attraversa il confine fra i due elementi e "trova" una frase
    // che nel documento non esiste come tale — è cucita da due elementi diversi.
    const testoContinuo = $('body').text();
    const regexDotall = /listino.*segreto/s;
    expect(
      regexDotall.test(testoContinuo),
      'il regex DOTALL sul testo continuo scavalca il confine fra i due <p> e dà un falso positivo',
    ).toBe(true);

    // Prova di contrasto: senza il flag "s", lo stesso regex sullo stesso testo continuo
    // NON attraversa l'a capo fra i due elementi — conferma che è proprio DOTALL la causa
    // del falso positivo sopra, non un caso del testo.
    const regexSenzaDotall = /listino.*segreto/;
    expect(
      regexSenzaDotall.test(testoContinuo),
      'senza DOTALL lo stesso regex non attraversa l\'a capo fra i due <p>: non è un falso positivo',
    ).toBe(false);

    // SANO — il modo giusto di misurare: estrarre il testo PER ELEMENTO (un <p> alla
    // volta) e cercare all'interno di ciascuno, mai sul testo cucito insieme. Nessun
    // singolo <p> contiene sia "listino" sia "segreto".
    const paragrafi = $('p')
      .map((_, elemento) => $(elemento).text())
      .get();
    expect(paragrafi, 'i due frammenti sono in due <p> distinti').toEqual([
      'Guarda il listino',
      'segreto per i soli early adopter',
    ]);

    const trovatoInQualcheElemento = paragrafi.some((testo) => /listino.*segreto/s.test(testo));
    expect(
      trovatoInQualcheElemento,
      'nessun singolo <p> contiene sia "listino" sia "segreto": il match sul testo continuo era un falso positivo di confine',
    ).toBe(false);
  });
});
