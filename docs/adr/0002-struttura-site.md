# ADR-0002 — Struttura di `site/` per la consegna 1

- Stato: accettata (ratificata da Andrea il 19/09/2026; vedi «Aggiornamento del 2026-09-19» in fondo)
- Data: 2026-09-13
- Deciso da: @architect (lotto L03, issue #8)
- Vincola: @frontend (L05, L06), @privacy (L04), @qa-test (L07), @devops (L12); da leggere
  per le verifiche: @code-reviewer (L08), @accessibility (L09), @design (L02, L10)

## Contesto

`site/` non esiste. La consegna 1 (`docs/spec/issue-8.json`) chiede 8 pagine pubbliche con
il contenuto già nell'HTML servito (AC1), canonical e sitemap con un dominio segnaposto
(AC2, AC3), un listino senza valori che mostra «da definire» (AC6), un solo file sorgente
per l'indirizzo di contatto (N2), nessun cookie, storage o richiesta a terzi (AC9, AC10).
Le decisioni qui sotto vincolano più lotti che lavorano in parallelo su file disgiunti
(piano, `regole_di_esecuzione`): se restassero implicite, ogni lotto le prenderebbe per
conto proprio.

Fatti misurati da questo lotto, con comando e output nel journal
(`journal/2026-09-13/*-architect-misura*.json`):

- sulla macchina: `node --version` → `v20.20.2`; `pnpm --version` → `command not found`;
  `corepack --version` → `0.34.6`;
- `npm view astro version engines` → `version = '7.3.2'`, `node: '>=22.12.0'`;
- `getent hosts` sui due domini segnaposto scelti sotto: nessuna risoluzione;
  su `example.com`: risolve (vedi D3);
- contrasto dell'anello di focus (valori di `contracts/design-tokens.json` sul ramo
  `design/token-pagine-pubbliche`): su `brand-bg` 1,06:1 (chiaro) e 1,79:1 (scuro); su
  `bg-inverse` del footer 2,38:1 (chiaro) e 1,87:1 (scuro).

Nessuna build è stata eseguita: `site/` non c'è. Dove una decisione dipende da un
comportamento di Astro o di Vite, è scritta come **ipotesi da misurare in L05**: se la
misura la smentisce, L05 si ferma e torna ad @architect, non adatta la struttura.

**Prerequisito per L05, L07 e L12:** Node ≥ 22.12 (vincolo di `engines` della versione
corrente di Astro) e pnpm attivato con corepack, con la versione fissata nel campo
`packageManager`. La tabella Comandi di CLAUDE.md la corregge L07 con i comandi eseguiti.

## Decisione

**`site/` è un progetto Astro a resa statica, senza JavaScript lato client, che legge i
dati da tre file JSON in `site/src/dati/` e i token da `contracts/design-tokens.json` al
momento della build; gli strumenti di test sono un progetto pnpm separato alla radice.**

Il dettaglio, punto per punto.

### D1 — Modalità di resa: HTML generato alla build

`output: 'static'` (predefinito), nessun adapter. Le 8 pagine, `sitemap.xml` e
`robots.txt` sono file in `site/dist/` prodotti da `pnpm build`.

- **AC1:** l'HTML è scritto su disco prima di qualunque richiesta; nessuna idratazione.
  «Reso lato server» di CLAUDE.md è definito come «il contenuto è nell'HTML servito»: un
  file generato alla build lo soddisfa (piano, `suonano_uguali`).
- **N2:** «cambio l'indirizzo, rifaccio la build, ripeto la ricerca» descrive esattamente
  questo meccanismo; il vecchio indirizzo sparisce fisicamente da `dist/`.
