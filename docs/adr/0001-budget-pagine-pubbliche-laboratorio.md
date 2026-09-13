# ADR-0001 — Budget delle pagine pubbliche: soglie di laboratorio ora, p75 di campo quando c'è traffico (ratifica di L01)

- Stato: **proposta, con obiezione** (ratifica del 2026-09-13, giro R-L01). O2 è chiusa,
  O1 è chiusa sulla soglia; resta **O1r**, sull'etichetta del profilo di rete e sulla
  parola «peggiore» nella nota della soglia, da chiudere da @performance prima del merge
  di PR-2. Vedi la sezione «2026-09-13 — Ratifica della risposta di @performance».
- Stato alla prima stesura: proposta, con obiezione. Due punti del metodo (O1, O2) da
  chiudere da @performance, proprietario del contratto, prima del merge di PR-2 (vedi
  «Obiezione»). Il resto ratificato.
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

## 2026-09-13 — Ratifica della risposta di @performance (giro R-L01)

Sezione aggiunta. Quella sopra è la prima stesura e resta com'è.

Esito: **proposta, con obiezione.** O2 è chiusa. O1 è chiusa sulla soglia e su come la
motiva, non sull'etichetta del profilo di rete: resta l'obiezione **O1r**, sotto. Da
questo giro nulla è stato riscritto in `contracts/perf-budgets.json` (DP-01).

### Cosa ho esaminato

- Commit di @performance: `d0806d7` (voce `journal/2026-09-13/202805-performance-decisione.json`),
  `2dbe9d4` (contratto), `e7a52da` (voce di fallimento sul sandbox).
- `git diff 389ade6 HEAD -- contracts/perf-budgets.json`: cambiano i campi `strumento`,
  `rete` e `$nota_soglie_lab`; si aggiunge `isolamento_esecuzioni`. Nessuna chiave è
  rimossa o rinominata e nessun numero cambia (2500, 0.05, 60, 25, 2000, 0.05): nessun
  percorso di deprecazione.

### Nuova misura sulle fonti

Nella prima stesura avevo dichiarato un limite: i moltiplicatori letti in un commit
storico, il profilo corrente solo in un riassunto. In questo giro ho letto il sorgente
corrente, ramo `main` al 2026-09-13.

- Lighthouse `core/lib/lantern/lantern.js` non definisce le costanti: le riesporta da
  `@paulirish/trace_engine/models/trace/lantern/lantern.js`.
- devtools-frontend `front_end/models/trace/lantern/simulation/Constants.ts`:
  `DEVTOOLS_RTT_ADJUSTMENT_FACTOR = 3.75`, `DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR = 0.9`.
  `mobileSlow4G` ha `rttMs: 150`, `throughputKbps: 1.6 * 1024`,
  `requestLatencyMs: 150 * DEVTOOLS_RTT_ADJUSTMENT_FACTOR`,
  `downloadThroughputKbps: 1.6 * 1024 * DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR`,
  `uploadThroughputKbps: 750 * DEVTOOLS_THROUGHPUT_ADJUSTMENT_FACTOR` e `cpuSlowdownMultiplier: 4`.
- devtools-frontend `front_end/core/sdk/NetworkManager.ts`: `const slow4GTargetLatency = 150;`.
  Nello stesso file, `Slow4GConditions` ha `download: 1.6 * 1000 * 1000 / 8 * .9`,
  `upload: 750 * 1000 / 8 * .9`, `latency: slow4GTargetLatency * 3.75`. È il preset
  «Slow 4G» di Chrome DevTools, applicato con la stessa emulazione di rete per richiesta.
- Calcolo, `python3 -c "print(1.6*1000*1000/8*.9, 750*1000/8*.9, 150*3.75); print(1.6*1000*1000/8, 750*1000/8)"`:
  `180000.0 84375.0 562.5` e `200000.0 93750.0`.

Limiti della misura. Ho letto i file con WebFetch, che restituisce un estratto chiedendo
il testo alla lettera, non con un clone git, e senza fissare un commit. Che il pacchetto
`@paulirish/trace_engine` sia costruito da devtools-frontend lo deduco dal percorso
d'importazione, non l'ho verificato. Il valore del preset di Chrome DevTools, invece, non
dipende da quella deduzione.

### Esito punto per punto

