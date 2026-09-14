# Sistema visivo e componenti condivisi — pagine pubbliche (consegna 1, issue #8, lotto L02)

Fonte dei token: `contracts/design-tokens.json`. Nessun valore in questo documento è scritto
a mano fuori da quel file: ogni colore, misura, raggio o breakpoint citato qui è il nome
di un token, non un valore. Il meccanismo con cui `@frontend` trasforma i token in CSS è
deciso da ADR-0002 (lotto L03), non da questo documento.

Nessun file Figma esiste nel repository: il sistema nasce con questo lotto (vedi
`journal/2026-09-13/194600-design-decisione.json`).

## Principi che valgono per tutte le pagine

- **Nessun JavaScript per mostrare contenuto** (AC1): ogni blocco descritto qui è presente
  nell'HTML servito. Non esiste un menu a comparsa, un accordion o una scheda che nasconde
  contenuto dietro un interruttore controllato da script: la navigazione è un elenco di
  link sempre visibile, la tabella di confronto è sempre una `<table>` vera.
- **360 px è la larghezza minima supportata** (AC37): nessun layout qui sotto richiede
  scorrimento orizzontale del documento a `breakpoint.base` (360px).
- **Il corpo del testo non scende mai sotto `typography.font-size.100`** (16px, AC37).
- **Ogni elemento interattivo rispetta `touch-target.min-size`** (24×24 CSS px, WCAG 2.5.8).
- **Il focus è sempre visibile** (WCAG 2.4.7/2.4.11): `focus.ring-width` +
  `focus.ring-offset`, colore `color.semantic.<tema>.focus-ring`, calcolato ≥3:1 contro
  `bg-canvas` e `bg-surface` in `docs/design/contrast-check.py`.
- **Tema chiaro e scuro**: i componenti usano solo alias semantici (`bg-canvas`,
  `text-primary`, ...), mai un valore diretto: la commutazione fra i due temi è quindi
  automatica ovunque, quando `@frontend` (ADR-0002) deciderà come attivarla.

## Ordine di navigazione da tastiera, comune a ogni pagina

1. Link «salta al contenuto» (primo elemento raggiungibile, visibile solo al focus):
   porta al primo titolo del contenuto principale (`id="contenuto"`).
2. Link del logo/nome del sito (porta a Home).
3. Voci di navigazione, nell'ordine: Home, SaaS, Hosted, On-premise, Confronto modalità
   e listino.
4. Contenuto principale della pagina, nell'ordine in cui compare visivamente (titoli,
   testo, eventuali link in linea, eventuale link mailto del blocco di chiusura).
5. Link del piè di pagina, nell'ordine: Termini di servizio, Informativa privacy, Cookie
   policy.

Nessun elemento riceve `tabindex` positivo: l'ordine del focus è l'ordine del documento,
nessuna eccezione.

---

## Componente: intestazione e navigazione (header/nav)

**Presente su**: tutte le 8 pagine, identica.

### Anatomia
- Nome del sito, testuale (nessun'immagine di logo in questa consegna: un file immagine
  non è nel perimetro e complicherebbe AC10 se caricato da un percorso sbagliato),
  link verso Home.
- Elenco di navigazione (`<nav aria-label="Principale">`), un `<ul>` di link: Home, SaaS,
  Hosted, On-premise, Confronto modalità e listino.