- **Consegna 2 (area cliente dietro l'API Go):** la resa statica non preclude rotte su
  richiesta. Aggiungere un adapter consente a singole rotte di uscire dalla pre-resa
  mentre le pagine pubbliche restano file statici (ipotesi sul comportamento di Astro ≥ 5,
  da misurare nella consegna 2 sulla versione installata). Se l'area cliente la serve
  l'API Go, `site/` non cambia affatto. La scelta la fa un ADR della consegna 2.

| Alternativa | Perché no |
|---|---|
| `output: 'server'` con `@astrojs/node` | processo Node in esecuzione in produzione per 8 pagine senza dati; una dipendenza in più; l'hosting deve eseguire codice; riapre la revisione @security (piano, `revisioni.per_ruolo`) senza un caso d'uso |
| adapter già adesso, per la consegna 2 | nessuna rotta di questa consegna lo usa: astrazione senza caso d'uso nel repository |
| resa lato client (SPA) | fallisce AC1: il contenuto comparirebbe dopo l'esecuzione di JavaScript |

Costo del ritorno: aggiungere un adapter è una dipendenza e una riga di configurazione;
il costo vero è operativo (un processo da ospitare) e di revisione di sicurezza.

### D2 — Rotte e forma degli URL

`trailingSlash: 'always'`, `build.format: 'directory'` (ogni pagina è `<rotta>/index.html`).
Canonical, sitemap e link interni usano **sempre** la barra finale.

| Pagina | Rotta | File sorgente | Lotto |
|---|---|---|---|
| Home | `/` | `site/src/pages/index.astro` | L06 |
| SaaS | `/saas/` | `site/src/pages/saas.astro` | L06 |
| Hosted | `/hosted/` | `site/src/pages/hosted.astro` | L06 |
| On-premise | `/on-premise/` | `site/src/pages/on-premise.astro` | L06 |
| Confronto modalità e listino | `/confronto/` | `site/src/pages/confronto.astro` | L06 |
| Termini di servizio (bozza) | `/legale/termini-di-servizio/` | `site/src/pages/legale/[slug].astro` + `site/src/content/legale/termini-di-servizio.md` | L05 + L04 |
| Informativa privacy (bozza) | `/legale/informativa-privacy/` | idem + `informativa-privacy.md` | L05 + L04 |
| Cookie policy (bozza) | `/legale/cookie-policy/` | idem + `cookie-policy.md` | L05 + L04 |
| Sitemap | `/sitemap.xml` | `site/src/pages/sitemap.xml.ts` | L05 |
| Robots | `/robots.txt` | `site/src/pages/robots.txt.ts` | L05 |

La sitemap elenca queste 8 rotte e nessun'altra (AC3). Canonical e sitemap costruiscono
l'URL assoluto con **una sola funzione** in `site/src/lib/` (due usi reali: canonical e
sitemap), dal valore di D3.

| Alternativa | Perché no |
|---|---|
| `build.format: 'file'`, URL senza barra (`/saas`) | servire `/saas` da `saas.html` richiede una regola di riscrittura dell'hosting, che non è nel repository e non è scelto (G3): AC1 potrebbe passare in locale e fallire pubblicato |
| `trailingSlash: 'ignore'` | due URL rispondono 200 per la stessa pagina; canonical e sitemap diventano un'ipotesi su quale dei due si richiede |

Costo del ritorno: cambiare forma degli URL dopo la pubblicazione richiede redirect
permanenti; prima della pubblicazione è una riga di configurazione più i test.

### D3 — Segnaposto e file unico di contenuto (N2)

Tre segnaposto distinti, come in `segnaposto_dichiarati` della spec (il piano, scritto
prima, ne nomina uno solo di dominio: vale la spec).

| Segnaposto | Valore | Unico file sorgente |
|---|---|---|
| dominio del sito | `https://segnaposto-dominio-sito.example` | `site/src/dati/sito.json`, campo `url` |
| nome della casella | `segnaposto-nome-casella` | `site/src/dati/contatto.json`, parte locale di `indirizzo` |
| dominio della casella | `segnaposto-dominio-casella.invalid` | `site/src/dati/contatto.json`, dominio di `indirizzo` |

**`site/src/dati/contatto.json`** è il file di N2. Forma:

```json
{
  "$segnaposto": "indirizzo: la parte prima di @ è il segnaposto del nome della casella, quella dopo è il segnaposto del dominio della casella (RFC 2606). Si sostituiscono al gate di pubblicazione G3 con i valori comunicati da Andrea.",
  "indirizzo": "segnaposto-nome-casella@segnaposto-dominio-casella.invalid",
  "oggetto": { "saas": "SaaS", "hosted": "Hosted", "on-premise": "On-premise" }
}
```

- L'indirizzo intero è scritto una volta sola, in un campo solo: la ricerca di N2 lo
  trova in un file. Nome e dominio non sono ripetuti in campi separati, così cambiare
  l'indirizzo non lascia una seconda copia stantia.
- Ogni link di contatto è `mailto:<indirizzo>?subject=<oggetto[modalità]>`, costruito da
  **una sola funzione** in `site/src/lib/` con `encodeURIComponent` sull'oggetto (tre usi:
  SaaS, Hosted, On-premise). I tre valori non contengono caratteri da codificare, quindi
  l'HTML porta esattamente `?subject=SaaS`, `?subject=Hosted`, `?subject=On-premise`.
