# Bozza di issue — ADR-0002: tre errori tecnici, il «vincolo aperto» di D6, D-2 fuori da DESIGN-AMENDMENTS.md

Scritta l'08/10/2026 dalla sessione di `ownconsent-www`, su richiesta di Andrea. **Non è
aperta:** la apre Andrea, o la porta in una sessione Design. L'ADR è
`docs/adr/0002-struttura-site.md` in questo repository, letto per intero su `main` a
`821e5b3`. Nessuna modifica all'ADR è stata fatta: i contratti e gli ADR si toccano via
`@architect`.

**Avvertenza.** Andrea non ha dettato quali siano i tre errori: li ho ricavati
confrontando l'ADR con il prodotto. Non so se coincidono con quelli che aveva in mente.
Dopo i tre c'è l'elenco di ciò che ho controllato e trovato conforme, così si vede dove
ho guardato.

Titolo proposto: **ADR-0002: tre affermazioni tecniche da correggere, D6 ancora «vincolo
aperto», D-2 assente da DESIGN-AMENDMENTS.md**

---

## 1. D6, righe 293–299 — le «vie di fuga» valgono solo con `!important`

**L'ADR dice.** Fra le «sole vie di fuga rimaste, vietate»: «attributo `style` che imposta
`outline` (gli stili legati all'elemento precedono i livelli)» (righe 295–296) e «un
nuovo `@layer` dichiarato prima di `focus`» (riga 297).

**Misura.** Verificato, in Chromium 153.0.8010.12 (quello di Playwright alla radice), con
la regola di `site/src/styles/focus.css` e un link focalizzato con Tab; letti gli stili
calcolati dell'elemento attivo:

| Caso | `outline` calcolato | Anello |
|---|---|---|
| controllo, nessuna regola in più | `solid 2px rgb(122, 75, 0)` | c'è |
| regola di componente senza livello, `outline: none` | `solid 2px` | c'è |
| regola di componente senza livello, `outline: none !important` | `solid 2px` | c'è |
| attributo `style="outline: none"` | `solid 2px` | **c'è** |
| attributo `style="outline: none !important"` | `none` | tolto |
| livello dichiarato prima di `focus`, con `!important` | `none` | tolto |
| livello dichiarato prima di `focus`, senza `!important` | `solid 2px` | **c'è** |
| livello dichiarato dopo `focus`, con `!important` | `solid 2px` | c'è |

**Che cosa è sbagliato.** Un attributo `style` senza `!important` non toglie l'anello: la
regola del livello è `!important`, e l'importanza si decide prima degli stili legati
all'elemento. Lo stesso per un livello dichiarato prima di `focus`: è una via di fuga
solo se la sua dichiarazione è `!important`. La garanzia di D6 è quindi più forte di come
l'ADR la descrive, e le due vie di fuga sono più strette.

**Correzione proposta.** Annotazione datata in fondo all'ADR (il testo di D6 resta com'è,
come per gli altri aggiornamenti): le due vie di fuga sono «attributo `style` con
`outline … !important`» e «un `@layer` dichiarato prima di `focus` con una dichiarazione
`!important`». La terza, `overflow` che taglia l'anello, non cambia.

**Limiti.** Misurato in un solo motore, su una pagina minima e non sul sito servito. Il
commento in testa a `site/src/styles/focus.css` ripete la formulazione dell'ADR («nessuna
regola di componente vive in un livello dichiarato prima di "focus"»): è un file di
`@frontend`, non toccato.

## 2. D8, riga 366 — «nessun `pnpm-workspace.yaml`», ma il file esiste

**L'ADR dice.** «Due progetti indipendenti, **nessun** `pnpm-workspace.yaml`».

**Misura.** Verificato:

```
$ git ls-files | grep pnpm-workspace
site/pnpm-workspace.yaml
$ cat site/pnpm-workspace.yaml
allowBuilds:
  esbuild: true
$ git log --format='%h %cs %s' -- site/pnpm-workspace.yaml
718d54a 2026-09-20 feat(site): L05 — impalcatura di site/ (#8) (#34)
```

**Che cosa è sbagliato.** Il file c'è dal lotto L05. Non dichiara pacchetti (nessuna
chiave `packages`): contiene solo un'impostazione di pnpm. La decisione di D8 — due
progetti, due lockfile, niente workspace — regge; la frase che la esprime è falsa alla
lettera, e chi la verifica con un `ls` trova il contrario.

**Correzione proposta.** Annotazione: «nessun workspace pnpm: nessun file dichiara
`packages`. `site/pnpm-workspace.yaml` esiste e contiene solo impostazioni di pnpm
(`allowBuilds`)». Da decidere se la divergenza va anche in `DESIGN-AMENDMENTS.md` come
classe 4 (pre-produzione): documento e prodotto divergono e nulla è in produzione.

**Limiti.** Che con pnpm 12.4.1 quell'impostazione debba stare in quel file, e non possa
stare altrove, è dedotto: non ho provato a spostarla.

## 3. D8, righe 373–374 — il comando di `webServer` non è quello che l'ADR prescrive

**L'ADR dice.** «`webServer` di Playwright costruisce e serve con `pnpm --dir site build` e
`pnpm --dir site preview`».

**Misura.** Verificato per lettura, `playwright.config.ts` riga 138:

```
command: `pnpm --dir site build && pnpm --dir site preview --port ${PORTA} --host 127.0.0.1 --ignore-lock`,
```

