"""Provenienza di githooks/prepare-commit-msg e githooks/ruoli.

I due file sono una copia di OwnConsent/cantiere, template/githooks/. Il commento
in testa all'hook dice da quale commit: questo test lo prende in parola. Legge lo
SHA dal blocco di provenienza, scarica i due file da raw.githubusercontent.com a
quello SHA e li confronta con quelli di githooks/, togliendo dall'hook solo il
blocco di provenienza. githooks/ruoli non porta provenienza: si confronta intero.

Il blocco di provenienza e' un paragrafo solo del commento di testa dell'hook:
- sta fra la riga «#!» e la prima riga che non comincia con «#»;
- la riga prima e' un «#» da solo;
- comincia con la riga «# Provenienza:», l'unica del file;
- continua con righe che cominciano con «# »;
- finisce alla prima riga che e' un «#» da solo, compresa.
Un «#» di separazione dentro il blocco lo chiude li': il paragrafo che segue non
e' provenienza e resta nel confronto con la sorgente. Un blocco in qualunque altro
punto del file e' un errore: in mezzo al codice sarebbero righe dell'hook tolte
dal confronto.

I file si leggono a byte, senza tradurre i fine riga: un hook con fine riga CRLF
non e' identico alla sorgente, e il confronto lo deve dire.

Il confronto con la sorgente gira quando CI=true. In locale, senza CI, si salta
con un messaggio che lo dice. In CI un download fallito e' un test fallito, non
un salto. I test sul blocco e sul confronto a mutazione non usano la rete e
girano sempre.

La radice e' quella di helpers.ci_root(): CI_ROOT=<copia mutata> punta il test a
una copia di githooks/ senza toccare l'originale.
"""
from __future__ import annotations

import datetime
import os
import pathlib
import re
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from unittest import mock

from helpers import ci_root

REPOSITORY = "OwnConsent/cantiere"
RAW = "https://raw.githubusercontent.com/" + REPOSITORY + "/{sha}/template/githooks/{nome}"
INIZIO_BLOCCO = "# Provenienza:"
FINE_BLOCCO = "#"
SHA_RE = re.compile(r"\b[0-9a-f]{40}\b")
DATA_RE = re.compile(r"\b\d{2}/\d{2}/\d{4}\b")
TENTATIVI = 3
TIMEOUT_S = 30
ATTESA_S = 2


def leggi(nome: str) -> str:
    # a byte: read_text() traduce «\r\n» in «\n» e un hook CRLF risulterebbe identico
    return (ci_root() / "githooks" / nome).read_bytes().decode("utf-8")


def nuda(riga: str) -> str:
    return riga.rstrip("\r\n")


def dividi_provenienza(testo: str) -> tuple[str, str]:
    """Restituisce (blocco di provenienza, testo senza il blocco)."""
    righe = testo.splitlines(keepends=True)
    inizi = [i for i, r in enumerate(righe) if r.startswith(INIZIO_BLOCCO)]
    if len(inizi) != 1:
        raise ValueError(
            f"attesa una sola riga che comincia con «{INIZIO_BLOCCO}», trovate {len(inizi)}"
        )
    inizio = inizi[0]
    if not righe[0].startswith("#!") or not all(r.startswith("#") for r in righe[1:inizio]):
        raise ValueError(
            f"riga {inizio + 1}: il blocco di provenienza non sta nel commento di testa del file"
        )
    if nuda(righe[inizio - 1]) != FINE_BLOCCO:
        raise ValueError(
            f"riga {inizio + 1}: il blocco di provenienza non apre un paragrafo, "
            "la riga prima non e' un «#» da solo"
        )
    for fine in range(inizio + 1, len(righe)):
        if nuda(righe[fine]) == FINE_BLOCCO:
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


def data_della_copia(blocco: str) -> datetime.date:
    """La data gg/mm/aaaa del blocco: una sola, e deve esistere nel calendario."""
    trovate = DATA_RE.findall(blocco)
    if len(trovate) != 1:
        raise ValueError(f"attesa una data gg/mm/aaaa nel blocco di provenienza, trovate {len(trovate)}")
    return datetime.datetime.strptime(trovate[0], "%d/%m/%Y").date()


def scarica(sha: str, nome: str) -> str:
    url = RAW.format(sha=sha, nome=nome)
    ultimo = None
    for tentativo in range(TENTATIVI):
        if tentativo:
            time.sleep(ATTESA_S * 2 ** (tentativo - 1))
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
        self.assertIsInstance(data_della_copia(self.blocco), datetime.date)

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


