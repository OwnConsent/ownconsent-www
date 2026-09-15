"""AC13 -- solo la parte statica (docs/spec/issue-25.json).

AC13: "il log contiene la versione di pnpm in uso, ed e' 12.4.1" -- osservabile
solo nel log di un'esecuzione reale contro un site/package.json con
"packageManager": "pnpm@12.4.1" (procedura in
.work/issue-25/prove/procedure.md, insieme alla parte dinamica di AC14).

Verifica qui la precondizione statica, ADR-0003 D5: pnpm arriva solo da
`corepack enable` dentro site/, mai da una versione letterale nel workflow
(niente pnpm/action-setup, nessuna chiave pnpm@X nel file).
"""
from __future__ import annotations

import re
import unittest

from helpers import ci_workflow_path, find_steps, load_yaml, step_run_text

SITE_IF = "steps.rilevamento.outputs.site == 'presente'"


class TestAC13PrecondizioneStaticaCorepack(unittest.TestCase):
    def setUp(self):
        doc = load_yaml(ci_workflow_path())
        job = doc["jobs"]["ci"]
        steps = find_steps(job)
        (self.pnpm_version_step,) = [
            s for s in steps if "corepack enable" in step_run_text(s) and "pnpm -v" in step_run_text(s)
        ]
        self.testo = ci_workflow_path().read_text(encoding="utf-8")

    def test_passo_corepack_condizionato_su_site_presente(self):
        self.assertEqual(self.pnpm_version_step.get("if"), SITE_IF)

    def test_passo_corepack_gira_in_site(self):
        self.assertEqual(self.pnpm_version_step.get("working-directory"), "site")

    def test_nessuna_action_pnpm_action_setup(self):
        self.assertNotIn("pnpm/action-setup", self.testo)

    def test_nessuna_versione_pnpm_letterale_nel_workflow(self):
        match = re.findall(r"pnpm@\S+", self.testo)
        self.assertEqual(match, [], f"versione di pnpm letterale trovata nel workflow: {match}")


if __name__ == "__main__":
    unittest.main()
