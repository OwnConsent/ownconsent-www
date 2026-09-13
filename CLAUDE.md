# OwnConsent — sito e go-to-market

## Cosa è questo progetto

Il sito pubblico di OwnConsent e tutto ciò che porta un cliente dalla prima visita al
servizio attivo, nelle tre modalità di vendita. **Non** è la CMP: quella vive in
`OwnConsent/cmp` ed è un prodotto separato, con cui questo progetto parla via API.

OwnConsent è una CMP — una piattaforma di gestione del consenso: il pannello che raccoglie
e conserva le scelte di chi visita un sito, conforme a IAB TCF v2.2/v2.3 e Google Consent
Mode v2.

## Le tre modalità di vendita

| Modalità | Cosa riceve il cliente | Come paga | Chi registra la CMP |
|---|---|---|---|
| SaaS | configurazione e delivery da noi | canone mensile, piani per volume di richieste | noi |
| Hosted | istanza con risorse dedicate | in base alla taglia (disco, memoria, CPU) | *da decidere* |
| On-premise | installa da sé | licenza annuale | il cliente, a proprio nome |

> I prezzi non sono ancora definiti. Finché non lo sono, ogni pagina che li mostra porta
> un contrassegno visibile di pagina dimostrativa. Nessun agente inventa un importo.

## Stack
<!-- Compila prima di far partire la tappa 01. -->
- Frontend:
- Backend:
- Database:
- Pagamenti:
- Deploy:

## Comandi
| Scopo | Comando |
|---|---|
| Install | |
| Dev | |
| Test | |
| Lint | |
| Typecheck | |
| Build | |
| E2E | |

## Convenzioni
- Branch: `tipo/<id-issue>-<slug>`
- Commit: Conventional Commits, in inglese, imperativo.
- Ogni PR referenzia la issue e allega `.work/<id>/spec.json`.
- Tag di tappa del corso: `corso/NN-nome`.

## Regole non negoziabili

1. **Il sito della CMP rispetta la propria CMP.** Nessun cookie e nessuno storage non
   strettamente necessario prima del consenso, pixel di terze parti compresi, listino
   compreso. Un prodotto di compliance con un sito non conforme si smonta da solo.
2. I contratti in `contracts/` si leggono prima di scrivere codice e si modificano solo
   via `@architect`.
3. Chi scrive il codice non scrive i test di accettazione: quelli sono di `@qa-test`.
4. Nessun push diretto su `main`, nessun merge di PR, nessun comando su produzione.
5. Nessun segreto nei file, nei log o nei commenti di PR. Questo repository è pubblico.
6. Ogni campo di dato personale nuovo passa da `@privacy` prima del merge.
7. I prezzi, le pagine legali e la registrazione CMP presso IAB non sono decisioni di un
   agente. Prepara, non decidere, e segnala.
8. Se un'informazione manca, si apre una domanda sulla issue. Non si indovina.

## Journal

Ogni agente scrive in `journal/` **mentre** lavora, secondo
`docs/JOURNAL.md` del plugin cantiere. Decisioni con le alternative scartate, gate
incontrati, tentativi falliti, misure fatte. Un giro senza voci di tipo `fallimento` o
`gate` è un journal reticente, non un lavoro perfetto.

Questo repository è anche il materiale di un corso: il journal è la fonte primaria da cui
`/lezione` ricava moduli, slide, racconto e copione. Quello che non viene registrato non
esiste per il corso.

## Misura, non dedurre

Prima di dichiarare che qualcosa funziona: eseguilo. Prima di dire che una query è lenta:
`EXPLAIN`. Le affermazioni non verificate vanno marcate come tali.

## Firma del lavoro

Ogni commit porta in coda `Cantiere-Agent: <ruolo>`: lo aggiunge da solo il git hook
`githooks/prepare-commit-msg`, attivato con `git config core.hooksPath githooks`.
Serve a vedere in `git log` dove finisce il lavoro della squadra e dove comincia il tuo.

    ./githooks/chi-ha-fatto-cosa.sh              riepilogo per ruolo
    git log --grep='Cantiere-Agent: database'    tutto quello che ha fatto un ruolo

La firma è una comodità, non la fonte autorevole: chi ha deciso cosa, con quali alternative
e a che costo sta in `journal/`. Se un commit risulta firmato `sconosciuto`, la voce di
journal è ciò che rimedia.
