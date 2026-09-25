# Firme ricostruite — consegna 1

Registro congelato il 25/09/2026. Per ogni commit dell'intervallo della ricognizione
(`4cb1674`…`cb2e804`, si veda `corso/ricognizione/consegna-1.md` §0) in cui
`git log --format='%(trailers:key=Cantiere-Agent,valueonly)'` non restituisce nulla, qui
sono riportati il ruolo ricostruito, la fonte e il metodo.

**Perché esiste questo file.** Le PR sono state fuse con squash. GitHub mette le firme dei
singoli commit nel corpo del messaggio dello squash, e non nell'ultimo paragrafo, dove
`git` cerca i trailer. La verifica incrociata usa i `refs/pull/N/head`, che vivono su
GitHub. Il corso deve reggere senza GitHub: da qui in poi la ricostruzione è un file del
repository.

## Metodo, in tre righe

1. **Fonte primaria, su main:** `git show -s --format=%B <commit>`, contando le righe
   `^\s*Cantiere-Agent:\s*(\S+)` in tutto il corpo, non solo nell'ultimo paragrafo.
2. **Verifica incrociata, su GitHub:** `git fetch origin '+refs/pull/*/head:refs/remotes/pr/*'`,
   poi `git log <baseRefOid>..pr/N --format='%(trailers:key=Cantiere-Agent,valueonly)'`.
   N viene dal `(#N)` finale del soggetto; per `7532799`, che non lo porta, dal ramo
   `chore/ignora-pycache`, che è la PR #48.
3. **Esito:** le due fonti concordano su 31 commit su 33: 26 con gli stessi ruoli, 5 senza
   ruolo in entrambe. I 2 discordanti sono spiegati più sotto: non sono errori della
   ricostruzione.

## Che cosa ricostruisce, e che cosa no

Ricostruisce **la firma**, non l'autore. Fino a `4dcebd0` (21/09 11:12) la firma veniva da
un file-marcatore condiviso fra sessioni. Il commento di `githooks/prepare-commit-msg` dice
che in quel periodo «quasi tutti i commit risultavano orchestrator». Dove la firma e il
journal non concordano (L04, L05, L08) vale quanto scritto in
`corso/ricognizione/consegna-1.md` §1.2. Questa tabella non lo corregge.

Un commit squash porta più ruoli: il ruolo ricostruito è l'elenco dei ruoli firmati nei
commit della PR, con il numero di commit per ciascuno. Non è un ruolo prevalente.

## Tabella

