"""Collaudo: l'agente isolato dal job che giudica e pubblica — #69.

Oggetto sotto test: .github/workflows/claude-pr-review.yml dopo 659ade6 (due job,
`ventaglio` e `pubblica`) e .github/scripts/collaudo-esito.sh.

Disegno: journal/2026-09-29/081405-orchestrator-decisione.json; misure che lo
precedono: journal/2026-09-29/080841-orchestrator-misura.json.

Due livelli:
  1. statica del YAML: permessi, credenziali del checkout, provenienza degli
     output del job dell'agente, trattamento dell'artifact, action fissate a
     SHA, condizione del job a valle;
  2. esecuzione dei frammenti `run:` di `pubblica` (banco in collaudo_banco.py):
     marcatore falso nel testo dell'agente, marcatore vero fuori dal primo rigo,
     uscita imprevista, timeout ricavato dall'API dei job.

Tutto si risolve da ci_root(): con CI_ROOT=<copia> si collauda una copia mutata.
"""
from __future__ import annotations

import datetime as dt
import re
import unittest

from collaudo_banco import (ASSENTE, SHA, VUOTO, esegui_job, review_doc, step_di)
from helpers import find_steps, workflow_dir

CORTO = SHA[:7]
BUDGET = 30
CONFINE = BUDGET * 60
MARCATORE_FALSO = "<!-- cantiere-collaudo tipo=verdetto sha=0000000000000000000000000000000000000000 -->"
MARCATORE_VERO = f"<!-- cantiere-collaudo tipo=verdetto sha={SHA} -->"
TESTO_VERDETTO_BREVE = "## Collaudo — run 1, tentativo 1\n\nNessun finding.\n"
SCRITTURA = {"write", "write-all"}
ID_AGENTE = "ventaglio"
# Contesti che il runner valuta da se', uguali per tutto il job: ammessi per nome,
# interi, come output del job ventaglio. Ogni altro contesto resta vietato.
CONTESTI_DEL_RUNNER = {"github.run_attempt"}


def _permessi(blocco):
    """Normalizza `permissions:` in (stringa globale | None, dict)."""
    if blocco is None:
        return None, {}
    if isinstance(blocco, str):
        return blocco, {}
    return None, dict(blocco)


def _concede_scrittura(blocco) -> list[str]:
    globale, perms = _permessi(blocco)
    fuori = []
    if globale is not None and globale in SCRITTURA:
        fuori.append(f"permissions: {globale}")
    fuori += [f"{k}: {v}" for k, v in perms.items() if str(v) in SCRITTURA]
    return fuori


def _checkout(steps):
    return [s for s in steps if str(s.get("uses", "")).split("@")[0] == "actions/checkout"]


_ESPR = re.compile(r"\$\{\{(.*?)\}\}", re.S)


# --- 1. statica -------------------------------------------------------------------

