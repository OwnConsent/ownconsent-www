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
  3. OLTRE lo statico, dichiarato: il frammento `run:` dello step, ESTRATTO dal
     YAML e non riscritto, eseguito con `bash -e` (la shell di GitHub per uno
     step senza `shell:` su ubuntu) e con un `gh` finto in PATH che registra le
     chiamate e, a comando, fa fallire `gh api`. Lo script collaudo-esito.sh
     posato in $RUNNER_TEMP e' quello di ci_root(), come fa il passo «Prepara».

Tutto si risolve da ci_root(): con CI_ROOT=<copia> si collauda una copia (anche
un `git archive` di un commit precedente).
"""
from __future__ import annotations

import os
import pathlib
import re
import shutil
import stat
import subprocess
import tempfile
import unittest

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
    for s in find_steps(doc["jobs"]["verifica"]):
        if s.get("name") == "Pubblica il verdetto":
            return s
    raise AssertionError("step «Pubblica il verdetto» non trovato")


def _righe_codice(run: str) -> list[str]:
    """Righe del run senza i commenti shell a riga intera."""
    return [r for r in run.splitlines() if not r.lstrip().startswith("#")]


class TestStaticaLetturaDeiCommenti(unittest.TestCase):

    def setUp(self):
        self.righe = _righe_codice(_step_pubblica()["run"])

    def _indice(self, pred, cosa):
        for i, r in enumerate(self.righe):
            if pred(r):
                return i
        self.fail(f"nel run manca: {cosa}")

    def test_a_nessuna_lettura_dei_commenti_prima_della_decisione_sul_file(self):
        i_script = self._indice(lambda r: "collaudo-esito.sh" in r, "chiamata allo script")
        i_api = self._indice(lambda r: re.search(r"\bgh api\b.*/comments", r), "gh api …/comments")
        self.assertLess(i_script, i_api,
                        "gh api …/comments compare prima della chiamata allo script")
        prima = "\n".join(self.righe[:i_script])
        self.assertNotRegex(prima, r"\bgh\b", "nessun gh prima della decisione")

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


# --- 3. esecuzione del frammento run: ----------------------------------------------

GH_FINTO = r"""#!/usr/bin/env bash
# gh finto: registra ogni chiamata, una per riga, in $GH_LOG.
printf '%s\n' "$*" >> "$GH_LOG"
case "$1" in
  api)
    if [ -n "${GH_API_FALLISCE:-}" ]; then
      echo "HTTP 502: Bad Gateway" >&2
      exit "$GH_API_FALLISCE"
    fi
    cat "$GH_API_RISPOSTA"
    ;;
  pr)
    if [ "$2" = comment ]; then
      n=$(ls "$GH_PUBBLICATI" | wc -l)
      while [ "$#" -gt 0 ]; do
        if [ "$1" = --body-file ]; then cp "$2" "$GH_PUBBLICATI/$n.md"; fi
        shift
      done
      echo "https://example.invalid/pr/99#issuecomment-$((9000 + n))"
    fi
    ;;
