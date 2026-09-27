"""Collaudo: che cosa pubblica il job quando il ventaglio e' finito — #8.

Oggetto sotto test:
  - .github/scripts/collaudo-esito.sh (comportamento, eseguito con bash);
  - .github/workflows/claude-pr-review.yml (forma statica).

Criteri di accettazione: la tabella e le regole di Andrea nel brief della PR
collaudo-rimando-sha (decisione in journal/2026-09-26/221518-andrea-decisione.json
e journal/2026-09-27/112845-andrea-decisione.json):

    | file verdetto | step agente | verdetto stesso SHA | commento            | job   |
    | non vuoto     | qualsiasi   | —                   | verdetto + intest.  | oggi  |
    | vuoto/assente | timeout     | —                   | «timeout dopo N m.» | rosso |
    | vuoto/assente | non timeout | si'                 | rimando col link    | verde |
    | vuoto/assente | non timeout | no                  | «nessun verdetto»   | rosso |

    Timeout = esito dello step != success E trascorsi >= budget*60.
    Conta come verdetto precedente solo un commento di github-actions[bot] con
    tipo=verdetto e SHA identico; un rimando non e' mai un verdetto; i commenti
    senza marcatore non contano; la lettura e' paginata; il timeout prevale.

Il colore del job lo sceglie il workflow dalla parola stampata dallo script:
qui si verifica la parola e il CORPO; la corrispondenza parola -> exit del passo
e' nei test statici.

Lo script si risolve da ci_root(): con CI_ROOT=<copia> si collauda una copia
mutata (prove-by-reversion) senza toccare l'originale. Le fixture invece si
leggono sempre accanto a questo file: sono dati del test, non oggetto sotto test.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import tempfile
import unittest

from helpers import ci_root, find_steps, load_yaml, on_triggers, workflow_dir

FIXTURE = pathlib.Path(__file__).resolve().parent / "fixtures" / "collaudo-esito"

SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
CORTO = SHA[:7]
AUTORE = "github-actions[bot]"
URL_STESSO_SHA = "https://github.com/OwnConsent/ownconsent-www/pull/99#issuecomment-1002"
URL_SECONDA_PAGINA = "https://github.com/OwnConsent/ownconsent-www/pull/99#issuecomment-3002"
BUDGET = 30
CONFINE = BUDGET * 60

MARCATORE_VERDETTO = f"<!-- cantiere-collaudo tipo=verdetto sha={SHA} -->"
MARCATORE_RIMANDO = f"<!-- cantiere-collaudo tipo=rimando sha={SHA} -->"

ASSENTE, VUOTO = "assente", "vuoto"


def script_path() -> pathlib.Path:
    return ci_root() / ".github" / "scripts" / "collaudo-esito.sh"


def esegui(commenti, *, verdetto=ASSENTE, esito="failure", trascorsi=100,
           budget=BUDGET, sha=SHA, argomenti=None):
    """Esegue lo script. `commenti`: nome di fixture o percorso assoluto.
    `verdetto`: ASSENTE, VUOTO oppure il testo del file.
    Ritorna (returncode, parola, corpo, stderr)."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        f_verdetto = tmp / "verdetto.md"
        if verdetto == VUOTO:
            f_verdetto.write_text("", encoding="utf-8")
        elif verdetto != ASSENTE:
            f_verdetto.write_text(verdetto, encoding="utf-8")
        f_commenti = pathlib.Path(commenti)
        if not f_commenti.is_absolute():
            f_commenti = FIXTURE / commenti
        f_corpo = tmp / "corpo.md"
        if argomenti is None:
            argomenti = [str(f_verdetto), sha, str(f_commenti), esito,
                         str(trascorsi), str(budget), str(f_corpo)]
        p = subprocess.run(["bash", str(script_path()), *argomenti],
                           capture_output=True, text=True, timeout=60)
        corpo = f_corpo.read_text(encoding="utf-8") if f_corpo.exists() else None
        return p.returncode, p.stdout.strip(), corpo, p.stderr


TESTO_VERDETTO = "## Collaudo — run 1, tentativo 1\n\nNessun finding.\n"


