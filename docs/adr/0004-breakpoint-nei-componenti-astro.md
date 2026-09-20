# ADR-0004 — I breakpoint nei componenti `.astro`: `@custom-media` risolto da un visitor di Lightning CSS

- Stato: proposta
- Data: 2026-09-20
- Deciso da: @architect
- Vincola: @frontend (L06 e seguenti), @design, @qa-test, @performance (peso del CSS emesso)
- Modifica: ADR-0002 D5 (l'ipotesi sulle `@custom-media` negli `.astro` e la tabella delle
  regole di trasformazione)
- Smaltisce: `DESIGN-AMENDMENTS.md` A02(a)

## Contesto

ADR-0002 D5 stabilisce che i valori dei breakpoint non si scrivono a mano nei componenti e
che, poiché le media query non accettano `var()`, passano da `@custom-media` risolto alla
build da Lightning CSS. Lo stesso punto dichiara un'**ipotesi da misurare in L05**: che
`@custom-media` venga risolto anche dentro gli `<style>` dei file `.astro`, con l'istruzione
«se non succede, L05 si ferma e torna qui».

### L'ipotesi è falsa

L05 l'ha misurata e smentita. La misura è annotata in `DESIGN-AMENDMENTS.md` A02(a):
inserendo `@media (--bp-md) { … }` nello `<style>` di
`site/src/components/comuni/Footer.astro`,

    $ pnpm build
    [lightningcss] Custom media query --bp-md is not defined
      Location: site/src/components/comuni/Footer.astro:17:0
    exit=1

In L05 il problema è stato risolto togliendo il breakpoint. Lo stato di `site/` oggi è
quello: nessun `@media` in nessun file, e le definizioni `@custom-media` che
`site/src/lib/token-css.mjs` genera nel foglio globale **non sono usate da nessuno**.

Questo ADR è il ritorno previsto da D5. Serve prima di L06, che scriverà cinque pagine di
breakpoint.

### La smentita è stata riprodotta fuori dal repository

Su richiesta di Andrea la misura non è stata ripresa per buona: è stata rifatta in una
riproduzione minima in una cartella temporanea fuori dal repository, con le stesse versioni
risolte di `site/` (`astro@7.3.3`, `lightningcss@1.33.0`, verificate in
`site/pnpm-lock.yaml`), `node v22.23.2`, `pnpm 12.4.1`. Un plugin espone il modulo virtuale
con le definizioni, il layout lo importa una volta, un componente usa `@media (--bp-md)`:

    $ pnpm build
    [lightningcss] Custom media query --bp-md is not defined
      Location: …/repro/base/src/components/Footer.astro:7:0
    [vite] ✗ Build failed in 93ms
    exit=1

Non è un effetto del codice di `site/`: è il comportamento di Lightning CSS sotto Astro con
questa configurazione.

### Due fatti misurati che cambiano la forma del problema

**L'isolamento è per file, non per blocco `<style>`.** ADR-0002 e A02(a) lo descrivono come
un fatto sui blocchi `<style>` dei `.astro`. È più largo: anche un normale foglio `.css`
globale non vede le definizioni di un altro file importato prima di lui.

    # definizioni in virtual:token.css, regole in src/styles/layout.css, entrambi
    # importati dal layout, nell'ordine
    $ pnpm build
    [lightningcss] Custom media query --bp-md is not defined
      Location: …/repro/A/src/styles/layout.css:7:0
    exit=1

Conseguenza: «mettere le regole responsive nel foglio globale» non basta. Devono stare nello
**stesso file** delle definizioni.

**Il punto di innesto non è un plugin Vite.** Il compilatore Astro compila i blocchi
`<style>` e invoca Lightning CSS dentro il proprio hook `load`, che nella catena sta prima
dei plugin utente. Un plugin con `enforce: 'pre'` non vede mai né il `.astro` né il blocco:
registrando ogni id che passa da `resolveId`/`load`/`transform` si ottengono 1363 righe e
**zero** riferite ai file del progetto. Quando l'errore viene lanciato, nessun `transform` è
stato raggiunto.

## Decisione

**I componenti e i fogli globali continuano a scrivere `@media (--bp-md)`. Il breakpoint è
risolto da un `visitor` di Lightning CSS, passato in `vite.css.lightningcss`, costruito
leggendo `contracts/design-tokens.json`. `drafts.customMedia` resta attivo. Le definizioni
`@custom-media` oggi generate da `site/src/lib/token-css.mjs` si tolgono. I browser
supportati sono fissati al punto 5 e la sintassi delle media query emesse ne segue, via
`vite.build.cssTarget`.**

