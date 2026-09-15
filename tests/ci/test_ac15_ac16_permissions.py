"""AC15 (precondizione statica) e AC16 -- docs/spec/issue-25.json.

AC16: "il file dichiara esplicitamente la chiave permissions, a livello di
workflow o sul job ci, e nessun valore e' write o write-all; il file non
contiene alcuna espressione `secrets.`; le esecuzioni sulle PR hanno event
pull_request, mai pull_request_target." Verificato per intero qui (la parte
sull'event delle esecuzioni e' gia' coperta da test_d1_job_form.py, che
verifica staticamente che l'unico trigger di PR sia `pull_request`).

AC15: "la sezione «GITHUB_TOKEN Permissions» nel passo di
preparazione del job ci... elenca solo permessi fra Contents: read e
Metadata: read" -- osservabile solo nel log di un'esecuzione reale (procedura
in .work/issue-25/prove/procedure.md). Il meccanismo che lo garantisce e'
verificato qui: `permissions: contents: read` e nient'altro, che e' cio' che
produce quella sezione del log.
"""
from __future__ import annotations

import re
import unittest

from helpers import ci_workflow_path, load_yaml, on_triggers


class TestAC16Permissions(unittest.TestCase):
    def setUp(self):
        self.doc = load_yaml(ci_workflow_path())
        self.testo = ci_workflow_path().read_text(encoding="utf-8")

    def test_permissions_dichiarato_a_livello_workflow_o_job(self):
        job = self.doc["jobs"]["ci"]
        a_livello_workflow = "permissions" in self.doc
        a_livello_job = "permissions" in job
        self.assertTrue(
            a_livello_workflow or a_livello_job,
            "permissions non e' dichiarato ne' a livello workflow ne' sul job ci",
        )

    def test_nessun_permesso_write(self):
        self.assertIsNone(
            re.search(r"\bwrite\b", self.testo, flags=re.IGNORECASE),
            "trovata la parola 'write' nel file del workflow",
        )

    def test_nessuna_espressione_secrets(self):
        self.assertIsNone(re.search(r"secrets\.", self.testo), "trovata un'espressione secrets. nel file")

    def test_nessun_trigger_pull_request_target(self):
        self.assertNotIn("pull_request_target", on_triggers(self.doc))


class TestAC15PrecondizioneStaticaSoloContentsRead(unittest.TestCase):
    """Il meccanismo che garantisce che il log riporti solo Contents/Metadata: read."""

    def setUp(self):
        self.doc = load_yaml(ci_workflow_path())

    def test_permissions_e_esattamente_contents_read(self):
        job = self.doc["jobs"]["ci"]
        perms = self.doc.get("permissions") or job.get("permissions")
        self.assertEqual(perms, {"contents": "read"})


if __name__ == "__main__":
    unittest.main()
