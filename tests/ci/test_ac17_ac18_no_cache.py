"""AC17 e AC18 -- non applicabili in questo lotto (docs/spec/issue-25.json).

Entrambi i criteri si applicano solo "se il workflow usa una cache": "se
nessun log mostra il ripristino di una cache, AC17 e AC18 sono non
applicabili, e chi verifica lo dichiara" (spec, AC17).

ADR-0003, D4, prescrive esplicitamente l'assenza di cache in questo giro:
setup-node senza `cache`, con `package-manager-cache: false`; setup-go con
`cache: false`; golangci-lint-action con `skip-cache: true`; nessun uso di
`actions/cache`. Questo test verifica staticamente quella prescrizione (il
controllo H6 dell'ADR, eseguito qui invece che sul log di un'esecuzione) e,
se verificata, dichiara AC17 e AC18 non applicabili -- non li salta: se una
qualunque di queste asserzioni fallisse (il workflow avesse iniziato a usare
una cache), AC17 e AC18 tornerebbero applicabili e andrebbero verificati con
la procedura descritta nella spec (gh cache list / delete / rerun), che
questo lotto non esegue perche' distruttiva sullo stato condiviso.
"""
from __future__ import annotations

import unittest

from helpers import ci_workflow_path, find_steps, load_yaml, step_run_text


class TestAC17AC18NonApplicabiliSenzaCache(unittest.TestCase):
    def setUp(self):
        self.doc = load_yaml(ci_workflow_path())
        self.job = self.doc["jobs"]["ci"]
        self.steps = find_steps(self.job)
        self.testo = ci_workflow_path().read_text(encoding="utf-8")

    def test_setup_node_non_usa_cache(self):
        (step,) = [s for s in self.steps if s.get("uses", "").startswith("actions/setup-node")]
        with_ = step.get("with") or {}
        self.assertNotIn("cache", with_)
        self.assertEqual(with_.get("package-manager-cache"), False)

    def test_setup_go_ha_cache_disattivata(self):
        candidati = [s for s in self.steps if s.get("uses", "").startswith("actions/setup-go")]
        self.assertEqual(len(candidati), 1, "atteso un solo passo actions/setup-go")
        with_ = candidati[0].get("with") or {}
        self.assertEqual(with_.get("cache"), False)

    def test_golangci_lint_action_ha_skip_cache(self):
        candidati = [s for s in self.steps if s.get("uses", "").startswith("golangci/golangci-lint-action")]
        self.assertEqual(len(candidati), 1, "atteso un solo passo golangci-lint-action")
        with_ = candidati[0].get("with") or {}
        self.assertEqual(with_.get("skip-cache"), True)

    def test_nessun_uso_di_actions_cache(self):
        self.assertNotIn("actions/cache", self.testo)

    def test_dichiarazione_di_non_applicabilita(self):
        # Se tutte le asserzioni sopra passano, non esiste alcuna cache che
        # ci ripristini: AC17 e AC18 sono non applicabili in questo commit.
        self.assertTrue(True, "AC17 e AC18: non applicabili, nessuna cache in uso (ADR-0003 D4)")


if __name__ == "__main__":
    unittest.main()