Quattro parti sul meccanismo, ognuna con la sua ragione misurata, più il **punto 5** sui browser —
che non dipende dal `visitor` ma vale per ogni media query che il sito spedisce.

### 1. La sintassi di scrittura non cambia

Chi scrive un componente continua a scrivere `@media (--bp-md)`, come previsto da ADR-0002.
Nessun valore letterale, nessuna riga rituale da ricordare in testa a ogni blocco.

### 2. Il visitor risolve, e gira dove gira Lightning CSS

Un `visitor` passato in `vite.css.lightningcss` gira **dentro la stessa `transform` che il
compilatore Astro invoca**, quindi raggiunge i blocchi `<style>` che nessun plugin vede.
Legge i token e sostituisce il riferimento con la larghezza reale.

Misurato nelle tre posizioni d'uso, in un colpo solo:

    $ pnpm build
    [build] Complete!
    exit=0

    # blocco <style> di un componente        → @media (width>=768px){.piede[data-astro-cid-jo6i4kqk]{…}}
    # foglio globale committato              → @media (width>=1280px){.contenuto{…}}
    # condizione composta in un componente   → @media (width>=1280px) and (orientation:landscape){…}

Lo **scoping di Astro è conservato**: il selettore esce come
`.piede[data-astro-cid-jo6i4kqk]`, non come `.piede`. È la differenza che esclude l'opzione
del foglio globale (sotto).

Vale anche sul documento servito in sviluppo, non solo sull'output della build:

    $ pnpm exec astro dev --port 4399
    $ curl -s http://localhost:4399/ | grep -o '@media[^{]*'
    @media (width >= 1280px)
    @media (width >= 768px)

**Il visitor deve essere ricorsivo sulle condizioni.** In
`@media (--bp-lg) and (orientation: landscape)` il riferimento non è una feature in cima
all'albero ma un figlio di un'operazione; un visitor che guarda solo il primo livello lo
lascia passare e la build fallisce. Due dettagli di forma, pagati durante la misura:

- l'oggetto restituito va costruito sull'AST, e `Length` è avvolto
  (`{ type: 'value', value: { unit, value } }`); senza l'involucro Lightning CSS risponde
  `data did not match any variant of untagged enum MediaQueryOrRaw`;
- il `raw` di `ReturnedMediaQuery` sostituisce la query **intera**, quindi non serve quando
  va cambiata solo una condizione annidata.

### 3. `drafts.customMedia` resta attivo: è il guardiano dei refusi

Non serve più a risolvere le definizioni — quelle non ci sono più. Serve perché un
riferimento che il visitor **non** riconosce resti un `@custom-media` non definito, e quindi
un errore di build che dice il file e la riga:

    # @media (--bp-xl) con --bp-xl assente dai token
    $ pnpm build
    [lightningcss] Custom media query --bp-xl is not defined
      Location: …/src/components/Footer.astro:7:0
    exit=1

Vale anche per un refuso annidato in una condizione composta.

Questa riga è la ragione per cui la variante più snella è scartata. Con lo stesso visitor e
`drafts.customMedia` **non** attivo, lo stesso refuso non ferma niente:

    $ pnpm build
    [build] Complete!
    exit=0
    # e nell'output finisce: @media (--bp-xl){.piede[data-astro-cid-…]{…}}

Una media query che nessun browser interpreta: la regola non si applica mai e nulla lo
segnala. Per un layout responsive è il modo di rompersi peggiore, perché si vede solo
guardando la pagina alla larghezza giusta — cioè, in pratica, non si vede.

### 4. Le definizioni generate si togliono: sono codice morto

`site/src/lib/token-css.mjs` emette oggi una riga
`@custom-media --bp-<k> (min-width: <value>);` per breakpoint. Non le usa nessuno oggi, e
**non le userebbe nessuno nemmeno dopo questa decisione**: il visitor sostituisce il
riferimento prima che la risoluzione delle `@custom-media` entri in gioco, e l'errore sui
refusi viene dalla bozza attiva, non dalle definizioni. Misurato separando le due cose —
bozza attiva, definizioni assenti, refuso presente:

    $ pnpm build
    [lightningcss] Custom media query --bp-xl is not defined
    exit=1

Un generatore che produce codice morto è la terza possibilità, e va esclusa: la riga si
toglie dal generatore.