**Che cosa è sbagliato.** Con il comando dell'ADR il collaudo non parte. Il commento in
testa a `playwright.config.ts` dice perché: con Astro 7 `astro preview` si sgancia in un
processo in background e il comando in primo piano esce subito, così Playwright dichiara
il server morto («Process from config.webServer exited early»); `--ignore-lock` lo tiene
in primo piano. La porta non è fissa: la assegna il sistema operativo. A questo si lega
`vite.preview.strictPort` in `site/astro.config.mjs`, già ratificato come A04.

**Correzione proposta.** Annotazione: il comando in vigore è quello di
`playwright.config.ts`, con `--ignore-lock`, `--host` e la porta scelta dal sistema
operativo; rimando ad A04 e alle voci di journal di L07.

**Limiti.** Il comportamento di `astro preview` senza `--ignore-lock` è **dedotto** dal
commento del file e non rimisurato oggi: la suite gira con il comando attuale (327
passati l'08/10), ma non ho rilanciato quello dell'ADR per vederlo fallire.

---

## 4. D6, righe 312–316 — «Vincolo aperto» e «Gate per @design prima di L05»

**L'ADR dice.** «Vincolo aperto, fuori dalla struttura»: nel footer l'anello misura 2,38:1
in chiaro e 1,87:1 in scuro, sotto il 3:1 di WCAG 1.4.11; «Gate per @design prima di L05».

**Stato misurato.** Il vincolo è chiuso nel prodotto, verificato per lettura:

- `site/src/components/comuni/Footer.astro`, riga 22:
  `--color-focus-ring: var(--color-focus-ring-on-inverse);`
- `journal/2026-09-22/105647-accessibility-misura.json` (L09): 96 letture sul documento
  servito, 0 non conformi, 8,80:1 in tema chiaro e 6,91:1 in tema scuro.
- L'«Aggiornamento del 2026-09-19» in fondo all'ADR registra «D6 superata sul footer».

**Che cosa non torna.** Chi legge D6 trova ancora «vincolo aperto» e un gate, senza un
rimando sul posto. In D5 l'ipotesi smentita ha un riquadro nel punto esatto («Ipotesi
SMENTITA in L05 … vedi ADR-0004»); D6 non ne ha uno, e bisogna arrivare in fondo al file
per sapere che è chiuso.

**Correzione proposta.** Un riquadro in D6, sotto il paragrafo «Vincolo aperto», sul
modello di quello di D5: «Chiuso il 19/09/2026 — vedi l'aggiornamento in fondo; nel footer
vale `focus-ring-on-inverse`; misurato in L09». Non ho rimisurato oggi i due rapporti di
contrasto: li riporto dal journal.

## 5. D-2 non è in `DESIGN-AMENDMENTS.md`

**Che cosa dicono i documenti.** L'aggiornamento del 19/09 dell'ADR chiama la divergenza
sull'anello del footer «Divergenza D-2 di `docs/plan/issue-8.json`», «classe 2», decisa da
Andrea. `docs/plan/issue-8.json` la elenca con `"id": "D-2"`. `CLAUDE.md` dice: «Le
divergenze ratificate si annotano in `DESIGN-AMENDMENTS.md` e si smaltiscono lì».

**Misura.** Verificato:

```
$ grep -n "D-2" DESIGN-AMENDMENTS.md
$ grep -n -i "focus-ring\|anello" DESIGN-AMENDMENTS.md
```

Nessuna riga da entrambi. Il file ha le voci A01–A11 e nessuna riguarda l'anello di
focus. Per confronto, D-3 dello stesso piano c'è: compare nella voce A05.

**Proposta.** Una voce nuova (sarebbe A12) per D-2: classe 2, ratificata da Andrea il
19/09/2026, con «documento dice» (D6: `--color-focus-ring` ovunque), «prodotto fa»
(`focus-ring-on-inverse` nello scope del footer) e la misura di L09. Da decidere se anche
D-1 (piano committato in `docs/plan/`) va registrata: non l'ho cercata oltre il `grep`
qui sopra, che non la trova.

---

## Controllato e trovato conforme

Perché si veda dove ho guardato, e che i tre punti non sono gli unici letti:

- D1: `pnpm build` stampa `[build] output: "static"`, nessun adapter (misurato l'08/10).
- D2: `site/src/pages/sitemap.xml.ts` e i canonical usano la stessa `urlAssoluto` di
  `site/src/lib/canonical.ts`.
- D5: il comando di verifica dei valori scritti a mano restituisce zero righe su
  `site/src`. La riga `breakpoint.<k>` della tabella è superata, ma l'ADR lo dice già sul
  posto e A02 lo registra.
- D6: `site/src/styles/focus.css` contiene la regola dell'ADR, uguale.
- D7: `site/src/content.config.ts` ha una sola collezione, `glob` su `*.md`, schema
  `strict`, `bozza: z.literal(true)`.
- D8: i due `package.json` dichiarano `engines.node >=22.12.0` e `pnpm@12.4.1`.
- D9: nessun `<script>` e nessuna direttiva `client:` nei file `.astro` di `site/src`.

Un'osservazione minore, non contata fra i tre: D6 (riga 272) vuole `focus.css` importato
«prima di ogni altro stile»; in `site/src/layouts/BaseLayout.astro` l'import di
`virtual:token.css` (riga 5) precede quello di `focus.css` (riga 6). Che non abbia
effetto, perché il foglio dei token non dichiara livelli, è dedotto e non misurato.

## Non controllato

D3 (i tre segnaposto e la ricerca di G3) e D4 (schema del listino, copia temporanea) non
li ho confrontati riga per riga con il prodotto. Le misure del «Contesto» dell'ADR (versioni
di allora, `getent hosts`) sono storiche e non le ho rifatte.
