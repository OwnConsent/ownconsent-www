"""AC20 -- docs/spec/issue-25.json.

"docs/DEFINITION-OF-DONE.md su main dopo il merge... contiene il nome del
contesto scritto `ci`, fra backtick, in una frase che dice che build, lint,
typecheck e test di una PR sono quelli verificati da quel contesto; non
contiene nessuna di queste stringhe: pnpm install, pnpm build, pnpm lint,
astro check, go build, go test, golangci-lint."
"""
from __future__ import annotations

import re
import unittest

from helpers import dod_path

STRINGHE_VIETATE = (
    "pnpm install",
    "pnpm build",
    "pnpm lint",
    "astro check",
    "go build",
    "go test",
    "golangci-lint",
)


class TestAC20DefinitionOfDoneRimandaACi(unittest.TestCase):
    def setUp(self):
        self.testo = dod_path().read_text(encoding="utf-8")

    def test_contiene_ci_fra_backtick(self):
        self.assertIsNotNone(re.search(r"`ci`", self.testo), "nessuna occorrenza di `ci` fra backtick")

    def test_la_frase_con_ci_parla_di_build_lint_typecheck_test(self):
        # «frase», non riga fisica: markdown va a capo dentro la stessa frase,
        # quindi il confronto e' per paragrafo (blocco separato da riga vuota),
        # come lo intende la spec (AC20, "allora"): il nome del contesto e le
        # quattro parole compaiono nello stesso paragrafo.
        paragrafi = [p for p in self.testo.split("\n\n") if "`ci`" in p]
        self.assertTrue(paragrafi, "nessun paragrafo contiene `ci`")
        trovata = any(
            all(parola in paragrafo.lower() for parola in ("build", "lint", "typecheck", "test"))
            for paragrafo in paragrafi
        )
        self.assertTrue(
            trovata,
            f"nessun paragrafo con `ci` menziona insieme build, lint, typecheck e test: {paragrafi}",
        )

    def test_nessuna_stringa_di_comando_ripetuta(self):
        for stringa in STRINGHE_VIETATE:
            self.assertNotIn(stringa, self.testo, f"trovata la stringa vietata: {stringa!r}")


if __name__ == "__main__":
    unittest.main()
