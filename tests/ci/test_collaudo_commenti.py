"""Collaudo: i commenti della PR si leggono solo per il rimando — #8.

Finding di /code-review 65 (journal/2026-09-27/182303-orchestrator-correzione.json):
in 80a591f lo step «Pubblica il verdetto» faceva `gh api …/comments --paginate`
prima di guardare il file del verdetto, sotto bash -e; se l'API falliva, un
verdetto scritto non si pubblicava.

Criteri di accettazione (Andrea):
  - `gh api …/comments` si esegue SOLO se il file del verdetto e' vuoto o
    assente: con `[ -s "$verdetto" ]` il verdetto si pubblica senza chiamarla;
  - il timeout continua a prevalere: se il ventaglio e' scaduto, i commenti non
    si leggono;
  - se la lettura serve e fallisce, il job pubblica «Collaudo: commenti non
    leggibili» col codice d'uscita di gh e va rosso. Mai «nessun verdetto», mai
    rimando; il messaggio non porta mai il marcatore tipo=verdetto.

Tre livelli:
  1. lo script (contratto dell'uscita 3);
  2. la statica dello step (richiesta di Andrea: test «statici»);
  3. OLTRE lo statico, dichiarato: i frammenti `run:` di «Prepara il verdetto» e
     «Pubblica il verdetto» del job `pubblica` (dal #69, 659ade6), ESTRATTI dal
     YAML e non riscritti, eseguiti in ordine con `bash -e` (la shell di GitHub
     per uno step senza `shell:` su ubuntu), con l'env risolto dal YAML e un
     `gh` finto in PATH che registra le chiamate e, a comando, fa fallire
     `gh api`. Il banco e' in collaudo_banco.py. Lo script collaudo-esito.sh e'
     quello di ci_root(), posato nel checkout finto del job pubblica.

Dal #69 prima della chiamata allo script c'e' una sola `gh api`, quella dei
tempi del job ventaglio (…/attempts/$TENTATIVO/jobs, dal 78bd1c7 l'attempt del
ventaglio): la statica lo ammette per nome. Dal 78bd1c7 con un verdetto scritto
non si chiama affatto, e l'esecuzione lo prova anche con l'API dei job e dei
commenti in errore.

Tutto si risolve da ci_root(): con CI_ROOT=<copia> si collauda una copia (anche
un `git archive` di un commit precedente).
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import tempfile
import unittest

from collaudo_banco import esegui_job
from helpers import ci_root, find_steps, load_yaml, workflow_dir

FIXTURE = pathlib.Path(__file__).resolve().parent / "fixtures" / "collaudo-esito"

SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
CORTO = SHA[:7]
BUDGET = 30
CONFINE = BUDGET * 60
URL_STESSO_SHA = "https://github.com/OwnConsent/ownconsent-www/pull/99#issuecomment-1002"
TESTO_VERDETTO = "## Collaudo — run 1, tentativo 1\n\nNessun finding.\n"
ASSENTE, VUOTO = "assente", "vuoto"
USCITA_GH = 7


def script_path() -> pathlib.Path:
    return ci_root() / ".github" / "scripts" / "collaudo-esito.sh"


def _verdetto(tmp: pathlib.Path, verdetto) -> pathlib.Path:
    f = tmp / "verdetto.md"
    if verdetto == VUOTO:
        f.write_text("", encoding="utf-8")
    elif verdetto != ASSENTE:
        f.write_text(verdetto, encoding="utf-8")
    return f


# --- 1. lo script ------------------------------------------------------------------

def esegui_script(*, verdetto=ASSENTE, esito="failure", trascorsi=100):
    """COMMENTI punta a un file che non esiste. Ritorna (rc, stdout, corpo|None)."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        f_v = _verdetto(tmp, verdetto)
        corpo = tmp / "corpo.md"
        p = subprocess.run(
            ["bash", str(script_path()), str(f_v), SHA, str(tmp / "commenti.json"),
             esito, str(trascorsi), str(BUDGET), str(corpo)],
            capture_output=True, text=True, timeout=60)
        testo = corpo.read_text(encoding="utf-8") if corpo.exists() else None
        return p.returncode, p.stdout.strip(), testo


