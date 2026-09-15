"""AC8 e AC9 -- solo la parte statica (docs/spec/issue-25.json).

AC8: "il log mostra l'esecuzione di go build ./..., di golangci-lint run e di
go test con -race su ./...; la riga di comando di go test contiene -race e non
contiene ne' -p 1 ne' -p=1" -> i tre passi esistono nel workflow, in
quell'ordine, condizionati su `steps.rilevamento.outputs.api == 'presente'`.

AC9: "commit che rompono una cosa sola ciascuno: (a) build... (b) lint...
(c) test... (d) race" -> i passi di build, lint e test sono step distinti (un
fallimento in uno non si confonde con un altro): build usa `run:`, lint usa
un'action dedicata (golangci-lint-action), test usa `run:` con -race.

La parte dinamica (i commit che rompono ciascun passo, eseguiti davvero, e la
riga «WARNING: DATA RACE» del caso (d)) richiede GitHub: vedi
.work/issue-25/prove/procedure.md. Il dettaglio dei flag di go test (AC19) e'
in test_ac19_go_test_flags.py.
"""
from __future__ import annotations

import unittest

from helpers import ci_workflow_path, find_steps, load_yaml, step_run_text

API_IF = "steps.rilevamento.outputs.api == 'presente'"


def _ci_job():
    doc = load_yaml(ci_workflow_path())
    return doc["jobs"]["ci"]


class TestAC08OrdinePassiApi(unittest.TestCase):
    def setUp(self):
        self.steps = find_steps(_ci_job())
        build_matches = [s for s in self.steps if step_run_text(s).strip() == "go build ./..."]
        lint_matches = [s for s in self.steps if s.get("uses", "").startswith("golangci/golangci-lint-action")]
        test_matches = [s for s in self.steps if "go test" in step_run_text(s)]
        assert len(build_matches) == 1, f"atteso un solo passo 'go build ./...', trovati {len(build_matches)}"
        assert len(lint_matches) == 1, f"atteso un solo passo golangci-lint-action, trovati {len(lint_matches)}"
        assert len(test_matches) == 1, f"atteso un solo passo go test, trovati {len(test_matches)}"
        self.build = build_matches[0]
        self.lint = lint_matches[0]
        self.test = test_matches[0]

    def test_i_tre_passi_sono_nellordine_build_lint_test(self):
        indici = [self.steps.index(s) for s in (self.build, self.lint, self.test)]
        self.assertEqual(indici, sorted(indici), "build, lint, test devono comparire in quest'ordine")

    def test_ciascun_passo_e_condizionato_su_api_presente(self):
        for step in (self.build, self.lint, self.test):
            self.assertEqual(step.get("if"), API_IF, f"passo senza il giusto if: {step.get('name')}")

    def test_build_e_test_girano_in_api(self):
        self.assertEqual(self.build.get("working-directory"), "api")
        self.assertEqual(self.test.get("working-directory"), "api")

    def test_lint_usa_working_directory_api_nellinput_dellaction(self):
        self.assertEqual((self.lint.get("with") or {}).get("working-directory"), "api")

    def test_test_contiene_race(self):
        self.assertIn("-race", step_run_text(self.test))


class TestAC09PassiIsolati(unittest.TestCase):
    """I tre passi sono meccanismi distinti: un fallimento in uno (build, lint,
    test, o la data race del caso (d), che sta comunque nel passo di test) non
    si confonde con un altro."""

    def setUp(self):
        self.steps = find_steps(_ci_job())

    def test_build_e_un_comando_a_se_che_non_include_test_o_lint(self):
        (build,) = [s for s in self.steps if step_run_text(s).strip() == "go build ./..."]
        self.assertNotIn("go test", step_run_text(build))

    def test_test_e_un_comando_a_se_che_non_richiama_build(self):
        (test_step,) = [s for s in self.steps if "go test" in step_run_text(s)]
        self.assertNotIn("go build", step_run_text(test_step))

    def test_lint_e_unaction_separata_non_un_comando_shell(self):
        (lint,) = [s for s in self.steps if s.get("uses", "").startswith("golangci/golangci-lint-action")]
        self.assertNotIn("run", lint)


if __name__ == "__main__":
    unittest.main()
