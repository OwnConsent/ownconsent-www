# ADR-0005 — `touch-target`: il contratto si allinea a WCAG 2.5.8, eccezioni comprese

- Stato: ratificata (Andrea, 24/09/2026)
- Data: 2026-09-23
- Deciso da: @architect
- Vincola: @design, @frontend, @qa-test
- Smaltisce: `DESIGN-AMENDMENTS.md` A08 (finding D06 di L10), per la parte contratto e documento di design

## Contesto

`contracts/design-tokens.json`, blocco `touch-target`, prometteva:

- `min-size` (24px): «dimensione minima di ogni elemento interattivo»;
- `min-undisturbed-space` (24px): l'eccezione di spaziatura di 2.5.8, con la frase «in
  questo sistema non è usata: ogni elemento interattivo rispetta già min-size».

`docs/design/00-sistema-e-componenti.md` riga 20 ripeteva la stessa regola senza eccezioni.

Il finding D06 di L10 (`docs/evidenza/8/l10/findings-design.json`) ha misurato il contrario
sul prodotto reso: in `/legale/informativa-privacy/` il mailto del recapito del titolare è
un link in linea dentro un `<p>`, rettangolo 449×17 a 1280×800 (`display: inline`,
`font-size` 16px, `line-height` 24px). È l'unico bersaglio sotto i 24px sulle otto pagine.
A 360×640 la misura sul rettangolo di unione non lo vede, perché il link va a capo; il
bersaglio per riga resta alto 17px.

WCAG 2.2, criterio 2.5.8 (Target Size Minimum, AA) ha cinque eccezioni: Spacing,
Equivalent, Inline, User agent control, Essential. «Inline» esenta il bersaglio che sta in
una frase o la cui dimensione è vincolata dall'interlinea del testo non interattivo.

Andrea ha deciso il 22/09/2026, registrato come A08 in `DESIGN-AMENDMENTS.md`: **il
contratto si allinea a WCAG 2.5.8.** Il prodotto è conforme; è il contratto a promettere
una regola più severa di WCAG e a non rispettarla.

## Decisione

`touch-target.min-size` vale per ogni elemento interattivo salvo le eccezioni di WCAG 2.5.8;
un link in linea nel testo è esente (eccezione «Inline») e `min-undisturbed-space` è
l'alternativa ammessa per i bersagli fuori dal testo che non raggiungono `min-size`.

Cambiano solo i campi `uso` dei due token e la riga 20 del documento di design. Nomi e
`value` restano identici: `site/src/lib/token-css.mjs` li emette come
`--touch-target-min-size` e `--touch-target-min-undisturbed-space`, e i componenti usano
`var(--touch-target-min-size)`.

## Alternative scartate

| Alternativa | Perché no |
|---|---|
| Dare al link in linea un'altezza minima di 24px (rientro CSS in L14, prima opzione del finding D06) | Contraddice A08: Andrea ha deciso che il prodotto è conforme e che si corregge il contratto. Un `padding` verticale su un link inline altera l'interlinea del paragrafo o si sovrappone alle righe adiacenti. |
| Togliere `min-undisturbed-space` dal contratto | Rompe un consumatore senza deprecazione: `token-css.mjs` emette `--touch-target-min-undisturbed-space` nel foglio globale. Inoltre l'eccezione Spacing resta una regola reale di 2.5.8 che un componente futuro può usare. |
| Aggiungere un token per l'eccezione Inline (es. `touch-target.inline-exempt`) | Un'eccezione non ha un valore da emettere come custom property: sarebbe un token senza `value`, cioè documentazione travestita da token. Nessun componente lo consumerebbe (nessuna astrazione senza due casi d'uso nel repo). |
| Elencare nel contratto solo Inline e Spacing come ammesse | A08 dice «si allinea a WCAG 2.5.8», non «ad alcune eccezioni». Restringere è una scelta di design che A08 non fa: chiusa il 24/09/2026, nessun restringimento (vedi Domande aperte 1). |

## Conseguenze

- Più facile: il contratto descrive ciò che il prodotto fa e ciò che WCAG chiede; un link
  nel corpo di un testo legale non è più un difetto da inseguire.
- Più difficile: una verifica automatica deve distinguere i link in linea dagli altri
  bersagli, invece di applicare un solo numero a tutto.
- `e2e/ac37-mobile-360.spec.ts` (di @qa-test, righe 10-13 e 135-146) verifica «≥ 24×24
  oppure spaziatura», sul rettangolo di `getBoundingClientRect`, senza l'eccezione Inline.
  Oggi passa. È **più severo** del contratto nuovo, quindi non lo contraddice sul prodotto
  attuale, ma può fallire su un link in linea conforme (per esempio due link in linea
  vicini nella stessa frase) e misura il rettangolo di unione, che a 360px nasconde il
  bersaglio per riga. L'allineamento è di @qa-test; questo ADR non tocca il test.
- Tornare indietro costa poco: si ripristinano due stringhe `uso` e una riga di design,
  e si sceglie fra dare 24px ai link in linea o accettare di nuovo la contraddizione.
  Nessun `value`, nessun nome, nessun componente cambia in nessuna delle due direzioni.

## Definizione operativa dell'eccezione Inline (ratificata 24/09/2026)

Un bersaglio e' in linea se e solo se, misurato sull'HTML servito:

  a. `getComputedStyle(el).display` inizia con "inline";
  b. il genitore ha testo proprio: il suo `textContent`, tolti i `textContent` degli
     elementi interattivi figli, non e' vuoto dopo il trim;
  c. l'altezza di OGNI rettangolo restituito da `el.getClientRects()` non supera di piu'
     di 1px la `line-height` calcolata del genitore.

La misura si fa per rettangolo di `getClientRects()`, MAI sul rettangolo di unione di
`getBoundingClientRect()`: un link che va a capo ha piu' righe, e l'unione nasconde il
bersaglio per riga. E' il difetto che questo stesso ADR ha misurato in `ac37-mobile-360` a
360px, e vale per qualunque test futuro.

Un test puo' concedere da solo soltanto le eccezioni misurabili, Inline e Spacing.
Equivalent, Essential e User agent control restano eccezioni valide del contratto, ma
nessun test le concede: un bersaglio che le invoca fallisce il controllo automatico e
richiede un'eccezione scritta a mano in `DESIGN-AMENDMENTS.md`, con data. Un'eccezione che
si auto-certifica non e' un'eccezione: e' un permesso.

## Domande aperte

1. Chiusa (Andrea, 24/09/2026): nessun restringimento dell'elenco delle eccezioni; se mai
   servira', passa da una sessione di design.
2. Chiusa (Andrea, 24/09/2026): la definizione operativa è nella sezione «Definizione
   operativa dell'eccezione Inline (ratificata 24/09/2026)» qui sopra.
3. Aggiornamento di `DESIGN-AMENDMENTS.md` A08 («Da smaltire»): è registro di Andrea, non
   lo tocca questo ADR.

## Voci aperte

- `e2e/ac37-mobile-360.spec.ts` non allineato al contratto, proprietario @qa-test: https://github.com/OwnConsent/ownconsent-www/issues/58