**Resta** `--breakpoint-<k>` fra le proprietà di `:root`: è una custom property vera,
leggibile da JavaScript e da `var()` fuori dalle media query. Le regole di trasformazione di
ADR-0002 D5 vanno corrette solo nella parte `@custom-media`.

### Chi tocca cosa

| File | Cambiamento |
|---|---|
| `site/src/lib/token-css.mjs` | non emette più le righe `@custom-media`; continua a emettere `--breakpoint-<k>` |
| `site/src/lib/` (file nuovo) | il visitor, costruito dai token, ricorsivo sulle condizioni |
| `site/astro.config.mjs` | `vite.css.lightningcss.visitor`; `drafts.customMedia` resta; `vite.build.cssTarget` dalla politica del punto 5 |
| `docs/adr/0002-struttura-site.md` | D5: ipotesi segnata come smentita, tabella corretta |
| `DESIGN-AMENDMENTS.md` | A02(a) si chiude quando L06 mette i breakpoint |
| `CLAUDE.md` o `contracts/` | dove annotare la politica browser del punto 5 perché sia leggibile fuori da questo ADR: lo decide @architect con Andrea, non questa PR |

L'attuazione **non è in questa PR**: qui entrano l'ADR e il journal. Il codice è di @frontend
nel lotto che precede o apre L06, e i test di @qa-test.

### Cosa deve verificare @qa-test

Quattro criteri, tutti già misurati sulla riproduzione, quindi tutti scrivibili come test:

1. un breakpoint valido in un blocco `<style>` produce la larghezza giusta nel documento
   **servito** (non nel sorgente): è la regola «misura, non dedurre» applicata allo stile reso;
2. un riferimento a un breakpoint inesistente **fa fallire la build**, e il messaggio nomina
   il file — prova-by-reversion naturale: togliendo `drafts.customMedia` questo test diventa
   verde a torto, cioè la build passa;
3. una condizione composta con un breakpoint annidato produce entrambe le condizioni;
4. **nel CSS prodotto da `pnpm build` non compare sintassi di intervallo** (`(width>=`,
   `(width <`, e le forme a intervallo con la lunghezza prima del nome).

Il criterio 4 in forma eseguibile:

    $ grep -rnE '\((width|height)[[:space:]]*[<>]|[<>]=?[[:space:]]*(width|height)[[:space:]]*[<>]' \
        site/dist --include='*.css' --include='*.html'

deve restituire **zero righe**. Va cercato sia nei `.css` sia negli `.html`, perché Astro
mette in linea il CSS piccolo nel documento invece di emettere un foglio separato — cercare
solo nei `.css` darebbe un verde vuoto.

Misurato con la configurazione del punto 5:

    occorrenze: 0

**Prova-by-reversion**, togliendo la riga `build.cssTarget` e rifacendo la build:

    $ pnpm build
    [build] Complete!
    exit=0                     ← la build resta VERDE
    $ grep -rnE … dist --include='*.css' --include='*.html'
    occorrenze: 3
    # dist/index.html: @media (width>=1280px), @media (width>=768px),
    #                  @media (width>=1280px) and (orientation:landscape)

Rimessa la riga: `occorrenze: 0`.

Due avvertenze per chi scrive il test, entrambe misurate:

- **la build non diventa rossa** senza `cssTarget`. Il criterio 4 deve quindi essere un
  controllo a sé sul CSS prodotto, non l'attesa di un fallimento di `pnpm build`: è l'unico
  dei quattro criteri che non ha un errore del compilatore a difenderlo, ed è esattamente il
  motivo per cui serve;
- il pattern **non** fa falso positivo su `<meta name="viewport" content="width=device-width">`,
  che è presente nel documento misurato: pretende un operatore di confronto accanto al nome.

## Alternative scartate

