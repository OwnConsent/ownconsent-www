# Ricognizione del materiale — consegna 1 (issue #8)

Ricognizione dei punti 1, 2, 3, 5 e 6 di `/lezione`. **Il punto 4 non è eseguito e
`@case-study` non è stato chiamato:** qui non ci sono moduli, slide, racconto né copione.
La struttura del corso la decide Andrea dopo aver letto cosa manca.

Prodotta il 25/09/2026 dalla sessione principale sul ramo `corso/ricognizione-consegna-1`.
Voci di journal della sessione: `journal/2026-09-25/`.

---

## 0. Intervallo — determinato, non assunto

| | valore | da dove |
|---|---|---|
| inizio | `2026-09-13T18:01:22+02:00` | prima voce con `issue=8`: `journal/2026-09-13/180122-orchestrator-gate.json` |
| fine | `cb2e804`, `2026-09-24T12:51:46+02:00` | `git rev-parse origin/main` → `cb2e8046bf6de7b0b770d0007dde6a3d151378a5` |
| commit su main | **112** (da `4cb1674` a `cb2e804`) | `git rev-list --count 4cb1674~1..cb2e804` → `112` |
| voci di journal | **361**: 288 `issue=8`, 72 `issue=25`, 1 `issue=4` | script sui `journal/*/*.json` filtrati per `ts` |
| PR create | 41 fuse, 5 chiuse senza merge (tutte `PROVA — NON MERGIARE`) | `gh pr list --search 'created:2026-09-13T16:00:00Z..2026-09-24T11:00:00Z'` |

Prima e ultima voce per issue, dalla stessa lettura:

    issue 4  -> 49 voci  2026-09-13T16:00 .. 2026-09-13T18:50
    issue 25 -> 72 voci  2026-09-15T08:24 .. 2026-09-19T11:23
    issue 8  -> 288 voci 2026-09-13T18:01 .. 2026-09-24T12:51

**Ordine: per `ts`, non per nome di file.** Il nome del file e il campo `ts` di una voce
sono generati separatamente e possono divergere. Misura del 26/09 su tutte le 431 voci:
in 40 i due non coincidono. Ci sono 31 nomi a quattro cifre, senza secondi: 30 del 13/09 e
1 del 20/09. Poi 6 voci con un orario diverso nel nome, 1 del 15/09 e 5 del 22/09. Infine 3
voci del 25/09 (`123418`, `153655`, `173942`), che hanno un
nome un secondo più avanti del `ts` e lo stesso `ts` della voce precedente. Il 22/09 lo
scarto arriva a 14 minuti (`112000-design-fallimento` ha `ts` 11:05:56). Ordinate per nome,
7 coppie di voci adiacenti risultano in ordine inverso rispetto al `ts`.

In questa ricognizione **niente è ordinato per nome di file**. Filtro dell'intervallo,
prima e ultima voce, durate del §3: tutto si calcola sul `ts`. L'unico numero che cambierebbe
è la fine di L10: 11:08 per `ts` (`110840-orchestrator-consegna`), 11:05 se si prende
l'ultimo file per nome (`112100-design-decisione`). Il §3 riporta 11:08.

Scelte di perimetro (voce `122626-orchestrator-decisione`):

- **Dentro:** la #8, e la #25 (L-CI) contata **a parte** come prerequisito. Il piano la
  elenca fra i `lotti_gia_chiusi`, prova `b2480ac`.
- **Fuori:** la #4, l'impianto del cantiere (`2c0b095`…`5c96347`) e l'unica voce `issue=4`
  che cade nell'intervallo (`185045-feature-correzione`).
- **Una trappola misurata:** fino al 14/09 il `(#N)` nel soggetto dei commit è il numero
  della **PR**, non della issue. La spec della #8 è `32272db … (#13)`. Filtrare con
  `git log --grep='#8'` perde tutto lo stadio 01–02.

---

## 1. Buchi nel materiale — in cima, come chiede il punto 2

### 1.1 Le due cose che Andrea sapeva già: verificate

