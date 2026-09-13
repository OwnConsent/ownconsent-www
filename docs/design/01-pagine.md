# Specifica delle 8 pagine pubbliche — consegna 1 (issue #8, lotto L02)

Ogni pagina condivide header, footer e le regole generali di
`docs/design/00-sistema-e-componenti.md`: qui si descrive solo ciò che cambia da pagina a
pagina — struttura, blocchi, ordine, testi segnaposto, contrassegni, comportamento a
360×640 e 1280×800, e le variazioni all'ordine di focus quando servono.

Nessun prezzo, nessun nome di piano, nessun dominio o indirizzo reale in questo
documento: l'indirizzo di contatto è scritto come `contatto@ownconsent.example`, che usa
il dominio riservato `.example` (RFC 2606, garantito non risolvibile) **solo per
illustrare come appare il testo**; il dominio e la casella definitivi li sceglie
ADR-0002 (L03) e li comunica Andrea al gate di pubblicazione (G3, DP-19). Lo stesso vale
per «ragione sociale da definire» nel footer.

---

## 1. Home

**Indicizzabile**: sì. **Mostra prezzi**: no → nessun contrassegno «pagina dimostrativa».

### Meta (esempio di contenuto reale, non il testo finale)
- `title`: «OwnConsent — gestione del consenso conforme per il web italiano»
- `meta description`: «OwnConsent raccoglie e conserva le scelte di consenso dei tuoi
  visitatori, conforme a IAB TCF v2.2/v2.3, Google Consent Mode v2 e alle norme italiane
  ed europee. Scopri SaaS, Hosted e On-premise.»

### Struttura, in ordine
1. Header/nav (condiviso).
2. `<main id="contenuto">`.
3. `<h1>`: «La piattaforma di gestione del consenso per il web italiano».
4. Paragrafo introduttivo (lead, `font-size.200`): «OwnConsent raccoglie e conserva le
   scelte di chi visita il tuo sito, conforme a IAB TCF v2.2/v2.3, Google Consent Mode
   v2, al Garante per la protezione dei dati personali (231/2021) e alle linee guida
   EDPB 2/2023. Pensato per web agency italiane, publisher e l'ecosistema
   Audiweb/Audicom.»
5. Sezione «Tre modi di avere OwnConsent» (`h2`): tre carte modalità di sintesi (vedi
   componente «carta modalità»), in ordine SaaS, Hosted, On-premise, ciascuna con link
   «Scopri di più» verso `/saas`, `/hosted`, `/on-premise`. **Questo soddisfa AC1**: i
   link alle tre pagine sono nel corpo, non solo nella nav.
6. Sezione «Confronta le tre modalità» (`h2`), un paragrafo breve e un link verso
   `/confronto` («Vedi il confronto completo e il listino →»).
7. Footer (condiviso).

### Contrassegni
Nessuno (pagina senza prezzi).

### Comportamento a 360×640
Titolo, lead e prima carta modalità visibili senza scorrere oltre la prima schermata;
le altre due carte sotto, impilate (vedi componente).

### Comportamento a 1280×800
Le tre carte modalità affiancate; layout con larghezza massima del contenuto centrata.

### Ordine di focus
Quello generale di `00-sistema-e-componenti.md`, poi dentro il contenuto: link «Scopri di
più» delle tre carte, in ordine SaaS → Hosted → On-premise, poi il link al confronto.

---

## 2. SaaS

**Indicizzabile**: sì. **Mostra prezzi**: sì → contrassegno «pagina dimostrativa».
Soddisfa AC4 (colonna SaaS), AC49, N1.

