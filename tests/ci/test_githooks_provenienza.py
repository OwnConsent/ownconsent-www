"""Provenienza di githooks/prepare-commit-msg e githooks/ruoli.

I due file sono una copia di OwnConsent/cantiere, template/githooks/. Il commento
in testa all'hook dice da quale commit: questo test lo prende in parola. Legge lo
SHA dal blocco di provenienza, scarica i due file da raw.githubusercontent.com a
quello SHA e li confronta con quelli di githooks/, togliendo dall'hook solo il
blocco di provenienza. githooks/ruoli non porta provenienza: si confronta intero.

Il blocco di provenienza e': la riga che comincia con «# Provenienza:» e le righe
che la seguono, fino alla prima riga che e' un «#» da solo, compresa.

Il confronto con la sorgente gira quando CI=true. In locale, senza CI, si salta
con un messaggio che lo dice. In CI un download fallito e' un test fallito, non
un salto. I test sul blocco e sul confronto a mutazione non usano la rete e
girano sempre.

La radice e' quella di helpers.ci_root(): CI_ROOT=<copia mutata> punta il test a
una copia di githooks/ senza toccare l'originale.
"""
from __future__ import annotations

import os
import re
import unittest
import urllib.error
import urllib.request

from helpers import ci_root

REPOSITORY = "OwnConsent/cantiere"
RAW = "https://raw.githubusercontent.com/" + REPOSITORY + "/{sha}/template/githooks/{nome}"
INIZIO_BLOCCO = "# Provenienza:"
FINE_BLOCCO = "#"
SHA_RE = re.compile(r"\b[0-9a-f]{40}\b")
DATA_RE = re.compile(r"\b\d{2}/\d{2}/\d{4}\b")
TENTATIVI = 3
TIMEOUT_S = 30


def leggi(nome: str) -> str:
    return (ci_root() / "githooks" / nome).read_text(encoding="utf-8")


def dividi_provenienza(testo: str) -> tuple[str, str]:
    """Restituisce (blocco di provenienza, testo senza il blocco)."""
    righe = testo.splitlines(keepends=True)
    inizi = [i for i, r in enumerate(righe) if r.startswith(INIZIO_BLOCCO)]
    if len(inizi) != 1:
        raise ValueError(
            f"attesa una sola riga che comincia con «{INIZIO_BLOCCO}», trovate {len(inizi)}"
        )
    inizio = inizi[0]
    for fine in range(inizio + 1, len(righe)):
        if righe[fine].rstrip("\n") == FINE_BLOCCO:
            break
        if not righe[fine].startswith("# "):
            raise ValueError(
                f"riga {fine + 1}: il blocco di provenienza non e' chiuso da un «#» da solo"
            )
    else:
        raise ValueError("il blocco di provenienza arriva alla fine del file")
    return "".join(righe[inizio : fine + 1]), "".join(righe[:inizio] + righe[fine + 1 :])


def sha_di_provenienza(blocco: str) -> str:
    trovati = SHA_RE.findall(blocco)
    if len(trovati) != 1:
        raise ValueError(f"atteso uno SHA di 40 cifre nel blocco di provenienza, trovati {len(trovati)}")
    return trovati[0]


def scarica(sha: str, nome: str) -> str:
    url = RAW.format(sha=sha, nome=nome)
    ultimo = None
    for _ in range(TENTATIVI):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT_S) as risposta:
                return risposta.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError, OSError) as errore:
            ultimo = errore
    raise RuntimeError(f"download fallito dopo {TENTATIVI} tentativi: {url}: {ultimo!r}")


class TestBloccoDiProvenienza(unittest.TestCase):
    def setUp(self):
        self.hook = leggi("prepare-commit-msg")
        self.blocco, self.senza = dividi_provenienza(self.hook)

    def test_nomina_il_repository(self):
        self.assertIn(REPOSITORY, self.blocco)

    def test_porta_uno_sha_completo(self):
        self.assertRegex(sha_di_provenienza(self.blocco), r"^[0-9a-f]{40}$")

    def test_porta_la_data_della_copia(self):
        self.assertRegex(self.blocco, DATA_RE)

    def test_il_blocco_e_solo_commento(self):
        for riga in self.blocco.splitlines():
            self.assertTrue(riga.startswith("#"), riga)

    def test_si_toglie_solo_il_blocco(self):
        self.assertEqual(len(self.hook), len(self.blocco) + len(self.senza))
        self.assertNotIn(INIZIO_BLOCCO, self.senza)
        self.assertTrue(self.senza.startswith("#!"))

    def test_una_riga_cambiata_fuori_dal_blocco_resta_nel_confronto(self):
        righe = self.hook.splitlines(keepends=True)
        mutato = "".join(righe[:-1] + ["# riga cambiata\n"])
        self.assertNotEqual(dividi_provenienza(mutato)[1], self.senza)


class TestIdenticiAllaSorgente(unittest.TestCase):
    def setUp(self):
        if os.environ.get("CI") != "true":
            self.skipTest(
                "SALTATO: CI non vale «true». Il confronto di githooks/ con "
                + REPOSITORY
                + " scarica i file dalla rete e gira solo in CI; in locale si lancia "
                "con CI=true. Questo salto NON dice che i file sono identici alla sorgente."
            )
        self.blocco, self.senza = dividi_provenienza(leggi("prepare-commit-msg"))
        self.sha = sha_di_provenienza(self.blocco)

    def sorgente(self, nome: str) -> str:
        try:
            return scarica(self.sha, nome)
        except RuntimeError as errore:
            self.fail(f"SORGENTE NON SCARICATA, confronto non eseguito: {errore}")

    def test_prepare_commit_msg_identico_tolta_la_provenienza(self):
        self.assertEqual(self.senza, self.sorgente("prepare-commit-msg"))

    def test_ruoli_identico(self):
        self.assertEqual(leggi("ruoli"), self.sorgente("ruoli"))


if __name__ == "__main__":
    unittest.main()