| Alternativa | Perché no |
|---|---|
| tutte le regole responsive nel foglio globale, nessun `@media` nei componenti | compila **solo** se le regole stanno nello stesso file delle definizioni, cioè concatenate dentro il modulo generato (in un foglio separato: `exit=1`). Le regole escono **non scoped** — `.piede` invece di `.piede[data-astro-cid-jo6i4kqk]` — quindi cinque pagine di regole responsive in un unico foglio spostano la collisione di nomi dal compilatore alla convenzione, e separano la regola dal componente che la possiede |
| plugin Vite che inietta le definizioni in ogni blocco | non raggiunge il blocco: Astro invoca Lightning CSS dentro il proprio hook `load`, prima dei plugin utente. Provato come `transform` sugli id CSS e come `transform` sul sorgente `.astro`: `exit=1`, e zero id del progetto su 1363 registrati |
| `@import` delle definizioni in testa a ogni blocco `<style>` | funziona (`exit=0`, scoping conservato), ma l'import **non può** puntare al modulo virtuale — `ENOENT: no such file or directory, open 'virtual:token.css'`, perché Lightning CSS risolve `@import` dal filesystem e non passa dal resolver di Vite. Serve quindi un file generato su disco, più una riga di `@import` da ricordare in ogni blocco con profondità relativa diversa per cartella. Dimenticarla è un errore di build, quindi non è pericoloso: è attrito ripetuto in ogni file, moltiplicato per le pagine di L06 |
| breakpoint letterali da un'unica fonte, scritti nei componenti | compila, ma il controllo committato di ADR-0002 D5 pretende **zero** righe dal `grep` sui valori letterali e ne trova 2. Escluso da un artefatto già in repository, non da un giudizio di gusto |
| visitor senza `drafts.customMedia`, definizioni non generate | la variante più snella e l'unica che sbaglia in silenzio: `exit=0` con un refuso, e `@media (--bp-xl)` spedito al browser |
| PostCSS con `postcss-custom-media` | già scartata in ADR-0002 D5 e la ragione tiene: una seconda pipeline CSS accanto a quella di Vite per un solo bisogno. Il visitor risolve lo stesso bisogno dentro la pipeline che c'è già |

## Conseguenze

**Più facile.** Aggiungere un breakpoint è una voce in
`contracts/design-tokens.json`: il visitor la conosce senza che si tocchi altro, e ogni
componente può usarla subito. Togliere un breakpoint fa fallire la build in ogni punto che
lo usava, con file e riga — al contrario di un valore letterale, che resterebbe a funzionare
per conto suo. Un refuso costa una build rossa, non un layout che non si applica.

**Più difficile.** Il progetto acquista una dipendenza da un'API non standard: il `visitor`
di Lightning CSS, con le sue forme AST. È codice che va letto due volte e che un
aggiornamento di Lightning CSS può rompere; i tre test di @qa-test sono quello che rende
l'aggiornamento un fallimento visibile invece di una regressione silenziosa. Chi scrive i
componenti, però, non vede niente di tutto questo: scrive `@media (--bp-md)`.

**Se cambiamo idea.** La sintassi di scrittura nei componenti è la stessa che avrebbero le
`@custom-media` native: se un domani Astro e Lightning CSS le risolvessero nei blocchi
`<style>`, si rimettono le definizioni nel generatore, si toglie il visitor e **i componenti
non si toccano**. È la stessa proprietà di ritorno di ADR-0002 D5: i componenti consumano
nomi, non meccanismi.

## 5. Browser supportati, e la sintassi che ne consegue

**Deciso da Andrea il 20/09/2026.** Questa sezione, nella prima stesura dell'ADR, era la
domanda aperta «quali browser il sito dichiara di supportare» (regola 8: si apre, non si
indovina). Andrea l'ha chiusa:

> **ultime due versioni maggiori di Chrome, Firefox ed Edge, più Safari e iOS dalla 15.4.**

Motivo dato, che è anche il motivo per cui la domanda non poteva restare aperta dentro L06:
**una media query non supportata non degrada, sparisce.** Non c'è un ripiego: la regola
semplicemente non si applica, e il layout resta quello di base senza che nulla lo segnali.

### Perché la domanda esisteva

Lightning CSS normalizza `min-width` in sintassi di intervallo, e quella sintassi è
supportata da Safari solo dalla 16.4:

    $ node lcss-test.mjs
    senza targets   -> @media (width>=768px){.a{color:red}}
    safari 15       -> @media (min-width:768px){.a{color:red}}
    safari 16.4     -> @media (width>=768px){.a{color:red}}
    chrome 80       -> @media (min-width:768px){.a{color:red}}

