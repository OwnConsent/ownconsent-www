# Pagamenti — porta e adattatore

Proprietario: `@architect`. Si modifica solo con un ADR.

## Decisione

Il sistema parla a una **porta** `Pagamenti`, non a un fornitore. In questa fase esiste
un solo adattatore, `fake`, guidato da una macchina a stati locale. L'adattatore Stripe è
dichiarato nell'interfaccia e **non implementato**.

Nessuna chiave, nessuna sandbox, nessun webhook esposto. Questo repository è pubblico.

## Perché il finto, e perché non è un ripiego

La lezione dei pagamenti non è chiamare un fornitore: è l'**idempotenza**. Webhook
duplicati, eventi fuori ordine, pagamento fallito a metà attivazione. Con l'adattatore
finto quei casi si scatenano a comando; con una sandbox vera, provare a farli succedere
dal vivo è il modo migliore per bucare una dimostrazione.

## La porta

    Pagamenti
      CreaSottoscrizione(tenant, piano)      -> sottoscrizione | errore
      CambiaPiano(sottoscrizione, piano)     -> sottoscrizione | errore
      Chiudi(sottoscrizione)                 -> errore
      EventiInAttesa()                       -> []evento

Ogni chiamata prende una **chiave di idempotenza** fornita dal chiamante. Ripetere la
stessa chiamata con la stessa chiave deve restituire lo stesso esito senza produrne un
altro.

## Casi di fallimento che l'adattatore finto DEVE saper produrre

Sono requisiti, non extra: `@qa-test` scrive un test per ognuno.

1. pagamento rifiutato alla creazione;
2. stesso evento consegnato due volte;
3. due eventi consegnati in ordine inverso (`chiusa` prima di `attivata`);
4. evento per una sottoscrizione che non esiste;
5. timeout a metà operazione, con esito ignoto al chiamante;
6. pagamento riuscito presso il fornitore ma attivazione fallita da noi.

Il sesto è quello che in produzione genera le telefonate: un cliente che ha pagato e non
ha il servizio. Va gestito, non solo testato.

## Cosa resta fuori, deliberatamente

- **Fatturazione elettronica.** L'SDI ha un suo percorso di conformità e il suo strumento
  esiste già altrove. Non entra in questo repository.
- **IVA, regimi fiscali, note di credito.** Appartengono al prodotto, non alla
  dimostrazione.
- **Dati di pagamento.** Non ne tocchiamo, non ne salviamo, non ne logghiamo. Nemmeno
  finti che somiglino a veri.