class TestStaticaIsolamento(unittest.TestCase):

    def setUp(self):
        self.doc = review_doc()
        self.jobs = self.doc["jobs"]
        self.ventaglio = self.jobs["ventaglio"]
        self.pubblica = self.jobs["pubblica"]

    # permessi

    def test_ventaglio_senza_permessi_di_scrittura(self):
        self.assertIn("permissions", self.ventaglio,
                      "senza permissions il job erediterebbe quelli del workflow")
        self.assertEqual(_concede_scrittura(self.ventaglio["permissions"]), [])
        # Il livello workflow non concede niente in scrittura, a nessun job.
        self.assertEqual(_concede_scrittura(self.doc.get("permissions")), [])

    def test_workflow_senza_permessi_a_livello_workflow(self):
        # 659ade6: `permissions: {}`. Un permesso qui arriverebbe anche all'agente
        # in un job che non dichiarasse i suoi.
        self.assertIn("permissions", self.doc)
        self.assertEqual(self.doc["permissions"], {})
        for nome, job in self.jobs.items():
            self.assertIn("permissions", job, f"il job {nome} non dichiara i suoi permessi")

    def test_pubblica_unico_job_con_pull_requests_write(self):
        scrivono = [nome for nome, job in self.jobs.items()
                    if "pull-requests: write" in _concede_scrittura(job.get("permissions"))
                    or _permessi(job.get("permissions"))[0] == "write-all"]
        self.assertEqual(scrivono, ["pubblica"])
        # E pubblica non scrive altro.
        self.assertEqual(_concede_scrittura(self.pubblica["permissions"]),
                         ["pull-requests: write"])

    def test_pubblica_dipende_da_ventaglio_e_gira_con_not_cancelled(self):
        needs = self.pubblica.get("needs")
        self.assertIn("ventaglio", [needs] if isinstance(needs, str) else needs)
        cond = str(self.pubblica.get("if", ""))
        self.assertRegex(cond, r"!\s*cancelled\(\)")
        self.assertNotIn("always()", cond)
        self.assertRegex(cond, r"github\.event\.pull_request\.draft\s*==\s*false")

    # credenziali

    def test_persist_credentials_false_su_ogni_checkout(self):
        visti = 0
        for nome, job in self.jobs.items():
            for s in _checkout(find_steps(job)):
                visti += 1
                with self.subTest(job=nome):
                    self.assertIs((s.get("with") or {}).get("persist-credentials"), False)
        self.assertGreaterEqual(visti, 2, "attesi almeno i checkout dei due job")

    # output del job dell'agente

    def test_output_di_ventaglio_solo_da_step_non_successivi_all_agente(self):
        passi = find_steps(self.ventaglio)
        posizione = {s["id"]: i for i, s in enumerate(passi) if "id" in s}
        self.assertIn(ID_AGENTE, posizione, "step agente non trovato per id")
        i_agente = posizione[ID_AGENTE]
        self.assertIn("anthropics/claude-code-action@", str(passi[i_agente].get("uses")))
        outputs = self.ventaglio.get("outputs") or {}
        self.assertTrue(outputs)
        for nome, valore in outputs.items():
            with self.subTest(output=nome):
                espressioni = _ESPR.findall(str(valore))
                self.assertTrue(espressioni, f"{nome}: nessuna espressione")
                resto = _ESPR.sub("", str(valore)).strip()
                self.assertEqual(resto, "", f"{nome}: testo fuori dalle espressioni")
                for e in espressioni:
                    if e.strip() in CONTESTI_DEL_RUNNER:
                        # Valutato dal runner, non da uno step (beab008: tentativo).
                        continue
                    rif = re.findall(r"\bsteps\.([A-Za-z_][\w-]*)\.([\w-]+)(?:\.([\w-]+))?", e)
                    self.assertTrue(rif, f"{nome}: '{e}' non viene da uno step")
                    # Solo contesti steps: niente env, job, runner, file.
                    senza = re.sub(r"\bsteps\.[\w.-]+", "", e)
                    self.assertNotRegex(senza, r"[A-Za-z_]\w*\s*[.(]",
                                        f"{nome}: '{e}' usa altro oltre a steps.*")
                    for id_, campo, _ in rif:
                        self.assertIn(id_, posizione, f"{nome}: step '{id_}' inesistente")
                        i = posizione[id_]
                        self.assertLessEqual(i, i_agente,
                                             f"{nome}: '{id_}' e' lo step {i}, dopo l'agente ({i_agente})")
                        if i == i_agente:
                            # Dell'agente conta solo cio' che valuta il runner: i suoi
                            # outputs passano da $GITHUB_OUTPUT, che l'agente scrive.
                            self.assertIn(campo, ("outcome", "conclusion"),
                                          f"{nome}: steps.{id_}.{campo} lo puo' scrivere l'agente")

    # artifact trattato come dato

    def _download(self):
        passi = [s for s in find_steps(self.pubblica)
                 if str(s.get("uses", "")).split("@")[0] == "actions/download-artifact"]
        self.assertEqual(len(passi), 1, "un solo download nel job pubblica")
        return passi[0]

    def test_download_fuori_dal_workspace(self):
        # Il checkout di pubblica contiene lo script che si esegue: un artifact
        # posato nel workspace potrebbe sovrascriverlo.
        percorso = str((self._download().get("with") or {}).get("path", ""))
        self.assertRegex(percorso, r"^\$\{\{\s*runner\.temp\s*\}\}/[\w.-]+$")
        self.assertNotIn("workspace", percorso)
        self.assertNotIn("..", percorso)

    def test_pubblica_non_esegue_ne_fa_source_dell_artifact(self):
        percorso = str(self._download()["with"]["path"])
        radice = _ESPR.sub(lambda m: "$RUNNER_TEMP" if m.group(1).strip() == "runner.temp"
                           else m.group(0), percorso)
        # Nomi che portano l'artifact: variabili d'env il cui valore contiene il
        # percorso del download, e variabili di shell assegnate da quelle, dal
        # percorso stesso o dalla copia preparata ($RUNNER_TEMP/verdetto*.md).
        contaminati = set()
        testi = []
        for s in find_steps(self.pubblica):
            for k, v in (s.get("env") or {}).items():
                if percorso in str(v) or "runner.temp }}/" + percorso.split("}}/")[-1] in str(v):
                    contaminati.add(k)
            if s.get("run"):
                testi.append((s.get("name"), s["run"]))
        self.assertIn("RICEVUTO", contaminati, "l'env che porta il file ricevuto")
        for _, run in testi:
            for m in re.finditer(r'\b([A-Za-z_]\w*)="?\$\{?(\w+)\}?(/[^"\s]*)?"?', run):
                var, sorgente, coda = m.group(1), m.group(2), m.group(3) or ""
                if sorgente in contaminati or (sorgente == "RUNNER_TEMP" and
                                               re.match(r"/verdetto", coda)):
                    contaminati.add(var)
        riferimenti = [re.escape(radice)] + [rf"\$\{{?{re.escape(v)}\}}?" for v in sorted(contaminati)]
        bersaglio = "(?:" + "|".join(riferimenti) + ")"
        esecuzione = re.compile(
            r'(?:^|[;&|(`\s])(?:bash|sh|zsh|source|\.|eval|exec|python3?|node|perl)\s+'
            r'(?:-\S+\s+)*"?' + bersaglio)
        for nome, run in testi:
            with self.subTest(step=nome):
                for r in run.splitlines():
                    if r.lstrip().startswith("#"):
                        continue
                    self.assertNotRegex(r, esecuzione, f"esegue l'artifact: {r.strip()}")
                    # Nessun chmod +x sul materiale ricevuto, nessuna scrittura
                    # dell'ambiente degli step successivi.
                    self.assertNotRegex(r, r"\bchmod\b.*" + bersaglio)
                self.assertNotRegex(run, r"\$\{?GITHUB_(ENV|PATH)\b",
                                    "pubblica non scrive l'ambiente degli step successivi")
        # Il percorso del download non e' un'action locale ne' una shell.
        for s in find_steps(self.pubblica):
            self.assertFalse(str(s.get("uses", "")).startswith("./"), s.get("name"))
            self.assertNotIn(radice, str(s.get("shell", "")))

    def test_pubblica_nessuna_espressione_nei_run(self):
        # Ogni valore arriva agli script via env: un ${{ }} nel run si incolla nel
        # testo della shell prima che la shell lo legga.
        for s in find_steps(self.pubblica):
            if s.get("run"):
                with self.subTest(step=s.get("name")):
                    self.assertNotIn("${{", s["run"])
            for k, v in (s.get("env") or {}).items():
                # Del download conta solo l'esito, mai un suo output.
                self.assertNotRegex(str(v), r"steps\.scarica\.outputs",
                                    f"{s.get('name')}: {k}")

    # action fissate

    def test_uses_fissate_a_sha_con_il_tag_in_commento(self):
        testo = (workflow_dir() / "claude-pr-review.yml").read_text(encoding="utf-8")
        righe = [r for r in testo.splitlines()
                 if re.match(r"^\s*(-\s+)?uses:", r)]
        dichiarate = [s["uses"] for job in self.jobs.values() for s in find_steps(job) if "uses" in s]
        dichiarate += [job["uses"] for job in self.jobs.values() if "uses" in job]
        self.assertEqual(len(righe), len(dichiarate), "ogni uses: su una riga sua")
        self.assertTrue(righe)
        for r in righe:
            with self.subTest(riga=r.strip()):
                self.assertRegex(r, r"uses:\s*[\w.-]+/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+(\.\d+)*\s*$")