esac
"""


def esegui_step(*, verdetto=ASSENTE, esito="failure", trascorsi=100,
                api_fallisce=False, risposta="vuoto.json", commenti_piantati=None):
    """Esegue il run: dello step «Pubblica il verdetto» cosi' com'e' nel YAML.
    Ritorna dict(rc, stdout, chiamate_gh, api, pubblicati)."""
    run = _step_pubblica()["run"]
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        ws, rt, binf, pub = tmp / "ws", tmp / "runner_temp", tmp / "bin", tmp / "pubblicati"
        for d in (ws / ".collaudo", rt, binf, pub):
            d.mkdir(parents=True)
        _verdetto(ws / ".collaudo", verdetto)
        shutil.copy(script_path(), rt / "collaudo-esito.sh")
        if commenti_piantati:
            shutil.copy(FIXTURE / commenti_piantati, rt / "commenti.json")
        gh = binf / "gh"
        gh.write_text(GH_FINTO, encoding="utf-8")
        gh.chmod(gh.stat().st_mode | stat.S_IXUSR)
        frammento = tmp / "step.sh"
        frammento.write_text(run, encoding="utf-8")
        log = tmp / "gh.log"
        log.touch()
        env = {
            "PATH": f"{binf}{os.pathsep}{os.environ['PATH']}",
            "HOME": str(tmp),
            "GITHUB_WORKSPACE": str(ws),
            "RUNNER_TEMP": str(rt),
            "GITHUB_REPOSITORY": "OwnConsent/ownconsent-www",
            "GITHUB_RUN_ATTEMPT": "1",
            "BUDGET_VENTAGLIO_MIN": str(BUDGET),
            "GH_TOKEN": "finto",
            "PR": "99",
            "ESITO_VENTAGLIO": esito,
            "LUNGO": "false",
            "ARTEFATTO_URL": "",
            "SHA": SHA,
            "INIZIO": "1000000",
            "FINE": str(1000000 + trascorsi),
            "GH_LOG": str(log),
            "GH_PUBBLICATI": str(pub),
            "GH_API_RISPOSTA": str(FIXTURE / risposta),
        }
        if api_fallisce:
            env["GH_API_FALLISCE"] = str(USCITA_GH)
        p = subprocess.run(["bash", "-e", str(frammento)], env=env, cwd=ws,
                           capture_output=True, text=True, timeout=60)
        chiamate = [r for r in log.read_text(encoding="utf-8").splitlines() if r]
        pubblicati = [f.read_text(encoding="utf-8")
                      for f in sorted(pub.iterdir(), key=lambda f: int(f.stem))]
        return dict(rc=p.returncode, stdout=p.stdout + p.stderr, chiamate_gh=chiamate,
                    api=[c for c in chiamate if c.startswith("api ")],
                    pubblicati=pubblicati)


class TestEsecuzioneDelloStep(unittest.TestCase):

    def test_verdetto_scritto_si_pubblica_senza_chiamare_l_api(self):
        # Il caso del finding: l'API fallirebbe, e il verdetto deve uscire lo stesso.
        for esito, trascorsi in (("success", 100), ("failure", CONFINE + 60)):
            with self.subTest(esito=esito, trascorsi=trascorsi):
                r = esegui_step(verdetto=TESTO_VERDETTO, esito=esito, trascorsi=trascorsi,
                                api_fallisce=True)
                self.assertEqual(r["api"], [], r["stdout"])
                self.assertEqual(r["rc"], 0, r["stdout"])
                self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                self.assertIn(TESTO_VERDETTO, r["pubblicati"][0])
                self.assertTrue(r["pubblicati"][0].startswith(
                    f"<!-- cantiere-collaudo tipo=verdetto sha={SHA} -->"))

    def test_timeout_senza_chiamare_l_api(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                r = esegui_step(verdetto=file_v, esito="failure", trascorsi=CONFINE,
                                api_fallisce=True)
                self.assertEqual(r["api"], [], r["stdout"])
                self.assertEqual(r["rc"], 1, r["stdout"])
                self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
                self.assertIn(f"timeout dopo {BUDGET} minuti", r["pubblicati"][0])

    def test_b_lettura_fallita_commenti_non_leggibili(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                r = esegui_step(verdetto=file_v, esito="failure", trascorsi=100,
                                api_fallisce=True)
                self.assertEqual(len(r["api"]), 1, r["stdout"])
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
        r = esegui_step(verdetto=ASSENTE, api_fallisce=True,
                        commenti_piantati="verdetto-stesso-sha.json")
        self.assertEqual(r["rc"], 1, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1, r["stdout"])
        self.assertIn("Collaudo: commenti non leggibili", r["pubblicati"][0])
        self.assertNotIn(URL_STESSO_SHA, r["pubblicati"][0])

    def test_lettura_riuscita_rimando_verde(self):
        r = esegui_step(verdetto=ASSENTE, risposta="verdetto-stesso-sha.json")
        self.assertEqual(len(r["api"]), 1, r["stdout"])
        self.assertIn("--paginate", r["api"][0])
        self.assertIn("repos/OwnConsent/ownconsent-www/issues/99/comments", r["api"][0])
        self.assertEqual(r["rc"], 0, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1)
        self.assertIn(URL_STESSO_SHA, r["pubblicati"][0])
        self.assertTrue(r["pubblicati"][0].startswith(
            f"<!-- cantiere-collaudo tipo=rimando sha={SHA} -->"))

    def test_lettura_riuscita_nessun_verdetto_rosso(self):
        r = esegui_step(verdetto=VUOTO, risposta="vuoto.json")
        self.assertEqual(len(r["api"]), 1, r["stdout"])
        self.assertEqual(r["rc"], 1, r["stdout"])
        self.assertEqual(len(r["pubblicati"]), 1)
        self.assertIn("nessun verdetto", r["pubblicati"][0].lower())


if __name__ == "__main__":
    unittest.main()