| commit | data | PR · head | ruoli nel corpo (su main) | trailer nei commit della PR | concordano |
|---|---|---|---|---|---|
| `4cb1674` | 13/09 18:39 | #10 · `8e14912` | — | — (+1 senza) | **nessun ruolo** |
| `3fe1874` | 13/09 18:40 | #9 · `846db4b` | feature ×1 | feature ×1 | sì |
| `fe50e11` | 13/09 18:40 | #7 · `629f893` | feature ×1 | feature ×1 | sì |
| `2207a8c` | 13/09 18:40 | #11 · `80e04e5` | — | — (+1 senza) | **nessun ruolo** |
| `4575311` | 13/09 19:30 | #12 · `75c41d7` | feature ×1 | feature ×1 | sì |
| `32272db` | 13/09 19:30 | #13 · `17ced57` | product-spec ×1, feature ×1 | product-spec ×1, feature ×1 (+2 senza) | sì |
| `d03b5b4` | 14/09 10:14 | #18 · `1d33338` | orchestrator ×1 | orchestrator ×1 | sì |
| `8d5bad4` | 14/09 10:15 | #14 · `c01393f` | privacy ×2, orchestrator ×1 | privacy ×2, orchestrator ×1 | sì |
| `7db22ad` | 14/09 10:15 | #16 · `8ca7326` | architect ×2 | architect ×2 | sì |
| `a24f2db` | 14/09 10:15 | #17 · `c603e99` | performance ×7, architect ×3, orchestrator ×1 | performance ×6, architect ×3, orchestrator ×1 (+1 senza) | no |
| `01f4f4e` | 14/09 10:16 | #19 · `59dc7e5` | orchestrator ×1 | orchestrator ×1 | sì |
| `b677bdd` | 14/09 10:53 | #15 · `ea109a3` | design ×5, orchestrator ×3 | design ×4, orchestrator ×3 (+1 senza) | no |
| `62772d2` | 14/09 12:42 | #20 · `f86d81c` | orchestrator ×3 | orchestrator ×3 (+1 senza) | sì |
| `76ee693` | 14/09 12:42 | #22 · `cb481f5` | — | — (+2 senza) | **nessun ruolo** |
| `bd0ab74` | 14/09 12:42 | #21 · `161c378` | orchestrator ×3 | orchestrator ×3 | sì |
| `29fd594` | 14/09 16:00 | #24 · `8fd5a8a` | orchestrator ×1 | orchestrator ×1 (+1 senza) | sì |
| `0e079fc` | 14/09 16:00 | #23 · `ff21041` | orchestrator ×1 | orchestrator ×1 | sì |
| `b2480ac` | 15/09 12:47 | #26 · `3ad7413` | orchestrator ×8 | orchestrator ×8 (+1 senza) | sì |
| `5bcb7ac` | 19/09 11:19 | #29 · `07b03bf` | orchestrator ×1 | orchestrator ×1 | sì |
| `54a4181` | 19/09 13:47 | #31 · `c950326` | orchestrator ×1 | orchestrator ×1 | sì |
| `4209875` | 19/09 14:05 | #32 · `31ba8a9` | orchestrator ×1 | orchestrator ×1 | sì |
| `41ff0a2` | 19/09 20:18 | #33 · `1c9d7b9` | orchestrator ×3 | orchestrator ×3 | sì |
| `718d54a` | 20/09 15:54 | #34 · `67b5528` | orchestrator ×3 | orchestrator ×3 (+1 senza) | sì |
| `92d7f87` | 20/09 17:38 | #36 · `283fe04` | architect ×2 | architect ×2 | sì |
| `95c50a8` | 20/09 17:38 | #35 · `1ec808d` | orchestrator ×3, cantiere:qa-test ×1 | orchestrator ×3, cantiere:qa-test ×1 (+2 senza) | sì |
| `233881d` | 20/09 18:24 | #38 · `d1b91d4` | frontend ×7, orchestrator ×1 | frontend ×7, orchestrator ×1 | sì |
| `f7ffc19` | 20/09 21:05 | #39 · `ba1bc67` | orchestrator ×1 | orchestrator ×1 | sì |
| `0a7a469` | 20/09 21:05 | #37 · `ea32836` | qa-test ×65, feature ×11, orchestrator ×8 | qa-test ×65, feature ×11, orchestrator ×8 (+2 senza) | sì |
| `8288e81` | 20/09 21:11 | #40 · `853c60c` | orchestrator ×1 | orchestrator ×1 | sì |
| `d797f0c` | 21/09 09:41 | #41 · `f6ce4bb` | orchestrator ×8 | orchestrator ×8 | sì |
| `4dcebd0` | 21/09 11:12 | #43 · `94926d8` | — | — (+1 senza) | **nessun ruolo** |
| `bd43d28` | 21/09 13:51 | #42 · `3f6aa9e` | orchestrator ×1 | orchestrator ×1 | sì |
| `7532799` | 21/09 16:50 | #48 · `763ed39` | — | — (+1 senza) | **nessun ruolo** |


## I due discordanti, spiegati