**(a) @frontend ha zero voci in L14, e il suo codice sta in due commit dell'orchestrator. CONFERMATO.**

    voci issue=8, lotto=L14, per agente     -> orchestrator 27, qa-test 11, architect 2, frontend 0
      di cui L14 del piano (23/09 14:55 → 24/09 12:51) -> orchestrator 27, qa-test 6, architect 2, frontend 0
      di cui «L14 (21/09)», un altro lavoro (§1.4)     -> qa-test 5
    git log ... %(trailers:key=Cantiere-Agent) e9475a6 -> orchestrator
                                               6211d5f -> orchestrator
    soggetti: «wip(site): lavoro di @frontend fermato al tetto dei turni, non misurato, salvato dall'orchestrator»
              «wip(site): secondo @frontend fermato al tetto, L09-F1 corretto a meta' e non chiuso, salvato dall'orchestrator»

In tutta la consegna le voci con `frontend` nel campo `agente` stanno **solo in L06**.
Sono 4 `frontend`, 3 `frontend (sessione principale)` e 1
`frontend (sessione principale, dopo due agenti delegati fermati al tetto turni)`.
Nota: `2026-09-24/125146-orchestrator-misura` conta 25 voci orchestrator in L14, io ne
conto 27. Tutte e 27 sono del L14 del piano. La differenza viene dal momento della misura:
125146 non poteva contare sé stessa né la voce che la accompagna in `cb2e804`. Tutte e due
le misure contano anche le 5 voci di @qa-test di «L14 (21/09)» (§1.4). La sostanza non
cambia: @frontend resta a zero.

**(b) `tetto_turni` in `docs/plan/issue-8.json` non è mai stato applicato. CONFERMATO, con una sfumatura.**

    grep -rn tetto_turni (escluso il piano) -> solo voci di journal; nessuno script, hook o workflow lo legge

| lotto | `tetto_turni` del piano | tetto a cui l'agente si è fermato, secondo il journal | voce |
|---|---|---|---|
| L07 | 110 | 45 | `2026-09-20/171823-feature-consegna` |
| L08 | 40 | 20 per tranche | `2026-09-21/092500-code-reviewer-fallimento` |
| L09 | 50 | 20 | `2026-09-22/105042-orchestrator-fallimento` |
| L10 | 45 | 45 | `2026-09-22/110840-orchestrator-consegna` |
| L14 | 45 | 45 | `2026-09-23/151439-orchestrator-gate` |

La sfumatura: il campo è stato *letto*. I brief lo riportavano (105042: «il brief lo
riportava»), quindi «mai usato» è vero come *mai applicato*, non come *mai letto*. E dove
il numero del piano **coincide** con quello dell'ambiente (45, in L10 e L14), due voci
attribuiscono l'arresto al campo del piano («45, tetto_turni del piano»). È una coincidenza
scambiata per un meccanismo. Le due voci, `110840-orchestrator-consegna` e
`151439-orchestrator-gate`, sono corrette **per aggiunta** dalla voce
`2026-09-25/153839-orchestrator-correzione`. Restano come erano, con un campo
`corretta_da` che rimanda lì.

**Da dove vengono il 20 e il 45 — dato fornito, non misurato.** Sono i `maxTurns` nelle
schede degli agenti, in `cantiere/plugins/cantiere/agents/*.md`, non il piano. **Fonte:
Andrea, il 25/09.** Il plugin è fuori dal perimetro di questa sessione: `guard-paths` ne
blocca la lettura e non l'ho aggirato (voce `122651-orchestrator-gate`). Il dato arriva
quindi da fuori la misura, e chi legge non lo può rifare da questo repository.

**Dal 24/09 quei valori sono cambiati** (stessa fonte): cinque revisori passano da 20 a 30
`maxTurns`, @qa-test e @frontend da 45 a 60. Sono il commit `58019f2` e i seguenti, nel
repository cantiere. **La coincidenza con il 45 del piano non esiste più:** il
`tetto_turni` 45 di L10 e L14 non corrisponde più a nessun tetto dell'ambiente. Per i
lotti chiusi prima del 24/09 la tabella qui sopra resta vera così com'è.

**Il plugin non legge `tetto_turni`: misura di Andrea, fuori dal perimetro di questa
sessione.** Nel repository la misura è mia: `git grep -n tetto_turni -- ':!journal'
':!docs/plan/issue-8.json' ':!corso'` → nessuna riga. Sul plugin l'ha fatta Andrea il
25/09, nel repository cantiere; da qui non la posso rifare:

    grep -rn 'tetto_turni' plugins/cantiere/   ->  zero occorrenze in agents/, hooks/ e skills/
                                                   nessun hook legge plan.json o docs/plan
    maxTurns                                   ->  dichiarato solo nelle 24 schede degli agenti: fonte unica