class TestConfineDelBlocco(unittest.TestCase):
    """Il blocco tolto dal confronto e' un paragrafo del commento di testa, e basta."""

    def setUp(self):
        self.hook = leggi("prepare-commit-msg")
        self.blocco, self.senza = dividi_provenienza(self.hook)
        self.righe_blocco = self.blocco.splitlines(keepends=True)
        self.righe_senza = self.senza.splitlines(keepends=True)

    def con_blocco_dopo(self, prefisso: str, blocco: list[str] | None = None) -> str:
        """L'hook con il blocco spostato dopo la prima riga che comincia con prefisso."""
        dove = [i for i, r in enumerate(self.righe_senza) if r.startswith(prefisso)]
        self.assertEqual(len(dove), 1, prefisso)
        taglio = dove[0] + 1
        return "".join(
            self.righe_senza[:taglio] + (blocco or self.righe_blocco) + self.righe_senza[taglio:]
        )

    def test_un_blocco_dentro_l_heredoc_python_e_rifiutato(self):
        with self.assertRaisesRegex(ValueError, "commento di testa"):
            dividi_provenienza(self.con_blocco_dopo("import os, re"))

    def test_righe_di_commento_in_mezzo_al_codice_non_escono_dal_confronto(self):
        finto = [self.righe_blocco[0], '# [ -n "$AGENTE" ] || exit 0\n', "#\n"]
        with self.assertRaisesRegex(ValueError, "commento di testa"):
            dividi_provenienza(self.con_blocco_dopo("set -uo pipefail", finto))

    def test_un_blocco_che_non_apre_un_paragrafo_e_rifiutato(self):
        with self.assertRaisesRegex(ValueError, "non apre un paragrafo"):
            dividi_provenienza(self.con_blocco_dopo("# Storia:"))

    def test_un_cancelletto_dentro_il_blocco_lo_chiude_e_il_resto_resta_nel_confronto(self):
        mutato = self.hook.replace(self.blocco, "".join(self.righe_blocco[:3] + ["#\n"] + self.righe_blocco[3:]))
        blocco, senza = dividi_provenienza(mutato)
        self.assertEqual(blocco, "".join(self.righe_blocco[:3] + ["#\n"]))
        self.assertIn("".join(self.righe_blocco[3:]), senza)
        self.assertNotEqual(senza, self.senza)

    def test_con_fine_riga_crlf_il_blocco_si_trova_e_il_resto_non_e_piu_identico(self):
        crlf = self.hook.replace("\n", "\r\n")
        blocco, senza = dividi_provenienza(crlf)
        self.assertEqual(blocco, self.blocco.replace("\n", "\r\n"))
        self.assertNotEqual(senza, self.senza)

    def test_leggi_non_traduce_i_fine_riga(self):
        with tempfile.TemporaryDirectory() as radice:
            (pathlib.Path(radice) / "githooks").mkdir()
            (pathlib.Path(radice) / "githooks" / "ruoli").write_bytes(b"backend\r\nfrontend\r\n")
            with mock.patch.dict(os.environ, {"CI_ROOT": radice}):
                self.assertEqual(leggi("ruoli"), "backend\r\nfrontend\r\n")


class TestDataDellaCopia(unittest.TestCase):
    def test_una_data_vera(self):
        self.assertEqual(data_della_copia("# copiati il\n# 03/10/2026. Il"), datetime.date(2026, 10, 3))

    def test_date_che_non_esistono(self):
        for data in ("99/99/9999", "31/02/2026", "00/00/0000", "03/13/2026"):
            with self.subTest(data=data), self.assertRaises(ValueError):
                data_della_copia(f"# copiati il {data}.")

    def test_formati_diversi_da_gg_mm_aaaa(self):
        for data in ("2026-10-03", "3/10/2026", "03/10/26", "03.10.2026", "03/10"):
            with self.subTest(data=data), self.assertRaises(ValueError):
                data_della_copia(f"# copiati il {data}.")

    def test_due_date(self):
        with self.assertRaises(ValueError):
            data_della_copia("# copiati il 03/10/2026, poi il 04/10/2026.")


class TestTentativiDiDownload(unittest.TestCase):
    """Senza rete: urlopen e sleep sono sostituiti."""

    class Risposta:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self):
            return b"contenuto\n"

    def scarica_con(self, esiti):
        esiti = iter(esiti)

        def urlopen(url, timeout):
            esito = next(esiti)
            if isinstance(esito, Exception):
                raise esito
            return esito

        with mock.patch.object(urllib.request, "urlopen", urlopen), \
                mock.patch.object(time, "sleep") as attesa:
            try:
                return scarica("0" * 40, "ruoli"), [c.args[0] for c in attesa.call_args_list]
            except RuntimeError as errore:
                return errore, [c.args[0] for c in attesa.call_args_list]

    def test_fra_un_tentativo_e_l_altro_si_aspetta_e_l_attesa_cresce(self):
        giu = urllib.error.URLError("503")
        esito, attese = self.scarica_con([giu, giu, giu])
        self.assertIsInstance(esito, RuntimeError)
        self.assertEqual(attese, [ATTESA_S, ATTESA_S * 2])

    def test_riuscito_al_terzo_tentativo(self):
        giu = urllib.error.URLError("503")
        esito, attese = self.scarica_con([giu, giu, self.Risposta()])
        self.assertEqual(esito, "contenuto\n")
        self.assertEqual(len(attese), 2)

    def test_riuscito_al_primo_tentativo_non_aspetta(self):
        esito, attese = self.scarica_con([self.Risposta()])
        self.assertEqual(esito, "contenuto\n")
        self.assertEqual(attese, [])


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
