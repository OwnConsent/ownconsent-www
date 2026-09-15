"""AC10 (precondizione statica) e AC12 -- docs/spec/issue-25.json.

AC12: "il file del workflow di ci... non contiene alcun numero di versione di
Node, ne' 22.23.2 ne' altri; la versione arriva solo da .nvmrc... come_si_osserva:
grep -nE '22\\.[0-9]+' <path> non stampa nulla; nessuna chiave con una versione
letterale di Node." Verificato per intero qui, staticamente.

AC10: "il log contiene la versione di Node in uso, ed e' v22.23.2" e'
osservabile solo nel log di un'esecuzione reale (procedura in
.work/issue-25/prove/procedure.md). Questo file verifica la precondizione
statica che lo garantisce: setup-node legge la versione solo da
`node-version-file: .nvmrc`, mai da un valore letterale, cosi' come prescrive
ADR-0003 D5.
"""
from __future__ import annotations

import re
import unittest

from helpers import ci_root, ci_workflow_path, find_steps, load_yaml


class TestAC12NessunaVersioneNodeNelWorkflow(unittest.TestCase):
    def setUp(self):
        self.testo = ci_workflow_path().read_text(encoding="utf-8")

    def test_nessuna_stringa_22_punto_numero_nel_file(self):
        match = re.findall(r"22\.[0-9]+", self.testo)
        self.assertEqual(match, [], f"versione di Node letterale trovata nel workflow: {match}")

    def test_nessuna_chiave_node_version_letterale(self):
        # node-version-file e' ammessa; node-version (valore letterale) no.
        self.assertIsNone(
            re.search(r"^\s*node-version:\s*\S", self.testo, flags=re.MULTILINE),
            "trovata una chiave node-version: con un valore letterale",
        )


class TestAC10PrecondizioneStaticaNvmrc(unittest.TestCase):
    def setUp(self):
        doc = load_yaml(ci_workflow_path())
        job = doc["jobs"]["ci"]
        (self.setup_node,) = [s for s in find_steps(job) if s.get("uses", "").startswith("actions/setup-node")]

    def test_setup_node_legge_node_version_file_nvmrc(self):
        self.assertEqual((self.setup_node.get("with") or {}).get("node-version-file"), ".nvmrc")

    def test_setup_node_non_ha_input_node_version(self):
        self.assertNotIn("node-version", self.setup_node.get("with") or {})

    def test_il_file_nvmrc_esiste_nella_radice_sotto_test(self):
        self.assertTrue((ci_root() / ".nvmrc").is_file())


if __name__ == "__main__":
    unittest.main()