class TestTabella(unittest.TestCase):
    """Una prova per ogni riga della tabella."""

    def _intestazione(self, corpo, marcatore):
        self.assertIsNotNone(corpo)
        righe = corpo.split("\n")
        self.assertEqual(righe[0], marcatore, "il marcatore sta nel PRIMO rigo")
        self.assertIn(f"`{CORTO}`", corpo, "SHA corto visibile")
        self.assertNotIn(SHA, "\n".join(righe[1:]),
                         "fuori dal marcatore si vede lo SHA corto, non quello intero")

    def test_riga1_verdetto_esito_success(self):
        rc, parola, corpo, err = esegui("vuoto.json", verdetto=TESTO_VERDETTO,
                                        esito="success", trascorsi=100)
        self.assertEqual((rc, parola), (0, "verdetto"), err)
        self._intestazione(corpo, MARCATORE_VERDETTO)

    def test_riga1_verdetto_esito_failure_oltre_il_budget(self):
        # Un verdetto scritto vince anche su un ventaglio che ha superato il budget.
        rc, parola, corpo, err = esegui("vuoto.json", verdetto=TESTO_VERDETTO,
                                        esito="failure", trascorsi=CONFINE + 120)
        self.assertEqual((rc, parola), (0, "verdetto"), err)
        self._intestazione(corpo, MARCATORE_VERDETTO)

    def test_riga1_verdetto_anche_con_verdetto_precedente_stesso_sha(self):
        rc, parola, corpo, err = esegui("verdetto-stesso-sha.json",
                                        verdetto=TESTO_VERDETTO, esito="success")
        self.assertEqual((rc, parola), (0, "verdetto"), err)
        self._intestazione(corpo, MARCATORE_VERDETTO)

    def test_riga2_timeout(self):
        for file_v in (ASSENTE, VUOTO):
            for esito in ("failure", "cancelled"):
                with self.subTest(file_verdetto=file_v, esito=esito):
                    rc, parola, corpo, err = esegui("vuoto.json", verdetto=file_v,
                                                    esito=esito, trascorsi=CONFINE)
                    self.assertEqual((rc, parola), (0, "timeout"), err)
                    self.assertIn(f"timeout dopo {BUDGET} minuti", corpo)
                    self.assertNotIn("nessun verdetto", corpo.lower())

    def test_riga3_rimando(self):
        for file_v in (ASSENTE, VUOTO):
            for esito, trascorsi in (("failure", 100), ("success", 100),
                                     ("success", CONFINE + 60)):
                with self.subTest(file_verdetto=file_v, esito=esito, trascorsi=trascorsi):
                    rc, parola, corpo, err = esegui("verdetto-stesso-sha.json",
                                                    verdetto=file_v, esito=esito,
                                                    trascorsi=trascorsi)
                    self.assertEqual((rc, parola), (0, "rimando"), err)
                    self._intestazione(corpo, MARCATORE_RIMANDO)
                    self.assertIn(URL_STESSO_SHA, corpo)
                    self.assertNotIn("tipo=verdetto", corpo)

    def test_riga4_nessun_verdetto(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                rc, parola, corpo, err = esegui("vuoto.json", verdetto=file_v,
                                                esito="failure", trascorsi=100)
                self.assertEqual((rc, parola), (0, "nessun-verdetto"), err)
                self.assertIn("nessun verdetto", corpo.lower())
                self.assertNotIn("tipo=verdetto", corpo,
                                 "un «nessun verdetto» non deve passare per verdetto al giro dopo")


class TestChiContaComeVerdettoPrecedente(unittest.TestCase):

    def _nessun(self, fixture):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(fixture=fixture, file_verdetto=file_v):
                rc, parola, _, err = esegui(fixture, verdetto=file_v,
                                            esito="failure", trascorsi=100)
                self.assertEqual((rc, parola), (0, "nessun-verdetto"), err)

    def test_rimando_precedente_stesso_sha_non_e_un_verdetto(self):
        self._nessun("rimando-stesso-sha.json")

    def test_verdetto_con_sha_diverso(self):
        self._nessun("verdetto-altro-sha.json")

    def test_verdetto_stesso_sha_di_un_altro_autore(self):
        # andreapernici, github-actions (senza [bot]), claude[bot],
        # github-actions[bot]-impostore: nessuno e' l'autore del job.
        self._nessun("verdetto-altro-autore.json")

    def test_commento_del_bot_senza_marcatore_come_su_64(self):
        self._nessun("bot-senza-marcatore-64.json")

    def test_marcatore_non_nel_primo_rigo_non_conta(self):
        # Regola dell'implementazione (commento del passo 3), coerente con
        # «intestazione nel primo rigo»: un marcatore citato non e' un verdetto.
        self._nessun("marcatore-citato.json")

    def test_lettura_paginata_verdetto_solo_nella_seconda_pagina(self):
        rc, parola, corpo, err = esegui("due-pagine.json", esito="failure", trascorsi=100)
        self.assertEqual((rc, parola), (0, "rimando"), err)
        self.assertIn(URL_SECONDA_PAGINA, corpo)

    def test_due_verdetti_stesso_sha_si_rimanda_al_piu_recente(self):
        # Non e' nella tabella: e' la regola dichiarata dallo script («si prende
        # il piu' recente»). La fixture li mette in ordine inverso.
        rc, parola, corpo, err = esegui("due-verdetti.json", esito="failure")
        self.assertEqual((rc, parola), (0, "rimando"), err)
        self.assertIn("#issuecomment-4002", corpo)
        self.assertNotIn("#issuecomment-4001", corpo)

    def test_marcatore_con_crlf_conta(self):
        rc, parola, corpo, err = esegui("verdetto-crlf.json", esito="failure")
        self.assertEqual((rc, parola), (0, "rimando"), err)
        self.assertIn("#issuecomment-5001", corpo)

    def test_ciclo_completo_col_corpo_scritto_dallo_script(self):
        """Il marcatore che lo script scrive e' quello che lo script legge.
        Giro 1: verdetto -> commento del bot. Giro 2 silenzioso -> rimando a
        quel commento. Giro 3 silenzioso, se sulla PR ci fosse solo il rimando
        -> nessun verdetto."""
        import json

        _, parola, corpo_v, _ = esegui("vuoto.json", verdetto=TESTO_VERDETTO, esito="success")
        self.assertEqual(parola, "verdetto")
        url_v = "https://example.invalid/pr/1#issuecomment-1"
        with tempfile.TemporaryDirectory() as tmp:
            f = pathlib.Path(tmp) / "commenti.json"
            f.write_text(json.dumps([{
                "user": {"login": AUTORE}, "body": corpo_v + TESTO_VERDETTO,
                "html_url": url_v, "created_at": "2026-09-27T10:00:00Z"}]),
                encoding="utf-8")
            _, parola, corpo_r, err = esegui(str(f), esito="failure")
            self.assertEqual(parola, "rimando", err)
            self.assertIn(url_v, corpo_r)
            f.write_text(json.dumps([{
                "user": {"login": AUTORE}, "body": corpo_r,
                "html_url": "https://example.invalid/pr/1#issuecomment-2",
                "created_at": "2026-09-27T11:00:00Z"}]), encoding="utf-8")
            _, parola, _, err = esegui(str(f), esito="failure")
            self.assertEqual(parola, "nessun-verdetto", err)


class TestConfineDelTimeout(unittest.TestCase):

    def test_trascorsi_uguale_al_budget_e_timeout(self):
        rc, parola, _, err = esegui("vuoto.json", esito="failure", trascorsi=CONFINE)
        self.assertEqual((rc, parola), (0, "timeout"), err)

    def test_un_secondo_prima_del_budget_non_e_timeout(self):
        for fixture, atteso in (("vuoto.json", "nessun-verdetto"),
                                ("verdetto-stesso-sha.json", "rimando")):
            with self.subTest(fixture=fixture):
                rc, parola, _, err = esegui(fixture, esito="failure", trascorsi=CONFINE - 1)
                self.assertEqual((rc, parola), (0, atteso), err)

    def test_il_confine_segue_il_budget_passato(self):
        rc, parola, _, err = esegui("vuoto.json", esito="failure", trascorsi=300, budget=5)
        self.assertEqual(parola, "timeout", err)
        rc, parola, _, err = esegui("vuoto.json", esito="failure", trascorsi=299, budget=5)
        self.assertEqual(parola, "nessun-verdetto", err)

    def test_timeout_prevale_sul_rimando(self):
        for file_v in (ASSENTE, VUOTO):
            with self.subTest(file_verdetto=file_v):
                rc, parola, corpo, err = esegui("verdetto-stesso-sha.json", verdetto=file_v,
                                                esito="failure", trascorsi=CONFINE)
                self.assertEqual((rc, parola), (0, "timeout"), err)
                self.assertNotIn(URL_STESSO_SHA, corpo)

    def test_esito_success_oltre_il_budget_non_e_timeout(self):
        for fixture, atteso in (("vuoto.json", "nessun-verdetto"),
                                ("verdetto-stesso-sha.json", "rimando")):
            for trascorsi in (CONFINE, CONFINE + 3600):
                with self.subTest(fixture=fixture, trascorsi=trascorsi):
                    rc, parola, _, err = esegui(fixture, esito="success", trascorsi=trascorsi)
                    self.assertEqual((rc, parola), (0, atteso), err)

    def test_corpo_del_timeout_riporta_i_minuti_misurati(self):
        # N e' misurato, non il budget: 2400 s su 30 min -> 40; 1925 s -> 32.
        for trascorsi, n in ((CONFINE, 30), (1925, 32), (2400, 40)):
            with self.subTest(trascorsi=trascorsi):
                rc, parola, corpo, err = esegui("vuoto.json", esito="failure",
                                                trascorsi=trascorsi)
                self.assertEqual(parola, "timeout", err)
                self.assertRegex(corpo, rf"timeout dopo {n} minuti\b")
                self.assertNotIn("nessun verdetto", corpo.lower())
                self.assertNotIn("tipo=verdetto", corpo)
                self.assertIn(f"`{CORTO}`", corpo)


class TestInputSbagliati(unittest.TestCase):

    def test_esce_2(self):
        casi = {
            "sha corto": dict(sha=CORTO),
            "sha maiuscolo": dict(sha=SHA.upper()),
            "sha vuoto": dict(sha=""),
            "trascorsi non numerico": dict(trascorsi="abc"),
            "trascorsi negativo": dict(trascorsi="-5"),
            "budget zero": dict(budget=0),
            "budget vuoto": dict(budget=""),
            "commenti non json": dict(commenti="non-json.json"),
        }
        for nome, kw in casi.items():
            with self.subTest(caso=nome):
                commenti = kw.pop("commenti", "vuoto.json")
                rc, parola, _, _ = esegui(commenti, **kw)
                self.assertEqual(rc, 2, f"{nome}: stdout={parola!r}")
                self.assertNotIn(parola, ("verdetto", "timeout", "rimando", "nessun-verdetto"))

    # COMMENTI mancante non e' piu' un input sbagliato (uscita 2): da 2eaf9b9 e'
    # la richiesta dei commenti (uscita 3). Si collauda in test_collaudo_commenti.py.

    def test_numero_di_argomenti_sbagliato(self):
        rc, _, _, _ = esegui("vuoto.json", argomenti=["a", "b", "c"])
        self.assertEqual(rc, 2)


# --- statica del workflow -------------------------------------------------------

def _review():
    doc = load_yaml(workflow_dir() / "claude-pr-review.yml")
    return doc, doc["jobs"]["verifica"]


def _argomenti_dello_script(run: str) -> list[str]:
    """Gli argomenti fra virgolette della chiamata a collaudo-esito.sh nel run."""
    chiamata = re.search(r'collaudo-esito\.sh"?((?:[^\n]*\\\n)*[^\n]*)', run)
    if chiamata is None:
        raise AssertionError("lo script non e' invocato dal passo di pubblicazione")
    return re.findall(r'"([^"]*)"', chiamata.group(1))


def _step(job, nome=None, id_=None):
    for s in find_steps(job):
        if (nome and s.get("name") == nome) or (id_ and s.get("id") == id_):
            return s
    raise AssertionError(f"step non trovato: name={nome!r} id={id_!r}")


class TestStaticaWorkflow(unittest.TestCase):

    def setUp(self):
        self.doc, self.job = _review()
        self.pubblica = _step(self.job, nome="Pubblica il verdetto")

    def test_budget_intero_definito_dal_job(self):
        v = (self.job.get("env") or {}).get("BUDGET_VENTAGLIO_MIN")
        self.assertIsInstance(v, int)
        self.assertNotIsInstance(v, bool)
        self.assertGreater(v, 0)

    def test_timeout_dello_step_ventaglio_legge_il_budget(self):
        tm = _step(self.job, id_="ventaglio").get("timeout-minutes")
        self.assertIsInstance(tm, str)
        self.assertRegex(tm, r"^\$\{\{\s*fromJSON\(\s*env\.BUDGET_VENTAGLIO_MIN\s*\)\s*\}\}$")

    def test_fonte_unica_del_budget(self):
        # Il passo di pubblicazione passa $BUDGET_VENTAGLIO_MIN allo script e non
        # lo ridefinisce; nessun altro step lo ridefinisce.
        argomenti = _argomenti_dello_script(self.pubblica.get("run", ""))
        self.assertEqual(len(argomenti), 7, argomenti)
        self.assertEqual(argomenti[5], "$BUDGET_VENTAGLIO_MIN", "BUDGET_MIN e' il sesto argomento")
        for s in find_steps(self.job):
            self.assertNotIn("BUDGET_VENTAGLIO_MIN", s.get("env") or {}, s.get("name"))
        self.assertNotIn("BUDGET_VENTAGLIO_MIN", self.doc.get("env") or {})

    def test_timeout_del_job_35_e_sopra_il_budget(self):
        self.assertEqual(self.job.get("timeout-minutes"), 35)
        self.assertGreater(self.job["timeout-minutes"], self.job["env"]["BUDGET_VENTAGLIO_MIN"])

    def test_pubblica_gira_se_non_cancellato(self):
        self.assertEqual(self.pubblica.get("if"), "${{ !cancelled() }}")

    def test_sha_e_l_head_della_pr(self):
        env = self.pubblica.get("env") or {}
        self.assertEqual(env.get("SHA"), "${{ github.event.pull_request.head.sha }}")
        self.assertNotIn("github.sha", str(env) + self.pubblica.get("run", ""))
        self.assertEqual(_argomenti_dello_script(self.pubblica["run"])[1], "$SHA")

    def test_commenti_letti_con_paginate(self):
        run = self.pubblica.get("run", "")
        righe = [r for r in run.splitlines() if "gh api" in r and "/comments" in r]
        self.assertTrue(righe, "nessuna lettura dei commenti")
        for r in righe:
            self.assertIn("--paginate", r)

    def test_parola_dello_script_e_colore_del_passo(self):
        # rimando -> exit 0 (verde); timeout e nessun-verdetto -> exit 1 (rosso).
        run = self.pubblica.get("run", "")
        m = re.search(r"case \"\$decisione\" in(.*?)esac", run, re.S)
        self.assertIsNotNone(m)
        rami = dict(re.findall(r"^\s*([\w*-]+)\)(.*?);;", m.group(1), re.S | re.M))
        self.assertIn("exit 0", rami.get("rimando", ""))
        self.assertIn("exit 1", rami.get("timeout", ""))
        self.assertIn("exit 1", rami.get("*", ""))

    def test_script_copiato_fuori_dal_workspace_prima_del_ventaglio(self):
        passi = find_steps(self.job)
        nomi = [s.get("name") or s.get("id") for s in passi]
        i_cp = next(i for i, s in enumerate(passi)
                    if "collaudo-esito.sh" in s.get("run", "") and "cp " in s.get("run", ""))
        i_v = next(i for i, s in enumerate(passi) if s.get("id") == "ventaglio")
        self.assertLess(i_cp, i_v, nomi)
        self.assertIn('"$RUNNER_TEMP/collaudo-esito.sh"', self.pubblica.get("run", ""))

    def test_trigger_invariato(self):
        on = on_triggers(self.doc)
        self.assertEqual(set(on), {"pull_request"})
        pr = on["pull_request"]
        self.assertEqual(pr.get("types"), ["opened", "ready_for_review", "reopened"])
        self.assertNotIn("synchronize", pr.get("types"))


if __name__ == "__main__":
    unittest.main()
