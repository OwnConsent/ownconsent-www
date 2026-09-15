"""Forma del job e dei trigger — ADR-0003 D1.

Non e' uno degli AC1-AC20 della spec (docs/spec/issue-25.json): D1 e' la
condizione strutturale che rende osservabili AC1, AC2, AC3 (un solo contesto
`ci`, sempre riportato) e parte di AC16 (nessun `pull_request_target`). Scritto
dalla regola dell'ADR, non dal codice:

    "il job ha id `ci` e `name: ci`; in tutti i file di `.github/workflows/`
    c'e' un solo job con id o `name` uguale a `ci`; il job `ci` non ha
    `strategy.matrix`; il job `ci` non ha `if`... i trigger sono esattamente
    due: `pull_request`, senza `branches`, `branches-ignore`, `paths` o
    `paths-ignore`... `push`, con `branches: [main]` e senza `paths`. Niente
    `pull_request_target`... ne' il workflow ne' il job hanno `concurrency`...
    ne' il job ne' i suoi passi hanno `continue-on-error`."
    (docs/adr/0003-contesto-ci.md, D1)
"""
from __future__ import annotations

import unittest

from helpers import all_workflow_paths, find_steps, load_yaml, on_triggers


def _jobs_named_ci():
    """Ritorna [(file, job_id, job_dict), ...] per ogni job con id o name 'ci'."""
    found = []
    for path in all_workflow_paths():
        doc = load_yaml(path)
        if not doc:
            continue
        jobs = doc.get("jobs", {}) or {}
        for job_id, job in jobs.items():
            job = job or {}
            if job_id == "ci" or job.get("name") == "ci":
                found.append((path, job_id, job, doc))
    return found


class TestFormaDelJobCi(unittest.TestCase):
    def test_un_solo_job_ci_in_tutti_i_workflow(self):
        found = _jobs_named_ci()
        self.assertEqual(
            len(found), 1,
            f"atteso esattamente un job con id o name 'ci' in .github/workflows/, trovati: "
            f"{[(str(p), jid) for p, jid, _, _ in found]}",
        )

    def test_il_job_ha_id_e_name_uguali_a_ci(self):
        (_path, job_id, job, _doc), = _jobs_named_ci()
        self.assertEqual(job_id, "ci")
        self.assertEqual(job.get("name"), "ci")

    def test_nessun_if_sul_job(self):
        (_path, _jid, job, _doc), = _jobs_named_ci()
        self.assertNotIn("if", job)

    def test_nessuna_matrice(self):
        (_path, _jid, job, _doc), = _jobs_named_ci()
        self.assertNotIn("strategy", job)

    def test_nessuna_concurrency_su_job_o_workflow(self):
        (_path, _jid, job, doc), = _jobs_named_ci()
        self.assertNotIn("concurrency", job)
        self.assertNotIn("concurrency", doc)

    def test_nessun_continue_on_error_su_job_o_passi(self):
        (_path, _jid, job, _doc), = _jobs_named_ci()
        self.assertNotIn("continue-on-error", job)
        for step in find_steps(job):
            self.assertNotIn(
                "continue-on-error", step,
                f"passo con continue-on-error: {step.get('name')}",
            )

    def test_trigger_esattamente_pull_request_e_push(self):
        (_path, _jid, _job, doc), = _jobs_named_ci()
        on = on_triggers(doc)
        self.assertEqual(set(on.keys()), {"pull_request", "push"})

    def test_pull_request_senza_filtri(self):
        (_path, _jid, _job, doc), = _jobs_named_ci()
        pr = on_triggers(doc)["pull_request"]
        if pr is None:
            return
        self.assertIsInstance(pr, dict)
        for vietata in ("branches", "branches-ignore", "paths", "paths-ignore"):
            self.assertNotIn(vietata, pr)
        if "types" in pr:
            tipi = set(pr["types"])
            self.assertTrue(
                {"opened", "synchronize", "reopened"} <= tipi,
                f"types deve includere almeno opened, synchronize, reopened: {tipi}",
            )

    def test_push_solo_su_main_senza_paths(self):
        (_path, _jid, _job, doc), = _jobs_named_ci()
        push = on_triggers(doc)["push"]
        self.assertIsInstance(push, dict)
        self.assertEqual(push.get("branches"), ["main"])
        for vietata in ("paths", "paths-ignore", "branches-ignore"):
            self.assertNotIn(vietata, push)

    def test_nessun_pull_request_target(self):
        (_path, _jid, _job, doc), = _jobs_named_ci()
        self.assertNotIn("pull_request_target", on_triggers(doc))


if __name__ == "__main__":
    unittest.main()