### Meta
- `title`: «SaaS — OwnConsent in abbonamento, configurato per te»
- `meta description`: «OwnConsent SaaS: configurazione e delivery a cura nostra, canone
  mensile a piani per volume di richieste, CMP registrata da OwnConsent presso IAB
  Europe.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «pagina dimostrativa» (primo elemento di main, prima dell'h1).
4. `<h1>`: «SaaS: OwnConsent in abbonamento».
5. Paragrafo introduttivo: «Ricevi configurazione e delivery a cura nostra: attivi la
   CMP senza gestire infrastruttura.»
6. Sezione «Cosa ricevi» (`h2`): «Configurazione e delivery gestite da OwnConsent: la
   piattaforma è pronta all'uso, aggiornata e mantenuta da noi.»
7. Sezione «Come paghi» (`h2`): «Canone mensile, a piani per volume di richieste. Una
   richiesta conteggiata è una scrittura di consenso — cioè la creazione o
   l'aggiornamento di una scelta registrata. I caricamenti del banner, le letture della
   configurazione e le risposte dalla cache non si contano.» Tabella o elenco strutturale
   dei piani (AC6, DP-21): righe con etichetta «Piano» e valore segnaposto «da definire»
   per numero di piani, tetto di richieste e canone; **nessun nome di piano**, solo la
   struttura. Esempio di riga: «Tetto di richieste incluso nel piano: da definire».
8. Sezione «Se superi il tetto» (`h2`, AC49): «Superare il tetto non interrompe il
   servizio. Non ci sono addebiti automatici per l'eccedenza. Ti avvisiamo prima che tu
   raggiunga il tetto; se il superamento si ripete, ti proponiamo un cambio di piano,
   deciso da una persona.» **Nessuna percentuale, nessuna soglia numerica, nessun 120%**
   in questa sezione né altrove nella pagina.
9. Sezione «Chi registra la CMP» (`h2`): «OwnConsent registra la CMP presso IAB Europe
   per conto tuo: nessun passaggio amministrativo a tuo carico.»
10. Blocco di chiusura (componente condiviso): titolo «Pronto ad attivare SaaS?»,
    paragrafo con il testo esatto richiesto da N1: «Scrivici e ti attiviamo noi.», link
    mailto in stile bottone `mailto:contatto@ownconsent.example?subject=SaaS` con testo
    visibile «Scrivici e ti attiviamo noi».
11. Footer.

### Vincoli di contenuto (N1, AC49, AC53)
- Nessun modulo, nessuna data, nessuna lista d'attesa, nessuna dicitura «in arrivo».
- Nessun limite di frequenza delle richieste presentato come caratteristica di un piano
  (AC53): il tetto è sul numero di scritture di consenso nel periodo, non sulla velocità.

### Comportamento a 360×640
Contrassegno «pagina dimostrativa» e prima riga dell'h1 visibili senza scorrere.

### Comportamento a 1280×800
Contrassegno, h1 e lead nella prima schermata; il resto scorre normalmente.

### Ordine di focus
Generale, poi: nessun link interattivo prima del blocco di chiusura (le sezioni sono solo
testo); nel blocco di chiusura, il link mailto è l'ultimo elemento del contenuto
principale prima del footer.

---

## 3. Hosted

**Indicizzabile**: sì. **Mostra prezzi**: sì → contrassegno «pagina dimostrativa».
Soddisfa AC4 (colonna Hosted), AC33.

### Meta
- `title`: «Hosted — un'istanza OwnConsent dedicata a te»
- `meta description`: «OwnConsent Hosted: istanza con risorse dedicate e dati separati
  dagli altri clienti, costo in base alla taglia di disco, memoria e CPU.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «pagina dimostrativa».
4. `<h1>`: «Hosted: un'istanza OwnConsent solo per te».
5. Paragrafo introduttivo: «Un'istanza con risorse dedicate: i tuoi dati non condividono
   spazio con quelli di altri clienti.»
6. Sezione «Cosa ricevi» (`h2`): «Un'istanza con risorse dedicate e dati separati da
   quelli degli altri clienti.» (testo richiesto da AC33)
7. Sezione «Come paghi» (`h2`): «Il costo dipende dalla taglia scelta: disco, memoria e
   CPU.» Struttura delle taglie (AC6, DP-21), senza nomi di taglia: righe «Disco: da
   definire», «Memoria: da definire», «CPU: da definire».
8. Sezione «Chi registra la CMP» (`h2`): «La registrazione della CMP presso IAB Europe
   per le istanze Hosted è in definizione.» (testo esatto richiesto da AC33)
9. Blocco di chiusura: titolo «Pronto ad attivare Hosted?», paragrafo con il testo
   esatto richiesto da AC33: «Si attiva parlando con noi.», link mailto in stile bottone
   `mailto:contatto@ownconsent.example?subject=Hosted` con lo stesso testo visibile.
10. Footer.

### Vincoli di contenuto (AC33)
Nessun modulo, nessuna dicitura «in arrivo».

### Comportamento a 360×640 / 1280×800
Come SaaS.

### Ordine di focus
Come SaaS.

---

## 4. On-premise

**Indicizzabile**: sì. **Mostra prezzi**: sì → contrassegno «pagina dimostrativa».
Soddisfa AC4 (colonna On-premise), AC34.

### Meta
- `title`: «On-premise — installa OwnConsent sul tuo hardware»
- `meta description`: «OwnConsent On-premise: installi sul tuo hardware, licenza
  annuale, registri tu la CMP presso IAB Europe a tuo nome.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «pagina dimostrativa».
4. `<h1>`: «On-premise: OwnConsent sul tuo hardware».
5. Paragrafo introduttivo: «Installi OwnConsent sul tuo hardware: il controllo resta
   interamente tuo.»
6. Sezione «Cosa ricevi» (`h2`): «Il cliente installa sul proprio hardware.» (testo
   richiesto da AC34)
7. Sezione «Come paghi» (`h2`): «Il cliente paga una licenza annuale.» (testo richiesto
   da AC34) Valore della licenza: segnaposto «da definire» (nessun importo).
8. Sezione «Chi registra la CMP» (`h2`): «La registrazione della CMP presso IAB Europe
   la fa il cliente, a proprio nome.» (testo richiesto da AC34)
9. Blocco di chiusura: titolo «Pronto ad attivare On-premise?», paragrafo con il testo
   esatto richiesto da AC34: «Si attiva parlando con noi.», link mailto in stile bottone
   `mailto:contatto@ownconsent.example?subject=On-premise` con lo stesso testo visibile.
10. Footer.

### Vincoli di contenuto (AC34)
Nessun modulo, nessuna dicitura «in arrivo».

### Comportamento a 360×640 / 1280×800
Come SaaS.

### Ordine di focus
Come SaaS.

---

## 5. Confronto modalità e listino

**Indicizzabile**: sì. **Mostra prezzi**: sì → contrassegno «pagina dimostrativa».
Soddisfa AC4 (tabella completa), AC49 (ripete la spiegazione del conteggio).

### Meta
- `title`: «Confronto modalità e listino — SaaS, Hosted, On-premise»
- `meta description`: «Confronta SaaS, Hosted e On-premise: cosa ricevi, come paghi, chi
  registra la CMP presso IAB Europe e come si attiva ciascuna modalità.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «pagina dimostrativa».
4. `<h1>`: «Confronta SaaS, Hosted e On-premise».
5. Paragrafo introduttivo: «Le tre modalità in cui puoi avere OwnConsent, a confronto:
   cosa ricevi, come paghi, chi registra la CMP e come si attiva.»
6. Componente «tabella di confronto» (vedi `00-sistema-e-componenti.md`): quattro righe
   (Cosa ricevi, Come paghi, Chi registra la CMP presso IAB Europe, Come si attiva),
   ultima riga con «Scrivici» nelle tre celle.
7. Sezione «Il listino, in struttura» (`h2`): ripete, per esteso, la struttura del
   listino di ciascuna modalità (piani SaaS per volume di richieste, taglie Hosted per
   disco/memoria/CPU, licenza annuale On-premise), tutti i valori «da definire», nessun
   nome di piano o taglia (DP-21).
8. Sezione «Come contiamo le richieste» (`h2`, AC49): stesso testo di SaaS punto 8
   («Superare il tetto non interrompe...»), perché AC49 chiede che **sia SaaS sia questa
   pagina** lo spieghino. Nessuna percentuale, nessuna soglia, nessun 120%.
9. Footer. **Nessun blocco di chiusura con link mailto qui**: questa pagina non è
   nell'elenco di AC33/AC34/N1 che lo richiede; l'attivazione, su questa pagina, passa
   dalla riga «Come si attiva» della tabella, non da un blocco separato.

### Comportamento a 360×640
Contrassegno e h1 visibili senza scorrere; la tabella subito sotto si presenta come
blocchi impilati (vedi componente «tabella di confronto», comportamento sotto 400px):
nessuno scorrimento orizzontale del documento.

### Comportamento a 1280×800
Contrassegno, h1 e prime righe della tabella nella prima schermata; tabella resa come
tabella vera a colonne.

### Ordine di focus
Generale; la tabella non contiene elementi interattivi (nessun link nelle celle, vedi
componente), quindi il focus salta dal paragrafo introduttivo direttamente alla sezione
successiva; nessun link mailto su questa pagina.

---

## 6. Termini di servizio (bozza)

**Indicizzabile**: sì. **Mostra prezzi**: no → contrassegno «bozza», non «pagina
dimostrativa». Soddisfa AC7, AC8, AC41.

### Meta
- `title`: «Termini di servizio (bozza) — OwnConsent»
- `meta description`: «Bozza dei termini di servizio di OwnConsent: testo non ancora
  definitivo, in attesa di approvazione.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «bozza» (primo elemento di main, prima dell'h1).
4. `<h1>`: «Termini di servizio».
5. Paragrafo di avviso (oltre al badge, un secondo richiamo testuale discorsivo, perché
   il badge da solo potrebbe sfuggire a chi disattiva gli stili): «Questa è una bozza:
   il testo non è ancora definitivo e sarà approvato da una persona competente prima
   della pubblicazione.»
6. Struttura dei paragrafi previsti (solo struttura, come da `L04`/piano — i testi
   completi li scrive `@privacy` in un lotto successivo, questo documento fissa solo
   l'ordine e le sezioni): «Oggetto del servizio», «Le tre modalità di fornitura» (SaaS,
   Hosted, On-premise, ciascuna con un rimando alla propria pagina — **soddisfa AC1**),
   «Modifiche ai termini», «Legge applicabile e foro competente», «Contatti» (con lo
   stesso indirizzo unico, senza modulo).
7. Ogni data citata nel testo (es. data di ultima modifica) nel formato gg/mm/aaaa
   (AC41): esempio segnaposto «Ultima modifica: 13/09/2026».
8. Footer.

### Comportamento a 360×640 / 1280×800
Contrassegno «bozza» e h1 visibili senza scorrere, alle due viewport.

### Ordine di focus
Generale; dentro il contenuto, i link verso SaaS/Hosted/On-premise citati nella sezione
«Le tre modalità di fornitura», nell'ordine in cui compaiono nel testo.

---

## 7. Informativa privacy (bozza)

**Indicizzabile**: sì. **Mostra prezzi**: no → contrassegno «bozza». Soddisfa AC7, AC8,
AC41.

### Meta
- `title`: «Informativa privacy (bozza) — OwnConsent»
- `meta description`: «Bozza dell'informativa privacy di OwnConsent: come trattiamo i
  dati di chi ci scrive, testo non ancora definitivo.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «bozza».
4. `<h1>`: «Informativa privacy».
5. Paragrafo di avviso, identico nella forma a quello dei Termini.
6. Struttura dei paragrafi previsti: «Titolare del trattamento» (segnaposto: «ragione
   sociale e sede da definire»), «Quali dati trattiamo» (il contenuto dell'email che chi
   scrive invia all'indirizzo di contatto: indirizzo del mittente e ciò che sceglie di
   scrivere — **il sito stesso non raccoglie, non memorizza e non trasmette alcun dato**,
   AC9/AC10), «Finalità e base giuridica» (rispondere a una richiesta commerciale;
   misure precontrattuali), «Per quanto tempo conserviamo i dati» (segnaposto «da
   definire», dichiarato da `@privacy` in `contracts/data-map.json`, lotto L11),
   «Diritti dell'interessato», «Contatti».
7. Nessuna affermazione di registrazione, certificazione o approvazione da parte di IAB
   Europe (AC7).
8. Date nel formato gg/mm/aaaa dove presenti.
9. Footer.

### Comportamento a 360×640 / 1280×800
Come Termini di servizio.

### Ordine di focus
Generale; nessun link interattivo aggiuntivo oltre a quelli comuni (nessun rimando alle
pagine di modalità richiesto qui, ma se il testo definitivo li cita, seguono lo stesso
principio dei Termini).

---

## 8. Cookie policy (bozza)

**Indicizzabile**: sì. **Mostra prezzi**: no → contrassegno «bozza». Soddisfa AC7, AC8,
AC9, AC41.

### Meta
- `title`: «Cookie policy (bozza) — OwnConsent»
- `meta description`: «Bozza della cookie policy di OwnConsent: il sito pubblico non usa
  cookie né storage prima del consenso, testo non ancora definitivo.»

### Struttura, in ordine
1. Header/nav.
2. `<main id="contenuto">`.
3. Contrassegno «bozza».
4. `<h1>`: «Cookie policy».
5. Paragrafo di avviso, identico nella forma agli altri due.
6. Struttura dei paragrafi previsti: «Cosa sono i cookie», «Cookie e storage su questo
   sito pubblico» — testo chiave, vero solo finché AC9 passa (rischio dichiarato nella
   spec): «Le pagine pubbliche di OwnConsent non impostano cookie né scrivono in
   localStorage, sessionStorage, IndexedDB o Cache Storage prima di alcuna tua scelta.
   Non ci sono banner di consenso su queste pagine perché non c'è nulla da consentire.»,
   «Se in futuro verranno introdotti cookie tecnici» (segnaposto per quando la consegna
   2 introdurrà l'area cliente, fuori perimetro qui), «Contatti».
7. Nessuna affermazione di registrazione IAB (AC7).
8. Footer.

### Comportamento a 360×640 / 1280×800
Come Termini di servizio.

### Ordine di focus
Generale, nessuna variazione.

---

## Riepilogo di conformità (auto-verifica di questo documento)

| Requisito | Dove è soddisfatto |
|---|---|
| AC4 | Sezioni «Come paghi»/«Chi registra la CMP» di SaaS/Hosted/On-premise + tabella di confronto (pagina 5); riga «Come si attiva» con «Scrivici» in tutte e tre le celle |
| AC5 | Contrassegno «pagina dimostrativa» su SaaS, Hosted, On-premise, Confronto (pagine 2-3-4-5), specificato visibile senza scorrere a entrambe le viewport |
| AC6 | Valore segnaposto «da definire» ovunque compaia un dato del listino, nessun numero, nessun nome di piano/taglia |
| AC8 | Contrassegno «bozza» sulle tre pagine legali (6-7-8), footer con i tre link su tutte le 8 pagine |
| AC10 | Nessun font esterno, nessuna immagine da CDN, nessun componente che chiami un'origine terza (vedi `00-sistema-e-componenti.md`) |
| AC33 | Pagina Hosted: risorse dedicate/dati separati, costo per taglia con «da definire», IAB «in definizione», blocco di chiusura con «si attiva parlando con noi» e mailto `?subject=Hosted`, nessun modulo/«in arrivo» |
| AC34 | Pagina On-premise: analogo, mailto `?subject=On-premise` |
| AC37 | Corpo mai sotto 16px (regola generale), bersagli ≥24×24 (componenti), tabella senza scorrimento orizzontale sotto 400px |
| AC40 | Nessuna violazione strutturale nota: un solo h1 per pagina, intestazioni annidate in ordine, contrassegni non rubano il focus, tabella con scope corretti — verifica automatica è compito di L07/L09, questo documento non introduce ostacoli noti |
| N1 | Pagina SaaS: blocco di chiusura con «Scrivici e ti attiviamo noi», mailto `?subject=SaaS`, nessun modulo/data/lista d'attesa/«in arrivo» |

## Divergenze dichiarate

Nessuna. Questo documento non introduce funzionalità non costruite, non tocca requisiti
di accessibilità in conflitto con la fonte, e non diverge da alcun meccanismo già in
produzione (site/ non esiste ancora). Non ci sono classi 1, 2 o 3 di CLAUDE.md da
annotare in questo lotto.
