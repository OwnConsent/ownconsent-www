# Protocollo di handoff

Gli agenti si passano JSON, non prosa. Lo scratch sta sotto `.work/<issue-id>/`, in `.gitignore`:
`plan.json`, `findings.json`, prove ed evidenze.

La specifica **non è scratch**: è il contratto della consegna, e chi rivede deve poterla
leggere. Sta in `docs/spec/issue-<id>.json` ed è committata.

## Regola: non si riprende un agente per un compito nuovo

Un agente che ha finito si chiude. L'esito si scrive nell'artefatto di handoff
(`spec.json`, `plan.json`, `findings.json`) e il compito successivo lo fa un agente
**nuovo** che legge quell'artefatto. Vale anche per un messaggio accodato a un agente
appena fermo: quando viene consegnato lo riavvia, ed è una ripresa.

Perché: un agente ripreso si trascina il contesto dei giri precedenti e costa ogni volta
di più. Misura sulla issue #4 (2026-09-13), riprese consecutive dello stesso
`@product-spec`: **137k → 248k → 334k → 364k token**. I due giri nuovi della stessa issue
sono costati 74k e 189k.

Se al giro successivo manca un'informazione che non è nell'artefatto, il difetto è
dell'artefatto: si corregge il file, non si riprende l'agente. Se il contesto viaggia
nell'agente invece che nel file, il protocollo non serve a niente.

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

## plan.json — prodotto da @orchestrator
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