- Nessun altro file sotto `site/` contiene l'indirizzo, il nome o il dominio della
  casella: né pagine, né componenti, né commenti, né le bozze legali (vedi D7).

**`site/src/dati/sito.json`** è l'unico punto di configurazione del dominio del sito:
`{ "$segnaposto": "…", "url": "https://segnaposto-dominio-sito.example" }`.
`site/astro.config.mjs` importa questo file per l'opzione `site`: non ripete il valore.
I test di L07 leggono i due JSON dal filesystem per sapere cosa aspettarsi.

Perché questi domini:

- RFC 2606 riserva i TLD `.test`, `.example`, `.invalid`, `.localhost` e i nomi
  `example.com/.net/.org`. I secondi **risolvono** (`getent hosts example.com` restituisce
  indirizzi): scartati, la spec chiede un dominio che non risolve.
- `.invalid` per la casella: un indirizzo per definizione non valido, che nessun client
  può recapitare. `.example` per il sito: nome da documentazione.
- TLD diversi: nessuno dei due domini è sottostringa dell'altro, quindi la ricerca di
  uno non trova mai l'altro. N2 e le due verifiche separate di G3 restano indipendenti.
- La parola `segnaposto` nel valore rende visibile a chi guarda la pagina resa che non è
  un indirizzo vero. Verifica di G3, da `site/` e da `site/dist/`:
  `grep -rn -e segnaposto-dominio-sito.example -e segnaposto-dominio-casella.invalid -e segnaposto-nome-casella`
  deve restituire zero righe.

| Alternativa | Perché no |
|---|---|
| `contatto@ownconsent.example` (esempio di `docs/design/01-pagine.md`) | lo stesso TLD del sito: la ricerca del dominio del sito troverebbe anche la casella; il documento lo dichiara solo illustrativo |
| `example.com` / `example.org` | risolvono (misurato) |
| `.localhost` / `.test` | `.localhost` risolve verso l'interfaccia locale su molti sistemi (RFC 6761), `.test` è spesso configurato dai DNS locali di sviluppo: un canonical potrebbe raggiungere davvero un server |
| file TypeScript (`contatto.ts`) | invita a mettere logica nel file dei dati; i test di L07 dovrebbero eseguire codice di `site/` invece di leggere un dato |
| dominio del sito nello stesso `contatto.json` | la procedura di N2 copia e modifica quel file; mescolare il dominio del sito alla casella rende la modifica ambigua. Sono due segnaposto con due sostituzioni (spec, `rischi`) |
| `site` scritto direttamente in `astro.config.mjs` | un file di codice che i test dovrebbero eseguire per leggere il valore atteso |

Costo del ritorno: rinominare i file cambia un import in `site/src/lib/` e i percorsi
letti dai test.

### D4 — Listino senza valori, e la configurazione di prova di AC6

**`site/src/dati/listino.json`**, oggi senza piani né valori (DP-21):

```json
{
  "$nota": "Struttura del listino senza valori commerciali (DP-21). Ogni null e ogni lista vuota si mostra come «da definire». Il denaro è una stringa decimale, mai un numero JSON.",
  "saas": { "piani": [] },
  "hosted": { "taglie": [] },
  "on-premise": { "licenza_annuale_eur": null }
}
```

Forma degli elementi, validata alla build da L05 (una chiave sconosciuta o un tipo
sbagliato fanno fallire la build):

- piano SaaS: `{ "nome": string|null, "tetto_richieste": integer|null, "canone_mensile_eur": string|null }`
- taglia Hosted: `{ "nome": string|null, "disco_gb": number|null, "memoria_gb": number|null, "cpu": number|null, "prezzo_eur": string|null }`
- importi (`*_eur`): stringa `^\d+\.\d{2}$`. È la regola del denaro di CLAUDE.md
  («mai un numero in virgola mobile») portata in un file JSON.

Resa: lista vuota → una riga di struttura senza nome con «da definire» per ogni campo;
campo `null` → «da definire». Nessun numero di richieste, GB, memoria, CPU o importo
nell'HTML delle pagine del listino proviene da altro che da questo file.

**Configurazione di prova (AC6) e procedura di N2: copia temporanea.** L07 costruisce il
sito da una copia, non da un percorso alternativo nel codice di produzione:

