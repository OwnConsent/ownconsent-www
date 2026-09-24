# Divergenze ratificate

Taccuino delle divergenze fra documento di design e prodotto, **ratificate** da Andrea.
Non è un elenco di desideri: qui entra solo ciò che è stato deciso.

Si smaltisce in sessioni di design, non dentro una PR di implementazione.

## Formato

    ## A01 — titolo breve
    - Data:
    - Classe: unshipped | accessibilita | shipped-vince | pre-produzione
      (oppure `perimetro`, che non è una classe di divergenza: vedi
      «Il perimetro non è una quinta classe»)
    - Documento dice:
    - Prodotto fa:
    - Deciso: cosa vale, e perché
    - Da smaltire: cosa va aggiornato nel design, e quando

## Le quattro classi ammesse

La lista chiusa sta in `CLAUDE.md`, sezione **Metodo**. Qui la ripetizione serve solo a
compilare il campo `Classe:`:

1. `unshipped` — funzionalità non ancora costruita → si disegna lo stato vuoto;
2. `accessibilita` — il documento fallisce un requisito di accessibilità → si corregge il valore;
3. `shipped-vince` — documento contro meccanismo già in produzione → vince il secondo, segnalato;
4. `pre-produzione` — documento e prodotto divergono **prima che esista qualcosa in
   produzione**. Nessuno dei due vince per default: decide Andrea, caso per caso, e la
   decisione si registra qui come ratifica. Questa classe scade il giorno del primo
   rilascio in produzione: da lì vale la 3.

Aggiunta da Andrea il 22/09/2026. «Migliorativo» resta fuori: non è una classe.

### Il perimetro non è una quinta classe

`DESIGN-AMENDMENTS.md` registra due cose diverse. Le quattro classi qui sopra riguardano
le divergenze di **merito** fra documento e prodotto. Le voci di perimetro — **A04**,
**A06** — registrano invece una deroga al **piano**: un lotto ha toccato file che il piano
gli escludeva. Non sono una quinta classe e non vanno ricondotte alle altre quattro: sono
ratifiche di perimetro, e il campo `Classe` le nomina «perimetro».

Deciso da Andrea il 23/09/2026.

### Nota sulle voci già etichettate «fuori-lista»

