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
