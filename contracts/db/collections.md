# Modello dati — MongoDB + Redis

Proprietario: `@database`. Si modifica solo con un ADR.

## Divisione del carico

| Dove | Cosa | Perché |
|---|---|---|
| MongoDB | account, piani, sottoscrizioni, licenze, istanze hosted, eventi di pagamento | nucleo transazionale, volumi bassi, invarianti che contano |
| Redis | contatore delle richieste del periodo corrente | unico percorso caldo del progetto |

Il contatore vive in Redis e si consolida su Mongo a intervalli. Redis è la verità per il
controllo del tetto in tempo reale; Mongo è la verità per la fatturazione. Quando le due
divergono **vince Mongo**, e la divergenza è un allarme, non un dettaglio.

## Prerequisito operativo

Le transazioni multi-documento richiedono un **replica set**, anche in sviluppo: un
replica set a nodo singolo va bene in locale, ma va messo in piedi dal primo giorno.
Scoprirlo alla tappa 04, con i pagamenti già scritti senza transazioni, costa una
riscrittura.

## Regole non negoziabili

1. **Il denaro è `Decimal128`.** Mai `double`, mai float in nessuna forma, mai un numero
   in virgola mobile che rappresenta euro. Gli importi interi in centesimi sono ammessi
   solo se dichiarati nel nome del campo (`_cents`).
2. **Ogni collezione ha un validatore `$jsonSchema`** dichiarato alla creazione. È la cosa
   più vicina a `NOT NULL` e `CHECK` che Mongo offre: senza, un campo obbligatorio è una
   convenzione, e le convenzioni non reggono a venti agenti.
3. **Ogni invariante di unicità è un indice unico**, non un controllo nel codice. Un
   controllo applicativo perde la corsa con sé stesso; un indice unico no.
4. **Niente scritture su più documenti senza transazione** quando l'esito parziale
   lascerebbe il sistema in uno stato che nessuno sa leggere (attivazione, cambio piano,
   emissione licenza).
5. **Timestamp sempre UTC**, sempre con fuso esplicito nel valore serializzato.

## Collezioni e indici

    tenants           _id, slug*, ragione_sociale, stato, creato_il
                      unique: slug

    plans             _id, codice*, modalita(saas|hosted|onprem), tetto_richieste,
                      prezzo{Decimal128, valuta}, attivo
                      unique: codice

    subscriptions     _id, tenant_id, plan_id, stato(attiva|sospesa|chiusa),
                      periodo{da, a}, creata_il
                      unique parziale: {tenant_id} con filtro {stato: "attiva"}
                        -> un tenant non può avere due sottoscrizioni attive insieme
                      indice: {tenant_id, periodo.da}

    usage_periods     _id, tenant_id, periodo{da, a}, richieste, consolidato_il
                      unique: {tenant_id, periodo.da}

    payment_events    _id, idempotency_key*, tenant_id, tipo, payload, ricevuto_il,
                      elaborato_il, esito
                      unique: idempotency_key
                        -> è QUESTO che impedisce il doppio addebito, non un if
                      TTL: nessuno. Gli eventi di pagamento non scadono.

    licenses          _id, tenant_id, chiave*, emessa_il, scade_il, revocata_il
                      unique: chiave
                      indice: {tenant_id, scade_il}

    hosted_instances  _id, tenant_id, taglia, stato, namespace*, creata_il
                      unique: namespace

    idempotency       _id (= chiave), risposta, creato_il
                      TTL: 24h su creato_il

## Invarianti che il database NON impone

MongoDB non ha chiavi esterne né vincoli fra documenti. Questi invarianti esistono lo
stesso, e siccome nessun indice li protegge **vanno verificati nel codice e coperti da un
test ciascuno**. `@database` e `@code-reviewer` li controllano a ogni PR che tocca questa
area.

| Invariante | Chi lo protegge |
|---|---|
| Una sottoscrizione punta sempre a un tenant e a un piano esistenti | codice + test |
| Chiudere un tenant chiude le sue sottoscrizioni e revoca le sue licenze | transazione + test |
| Un periodo di consumo non si sovrappone al precedente dello stesso tenant | codice + test |
| Un'istanza hosted esiste solo se la sottoscrizione è attiva | codice + test |
| Il consumo consolidato non decresce mai | codice + test |
| Un evento di pagamento si elabora una volta sola, anche se arriva tre volte | indice unico + test |

Questa tabella è la contropartita della scelta di MongoDB. Non è una lamentela: è la
lista di ciò che, con un database relazionale, non avremmo dovuto scrivere. Tenerla
aggiornata è parte della Definition of Done di `@database`.

## Redis

    quota:{tenant_id}:{periodo}   contatore, INCR atomico, TTL fine periodo + 7 giorni
    quota:{tenant_id}:soglia      percentuale già notificata, per non riavvisare

Il controllo del tetto legge Redis. Se Redis non risponde, **il servizio non blocca il
cliente**: conta in modo degradato e segnala. Un errore di infrastruttura nostra non si
trasforma in un disservizio per chi ha pagato.