class TestScriptChiedeICommenti(unittest.TestCase):

    def test_commenti_assenti_dopo_verdetto_e_timeout_esclusi_uscita_3(self):
        for file_v in (ASSENTE, VUOTO):
            for esito, trascorsi in (("failure", 100), ("failure", CONFINE - 1),
                                     ("success", CONFINE + 60), ("cancelled", 0)):
                with self.subTest(file_verdetto=file_v, esito=esito, trascorsi=trascorsi):
                    rc, parola, corpo = esegui_script(verdetto=file_v, esito=esito,
                                                      trascorsi=trascorsi)
                    self.assertEqual((rc, parola), (3, "servono-commenti"))
                    self.assertIsNone(corpo, "con l'uscita 3 il CORPO non si scrive")

    def test_verdetto_con_commenti_assenti_decide(self):
        for esito, trascorsi in (("success", 100), ("failure", CONFINE + 60)):
            with self.subTest(esito=esito, trascorsi=trascorsi):
                rc, parola, corpo = esegui_script(verdetto=TESTO_VERDETTO, esito=esito,
                                                  trascorsi=trascorsi)
                self.assertEqual((rc, parola), (0, "verdetto"))
                self.assertTrue(corpo.startswith(
                    f"<!-- cantiere-collaudo tipo=verdetto sha={SHA} -->\n"))

    def test_timeout_con_commenti_assenti_decide(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                rc, parola, corpo = esegui_script(verdetto=file_v, esito="failure",
                                                  trascorsi=CONFINE)
                self.assertEqual((rc, parola), (0, "timeout"))
                self.assertIn(f"timeout dopo {BUDGET} minuti", corpo)


# --- 2. statica dello step ----------------------------------------------------------

def _step_pubblica() -> dict:
    doc = load_yaml(workflow_dir() / "claude-pr-review.yml")
    for s in find_steps(doc["jobs"]["pubblica"]):
        if s.get("name") == "Pubblica il verdetto":
            return s
    raise AssertionError("step «Pubblica il verdetto» non trovato nel job pubblica")


def _righe_codice(run: str) -> list[str]:
    """Righe del run senza i commenti shell a riga intera."""
    return [r for r in run.splitlines() if not r.lstrip().startswith("#")]


def _senza_funzioni(righe: list[str]) -> list[str]:
    """Le righe fuori dalle definizioni di funzione `nome() { … }` a colonna 0:
    una definizione non esegue niente finche' non la si chiama."""
    fuori, dentro = [], False
    for r in righe:
        if not dentro and re.match(r"^[A-Za-z_]\w*\(\)\s*\{\s*$", r):
            dentro = True
            continue
        if dentro:
            if r.strip() == "}":
                dentro = False
            continue
        fuori.append(r)
    return fuori


API_DEI_JOB = re.compile(
    r'gh api "repos/\$GITHUB_REPOSITORY/actions/runs/\$GITHUB_RUN_ID/attempts/\$TENTATIVO/jobs"')


class TestStaticaLetturaDeiCommenti(unittest.TestCase):

    def setUp(self):
        self.righe = _righe_codice(_step_pubblica()["run"])

    def _indice(self, pred, cosa):
        for i, r in enumerate(self.righe):
            if pred(r):
                return i
        self.fail(f"nel run manca: {cosa}")

    def test_a_nessuna_lettura_dei_commenti_prima_della_decisione_sul_file(self):
        # Prima del #69: nessun gh prima dello script. Dal #69 prima dello script
        # c'e' la lettura dei tempi dall'API dei job, e la definizione di
        # non_presa (che non si esegue li'). Resta vietato ogni altro gh.
        i_script = self._indice(lambda r: "collaudo-esito.sh" in r, "chiamata allo script")
        i_api = self._indice(lambda r: re.search(r"\bgh api\b.*/comments", r), "gh api …/comments")
        self.assertLess(i_script, i_api,
                        "gh api …/comments compare prima della chiamata allo script")
        prima = _senza_funzioni(self.righe[:i_script])
        gh_prima = [r for r in prima if re.search(r"\bgh\b", r)]
        for r in gh_prima:
            self.assertRegex(r, API_DEI_JOB, "prima della decisione, solo l'API dei job")
        self.assertNotRegex("\n".join(prima), r"/comments")

    def test_a_la_lettura_dipende_dall_uscita_3(self):
        i_api = self._indice(lambda r: re.search(r"\bgh api\b.*/comments", r), "gh api …/comments")
        guardia = [r for r in self.righe[:i_api] if re.search(r"-eq 3\b", r)]
        self.assertTrue(guardia, "la lettura dei commenti non e' condizionata all'uscita 3")

    def test_a_il_file_dei_commenti_si_cancella_prima_della_decisione(self):
        i_rm = self._indice(lambda r: re.search(r'rm -f "\$commenti"', r), 'rm -f "$commenti"')
        i_script = self._indice(lambda r: "collaudo-esito.sh" in r, "chiamata allo script")
        self.assertLess(i_rm, i_script)

    def test_b_lettura_fallita_commenti_non_leggibili_e_rosso(self):
        i_api = self._indice(lambda r: re.search(r"\bgh api\b.*/comments", r), "gh api …/comments")
        dopo = self.righe[i_api:]
        # Il ramo del fallimento: dalla riga di gh api fino al primo `exit`.
        i_exit = next((i for i, r in enumerate(dopo) if re.search(r"\bexit\b", r)), None)
        self.assertIsNotNone(i_exit, "nessun exit dopo la lettura dei commenti")
        ramo = "\n".join(dopo[: i_exit + 1])
        self.assertRegex(dopo[i_exit], r"\bexit 1\b")
        self.assertIn("gh pr comment", ramo, "il messaggio si pubblica")
        self.assertNotRegex(ramo, r"decisione=(nessun-verdetto|rimando)")
        # Il testo pubblicato e' quello che il ramo scrive in "$corpo"; l'annotazione
        # ::error non si pubblica sulla PR e puo' nominare le alternative.
        scrittura = re.search(r'printf .*?> "\$corpo"', ramo, re.S)
        self.assertIsNotNone(scrittura, 'il ramo non scrive il messaggio in "$corpo"')
        messaggio = scrittura.group(0)
        self.assertIn("Collaudo: commenti non leggibili", messaggio)
        # Il codice d'uscita di gh nel messaggio si misura eseguendo lo step
        # (test_b_lettura_fallita_commenti_non_leggibili), non dal nome di una variabile.
        self.assertNotIn("nessun verdetto", messaggio.lower())
        self.assertNotIn("tipo=", messaggio)


# --- 3. esecuzione dei frammenti run: del job pubblica -----------------------------

class TestEsecuzioneDelloStep(unittest.TestCase):

    def test_verdetto_scritto_si_pubblica_senza_chiamare_l_api(self):
        # Il caso del finding: l'API dei commenti fallirebbe, e il verdetto deve
        # uscire lo stesso. Dal #69 fallisce anche l'API dei job: il verdetto esce
        # comunque, e i commenti non si leggono. Dal 78bd1c7 con un verdetto
        # scritto non si chiama nessuna API, neanche quella dei job.
        for esito, trascorsi in (("success", 100), ("failure", CONFINE + 60)):
            for jobs_falliscono in (False, True):
                with self.subTest(esito=esito, trascorsi=trascorsi,
                                  jobs_falliscono=jobs_falliscono):
                    r = esegui_job(verdetto=TESTO_VERDETTO, esito=esito, trascorsi=trascorsi,
                                   api_fallisce=True, jobs_falliscono=jobs_falliscono)
                    self.assertEqual(r["api_commenti"], [], r["stdout"])
                    self.assertEqual(r["api_artefatti"], [], "download riuscito: l'API degli artifact non serve")
                    self.assertEqual(r["api"], [], "con un verdetto scritto nessuna API")
                    self.assertEqual(r["rc"], 0, r["stdout"])
                    self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                    self.assertIn(TESTO_VERDETTO, r["pubblicati"][0])
                    self.assertTrue(r["pubblicati"][0].startswith(
                        f"<!-- cantiere-collaudo tipo=verdetto sha={SHA} -->"))

    def test_timeout_senza_chiamare_l_api(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                r = esegui_job(verdetto=file_v, esito="failure", trascorsi=CONFINE,
                               api_fallisce=True)
                self.assertEqual(r["api_commenti"], [], r["stdout"])
                self.assertEqual(r["rc"], 1, r["stdout"])
                self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                self.assertIn(f"timeout dopo {BUDGET} minuti", r["pubblicati"][0])

    def test_b_lettura_fallita_commenti_non_leggibili(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                r = esegui_job(verdetto=file_v, esito="failure", trascorsi=100,
                               api_fallisce=True)
                self.assertEqual(len(r["api_commenti"]), 1, r["stdout"])
                self.assertEqual(r["rc"], 1, "rosso")
                self.assertEqual(len(r["pubblicati"]), 1,
                                 f"un solo commento, quello dell'errore: {r['stdout']}")
                corpo = r["pubblicati"][0]
                self.assertIn("Collaudo: commenti non leggibili", corpo)
                self.assertIn(f"uscita {USCITA_GH}", corpo, "codice d'uscita di gh")
                self.assertIn(f"`{CORTO}`", corpo)
                self.assertNotIn("nessun verdetto", corpo.lower())
                self.assertNotIn("tipo=verdetto", corpo)
                self.assertNotIn("tipo=rimando", corpo)

    def test_b_lettura_fallita_anche_con_commenti_json_lasciato_dall_agente(self):
        # Un commenti.json con un verdetto dello stesso SHA gia' in $RUNNER_TEMP
        # non deve trasformare la lettura fallita in un rimando.
        r = esegui_job(verdetto=ASSENTE, api_fallisce=True,
                       commenti_piantati="verdetto-stesso-sha.json")
        self.assertEqual(r["rc"], 1, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
        self.assertIn("Collaudo: commenti non leggibili", r["pubblicati"][0])
        self.assertNotIn(URL_STESSO_SHA, r["pubblicati"][0])

    def test_lettura_riuscita_rimando_verde(self):
        r = esegui_job(verdetto=ASSENTE, risposta="verdetto-stesso-sha.json")
        self.assertEqual(len(r["api_commenti"]), 1, r["stdout"])
        self.assertIn("--paginate", r["api_commenti"][0])
        self.assertIn("repos/OwnConsent/ownconsent-www/issues/99/comments", r["api_commenti"][0])
        self.assertEqual(r["rc"], 0, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1)
        self.assertIn(URL_STESSO_SHA, r["pubblicati"][0])
        self.assertTrue(r["pubblicati"][0].startswith(
            f"<!-- cantiere-collaudo tipo=rimando sha={SHA} -->"))

    def test_lettura_riuscita_nessun_verdetto_rosso(self):
        r = esegui_job(verdetto=VUOTO, risposta="vuoto.json")
        self.assertEqual(len(r["api_commenti"]), 1, r["stdout"])
        self.assertEqual(r["rc"], 1, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1)
        self.assertIn("nessun verdetto", r["pubblicati"][0].lower())


if __name__ == "__main__":
    unittest.main()