1. copia `site/` (senza `node_modules/`, `dist/`, `.astro/`) e `contracts/` in una
   cartella temporanea, **con gli stessi percorsi relativi** (i token si leggono da
   `../contracts/`, vedi D5);
2. sostituisce nella copia `site/src/dati/listino.json` (AC6) oppure
   `site/src/dati/contatto.json` (N2) con un file di `e2e/fixtures/`;
3. installa dal lockfile senza modificarlo (`pnpm install --frozen-lockfile`), costruisce,
   serve su una porta diversa e verifica.

La copia è un solo aiuto in `e2e/`, usato da due criteri reali (AC6 e N2). I valori della
configurazione di prova stanno solo in `e2e/fixtures/`, fuori da `site/`: sono dati di
test, non importi del listino, e non devono assomigliare a un prezzo plausibile (per
esempio numeri come `111.11` riconoscibili a colpo d'occhio).

| Alternativa | Perché no |
|---|---|
| variabile d'ambiente letta alla build (`LISTINO=…`) | un percorso di codice che esiste solo per i test; un hosting o una CI configurati male pubblicano importi di prova (regola 7) |
| configurazione Astro di test in L07 con un alias Vite | seconda configurazione che duplica quella di L05 e diverge in silenzio |
| modificare il file sul posto e ripristinarlo | un test interrotto lascia la copia di lavoro sporca; le worktree condividono il lavoro in corso |
| workspace pnpm (vedi D8) | la copia di `site/` non sarebbe autosufficiente: il lockfile starebbe fuori |

Costo del ritorno: una build in più per scenario (tempo da misurare in L07).

### D5 — Dai token al CSS senza valori scritti a mano

Un plugin Vite in `site/src/lib/token-css.mjs` (L05), registrato in `astro.config.mjs`,
espone il modulo virtuale `virtual:token.css`, generato a ogni build leggendo
`../contracts/design-tokens.json` (percorso relativo a `site/`). Il layout di base in
`site/src/layouts/` lo importa una volta. Nessun file CSS di token è committato.

Regole di trasformazione, sulla forma scritta da L02:

| Token | CSS |
|---|---|
| `color.semantic.light.<alias>.value` | `--color-<alias>` in `:root` |
| `color.semantic.dark.<alias>.value` | stesse proprietà dentro `@media (prefers-color-scheme: dark) { :root { … } }` |
| `color.primitive.*` | non emesso: i componenti usano solo gli alias semantici |
| `typography.font-family-base.value` | `--font-family-base` |
| `typography.<gruppo>.<k>.value` (`font-size`, `line-height`, `font-weight`) | `--<gruppo>-<k>` |
| `spacing.<k>.value`, `radius.<k>.value` | `--spacing-<k>`, `--radius-<k>` |
| `touch-target.<k>.value`, `focus.<k>.value` | `--touch-target-<k>`, `--focus-<k>` |
| `breakpoint.<k>.value` | `@custom-media --bp-<k> (min-width: <value>);` e `--breakpoint-<k>` |

- Le chiavi che iniziano con `_` o `$` e i campi descrittivi (`uso`, `primitivo`,
  `px_riferimento`) si ignorano; si legge solo `value`.
- Una forma non riconosciuta o un alias presente in un tema e assente nell'altro fanno
  **fallire la build**. Niente salti silenziosi.
- `:root { color-scheme: light dark }`. Il tema segue solo `prefers-color-scheme`:
  **nessun interruttore**, perché ricordare la scelta richiede storage (AC9) o script.
- Le media query non accettano `var()`: i breakpoint passano da `@custom-media`, risolto
  alla build da Lightning CSS (`vite.css.transformer: 'lightningcss'` con la bozza
  `customMedia` attiva). `lightningcss` è una dipendenza di build aggiunta da L05.
  **Ipotesi da misurare in L05:** che `@custom-media` venga risolto anche negli `<style>`
  dei file `.astro`. Se non succede, L05 si ferma e torna qui.

  > **Ipotesi SMENTITA in L05, misurata di nuovo il 20/09/2026 — vedi ADR-0004.**
  > Lightning CSS elabora ogni file isolato e non risolve le definizioni prese da un altro
  > file: non solo negli `<style>` dei `.astro`, ma anche in un normale `.css` globale.
  > `pnpm build` esce 1 con `Custom media query --bp-md is not defined`.
  > Il ritorno previsto da questa riga è avvenuto: **ADR-0004** decide come i componenti
  > usano i breakpoint (un `visitor` di Lightning CSS) e corregge la riga `breakpoint.<k>`
  > della tabella qui sopra — le definizioni `@custom-media` **non** si generano più,
  > `--breakpoint-<k>` resta. Fino all'attuazione di ADR-0004, in `site/` non c'è nessun
  > `@media` (`DESIGN-AMENDMENTS.md` A02(a)).
- Verifica dei valori a mano (L05 la esegue e annota l'output, L08 la ripete):
  `grep -rnE '#[0-9a-fA-F]{3,8}\b|[0-9.]+(px|rem|em)\b' site/src --include='*.astro' --include='*.css'`
  deve restituire zero righe.

| Alternativa | Perché no |
|---|---|
| Style Dictionary | il file di L02 non è nel formato DTCG: servirebbero trasformazioni su misura comunque, con un albero di dipendenze molto più grande |
| script che genera un `tokens.css` committato | due fonti della stessa verità; chi dimentica di rigenerare introduce una deriva che nessuno vede |
| `define:vars` nei componenti | stili in linea ripetuti in ogni pagina e nessuna media query |
| PostCSS con `postcss-custom-media` | una seconda pipeline CSS accanto a quella di Vite per un solo bisogno |
| valori dei breakpoint scritti nelle media query | viola la DoD di @frontend («nessun valore hard-coded») |

Costo del ritorno: il plugin è un file; passare a un file generato o a un altro strumento
non tocca i componenti, che consumano solo i nomi `--…`.

### D6 — Anello di focus: lo scarto garantito dalla cascata, non per convenzione

`site/src/styles/focus.css` (L05), importato dal layout di base **prima** di ogni altro
stile:

```css
@layer focus;
@layer focus {
  :focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus-ring) !important;
    outline-offset: var(--focus-ring-offset) !important;
  }
}
```

Perché è una garanzia: per le dichiarazioni `!important` la cascata (CSS Cascade 5)
inverte l'ordine dei livelli. Un `!important` dentro un livello vince su qualunque
`!important` fuori dai livelli e sui livelli dichiarati dopo. Gli stili dei componenti
Astro non stanno in un livello: nessuna regola di componente, nemmeno con `!important`,
può togliere l'anello o ridurre lo scarto. `:focus-visible` copre ogni elemento
focalizzabile, compresi quelli con `tabindex`. Si usa `outline` e non `box-shadow`, che
sparisce in modalità a contrasto forzato.

Le sole vie di fuga rimaste, vietate:

- attributo `style` che imposta `outline` (gli stili legati all'elemento precedono i
  livelli);
- un nuovo `@layer` dichiarato prima di `focus`;
- `overflow: hidden` o `clip` su un contenitore che taglia l'anello di un elemento
  focalizzabile.

Verifica, misurata e non dedotta:

- **L07**, test e2e: su ognuna delle 8 pagine, a 360×640 e 1280×800, con
  `colorScheme` chiaro e scuro, si scorre con Tab ogni elemento focalizzabile e si leggono
  gli stili calcolati dell'elemento attivo: `outline-style` uguale a `focus.ring-style`,
  `outline-width` a `focus.ring-width`, `outline-offset` a `focus.ring-offset`,
  `outline-color` a `focus-ring` del tema. I valori attesi si leggono da
  `contracts/design-tokens.json`, non si copiano. Il test cattura anche le vie di fuga:
  misura il risultato, non il sorgente.
- **L09** verifica a tastiera che l'anello non sia tagliato.

**Vincolo aperto, fuori dalla struttura:** lo scarto fa toccare all'anello lo sfondo
del **genitore**. Nel footer quello sfondo è `bg-inverse`, e lì l'anello misura 2,38:1
in chiaro e 1,87:1 in scuro, sotto il 3:1 di WCAG 1.4.11. Nessuna scelta di struttura lo
corregge: serve un valore di colore, che è di @design (divergenza di classe 2). **Gate per
@design prima di L05.**

| Alternativa | Perché no |
|---|---|
| regola globale `:focus-visible` senza livello | una regola di componente con la stessa specificità, scritta dopo, la annulla: garanzia per convenzione |
| stile di focus in ogni componente | ogni componente nuovo è un'occasione di dimenticarlo |
| `box-shadow` come anello | invisibile con i colori forzati |
| lint sul sorgente come unica verifica | non vede l'HTML delle bozze legali né gli stili calcolati; resta come aiuto, non come prova |

Costo del ritorno: un file. Se un componente avesse davvero bisogno di un focus diverso,
lo si decide qui con un ADR, non lo si aggira.

### D7 — Bozze legali: collezione `legale` e frontmatter

`site/src/content.config.ts` (L05) definisce **una sola** collezione, `legale`, con il
loader `glob` su `site/src/content/legale/*.md`. File scritti da L04:
`termini-di-servizio.md`, `informativa-privacy.md`, `cookie-policy.md`. Il nome del file
è lo slug della rotta (D2).

Schema, rigido (una chiave sconosciuta fa fallire la build):

| Campo | Tipo | Significato |
|---|---|---|
| `titolo` | stringa non vuota | testo dell'h1; il `<title>` lo compone la rotta (per esempio «Termini di servizio (bozza) — OwnConsent») |
| `descrizione` | stringa non vuota | meta description, diversa da quella di ogni altra pagina (AC2, verificata da L07) |
| `bozza` | letterale `true` | il contrassegno «bozza» dipende da questo campo; `false` fa fallire la build in questa consegna, perché togliere la bozza è una decisione di persona al gate G3 (regola 7) |

Regole sul corpo:

- solo Markdown (`.md`), niente `.mdx`: componenti e script nel contenuto non servono;
- nessun HTML grezzo con `<script>`, `<iframe>` o risorse da altre origini (AC10);
- **nessun indirizzo, nome o dominio della casella** (N2): un file Markdown non legge
  `contatto.json`, quindi scriverlo lì creerebbe un secondo file sorgente. La sezione
  «Contatti» delle bozze rimanda al titolare, che è un segnaposto dichiarato della spec.
  Se si vuole l'indirizzo commerciale anche nelle pagine legali, lo deve rendere la rotta
  da `contatto.json`. La domanda è aperta per l'orchestratore: N2 chiede che ogni link di
  contatto porti la modalità nell'oggetto, e una pagina legale una modalità non ce l'ha.

La rotta `site/src/pages/legale/[slug].astro` (L05) genera i tre percorsi con
`getStaticPaths` dalla collezione.

| Alternativa | Perché no |
|---|---|
| `bozza: boolean` | un `false` scritto per errore toglie il contrassegno senza che una persona abbia approvato |
| MDX | dipendenza in più e la possibilità di inserire componenti con script nel testo legale |
| tre pagine `.astro` scritte a mano | il testo legale di @privacy finirebbe nei file di @frontend: lotti non disgiunti |
| collezione anche per `site/src/content/pagine/` | nessun caso d'uso scritto: i testi di L06 stanno nelle pagine `.astro`; lo schema starebbe in un file di L05 |

### D8 — Strumenti di test: progetto pnpm separato alla radice

Due progetti indipendenti, **nessun** `pnpm-workspace.yaml`:

- `site/package.json` e `site/pnpm-lock.yaml`: dipendenze del prodotto (L05);
- `package.json` e `pnpm-lock.yaml` alla radice: Playwright e strumenti di test (L07).

Tutti e due dichiarano `engines.node >=22.12` e `packageManager` con la stessa versione di
pnpm. I test non importano codice di `site/`: leggono i JSON di `site/src/dati/` e di
`contracts/` dal filesystem e parlano con la build servita via HTTP. `webServer` di
Playwright costruisce e serve con `pnpm --dir site build` e `pnpm --dir site preview`.

| Alternativa | Perché no |
|---|---|
| workspace pnpm | un solo lockfile alla radice, che L05 e L07 dovrebbero modificare entrambi (lotti da serializzare); la copia di `site/` per N2 e AC6 non sarebbe autosufficiente |
| test dentro `site/` | le dipendenze di test entrano nel `package.json` del prodotto, di L05; confine fra prodotto e collaudo sfumato |

Costo del ritorno: fondere i due lockfile in un workspace è una PR meccanica su due file.

### D9 — Terze parti e JavaScript

- **Nessun JavaScript lato client** in questa consegna: nessuna direttiva `client:*`,
  nessun `<script>` nei file `.astro`, niente `ClientRouter` né transizioni di vista,
  `prefetch` non attivato. Un'eccezione è un gate verso @architect. Il budget
  `js_iniziale_gzip_kb` resta inutilizzato.
- Nessuna integrazione che inietta script (analitiche, `partytown`), nessun font
  scaricato, nessuna immagine remota; caratteri solo di sistema (`typography.font-family-base`).
- `sitemap.xml` e `robots.txt` sono endpoint propri (D2), non `@astrojs/sitemap`.
- La barra degli strumenti di sviluppo di Astro esiste solo in `pnpm dev`; L07 verifica la
  build di produzione servita.
- **Telemetria della CLI di Astro:** parte dalla macchina che esegue la build, non dal
  browser, quindi non tocca AC9 e AC10. È comunque una richiesta a terzi dalla CI di un
  repository pubblico: L12 imposta `ASTRO_TELEMETRY_DISABLED=1`.
- `lightningcss` è un binario nativo scaricato all'installazione dal registro, senza
  richieste durante l'esecuzione.
- **Rischio che resta dichiarato:** l'hosting può iniettare cookie o script fuori dal
  repository (spec, `rischi`; G3).

## Alternative scartate

Sono elencate, con il motivo, sotto ciascuna decisione D1–D9. Una scelta trasversale le
riassume: la struttura alternativa più vicina era **Astro con adapter Node, workspace
pnpm e token generati in un CSS committato**. È stata scartata perché aggiunge un
processo in produzione, un lockfile conteso fra due lotti e una seconda fonte dei token,
senza un criterio della consegna 1 che ne abbia bisogno.

## Conseguenze

**Più facile.** N2 e AC6 si verificano con la stessa procedura e senza codice di test
nel prodotto. I lotti restano disgiunti: L05 possiede `site/` meno pagine e bozze, L06 le
cinque pagine, L04 i tre Markdown, L07 la radice. Cambiare un token di @design cambia il
CSS alla build successiva senza passaggi manuali. Le sostituzioni di G3 sono due file e
un comando di ricerca.

**Più difficile.** Ogni scenario di AC6 e N2 costa una build. Serve Node ≥ 22.12
ovunque, CI compresa. Nessuna interazione lato client è possibile senza tornare qui.
Tema scuro senza interruttore.

**Da rifare se si cambia idea.** Resa su richiesta: adapter, hosting con processo,
revisione @security. Workspace: fusione dei lockfile. Token generati: un file di plugin.
URL senza barra: configurazione più redirect se il sito è già pubblicato.

**Lotti impattati e cosa devono sapere.**

| Agente (lotto) | Impatto |
|---|---|
| @frontend (L05) | D1–D9 per intero; prerequisito Node ≥ 22.12 e corepack; tre ipotesi da misurare alla prima build (D1 nessun JS nell'output, D5 `@custom-media` negli `.astro`, D2 rotte con barra servite 200 da `astro preview`) |
| @frontend (L06) | rotte e link con barra finale (D2); indirizzo e oggetti solo via la funzione di `site/src/lib/` (D3); listino solo da `listino.json` (D4); nessuno script (D9) |
| @privacy (L04) | schema del frontmatter e divieto di indirizzo nelle bozze (D7) |
| @qa-test (L07) | copia temporanea per AC6 e N2 (D4); test degli stili calcolati del focus (D6); progetto separato alla radice (D8); valori attesi letti dai JSON |
| @devops (L12) | Node ≥ 22.12, corepack, due lockfile per la cache, `ASTRO_TELEMETRY_DISABLED=1` (D8, D9) |
| @design (L02, L10) | gate sul contrasto dell'anello nel footer (D6); gli URL senza barra e l'indirizzo `@ownconsent.example` di `01-pagine.md` sono superati da D2 e D3 |
| @code-reviewer (L08), @accessibility (L09) | comandi di verifica di D3, D5 e D6 |

## Aggiornamento del 2026-09-14 — D7 superata da DP-27 e DP-29

Sezione aggiunta dalla sessione principale (`feature`) per registrare due decisioni di Andrea. Non è una nuova decisione architetturale, e il testo originale di D7 qui sopra resta com'è.

- **DP-27.** L'indirizzo di contatto va nelle pagine legali: l'informativa deve identificare il titolare e dare un recapito (art. 13 GDPR). Stesso indirizzo, dallo stesso file di contenuto (`site/src/dati/contatto.json`, D3). Se verrà nominato un DPO, le pagine legali avranno un recapito distinto: è una previsione, non va fatta ora.
- **DP-29** (https://github.com/OwnConsent/ownconsent-www/issues/8#issuecomment-5661111399). Nelle pagine legali il link `mailto:` non ha oggetto precompilato. L'oggetto per modalità resta solo sulle pagine SaaS, Hosted e On-premise.

Cosa cambia rispetto a D7:
- la frase «nessun indirizzo nelle bozze» non vale più: le bozze legali leggono l'indirizzo da `contatto.json` e non lo scrivono a mano;
- lo schema del frontmatter (`titolo`, `descrizione`, `bozza`) resta invariato;
- la spec registra la modifica in N2 (ristretta) e nel nuovo criterio N3.

## Aggiornamento del 2026-09-19 — D6 superata sul footer, ADR accettata

Annotazione, non riscrittura: il testo di D6 qui sopra resta com'è.

- **Stato**: da «proposta» ad **accettata**. Deciso da Andrea, 19/09/2026.
- **D6 superata nel footer.** D6 fissa `var(--color-focus-ring)` nella regola `!important`
  a livello, e fa attendere a L07 `outline-color` uguale a `focus-ring` del tema. Nel
  footer quel valore non raggiunge il contrasto richiesto: misurato **2,38:1** in tema
  chiaro e **1,87:1** in tema scuro, contro il **3:1** di WCAG 2.2, criterio 1.4.11. Vale
  quindi l'alias `focus-ring-on-inverse`, introdotto dai token mergiati dopo questo ADR,
  ridefinito nello scope del footer: la regola `!important` a livello non si tocca.
- **Perché si annota e non si riscrive**: è la classe 2 delle divergenze ammesse da
  CLAUDE.md — il documento fallisce un requisito di accessibilità, si corregge il valore.
  Le altre due classi non si applicano.
- **Chi la legge**: L05 (definisce la custom property nello scope del footer), L07 (attende
  per ogni elemento l'alias in vigore per il suo contesto), L09 (verifica a tastiera).
  Divergenza D-2 di `docs/plan/issue-8.json`.

## Aggiornamento del 2026-09-21 — la riga di L12 nella tabella dei lotti, al giro di L12

Annotazione, non riscrittura: il testo di D8, di D9 e della tabella dei lotti qui sopra
resta com'è. Scritta da @architect nel giro di L12 (issue #8), come ratifica del punto 2 di
«Da ratificare» di `docs/adr/0003-contesto-ci.md`.

La riga della tabella dei lotti dice: «@devops (L12) | Node ≥ 22.12, corepack, **due
lockfile per la cache**, `ASTRO_TELEMETRY_DISABLED=1` (D8, D9)». Tre delle quattro voci
valgono ancora; le altre due si leggono così.

**Telemetria: il vincolo è già in vigore, ma da CI1, non da L12.** `ASTRO_TELEMETRY_DISABLED`
è nell'`env` del job `ci` da prima di questo lotto, e vale anche quando `site/` è assente
(ADR-0003, D4). Misura sulla testa di `main` (`8135bff`):

    $ git show origin/main:.github/workflows/ci.yml | grep -n 'ASTRO_TELEMETRY_DISABLED\|env:'
    21:    env:
    24:      ASTRO_TELEMETRY_DISABLED: "1"

Nessuna contraddizione con D9: la prescrizione è la stessa, è solo arrivata un lotto prima.
L12 non deve aggiungerla, e non deve rimuoverla.

**«Due lockfile per la cache»: presupposto non in vigore, e non è questa sezione a
deciderlo.** I due lockfile esistono davvero — `git ls-tree -r --name-only origin/main --
pnpm-lock.yaml site/pnpm-lock.yaml` stampa tutti e due — ma la frase presuppone che `ci`
usi una cache, e oggi non ne usa nessuna: ADR-0003 D4 la esclude e il workflow lo mostra
(`package-manager-cache: false`, `cache: false`, `skip-cache: true`, nessun
`actions/cache`). Quindi la voce **non è adottata** in questa consegna.

Attenzione a che cosa questa sezione *non* dice: non dice che la cache è esclusa per
sempre. Il rinvio di D4 in ADR-0003 si riapre proprio al giro di L12 e in questo momento è
**aperto**, in attesa della durata misurata su 5 esecuzioni sul runner. Se D4 si chiuderà a
favore di una cache, questa riga della tabella torna pertinente e i due lockfile sono le
chiavi da usare; se si chiuderà contro, la riga resta non adottata. La decisione sta lì,
non qui.

**Chi la legge**: @devops (L12), che dalla tabella non deve dedurre di dover configurare
una cache. Ratifica del punto 2 di ADR-0003, «Da ratificare».
