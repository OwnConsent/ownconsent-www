"""AC6 e AC7 -- solo la parte statica (docs/spec/issue-25.json).

Questo lotto (CI3) non esegue il workflow: non puo' costruire un progetto
Astro reale ne' verificarne l'esecuzione. Verifica la parte statica ed
esercitabile localmente:

AC6: "il log mostra che sono stati eseguiti, nell'ordine, l'installazione
delle dipendenze di site/, la build, il lint e astro check" -> i quattro passi
esistono nel workflow, in quell'ordine, condizionati su
`steps.rilevamento.outputs.site == 'presente'`.

AC7: "quattro commit, ognuno dei quali rompe uno solo dei quattro passi...
Nel caso (a) site/pnpm-lock.yaml non viene riscritto per far passare
l'installazione" -> i quattro passi sono comandi distinti (un fallimento in
uno non si confonde con un altro), e l'installazione usa un lockfile
congelato (--frozen-lockfile), che e' cio' che impedisce la riscrittura del
lockfile nel caso (a).

La parte dinamica (i quattro commit che rompono ciascun passo, eseguiti
davvero) richiede GitHub: vedi .work/issue-25/prove/procedure.md.
"""
from __future__ import annotations

import unittest

from helpers import ci_workflow_path, find_steps, load_yaml, step_run_text

SITE_IF = "steps.rilevamento.outputs.site == 'presente'"


def _ci_job():
    doc = load_yaml(ci_workflow_path())
    return doc["jobs"]["ci"]


def _site_step(steps, predicate):
    matches = [s for s in steps if predicate(s)]
    assert len(matches) == 1, f"atteso un solo passo per il predicato, trovati {len(matches)}"
    return matches[0]


class TestAC06OrdinePassiSite(unittest.TestCase):
    def setUp(self):
        self.steps = find_steps(_ci_job())
        self.install = _site_step(self.steps, lambda s: "pnpm install" in step_run_text(s))
        self.build = _site_step(
            self.steps, lambda s: "pnpm build" in step_run_text(s) and "pnpm install" not in step_run_text(s)
        )
        self.lint = _site_step(
            self.steps, lambda s: "pnpm lint" in step_run_text(s) and "pnpm build" not in step_run_text(s)
        )
        self.astro_check = _site_step(
            self.steps, lambda s: "astro check" in step_run_text(s) and "pnpm lint" not in step_run_text(s)
        )

    def test_i_quattro_passi_esistono_e_sono_nellordine(self):
        indici = [self.steps.index(s) for s in (self.install, self.build, self.lint, self.astro_check)]
        self.assertEqual(indici, sorted(indici), "install, build, lint, astro check devono comparire in quest'ordine")

    def test_ciascun_passo_e_condizionato_su_site_presente(self):
        for step in (self.install, self.build, self.lint, self.astro_check):
            self.assertEqual(step.get("if"), SITE_IF, f"passo senza il giusto if: {step.get('name')}")

    def test_ciascun_passo_gira_in_site(self):
        for step in (self.install, self.build, self.lint, self.astro_check):
            self.assertEqual(step.get("working-directory"), "site", f"passo fuori da site/: {step.get('name')}")


class TestAC07PassiIsolatiELockfileCongelato(unittest.TestCase):
    def setUp(self):
        self.steps = find_steps(_ci_job())
        self.install = _site_step(self.steps, lambda s: "pnpm install" in step_run_text(s))
        self.build = _site_step(
            self.steps, lambda s: "pnpm build" in step_run_text(s) and "pnpm install" not in step_run_text(s)
        )
        self.lint = _site_step(
            self.steps, lambda s: "pnpm lint" in step_run_text(s) and "pnpm build" not in step_run_text(s)
        )
        self.astro_check = _site_step(
            self.steps, lambda s: "astro check" in step_run_text(s) and "pnpm lint" not in step_run_text(s)
        )

    def test_installazione_usa_lockfile_congelato(self):
        self.assertIn("--frozen-lockfile", step_run_text(self.install))

    def test_i_quattro_passi_sono_comandi_distinti(self):
        # Un fallimento in un passo non deve poter essere confuso con un altro:
        # ogni run contiene solo il proprio comando, non gli altri tre.
        testi = {
            "install": step_run_text(self.install),
            "build": step_run_text(self.build),
            "lint": step_run_text(self.lint),
            "astro_check": step_run_text(self.astro_check),
        }
        self.assertNotIn("pnpm build", testi["install"])
        self.assertNotIn("pnpm lint", testi["install"])
        self.assertNotIn("astro check", testi["install"])
        self.assertNotIn("pnpm lint", testi["build"])
        self.assertNotIn("astro check", testi["build"])
        self.assertNotIn("astro check", testi["lint"])


if __name__ == "__main__":
    unittest.main()
