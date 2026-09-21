# ADR-0003 — Il contesto `ci` come interfaccia stabile: forma, estensioni, rapporto con L12

- Stato: proposta (la ratifica è di Andrea al merge della PR della issue #25, gate G-MERGE)
- Data: 2026-09-15
- Deciso da: @architect (lotto CI0, issue #25)
- Vincola: @devops (CI1, L12), @qa-test (CI3), @frontend (L05), la prima PR che crea `api/`
  (@backend, con @database per D8); da leggere: @performance (L12, D3), @docs-writer (CI2),
  @code-reviewer e @security (revisioni della issue #25)

## Contesto

La issue #25 (`docs/spec/issue-25.json`, commit `7fb4c77`) chiede un controllo di nome `ci`,
sempre presente, che una persona renderà required status check di `main` (AC21). Da quel
momento il nome è un'interfaccia: la protezione di `main` lo cita come stringa, e ci si
appoggiano L05 (`site/`), la prima PR di `api/` e L12 (budget, ADR-0001). Il piano
(`.work/issue-25/plan.json`, `contratti_da_aggiornare.architect.deve_decidere`) elenca otto
punti, D1–D8, che questo ADR decide o rinvia con una scadenza.

Fatti misurati da altri ruoli e non rimisurati qui:

- protezione di `main` senza required status checks e con `enforce_admins` attivo;
  `default_workflow_permissions` = `read`; `sha_pinning_required` = `false`;
  `approval_policy` = `first_time_contributors`
  (`journal/2026-09-15/083016-product-spec-misura.json`);
- `.github/workflows/` contiene solo i tre workflow agentici e nessun job `ci`
  (`journal/2026-09-15/084312-orchestrator-decisione.json`);
- nella shell degli agenti mancano actionlint, act e golangci-lint, e `node -v` stampa
  `v20.20.2` (`journal/2026-09-15/084218-orchestrator-misura.json`).

Tensioni con artefatti già scritti:

- `contracts/perf-budgets.json:33` (`$lettura_ci`) nomina `.github/workflows/site-ci.yml` e
  dice che la CI «legge le soglie per chiave da questo file e le confronta»; ADR-0001
  («Come la CI legge le soglie») prescrive **un solo comparatore**, il test di L07, e una CI
  che «non reimplementa il confronto».
- ADR-0002, D9 (riga 386), assegna a L12 `ASTRO_TELEMETRY_DISABLED=1`; la tabella dei lotti
  (riga 424) assegna a L12 «due lockfile per la cache».
- `ci` costruirà `site/` prima che L12 esista: quei vincoli li eredita adesso, oppure li
  rifiuta per iscritto.

Misura di questo lotto (`journal/2026-09-15/085418-architect-misura.json`), con un modulo Go
minimo nella scratchpad, `go version go1.25.7 linux/amd64`:

    $ go test -race ./...           ->  ok  example.com/m/a  1.022s
    $ go test -race ./...           ->  ok  example.com/m/a  (cached)
    $ go test -race -count=1 ./...  ->  ok  example.com/m/a  1.011s

Da sola, `-race` non esclude la cache dei risultati dei test. `go help test`: «The idiomatic
way to disable test caching explicitly is to use -count=1.»

### Fonti sul comportamento di GitHub Actions

Le citazioni vengono dal sorgente scaricato il 2026-09-15 e cercato con `grep`: repository
`github/docs` (ramo `main`, pagine e `data/reusables/`), `README.md` e `action.yml` delle
action (ramo `main`). Non vengono da riassunti: il primo tentativo con un riassuntore ha
restituito frasi ricomposte (`journal/2026-09-15/085418-architect-fallimento.json`). Le
action evolvono: CI1 ricontrolla nomi e default degli input sull'`action.yml` della versione
che fissa.

| Id | Affermazione | Fonte | Frase citata |
|---|---|---|---|
| F1 | un check skipped soddisfa un required check; un job che dipende da un job fallito è skipped; i filtri sul trigger lasciano il check in attesa | https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks | «Successful check statuses are `success`, `skipped`, and `neutral`.» — tabella «Handling skipped but required checks»: «A workflow is skipped by path filtering, branch filtering, or a commit message \| Associated checks stay in a "Pending" state and block merging»; «A job is skipped by a conditional \| The job reports "Success"»; «A job depends on a failed job \| The dependent job is skipped and may not block merging \| Use `always()` with `needs` for required checks that depend on other jobs.» |
| F1b | un check deve aver girato di recente per essere richiesto; code di merge | stessa pagina | «A required status check must have completed successfully in the chosen repository during the past seven days.» — «Merge queues require the separate `merge_group` event.» |
| F2 | job skipped da una condizione | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions | «A job that is skipped will report its status as "Success". It will not prevent a pull request from merging, even if it is a required check.» |
| F3 | `needs` quando un job a monte fallisce | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds | «If a job fails or is skipped, all jobs that need it are skipped unless the jobs use a conditional expression that causes the job to continue.» |
| F4 | i nomi dei job fanno da nome dei check richiesti | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches | «If you use branch protection rules that require specific status checks, make sure that job names are unique across all workflows. Using the same job name in multiple workflows can cause ambiguous status check results and block pull requests from being merged.» |
| F4b | `name` del job | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idname | «Use `jobs.<job_id>.name` to set a name for the job, which is displayed in the GitHub UI.» |
| F5 | da quale commit si legge il file del workflow | https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows | «Each workflow run will use the version of the workflow that is present in the associated commit SHA or Git ref of the event.» |
| F6 | `pull_request`: SHA, checkout, tipi, conflitti | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request | «Note that `GITHUB_SHA` for this event is the last merge commit of the pull request merge branch.» — «Because `actions/checkout` uses `GITHUB_REF` by default, it checks out the merge branch.» — «By default, a workflow only runs when a `pull_request` event's activity type is `opened`, `synchronize`, or `reopened`.» — «Workflows will not run on `pull_request` activity if the pull request has a merge conflict.» |
| F7 | `concurrency` annulla esecuzioni anche senza `cancel-in-progress` | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency | «By default, any existing `pending` job or workflow in the same concurrency group will be canceled and the new queued job or workflow will take its place.» — «To also cancel any currently running job or workflow in the same concurrency group, specify `cancel-in-progress: true`.» |
| F8 | `continue-on-error` | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepscontinue-on-error | «Prevents a job from failing when a step fails. Set to `true` to allow a job to pass when this step fails.» |
| F9 | Actions crea check run, non commit status | https://docs.github.com/en/pull-requests/reference/status-checks | «GitHub Actions generates checks, not commit statuses, when workflows are run.» |
| F10 | actions/setup-go: cache accesa per default; versione da `go.mod` | https://github.com/actions/setup-go (`README.md`, `action.yml`) | «The `cache` input is optional, and caching is enabled by default. To disable caching, set `cache: false`.» — `action.yml`, input `cache`: «default: true» — «Supports both `go` and `toolchain` directives in `go.mod`. If the `toolchain` directive is present, its version is used; otherwise, the action falls back to the `go` directive.» |
| F11 | actions/setup-node: cache spenta per pnpm, automatica solo per npm; risoluzione della versione | https://github.com/actions/setup-node (`README.md`, `action.yml`) | «For other package managers, such as Yarn and pnpm, caching is disabled by default and must be configured manually using the `cache` input.» — `package-manager-cache`: «Set to false to disable automatic caching.», «default: true» — «The action will first check the local cache for a semver match. If unable to find a specific version in the cache, the action will attempt to download a version of Node.js.» |
| F12 | golangci/golangci-lint-action: cache accesa per default; versione da file | https://github.com/golangci/golangci-lint-action (`README.md`, `action.yml`) | `skip-cache`: «If set to true, all caching functionality will be completely disabled.», «default: 'false'» — `version-file`: «The path must be relative to the root of the project, or the `working-directory` if defined.» «This parameter supports `.golangci-lint-version`, and `.tool-versions` files.» «Only works with `install-mode: binary` (the default).» |
| F13 | la CLI di Astro legge la variabile di telemetria | https://github.com/withastro/astro/blob/main/packages/telemetry/src/index.ts | riga 95: `if (Boolean(this.ASTRO_TELEMETRY_DISABLED \|\| this.TELEMETRY_DISABLED)) {` |

### Ipotesi da misurare

Sono affermazioni su cui una decisione si appoggia, ma per le quali non ho trovato una frase
che le dica. Non sono fatti.

| Id | Ipotesi | Dove si misura | Comando |
|---|---|---|---|
| H1 | il nome del check run di un job è il suo `name` (F4 e F4b lo fanno pensare, ma non lo dicono) | PR del lotto | `gh api 'repos/OwnConsent/ownconsent-www/commits/<head_sha>/check-runs?filter=latest' --jq '[.check_runs[] \| {name, app: .app.slug}]'` → un elemento `{"name":"ci","app":"github-actions"}` |
| H2 | una matrice aggiunge al nome un suffisso («ci (…)») | non si misura: D1 vieta la matrice anche per il non_goal della spec. Si misura solo se D1 si riapre | PR di prova con una matrice, stesso comando di H1 |
| H3 | il check run di un evento `pull_request` sta sullo SHA di testa della PR, non sul merge commit di F6 | PR del lotto | comando di H1 sullo SHA di testa, più `gh api 'repos/OwnConsent/ownconsent-www/actions/runs?head_sha=<head_sha>' --jq '.workflow_runs[] \| {event, head_sha, path}'` |
| H4 | su una PR il workflow si legge dal ref della PR e non da `main` (conseguenza di F5 e F6) | PR del lotto | `git ls-tree origin/main -- .github/workflows/` non elenca il file, mentre il campo `path` dell'esecuzione di H3 lo nomina |
| H5 | setup-node con una versione inesistente in `.nvmrc` fallisce, senza ripiegare sul Node del runner (F11 descrive la ricerca, non il fallimento) | PR di prova P5 (AC11) | `come_si_osserva` di AC11 |
| H6 | con gli input di D4 nessuna action ripristina o salva una cache | PR di prova P2 e P3 (aree presenti) | `gh run view <run_id> --job <job_id> --log \| grep -i -E 'cache restored\|restoring cache\|cache hit\|cache saved'` non stampa nulla |
| H7 | formato di `api/.golangci-lint-version` (una riga con la versione) e riga di log con la versione di golangci-lint usata | PR di prova P3 | `gh run view <run_id> --job <job_id> --log \| grep -i 'golangci-lint'` |
| H8 | un passo saltato dal proprio `if` (area assente) lascia al job la conclusion `success`, e i passi `run` su Linux usano bash | PR del lotto (AC4) | query di «contesto ci» della spec → `conclusion` `success` |

## Decisione

**Il contesto `ci` è un solo job, con id e `name` uguali a `ci`, in un solo workflow. Gira
su ogni `pull_request` e su ogni push su `main`, senza filtri e senza condizioni di job.
Esegue come passi propri le verifiche delle aree presenti, non usa cache e prende ogni
versione di strumento da un file dell'area che lo usa.**

### D1 — Nome e forma del contesto

Regole per il file del workflow che contiene `ci` (il nome del file non fa parte
dell'interfaccia: chi verifica lo legge dal campo `path`, come dice la spec):

1. il job ha id `ci` e `name: ci`;
2. in tutti i file di `.github/workflows/` c'è un solo job con id o `name` uguale a `ci`
   (F4, H1);
3. il job `ci` non ha `strategy.matrix` (non_goal della spec, H2);
4. il job `ci` non ha `if` (F1, F2). Unica eccezione: la forma aggregata di D2, e solo dopo
   una sezione datata di questo ADR;
5. i trigger sono esattamente due: `pull_request`, senza `branches`, `branches-ignore`,
   `paths` o `paths-ignore`, con i tipi di default oppure con `types` che contiene almeno
   `opened`, `synchronize` e `reopened` (F1, F6); `push`, con `branches: [main]` e senza
   `paths`. Niente `pull_request_target` (AC16) e niente altri trigger;
6. né il workflow né il job hanno `concurrency`: anche senza `cancel-in-progress`, un gruppo
   annulla le esecuzioni in attesa (F7), e un commit di `main` resterebbe senza `ci` verde;
7. né il job né i suoi passi hanno `continue-on-error` (F8);
8. `permissions` esplicito con solo `contents: read` (AC15, AC16).

Non si controllano dal workflow, e restano rischi dichiarati: una PR con conflitti di merge
non fa partire `ci` (F6), quindi il check richiesto resta in attesa; `[skip ci]` nel
messaggio lascia il check in attesa (F1).

**Rinominare `ci`** rompe la protezione senza che nulla fallisca. Il percorso di
deprecazione è questo:

1. una sezione datata di questo ADR, oppure un ADR nuovo, fissa il nome nuovo;
2. una PR aggiunge un secondo job con il nome nuovo e gli stessi passi, accanto a `ci`;
3. dopo almeno un'esecuzione verde del nuovo job su `main` e su una PR (F1b: un check si
   può richiedere se ha girato negli ultimi sette giorni), una persona cambia la protezione
   (gate umano, come AC21);
4. una PR successiva toglie `ci`.

Stessa procedura se una persona attiva una coda di merge: serve il trigger `merge_group`
(F1b) e D1 si riapre prima.

| Alternativa | Perché no |
|---|---|
| contesto con il nome del workflow | F4 e H1 dicono che il nome del check è quello del job; la spec (`rischi`) lo registra già |
| `pull_request` con `branches: [main]` | nessun beneficio per le PR verso `main`, e i filtri sono la prima causa di un check richiesto in attesa (F1) |
| `push` su tutti i rami | un commit di testa riceverebbe due esecuzioni e, secondo H3, due check `ci` sullo stesso SHA: AC1 chiede esattamente uno |
| `concurrency` con `cancel-in-progress` solo sulle PR | risparmia minuti mai misurati; il gruppo va costruito distinguendo gli eventi, e anche senza annullare quelle in corso annulla quelle in attesa (F7). Si riapre se la coda delle esecuzioni diventa un problema misurato |
| matrice | non_goal della spec; il nome cambierebbe (H2) |

Costo del ritorno: ogni regola si allenta con una sezione datata di questo ADR e una PR su
`.github/`. Il nome invece costa il percorso di deprecazione qui sopra, con un gate umano.

### D2 — Come si estende `ci`

**Le verifiche di L05, di `api/` e di L12 sono passi del job `ci`**, in quest'ordine:
preparazione (checkout, Node, versioni, SHA verificato), rilevamento delle aree (D6),
verifiche di `site/`, verifiche di `api/`. I passi di verifica tengono la condizione di
default: niente `always()`, `failure()` o `!cancelled()`, e niente `continue-on-error` (F8).
L'unico `if` di passo ammesso è sull'esito del rilevamento d'area (D6).

Job separati non si aggiungono senza una sezione datata di questo ADR. Se una sezione li
ammette (servizi di D8, un runner diverso, una durata misurata), **l'unica forma ammessa**
è un job aggregatore di id e `name` `ci`, con `needs` su tutti gli altri job, `if: always()`
e un passo che fallisce se un `needs.<id>.result` è diverso da `success` (F1, F3). Motivo:
se `ci` dipendesse da un job fallito senza `always()`, risulterebbe skipped (F3), e un check
richiesto skipped vale come superato (F1, F2). Un rosso diventerebbe un via libera.

| Alternativa | Perché no |
|---|---|
| job separati, `ci` con `needs` e senza condizione | un job a monte fallito rende `ci` skipped (F3), e skipped soddisfa il check richiesto (F1, F2) |
| un job per area, ognuno richiesto | ogni area nuova cambia la protezione (gate umano ogni volta) e rompe «un solo contesto» |
| job aggregatore già adesso | è un'astrazione senza casi d'uso presenti: `site/` e `api/` oggi non esistono (regola «nessuna astrazione senza due casi d'uso reali») |
| workflow riutilizzabili o action composite per area | stessa ragione |

Costo del ritorno: passare dai passi all'aggregatore significa una PR su `.github/` e una
sezione di questo ADR. Il nome `ci` non cambia, quindi la protezione non si tocca. Il costo
di oggi è la durata: le aree girano in serie, e un rosso di `site/` salta le verifiche di
`api/` sullo stesso commit.

### D3 — Budget di L12 e divergenza di `$lettura_ci`

**Decisione.** Nessun altro workflow e nessun altro job installa, costruisce, analizza o
controlla i tipi di `site/`: questi passi esistono solo in `ci`. L12 non crea
`.github/workflows/site-ci.yml`.

**Rinvio con scadenza.** Il test di laboratorio sui budget (il comando di L07, ADR-0001)
può diventare un passo di `ci`, e quindi fare da gate, oppure stare fuori e non fare da
gate. Non lo decido qui.

- Scadenza: il giro di L12 della issue #8, prima che L12 scriva una riga di workflow. Senza
  una sezione datata di questo ADR, L12 non parte.
- Chi lo riapre: @architect, con @performance e @devops.
- Cosa serve per decidere: la variabilità misurata, cioè il test di laboratorio eseguito
  almeno 5 volte sullo stesso SHA sul runner di GitHub (PR di prova), con i valori per
  pagina di `lcp_ms_lab_mediana`, con comando e output. È la condizione già scritta in
  ADR-0001, riga 71.
- Fino ad allora `ci` non esegue i budget (non_goal della spec). Con qualunque esito: se il
  test entra in `ci` è un passo del job (D2); se sta fuori non usa `needs` verso `ci`, e la
  sezione dice per iscritto che i budget non fanno da gate.

**Divergenza registrata, non corretta.** `contracts/perf-budgets.json:33` nomina
`site-ci.yml` e un confronto fatto dalla CI; ADR-0001 e questo ADR dicono un solo workflow
(`ci`) e un solo comparatore (il test di L07). Il contratto non si tocca in questa issue
(non_goal). Il proprietario è @performance (`contracts/README.md`), e la correzione passa da
una sezione di @architect nel giro di L12. Nessun consumatore oggi legge `$lettura_ci`: L07
e L12 non esistono.

| Alternativa | Perché no |
|---|---|
| budget in `ci` già adesso | non_goal della spec; `site/` e L07 non esistono; la variabilità di CPU di ADR-0001, riga 71, non è misurata: decidere un gate senza quella misura vorrebbe dire dedurre |
| budget in un contesto separato già adesso | non fa da gate, e oggi non ha nulla da eseguire |
| L12 come descritto nel piano della #8 (`site-ci.yml` con install, build, lint, typecheck e budget) | due workflow costruirebbero `site/` su ogni PR, con due punti da cui prendere Node e pnpm che divergono in silenzio: è lo stesso argomento del comparatore unico di ADR-0001. Il piano della #8 sta in `.work/` e non è committato |
| correggere `$lettura_ci` adesso | non_goal della spec; il contratto è di @performance |

Costo del ritorno: se servisse un workflow separato per `site/`, basterebbero una sezione di
questo ADR e un file; la protezione di `main` non cambia.

### D4 — Telemetria di Astro e cache

**Telemetria.** Il job `ci` ha nel proprio `env` `ASTRO_TELEMETRY_DISABLED: "1"`, da CI1,
anche quando `site/` è assente. È il vincolo di ADR-0002 D9 (riga 386), anticipato da L12 a
CI1. La CLI di Astro legge quella variabile (F13).

**Cache: nessuna.** Prescrizioni per CI1:

- actions/setup-node senza input `cache` e con `package-manager-cache: false` (F11);
- actions/setup-go con `cache: false` (F10: altrimenti è accesa per default);
- golangci/golangci-lint-action con `skip-cache: true` (F12: altrimenti è accesa per default);
- nessun uso di `actions/cache` né delle sue varianti di restore e save;
- `go test` con `-count=1`: la misura qui sopra mostra che `-race` non basta, e AC19 vieta
  `(cached)`.

Conseguenza: AC17 e AC18 non si applicano, e chi verifica lo dichiara. H6 è la misura che lo
conferma sulle PR di prova con le aree presenti.

**Rinvio della cache, con scadenza.**

- Chi lo riapre: @architect con @devops.
- Quando: al giro di L12, oppure prima, se una persona porta come problema la durata di
  `ci` su `main`, misurata sui log di 5 esecuzioni consecutive con entrambe le aree
  presenti.
- Cosa serve: la durata dei passi di installazione letta dai log, e la prova che la
  procedura di AC18 dà un rosso con la cache scelta (spec, `rischi`: se non lo dà, ci si
  ferma).

| Alternativa | Perché no |
|---|---|
| cache dello store pnpm con chiave sul lockfile di `site/` (ADR-0002, riga 424) | rende applicabili AC17 e AC18. AC18 chiede una PR pubblica con una cache avvelenata, e AC17 `gh cache delete --all`, che è distruttivo sullo stato condiviso (piano, `richiede_persona`). Alcuni strumenti riscaricano e finiscono verdi (spec, `rischi`). Il beneficio in durata non è misurato: `site/` non esiste |
| cache di default di setup-go (moduli e `GOCACHE`) | come sopra; in più `GOCACHE` contiene i risultati dei test, e la misura mostra `(cached)` anche con `-race` |
| telemetria spenta solo nei passi di `site/` | un passo aggiunto più avanti senza quella `env` manderebbe telemetria; a livello di job è una riga |
| telemetria accesa | richiesta a terzi dalla CI di un repository pubblico (ADR-0002, D9) |

Costo del ritorno: aggiungere una cache vuol dire pochi input nel workflow, AC17 e AC18 che
diventano applicabili e le azioni per una persona elencate nel piano.

### D5 — Da dove arrivano le versioni

Nel file del workflow e in `.github/ci/**` non c'è la versione di nessuno strumento: né di
Node, né di pnpm, né di Go, né di golangci-lint. Ogni versione arriva da un file del
repository, e il log la riporta con l'output dello strumento stesso, non con il contenuto
del file.

| Strumento | File che la fissa | Come la legge `ci` | Riga di log |
|---|---|---|---|
| Node | `.nvmrc` | actions/setup-node con `node-version-file: .nvmrc`, senza `node-version` | output di `node -v` (AC10) |
| pnpm | `site/package.json`, campo `packageManager` | `corepack enable`, poi pnpm invocato dentro `site/`; niente `pnpm/action-setup`, niente installazione globale | output di `pnpm -v` eseguito in `site/` (AC13) |
| Go | `api/go.mod`: direttiva `toolchain` se c'è, altrimenti `go` (F10) | actions/setup-go con `go-version-file: api/go.mod` | output di `go version` |
| golangci-lint | `api/.golangci-lint-version` | golangci/golangci-lint-action con `working-directory: api` e `version-file: .golangci-lint-version`, `install-mode` di default, cioè `binary` (F12) | la versione usata (H7) |

Con `api/go.mod` presente e `api/.golangci-lint-version` assente, `ci` è rosso con una riga
che nomina `api/.golangci-lint-version`, prima di invocare l'action: il comportamento
dell'action con il file mancante non è misurato. Il file, e la configurazione di
golangci-lint in `api/`, li crea la prima PR di `api/`; le fixture di P3 li portano con sé.

Controllo statico di supporto ad AC12 per CI3: `grep -nE '^\s*(node-version|go-version|version):' <path>`
e `grep -n 'pnpm@' <path>` non stampano nulla.

| Alternativa | Perché no |
|---|---|
| versione di Go scritta nel workflow | può divergere da `api/go.mod` (spec, `rischi`) |
| `.go-version` separato | una seconda fonte accanto a `go.mod` |
| input `version:` di golangci-lint nel workflow | cambiare il linter chiederebbe di toccare `.github/`, e la versione non starebbe in un file dell'area |
| `version: latest` | `ci` rosso senza modifiche al codice (spec, `rischi`) |
| `.tool-versions` unico per Go e golangci-lint | duplica la versione di Go già in `go.mod` |
| golangci-lint come `tool` in `api/go.mod` | mette le dipendenze del linter nel grafo del modulo del prodotto; non misurato, e si valuta solo se questa scelta si riapre |
| `pnpm/action-setup` | un secondo meccanismo accanto a corepack, che ADR-0002 (Contesto, prerequisito) fissa per L05, L07 e L12 |

Costo del ritorno: cambiare il file di una versione tocca solo l'area. Cambiare meccanismo è
un passo del workflow.

### D6 — Aree presenti, assenti o incomplete

Il rilevamento sta in uno script, `.github/ci/area.sh`, perché ha due consumatori reali: il
workflow (CI1) e i test locali (CI3). La sua interfaccia è questa, e CI3 la prova da qui
senza leggere il codice.

**Ingresso.** `bash .github/ci/area.sh <area> [<rev>]`, eseguito dalla radice di un
repository git. `<area>` vale `site` oppure `api`; `<rev>` vale `HEAD` se non è dato.
Dipendenze: bash e git, nient'altro. Nessuna rete.

**Regola.** Si legge `git ls-tree -r --name-only <rev> -- <area>/`. Se è vuoto, l'area è
assente. Se contiene il marcatore (`site/package.json` per `site`, `api/go.mod` per `api`),
è presente. Altrimenti è incompleta. Sono le definizioni della spec.

**Uscita.** Una sola riga su stdout, esattamente così:

| Stato | Riga (per `site`; per `api` con `api/` e `api/go.mod`) | Exit code |
|---|---|---|
| presente | `area site/: presente (site/package.json)` | 0 |
| assente | `area site/: assente` | 0 |
| incompleta | `area site/: incompleta, manca site/package.json` | 1 |

Se la variabile `GITHUB_OUTPUT` è definita, lo script aggiunge a quel file la riga
`<area>=<stato>`, per esempio `site=assente`. Con un'area non valida o un `<rev>` non
risolvibile: exit code 2, messaggio su stderr, nessuna riga di stato e nessuna scrittura su
`GITHUB_OUTPUT`.

**Nel workflow.** Un solo passo di rilevamento chiama lo script per `site` e poi per `api`,
stampa tutte e due le righe e fallisce se una delle due chiamate è uscita con un codice
diverso da 0. Prima di quel passo il log stampa `git rev-parse HEAD`. I passi di verifica di
un'area hanno `if` sull'output `<area>` uguale a `presente`.

**Divergenza segnalata.** La spec definisce l'area «sul SHA osservato», cioè la testa della
PR. Con `pull_request` il checkout di default è il merge commit (F6), quindi `ci` rileva le
aree sul merge commit. I due coincidono, salvo quando `main` ha guadagnato o perso file sotto
`site/` o `api/` dopo il punto di diramazione. Chi verifica un AC d'area confronta con
`git ls-tree -r --name-only <sha stampato> -- <area>/`. Lo segnalo a @product-spec e a
@qa-test; non lo assorbo.

| Alternativa | Perché no |
|---|---|
| logica scritta dentro il YAML | non si prova senza eseguire il workflow; CI3 dovrebbe leggere il codice |
| test sul filesystem (`[ -f site/package.json ]`) | in locale diverge dalla definizione della spec per i file non tracciati o ignorati |
| checkout dello SHA di testa (`github.event.pull_request.head.sha`) | allinea la definizione, ma verifica un albero diverso da quello che entra in `main` |
| script in python3 | la presenza di python3 sul runner non è misurata; bash e git sono già necessari al checkout (H8) |

Costo del ritorno: l'interfaccia è piccola. Cambiarla vuol dire una sezione di questo ADR e
insieme lo script e i test di CI3.

### D7 — Dove stanno e con cosa girano i test di `ci`

I test di accettazione di `ci` stanno in `tests/ci/**`. Richiedono python3 (libreria
standard e PyYAML, 6.0.1 misurata nella shell degli agenti), git e bash, e non installano
nulla con un package manager. Un test che non trova PyYAML **fallisce**, non si salta. Gli
script di verifica remota fanno solo letture con `gh` e scrivono l'evidenza in
`.work/issue-25/prove/`. I generatori di fixture scrivono in una cartella temporanea.
`tests/ci/` non fa parte del progetto pnpm alla radice di L07 (ADR-0002, D8).

**Rinvio con scadenza: in questo giro `ci` non li esegue.**

- Motivi. Il workflow di una PR è quello presente nel suo commit (F5), quindi una PR può
  indebolire insieme `ci` e `tests/ci/`, ed eseguirli non protegge da quel caso. Inoltre
  CI3 viene dopo CI1, ed eseguirli chiederebbe a CI3 di modificare il file di CI1.
- Chi lo riapre: @architect.
- Quando: al primo dei due eventi. Il primo è la prima PR dopo il merge della #25 che
  modifica `.github/workflows/ci.yml` o `.github/ci/**`. L'altro è il giro di L07.
- Condizione per eseguirli: nessun permesso oltre a quelli di AC15.

| Alternativa | Perché no |
|---|---|
| `ci` esegue i test statici già in questo giro | vedi i motivi sopra |
| test sotto `.github/ci/` | sono file di CI1: chi scrive il workflow scriverebbe anche i suoi test (regola 3 del cantiere) |
| test in Node o in Go | Node della shell degli agenti v20.20.2 < 22.12; nessun modulo Go nel repository |

### D8 — MongoDB, Redis e test che si saltano da soli

Registro il non_goal della spec con la sua scadenza. In `ci` non girano servizi MongoDB o
Redis. La decisione si riapre con la PR che introduce il primo test di `api/` che ha bisogno
di MongoDB (replica set) o di Redis; la riaprono @architect, @database e @devops. Fino ad
allora quel test fa diventare `ci` rosso.

Regole per i test di `api/`, dalla prima PR di `api/`:

1. nessun test chiama `t.Skip`, `t.Skipf` o `t.SkipNow` perché manca un servizio, una
   variabile d'ambiente o una risorsa di rete: in quel caso il test fallisce;
2. nessun vincolo di build (`//go:build`) esclude da `go test ./...` un test che `ci`
   dovrebbe eseguire, a meno che `ci` non passi quel tag. Un test escluso non compila e non
   compare nel log;
3. `ci` non passa `-short`;
4. `ci` esegue `go test -race -count=1 -v ./...`: con `-v` le righe `--- SKIP` compaiono nel
   log. `gh run view <run_id> --job <job_id> --log | grep -e '--- SKIP'` non stampa nulla,
   oppure ogni riga è motivata nella PR. Per @code-reviewer:
   `grep -rn -e 't.Skip' -e '//go:build' api/ --include='*_test.go'`.

| Alternativa | Perché no |
|---|---|
| servizi nel job già adesso | non_goal della spec: nessun test li richiede |
| skip con un messaggio nel log | è un verde senza esecuzione, lo stesso difetto che il criterio 8 vieta per la cache (spec, `rischi`) |
| test di integrazione con un tag, in un job separato | D2 vieta i job separati senza sezione, e un contesto separato non è richiesto |
| `go test` senza `-v` | i test saltati non si vedono nel log, e la regola 1 si potrebbe solo dedurre |

## Alternative scartate

Sono elencate, con il motivo, sotto ciascuna decisione D1–D8. La scelta trasversale più
vicina era **un workflow per area** (`site-ci.yml` di L12 e uno per `api/`), ciascuno con la
propria cache e i propri job. È stata scartata perché rende il required check un insieme che
cambia a ogni area (gate umano ogni volta), porta nel check la semantica di skipped (F1–F3) e
moltiplica le fonti delle versioni.

## Conseguenze

**Più facile.** La protezione di `main` cita un nome solo, che non cambia quando arrivano
`site/`, `api/` o i budget. @qa-test prova il rilevamento delle aree dall'interfaccia di D6.
Ogni versione di strumento cambia con una PR sull'area, senza toccare `.github/`.

**Più difficile.** Le aree girano in serie in un solo job. Senza cache ogni esecuzione
scarica tutto, con una durata che nessuno ha misurato. Un rosso di `site/` salta le verifiche
di `api/` sullo stesso commit. La prima PR di `api/` deve creare
`api/.golangci-lint-version` e la configurazione del linter.

**Da rifare se cambiamo idea.** Job separati: aggregatore di D2. Cache: input di D4, e AC17 e
AC18 diventano applicabili. Nome: percorso di deprecazione di D1, con gate umano.

**Scadenze.**

| Punto | Si riapre quando | Chi |
|---|---|---|
| D1, trigger | una persona attiva una coda di merge (`merge_group`) | @architect, @devops |
| D2, job separati | un lotto chiede servizi, un altro runner, o porta una durata misurata | @architect |
| D3, budget dentro o fuori `ci` | giro di L12 (issue #8), prima di scrivere il workflow | @architect, @performance, @devops |
| D4, cache | giro di L12, oppure una persona porta la durata misurata su 5 esecuzioni | @architect, @devops |
| D7, `ci` esegue `tests/ci/` | prima PR dopo il merge che modifica `.github/workflows/ci.yml` o `.github/ci/**`, oppure giro di L07 | @architect |
| D8, servizi MongoDB e Redis | PR con il primo test di `api/` che ne ha bisogno | @architect, @database, @devops |

**Da ratificare: artefatti esistenti che questo ADR contraddice o sposta, senza
modificarli.**

1. `contracts/perf-budgets.json:33`, `$lettura_ci`: il nome `site-ci.yml` e il «confronta»
   della CI sono superati da D3 e da ADR-0001. Correzione di @performance, tramite una
   sezione di @architect, nel giro di L12.
2. ADR-0002, tabella dei lotti (riga 424), «due lockfile per la cache» per L12: non adottato
   (D4) fino alla riapertura. D9 (riga 386), telemetria: il vincolo passa da L12 a CI1, senza
   contraddizione. Serve una sezione datata in ADR-0002 al giro di L12, oppure la ratifica di
   Andrea al merge.
3. ADR-0001, «la CI di L12 esegue quel comando»: resta valido, ma «la CI» è il job `ci`
   (D3). Serve una nota datata in ADR-0001 al giro di L12.
4. `CLAUDE.md`, tabella Comandi: `cd site && pnpm install` e `go test -race ./...` divergono
   da ciò che eseguirà `ci` (installazione dal lockfile, `-count=1 -v`). `CLAUDE.md` è un
   non_goal della spec: decide una persona (piano, R8).
5. `docs/spec/issue-25.json`, definizioni di «area»: per `pull_request`, la differenza fra
   SHA di testa e merge commit (D6). La segnalo a @product-spec; non cambia nessun AC.

Nessun consumatore esistente si rompe: `site-ci.yml`, L07 e L12 non esistono, e nessun file
legge oggi `$lettura_ci`. Non serve un percorso di deprecazione, salvo quello del nome
(D1).

**Consumatori impattati.**

| Agente (lotto) | Impatto |
|---|---|
| @devops (CI1) | D1 per intero; passi di D2; `ASTRO_TELEMETRY_DISABLED` e cache spente di D4; fonti delle versioni di D5; `.github/ci/area.sh` con l'interfaccia di D6; `go test -race -count=1 -v ./...` di D8 |
| @qa-test (CI3) | test di D6 dall'interfaccia; controlli statici di D1 e D5; AC17 e AC18 dichiarati non applicabili (D4) e H6 da eseguire; `tests/ci/` con python3, PyYAML, git e bash (D7); ipotesi H1–H8 nelle verifiche remote |
| @docs-writer (CI2) | nessun vincolo nuovo oltre AC20 |
| @frontend (L05) | nessun workflow proprio; `site/package.json` con `packageManager` (già ADR-0002 D8); la prima PR di `site/` passa da `ci` |
| @backend, prima PR di `api/` | `api/go.mod` con la direttiva `go` o `toolchain`; `api/.golangci-lint-version` e la configurazione del linter; regole di D8 sui test |
| @database | riapertura di D8 al primo test che richiede MongoDB o Redis |
| @devops (L12) | nessun `site-ci.yml`; budget dentro o fuori `ci` da decidere prima di scrivere (D3); cache solo dopo la riapertura di D4 |
| @performance (L12) | correzione di `$lettura_ci` (D3) |
| @code-reviewer, @security | regole di D1, D4 e D8 come elementi di revisione; la fissazione a SHA delle action di terze parti resta alla revisione di @security, e questo ADR non la decide |

## 2026-09-21 — Giro di L12 (issue #8): D7 deciso, D9 sulla collisione con `tests/ci`, ratifiche 1–3. **D3 e D4 restano aperte**

Sezione aggiunta, non riscrittura: il corpo di D1–D8 qui sopra resta com'è. Scritta da
@architect nel giro di L12 della issue #8. Vincola in questo giro **@devops (L12)** e
**@qa-test**.

**Che cosa questa sezione non decide.** Non decide **D3** (il test di laboratorio dentro o
fuori `ci`) e non decide **D4** (cache). Tutte e due chiedono una misura che sta girando
adesso — il test di laboratorio eseguito 5 volte sullo stesso SHA sul runner di GitHub, con
i valori per pagina di `lcp_ms_lab_mediana` e la durata di ciascuna esecuzione — e
scriverle prima del numero sarebbe adattare la decisione alla descrizione. Restano aperte,
con la stessa scadenza di prima, e la frase «senza una sezione datata di questo ADR, L12
non parte» di D3 **resta in vigore**: L12 non scrive la riga del laboratorio finché non
arriva la sezione D3 datata. Quello che L12 può fare da ora è tutto il resto, cioè quanto
sta sotto.

### Stato delle scadenze che cadevano su questo giro

| Punto | Stato dopo questa sezione |
|---|---|
| D3, budget dentro o fuori `ci` | **aperto**, in attesa della misura di variabilità sul runner. Sezione datata separata |
| D4, cache | **aperto**, in attesa della durata misurata su 5 esecuzioni. Sezione datata separata |
| D7, `ci` esegue `tests/ci/` | **deciso: sì**, sotto |
| Da ratificare 1 (`$lettura_ci`) | **eseguita**, sotto |
| Da ratificare 2 (ADR-0002) | **eseguita**, sezione datata del 21/09/2026 in `docs/adr/0002-struttura-site.md` |
| Da ratificare 3 (ADR-0001) | **eseguita**, nota datata del 21/09/2026 in `docs/adr/0001-budget-pagine-pubbliche-laboratorio.md` |

La riga di D7 nella tabella «Scadenze» qui sopra è superata da questa sezione. Le righe di
D3 e D4 no: quelle valgono ancora.

### D7 — deciso: **`ci` esegue `tests/ci/`**

Il rinvio di D7 si riapre perché si è verificata la condizione scritta: questa è la prima
PR dopo il merge della #25 che modifica `.github/workflows/ci.yml`.

**I due motivi del rinvio, riesaminati.**

1. «Il workflow di una PR è quello presente nel suo commit (F5), quindi una PR può
   indebolire insieme `ci` e `tests/ci/`, ed eseguirli non protegge da quel caso.»
   **Il fatto resta vero; come motivo non regge.** F5 non è cambiata, e nessun controllo
   automatico può proteggere da una PR che modifica insieme l'oggetto e il suo strumento di
   misura: quello è il lavoro della revisione, non di un check. Ma il rinvio lo usava per
   negare una protezione che nessuno aveva chiesto. La protezione che serve è un'altra: una
   PR che tocca `ci.yml` **in buona fede** e rompe un invariante di `tests/ci` senza
   accorgersene. Quel caso oggi non è più ipotetico — è successo in questo stesso lotto,
   sul primo passo nuovo che L12 voleva scrivere, ed è stato trovato solo perché @devops ha
   misurato a mano invece di dedurre (`journal/2026-09-21/151312-orchestrator-misura.json`;
   riprodotto in `journal/2026-09-21/152229-architect-misura.json`). Un invariante che
   regge solo se l'agente di turno si ricorda di eseguire una suite a mano non è un
   invariante: è una speranza.
2. «CI3 viene dopo CI1, ed eseguirli chiederebbe a CI3 di modificare il file di CI1.»
   **Scaduto.** CI1 e CI3 sono mergiati tutti e due; `tests/ci/**` e
   `.github/workflows/ci.yml` sono su `main` da prima di questo lotto. Oggi il file lo
   modifica @devops dentro L12, e il passo sta nel proprio file: nessun confine di ruolo
   viene attraversato. La regola 3 del cantiere resta soddisfatta — @devops aggiunge il
   passo che *esegue* i test, non li scrive.

**Condizione dell'ADR, verificata.** «Nessun permesso oltre a quelli di AC15»:
`permissions: contents: read` non cambia. I test di `tests/ci/` leggono file dal
filesystem e invocano `git rev-parse --show-toplevel`; non fanno rete, non usano `gh`, non
installano nulla. Gli script di verifica remota con `gh` citati da D7 non stanno in
`tests/ci/` (la cartella contiene solo `helpers.py`, i `test_*.py` e
`procedure-github.md`).

**Prescrizioni per @devops (L12).**

1. Un solo passo, senza `if`, senza `continue-on-error`, con
   `working-directory: tests/ci`, che esegue
   `python3 -m unittest discover -s . -p 'test_*.py'`. Niente `pytest`: la libreria
   standard basta, e aggiungerne una sarebbe una dipendenza in più su `ci`.
2. **Posizione**: subito dopo il passo «Rilevamento aree» e prima del blocco di `site/`.
   Motivo: il log porta già lo SHA verificato e lo stato delle due aree — le righe su cui
   si appoggiano AC4 e AC5 — prima che il gate nuovo possa diventare rosso; e i test
   riguardano la forma statica del workflow, che non dipende da quali aree sono presenti.
   Il passo non ha `if`: non è un'area. È l'unica estensione all'ordine fissato da D2, ed è
   questa sezione ad ammetterla.
3. **Costo misurato**: 0,24 s in locale su 55 test
   (`journal/2026-09-21/152229-architect-misura.json`, punto 2), contro i 19 s attuali del
   job (`journal/2026-09-21/151513-orchestrator-misura.json`). Da rimisurare dal log del
   runner e da riportare nella PR, non da dedurre.
4. **Dipendenze non misurate sul runner**: `python3` e PyYAML. Nella shell degli agenti
   sono `3.12.3` e `6.0.1` (`$ python3 -c 'import sys, yaml; print(sys.version.split()[0],
   yaml.__version__)'` → `3.12.3 6.0.1`); **sul runner di GitHub nessuno le ha misurate**.
   Il passo stampa le due versioni prima di eseguire i test, come `node -v` fa per AC10, e
   la riga di log è la misura. Se PyYAML manca, il passo è rosso e **il lotto si ferma e
   torna ad @architect**: nessun `pip install` improvvisato, perché introdurrebbe in `ci`
   una versione che non viene da un file dell'area (D5) e una dipendenza di rete che oggi
   il job non ha.
5. **Conseguenza da mettere in conto**: da questo passo in poi, una PR che rompe un
   invariante di `tests/ci` è rossa. Compresa quella di L12: finché D9 qui sotto non è
   applicata, il passo di installazione del collaudo alla radice rende `ci` rosso.

**Si riapre** se il passo produce rossi non riconducibili a una modifica di `.github/`
(cioè se diventa instabile), oppure se PyYAML risulta assente sul runner. Chi:
@architect con @devops. Costo del ritorno: togliere quattro righe dal workflow.

| Alternativa | Perché no |
|---|---|
| lasciare D7 rinviato al giro di L07 | L07 è chiuso; la scadenza «prima PR che modifica `ci.yml`» è questa, e rinviare un rinvio scaduto è farlo restare per inerzia |
| eseguirli in un job separato | D2 vieta i job separati senza sezione, e qui non c'è nessuna ragione (servizi, runner diverso, durata) che li giustifichi: 0,24 s |
| eseguirli solo quando la PR tocca `.github/` | sarebbe un `if` di passo fuori da quelli ammessi da D2, e un filtro che decide da sé quando misurare |
| aggiungere `pytest` | una dipendenza nuova su `ci` per zero funzionalità in più; il comando misurato è quello della libreria standard |

### D9 — come `tests/ci` identifica i passi di `site/`: il selettore si stringe

**Il problema, misurato.** `tests/ci/test_ac06_ac07_site_steps.py` individua i quattro
passi di `site/` con una sottostringa letterale del comando (`_site_step`, riga 36:
`"pnpm install" in step_run_text(s)`), e pretende che il predicato dia **un solo** passo.
Il progetto di collaudo alla radice (ADR-0002, D8) ha un proprio `package.json` e un
proprio lockfile, quindi L12 deve installarlo con un secondo `pnpm install`. Da quel
momento il predicato dà due passi e AC6/AC7 non si misurano più:

    $ cd tests/ci && python3 -m unittest discover -s . -p 'test_*.py'
    Ran 55 tests in 0.315s
    OK                                    (workflow di oggi)

    $ CI_ROOT=<copia con il passo di radice> python3 -m unittest discover -s . -p 'test_*.py'
    Ran 55 tests in 0.238s
    FAILED (failures=5)
    AssertionError: atteso un solo passo per il predicato, trovati 2

**Decisione: (a) — il selettore di `_site_step` si stringe sui passi con
`working-directory: site`.** Il difetto sta nello strumento, non nel comando: due passi
che fanno cose diverse — installare `site/` e installare il collaudo alla radice — vengono
confusi perché il selettore guarda il verbo e non l'oggetto. «Suonano uguali» non vuol dire
«sono la stessa cosa».

**L'obiezione contro (a), e perché non regge.** Spostare `working-directory` dal corpo del
test al selettore sembra rendere tautologica l'asserzione `test_ciascun_passo_gira_in_site`.
Misurato, non dedotto: non lo rende, perché il selettore contiene già
`assert len(matches) == 1`. Con il selettore stretto e un workflow in cui il passo di
`site/` esce da `working-directory: site`, i candidati diventano **0** e il test è rosso lo
stesso:

    $ CI_ROOT=<copia in cui il passo di site/ perde working-directory> \
        python3 -m unittest discover -s . -p 'test_*.py'
    Ran 55 tests in 0.236s
    FAILED (failures=5)
    AssertionError: atteso un solo passo per il predicato, trovati 0

Cambia il messaggio, non la copertura. Quindi (a) è una riparazione dello strumento, non un
adattamento della misura alla descrizione — che è ciò che il piano vieta a L12
(`docs/plan/issue-8.json`, `L12.non_tocca`). Evidenza completa, con i quattro passaggi:
`journal/2026-09-21/152229-architect-misura.json`.

**Chi lo modifica, e con quale mandato.** `tests/ci/**` è di **@qa-test** (regola 3 del
cantiere: chi scrive il codice non scrive i test). Non lo tocca @devops e non lo tocco io.
Mandato, stretto:

1. Perimetro: solo `tests/ci/test_ac06_ac07_site_steps.py`, solo la funzione `_site_step`.
   Nessuna asserzione nel corpo dei test cambia, nessun test viene rimosso, nessun
   `assertIn` diventa più permissivo.
2. Il selettore filtra prima i passi con `working-directory == "site"` e **mantiene**
   `assert len(matches) == 1`. Se quell'assert sparisce, la modifica è un indebolimento e
   il mandato è violato.
3. Prove-by-reversion, da rifare sul file vero e da allegare alla PR, con `CI_ROOT` che
   `tests/ci/helpers.py` espone già per questo: (i) selettore nuovo contro il workflow di
   oggi → 55 verdi; (ii) selettore nuovo contro una copia del workflow con il passo di
   radice → 55 verdi; (iii) selettore nuovo contro una copia in cui il passo di `site/`
   esce da `working-directory: site` → rosso. Senza (iii) non è una correzione: è una
   speranza.
4. Nota per @qa-test: dopo la modifica, `test_ciascun_passo_gira_in_site` resta vero per
   costruzione. Non va sostituito con «nessun passo fuori da `site/` esegue `pnpm
   install`», che da questo lotto in poi sarebbe **falso** per disegno. Se lo si vuole
   rendere di nuovo informativo, lo si fa in un giro proprio, non dentro L12.

**Sequenza, e cosa NON è ammesso nel frattempo.** Il commit di @qa-test arriva sul ramo di
L12 **prima** che @devops scriva il passo di installazione alla radice. Fino ad allora L12
non scrive quel passo. Con il selettore stretto, @devops scrive il comando nella forma
piena, `pnpm install --frozen-lockfile`, e il passo di radice **non** porta
`working-directory: site`.

| Alternativa | Perché no |
|---|---|
| (b) il passo di radice usa `pnpm i --frozen-lockfile` | fa dipendere un invariante di accettazione da un alias del gestore di pacchetti. La prima persona che riscrive `pnpm i` in `pnpm install` trova un rosso il cui messaggio («trovati 2») non nomina la causa, e con D7 quel rosso è un gate su ogni PR: l'invito implicito è ad allargare il predicato, cioè proprio la mossa che il piano vieta. Misurato verde (`journal/2026-09-21/151312-orchestrator-misura.json`, variante B): funziona, e per questo è pericoloso. **Non è un ripiego autorizzato**: usarla richiede un'altra sezione datata |
| (c) selettore sul campo `name` del passo | promuoverebbe a interfaccia un testo libero scritto per chi legge il log; oggi nessun test lo legge, e non c'è motivo di cominciare |
| non installare il collaudo alla radice | è il progetto separato di ADR-0002 D8, con lockfile proprio: senza `pnpm install` alla radice non esistono né i test e2e né la misura di laboratorio |
| lasciare `tests/ci` com'è e non far partire L12 | il difetto è nello strumento e non sparisce aspettando; il costo della riparazione è una funzione di tre righe |

Costo del ritorno: il commit di @qa-test si revoca da solo. Se il selettore stretto
dovesse risultare sbagliato, si torna al predicato letterale e al passo di radice con una
forma non collidente, con una sezione nuova.

### Ratifica 1 — `contracts/perf-budgets.json`, `$lettura_ci`: **eseguita**

Il punto 1 di «Da ratificare» è chiuso. Il campo nominava `.github/workflows/site-ci.yml` e
attribuiva alla CI il confronto; tutte e due le cose sono superate. Misura sulla testa di
`main` (`8135bff`): `git ls-tree -r --name-only origin/main -- .github/workflows/` elenca
`ci.yml` e i tre workflow agentici e nessun `site-ci.yml`; `git show
origin/main:.github/workflows/ci.yml | grep -n 'name: ci'` stampa `19:    name: ci`; il
check run sulla testa di `main` si chiama `ci` ed è `success`. Il campo ora nomina `ci.yml`
e il job `ci`, dice che il comparatore è **uno solo** (il test di L07, ADR-0001) e che la
CI esegue il comando senza rileggere il file né reimplementare il confronto, e rimanda a D3
per stabilire se quel comando sia un passo di `ci`.

Nessuna soglia toccata, nessuna chiave rimossa o rinominata: 24 chiavi prima, 24 dopo, una
sola con valore diverso, verificato confrontando il file prima e dopo. La modifica è
**esecuzione** della divergenza D-3 di `docs/plan/issue-8.json`, già ratificata da Andrea,
non una decisione nuova di @architect su un contratto di @performance; ed è la strada che
D3 aveva scritto («la correzione passa da una sezione di @architect nel giro di L12»).
Registrata come voce **A05** di `DESIGN-AMENDMENTS.md`, classe `shipped-vince`.

### Divergenza di perimetro rispetto al piano — segnalata, non assorbita

`docs/plan/issue-8.json` assegna a L12 i soli file `.github/workflows/ci.yml` e
`journal/2026-09-19/*-devops-*.json`, e ha `contratti_da_aggiornare: []`. Questo giro tocca
invece `contracts/perf-budgets.json`, `DESIGN-AMENDMENTS.md`, `docs/adr/0001-*`,
`docs/adr/0002-*`, `docs/adr/0003-*` e — per mano di @qa-test —
`tests/ci/test_ac06_ac07_site_steps.py`, che il piano elenca fra i `non_tocca` di L12.

È una divergenza di **perimetro**, non di merito, imposta dagli artefatti in vigore: le
scadenze di questo ADR cadono tutte sul giro di L12, e D3 dice che senza una sezione datata
L12 non parte. Il piano descrive il lotto come se le scadenze non esistessero. La segnalo e
non la assorbo. Due precisazioni:

- la parte che riguarda `contracts/perf-budgets.json` è **già ratificata** (D-3, voce A05);
- la parte che riguarda `tests/ci/**` è coperta dal `non_tocca` stesso, che prescrive
  proprio questo esito: «se uno fallisce dopo la modifica, il lotto si ferma e torna ad
  @architect». Il lotto si è fermato, è tornato qui, e la modifica la fa @qa-test con il
  mandato di D9 — non @devops adattando il test.

Il resto — ADR e `DESIGN-AMENDMENTS.md` — è lavoro di @architect, che il piano non aveva
previsto in questo lotto. Va all'occhio di Andrea come divergenza di perimetro: se il piano
verrà rigenerato, l'elenco dei file di L12 va corretto di conseguenza.

### Consumatori impattati, aggiornamento del 21/09/2026

| Agente (lotto) | Impatto di questa sezione |
|---|---|
| @devops (L12) | passo di `tests/ci` in `ci`, con posizione, comando e misura delle versioni (D7); forma piena `pnpm install --frozen-lockfile` per il passo di radice, **dopo** il commit di @qa-test (D9); D3 e D4 ancora chiuse: nessuna riga sul laboratorio e nessuna cache finché non arrivano le due sezioni datate |
| @qa-test | mandato di D9 su `tests/ci/test_ac06_ac07_site_steps.py`, `_site_step` soltanto, con le tre prove-by-reversion |
| @performance | `$lettura_ci` corretto (ratifica 1); nessuna soglia toccata; D3 resta aperta e la decide @architect con @performance e @devops |
| @docs-writer | nessun vincolo nuovo: `docs/DEFINITION-OF-DONE.md` non cambia (AC20 verificato verde contro il workflow con i passi nuovi) |
| @code-reviewer, @security | da questo giro `ci` esegue `tests/ci/`: una PR che tocca `.github/workflows/ci.yml` o `.github/ci/**` ha il proprio controllo statico dentro il gate, e un rosso di quel passo non si chiude allargando il predicato |

## 2026-09-21 (seconda parte) — Premessa cambiata, poi **D3 e D4 decisi**

Sezione aggiunta nello stesso giorno della precedente, quando è arrivata la misura che D3 e
D4 aspettavano. Il corpo di D1–D8 e la sezione precedente restano com'è.

### Premessa cambiata: `ci` **è** un required status check di `main`

La sezione «Contesto» di questo ADR riporta, dal 15/09, «protezione di `main` **senza**
required status checks». Non è più vero. Rimisurato oggi, non ereditato:

    $ gh api repos/OwnConsent/ownconsent-www/branches/main/protection \
        --jq '{required: .required_status_checks.contexts, strict: .required_status_checks.strict, enforce_admins: .enforce_admins.enabled}'
    {"enforce_admins":true,"required":["ci"],"strict":false}

Una persona ha eseguito il gate umano di AC21 (issue #25). Non riscrivo il «Contesto»: la
misura del 15/09 era vera quel giorno, e cancellarla toglierebbe la traccia di che cosa si
sapeva quando. Tre conseguenze da registrare:

- **H1 non è più un'ipotesi.** Il check run sulla testa di `main` si chiama `ci`
  (`[{"app": "github-actions", "conclusion": "success", "name": "ci"}]`) e la stringa
  richiesta dalla protezione è `"ci"`: il nome del check run è il `name` del job, come D1
  dava per probabile. Misurato, non più dedotto.
- **Il percorso di deprecazione del nome (D1) è adesso attivo, non teorico.** «Rinominare
  `ci` rompe la protezione senza che nulla fallisca» oggi descrive questo repository.
- **La posta di ogni passo aggiunto al job è cambiata.** Prima un rosso di `ci` era
  un'informazione; adesso è un merge che non avviene, per tutti. D3, D4 e D7 qui sotto si
  decidono con questa posta.

**D7, riesaminato con la premessa nuova: confermato.** Il rischio che la premessa aggiunge
è che `python3` o PyYAML manchino sul runner e blocchino ogni merge. È contenuto, e la
contenzione è misurabile: il passo arriva su `main` solo se è stato verde sulla PR di L12,
e finché non ci arriva nessun'altra PR lo esegue. Resta il rischio differito — un'immagine
del runner che smette di portare PyYAML — ed è esattamente la condizione di riapertura già
scritta. Nessun cambiamento alla decisione.

### D3 — deciso: **il test di laboratorio è un passo del job `ci`**

**La misura che il rinvio chiedeva.** Provenienza: PR di prova #45 (draft, materiale usa e
getta, non è un artefatto di questo repository), ramo `prova/l12-variabilita-laboratorio`,
workflow temporaneo con job `prova-variabilita` (mai `ci`). Cinque esecuzioni sono i cinque
attempt dello stesso run `35604798168`, tutti sullo SHA `f9a75de`, tutti `success`, durate
1m15s, 1m01s, 1m02s, 1m00s, 1m04s. Browser: il Chromium incluso in Playwright, installato
con `pnpm exec playwright install --with-deps chromium`; non il canale `chrome`. Le soglie
nelle righe di log sono lette a runtime da `contracts/perf-budgets.json` da
`tests/perf/misura-laboratorio.ts`, non trascritte.

`lcp_ms_lab_mediana` per pagina, sulle 5 esecuzioni, soglia **2500 ms**:

| rotta | 5 esecuzioni | min | max | scarto |
|---|---|---|---|---|
| `/` | 424 412 404 420 428 | 404 | 428 | 24 |
| `/saas/` | 420 424 408 424 440 | 408 | 440 | 32 |
| `/hosted/` | 428 408 432 416 424 | 408 | 432 | 24 |
| `/on-premise/` | 420 408 432 420 420 | 408 | 432 | 24 |
| `/confronto/` | 436 432 408 428 452 | 408 | 452 | 44 |
| `/legale/termini-di-servizio/` | 424 412 392 412 420 | 392 | 424 | 32 |
| `/legale/informativa-privacy/` | 436 428 396 432 420 | 396 | 436 | 40 |
| `/legale/cookie-policy/` | 424 412 392 416 420 | 392 | 424 | 32 |

Le altre tre grandezze sono costanti su tutte le pagine e tutte le esecuzioni:
`cls_lab_mediana` = 0 (soglia 0.05), `js_iniziale_gzip_kb` = 0 (soglia 60: nessun
JavaScript lato client, ADR-0002 D9), `css_gzip_kb` = 1.507 (soglia 25).

**Che cosa dice, e che cosa non dice.** La condizione di riapertura scritta in ADR-0001
(riga 71: «si riapre se la stessa build supera e rientra nella soglia in esecuzioni
consecutive della CI») **non si verifica**: il massimo osservato è 452 ms contro 2500, e lo
scarto massimo fra esecuzioni identiche è 44 ms. Perché una di queste pagine attraversasse
la soglia per rumore, lo scarto dovrebbe essere circa **46 volte** quello misurato. Il gate
non sfarfalla su questa build.

Non dice altro, e lo dichiaro con le stesse parole con cui mi è stato consegnato: **non**
dice che il rallentamento CPU 4× via CDP sia stabile in generale. La nota di ADR-0001
sull'assenza dell'indice di benchmark che Lighthouse usa per correggerlo resta vera; con
questo margine semplicemente non si vede. Vale per pagine senza JavaScript e con 1,5 KB di
CSS: è la consegna 1, non il progetto.

**Perché farlo entrare adesso, visto che il margine è di 55 volte.** È l'obiezione giusta:
un budget che nessuna pagina rischia di sfiorare non fa da guardia a niente, oggi. Ma un
gate serve nel momento in cui il numero cambia, e quel momento non si sa prevedere: è la PR
che aggiunge un font, un'immagine grande, il primo `client:` — cioè una PR che parla
d'altro, scritta da chi non sta guardando i budget. Se il gate c'è, quella PR vede il
numero prima del merge; se non c'è, la regressione la scopre il traffico reale, cioè le
persone. Il valore non è il margine di oggi: è cogliere la regressione quando arriverà.
L'alternativa «lo mettiamo quando servirà» si traduce in «lo mettiamo dopo la prima
regressione», e allora il gate arriva insieme al lavoro di rimediare.

Il secondo motivo è che AC39 della issue #8 chiede che le pagine stiano entro le soglie
dichiarate. Senza un gate, «rispetta i budget» è un aggettivo: vero quando qualcuno lo
guarda, ignoto il resto del tempo.

**Regole vincolanti per @devops (L12).**

1. Il controllo dei budget è un **passo del job `ci`**, non un job separato e non un
   workflow separato: nessun `needs`, nessun secondo contesto (D2, e la premessa qui
   sopra — un secondo contesto andrebbe legato a mano alla protezione).
2. **Un solo comparatore.** Il passo esegue il comando del test di L07
   (`tests/perf/ac39-budget-pagine-pubbliche.spec.ts`, che legge
   `contracts/perf-budgets.json` a runtime) e fallisce quando il test fallisce. Il workflow
   **non** legge le soglie e non confronta niente: un `jq`, un `grep` o un numero copiato
   dentro `.github/` è una violazione di questa regola e di ADR-0001.
3. Il passo ha `if: steps.rilevamento.outputs.site == 'presente'`, che è l'unico `if` di
   passo ammesso (D2, D6): senza `site/` non c'è niente da misurare.
4. Browser: **solo Chromium**, installato con `pnpm exec playwright install --with-deps
   chromium`. È il browser con cui la misura qui sopra è stata presa, ed è quello che il
   metodo del contratto prescrive. Installare tutti i browser è tempo del runner speso per
   niente.
5. La versione di Playwright viene dal `package.json` e dal lockfile della radice, mai
   scritta nel workflow (D5). Il passo di installazione dei browser non porta un numero di
   versione.
6. **Numero di passi**: uno, `pnpm exec playwright test`, che copre collaudo e laboratorio
   con una sola build di `site/`. @devops può separarlo in `pnpm test:e2e` e
   `pnpm test:perf` se misura il costo della seconda build e lo riporta nella PR: la
   separazione non tocca nessuna delle regole 1–5. Quale criterio è fallito lo nomina il
   report di Playwright, non il nome del passo.
7. **Durata**: @devops misura la durata del job `ci` prima e dopo, dal log, e la riporta
   nella PR. In questo ADR non entra nessun numero per il job `ci` completo, perché quel
   numero oggi non esiste: il job di prova non eseguiva i test e2e.

**Si riapre** al primo sfarfallio: se la stessa build supera e rientra nella soglia in
esecuzioni consecutive di `ci` (ADR-0001, riga 71). Chi: @architect con @performance e
@devops. E si riapre in un modo solo: il passo esce dal gate con una sezione datata. **Non**
si riapre allargando la soglia — le soglie sono di @performance e si cambiano con il loro
percorso, non per far tornare verde una PR.

Costo del ritorno: togliere il passo dal job è una riga, e la protezione di `main` non si
tocca perché il nome del contesto non cambia. È il motivo per cui questa decisione è
reversibile e quella sul nome no.

| Alternativa | Perché no |
|---|---|
| budget fuori da `ci`, eseguiti a mano o in un contesto separato | un contesto separato non è richiesto dalla protezione, quindi non fa da gate (F1, F2), e «a mano» vuol dire «quando qualcuno si ricorda». È la stessa forma del difetto che D7 ha appena chiuso |
| aspettare che il margine si stringa | il gate arriverebbe insieme alla regressione da rimediare |
| far confrontare le soglie al workflow | due implementazioni della stessa regola divergono in silenzio (ADR-0001) |
| eseguire il laboratorio solo su `push` verso `main` | la regressione si scoprirebbe dopo il merge, cioè quando costa di più; e D1 vieta le condizioni sul job |
| allargare `lcp_ms_lab_mediana` per stare larghi | non è una decisione di @architect: il contratto è di @performance, e il numero misurato non chiede nessuna modifica |

### D4 — deciso: **ancora nessuna cache**

**Le durate misurate**, che il rinvio chiedeva. Job di prova, senza nessuna cache, con
checkout, setup-node, installazione di `site/`, installazione del progetto di radice,
download di Chromium, build di `site/` e la sola misura di laboratorio: fra **1m00s e
1m15s** su 5 esecuzioni. Per confronto: il job `ci` su `main` oggi dura **19 s** (run
`35603251219`), e in locale l'intera suite è `252 passed (20.8s)`. Il pezzo più pesante fra
i passi nuovi è il download del Chromium di Playwright, che senza cache si ripete a ogni
esecuzione — **e la sua quota del minuto non è stata misurata separatamente**.

**Decisione: nessuna cache.** Le prescrizioni di D4 restano in vigore parola per parola
(setup-node senza `cache` e con `package-manager-cache: false`, setup-go con `cache:
false`, golangci-lint-action con `skip-cache: true`, nessun `actions/cache`, `go test` con
`-count=1`). **AC17 e AC18 restano non applicabili**, e chi verifica lo dichiara: lo
verifica staticamente `tests/ci/test_ac17_ac18_no_cache.py`, che da oggi gira dentro `ci`
(D7).

Tre motivi, nell'ordine in cui pesano:

1. **La premessa nuova sposta il rapporto costi-benefici dalla parte sbagliata.** `ci` è un
   required check: una cache che ripristina uno stato vecchio o avvelenato produce un verde
   **senza esecuzione**, ed è quel verde ad autorizzare un merge. È il difetto che il
   criterio 8 della spec vieta, e dal 15/09 costa di più, non di meno.
2. **Il beneficio non è misurato, il costo sì.** Una cache rende applicabili AC17 e AC18:
   AC18 chiede una PR pubblica con una cache avvelenata, AC17 chiede `gh cache delete
   --all`, distruttivo sullo stato condiviso e gate di una persona (piano,
   `richiede_persona`). Pagare un costo certo per un risparmio che nessuno ha isolato è
   esattamente lo scambio che questo progetto rifiuta.
3. **Nessuno ha portato la durata come problema.** L'altra condizione di riapertura di D4
   («una persona porta come problema la durata di `ci` su `main`») non si è verificata. Un
   minuto su una PR non è un problema finché qualcuno non dice che lo è.

**Compito per @devops in questo lotto**, perché la prossima riapertura parta da un numero e
non da un'impressione: leggere dal log della PR di L12 la durata **separata** dei passi di
installazione di `site/`, di installazione della radice, di `playwright install`, di build e
di collaudo, e scriverle nel journal. Senza quella riga, fra un mese si ridiscuterà la cache
con la stessa ignoranza di oggi.

**Nuova scadenza** (quella vecchia, «al giro di L12», è consumata). Chi: @architect con
@devops. Quando, al primo dei due: (a) una persona porta come problema la durata del job
`ci` **completo** su `main`, misurata sui log di 5 esecuzioni consecutive con `site/`
presente; (b) la durata del download dei browser, letta isolata dal log, supera la metà
della durata del job. Cosa serve per decidere, invariato: quella durata isolata, e la prova
che la procedura di AC18 dà un rosso con la cache scelta — se non lo dà, ci si ferma (spec,
`rischi`).

| Alternativa | Perché no |
|---|---|
| cache dei browser in `~/.cache/ms-playwright` | è la candidata concreta, ed è quella che il download rende tentante: ma rende applicabili AC17 e AC18, e il risparmio non è isolato. Si valuta alla riapertura, con il numero |
| cache dello store pnpm sui due lockfile (ADR-0002, tabella dei lotti) | stesso costo, beneficio ancora minore: le due installazioni misurate in locale sono 170 ms e 86 ms |
| immagine del runner con Chromium preinstallato | sposterebbe la versione del browser fuori dal lockfile, contro D5, e introdurrebbe una dipendenza da un'immagine di terzi |
| decidere la cache adesso «tanto è reversibile» | non è reversibile allo stesso costo: accendere una cache fa tornare applicabili due criteri che chiedono una procedura distruttiva e un gate di persona |

### Consumatori impattati, aggiornamento della seconda parte

| Agente (lotto) | Impatto |
|---|---|
| @devops (L12) | D3 sblocca il passo del laboratorio, con le sette regole vincolanti; D4 conferma nessuna cache e assegna la misura delle durate separate; la premessa nuova rende ogni rosso di `ci` un merge bloccato per tutti |
| @performance | il gate sui budget esiste da questo lotto; le soglie non sono state toccate e non si toccano per far tornare verde una PR; la riapertura di D3 al primo sfarfallio è sua insieme a @architect |
| @qa-test | `tests/ci/test_ac17_ac18_no_cache.py` resta la verifica statica della non applicabilità di AC17 e AC18, e da oggi gira dentro `ci` |
| @code-reviewer, @security | in una PR che tocca `.github/`: nessuna soglia copiata nel workflow, nessuna versione di Playwright scritta a mano, nessun input di cache |
