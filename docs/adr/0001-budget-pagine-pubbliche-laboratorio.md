# ADR-0001 — Budget delle pagine pubbliche: soglie di laboratorio ora, p75 di campo quando c'è traffico (ratifica di L01)

- Stato: **proposta, con obiezione**. Due punti del metodo vanno chiusi da @performance,
  proprietario del contratto, prima del merge di PR-2 (vedi «Obiezione»). Il resto è
  ratificato.
- Data: 2026-09-13
- Deciso da: @architect (lotto L03, issue #8). La modifica è di @performance (lotto L01)
- Vincola: @qa-test (L07), @devops (L12), @frontend (L05, L06); l'area cliente della
  consegna 2

## Contesto

AC39 (`docs/spec/issue-8.json`) chiede che LCP e CLS di ogni pagina pubblica stiano
entro «le soglie di laboratorio dichiarate in `contracts/perf-budgets.json`». Su `main`
il file ha solo `lcp_ms_p75` e `cls_p75`: sono dati di campo, e prima del lancio non
esistono (DV-4). @performance ha aggiunto le soglie e il metodo sul ramo
`contracts/perf-budgets-laboratorio` (commit `87bca86`, `e16e245`, `7633b6a`), motivati
in `journal/2026-09-13/194653-performance-decisione.json`. Il piano chiede ad
@architect di ratificare senza riscrivere: se una soglia non è condivisa, lo si scrive
qui e ci si ferma, senza toccare il file. Questo ADR serve perché il cambio vincola più
lotti: L07 misura, L12 fa fallire la CI, L05 e L06 annotano i pesi.

Cosa cambia, letto con `git diff origin/main contracts/perf-budgets-laboratorio -- contracts/perf-budgets.json`:

- aggiunte: `$metodo_laboratorio_pagine_pubbliche` (radice),
  `pagine_pubbliche.lcp_ms_lab_mediana = 2500`, `pagine_pubbliche.cls_lab_mediana = 0.05`,
  `pagine_pubbliche.$nota_dati_di_campo`, `pagine_pubbliche.$nota_soglie_lab`,
  `$lettura_ci` (radice);
- nessuna chiave rimossa o rinominata; `js_iniziale_gzip_kb` 60, `css_gzip_kb` 25,
  `lcp_ms_p75` 2000, `cls_p75` 0.05, `area_cliente` e `api` invariati. L'unica riga
  tolta nel diff è `"cls_p75": 0.05`, riscritta identica con la virgola.

Nessun consumatore esistente si rompe: nessun percorso di deprecazione è necessario
(`contracts/README.md`).

Fonti esterne consultate per esaminare il metodo:

- definizione di CLS, [web.dev/articles/cls](https://web.dev/articles/cls): «the largest
  burst of layout shift scores», una finestra di sessione con meno di 1 s fra uno
  spostamento e l'altro e al massimo 5 s in tutto. Prima, «CLS measured the sum total».
- limitazione a livello di richiesta,
  [docs/throttling.md di Lighthouse](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/docs/throttling.md):
  preset mobile 150 ms, 1,6 Mbps giù, 750 Kbps su; la limitazione di DevTools agisce per
  richiesta e non per pacchetto, e Lighthouse applica dei moltiplicatori per compensare.
- moltiplicatori,
  [constants.js di Lighthouse (commit 8f500e0)](https://github.com/GoogleChrome/lighthouse/blob/8f500e00243e07ef0a80b39334bedcc8ddc8d3d0/lighthouse-core/config/constants.js):
  `DEVTOOLS_RTT_ADJUSTMENT_FACTOR = 3.75`, `DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR = 0.9`.
  Il `constants.js` corrente non li contiene più in linea: li importa da Lantern (voce di
  fallimento nel journal). Che il profilo corrente `mobileSlow4G` li usi con gli stessi
  valori l'ho letto nel riassunto di una ricerca, non nel sorgente corrente. Il limite è
  dichiarato.

## Decisione

**`pagine_pubbliche` ha due famiglie di soglie. Quelle di laboratorio
(`lcp_ms_lab_mediana`, `cls_lab_mediana`, più i pesi `js_iniziale_gzip_kb` e
`css_gzip_kb`) si verificano da ora, nella CI e in AC39. Quelle di campo (`lcp_ms_p75`,
`cls_p75`) restano nel file e non si verificano finché non c'è traffico reale.**

Esame del lavoro di L01, punto per punto:

| Punto | Esito | Motivo |
|---|---|---|
| Nessuna chiave rimossa o rinominata | ratificato | misurato sul diff, vedi Contesto |
| Strumento: Playwright, Chromium headless, `PerformanceObserver`, build servita in locale, nessun servizio terzo | ratificato | è lo stesso stack di L07 (ADR-0002 D8); nessuna richiesta a terzi dalla CI di un repository pubblico; metriche lette con le API del browser, senza librerie |
| Dispositivo: 360×640, CPU rallentata 4× via CDP | ratificato, con nota | 360×640 è la viewport di AC37. Nota: il rallentamento via CDP è relativo alla CPU della macchina, e Lighthouse lo corregge con un indice di benchmark che qui manca. La stessa build può misurare diversamente sul portatile e sulla CI. Si riapre se la stessa build supera e rientra nella soglia in esecuzioni consecutive della CI |
| Rete: «Slow 4G» via `Network.emulateNetworkConditions`, 150 ms, 1,6 Mbps, 750 Kbps | **obiezione O1** | vedi sotto |
| Esecuzioni: 5, statistica mediana | ratificato il numero e la statistica; **obiezione O2** sul tipo di esecuzione | 5 esecuzioni con mediana è una pratica pubblica e riduce il rumore di una misura singola. Il metodo però non dice se ogni esecuzione parte a cache vuota |
| `cls_lab_mediana` = 0.05 | ratificato | uguale al target di campo. Il CLS di un caricamento senza interazione non dipende dal rallentamento come l'LCP, e le pagine non iniettano contenuto (ADR-0002 D9: nessun JavaScript lato client) |
| Calcolo del CLS: «somma dei value delle entry layout-shift con hadRecentInput=false, come da definizione standard» | ratificato il calcolo, **non** la frase | la definizione corrente è la finestra di sessione più grande, non la somma (web.dev). La somma è sempre maggiore o uguale alla finestra più grande: la misura è prudente, può bocciare una pagina che il CLS vero promuoverebbe, mai il contrario. Nota N1 per @performance: la frase va corretta alla prossima revisione del file |
| `lcp_ms_lab_mediana` = 2500, più larga del p75 di campo 2000 | **accettata a una condizione**, legata a O1 | vedi «Il punto LCP» |
| `$lettura_ci` | ratificato, con una lettura | vedi «Come la CI legge le soglie» |
| `lcp_ms_p75` e `cls_p75` non letti dalla CI | ratificato | DV-4. Scadenza sotto |

### Il punto LCP

La motivazione di @performance è questa: il laboratorio misura sempre nella condizione
peggiore fissata, mentre il p75 di campo aggrega una popolazione che ha anche reti e
dispositivi migliori. Quindi la soglia di laboratorio può essere più larga di quella di
campo senza essere più permissiva.

**Il principio lo accetto.** Una mediana di laboratorio e un p75 di popolazione non sono
la stessa grandezza. Metterli allo stesso numero affermerebbe una corrispondenza che
nessuno ha misurato, e `site/` non esiste ancora, quindi non c'è una misura che sostenga
un numero più severo. 2500 ms è inoltre la soglia «good» pubblica di Core Web Vitals, e
cambiarla è una riga del file.

**La premessa però dipende dal profilo davvero applicato, e il file non la garantisce.**
`Network.emulateNetworkConditions` rallenta per richiesta, non per pacchetto. Lighthouse,
quando rallenta con la stessa chiamata, moltiplica la latenza per 3,75 e il throughput
per 0,9: 562,5 ms, 1.474,56 kbps giù, 675 kbps su. Il file applica i valori a livello di
pacchetto (150 ms, 1,6 Mbps, 750 Kbps) a livello di richiesta e li chiama «preset
pubblico di Lighthouse». Così applicato, il profilo ha una latenza per richiesta circa
3,75 volte più leggera di quella che Lighthouse usa con lo stesso preset. La frase
«condizioni più dure del campo» non è dimostrata per il metodo così com'è scritto.

Esito: **2500 ms è ratificato se il profilo di rete è quello di Lighthouse a livello di
richiesta, oppure se @performance lo motiva senza appoggiarsi a condizioni più dure.** Con
150 ms a livello di richiesta, lo scarto di 500 ms oltre il p75 di campo non lo ratifico.
Non propongo un altro numero, perché la soglia è di @performance, e il file non è stato
modificato.

### Obiezione

Punti bloccanti per il merge di PR-2, da chiudere da @performance in
`contracts/perf-budgets.json`:

- **O1, rete.** Dichiarare i valori passati a `Network.emulateNetworkConditions`
  (latenza in ms, throughput in byte al secondo, come li vuole CDP) e se includono i
  moltiplicatori di Lighthouse per la limitazione a livello di richiesta. Poi confermare o
  rivedere `lcp_ms_lab_mediana` e la sua nota. Scelte possibili: (a) valori corretti,
  562,5 ms / 1.474,56 kbps / 675 kbps, e soglia confermata; (b) valori invariati e soglia
  o motivazione rivista; (c) un'altra scelta motivata.
- **O2, esecuzioni.** Dichiarare che ognuna delle 5 esecuzioni parte a freddo: contesto
  del browser nuovo, cache HTTP vuota, nessun service worker. Con la cache calda le
  esecuzioni dalla seconda in poi non passano dalla rete limitata, e la mediana
  misurerebbe la cache.

Note non bloccanti, per la prossima revisione del file:

- **N1.** La frase sul CLS «come da definizione standard» (vedi tabella).
- **N2.** Quando si legge l'LCP: dopo l'evento `load` e dopo che non arrivano più entry
  `largest-contentful-paint`, osservando con `buffered: true`. Oggi L07 dovrebbe dedurlo.
- **N3.** Come si pesano `js_iniziale_gzip_kb` e `css_gzip_kb`. Il file dice «dal peso
  della build», ma non per quale insieme di file per pagina, con quale livello di gzip, né
  se contano gli `<style>` e gli `<script>` in linea (Astro può mettere in linea i fogli
  piccoli). Le chiavi precedono L01; la lacuna diventa visibile ora che `$lettura_ci` le
  nomina e L05 deve annotarne la prima misura.

### Come la CI legge le soglie

`$lettura_ci` si legge così, con **un solo comparatore**:

- il test di laboratorio di L07 (`tests/perf/**`) legge le soglie da
  `contracts/perf-budgets.json` per chiave, al momento dell'esecuzione, senza copiare
  numeri. Misura ogni pagina di ADR-0002 D2 e **fallisce** se un valore supera la soglia;
- il test scrive i valori misurati in un file JSON con le stesse chiavi, per pagina, come
  misura da allegare alla PR (DoD per PR). Il file sta nell'output dei test, non si
  committa;
- la CI di L12 esegue quel comando e fallisce quando il test fallisce. Non reimplementa
  il confronto: due implementazioni della stessa regola divergono in silenzio.

Se @performance intendeva un confronto separato nella CI, lo dice nel giro di O1 e O2.

## Alternative scartate

| Alternativa | Perché no |
|---|---|
| Ratificare tutto senza obiezione | O1 riguarda proprio la premessa su cui regge la soglia LCP più larga del campo: ratificarla ignorerebbe una misura di fonte pubblica che la contraddice |
| Correggere io i valori di rete o la soglia nel file | il contratto è di @performance, e il piano (L03) e il prompt di delega vietano di riscriverlo |
| Rinviare tutto l'ADR finché @performance non risponde | i punti ratificati (chiavi, strumento, CLS, lettura della CI) servono comunque a L07 e L12. Separarli dall'obiezione permette di chiudere solo quello che manca |
| Una soglia LCP uguale al p75 (2000) come condizione della ratifica | sarebbe scegliere io il numero; la stessa alternativa è scartata con motivo nel journal di L01 |
| Far confrontare le soglie alla CI con un proprio script | due comparatori della stessa regola, vedi sopra |

## Conseguenze

**Più facile.** AC39 ha soglie verificabili prima del traffico. La CI di L12 ha un solo
comando da eseguire. Le chiavi di campo restano pronte per quando ci saranno dati reali.

**Più difficile.** Il file ha due famiglie di soglie da tenere coerenti, e il loro
rapporto resta sconosciuto finché non c'è traffico. Il metodo di laboratorio dipende
dalla macchina che lo esegue (nota sulla CPU).

**Scadenze.**

- `lcp_ms_p75` e `cls_p75` non si verificano. Si riapre quando esiste una misura di
  campo, cioè una misurazione reale soggetta al consenso (DA-7): con la decisione sul
  banner della CMP sul sito, o alla pubblicazione con traffico.
- Le soglie di laboratorio dell'area cliente non ci sono. Si riapre con la consegna 2
  (piano, riuso di L06).
- La soglia LCP di laboratorio si rivede alla prima misura di L07, che è il primo
  «prima» del progetto.

**Costo del ritorno.** Dopo il merge, L07 e L12 leggono `lcp_ms_lab_mediana` e
`cls_lab_mediana`. Sostituirle o rimuoverle richiede un percorso di deprecazione
(`contracts/README.md`): la nuova chiave affianca la vecchia, i consumatori passano alla
nuova, e la vecchia si toglie con un ADR. Cambiarne il valore è una riga, ma sposta il
significato di tutte le misure precedenti.

**Consumatori impattati.**

| Agente (lotto) | Impatto |
|---|---|
| @performance (L01) | chiude O1 e O2 nel file; N1–N3 alla prossima revisione |
| @qa-test (L07) | implementa il metodo dopo O1 e O2; un solo comparatore; scrive le misure per pagina |
| @devops (L12) | esegue il comando del test; nessun confronto proprio; p75 non letti |
| @frontend (L05, L06) | annotano i pesi JS e CSS della build secondo N3, appena chiusa |
| Consegna 2, area cliente | soglie di laboratorio da dichiarare con lo stesso schema |
