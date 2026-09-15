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
