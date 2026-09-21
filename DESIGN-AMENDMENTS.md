# Divergenze ratificate

Taccuino delle divergenze fra documento di design e prodotto, **ratificate** da Andrea.
Non è un elenco di desideri: qui entra solo ciò che è stato deciso.

Si smaltisce in sessioni di design, non dentro una PR di implementazione.

## Formato

    ## A01 — titolo breve
    - Data:
    - Classe: unshipped | accessibilita | shipped-vince
    - Documento dice:
    - Prodotto fa:
    - Deciso: cosa vale, e perché
    - Da smaltire: cosa va aggiornato nel design, e quando

## Voci

## A01 — aree di `ci` rilevate sul merge commit, non sullo SHA di testa
- Data: 15/09/2026
- Classe: fuori-lista — specifica errata nel merito, ratificata da Andrea il 15/09, in attesa che una sessione di design decida se aprire una quarta classe
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
- Classe: fuori-lista — divergenza di **perimetro**, non di merito: il documento non dice
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
- Da smaltire: niente resta aperto sul nome. Resta aperto **D3** di ADR-0003 (il test di
  laboratorio dentro o fuori `ci`), che è una decisione, non una divergenza, e si chiude
  con la misura di variabilità sul runner; quando si chiude, questo campo va riletto per
  verificare che la frase di rimando a D3 sia ancora quella giusta.
