# Protocollo di handoff

Gli agenti si passano JSON, non prosa. Lo scratch sta sotto `.work/<issue-id>/`, in `.gitignore`:
`findings.json`, prove ed evidenze.

**Specifica e piano non sono scratch**: sono il contratto della consegna, una persona li
ratifica e chi rivede deve poterli leggere. Stanno in `docs/spec/issue-<id>.json` e in
`docs/plan/issue-<id>.json`, committati. Un artefatto che si ratifica non può stare in una
cartella ignorata da git (divergenza D-1 del piano della #8, ratificata da Andrea il 19/09/2026).

## Regola: non si riprende un agente per un compito nuovo

Un agente che ha finito si chiude. L'esito si scrive nell'artefatto di handoff
(`docs/spec/issue-<id>.json`, `docs/plan/issue-<id>.json`, `findings.json`) e il compito successivo lo fa un agente
**nuovo** che legge quell'artefatto. Vale anche per un messaggio accodato a un agente
appena fermo: quando viene consegnato lo riavvia, ed è una ripresa.

Perché: un agente ripreso si trascina il contesto dei giri precedenti e costa ogni volta
di più. Misura sulla issue #4 (2026-09-13), riprese consecutive dello stesso
`@product-spec`: **137k → 248k → 334k → 364k token**. I due giri nuovi della stessa issue
sono costati 74k e 189k.

Se al giro successivo manca un'informazione che non è nell'artefatto, il difetto è
dell'artefatto: si corregge il file, non si riprende l'agente. Se il contesto viaggia
nell'agente invece che nel file, il protocollo non serve a niente.

## Regola: nessun agente su un ramo che non discende da `origin/main`

Prima di delegare un lotto o un giro su un ramo esistente:

```
git fetch origin
git merge-base --is-ancestor origin/main <ramo>
```

Se il comando esce con un codice diverso da 0, **ci si rifiuta**: quel ramo non si riusa. Si crea un ramo nuovo da `origin/main` e ci si riporta il lavoro utile.

Perché: gli strumenti del cantiere vivono nel repository. Con `core.hooksPath=githooks`, una worktree su un ramo vecchio esegue la versione vecchia degli hook. Misura sulla issue #8 (2026-09-14): il ramo della PR #15 era nato prima della correzione delle firme (`d03b5b4`), e il comando `git diff --stat origin/main design/token-pagine-pubbliche -- githooks` stampava `githooks/prepare-commit-msg | 14 +-------------`. Il commit `04d7718` è rimasto con una firma che non si legge.

## Regola: cambiare strumento dopo un blocco

Cambiare strumento è lecito quando l'azione è la stessa e resta dentro il perimetro. Non lo è quando si sceglie un'altra strada perché la prima è stata negata nel merito. Si può riformulare solo se si sa dire perché il blocco era un falso positivo; se non si sa dirlo, ci si ferma e si chiede a una persona.

## Regola: al massimo due giri di ratifica

Se due ruoli si rimandano lo stesso documento più di due volte, il terzo giro non si fa: ci si ferma e si chiede a una persona.

Misura sulla issue #8: quattro giri fra @performance e @architect su `contracts/perf-budgets.json` sono costati 408.488 token (L01 140.930, R-L01 95.648, ratifica 75.869, R-L01b 96.041).

## Regola: i turni si riportano solo con il conteggio di sistema

Un report non dichiara mai turni stimati. Si riporta il conteggio dell'ambiente (chiamate di strumento, token), oppure niente.

Misura sulla issue #8: un agente ha dichiarato «circa 15-16 turni», mentre l'ambiente ne contava 81 di chiamate di strumento. Un numero stimato presentato come misura è lo stesso difetto di una misura riferita senza il comando che l'ha prodotta.

## docs/spec/issue-<id>.json — prodotto da @product-spec
```json
{
  "id": "123",
  "titolo": "Log dei consensi esportabile",
  "problema": "Chi gestisce il sito non può dimostrare un consenso a distanza di mesi.",
  "criteri_accettazione": [
    { "id": "AC1", "dato": "un consenso registrato ieri", "quando": "esporto il CSV del mese", "allora": "la riga c'è con timestamp UTC e purpose id" }
  ],
  "non_goal": ["interfaccia di ricerca full-text"],
  "dati_personali": [{ "campo": "ip_hash", "finalita": "prova del consenso", "retention": "6 anni" }],
  "rischi": ["volume di scrittura sul path caldo"],
  "domande_aperte": []
}
```
Regola: `domande_aperte` non vuoto ⇒ la catena si ferma e si commenta la issue.

## docs/plan/issue-<id>.json — prodotto da @orchestrator
```json
{
  "lotti": [
    { "id": "L1", "agente": "database", "titolo": "tabella consent_log + indici", "file": ["migrations/**"], "dipende_da": [] },
    { "id": "L2", "agente": "backend", "titolo": "mutation + export", "file": ["internal/consent/**"], "dipende_da": ["L1"] }
  ],
  "contratti_da_aggiornare": ["contracts/schema.graphql", "contracts/db/consent_log.sql"],
  "budget_turni": 40
}
```
Regola: due lotti non possono dichiarare gli stessi `file`. Se succede, si serializzano.

## findings.json — prodotto da ogni revisore
```json
{
  "agente": "security",
  "finding": [
    {
      "file": "internal/consent/export.go",
      "riga": 88,
      "gravita": "alta",
      "categoria": "authz",
      "sintesi": "L'export non filtra per tenant.",
      "scenario": "Utente del tenant B chiama exportConsents e riceve le righe del tenant A.",
      "verdetto": "CONFERMATO"
    }
  ]
}
```
Regola: senza `scenario` concreto il finding viene scartato. È il filtro che tiene bassa
la rumorosità e rende la review automatica leggibile.