La voce **A01** di questo file e i finding **D01, D03, D04, D05, D06, D07** del lotto L10
(issue #8) portavano la classe `fuori-lista` perché la classe 4 **non esisteva** quando
sono stati scritti — non perché fossero stati classificati male. Non si riclassificano in
blocco: si riclassificano quando Andrea decide ciascuna, una per una. Fino a quel momento
l'etichetta resta quella che c'è.

**A01 è già stata decisa:** Andrea l'ha riclassificata `pre-produzione` il 23/09/2026, ed
è la prima voce del file a usare la classe 4.

**D06 è già stata decisa:** Andrea l'ha ratificata `pre-produzione` il 22/09/2026; la
voce è **A08** qui sotto. D05 è stata decisa il 23/09/2026 come **A07**. Restano
quattro `D`: D01, D03, D04, D07.

Dove stanno i `D` ancora in attesa: **non sono in questo file** — sono
in `.work/8/l10/findings-design.json`, che `.gitignore` esclude; ciò che resta committato
di loro è `journal/2026-09-22/110840-orchestrator-consegna.json` e
`journal/2026-09-22/112100-design-decisione.json`, che li elencano uno per uno con la
ragione dell'esclusione dalle tre classi. Quando Andrea ne decide uno, la voce entra in
**Voci** con la sua sigla.

## Voci

## A01 — aree di `ci` rilevate sul merge commit, non sullo SHA di testa
- Data: 15/09/2026
- Classe: pre-produzione (era: fuori-lista, riclassificata il 23/09 quando la classe 4 è stata aperta) — specifica errata nel merito, ratificata da Andrea il 15/09, la sessione di design del 22/09 ha aperto la classe 4, che è quella di questa voce
- Documento dice: `docs/spec/issue-25.json`, definizioni «area site/» e «area api/»: lo stato dell'area (presente, assente, incompleta) si legge su «il commit», cioè sul «SHA osservato» della definizione «contesto ci»: per gli eventi di PR, la testa della PR. Le definizioni reggono AC5–AC9, AC13, AC17–AC19.
- Prodotto fa: su `pull_request` il checkout di default è il merge commit (ADR-0003, F6), quindi `.github/ci/area.sh` rileva le aree sul merge commit fra la testa della PR e `main` (ADR-0003, D6). Misurato sulla PR #26, run `34942254235`: il passo «SHA verificato» stampa `bbda3d2`, che è «Merge b62d60b… into 0e079fc…» con genitori `0e079fc` (`main`) e `b62d60b` (testa della PR).
- Deciso: vale il merge commit, perché ciò che deve risultare verde è quello che finirà su `main`. Deciso da Andrea, 15/09. Il check run `ci` resta sullo SHA di testa.
- Da smaltire: la spec è corretta nello stesso commit di questa voce, con la formulazione originale conservata accanto alla correzione; ADR-0003 D6 descrive ancora la divergenza come aperta e va allineato alla prossima modifica dell'ADR (@architect); una sessione di design decide se la lista chiusa delle classi si allarga.

## A02 — Componenti senza `@media`, e tre file di configurazione non previsti dal piano
- Data: 20/09/2026
- Classe: unshipped (funzionalità non ancora costruita)
- Ratificata da: Andrea, 20/09/2026

**(a) Nessun `@media` nei componenti di `site/`.** Le definizioni `@custom-media` sono
generate nel foglio globale da `site/src/lib/token-css.mjs` e **non sono usate da
nessuno**, perché l'ipotesi (b) di ADR-0002 è falsa: lightningcss elabora ogni blocco
`<style>` isolato e non le risolve.

- Documento dice: ADR-0002 dà per buono che `@custom-media` valga anche negli `<style>`
  dei file `.astro`.
- Prodotto fa: la build fallisce. Misura, inserendo per prova `@media (--bp-md) { … }`
  nello `<style>` di `site/src/components/comuni/Footer.astro` (file poi ripristinato):

      $ pnpm build
      [lightningcss] Custom media query --bp-md is not defined
        Location: site/src/components/comuni/Footer.astro:17:0
      exit=1

- Conseguenza dichiarata: **il footer resta a una colonna su ogni schermo.** Non è una
  svista del disegno: è lo stato di una funzionalità non ancora costruita.
- Da smaltire: le regole responsive rientrano nel lotto che seguirà la decisione di
  @architect su come i componenti `.astro` usano i breakpoint.
  **Aggiornamento 20/09/2026:** quella decisione è **ADR-0004** (proposta), che ha
  riprodotto la smentita fuori dal repository e fissa il meccanismo — `@media (--bp-md)` nei
  componenti, risolto da un `visitor` di Lightning CSS. Questa voce si chiude quando L06
  mette i breakpoint e il footer torna a più di una colonna. ADR-0004 ha inoltre misurato
  che l'isolamento è **per file**: la formulazione qui sopra («blocchi `<style>`») è più
  stretta del vero, perché vale anche per un `.css` globale.

**(b) Tre file di configurazione non previsti dal piano, ed effettivamente necessari.**
Il lotto L05 non li elencava fra i propri `file`; servono tutti e tre.

- `site/eslint.config.mjs` — senza, `pnpm lint` esce 0 **senza leggere i `.ts`**: un
  verde falso dentro il gate. Con `typescript-eslint` i file `.ts` del lotto vengono
  analizzati davvero.
- `site/pnpm-workspace.yaml` — dichiara le dipendenze che possono eseguire script di
  build (`esbuild`).
- `site/.npmrc` — stessa dichiarazione per il gestore di pacchetti.
  **Annotazione:** `ci` è risultato verde anche **senza** questo file (run 35462349894,
  passi `site/` tutti `success`): non è indispensabile al runner. Serve a far installare
  allo stesso modo la macchina di sviluppo e il runner.

## A03 — L04 tocca la rotta delle bozze legali, che il piano assegna a L05
- Data: 20/09/2026
- Classe: unshipped (funzionalità non ancora costruita)
- Ratificata da: Andrea, 20/09/2026

- Documento dice: il piano `docs/plan/issue-8.json` elenca per L04 i soli tre Markdown
  sotto `site/src/content/legale/` più le voci di journal, e mette esplicitamente
  `site/src/pages/legale/[slug].astro` fra i file che L04 non tocca, perché è di L05.
- Prodotto fa: L04 modifica quella rotta. È l'unico modo per chiudere **N3** senza
  violare N2: il Markdown porta il segnaposto `{{recapito}}` e la rotta lo sostituisce
  con un `mailto:` all'indirizzo di `site/src/dati/contatto.json`, **senza oggetto
  precompilato** (DP-29). Prima di questa modifica la rotta non rendeva alcun recapito e
  N3 non era soddisfacibile da nessun lotto.
- Deciso: vale la modifica. **L06 non è ancora partito**, quindi nessun lotto in corso
  possiede quel file e non c'è conflitto; la divergenza si registra lo stesso, perché il
  piano resta la fonte di chi possiede cosa.
- Misura, sulle tre pagine servite da `astro preview` dopo la modifica:

      legale/termini-di-servizio     HTTP 200  mailto: 0  subject=: 0
      legale/informativa-privacy     HTTP 200  mailto: 1  subject=: 0
      legale/cookie-policy           HTTP 200  mailto: 0  subject=: 0

- Da smaltire: quando L06 partirà, il suo mandato deve sapere che la rotta contiene la
  sostituzione del segnaposto; se il piano viene rigenerato, l'elenco dei file di L04 va
  corretto di conseguenza.

## A04 — `vite.preview.strictPort` in `site/astro.config.mjs`, fuori dal perimetro del collaudo
- Data: 21/09/2026
- Classe: perimetro (era: fuori-lista, normalizzata il 23/09 dopo la decisione sul perimetro) — divergenza di **perimetro**, non di merito: il documento non dice
  una cosa diversa, dice che quel file non si tocca in questo lotto
- Ratificata da: Andrea, 21/09/2026

- Documento dice: l'issue #8 e il suo piano delimitano il collaudo a `playwright.config.ts`,
  `e2e/` e `tests/perf/`. `site/astro.config.mjs` è configurazione del sito e appartiene ai
  lotti di `site/`.
- Prodotto fa: il collaudo chiede una porta libera al sistema operativo e la passa sia al
  comando di `astro preview` sia all'URL che interroga (`playwright.config.ts`). Il
  comportamento predefinito di `astro preview` è **ripiegare in silenzio** sulla porta
  successiva quando quella chiesta è occupata — quindi Playwright resterebbe a interrogare
  la porta chiesta, cioè il server di qualcun altro. È lo stesso difetto che la #42 ha
  chiuso per la copia temporanea; sul `webServer` principale non si può chiudere da dentro
  il perimetro, perché la porta stretta si configura in `site/astro.config.mjs`.
- Misura, occupando la porta con `python3 -m http.server` e poi chiedendola:

      senza strictPort   Port 41183 is in use, trying another one...
                         astro v7.3.3 ready · Local http://127.0.0.1:41184/      processo vivo

      con strictPort     Port 39737 is already in use   (altra esecuzione, altra porta libera)
                         [ELIFECYCLE] Command failed with exit code 1            exit=1

- Deciso: la riga entra, perché un collaudo che interroga il server sbagliato è peggio di
  un collaudo che non parte. Autorizzata da Andrea il 21/09/2026.
- Ambito effettivo, misurato e non dedotto: tocca **solo** `astro preview`. `astro dev`
  continua a ripiegare (`--port 42263` occupata → `Dev server running at
  http://127.0.0.1:42264`), perché legge `vite.server`; `astro build` non apre porte.
- Da smaltire: quando un lotto di `site/` riprenderà in mano `astro.config.mjs`, la riga
  va riletta lì — è una scelta del collaudo ospitata in un file del sito. Se il sito
  vorrà un `preview` che ripiega, il collaudo dovrà smettere di passare la porta dal di
  fuori, non il contrario.

## A05 — `$lettura_ci` nomina `site-ci.yml`, che non è mai esistito: vale `ci.yml`, job `ci`
- Data: 21/09/2026
- Classe: shipped-vince
- Ratificata da: Andrea — divergenza **D-3** di `docs/plan/issue-8.json`, sezione
  `divergenze`; eseguita da @architect nel giro di L12 (issue #8)

- Documento dice: `contracts/perf-budgets.json`, campo `$lettura_ci`: «La CI (L12,
  `.github/workflows/site-ci.yml`) legge le soglie per chiave da questo file **e le
  confronta** con l'output del test di laboratorio di L07». Due affermazioni, entrambe
  superate: il nome del workflow e un confronto fatto dalla CI.
- Prodotto fa: il contesto che blocca le PR è il job `ci` di `.github/workflows/ci.yml`,
  costruito dopo il contratto con la PR #26 e ADR-0003. Nessun `site-ci.yml` è mai
  esistito. E il confronto lo fa **un solo comparatore**, il test di L07, non la CI
  (ADR-0001, «Come la CI legge le soglie»).
- Misura, sulla testa di `main` (`8135bff`), letta con un comando e non a memoria:

      $ git ls-tree -r --name-only origin/main -- .github/workflows/
      .github/workflows/ci.yml
      .github/workflows/claude-nightly-maintenance.yml
      .github/workflows/claude-pr-review.yml
      .github/workflows/claude-release-comms.yml

      $ git ls-tree -r --name-only origin/main -- .github/ | grep -c site-ci
      0

      $ git show origin/main:.github/workflows/ci.yml | grep -n '^jobs:\|^  ci:\|name: ci'
      17:jobs:
      18:  ci:
      19:    name: ci

      $ gh api 'repos/OwnConsent/ownconsent-www/commits/8135bff…/check-runs?filter=latest' \
          --jq '[.check_runs[] | {name, app: .app.slug, conclusion}]'
      [{"app": "github-actions", "conclusion": "success", "name": "ci"}]

- Deciso: vale il prodotto. Il campo `$lettura_ci` è riscritto: nomina `ci.yml` e il job
  `ci`, dice che il comparatore è uno solo e che la CI non rilegge il file né
  reimplementa il confronto, e rimanda a ADR-0003 D3 per stabilire se il comando del test
  sia un passo di `ci`. **Nessuna soglia è stata toccata, nessuna chiave rimossa o
  rinominata**: 24 chiavi prima, 24 dopo, una sola con valore diverso (`$lettura_ci`),
  verificato confrontando il file prima e dopo.
- Nota di proprietà: `contracts/perf-budgets.json` è di @performance
  (`contracts/README.md`). La modifica è eseguita da @architect come ratifica già decisa
  (D-3), non come decisione nuova, ed è la strada che ADR-0003 aveva scritto per questo
  campo («la correzione passa da una sezione di @architect nel giro di L12»).
- Da smaltire: **niente**. Sul nome non restava nulla di aperto. Restava aperta **D3** di
  ADR-0003 (il test di laboratorio dentro o fuori `ci`), che è una decisione e non una
  divergenza: si è chiusa lo stesso giorno, con la misura di variabilità sul runner
  (5 esecuzioni sullo stesso SHA, scarto massimo 44 ms su una soglia di 2500 ms), e il
  campo `$lettura_ci` è stato riletto e aggiornato di conseguenza — adesso dice che il
  comando del test **è** un passo del job `ci`, invece di rimandare a una domanda aperta.
  Verifica, come sopra: 24 chiavi prima, 24 dopo, una sola con valore diverso.

## A06 — Il piano dava a L12 due percorsi; ADR-0003 gliene imponeva sette
- Data: 21/09/2026
- Classe: perimetro — il documento non dice una cosa diversa nel merito, dice che quei
  file non si toccano in questo lotto. Stessa classe di A04
- Ratificata da: Andrea, 21/09/2026

- Documento dice: `docs/plan/issue-8.json` assegna a L12 due soli percorsi, e dichiara
  vuoto l'elenco dei contratti da aggiornare per l'intera issue. Misurato sul piano
  committato, non a memoria:

      $ python3 -c "import json; d=json.load(open('docs/plan/issue-8.json')); \
          l=[x for x in d['lotti'] if x['id']=='L12'][0]; \
          print(l['file']); print(d['contratti_da_aggiornare'])"
      ['.github/workflows/ci.yml', 'journal/2026-09-19/*-devops-*.json']
      []

  E mette `tests/ci/**` fra i file che L12 **non tocca**: «sono i test della issue #25
  sulla forma del workflow. Se uno fallisce dopo la modifica, il lotto si ferma e torna
  ad @architect».

- Prodotto fa: il lotto ha toccato sette percorsi fuori da `journal/`.

      $ git diff --name-only origin/main..HEAD -- . ':(exclude)journal'
      .github/workflows/ci.yml
      DESIGN-AMENDMENTS.md
      contracts/perf-budgets.json
      docs/adr/0001-budget-pagine-pubbliche-laboratorio.md
      docs/adr/0002-struttura-site.md
      docs/adr/0003-contesto-ci.md
      tests/ci/test_ac06_ac07_site_steps.py

- Perché: non è iniziativa di un agente. Lo impone `docs/adr/0003-contesto-ci.md`, che
  aveva fissato quattro scadenze sul giro di L12 e le aveva scritte **prima** che il
  piano esistesse:

  - riga 186, D3: «Scadenza: il giro di L12 della issue #8, prima che L12 scriva una riga
    di workflow. Senza una sezione datata di questo ADR, L12 non parte.» → `docs/adr/0003-*`
  - riga 425: «`contracts/perf-budgets.json:33` … Correzione di @performance, tramite una
    sezione di @architect, nel giro di L12.» → `contracts/perf-budgets.json` e, come
    registro della ratifica, `DESIGN-AMENDMENTS.md` (voce A05)
  - riga 429: «Serve una sezione datata in ADR-0002 al giro di L12» → `docs/adr/0002-*`
  - riga 432: «Serve una nota datata in ADR-0001 al giro di L12.» → `docs/adr/0001-*`

  Il settimo percorso, `tests/ci/test_ac06_ac07_site_steps.py`, è arrivato per la strada
  che il piano stesso prescriveva: il lotto si è fermato, è tornato ad @architect, e
  @architect ha deciso **D9** in una sezione datata, assegnando la modifica a @qa-test
  (regola 3 del cantiere). La misura che ha aperto quel gate è in
  `journal/2026-09-21/151312-orchestrator-misura.json`: con il passo di installazione
  della radice scritto in forma piena, `tests/ci` passava da `Ran 55 tests / OK` a
  `FAILED (failures=5)`, `AssertionError: atteso un solo passo per il predicato, trovati 2`.
  Il test non è stato adattato alla modifica: è stato stretto sull'oggetto
  (`working-directory: site`) invece che sul verbo, con tre prove-by-reversion.

- Deciso: **era il piano a essere incompleto**, non il lotto a essere debordato. Il piano
  è stato generato senza rileggere le scadenze che ADR-0003 aveva già fissato sul giro di
  L12, e ha dichiarato `contratti_da_aggiornare: []` per un'issue che ne aveva uno da
  correggere per iscritto. Vale quello che il lotto ha fatto.

- Un terzo scarto, minore ma dello stesso tipo: il piano prevedeva per L12 voci di journal
  in `journal/2026-09-19/` e solo di `@devops`. Le voci sono in `journal/2026-09-21/` e
  sono di quattro ruoli — `orchestrator`, `architect`, `qa-test`, `devops` — perché il
  lotto ha attraversato un gate di architettura e una modifica di test. La data nel piano
  era una previsione, non un vincolo.

- Da smaltire: quando il piano della issue #8 viene rigenerato, `L12.file` deve elencare i
  sette percorsi e `contratti_da_aggiornare` non può restare vuoto. Più in generale, chi
  genera un piano legge prima la tabella **Scadenze** degli ADR in vigore e porta nei lotti
  i punti che scadono sul loro giro: è la seconda volta in questa issue che un lotto trova
  un gate che il piano non aveva (la prima è A03).

## A07 — D05 (L10): «(bozza)» nell'h1 delle tre bozze legali — chiusa senza modifica
- Data: 23/09/2026
- Classe: pre-produzione (era: fuori-lista, finding D05 di L10) — il sito non è in
  produzione, decide Andrea
- Documento dice: `docs/design/01-pagine.md` §6, §7, §8 prescrive un `<h1>` senza
  «(bozza)» («Termini di servizio», «Informativa privacy», «Cookie policy») e un `<title>`
  **con** «(bozza)» («Termini di servizio (bozza) — OwnConsent», e così le altre due).
- Prodotto fa: h1 e `<title>` portano entrambi «(bozza)», perché sono lo stesso campo.
  `site/src/pages/legale/[slug].astro` riga 23 `` const titolo = `${voce.data.titolo} — OwnConsent` ``
  e riga 49 `<h1>{voce.data.titolo}</h1>`; lo schema di `site/src/content.config.ts` è
  `.strict()`, quindi dal frontmatter non si può separare l'uno dall'altro.
- La misura che ha fatto cadere la premessa: il mandato di L15 chiedeva di togliere
  «(bozza)» dall'h1 perché «sporca titolo e risultati di ricerca», lavorando solo in
  `site/src/content/legale/`. Da lì l'unico modo è cambiare il frontmatter, che toglie la
  parola anche dal `<title>` — cioè proprio dal punto in cui il design la vuole.
- Deciso: «(bozza)» resta nel frontmatter, quindi nell'h1 e nel `<title>`. Su una bozza
  pubblicata, «(bozza)» nei risultati di ricerca è corretto, non un difetto. Resta la
  ripetizione fra h1 e contrassegno: è estetica e non vale un cambio di schema. Deciso da
  Andrea, 23/09/2026. Journal: `journal/2026-09-23/124831-orchestrator-decisione.json`.
- Da smaltire: alla prossima sessione di design, `01-pagine.md` §6-8 punto 4 si allinea
  all'h1 reso («… (bozza)»), oppure dichiara che la divergenza è accettata finché le
  pagine restano bozze.

## A08 — D06 (L10): il contratto promette 24px su ogni elemento interattivo; WCAG 2.5.8 esenta i link nel testo
- Data: 22/09/2026 (registrata il 23/09/2026)
- Classe: pre-produzione (era: fuori-lista nel finding di L10)
- Ratificata da: Andrea, 22/09/2026

- Documento dice: `contracts/design-tokens.json`, `touch-target.min-size`: 24px come
  «dimensione minima di ogni elemento interattivo»; `touch-target.min-undisturbed-space`:
  l'eccezione di 2.5.8 «in questo sistema non è usata: ogni elemento interattivo rispetta
  già min-size». La stessa regola, senza eccezioni, è in
  `docs/design/00-sistema-e-componenti.md` riga 20: «Ogni elemento interattivo rispetta
  `touch-target.min-size` (24×24 CSS px, WCAG 2.5.8)».
- Prodotto fa: il mailto del recapito del titolare nell'informativa privacy è un link in
  linea dentro un `<p>`, alto 17px a 1280×800 (rettangolo 449×17, `display: inline`,
  `font-size` 16px, `line-height` 24px). È l'unico bersaglio sotto i 24px sulle otto
  pagine, a entrambe le viewport. Misura di L10, in `.work/8/l10/findings-design.json`
  (voce D06; file non committato): `node .work/8/l10/misura.mjs http://localhost:4321
  privacy /legale/informativa-privacy/` → `bersagli_sotto_24` con un solo elemento, quel
  link; a 360×640 la lista è vuota perché il link va a capo e il rettangolo di unione
  supera i 24px, mentre il bersaglio per riga resta alto 17px.
- Deciso: **il contratto si allinea a WCAG 2.5.8.** Il prodotto è conforme: 2.5.8 esenta
  il bersaglio in linea in una frase (eccezione «Inline»). È il contratto a promettere una
  regola più severa di WCAG e a non rispettarla.
- Da smaltire: l'ADR e la modifica di `contracts/design-tokens.json` li scrive @architect
  dentro L14 (regola 2 del cantiere). Nello stesso giro va riallineata la riga 20 di
  `docs/design/00-sistema-e-componenti.md`, che porta la stessa promessa: il contratto
  corretto e il documento di design non devono contraddirsi.

## A09 — Il link «salta al contenuto» porta a `<main>`, il documento dice «al primo titolo»
- Data: 23/09/2026
- Classe: pre-produzione (nessun rilascio in produzione: `git tag -l` e
  `gh release list` vuoti il 23/09/2026, quindi la classe 3 non si applica)
- Ratificata da: Andrea, 23/09/2026

- Documento dice: `docs/design/00-sistema-e-componenti.md` righe 30-31, ordine di
  navigazione da tastiera: il link «salta al contenuto» «porta al primo titolo del
  contenuto principale (`id="contenuto"`)».
- Prodotto fa: `id="contenuto"` e `tabindex="-1"` stanno su `<main>` in
  `site/src/layouts/BaseLayout.astro` (l'id dalla #39, f7ffc19; il tabindex da L14,
  cd68e01). Dopo Invio sul link, `document.activeElement` è `<main>`: misura L14 su
  8 pagine × 2 viewport × 2 temi, 32/32
  (`journal/2026-09-23/165627-orchestrator-misura.json`); test di regressione in
  `e2e/l09-salto-al-contenuto.spec.ts`.
- Deciso: **vale il prodotto.** Ragioni di Andrea: `<main>` è il landmark giusto;
  portare il fuoco su un titolo richiederebbe comunque un `tabindex="-1"` sul titolo; il
  criterio di L09-F2 misurato 32 su 32 è scritto su `<main>`.
- Da smaltire: in una sessione di design si aggiornano le righe 30-31 di
  `docs/design/00-sistema-e-componenti.md`. Il prodotto non cambia.

## A10 — «Chi registra la CMP» nella pagina SaaS: il documento prescriveva una frase falsa
- Data: 24/09/2026
- Classe: nessuna delle quattro. Documento e prodotto concordavano, ed erano falsi
  entrambi: non è una divergenza, e la lista chiusa di `CLAUDE.md` non la copre (1 e 3
  presuppongono una funzionalità non costruita o un meccanismo in produzione, 2 un
  requisito di accessibilità, 4 una divergenza). La tassonomia non si allarga per questo.
- Ratificata da: Andrea, 24/09/2026

- Documento dice: `docs/design/01-pagine.md`, «## 2. SaaS», punto 9 della struttura:
  «OwnConsent registra la CMP presso IAB Europe per conto tuo: nessun passaggio
  amministrativo a tuo carico.»
- Prodotto fa: `site/src/pages/saas.astro` riga 57, la stessa frase parola per parola.
- Deciso: il documento di design prescriveva un'affermazione falsa sul meccanismo di
  registrazione IAB; la correzione allinea doc e pagina alla formulazione già ratificata
  il 22/09 («La registrazione della CMP presso IAB Europe la gestiamo noi: nessun
  passaggio amministrativo a tuo carico.»).
- Da smaltire: nulla; doc e pagina corretti nello stesso commit. Il falso l'ha trovato
  Andrea leggendo la frase: nessun confronto documento-contro-prodotto poteva trovarlo.