| Punto | Esito | Motivo |
|---|---|---|
| O2, `isolamento_esecuzioni` | **chiusa** (`2dbe9d4`) | il campo dice esecuzione a freddo, un `browser.newContext()` nuovo per ciascuna delle 5 esecuzioni, nessuno storage, cookie o cache condivisi, cache HTTP vuota, nessun service worker, e il motivo (la cache calda salta la rete limitata). È quanto chiedeva O2. La parentesi sul service worker cita ADR-0002 D9, che su questo ramo non c'è (`ls docs/adr/` elenca solo 0000 e 0001): la dichiarazione vale anche senza quella parentesi |
| O1, soglia `lcp_ms_lab_mediana` = 2500 | **ratificata** (`2dbe9d4`) | l'uscita scelta, profilo e soglia invariati e motivazione riscritta senza «condizioni più dure», è quella che la prima stesura dichiarava ammissibile. La nota rinuncia in modo esplicito a quella premessa e si regge sulla differenza di grandezza: mediana di una condizione fissata contro p75 di una popolazione. Non adottare i moltiplicatori è una scelta legittima |
| O1, testo di `$nota_soglie_lab` | **non ratificato**, vedi O1r punto 3 | la frase «il laboratorio misura sempre la condizione peggiore fissata» rimette, con «peggiore», la stessa premessa di severità che la frase dopo dichiara non adottata. Con un profilo per richiesta 3,75 volte più leggero sulla latenza dei due «Slow 4G» pubblici, «peggiore» non è dimostrato |
| O1, etichetta del campo `rete` | **non ratificata**, vedi O1r punti 1 e 2 | vedi «L'etichetta del profilo» |
| N1, CLS come somma | **chiusa** (`2dbe9d4`) | il campo dice che la somma non è la definizione corrente di web.dev e perché la misura resta prudente |
| N2, momento di lettura dell'LCP | **chiusa** (`2dbe9d4`) | ultima entry con `buffered: true`, letta dopo `load`. Resta non specificato per quanto tempo si aspetta prima di dire «non arrivano più entry»: nota **N4**, non bloccante, alla prossima revisione del file |
| N3, peso di JS e CSS per pagina | **aperta; non blocca il merge di PR-2** | le chiavi `js_iniziale_gzip_kb` e `css_gzip_kb` vengono prima di L01, e PR-2 non ne cambia né il valore né il metodo: il merge non peggiora la lacuna. Blocca invece il lavoro che la userebbe: L07 non implementa il confronto sui pesi e L05/L06 non annotano la prima misura dei pesi finché N3 non è chiusa nel contratto, altrimenti ciascuno dedurrebbe insieme di file, livello di gzip e trattamento del codice in linea |

### L'etichetta del profilo

Il campo apre con «Profilo pubblico Slow 4G di Lighthouse» e poi applica, via
`Network.emulateNetworkConditions`, `latency=150`, `downloadThroughput=200000`,
`uploadThroughput=93750`, senza fattori di correzione. Ciò che si misura è quindi un
rallentamento per richiesta di 150 ms. Nel sorgente corrente nessuno dei profili che
portano quel nome applica questa condizione:

| Profilo con il nome «Slow 4G» | Come agisce | Latenza | Giù | Su |
|---|---|---|---|---|
| Lighthouse `mobileSlow4G`, metodo `simulate` | simulazione a livello di pacchetto | 150 ms RTT | 1638,4 kbps | — |
| Lighthouse `mobileSlow4G`, metodo `devtools` | per richiesta | 562,5 ms | 1474,56 kbps | 675 kbps |
| Chrome DevTools `Slow4GConditions` | per richiesta, stessa emulazione CDP | 562,5 ms | 180000 B/s | 84375 B/s |
| **Contratto, campo `rete`** | per richiesta, stessa emulazione CDP | **150 ms** | **200000 B/s** | **93750 B/s** |

Il corpo del campo dichiara la differenza, e questo è corretto. L'etichetta però è la
parte che si ripete nelle misure allegate alle PR e che chiunque confronta con Lighthouse
o con DevTools, e nomina una condizione che la misura non riproduce. È il caso di
«suonano uguali non vuol dire sono la stessa cosa» (`CLAUDE.md`). Inoltre il primo dei
due motivi con cui il campo non adotta i moltiplicatori («la fonte del valore 3.75/0.9
per la versione corrente di Lighthouse non è verificata nel sorgente attuale») non regge
più dopo la misura qui sopra. Il secondo motivo basta da solo, e resta.

### Obiezione residua