### Stati (per ogni link della nav)
| Stato | Comportamento |
|---|---|
| default | `text-primary` su `bg-canvas`, nessuna sottolineatura |
| hover | sottolineatura, colore invariato (il puntatore non esiste su touch: mai l'unico segnale) |
| focus | anello visibile (`focus.ring-width`/`ring-offset`, colore `focus-ring`) |
| active (pressione) | `text-link` |
| corrente (pagina aperta) | `aria-current="page"`, sottolineatura permanente + `font-weight.semibold`; non è uno stato interattivo ma va sempre specificato perché cambia l'aspetto |
| disabled | non applicabile: nessun link di navigazione è mai disabilitato |
| loading | non applicabile: navigazione fra pagine rese lato server, nessuno stato di caricamento intermedio disegnato (il browser gestisce la richiesta) |
| error | non applicabile: un link rotto non è uno stato di questo componente ma un difetto, verificato da AC1/AC3/L07 |

### Responsive
- **Sotto 400px** (dentro `breakpoint.base`): l'elenco di navigazione è una riga che va a
  capo su più righe se necessario (`flex-wrap`), mai un menu a comparsa: niente script
  necessario per vederlo, come richiesto da AC1. Spaziatura fra i link: `spacing.4`
  orizzontale, `spacing.2` verticale fra le righe.
- **Da `breakpoint.md` (768px)**: nome del sito a sinistra, navigazione a destra sulla
  stessa riga.

### Contenuto reale d'esempio
```
OwnConsent · Home · SaaS · Hosted · On-premise · Confronto modalità e listino
```

---

## Componente: piè di pagina (footer)

**Presente su**: tutte le 8 pagine, identico. Soddisfa AC8 (link alle tre pagine legali)
e contribuisce ad AC1 fornendo i link a SaaS/Hosted/On-premise anche quando il contenuto
principale di una pagina legale non li cita nel testo.

### Anatomia
- Sfondo `bg-inverse`, testo `text-on-inverse`.
- Elenco di link legali (`<nav aria-label="Legale">`): Termini di servizio, Informativa
  privacy, Cookie policy.
- Riga di chiusura testuale, senza dati reali del titolare (segnaposto, vedi
  `segnaposto_dichiarati` in `docs/spec/issue-8.json`): «© OwnConsent — ragione sociale
  da definire».

### Stati (per ogni link del footer)
| Stato | Comportamento |
|---|---|
| default | `text-on-inverse`, sottolineato (su sfondo scuro la sottolineatura è il segnale primario, il colore da solo non basta) |
| hover | colore `text-link` alla stessa luminosità del tema attivo, sottolineatura mantenuta |
| focus | anello visibile, colore `focus-ring-on-inverse` (non `focus-ring`): qui l'elemento accanto all'anello è sempre `bg-inverse`, e `focus-ring` da solo scende sotto 3:1 contro quello sfondo (2,38:1 in chiaro, 1,87:1 in scuro) — vedi `docs/design/contrast-check.py` |
| active | invariato rispetto a default salvo pressione visiva (leggero spostamento non necessario: nessuna animazione) |
| disabled / loading / error | non applicabile, come per la navigazione |

### Responsive
- **Sotto 400px**: i tre link legali impilati verticalmente, `spacing.2` fra loro.
- **Da `breakpoint.md`**: link in riga, separati da un punto (`·`) decorativo (`aria-hidden`).

### Contenuto reale d'esempio
```
Termini di servizio · Informativa privacy · Cookie policy
© OwnConsent — ragione sociale da definire
```

---

## Componente: contrassegno «pagina dimostrativa»

**Presente su**: SaaS, Hosted, On-premise, Confronto modalità e listino (le quattro
pagine con `mostra_prezzi: true`). Soddisfa AC5: visibile senza scorrere a 360×640 e a
1280×800.

### Anatomia
- Badge a pillola (`radius.full`), sfondo `badge-demo-bg`, testo `badge-demo-text`,
  `font-weight.semibold`, `font-size.100`.
- Testo esatto: «Pagina dimostrativa — i valori mostrati non sono definitivi».
- Posizione: primo elemento dentro `<main>`, prima dell'`<h1>`, non dentro l'header
  (l'header è comune a pagine che non mostrano prezzi e non deve portare il contrassegno).

### Stati
Non è un elemento interattivo: non riceve focus, non ha hover, active, disabled, loading
o error. È sempre nello stato "visibile"; non esiste uno stato in cui scompare, perché i
prezzi restano non definitivi per tutta questa consegna (CLAUDE.md).

### Responsive
- **A 360×640**: il badge sta nella prima schermata insieme al primo rigo dell'h1, senza
  scorrere. Larghezza massima 100% meno i margini di pagina (`spacing.4` per lato);
  va a capo su due righe se il testo non entra, ma resta sopra la piega.
- **A 1280×800**: badge in linea, larghezza minima quanto il testo, margine
  `spacing.6` dal bordo del contenuto.

### Verifica di contrasto
`badge-demo-text` su `badge-demo-bg`: 10.20:1 (chiaro), 10.20:1 (scuro) — vedi
`docs/design/contrast-check.py`.

---

## Componente: contrassegno «bozza»

**Presente su**: Termini di servizio, Informativa privacy, Cookie policy. Soddisfa AC8.

### Anatomia
Identico al contrassegno «pagina dimostrativa» nella forma (badge a pillola, stessa
posizione: primo elemento di `<main>`, prima dell'h1), ma con colore diverso per non
essere confuso con l'altro contrassegno, e testo proprio: «Bozza — testo non definitivo,
in attesa di approvazione».

### Stati
Come il contrassegno «pagina dimostrativa»: nessuno stato interattivo, sempre visibile.

### Responsive
Identico al contrassegno «pagina dimostrativa».

### Verifica di contrasto
`badge-draft-text` su `badge-draft-bg`: 9.90:1 (chiaro e scuro).

---

## Componente: valore segnaposto «da definire»

**Presente su**: SaaS, Hosted, On-premise, Confronto modalità e listino, ovunque compaia
un valore del listino non configurato (AC6).

### Anatomia
Testo in linea, `color: text-muted`, `font-style: italic`, stesso `font-size` del testo
che lo circonda (mai più piccolo di `font-size.100`). Non è un badge: è un valore di
testo dentro la frase, per esempio «tetto di richieste: da definire» o «disco: da
definire, memoria: da definire, CPU: da definire».

### Stati
Nessuno: è testo statico, non interattivo.

### Regola di contenuto
Non traduce mai in un numero, una percentuale o un nome di fantasia (AC6, DP-21): la
stringa esatta è sempre «da definire», mai «prossimamente», «in arrivo» o un valore
d'esempio che assomigli a un prezzo.

---

## Componente: carta modalità

**Presente su**: Home (tre carte di sintesi, una per modalità), e come struttura
concettuale delle sezioni di SaaS/Hosted/On-premise.

### Anatomia
- Contenitore `bg-surface-raised`, bordo `border.width` `border-default`, `radius.md`,
  padding `spacing.6`.
- Titolo (`h3`, `font-size.400`): nome della modalità.
- Tre righe etichetta/valore: «Cosa ricevi», «Come paghi», «Chi registra la CMP presso
  IAB Europe».
- Link «Scopri di più» verso la pagina dedicata (solo nella versione di sintesi in Home;
  nella pagina dedicata la carta non ha questo link, il contenuto è già lì).

### Stati
| Stato | Comportamento |
|---|---|
| default | bordo `border.width` `border-default` |
| hover (sulla carta intera, se l'intera carta è cliccabile in Home) | bordo `border.width` `border-strong`, nessuno spostamento |
| focus (sul link «Scopri di più» dentro la carta) | anello visibile sul link, non sulla carta: la carta stessa non è un elemento interattivo, lo è solo il link al suo interno |
| active | invariato salvo il link, che passa a `text-on-brand`/`brand-bg-active` se reso come bottone, oppure a `text-link` se reso come link testuale |
| disabled | non applicabile |
| loading | non applicabile: contenuto reso lato server, nessun caricamento asincrono |
| error | non applicabile: nessun dato remoto da cui la carta possa fallire a caricarsi |

### Responsive
- **Sotto 400px**: una carta per riga, `spacing.6` di distanza verticale.
- **Da `breakpoint.md`**: due carte per riga.
- **Da `breakpoint.lg`**: tre carte per riga (Home).

### Contenuto reale d'esempio (carta di sintesi, Home)
```
SaaS
Cosa ricevi: configurazione e delivery a cura di OwnConsent
Come paghi: canone mensile, piani per volume di richieste
Chi registra la CMP: OwnConsent
Scopri di più →
```

---

## Componente: tabella di confronto

**Presente su**: Confronto modalità e listino. Soddisfa AC4.

### Anatomia
- `<table>` vera con `<caption>` («Confronto fra SaaS, Hosted e On-premise»), `<thead>`
  con tre colonne (SaaS, Hosted, On-premise) più la colonna delle etichette, `<tbody>`
  con quattro righe: «Cosa ricevi», «Come paghi», «Chi registra la CMP presso IAB
  Europe», «Come si attiva».
- Ogni cella di intestazione ha `scope="col"`/`scope="row"` secondo il ruolo.
- L'ultima riga, «Come si attiva», ha le tre celle identiche: «Scrivici» (AC4).

### Stati
Il componente non è interattivo (nessun ordinamento, nessun filtro: sarebbe una
funzionalità non richiesta). Non ha hover/focus/active/disabled/loading/error propri;
le uniche parti interattive sarebbero eventuali link dentro le celle, che in questa
consegna non ci sono (la cella dice solo «Scrivici», testo semplice, non un link: il
link mailto vive nel blocco di chiusura di ciascuna pagina di modalità, non qui — la
tabella è un confronto, non un modulo di contatto).

### Responsive — comportamento sotto 400px
A `breakpoint.base` la tabella non scorre orizzontalmente (AC37): si passa dal layout
tabellare a un layout a blocchi con solo CSS, mantenendo il markup `<table>` intatto
(gli screen reader continuano a leggere le relazioni corrette fra intestazioni e celle):
- `display: block` su `table`, `thead` (visivamente nascosto con una tecnica che lo
  lascia comunque letto dagli screen reader, non `display:none`), `tbody`, `tr`, `th`,
  `td`.
- Ogni `td` porta un attributo `data-etichetta` col nome di colonna (SaaS, Hosted,
  On-premise), scritto nel markup e non aggiunto da JavaScript, mostrato con
  `::before { content: attr(data-etichetta) }`.
- Ogni riga della tabella diventa un blocco con bordo `border.width` `border-default`,
  `radius.md`, padding `spacing.4`, distanza `spacing.6` dal blocco successivo.

### Responsive — da `breakpoint.lg` (1280px)
Tabella resa come tabella: colonna delle etichette a sinistra (`bg-surface`), tre colonne
di valori, righe separate da un bordo `border.width` `border-default`.

### Contenuto reale d'esempio
```
                    SaaS                          Hosted                        On-premise
Cosa ricevi         configurazione e delivery     istanza con risorse dedicate  installazione sul proprio hardware
                    da OwnConsent                  e dati separati
Come paghi          canone mensile, piani per     in base alla taglia di       licenza annuale
                    volume di richieste            disco, memoria e CPU
Chi registra la CMP OwnConsent                     in definizione                il cliente, a proprio nome
Come si attiva      Scrivici                        Scrivici                      Scrivici
```

---

## Componente: link mailto in stile bottone (CTA di chiusura)

**Presente su**: SaaS (N1), Hosted (AC33), On-premise (AC34), dentro il rispettivo
blocco di chiusura.

### Anatomia
- Elemento `<a href="mailto:...">`, reso visivamente come un bottone: sfondo `brand-bg`,
  testo `text-on-brand`, `radius.md`, padding `spacing.3` verticale / `spacing.6`
  orizzontale, `font-weight.semibold`.
- L'indirizzo e l'oggetto vengono dal file unico di contenuto stabilito da ADR-0002 (N2):
  `mailto:<indirizzo-unico>?subject=SaaS` (o `Hosted`, `On-premise`).
- Testo del link: la frase esatta richiesta dal criterio (vedi sezione di pagina), non il
  solo indirizzo.

### Stati
| Stato | Comportamento |
|---|---|
| default | `brand-bg` / `text-on-brand` |
| hover | `brand-bg-hover` |
| focus | anello visibile (`focus-ring`), con `focus.ring-offset` che lo stacca dal
  riempimento colorato del bottone: l'anello tocca sempre `bg-canvas` o `bg-surface`,
  mai `brand-bg` direttamente (per questo la coppia `focus-ring`/`brand-bg` non è fra
  quelle verificate in `contrast-check.py`: non è mai adiacente nella resa) |
| active (pressione) | `brand-bg-active` |
| disabled | non applicabile: il link è sempre attivo, non dipende da un dato da caricare |
| loading | non applicabile: `mailto:` apre il client di posta del dispositivo, non c'è
  un'attesa di rete gestita dalla pagina |
| error | non applicabile nella pagina: se il dispositivo non ha un client di posta
  configurato è il sistema operativo a mostrarlo, non un errore che il design deve
  rappresentare |

### Responsive
- **Sotto 400px**: larghezza piena del contenitore (`width: 100%`), altezza minima
  `touch-target.min-size` più il padding verticale (garantita ben oltre i 24px richiesti).
- **Da `breakpoint.md`**: larghezza automatica, mai a piena larghezza.

### Nome accessibile
Il testo visibile del link è già descrittivo (frase intera, non solo «scrivici»): nessun
`aria-label` aggiuntivo necessario. Esempio SaaS: «Scrivici e ti attiviamo noi».

---

## Componente: blocco di chiusura

**Presente su**: SaaS, Hosted, On-premise. È, per definizione della spec, «l'ultimo
blocco del contenuto principale, prima del footer» (rese_del_testo di
`docs/spec/issue-8.json`).

### Anatomia
- Contenitore a piena larghezza del contenuto, sfondo `bg-surface`, `radius.lg`, padding
  `spacing.10` verticale / `spacing.6` orizzontale.
- Titolo breve (`h2`, `font-size.500`).
- Paragrafo con la frase richiesta dal criterio della pagina (vedi sezioni di pagina).
- Il link mailto in stile bottone descritto sopra.

### Stati
Il contenitore non è interattivo: eredita gli stati del link al suo interno, già
descritti.

### Responsive
- **Sotto 400px**: testo e bottone impilati, bottone a piena larghezza.
- **Da `breakpoint.md`**: testo a sinistra, bottone a destra sulla stessa riga se il
  paragrafo è breve; impilato se non ci sta senza scorrimento orizzontale (mai forzare
  una riga che ecceda la larghezza del contenitore).

### Regola di contenuto
Nessun modulo, nessuna data, nessuna lista d'attesa, nessuna dicitura «in arrivo» dentro
questo blocco o altrove nella pagina (N1, AC33, AC34).