Con questa misura `tetto_turni` è un **campo morto**: nessun codice lo legge e nessuna
istruzione lo applica. È diverso da `budget_turni` (§1.3 bis), che un'istruzione la ha.

### 1.2 Altri buchi della forma (a): un ruolo ha lavorato, ma il suo registro non lo dice

Metodo: per ogni lotto ho confrontato l'`agente` del piano con il campo `agente` delle voci
e con i trailer `Cantiere-Agent` **dei commit delle PR**. Su main i trailer non si leggono
(§4.1), quindi ho usato `git fetch origin '+refs/pull/*/head:refs/remotes/pr/*'` e poi
`git log baseRefOid..pr/N`.

| lotto | ruolo del piano | voci del ruolo | trailer del ruolo nella PR | cosa manca |
|---|---|---|---|---|
| **L05** | frontend | **0** (8 voci, tutte `feature (sessione principale)`) | **0** — PR #34: 3 orchestrator, 1 senza firma | Il caso L14 si era già visto qui, quattro giorni prima: due @frontend al tetto «senza commit, senza push e senza journal» (`2026-09-19/203804`, `2026-09-20/092227`, «279.965 token persi»). |
| **L15** | privacy | **0** (5 voci, tutte `orchestrator`) | **0** — PR #53: 3 orchestrator | Il lotto l'ha fatto la sessione. Nessuna voce dice perché non @privacy: grep di `privacy` nelle voci L15 del 23/09 → nessuna decisione di ruolo. |
| **L07** gruppo A | qa-test | **0** per il gruppo A | — | `2026-09-20/162537-feature-fallimento`: «Il gruppo A ha consegnato sette commit e nessuna voce di journal». |
| **L04** | privacy | 3 | **0** — PR #35: 3 orchestrator, 2 senza firma, **1 `cantiere:qa-test`** | Una firma di un altro ruolo, con il prefisso del plugin (`cantiere-cantiere:qa-test`), in un lotto di @privacy. |
| **L08** | code-reviewer | 11 | **0** — PR #41: 8 orchestrator | Il journal c'è, la firma no. I commit sono del 21/09 mattina, prima di `4dcebd0` (21/09 11:12), quando la firma veniva ancora dal file-marcatore condiviso. Il commento dell'hook dice che in quel periodo «quasi tutti i commit risultavano orchestrator». |
| **L12** | devops | 5 | 5 | Il lavoro di @qa-test è finito nel commit orchestrator `aa8bae7`. Registrato: `2026-09-21/153953-orchestrator-fallimento`. |
| **L14** | frontend | 0 | 0 | Anche @qa-test sta sotto firma orchestrator in `dd02ecb` e `1ec17e3`. Registrato: `2026-09-24/125146`. |

**Etichette di ruolo indossate dalla sessione.** 116 voci della consegna sono
`feature (sessione principale)`. Poi ci sono `frontend (sessione principale)`,
`architect (sessione principale)` e `orchestrator (sessione principale)`. La consegna
di L06 (`181630`) è firmata `frontend (sessione principale)`. Contare le voci per ruolo
dà quindi un numero che mescola subagenti e sessione. Qualunque tabella «chi ha fatto
cosa» per il corso deve separarli a mano.

### 1.3 Altri buchi della forma (b): dichiarato in un artefatto, mai applicato o mai chiuso