**O1r.** Blocca il merge di PR-2. La chiude @performance in `contracts/perf-budgets.json`:
per il punto 1 si sceglie un'opzione, i punti 2 e 3 si applicano come indicato.

1. Campo `$metodo_laboratorio_pagine_pubbliche.rete`, una delle due opzioni.
   - **(a) Valori invariati** (`latency=150`, `downloadThroughput=200000`,
     `uploadThroughput=93750`). Il campo non usa più «Slow 4G», né «profilo/preset di
     Lighthouse», come nome della condizione applicata. Dice, in quest'ordine: i tre
     valori CDP; che sono i valori a livello di pacchetto del preset Slow 4G di
     Lighthouse (`docs/throttling.md`), applicati per richiesta senza fattori di
     correzione; che la condizione ottenuta non equivale al Slow 4G di Lighthouse né a
     quello di Chrome DevTools, che per richiesta applicano 562,5 ms di latenza.
   - **(b) Valori del preset «Slow 4G» di Chrome DevTools** (`latency=562.5`,
     `downloadThroughput=180000`, `uploadThroughput=84375`), con la fonte
     `front_end/core/sdk/NetworkManager.ts`, `Slow4GConditions`. In questo caso
     l'etichetta «Slow 4G di Chrome DevTools» è corretta. Se con questa condizione 2500
     va rivisto, lo decide @performance e lo motiva.
2. Solo con (a): nello stesso campo si toglie il motivo «fonte non verificata nel
   sorgente attuale», smentito dalla misura di questa sezione. Resta il motivo che la
   soglia non ha bisogno di quella premessa. Con (b) il paragrafo sui moltiplicatori va
   riscritto comunque, perché i moltiplicatori diventano adottati.
3. Con entrambe le opzioni: in `pagine_pubbliche.$nota_soglie_lab` nessuna parola afferma
   che la condizione di laboratorio sia peggiore, più dura o più severa di quelle di
   campo. Nella frase «il laboratorio misura sempre la condizione peggiore fissata a ogni
   esecuzione» si toglie «peggiore»; il resto dell'argomento non cambia.

Il giro successivo di ratifica verifica solo O1r. Tutti gli altri punti di questo ADR
sono ratificati e non si riaprono, salvo le scadenze già scritte.

### Alternative scartate in questo giro

| Alternativa | Perché no |
|---|---|
| «Accettata», con l'etichetta come nota non bloccante | l'etichetta è ciò che leggono L07, la CI e chi confronta le misure delle PR con Lighthouse o DevTools. Lo scarto è di 3,75 volte sulla latenza, sotto un nome che Chrome DevTools usa per la stessa chiamata CDP con altri valori. Una nota non bloccante resterebbe nel contratto per inerzia |
| Correggere io l'etichetta o la nota | DP-01: ratificare non è riscrivere, il contratto è di @performance |
| Chiedere di adottare i moltiplicatori | la prima stesura dichiarava ammissibile l'uscita senza moltiplicatori, e la soglia ora non ne dipende. L'opzione (b) resta una scelta di @performance, non una condizione |
| Rendere N3 bloccante per il merge | PR-2 non tocca le chiavi dei pesi né il loro metodo. Il blocco va messo dove la lacuna farebbe danno: l'implementazione del confronto sui pesi e la loro annotazione |

### Costo del ritorno di questo giro

Tenere O1r costa un giro di @performance su tre frasi di un campo e una parola di una
nota; nessun numero è contestato, salvo che @performance scelga (b). Se Andrea, che ha il
gate del merge, ritiene l'etichetta accettabile così, la decisione si rovescia con una
sezione datata in questo ADR, senza toccare il contratto.

### Consumatori impattati, aggiornamento

| Agente (lotto) | Impatto di questo giro |
|---|---|
| @performance (L01) | chiude O1r (punti 1–3); N3 e N4 alla prossima revisione del file, N3 prima che parta il confronto sui pesi |
| @qa-test (L07) | può implementare isolamento delle esecuzioni, lettura di LCP e calcolo del CLS come scritti. I valori di rete aspettano O1r, perché con (b) cambiano. Non implementa il confronto sui pesi finché N3 è aperta |
| @devops (L12) | nessun cambiamento: un solo comparatore, quello del test |
| @frontend (L05, L06) | non annotano la prima misura dei pesi JS e CSS finché N3 è aperta |
| Consegna 2, area cliente | nessun cambiamento |
