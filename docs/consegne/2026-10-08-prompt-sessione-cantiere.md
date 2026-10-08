# Consegna per una sessione nel repository cantiere — tre correzioni

Scritto l'08/10/2026 dalla sessione di `ownconsent-www`, su richiesta di Andrea. Da questa
sessione il repository `OwnConsent/cantiere` non si legge e non si scrive: `guard-paths` lo
tiene fuori dal perimetro, ed è voluto. Questo file è il passaggio di consegne.

**Come si usa.** Si apre un terminale in `/home/andreapernici/src/ownconsent/cantiere`, si
lancia `claude` **senza il plugin cantiere** e si incolla il blocco qui sotto, per intero.

**Che cosa è misurato e che cosa no.** Tutto ciò che il prompt riferisce di `ownconsent-www`
è stato misurato qui, e porta la voce di journal. Del repository cantiere questa sessione
non ha letto niente: i nomi dei file di cantiere e la descrizione dei guasti (a) e (b)
vengono da Andrea o dalla copia dell'hook che sta in `ownconsent-www/githooks/`. Per questo
il prompt chiede, per ogni correzione, la misura del guasto prima della modifica.

Il lavoro successivo, fuori da questo file: ripropagare `githooks/prepare-commit-msg` in
`ownconsent-www` dopo il merge in cantiere, aggiornando il blocco di provenienza che
`tests/ci/test_githooks_provenienza.py` verifica.

---

