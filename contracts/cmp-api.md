# Confine con OwnConsent/cmp

Questo repository non contiene la CMP. Ci parla, e il confine va scritto qui prima che
qualcuno lo attraversi a naso.

Da definire alla tappa 02, con `@architect`:

- **Provisioning**: come questo sistema chiede alla CMP di creare un tenant, e cosa
  riceve indietro (identificativo, endpoint, credenziali iniziali).
- **Conteggio richieste**: chi conta, con quale granularità, e come il conteggio arriva
  qui per essere confrontato con il piano. Percorso caldo: vedi `perf-budgets.json`.
- **Licenza on-premise**: formato, firma, verifica offline, scadenza e rinnovo.
- **Dismissione**: cosa succede a un tenant quando il cliente smette di pagare — e in
  quanto tempo, dato che i consensi raccolti hanno obblighi di conservazione propri.

Regola: nessuna di queste quattro si implementa prima che sia scritta qui e ratificata
con un ADR.
