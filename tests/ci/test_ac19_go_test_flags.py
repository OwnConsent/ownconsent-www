"""AC19 -- docs/spec/issue-25.json.

"ci esegue go test -race -count=1 -v ./...: con -v le righe --- SKIP
compaiono nel log" (ADR-0003, D8) e "nell'output di go test nessun pacchetto
e' riportato come (cached): ogni pacchetto con test mostra un tempo di
esecuzione" (spec, AC19, che aggiunge: "la riga di comando di go test... non
contiene ne' -p 1 ne' -p=1").

La parte "nessun (cached)" e' garantita da -count=1 (misura di ADR-0003:
"Da sola, -race non esclude la cache dei risultati dei test... -count=1" la
disabilita esplicitamente) e si osserva per intero solo nel log di
un'esecuzione reale rilanciata due volte (procedura in
.work/issue-25/prove/procedure.md, gia' notata come esercitabile "con la PR
di prova di AC8"). Questo test verifica staticamente la riga di comando.
"""
from __future__ import annotations

import re
import unittest

from helpers import ci_workflow_path, find_steps, load_yaml, step_run_text


class TestAC19FlagDiGoTest(unittest.TestCase):
    def setUp(self):
        doc = load_yaml(ci_workflow_path())
        job = doc["jobs"]["ci"]
        (self.test_step,) = [s for s in find_steps(job) if "go test" in step_run_text(s)]
        self.comando = step_run_text(self.test_step)

    def test_contiene_race(self):
        self.assertIn("-race", self.comando)

    def test_contiene_count_1(self):
        self.assertIn("-count=1", self.comando)

    def test_contiene_percorso_tutti_i_pacchetti(self):
        self.assertIn("./...", self.comando)

    def test_non_contiene_p_1_con_spazio(self):
        self.assertIsNone(re.search(r"(^|\s)-p\s+1(\s|$)", self.comando))

    def test_non_contiene_p_1_con_uguale(self):
        self.assertNotIn("-p=1", self.comando)

    def test_non_contiene_short(self):
        self.assertNotIn("-short", self.comando)


if __name__ == "__main__":
    unittest.main()
