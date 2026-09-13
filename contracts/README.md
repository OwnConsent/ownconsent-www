# contracts/ — l'unica superficie di contatto fra agenti

Ogni agente legge da qui prima di scrivere codice. Le modifiche passano da `@architect`
e da un ADR in `docs/adr/`.

| File | Proprietario | Consumato da |
|---|---|---|
| `openapi.yaml` | @architect | @backend, @frontend, @qa-test |
| `cmp-api.md` | @architect | @backend — il confine con `OwnConsent/cmp` |
| `db/` | @database | @backend, @performance |
| `design-tokens.json` | @design | @frontend, @accessibility |
| `events.json` | @data-analytics | @frontend, @backend, @privacy |
| `data-map.json` | @privacy | @database, @backend, @security |
| `perf-budgets.json` | @performance | @devops (CI) |

Una modifica che rompe un consumatore esistente richiede un percorso di deprecazione
dichiarato nell'ADR. Rimuovere un campo senza deprecazione è un gate: si ferma.