| commit | differenza | causa | già nel journal |
|---|---|---|---|
| `a24f2db` (#17) | il corpo conta `performance` 7 volte, i trailer 6 | `d5e8331` porta `Cantiere-Agent: performance` in un paragrafo che non è l'ultimo, quindi `git` non lo legge come trailer. È il difetto corretto da `d03b5b4`, e il commento dell'hook cita proprio `d5e8331`. | sì, il commento dell'hook e `d03b5b4` |
| `b677bdd` (#15) | il corpo conta `design` 5 volte, i trailer 4 | `04d7718` porta `Cantiere-Agent: design` scritto a mano, fuori posizione di trailer | sì, `2026-09-14/102821-design-fallimento` |

In tutti e due i casi il ruolo è `performance` e `design`, e la fonte primaria lo vede. La
fonte primaria conta quindi **più** firme dei trailer, mai meno.

## Commit che restano senza ruolo attribuibile — 5

| commit | PR | che cosa si sa | perché non si attribuisce |
|---|---|---|---|
| `4cb1674` | #10 | un commit nella PR, `8e14912`, senza trailer | nessuna firma in nessuna delle due fonti |
| `2207a8c` | #11 | un commit, `80e04e5`, senza trailer | come sopra |
| `76ee693` | #22 | due commit, `cb481f5` e `b3dcc26`, con trailer `Co-Authored-By` di un modello e `Claude-Session` | fatti da una sessione Claude Code, ma senza un ruolo `Cantiere-Agent` |
| `4dcebd0` | #43 | un commit, `94926d8`, senza trailer | è il commit che introduce `CANTIERE_AGENT`; la firma nuova non poteva firmare sé stessa |
| `7532799` | #48 (fusa per rebase, senza `(#48)` nel soggetto) | un commit, `763ed39`, senza trailer | viene dopo `4dcebd0`: secondo l'hook una variabile assente vuol dire «commit di una persona». È il disegno dell'hook, non una misura |

L'autore git di tutti i commit è `Andrea Pernici`: per costruzione del cantiere non
distingue nessuno. Chi ha deciso `4cb1674` e `4dcebd0` resta una domanda per Andrea
(ricognizione, §1.5).

Commit **dopo** `bd43d28` nell'intervallo: tutti portano un trailer leggibile da `git log`,
salvo `7532799`. Non sono in tabella.

## Appendice — trailer commit per commit, dai `refs/pull/N/head`

Copia congelata della fonte di verifica, perché resti anche senza GitHub. `∅` indica un commit senza trailer leggibile.

- **#10** (`4cb1674`): `8e14912`:∅
- **#9** (`3fe1874`): `846db4b`:feature
- **#7** (`fe50e11`): `629f893`:feature
- **#11** (`2207a8c`): `80e04e5`:∅
- **#12** (`4575311`): `75c41d7`:feature
- **#13** (`32272db`): `438f7e2`:product-spec `f815485`:feature `642e8d5`:∅ `17ced57`:∅
- **#18** (`d03b5b4`): `1d33338`:orchestrator
- **#14** (`8d5bad4`): `b400b42`:privacy `8dbf85a`:privacy `c01393f`:orchestrator
- **#16** (`7db22ad`): `bc57178`:architect `8ca7326`:architect
- **#17** (`a24f2db`): `87bca86`:performance `e16e245`:performance `7633b6a`:performance `91c514b`:architect `389ade6`:architect `d0806d7`:performance `2dbe9d4`:performance `e7a52da`:performance `77619cd`:architect `d5e8331`:∅ `c603e99`:orchestrator
- **#19** (`01f4f4e`): `59dc7e5`:orchestrator
- **#15** (`b677bdd`): `0f398fd`:design `ecfbec5`:design `98d7b99`:design `e9fc6a9`:design `04d7718`:∅ `e8e62bf`:orchestrator `ffda5ea`:orchestrator `ea109a3`:orchestrator
- **#20** (`62772d2`): `b4fec37`:orchestrator `59eff8f`:orchestrator `6f66115`:∅ `f86d81c`:orchestrator
- **#22** (`76ee693`): `b3dcc26`:∅ `cb481f5`:∅
- **#21** (`bd0ab74`): `9e7433f`:orchestrator `5e66ed5`:orchestrator `161c378`:orchestrator
- **#24** (`29fd594`): `9e72b3d`:orchestrator `8fd5a8a`:∅
- **#23** (`0e079fc`): `ff21041`:orchestrator
- **#26** (`b2480ac`): `7fb4c77`:orchestrator `5bd39b6`:orchestrator `3eee35a`:orchestrator `eb22632`:orchestrator `589d0ca`:orchestrator `568f87e`:orchestrator `b62d60b`:orchestrator `b725d49`:∅ `3ad7413`:orchestrator
- **#29** (`5bcb7ac`): `07b03bf`:orchestrator
- **#31** (`54a4181`): `c950326`:orchestrator
- **#32** (`4209875`): `31ba8a9`:orchestrator
- **#33** (`41ff0a2`): `22de7e6`:orchestrator `a6d6156`:orchestrator `1c9d7b9`:orchestrator
- **#34** (`718d54a`): `6fea569`:orchestrator `b30a6ea`:orchestrator `1f452de`:∅ `67b5528`:orchestrator
- **#36** (`92d7f87`): `fcb8593`:architect `283fe04`:architect
- **#35** (`95c50a8`): `a3398a8`:cantiere:qa-test `e0f2dd1`:∅ `5137b68`:orchestrator `85f982b`:orchestrator `cc9c96d`:orchestrator `1ec808d`:∅
- **#38** (`233881d`): `9613729`:frontend `b6ff344`:orchestrator `2a5b765`:frontend `63d4efe`:frontend `1ebca2b`:frontend `c77760f`:frontend `b0396c0`:frontend `d1b91d4`:frontend
- **#39** (`f7ffc19`): `ba1bc67`:orchestrator
- **#37** (`0a7a469`): `99f522e`:feature `fd36c5a`:orchestrator `660bd08`:feature `3bf1d9c`:feature `4a7a4e9`:qa-test `221f0b2`:qa-test `7555e8d`:qa-test `7ef3106`:qa-test `bce365e`:qa-test `fa45dbe`:qa-test `d1b100d`:qa-test `83a0260`:feature `0318ab7`:feature `858bfd8`:orchestrator `306e70e`:qa-test `bf80918`:qa-test `ccc057b`:qa-test `e2666ad`:qa-test `e5f6fcc`:qa-test `cf3b4df`:qa-test `79e6168`:qa-test `bf17bd4`:qa-test `9c82cea`:qa-test `6e05dbe`:qa-test `705f27d`:qa-test `d8a1cd2`:qa-test `46e3d89`:qa-test `f7f3967`:qa-test `b566450`:qa-test `1baf0d2`:qa-test `b0975de`:qa-test `4b0e7c9`:qa-test `0f811aa`:qa-test `b264986`:qa-test `481cfc5`:qa-test `f5fb036`:qa-test `fd19d44`:qa-test `24f495f`:qa-test `749122b`:qa-test `8497a10`:qa-test `b403ae6`:qa-test `af3af23`:qa-test `5531751`:qa-test `b79c511`:qa-test `39dc250`:orchestrator `3a9e4a1`:qa-test `c92f85f`:qa-test `4ba51ad`:feature `cdb349d`:qa-test `e683d36`:qa-test `002f544`:∅ `a1a8ffd`:feature `e47a6fd`:∅ `6f71d60`:qa-test `8c95a0a`:orchestrator `c2ed68d`:qa-test `4a71f1d`:feature `d778d26`:qa-test `1476541`:qa-test `9198430`:qa-test `21dd078`:qa-test `080a195`:qa-test `3a6745e`:feature `e9dcfe4`:feature `d69ea72`:qa-test `f6d647a`:qa-test `3b23433`:qa-test `eaa8c30`:qa-test `7fe9b01`:qa-test `ca0f1ef`:qa-test `420926f`:qa-test `e878603`:orchestrator `081dc15`:qa-test `a54afec`:qa-test `a8f6704`:qa-test `da9419c`:qa-test `809ecbf`:qa-test `cd8e2c2`:qa-test `5775aa9`:qa-test `420423d`:qa-test `52098c6`:qa-test `bd9dbe7`:orchestrator `9f93ca8`:orchestrator `0376bbe`:orchestrator `eaa79e8`:qa-test `ea32836`:feature
- **#40** (`8288e81`): `853c60c`:orchestrator
- **#41** (`d797f0c`): `023229a`:orchestrator `72c2e85`:orchestrator `92ad8b2`:orchestrator `3b0509c`:orchestrator `23ead00`:orchestrator `1cd329c`:orchestrator `5dfa1d2`:orchestrator `f6ce4bb`:orchestrator
- **#43** (`4dcebd0`): `94926d8`:∅
- **#42** (`bd43d28`): `3f6aa9e`:orchestrator