# --- 2. esecuzione ----------------------------------------------------------------

class TestEsecuzioneIsolamento(unittest.TestCase):

    def test_marcatore_falso_nel_testo_dell_agente_si_neutralizza(self):
        testo = ("## Collaudo — run 1, tentativo 1\n\nPrima riga del verdetto.\n"
                 f"{MARCATORE_FALSO}\n"
                 "In mezzo, maiuscolo: CANTIERE-COLLAUDO e Cantiere-Collaudo.\n"
                 "Fine.\n")
        r = esegui_job(verdetto=testo, esito="success")
        self.assertEqual(r["rc"], 0, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
        corpo = r["pubblicati"][0]
        righe = corpo.split("\n")
        self.assertEqual(righe[0], MARCATORE_VERO)
        self.assertEqual(corpo.count("cantiere-collaudo"), 1, corpo)
        self.assertEqual(len(re.findall("cantiere-collaudo", corpo, re.I)), 1, corpo)
        # Il testo resta leggibile: stesso contenuto, trattino U+2011.
        self.assertIn(MARCATORE_FALSO.replace("cantiere-collaudo", "cantiere‑collaudo"), corpo)
        self.assertIn("CANTIERE‑COLLAUDO", corpo)
        self.assertIn("Prima riga del verdetto.", corpo)
        self.assertNotIn("0000000000000000000000000000000000000000 -->\n" + "Commit", corpo)

    def test_marcatore_vero_fuori_dal_primo_rigo_nessun_rimando(self):
        # marcatore-citato.json: due commenti del bot con il marcatore giusto per
        # questo SHA, ma nel testo o nel secondo rigo.
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                r = esegui_job(verdetto=file_v, esito="failure", trascorsi=100,
                               risposta="marcatore-citato.json")
                self.assertEqual(len(r["api_commenti"]), 1, r["stdout"])
                self.assertEqual(r["rc"], 1, r["stdout"])
                self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                corpo = r["pubblicati"][0]
                self.assertIn("nessun verdetto", corpo.lower())
                self.assertNotIn("tipo=rimando", corpo)
                self.assertNotIn("#issuecomment-1009", corpo)
                self.assertNotIn("#issuecomment-1010", corpo)

    def _non_presa(self, r, n):
        self.assertEqual(r["rc"], 1, f"rosso: {r['stdout']}")
        self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
        corpo = r["pubblicati"][0]
        self.assertIn(f"Collaudo: decisione non presa (uscita {n})", corpo)
        self.assertNotIn("cantiere-collaudo", corpo)
        self.assertNotIn("tipo=", corpo)
        self.assertIn(f"`{CORTO}`", corpo)
        self.assertIn(f"(uscita {n})", r["stdout"], "l'annotazione ::error riporta l'uscita")

    def test_uscita_imprevista_dello_script_decisione_non_presa(self):
        # Commenti non JSON: collaudo-esito.sh esce 2 (input sbagliato).
        r = esegui_job(verdetto=ASSENTE, esito="failure", trascorsi=100,
                       risposta="non-json.json")
        self._non_presa(r, 2)

    def test_uscita_imprevista_di_prepara_decisione_non_presa(self):
        # Prima di beab008 il caso era «download fallito, API conta 1» -> uscita 4:
        # ora quel caso e' «artifact non trovato» (TestArtifactMancante). Resta
        # un Prepara che fallisce per altro: verdetto.md scaricato ma illeggibile.
        r = esegui_job(verdetto=TESTO_VERDETTO_BREVE, esito="success", prepara_illeggibile=True)
        self.assertNotEqual(r["rc_prepara"], 0, r["stdout"])
        self.assertNotEqual(r["rc_prepara"], 4, "4 e' l'uscita dell'artifact mancante")
        self.assertEqual(r["uscite_prepara"].get("artifact"), None, r["uscite_prepara"])
        self._non_presa(r, r["rc_prepara"])
        self.assertEqual(r["api_commenti"], [], "senza preparazione non si decide niente")

    def test_timeout_dai_tempi_dell_api_dei_job(self):
        # Il tempo viene dallo step «Ventaglio di revisione» del job ventaglio
        # nell'API dei job dell'attempt del ventaglio. Dal 78bd1c7 non c'e' piu'
        # una riserva: se l'API non fosse usata, o fosse letta male, il test cade
        # (decisione non presa, o durata sbagliata per le esche della risposta).
        casi = [
            (CONFINE, "timeout"),
            (CONFINE - 1, "nessun-verdetto"),
            (CONFINE + 125, "timeout"),
        ]
        for trascorsi, atteso in casi:
            for file_v in (ASSENTE, VUOTO):
                with self.subTest(trascorsi=trascorsi, file_verdetto=file_v):
                    r = esegui_job(verdetto=file_v, esito="failure", trascorsi=trascorsi)
                    self.assertEqual(len(r["api_jobs"]), 1, r["stdout"])
                    self.assertIn("/actions/runs/4242/attempts/1/jobs", r["api_jobs"][0])
                    self.assertEqual(r["rc"], 1, r["stdout"])
                    self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                    corpo = r["pubblicati"][0]
                    if atteso == "timeout":
                        m, s = divmod(trascorsi, 60)
                        self.assertIn(f"timeout dopo {m} minuti e {s} secondi", corpo)
                        self.assertEqual(r["api_commenti"], [], "il timeout non legge i commenti")
                    else:
                        self.assertIn("nessun verdetto", corpo.lower())
                        self.assertNotIn("timeout", corpo.lower())
                    self.assertIn("ventaglio dall'API dei job, attempt 1", r["stdout"])

    def test_timeout_con_esito_success_non_e_timeout(self):
        r = esegui_job(verdetto=ASSENTE, esito="success", trascorsi=CONFINE + 60)
        self.assertEqual(r["rc"], 1, r["stdout"])
        self.assertIn("nessun verdetto", r["pubblicati"][0].lower())


class TestTempiDelVentaglio(unittest.TestCase):
    """78bd1c7 (voce 2026-09-30/082932): i tempi si chiedono all'attempt del
    ventaglio, solo quando servono (verdetto vuoto ed esito non success), e senza
    tempi la decisione non si prende. Sostituisce
    test_api_dei_job_muta_riserva_dall_inizio_registrato: la riserva
    «adesso - INIZIO» e' stata tolta di proposito."""

    def _tempi_non_leggibili(self, r):
        self.assertEqual(r["rc"], 1, f"rosso: {r['stdout']}")
        self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
        corpo = r["pubblicati"][0]
        self.assertIn("Collaudo: decisione non presa (tempi non leggibili)", corpo)
        self.assertNotIn("cantiere-collaudo", corpo)
        self.assertNotIn("tipo=", corpo)
        self.assertNotIn("nessun verdetto", corpo.lower())
        # Il messaggio spiega che il tempo serve «a riconoscere un timeout»: si
        # vieta l'esito timeout, non la parola.
        self.assertNotIn("collaudo: timeout", corpo.lower())
        self.assertIn(f"`{CORTO}`", corpo)
        self.assertEqual(r["api_commenti"], [], "senza tempi non si decide niente")

    def test_1_rerun_del_solo_pubblica_tempi_dall_attempt_del_ventaglio(self):
        # Job al tentativo 2, ventaglio al 1: l'attempt 2 ha la copia del
        # ventaglio senza step, l'attempt 1 i tempi. /attempts/2 non si chiede.
        for trascorsi, atteso in ((CONFINE, "timeout"), (CONFINE - 1, "nessun verdetto")):
            with self.subTest(trascorsi=trascorsi):
                r = esegui_job(verdetto=ASSENTE, esito="failure", tentativo="1",
                               run_attempt="2", trascorsi=trascorsi,
                               tempi={"1": trascorsi, "2": None})
                self.assertEqual(r["nome"], "verdetto-tentativo-1", r["stdout"])
                self.assertEqual(r["tentativo_scelto"], "1")
                self.assertEqual(len(r["api_jobs"]), 1, r["api_jobs"])
                self.assertIn("/actions/runs/4242/attempts/1/jobs", r["api_jobs"][0])
                self.assertFalse([c for c in r["chiamate_gh"] if "/attempts/2/" in c],
                                 "l'attempt di pubblica non si chiede mai")
                self.assertEqual(r["rc"], 1, r["stdout"])
                self.assertIn(atteso, r["pubblicati"][0].lower())

    def test_1_rerun_del_solo_pubblica_con_verdetto(self):
        r = esegui_job(verdetto=TESTO_VERDETTO_BREVE, esito="success", tentativo="1",
                       run_attempt="2", tempi={"1": 100, "2": None})
        self.assertEqual(r["nome"], "verdetto-tentativo-1")
        self.assertEqual(r["api"], [], "verdetto scritto: nessuna API")
        self.assertEqual(r["rc"], 0, r["stdout"])
        self.assertTrue(r["pubblicati"][0].startswith(MARCATORE_VERO))

    def test_2_tempi_che_servono_e_non_arrivano(self):
        casi = {
            "API dei job in errore": dict(jobs_falliscono=True),
            "attempt del ventaglio senza step": dict(tempi={"1": None}),
            "completed_at vuoto": dict(tempi={"1": "vuoti"}),
            "attempt del ventaglio sconosciuto all'API (404)": dict(tempi={}),
        }
        for nome, kw in casi.items():
            for file_v in (ASSENTE, VUOTO):
                for esito in ("failure", "cancelled", ""):
                    with self.subTest(caso=nome, file_verdetto=file_v, esito=esito):
                        r = esegui_job(verdetto=file_v, esito=esito, trascorsi=CONFINE + 5, **kw)
                        self.assertEqual(len(r["api_jobs"]), 1, r["stdout"])
                        self._tempi_non_leggibili(r)

    def test_3_esito_success_nessuna_chiamata_ai_job(self):
        for file_v, atteso in ((ASSENTE, "nessun verdetto"), (VUOTO, "nessun verdetto"),
                               (TESTO_VERDETTO_BREVE, "Nessun finding.")):
            with self.subTest(file_verdetto=file_v):
                r = esegui_job(verdetto=file_v, esito="success", jobs_falliscono=True,
                               trascorsi=CONFINE + 60)
                self.assertEqual(r["api_jobs"], [], r["stdout"])
                self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                corpo = r["pubblicati"][0]
                if file_v == TESTO_VERDETTO_BREVE:
                    self.assertEqual(r["rc"], 0, r["stdout"])
                    self.assertIn(atteso, corpo)
                    self.assertTrue(corpo.startswith(MARCATORE_VERO))
                else:
                    self.assertEqual(r["rc"], 1, r["stdout"])
                    self.assertIn(atteso, corpo.lower())
                self.assertNotIn("tempi non leggibili", corpo)

    def test_3_verdetto_scritto_esito_failure_nessuna_chiamata_ai_job(self):
        r = esegui_job(verdetto=TESTO_VERDETTO_BREVE, esito="failure", jobs_falliscono=True,
                       trascorsi=CONFINE + 60)
        self.assertEqual(r["api_jobs"], [], r["stdout"])
        self.assertEqual(r["rc"], 0, r["stdout"])
        corpo = r["pubblicati"][0]
        self.assertTrue(corpo.startswith(MARCATORE_VERO))
        self.assertIn("Nessun finding.", corpo)
        self.assertIn("terminato con esito `failure`", corpo)


# --- 3. beab008: artifact del tentativo del ventaglio, artifact mancante, fork -----

FORK = re.compile(r"github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository")


def _congiunti(cond) -> list[str]:
    """I termini di una condizione in AND, senza ${{ }} e spazi ridondanti.
    Una condizione con || o parentesi non si scompone: la si restituisce intera."""
    c = str(cond or "").strip()
    m = re.fullmatch(r"\$\{\{(.*)\}\}", c, re.S)
    if m:
        c = m.group(1).strip()
    if "||" in c or re.search(r"[()]", c.replace("cancelled()", "")):
        return [c]
    return [re.sub(r"\s+", " ", t.strip()) for t in c.split("&&")]


class TestStaticaArtifactEFork(unittest.TestCase):

    def setUp(self):
        self.doc = review_doc()
        self.ventaglio = self.doc["jobs"]["ventaglio"]
        self.pubblica = self.doc["jobs"]["pubblica"]

    def test_upload_con_giro_txt_e_if_no_files_found_error(self):
        passi = find_steps(self.ventaglio)
        up = [s for s in passi
              if str(s.get("uses", "")).split("@")[0] == "actions/upload-artifact"]
        self.assertEqual(len(up), 1)
        w = up[0].get("with") or {}
        self.assertEqual(w.get("if-no-files-found"), "error")
        percorsi = [r.strip() for r in str(w.get("path", "")).splitlines() if r.strip()]
        self.assertIn("${{ github.workspace }}/.collaudo/giro.txt", percorsi)
        self.assertIn("${{ github.workspace }}/.collaudo/verdetto.md", percorsi)
        self.assertRegex(str(w.get("name", "")), r"^verdetto-tentativo-\$\{\{\s*github\.run_attempt\s*\}\}$")
        # giro.txt si scrive prima dell'agente, dopo lo svuotamento della cartella.
        i_agente = next(i for i, s in enumerate(passi) if s.get("id") == ID_AGENTE)
        scrive = [i for i, s in enumerate(passi)
                  if re.search(r'>\s*"\$GITHUB_WORKSPACE/\.collaudo/giro\.txt"', s.get("run", "") or "")]
        self.assertTrue(scrive, "nessuno step scrive .collaudo/giro.txt")
        self.assertLess(scrive[0], i_agente)
        run = passi[scrive[0]]["run"]
        self.assertLess(run.index("rm -rf"), run.index("giro.txt"),
                        "giro.txt dopo lo svuotamento della cartella")

    def test_download_solo_con_un_nome(self):
        passi = find_steps(self.pubblica)
        dl = next(s for s in passi
                  if str(s.get("uses", "")).split("@")[0] == "actions/download-artifact")
        self.assertRegex(str(dl.get("if", "")),
                         r"^\$\{\{\s*steps\.scegli\.outputs\.nome\s*!=\s*''\s*\}\}$")
        self.assertEqual((dl.get("with") or {}).get("name"), "${{ steps.scegli.outputs.nome }}")
        self.assertNotIn("artifact-ids", dl.get("with") or {})
        i_scegli = next(i for i, s in enumerate(passi) if s.get("id") == "scegli")
        self.assertLess(i_scegli, passi.index(dl))

    def test_prepara_e_pubblica_girano_anche_dopo_un_errore_di_scegli(self):
        # Il banco esegue sempre Prepara e Pubblica: che girino anche dopo un
        # errore di Scegli o del download lo dice il loro if, qui. Senza
        # !cancelled() l'if implicito e' success(), e un errore di Scegli
        # lascerebbe la PR senza commento invece che con «artifact non trovato».
        passi = find_steps(self.pubblica)
        for id_ in ("prepara",):
            s = next(x for x in passi if x.get("id") == id_)
            self.assertEqual(s.get("if"), "${{ !cancelled() }}", id_)
        s = next(x for x in passi if x.get("name") == "Pubblica il verdetto")
        self.assertEqual(s.get("if"), "${{ !cancelled() }}")

    def test_nome_dell_artifact_non_dal_run_attempt_di_pubblica(self):
        passi = find_steps(self.pubblica)
        dl = next(s for s in passi
                  if str(s.get("uses", "")).split("@")[0] == "actions/download-artifact")
        self.assertNotIn("run_attempt", str(dl.get("with")))
        scegli = next(s for s in passi if s.get("id") == "scegli")
        self.assertEqual((scegli.get("env") or {}).get("TENTATIVO"),
                         "${{ needs.ventaglio.outputs.tentativo }}")
        self.assertEqual((self.ventaglio.get("outputs") or {}).get("tentativo"),
                         "${{ github.run_attempt }}")
        run = scegli.get("run", "")
        self.assertNotRegex(run, r"TENTATIVO=\"?\$\{?GITHUB_RUN_ATTEMPT",
                            "il tentativo del ventaglio non e' quello di pubblica")
        self.assertRegex(run, r'nome=verdetto-tentativo-\$\{TENTATIVO\}')
        prepara = next(s for s in passi if s.get("id") == "prepara")
        self.assertNotIn("run_attempt", str(prepara.get("env")))

    def test_fork_saltato_da_entrambi_i_job(self):
        for nome in ("ventaglio", "pubblica"):
            with self.subTest(job=nome):
                job = self.doc["jobs"][nome]
                termini = _congiunti(job.get("if"))
                self.assertTrue(any(FORK.fullmatch(t) for t in termini),
                                f"{nome}: il confronto head.repo.full_name == github.repository "
                                f"non e' un termine in AND dell'if: {termini}")

    def test_pubblica_non_gira_se_ventaglio_e_saltato(self):
        # Con ventaglio saltato, !cancelled() e' vero: pubblica deve portare nel
        # proprio if ogni condizione che salta ventaglio.
        t_v = _congiunti(self.ventaglio.get("if"))
        t_p = _congiunti(self.pubblica.get("if"))
        self.assertGreater(len(t_v), 1, t_v)
        for t in t_v:
            self.assertIn(t, t_p, "pubblica girerebbe dove ventaglio e' saltato")


def _nel_corpo(r, testo):
    return any(testo in c for c in r["pubblicati"])


class TestSceltaDellArtifact(unittest.TestCase):

    def test_a_rerun_del_solo_pubblica_output_presente(self):
        r = esegui_job(verdetto=TESTO_VERDETTO_BREVE, esito="success",
                       tentativo="1", run_attempt="2")
        self.assertEqual(r["nome"], "verdetto-tentativo-1", r["stdout"])
        self.assertEqual(r["nome_chiesto"], "verdetto-tentativo-1")
        self.assertEqual(r["api_artefatti"], [], "output presente: l'API non serve")
        self.assertEqual(r["rc"], 0, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
        self.assertTrue(r["pubblicati"][0].startswith(MARCATORE_VERO))
        self.assertIn("Nessun finding.", r["pubblicati"][0])

    def test_b_output_tentativo_mancante_o_non_numerico_nessuna_riserva(self):
        # ca50180 (voce 2026-09-30/091305): la riserva sull'API degli artifact e'
        # tolta. Anche se l'API elencherebbe verdetto-tentativo-1, un output
        # tentativo vuoto o non numerico chiude: artifact non trovato, nessuna
        # chiamata all'API degli artifact ne' a quella dei job, nessun download.
        for out in ("", "abc", "0", "01", " 1", "1 "):
            for run_attempt in ("1", "2"):
                with self.subTest(tentativo=out, run_attempt=run_attempt):
                    r = esegui_job(verdetto=TESTO_VERDETTO_BREVE, esito="failure",
                                   tentativo=out, run_attempt=run_attempt,
                                   artefatti={"verdetto-tentativo-1": TESTO_VERDETTO_BREVE},
                                   tempi={"1": CONFINE + 5, "2": CONFINE + 5})
                    self.assertEqual(r["api"], [], r["chiamate_gh"])
                    self.assertEqual(r["nome"], "", r["stdout"])
                    self.assertEqual(r["tentativo_scelto"], "")
                    self.assertEqual(r["scaricato"], "skipped", "senza nome il download non gira")
                    _artifact_non_trovato(self, r)

    def test_c_rerun_completo_prende_il_tentativo_del_ventaglio(self):
        artefatti = {"verdetto-tentativo-1": "## Collaudo — tentativo UNO\n",
                     "verdetto-tentativo-2": "## Collaudo — tentativo DUE\n"}
        r = esegui_job(esito="success", tentativo="2", run_attempt="2", artefatti=artefatti)
        self.assertEqual(r["nome"], "verdetto-tentativo-2", r["stdout"])
        self.assertEqual(r["rc"], 0, r["stdout"])
        self.assertTrue(_nel_corpo(r, "tentativo DUE"), r["pubblicati"])
        self.assertFalse(_nel_corpo(r, "tentativo UNO"), "mai il tentativo 1")

    def test_agente_muto_artifact_col_solo_giro_txt(self):
        # L'artifact c'e' e non ha verdetto.md: e' l'agente muto, si decide.
        r = esegui_job(verdetto=ASSENTE, esito="success", tentativo="1")
        self.assertEqual(r["scaricato"], "success")
        self.assertEqual(r["rc_prepara"], 0, r["stdout"])
        self.assertEqual(len(r["api_commenti"]), 1, r["stdout"])
        self.assertIn("nessun verdetto", r["pubblicati"][0].lower())


def _artifact_non_trovato(self, r):
    self.assertEqual(r["rc"], 1, f"rosso: {r['stdout']}")
    self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
    corpo = r["pubblicati"][0]
    self.assertIn("Collaudo: decisione non presa (artifact non trovato)", corpo)
    self.assertNotIn("cantiere-collaudo", corpo)
    self.assertNotIn("tipo=", corpo)
    self.assertNotIn("nessun verdetto", corpo.lower())
    self.assertNotIn("timeout", corpo.lower())
    self.assertIn(f"`{CORTO}`", corpo)
    self.assertEqual(r["api_commenti"], [], "senza artifact non si decide niente")
    self.assertEqual(r["uscite_prepara"].get("artifact"), "mancante")


class TestArtifactMancante(unittest.TestCase):

    def test_d_download_fallito(self):
        casi = {
            "nome dall'output, artifact assente nel run": dict(tentativo="1", artefatti={}),
            "artifact presente, download fallito": dict(tentativo="1", download_fallisce=True),
            "rerun di pubblica, artifact del tentativo 1 sparito": dict(
                tentativo="1", run_attempt="2", artefatti={"verdetto-tentativo-2": ASSENTE}),
        }
        for nome, kw in casi.items():
            for esito in ("success", "failure"):
                with self.subTest(caso=nome, esito=esito):
                    r = esegui_job(esito=esito, trascorsi=CONFINE + 5, **kw)
                    self.assertEqual(r["scaricato"], "failure", r["stdout"])
                    _artifact_non_trovato(self, r)

    def test_d_nessun_nome(self):
        for kw in (dict(tentativo="", artefatti={}), dict(tentativo="", verdetto=TESTO_VERDETTO_BREVE)):
            with self.subTest(**{k: str(v)[:20] for k, v in kw.items()}):
                r = esegui_job(esito="failure", **kw)
                self.assertEqual(r["nome"], "", r["stdout"])
                self.assertEqual(r["scaricato"], "skipped", "senza nome il download non gira")
                self.assertEqual(r["api"], [], r["chiamate_gh"])
                _artifact_non_trovato(self, r)


# --- 4. ca50180: niente dopo l'agente, dati dell'agente fra stop-commands, tempi ---

# Cio' che nei run di pubblica porta dati dell'agente: il file ricevuto, la sua
# cartella, la copia neutralizzata e la sua parte troncata.
_DATI = r'(?:\$\{?RICEVUTO\}?|\$\{?verdetto\}?|\$\{?parte\}?|\$RUNNER_TEMP/verdetto)'
_LETTORI = re.compile(
    r'(?:^|[;&|(\s])(?:cat|ls|head|tail|less|more|od|xxd|hexdump|strings|grep|sed|awk|jq|nl|tac|base64)\b[^;&|]*?' + _DATI)
# Una redirezione dello stdout verso un file (non &1, &2, /dev/stdout, /dev/stderr).
_A_FILE = re.compile(r'(?<![0-9&])>>?\s*"?(?!&|/dev/std)[$/\w]')
_APRI = re.compile(r'^\s*echo\s+"::stop-commands::\$\{?(\w+)\}?"\s*$')
_CHIUDI = re.compile(r'^\s*echo\s+"::\$\{?(\w+)\}?::"\s*$')


def _analizza_run(run: str):
    """Ritorna (letture_fuori, blocchi, prints_fuori, assegnazioni).
    letture_fuori: righe shell che mandano dati dell'agente sullo stdout (o stderr)
    fuori da un blocco stop-commands. Il corpo dei heredoc python si analizza a
    parte: un print() che non stampi solo un numero conta come lettura."""
    letture, prints, blocchi, assegna = [], [], [], {}
    aperto = None
    heredoc = None
    for n, riga in enumerate(run.splitlines(), 1):
        if heredoc is not None:
            if riga.strip() == heredoc:
                heredoc = None
                continue
            if re.search(r"\bprint\s*\(", riga) and not re.fullmatch(
                    r"\s*print\(f'[^{}']*\{n\}'\)\s*", riga):
                if aperto is None:
                    prints.append((n, riga.strip()))
            continue
        codice = riga.split(" #")[0] if not riga.lstrip().startswith("#") else ""
        if not codice.strip():
            continue
        m = re.search(r"<<-?\s*'?(\w+)'?", codice)
        if m:
            heredoc = m.group(1)
        m = re.match(r"^\s*(\w+)=(.*)$", codice)
        if m:
            assegna.setdefault(m.group(1), []).append((n, m.group(2)))
        m = _APRI.match(codice)
        if m:
            aperto = (m.group(1), n)
            continue
        m = _CHIUDI.match(codice)
        if m and aperto is not None and m.group(1) == aperto[0]:
            blocchi.append((aperto[0], aperto[1], n))
            aperto = None
            continue
        if _LETTORI.search(codice) and not _A_FILE.search(codice.split("||")[0]):
            if aperto is None:
                letture.append((n, codice.strip()))
    if aperto is not None:
        blocchi.append((aperto[0], aperto[1], None))
    return letture, blocchi, prints, assegna


class TestStaticaDatiDellAgenteNelLog(unittest.TestCase):

    def setUp(self):
        self.doc = review_doc()
        self.ventaglio = self.doc["jobs"]["ventaglio"]
        self.pubblica = self.doc["jobs"]["pubblica"]

    def test_ventaglio_dopo_l_agente_solo_l_upload(self):
        passi = find_steps(self.ventaglio)
        i = next(k for k, s in enumerate(passi) if s.get("id") == ID_AGENTE)
        dopo = passi[i + 1:]
        self.assertEqual(len(dopo), 1, [s.get("name") for s in dopo])
        self.assertEqual(str(dopo[0].get("uses", "")).split("@")[0], "actions/upload-artifact")
        self.assertNotIn("run", dopo[0])

    def test_dati_dell_agente_nel_log_solo_fra_stop_commands(self):
        blocchi_tot = 0
        for s in find_steps(self.pubblica):
            run = s.get("run")
            if not run:
                continue
            with self.subTest(step=s.get("name")):
                letture, blocchi, prints, assegna = _analizza_run(run)
                self.assertEqual(letture, [], "dati dell'agente sullo stdout fuori dal blocco")
                self.assertEqual(prints, [], "print() di python con dati dell'agente fuori dal blocco")
                for var, apre, chiude in blocchi:
                    blocchi_tot += 1
                    self.assertIsNotNone(chiude, f"blocco {var} aperto alla riga {apre} e mai chiuso")
                    # Il token: da /dev/urandom, nello step, prima dell'apertura,
                    # assegnato una volta sola, mai da un'espressione ne' dall'env.
                    self.assertNotIn(var, s.get("env") or {})
                    righe = assegna.get(var, [])
                    self.assertEqual(len(righe), 1, f"{var} assegnato {len(righe)} volte")
                    n, valore = righe[0]
                    self.assertLess(n, apre)
                    self.assertIn("/dev/urandom", valore)
                    self.assertNotIn("${{", valore)
                    self.assertRegex(valore, r"^\$\(")
        self.assertGreaterEqual(blocchi_tot, 1, "nessun blocco stop-commands in pubblica")

    def test_la_diagnostica_del_verdetto_sta_nel_blocco(self):
        # Il controllo sopra passa anche se la diagnostica sparisce: questo dice
        # che c'e' e che sta fra apertura e chiusura.
        prepara = next(s for s in find_steps(self.pubblica) if s.get("id") == "prepara")
        run = prepara["run"].splitlines()
        _, blocchi, _, _ = _analizza_run(prepara["run"])
        self.assertEqual(len(blocchi), 1, blocchi)
        _, apre, chiude = blocchi[0]
        dentro = "\n".join(run[apre:chiude - 1])
        self.assertRegex(dentro, r'\bls -la\b.*RICEVUTO')
        self.assertRegex(dentro, r'\bcat "\$RICEVUTO"')


_INIETTATE = ["::add-mask::Collaudo", "::warning::iniettato-dal-verdetto", "::stop-commands::finto"]
TESTO_INIETTATO = ("## Collaudo — run 1, tentativo 1\n\nPrima riga.\n"
                   + "\n".join(_INIETTATE) + "\nUltima riga, senza a capo finale")


def _blocco_del_log(test, r):
    """(token, righe_prima, righe_dentro, righe_dopo) dello stdout di Prepara."""
    righe = r["stdout_passi"]["prepara"].splitlines()
    aperture = [i for i, l in enumerate(righe) if re.fullmatch(r"::stop-commands::[0-9a-f]{32}", l)]
    test.assertEqual(len(aperture), 1, righe)
    i = aperture[0]
    token = righe[i].split("::")[2]
    chiusure = [k for k, l in enumerate(righe) if l == f"::{token}::"]
    test.assertEqual(len(chiusure), 1, righe)
    k = chiusure[0]
    test.assertLess(i, k)
    return token, righe[:i], righe[i + 1:k], righe[k + 1:]


class TestStopCommandsEseguito(unittest.TestCase):

    def test_righe_dell_agente_solo_dentro_il_blocco(self):
        r = esegui_job(verdetto=TESTO_INIETTATO, esito="success")
        self.assertEqual(r["rc"], 0, r["stdout"])
        token, prima, dentro, dopo = _blocco_del_log(self, r)
        self.assertRegex(token, r"^[0-9a-f]{32}$")
        for riga in _INIETTATE:
            with self.subTest(riga=riga):
                self.assertIn(riga, dentro, "la riga del verdetto e' nel blocco")
                fuori = prima + dopo + r["stdout_passi"]["scegli"].splitlines() \
                    + r["stdout_passi"]["pubblica"].splitlines()
                errori = "\n".join(r["stderr_passi"].values()).splitlines()
                self.assertNotIn(riga, fuori + errori, "riga del verdetto fuori dal blocco")
        # Un file che non finisce con un a capo non si incolla alla riga dopo:
        # l'ultima riga del verdetto resta intera, e la chiusura su una riga sua
        # (_blocco_del_log la cerca come riga esatta).
        self.assertIn("Ultima riga, senza a capo finale", dentro)
        # Il commento: marcatore vero in prima riga, il testo come testo.
        corpo = r["pubblicati"][0]
        self.assertEqual(corpo.split("\n")[0], MARCATORE_VERO)
        self.assertEqual(corpo.count("cantiere-collaudo"), 1)
        for riga in _INIETTATE:
            self.assertIn(riga, corpo)

    def test_token_nuovo_a_ogni_esecuzione(self):
        t1 = _blocco_del_log(self, esegui_job(verdetto=TESTO_INIETTATO, esito="success"))[0]
        t2 = _blocco_del_log(self, esegui_job(verdetto=TESTO_INIETTATO, esito="success"))[0]
        self.assertNotEqual(t1, t2)

    def test_agente_muto_il_blocco_c_e_e_si_chiude(self):
        r = esegui_job(verdetto=ASSENTE, esito="success")
        _, _, dentro, _ = _blocco_del_log(self, r)
        self.assertTrue(any("giro.txt" in l for l in dentro), dentro)


class TestRigaDeiTempi(unittest.TestCase):

    def _righe(self, r):
        return [l for l in r["stdout_passi"]["pubblica"].splitlines() if l.startswith("ventaglio:")]

    def test_tempi_non_letti(self):
        casi = [(ASSENTE, "success"), (VUOTO, "success"), (TESTO_VERDETTO_BREVE, "success"),
                (TESTO_VERDETTO_BREVE, "failure")]
        for file_v, esito in casi:
            with self.subTest(file_verdetto=file_v[:10], esito=esito):
                r = esegui_job(verdetto=file_v, esito=esito, trascorsi=CONFINE + 60)
                self.assertEqual(self._righe(r), [f"ventaglio: {esito}; tempi non letti (non servono)"])
                self.assertNotIn(" s su un budget", r["stdout"])

    def test_tempi_letti(self):
        for trascorsi in (100, CONFINE):
            with self.subTest(trascorsi=trascorsi):
                r = esegui_job(verdetto=ASSENTE, esito="failure", trascorsi=trascorsi)
                self.assertEqual(self._righe(r),
                                 [f"ventaglio: failure, {trascorsi} s su un budget di {BUDGET} min"])
                self.assertNotIn("tempi non letti", r["stdout"])

if __name__ == "__main__":
    unittest.main()
