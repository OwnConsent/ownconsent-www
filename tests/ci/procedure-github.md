# Procedure per gli AC che richiedono GitHub

Questo lotto (CI3) non apre PR, non fa push, non crea rami remoti. Per ogni AC
che si puo' verificare solo con un'esecuzione reale su GitHub Actions, questa
pagina descrive la procedura esatta -- diff della PR di prova e comando `gh
api` che osserva l'esito -- perche' una persona con accesso in scrittura la
esegua. Nessuna di queste procedure e' stata eseguita da questo lotto.

Query di base («contesto ci» sul SHA di testa), usata da quasi tutte le
procedure sotto, da `docs/spec/issue-25.json`, definizioni:

    gh api 'repos/OwnConsent/ownconsent-www/commits/<sha>/check-runs?filter=latest' \
      --jq '[.check_runs[] | select(.name=="ci") | {id, status, conclusion, app: .app.slug}]'

Log dell'esecuzione:

    gh api 'repos/OwnConsent/ownconsent-www/actions/runs?head_sha=<sha>' \
      --jq '.workflow_runs[] | {id, event, path}'
    gh api repos/OwnConsent/ownconsent-www/actions/runs/<run_id>/jobs \
      --jq '.jobs[] | select(.name=="ci") | .id'
    gh run view <run_id> --job <job_id> --log

## AC1 -- un solo contesto ci, success, su una PR che tocca solo docs/

Diff: apri una PR di prova verso main con un solo commit che tocca un file
sotto docs/ (per esempio un carattere in un file esistente di docs/, mai in
tests/ci/ o .work/).

Osservazione: query di base sullo SHA di testa; attesa lunghezza 1, status
"completed", conclusion "success", app "github-actions".

Chiusura: chiudi la PR senza mergiarla e cancella il ramo.

## AC2 -- stesso, PR in bozza, nuovo commit

Diff: metti la PR di AC1 in draft (`gh pr ready <n> --undo`), poi pubblica un
nuovo commit che tocca solo docs/.

Osservazione: stessa query sul nuovo SHA di testa; in aggiunta
`gh pr view <n> --json isDraft` deve valere `true` al momento del push.

## AC3 -- il commit di main dopo il merge ha ci success, event push

Diff: nessuno oltre al merge della PR che introduce ci (la prima occasione e'
il merge di questo stesso lotto/issue).

Osservazione: query di base sullo SHA di main dopo il merge; in aggiunta, fra
le esecuzioni di quello SHA (`actions/runs?head_sha=<sha>`), quella che
contiene il job ci deve avere `event: "push"`.

## AC6 (parte dinamica) -- site/ presente e valido, tutti i verdi

Diff: PR di prova con un progetto Astro minimo sotto site/: `package.json`
con `packageManager` valido, `pnpm-lock.yaml` allineato, script `build` e
`lint` che riescono, `astro check` senza errori. (In alternativa: la prima PR
reale di L05.)

Osservazione: query di base -> success; `gh run view <run_id> --job <job_id>
--log` mostra, nell'ordine, invocazione e output di install, build, lint,
astro check.

## AC7 (parte dinamica) -- quattro commit che rompono ciascuno un passo

Diff: sulla PR di AC6, quattro commit separati sullo stesso ramo:
(a) `site/package.json` dichiara una dipendenza assente da
`site/pnpm-lock.yaml` (o rimuove il lockfile);
(b) lo script `build` esce con codice 1;
(c) lo script `lint` esce con codice 1;
(d) un file `.astro` con un errore di tipo, con build e lint verdi.

Osservazione: query di base su ciascuno dei quattro SHA -> failure; nel log,
l'errore del passo rotto da quel commit (per (a), l'errore di lockfile non
allineato o assente). Verifica che nessun commit successivo abbia riscritto
`site/pnpm-lock.yaml` per far passare (a).

## AC8 (parte dinamica) -- api/ presente e valido, tutti i verdi

Diff: PR di prova con un modulo Go minimo sotto api/: compila, nessuna
segnalazione di golangci-lint, almeno un test che passa in almeno due
pacchetti.

Osservazione: query di base -> success; log con l'esecuzione di
`go build ./...`, `golangci-lint run` e `go test -race -count=1 -v ./...`;
grep della riga di comando e dell'output per pacchetto.

## AC9 (parte dinamica) -- quattro commit che rompono ciascuno un passo

Diff: sulla PR di AC8, un commit per ciascun caso: (a) errore di compilazione
in un file non di test; (b) un valore di errore ignorato, segnalato da
golangci-lint con la configurazione del repository; (c) un test con
`t.Fatal`; (d) un test con una data race che passa senza `-race`.

Osservazione: query di base su ciascuno SHA -> failure; nel caso (d), il log
contiene `WARNING: DATA RACE`.

## AC11 -- .nvmrc cambiato, versione valida poi inesistente

Diff: due commit sullo stesso ramo, che toccano solo `.nvmrc`: prima
`22.12.0`, poi `22.99.99`.

Osservazione: `git diff --name-only origin/main...<sha>` elenca solo
`.nvmrc`; sul primo commit, grep di `v22.12.0` nel log come versione di Node
in uso; query di base sul secondo commit -> failure, senza righe che
mostrino un'altra versione di Node in uso.

## AC13 (parte dinamica) e AC14 -- packageManager cambiato

Diff: PR di prova con site/ presente e valido (AC6/AC8), poi due commit che
cambiano solo il campo `packageManager` di `site/package.json`: prima
un'altra versione esistente di pnpm, poi una inesistente.

Osservazione: sul primo commit, grep della versione dichiarata nel log
dell'output di `pnpm -v`; `git diff origin/main...<sha>` tocca solo quel
campo; sul secondo commit, query di base -> failure, senza righe che
mostrino un'altra versione di pnpm in uso. Nota della spec: se la versione
alternativa richiede un lockfile di formato diverso, il primo commit puo'
fallire all'installazione -- conta la versione riportata nel log, non la
conclusion.

## AC15 -- sezione «GITHUB_TOKEN Permissions» nel log

Diff: nessuno oltre a un'esecuzione di ci su una PR e una su main (per
esempio le stesse di AC1 e AC3).

Osservazione: `gh run view <run_id> --job <job_id> --log | grep -A15
'GITHUB_TOKEN Permissions'`; la sezione elenca solo permessi fra
`Contents: read` e `Metadata: read`, nessuna voce con `write`.

## AC17 e AC18 -- non applicabili

Dichiarati non applicabili staticamente da
`tests/ci/test_ac17_ac18_no_cache.py`: il workflow (letto su main dopo il
merge) non usa alcuna cache (ADR-0003, D4: setup-node senza `cache` e con
`package-manager-cache: false`, setup-go con `cache: false`,
golangci-lint-action con `skip-cache: true`, nessun `actions/cache`). Nessuna
procedura da eseguire finche' questa premessa vale; si riapre se D4 viene
riaperto (vedi ADR-0003, tabella Scadenze).

## AC21 -- gate umano, non a carico del lotto

"a_carico_di: una persona (Andrea), non il lotto: e' un non-goal per gli
agenti (gate umano, journal/2026-09-15/082433-feature-gate.json)" (spec).
Nessuna procedura di questo lotto: dopo il merge, una persona legge la
protezione di main e apre una PR di prova con ci in failure (per esempio il
caso AC5) per verificare che la protezione blocchi il merge.

    gh api repos/OwnConsent/ownconsent-www/branches/main/protection \
      --jq '.required_status_checks.checks'
    gh pr view <n> --json mergeStateStatus,statusCheckRollup