```text
Lavoro: tre correzioni nel repository cantiere (questa cartella), una PR per correzione.
Sei in una sessione senza il plugin cantiere: i commit escono senza trailer, non scrivere
a mano né Cantiere-Agent né Co-Authored-By. Se un git hook di questo repository nega il
commit perché manca il ruolo, fermati e riportamelo con il testo del diniego: non
aggirarlo e non impostare variabili per farlo passare.

Metodo, uguale per le tre:
1. PRIMA la misura del guasto: un comando che lo riproduce, con il suo output, sul codice
   com'è adesso. Le descrizioni qui sotto sono ipotesi: se la misura le contraddice,
   fermati su quella correzione e riportamelo, non adattare la misura alla descrizione.
2. POI la modifica minima che lo chiude. Niente riordini, niente migliorie accanto.
3. Un test che fallisce rimettendo il codice com'era (prova per reversione): esegui il
   test sul codice vecchio e sul nuovo e riporta entrambi gli output.
4. Nella descrizione della PR: comandi e output reali, e una sezione «Limiti noti» con
   ciò che non hai misurato.
Niente merge, niente push su main, niente modifiche a OwnConsent/ownconsent-www né a
OwnConsent/cmp. Quando una PR è pronta fermati e dimmelo.

--- (a) git hook: `git config commit.cleanup` letto senza isolamento

Dove: template/githooks/prepare-commit-msg, nel blocco python. La copia in
ownconsent-www (githooks/prepare-commit-msg, presa da cantiere a 76cbc5d) ha:

    pulizia = subprocess.run(["git", "config", "commit.cleanup"], capture_output=True,
                             text=True).stdout.strip() or "default"

mentre poco sotto `git interpret-trailers --parse` gira isolato (ambiente filtrato dalle
GIT_CONFIG*, GIT_DIR e GIT_WORK_TREE, cwd=/, GIT_CONFIG_GLOBAL su os.devnull,
GIT_CONFIG_NOSYSTEM=1). Verifica che il file di cantiere sia ancora così.

Da dove viene: finding basso n. 2 del collaudo di ownconsent-www #78 (commento
5968037579): «git config commit.cleanup gira nell'ambiente non isolato. Un .gitconfig
malevolo potrebbe cambiare il valore. Impatto cosmetico: nel caso peggiore la firma va
nella posizione sbagliata rispetto ai commenti.»

Attenzione, è un'ipotesi da misurare e non una prescrizione: `git commit` stesso applica
commit.cleanup da ogni livello di configurazione. Se l'hook leggesse il valore isolato
da tutto, potrebbe vedere un valore diverso da quello che git userà davvero per pulire
il messaggio, e mettere la firma nel posto sbagliato proprio nel caso legittimo. Quindi:
- misura prima che cosa vede oggi l'hook e che cosa applica git, con commit.cleanup
  impostato a livello di repository, globale, di sistema, con `git -c` e con
  `--cleanup=` sulla riga di comando (quest'ultimo è già un limite dichiarato nel
  commento dell'hook);
- il guasto è ogni caso in cui i due valori divergono, oppure in cui la firma finisce
  dove git la scarta (sotto le forbici, fra i commenti);
- la modifica minima chiude quei casi e solo quelli. Se dalla misura risulta che non c'è
  divergenza e che l'isolamento peggiorerebbe le cose, la correzione è una riga di
  commento che lo dice, con la misura: riportamelo prima di fare altro.

--- (b) journal-stato.py: sessione avviata in una sottocartella

Descrizione di Andrea: lo script si comporta male quando la sessione parte da una
sottocartella del progetto invece che dalla radice. La sessione di ownconsent-www non ha
letto lo script e non ha riprodotto il guasto: non so quale sia il sintomo.
- trova journal-stato.py e l'hook che lo lancia, e leggi come ricava la radice del
  progetto e la cartella del journal;
- riproduci: lancialo come lo lancia l'hook, una volta dalla radice di un progetto di
  prova e una volta da una sua sottocartella (anche da una worktree sotto
  .claude/worktrees/), e riporta le due uscite;
- la modifica minima fa dare lo stesso risultato nei due casi. Se la radice non è
  ricavabile lo script lo dice e non inventa un percorso.

--- (c) guard-paths: falsi positivi

Il gate nega i comandi che nominano un percorso fuori dal progetto. Deve restare
fail-closed: se non sa decidere, nega. Ogni allentamento è un ELENCO CHIUSO di casi
ammessi, scritto nel codice e nei test; per ognuno ci sono due test: il caso ammesso ora
passa, e il caso davvero pericoloso che gli somiglia resta negato.

Casi misurati in ownconsent-www (voci di journal fra parentesi). Nessuno usciva dal
progetto:

1. `..` dopo un `cd` nello stesso comando. Comando lanciato con `cd <worktree>/site;
   ... git -C .. ls-files`: negato con «GATE: il percorso '..' porta fuori dal progetto
   (/home/andreapernici/src/ownconsent)». Il gate risolve `..` dalla radice del progetto
   e non dalla cartella in cui il comando si è spostato (2026-10-08/081849). Stessa
   classe il 23/09: «il percorso '../.gitignore' porta fuori dal progetto», con la
   shell in una sottocartella (2026-09-23/125158).
2. Testo con una barra dentro un heredoc. Il corpo di una issue, passato con
   `cat > file <<'EOF' ... EOF`, conteneva il percorso dell'endpoint delle advisory
   dell'API di GitHub: negato con «il percorso '/advisories/' porta fuori dal progetto
   (/advisories)» (2026-10-08/081849). Poco prima lo stesso endpoint, passato a
   `gh api` con l'identificativo in una variabile, non era stato negato.
3. Codice dentro un heredoc. Uno script python passato con `python3 - <<'EOF'`
   conteneva la chiamata split con una barra come separatore e 1 come limite: negato
   con «il percorso '/,1' porta fuori dal progetto (/,1)» (2026-10-08/083455). Stessa
   classe il 23/09: «il percorso '/h1'» e «il percorso '/$'» (2026-09-23/125158).
   Nel log di cantiere risulta un merge «guard-paths-heredoc» (PR 18, 76cbc5d): questi
   casi sono successivi, quindi quella correzione non li copre. Misura perché.

Casi segnalati da Andrea, non riprodotti dalla sessione di ownconsent-www:

4. Percorsi costruiti con una sostituzione di comando, `$(…)`.
5. La memoria di sessione di Claude Code, che sta fuori dal progetto: la cartella
   `memory/` sotto `~/.claude/projects/<nome-del-progetto>/`.

Per ciascuno dei cinque:
- riproduci il diniego invocando lo script del gate come lo invoca l'hook, con l'input
  esatto, e riporta l'output;
- decidi il caso ammesso più stretto possibile e scrivilo nell'elenco chiuso;
- scrivi il test del caso ammesso e il test del gemello pericoloso, che deve restare
  negato. Gemelli minimi da coprire: per 1, un `..` che esce davvero dal progetto anche
  dopo il `cd`, e un `cd` verso una cartella fuori progetto; per 2 e 3, un heredoc che
  viene ESEGUITO da una shell (`bash <<EOF`, `sh -s <<EOF`) e nomina un percorso fuori
  progetto, e un percorso fuori progetto sulla riga del comando accanto all'heredoc;
  per 4, una sostituzione il cui risultato non è conoscibile dal testo, che resta
  negata; per 5, ogni altra cartella sotto `~/.claude/` e ogni altro progetto sotto
  `~/.claude/projects/`, che restano negati;
- se per un caso non trovi un allentamento che tenga negato il gemello, non allentare:
  lascialo negato e scrivilo in «Limiti noti».

Il gate oggi nega anche quando lo script esce con un codice diverso da 2 («gate in
errore … azione non esaminata, quindi negata»): questo comportamento non si tocca, e un
test lo deve dimostrare ancora vero dopo le modifiche.

Consegna: per ogni correzione il link della PR, la misura del guasto prima, l'output dei
test sul codice vecchio e sul nuovo, i Limiti noti. Dopo le tre PR, l'elenco dei file di
template/githooks cambiati e lo SHA da cui ownconsent-www dovrà ricopiare l'hook.

Procedi.
```