Lightning CSS sa abbassare la sintassi quando i target lo richiedono. Il `targets` passato in
`vite.css.lightningcss` **non** ha effetto (l'output resta `width>=768px`), mentre
`vite.build.cssTarget` ce l'ha:

    # vite.build.cssTarget: 'safari15'
    $ pnpm build
    @media (min-width:1280px)
    @media (min-width:768px)

Vale per **qualunque** media query il sito spedisca, non solo per quelle nate da un
breakpoint: è per questo che la decisione sta qui ma non dipende dal `visitor`.

### La configurazione

La politica va in **`vite.build.cssTarget`**, e **non** in `vite.css.lightningcss.targets`,
che è stato misurato senza effetto (sopra: con `targets` safari 15 passato lì, l'output
restava `width>=768px`).

I numeri non sono scritti a memoria. La politica è stata risolta in versioni concrete:

    $ pnpm exec browserslist 'last 2 chrome versions, last 2 firefox versions, \
        last 2 edge versions, safari >= 15.4, ios_saf >= 15.4'
    chrome 151      firefox 154     ios_saf 26.6 … 15.4
    chrome 150      firefox 153     safari  26.6 … 15.4
    edge 151
    edge 150
    (dati di browserslist 4.29.0)

Di quell'elenco a `cssTarget` serve il **pavimento**, cioè la versione più vecchia ammessa
per ogni motore:

```js
// site/astro.config.mjs
vite: {
  build: {
    // Browser supportati, deciso da Andrea il 20/09/2026.
    cssTarget: ['chrome150', 'edge150', 'firefox153', 'safari15.4', 'ios15.4'],
  },
}
```

Misura, sulle tre media query della riproduzione (componente, foglio globale, condizione
composta):

    $ pnpm build
    [build] Complete!
    exit=0
    @media (min-width:1280px)
    @media (min-width:768px)
    @media (min-width:1280px) and (orientation:landscape)

La sintassi di intervallo è sparita da tutte e tre.

**Ogni target è stato verificato da solo**, per non dare per buono che Vite li converta tutti
— un target scartato in silenzio darebbe una copertura solo dichiarata:

| `cssTarget` | prima media query emessa |
|---|---|
| `['ios15.4']` | `@media (min-width:1280px)` |
| `['safari15.4']` | `@media (min-width:1280px)` |
| `['safari16.4']` | `@media (width>=1280px)` |
| `['chrome150','edge150','firefox153']` | `@media (width>=1280px)` |

Due cose che si leggono da questa tabella: `ios` **è** onorato da Vite, e il pavimento che fa
il lavoro è il **15.4** — dalla 16.4 Safari regge l'intervallo, e i tre motori evergreen da
soli non abbassano niente. Se un domani la politica alzasse Safari alla 16.4, l'output
tornerebbe a sintassi di intervallo **senza che nulla si rompa**: è la ragione per cui serve
il criterio 4 qui sotto, che rende il cambiamento visibile invece che silenzioso.

### Aggiornare «le ultime due versioni»

`cssTarget` contiene numeri, la politica contiene «le ultime due»: i numeri invecchiano da
soli. Per Chrome, Firefox ed Edge questo **non cambia l'output** — la tabella qui sopra lo
mostra: da soli non abbassano nulla, e non lo faranno finché la politica resta sulle ultime
due versioni. Non c'è quindi da rincorrerli a ogni rilascio. Ciò che conta davvero è il
pavimento `safari15.4`/`ios15.4`, che è una data fissata da Andrea, non un bersaglio mobile.

Derivare `cssTarget` da `browserslist` a ogni build sarebbe possibile, ma si è preferito
tenere numeri espliciti: una dipendenza in più sul percorso della build, e l'output del
sito che cambia quando si aggiorna `caniuse-lite`, sono un prezzo alto per un valore che
cambia solo quando cambia una decisione di Andrea. Quando quella decisione cambia, si
cambiano queste cinque stringhe — e il criterio 4 dice subito se l'effetto è quello atteso.

## Riproducibilità

Le misure di questo ADR vengono da una riproduzione minima costruita in una cartella
temporanea **fuori dal repository**, come chiesto: sette forme provate (foglio globale
separato e concatenato, plugin Vite in due varianti, visitor con e senza bozza attiva,
`@import` verso il modulo virtuale e verso un file generato, valori letterali), ognuna con il
proprio comando e il proprio output. I comandi e gli output stanno nelle voci di journal del
2026-09-20 — `160605` (smentita riprodotta), `160800` (gate), `161000` (fallimento del
plugin Vite), `162017` (le sette forme), `162111` (la decisione), `172844` (`cssTarget`,
i target verificati uno per uno e la prova-by-reversion del criterio 4).

La riproduzione non entra nel repository: non è un artefatto del prodotto, e tenerla
significherebbe mantenere un secondo progetto Astro. Ciò che deve sopravvivere sono i tre
test di @qa-test, che misurano la stessa cosa dentro `site/`.