| cosa | dove è dichiarato | misura |
|---|---|---|
| Stima dei token della consegna: 21 invocazioni, circa 3,2 M; caso peggiore 44, circa 6,7 M | `2026-09-13/182105-feature-misura` | Mai confrontata con un consuntivo in token. |
| `costo_token`, `durata_s` | formato di `docs/JOURNAL.md` | **1 voce su 360** porta `costo_token` (86 839, spec della #25). **1 su 360** porta `durata_s`. Il costo in dollari esiste una volta sola, il 20/09 dopo L07 (§3). |
| Skill `/collaudo` («usala su ogni PR prima del merge») | descrizione della skill nel plugin cantiere, fuori dal repository. `grep -n -i collaudo CLAUDE.md docs/DEFINITION-OF-DONE.md` → nessuna riga | Nessuna voce la registra come lanciata nell'intervallo. Comando: `grep -l -i -E 'pr-fanout\|/collaudo\|skill collaudo\|cantiere:collaudo' journal/*/*.json` → `180122-orchestrator-gate` e `181016-orchestrator-misura`, del 13/09. Il comando cerca la skill, non il workflow: per il workflow vedi la riga sotto. |
| Workflow `Verifica agentica su PR` | `.github/workflows/claude-pr-review.yml` | **Spento per decisione, con una scadenza mancata.** `gh api …/actions/workflows` → `disabled_manually`, ultima modifica il 13/09 alle 15:51:23. `git log --follow` sul file → solo `2c0b095`: lo spegnimento non è un commit. `grep -l -i -E 'claude-pr-review\|Verifica agentica' journal/*/*.json` → 4 voci, fra cui **`2026-09-13/184350-feature-decisione`**: spento deliberatamente da Andrea, con la scadenza «si riaccende all'apertura della PR-4 della consegna 1 (primo codice in site/)». Il primo codice in `site/` è la PR #34, del 20/09; il workflow è ancora spento. 2 run in tutta la storia, entrambi falliti il 13/09 (PR #1 e #2). Commenti di collaudo sulle 26 PR controllate: **0**. Dettaglio in `2026-09-25/153654-orchestrator-misura`. |
| `revisioni.nessuno_rivede_il_proprio_lavoro` | piano | Rispettato in L08, L09, L10 e L13. Per L14 e L15, che toccano `site/`, le voci non contengono nessun ruolo di revisione (L14: orchestrator, qa-test, architect; L15: solo orchestrator). La regola resta vera solo perché non ha rivisto nessuno. |
| Campo obbligatorio per tipo (`docs/JOURNAL.md`) | tabella «Tipi di voce» | **15 voci** senza il campo obbligatorio: 7 `consegna` senza `dod_soddisfatta` (devops 091954, privacy 161048, qa-test 170339, 170529, 171115, 171350, 171534), 3 `decisione` senza `alternative`, 3 `misura` senza `evidenza`, 2 `fallimento` di @design senza `cosa_si_e_imparato`. Quelle di @design hanno campi propri (`cosa_dicevo`, `perche_era_sbagliata`), fuori schema. |

### 1.3 bis `budget_turni`: un'istruzione senza meccanismo, non un campo morto

Nella prima stesura questo campo stava nella tabella qui sopra, fra le cose «dichiarate e
mai applicate». **Era sbagliato:** Andrea ha misurato che un'istruzione lo applica.

**Misura di Andrea, 25/09, nel repository cantiere, fuori dal perimetro di questa
sessione:** `budget_turni` compare una volta, in `plugins/cantiere/agents/orchestrator.md`
alla riga 24: «Non superare budget_turni di plan.json. Al superamento fermati e riporta
cosa manca».

**Misura mia, in questo repository:** `docs/plan/issue-8.json` → `"budget_turni": 615`.
Nessuna voce lo confronta con un consuntivo: le occorrenze di `615` nel journal sono tutte
un altro numero, per esempio l'id di una worktree. Nessuna voce dice «budget superato» né
«budget rispettato».

    grep -l -i -E 'budget (superato|rispettato)|superato il budget|budget_turni' journal/*/*.json
      -> 1717 (issue 4), 181805 e 185045 (issue 8): tutte del 13/09, stadio di piano; nessun consuntivo

**Due cose diverse:**

| | `tetto_turni` | `budget_turni` |
|---|---|---|
| chi lo legge | nessuno: né codice, né hook, né scheda, né skill (§1.1 b) | un'istruzione nella scheda dell'orchestrator |
| meccanismo che lo fa rispettare | nessuno | nessuno |
| consuntivo | nessuno | nessuno |
| classe | **campo morto** | **istruzione senza meccanismo** |

Un campo morto non chiede niente a nessuno. Un'istruzione senza meccanismo chiede
qualcosa, ma chi la deve rispettare non ha il numero per farlo: per `budget_turni`
servirebbe il conteggio dei turni già spesi, e `docs/JOURNAL.md` vieta di dichiararlo
perché gli agenti lo sbagliano (15 contro 81, 24 contro 35). È la stessa famiglia di
«committa a incrementi» prima che esistesse il gate a tempo sui commit. Nel journal quella
istruzione fallisce due volte di fila: `2026-09-20/161654-feature-fallimento`, «l'ordine di
spingere dopo il primo commit non serve se il primo commit non arriva mai». Un'istruzione
che non tiene.

### 1.4 Buchi della forma «suonano uguali»: la stessa etichetta di lotto per due lavori

In questo file, da qui in poi, **`L09` e `L14` senza altro indicano sempre il lotto del
piano**. L'altro lavoro si scrive con la data accanto: **«L09 (21/09)»** e **«L14 (21/09)»**.

| nome in questo file | etichetta nel journal | lavoro | chi | voci | PR |
|---|---|---|---|---|---|
| **L14 (21/09)** | `L14` | rientro di F13 e F14 di L08 in `e2e/` (copia temporanea: porta stretta, identità del server), 21/09 09:43–10:40 | @qa-test | 5 (2 decisione, 2 misura, 1 fallimento) | #42, ramo `l14/copia-temporanea-porta-stretta-e-identita` |
| **L14** (piano) | `L14` | rientro dei finding su `site/`, test di regressione, ADR-0005, 23/09 14:55 → 24/09 12:51 | @frontend (piano); di fatto la sessione, @qa-test, @architect | 35 | #55, #59 |
| **L09 (21/09)** | `L09` | fix della raccolta dei test (worktree annidate) e porta stretta dell'anteprima, 21/09 13:57–14:03 | orchestrator | 5 (3 misura, 1 fallimento, 1 consegna) | #44 |
| **L09** (piano) | `L09` | verifica WCAG 2.2 AA da tastiera sulle 8 pagine, 22/09 10:45–10:59 | @accessibility (5 voci), sessione (3) | 8 | #49 |

Chi filtra il journal per `lotto` mescola i due lavori, e tutti i conteggi per lotto che
seguono vanno letti con questa tabella accanto.

**Un'etichetta deve indicare un solo lavoro.** «L14» come ramo del 21/09 e «L14» del piano
suonano uguali e non sono la stessa cosa: hanno ruolo, perimetro e PR diversi. Un
lavoro che non è un lotto del piano prende un nome che nel piano non esiste. Qui lo annoto
e basta: le voci del 21/09 non si rietichettano, perché il journal si corregge solo per
aggiunta.

### 1.5 Commit significativi senza voce di journal

Metodo: un commit è coperto se aggiunge un file sotto `journal/` o se una voce ne cita
l'hash. Per gli scoperti ho cercato l'argomento nel journal.

| commit | cosa cambia | stato |
|---|---|---|
| `4dcebd0` 21/09 | `githooks`: la firma passa da file-marcatore a `CANTIERE_AGENT`. È il cambio di meccanismo che rende leggibili i trailer da lì in poi. | **Scoperto.** Nessuna voce registra la decisione. `CANTIERE_AGENT` compare solo in `153953`, quattro ore dopo e per altro. La storia sta solo nel commento dell'hook. |
| `4cb1674` 13/09 18:39 | CLAUDE.md: «riporta il comando e il suo output»; le correzioni del journal si aggiungono | **Scoperto.** Nessuna voce precedente al commit. |
| `4209875` 19/09 | `docs/JOURNAL.md`: orari dall'orologio, niente conteggi, niente trailer a mano | **Parziale.** Le cause sono misurate (15 contro 81, 24 contro 35), ma nessuna voce registra la decisione di scriverle come regola. `142113` lo cita solo come HEAD. |
| `01f4f4e` 14/09 | `.gitignore` di `.claude/` | Scoperto; minore. |
| `e9475a6`, `6211d5f` | codice di @frontend | Voci dell'orchestrator sì, del ruolo no (§1.1). |

Coperti dopo verifica: `73ec28a` (da `152730-architect-decisione`), `c116bb4` (la voce
mancante l'ha aggiunta `0c47e93`), `cfe649e` (da `092721`), `b291bc3` (da `cb2e804`),
`3fe1874` e `4575311` (da voci del 13/09, prima dell'intervallo).

**A chi chiedere** (punto 2: si chiede al ruolo, non si inventa):

- `4dcebd0` e `4cb1674` → Andrea: nessuna voce indica chi li ha decisi;
- L05 → le misure di @frontend sono perse con la worktree (`092227`); resta solo il
  racconto della sessione;
- L15 → la sessione: perché non @privacy.

---

## 2. Rapporto fallimenti / successi (punto 3)

| issue | voci | decisione | misura | fallimento | gate | correzione | consegna | (fall+gate+corr)/tot |
|---|---|---|---|---|---|---|---|---|
| 8 | 288 | 85 | 95 | 47 | 21 | 9 | 31 | 77/288 = 26,7 % |
| 25 | 72 | 18 | 26 | 8 | 9 | 5 | 6 | 22/72 = 30,6 % |

Per lotto (issue 8), in ordine: decisione, misura, fallimento, gate, correzione, consegna.

    L00  9  [4, 1, 2, 0, 1, 1]      L07 40  [15,15, 7, 1, 0, 2]
    L01 14  [5, 3, 2, 1, 2, 1]      L08 17  [5, 5, 4, 2, 0, 1]
    L02 12  [3, 6, 1, 0, 0, 2]      L09  8  [2, 2, 2, 0, 1, 1]   + L09 (21/09) 5 [0,3,1,0,0,1]
    L03 22  [5, 6, 4, 4, 0, 3]      L10  9  [2, 3, 2, 0, 1, 1]
    L04  9  [4, 2, 1, 1, 0, 1]      L11  5  [2, 1, 0, 0, 1, 1]
    L05  8  [1, 3, 3, 1, 0, 0]      L12 21  [4,10, 1, 2, 2, 2]
    L06 10  [1, 5, 1, 2, 0, 1]      L13  7  [2, 2, 2, 0, 0, 1]
    L06-prerequisito 6 [1,3,1,1,0,0] L14 35 [10,10, 4, 2, 1, 8]   + L14 (21/09) 5 [2,2,1,0,0,0]
    piano (stadio 02) 3 [1,1,0,0,0,1] L15 5  [2, 1, 1, 0, 0, 1]
    senza lotto 34 [12,11,6,3,0,2]  (più 4 voci a cavallo: «L00, L03», «L01, L02», «L01, L03», «L02, L03»)

La somma dei blocchi fa 284; più le 4 voci a cavallo fa 288, il totale della prima tabella.
La prima stesura diceva «5 voci a cavallo» e la somma dava 289. Il conteggio rifatto il 26/09
ha trovato giusto il 288 e sbagliato il 5: le voci con due lotti nel campo sono quattro.
I vettori per tipo sono stati riverificati tutti e coincidono.

**Come si rifà.** Si leggono tutti i `journal/*/*.json` e si tengono le voci con `issue`
uguale a `"8"` e `ts` compreso, estremi inclusi, fra `2026-09-13T18:01:22+02:00` e
`2026-09-24T12:51:46+02:00` (§0). Il confronto si fa sul `ts` come istante, non sul nome
del file (§0). Il campo che conta è `lotto`, preso **com'è scritto**: `"L01, L02"` è un
blocco a sé e non si divide fra L01 e L02, e `null` va in «senza lotto». Soltanto `L09` e
`L14` si separano per data: le voci con `ts` del 21/09 formano «L09 (21/09)» e «L14 (21/09)»
(§1.4). Il `tipo` si conta così com'è; nessuna voce ha un tipo fuori dai sei.

    python3 - <<'EOF'
    import json, glob, collections
    from datetime import datetime as dt
    a, b = dt.fromisoformat('2026-09-13T18:01:22+02:00'), dt.fromisoformat('2026-09-24T12:51:46+02:00')
    T = ['decisione', 'misura', 'fallimento', 'gate', 'correzione', 'consegna']
    g = collections.defaultdict(collections.Counter)
    for f in glob.glob('journal/*/*.json'):
        d = json.load(open(f))
        if str(d['issue']) != '8' or not a <= dt.fromisoformat(d['ts']) <= b: continue
        k = str(d['lotto']) + (' (21/09)' if d['lotto'] in ('L09', 'L14') and d['ts'][:10] == '2026-09-21' else '')
        g[k][d['tipo']] += 1
    for k in sorted(g): print(f'{k:20s} {sum(g[k].values()):3d}', [g[k][t] for t in T])
    print('totale', sum(sum(c.values()) for c in g.values()))
    EOF

**Esito:** il journal non è reticente in aggregato. Nessun lotto è fatto di soli successi:
l'unico senza `fallimento` né `gate`, L11, ha una `correzione`. Il blocco «piano (stadio 02)»
(3 voci) non ha intoppi.

**Il punto debole non è il rapporto, è chi scrive i fallimenti.** I fallimenti più
istruttivi della consegna, cioè gli agenti fermati al tetto senza consegna, sono scritti
**dalla sessione per conto del ruolo**, perché il ruolo non ha lasciato niente
(L05, L13 `105641`, L14 `150337`, L07 gruppo A). Il corso ha il fatto e la versione
di chi ha raccolto i pezzi, non quella di chi ha fallito.

---

## 3. Numeri (punto 5)

**Costo.** Una sola misura in tutto l'intervallo, di Andrea
(`2026-09-20/211044-andrea-misura`, `/cost`, listino API):

    sessione 1 (4 giorni, fino a L04)  115,43 USD  114 richieste  1,01 USD/turno  ~800k contesto/richiesta
    sessione 2 (L06)                    36,73 USD  256 richieste  0,14 USD/turno  ~200k
    sessione 3 (L07)                    53,89 USD  185 richieste  0,29 USD/turno  ~235k
    totale                             206,05 USD per circa 11 000 righe aggiunte

**Dopo L07 non c'è nessun dato di costo.** L08–L15, la #25 e il registro del 24/09 non
hanno un numero. Il «costo per stadio» chiesto dal punto 5 **non è ricavabile**: è il buco
più grande per una lezione fatta di numeri.

**Durata** (prima → ultima voce del lotto, dal journal):

    L00 13/09 18:58→19:32   L05 19/09 20:21→20/09 18:27   L09 22/09 10:45→10:59
    L01 13/09 19:46→14/09 10:56   L06 20/09 17:45→18:16   L10 22/09 10:51→11:08
    L03 13/09 19:56→20:39   L07 19/09 18:12→20/09 19:30   L12 21/09 15:11→16:21
    L04 20/09 16:04→17:29   L08 21/09 08:48→09:25   L13 22/09 10:44→11:02
    L14 23/09 14:55→24/09 12:51   L15 23/09 12:48→12:52
    fuori piano (§1.4): L14 (21/09) 09:43→10:40   L09 (21/09) 13:57→14:03
    consegna intera: 13/09 18:01 → 24/09 12:51

**Arresti al tetto dei turni.** 16 voci ne parlano. Agenti fermi senza consegna, per
come li conta il journal: L05 2 @frontend (`092227`), L04 «terzo agente» (`160922`),
L07 (`161654`), L08 5 revisori su 5 (`092500`), L09 1 (`105042`), L13 1 (`105641`),
L14 2 @frontend e 1 @qa-test (`150337`, `151439`, `170625`); per la #25, CI1 e il
@qa-test di CI3 (`091831`, `093153`). Niente conteggi di turni: la regola di
`docs/JOURNAL.md` lo vieta, e il dato dichiarato si è già rivelato sbagliato due volte.

**Finding confermati su finding grezzi:**

| lotto | confermati / grezzi | voce |
|---|---|---|
| L08 revisione avversariale | 19 / 26 (7 scartati alla confutazione) | `090549-code-reviewer-consegna` |
| L09 WCAG da tastiera | 2 finding, 3 controlli conformi, 32/32 combinazioni | `105733-accessibility-consegna` |
| L10 documento contro prodotto | 7 / 8 (1 scartato alla riverifica), 6 conformità | `110840-orchestrator-consegna` |
| L13 SEO sull'HTML servito | 3 finding, 3 ipotesi smentite | `110214-seo-consegna` |

**Gate:** 21 voci `gate` sulla #8 e 9 sulla #25. **Correzioni:** 9 + 5.

**CI** (`gh run list`, filtrato sull'intervallo): 121 run di `CI`, 118 verdi e 3 rossi.
I 3 rossi sono tutti su rami `prova/*` voluti rossi: `prova/ci-rosso` ×2 e
`prova/l12-gate-rosso`. **Zero rossi non voluti.** Ci sono poi 3 run del workflow
`PROVA L12 — variabilita' di laboratorio`. Durata del job `ci`: 19 s → 109 s dopo L12
(`41fbbfa`).

**Suite di collaudo:** 184 rossi su 249 alla fine di L07 (rossi come atteso), poi 7 rossi
su 252 con le pagine vive, poi 252/252 dopo L08, 311/311 in L14 (`1ec17e3`) e 327/327
alla chiusura dei residui (`5b36e37`).

---

## 4. Tag proposti (punto 6) — **non creati**

| tag proposto | commit | tappa |
|---|---|---|
| `consegna-1/00-spec` | `32272db` | spec della consegna 1 su main |
| `consegna-1/01-contratti` | `0e079fc` | contratti, ADR-0001/0002, token, toolchain (L01, L02, L03, L11) |
| `consegna-1/02-ci` | `b2480ac` | contesto `ci` (#25) |
| `consegna-1/03-piano` | `41ff0a2` | piano degli undici lotti |
| `consegna-1/04-onda-1` | `8288e81` | L05, L04, L06, L07 e la misura di costo |
| `consegna-1/05-onda-2` | `4dd121b` | L08, L12, L09, L10, L13 |
| `consegna-1/06-metodo` | `1ae5db2` | quarta classe di divergenza, A01–A08, L15 |
| `consegna-1/07-onda-3` | `5b36e37` | L14 chiuso, suite 327/327 |
| `consegna-1/08-registro` | `cb2e804` | ADR-0005 ratificata, A10–A11, voci aperte nelle issue #56–#58 |

Nota su `06-metodo`: L15 (`39daaee`) è dell'onda 3 ma sta su main **prima** di L14.
Il tag segue l'ordine di main, non quello del piano.

### 4.1 Una cosa sui tag che viene dalla misura

I trailer `Cantiere-Agent` **non si leggono dai commit di main** fino al 21/09. Le PR
sono fuse con squash e GitHub mette le firme dei singoli commit nel corpo, non
nell'ultimo paragrafo:

    git log main --format='%h %(trailers:key=Cantiere-Agent,valueonly)' 718d54a  -> vuoto
    git show -s --format=%B 718d54a | tail   -> «Cantiere-Agent: orchestrator … ---------  Co-authored-by: …»

Un tag su main non basta quindi per ricostruire chi ha fatto cosa. Servono i
`refs/pull/*/head`, che vivono su GitHub e non nel repository. Se il corso deve reggere
senza GitHub, quei riferimenti vanno fissati altrove. È una decisione di Andrea, non la
prendo qui.

### 4.2 Firme `Co-Authored-By` di modello su main

Nell'intervallo, **13 commit** di main portano fra i trailer un `Co-Authored-By` di un
modello: 12 `Claude Opus 5 (1M context)` e 1 `Claude Sonnet 5` (`b677bdd`). In 4 casi è
l'unico co-autore (`76ee693`, `7db22ad`, `fe50e11`, `3fe1874`). Sono tutti squash di
GitHub anteriori al 21/09: il blocco `Co-authored-by` lo compone GitHub raccogliendo i
co-autori dei commit della PR. `docs/JOURNAL.md` dice «nessun trailer scritto a mano».
Non ho verificato se nei commit d'origine quelle righe le ha messe l'harness o una mano:
lo segnalo e basta.

    for h in $(git log 4cb1674~1..cb2e804 --format=%h); do git log -1 --format='%(trailers:key=Co-Authored-By,valueonly,separator=|)' $h; done | grep -c Claude  -> 13

---

## 5. Cosa questa ricognizione non ha misurato

- La fonte dei tetti di turni dell'ambiente (20 e 45): bloccata da `guard-paths`,
  voce `122651`. Andrea l'ha poi fornita: sono i `maxTurns` delle schede degli agenti,
  cambiati dal 24/09 (§1.1 b). È un dato riportato, non misurato da qui.
- I log dei run CI passo per passo, oltre alla durata già registrata in L12.
- Il contenuto dei commenti di Andrea sulle PR (#13, #15, #16, #17, #21, #26, #36, #46,
  #52, #55): li ho contati, non letti. Sono gli unici commenti di revisione esistenti.
- Se `/collaudo` sia stato lanciato in sessione senza lasciare voci: dal repository non si
  distingue da «mai lanciato».

Fuori perimetro, visto per caso: in `journal/2026-09-20/` c'è una cartella `node_modules/`
locale, ignorata da `.gitignore` e non su main. Qualcuno ha lanciato `pnpm` dalla cartella
sbagliata.
