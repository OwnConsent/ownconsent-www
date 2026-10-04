"""Immagine dei runner: ogni job dichiara un `runs-on` esplicito e non mobile.

Non e' uno degli AC della spec (docs/spec/issue-25.json). Viene dalla decisione
del 03/10/2026 (journal/2026-10-03/213627-orchestrator-decisione.json):
l'etichetta `ubuntu-latest` passa a Ubuntu 26.04 fra il 19/10 e il 19/11/2026
(actions/runner-images#14748), e un'etichetta mobile cambia l'immagine sotto
una PR qualunque, senza un commit di questo repository che lo segni.

La regola, per ogni workflow di `.github/workflows/` e per ogni suo job:

- `runs-on` c'e';
- nessuna etichetta mobile (`ubuntu-latest`, `windows-latest`, `macos-latest`
  e ogni altra etichetta con `latest` fra i trattini);
- nessuna espressione `${{ ... }}`: questo test legge il file, non lo valuta,
  e di un'espressione non sa dire quale immagine esce. Fallisce e lo dice.

`runs-on` si legge col parser YAML, non con grep: cosi' si vedono anche la
forma a lista (`[self-hosted, ubuntu-latest]`) e quella a mappa (`group:` /
`labels:`).

Limite: `ubuntu-24.04` fissa la serie, non la build dell'immagine.
"""
from __future__ import annotations

import re
import unittest

from helpers import all_workflow_paths, ci_root, load_yaml

# Workflow esclusi dalla regola, come percorsi relativi alla radice.
#
# Vuota: nessun workflow e' escluso. L'unica eccezione,
# .github/workflows/claude-pr-review.yml, e' stata tolta dalla PR che ne ha
# fissato i due job a ubuntu-24.04. Un'eccezione nuova si scrive qui con la
# sua ragione; TestEccezioni diventa rosso se nomina un file che non esiste
# o che e' gia' fissato.
ECCEZIONI: frozenset[str] = frozenset()

MOBILE_RE = re.compile(r"(^|-)latest($|-)", re.IGNORECASE)


def _etichette(runs_on) -> tuple[list, list[str]]:
    """Ritorna (valori da controllare, problemi di forma) per un `runs-on`."""
    if isinstance(runs_on, str):
        return [runs_on], []
    if isinstance(runs_on, list):
        if not runs_on:
            return [], ["runs-on e' una lista vuota"]
        return list(runs_on), []
    if isinstance(runs_on, dict):
        valori = []
        if "group" in runs_on:
            valori.append(runs_on["group"])
        labels = runs_on.get("labels")
        if labels is None:
            return valori, ["runs-on ha solo `group`, senza `labels`: l'immagine non e' dichiarata"]
        etichette, problemi = _etichette(labels)
        return valori + etichette, problemi
    return [], [f"runs-on ha una forma non prevista: {runs_on!r}"]


def problemi_del_job(job) -> list[str]:
    """Perche' il `runs-on` di un job non e' esplicito e fisso; [] se lo e'."""
    job = job or {}
    if "runs-on" not in job:
        if "uses" in job:
            return [
                f"chiama un workflow riusabile ({job['uses']}): l'immagine la decide "
                "il workflow chiamato e questo test non la vede"
            ]
        return ["runs-on manca"]
    valori, problemi = _etichette(job["runs-on"])
    for valore in valori:
        if not isinstance(valore, str):
            problemi.append(f"etichetta non testuale: {valore!r}")
        elif "${{" in valore:
            problemi.append(
                f"runs-on contiene un'espressione ({valore!r}): questo test non la "
                "valuta e non puo' dire quale immagine esce. Scrivi l'etichetta per esteso"
            )
        elif MOBILE_RE.search(valore.strip()):
            problemi.append(f"etichetta mobile: {valore!r}")
    return problemi


def problemi_del_workflow(path) -> list[str]:
    doc = load_yaml(path)
    jobs = doc.get("jobs") if isinstance(doc, dict) else None
    if not isinstance(jobs, dict) or not jobs:
        return ["nessun job letto dal file: la regola non e' verificabile"]
    return [
        f"job `{job_id}`: {problema}"
        for job_id, job in jobs.items()
        for problema in problemi_del_job(job)
    ]


def _relativo(path) -> str:
    return path.relative_to(ci_root()).as_posix()


class TestRunsOnDeiWorkflow(unittest.TestCase):
    def test_ogni_job_ha_un_runs_on_esplicito_e_non_mobile(self):
        controllati = 0
        for path in all_workflow_paths():
            relativo = _relativo(path)
            if relativo in ECCEZIONI:
                continue
            controllati += 1
            with self.subTest(workflow=relativo):
                self.assertEqual(problemi_del_workflow(path), [], relativo)
        self.assertGreater(controllati, 0, "nessun workflow controllato")


class TestEccezioni(unittest.TestCase):
    """L'eccezione non puo' restare dimenticata ne' allargarsi in silenzio."""

    def test_ogni_eccezione_e_un_workflow_che_esiste(self):
        presenti = {_relativo(p) for p in all_workflow_paths()}
        self.assertEqual(
            sorted(ECCEZIONI - presenti), [],
            "in ECCEZIONI ci sono file che non sono workflow di .github/workflows/: toglili",
        )

    def test_nessuna_eccezione_e_gia_fissata(self):
        for path in all_workflow_paths():
            relativo = _relativo(path)
            if relativo not in ECCEZIONI:
                continue
            with self.subTest(workflow=relativo):
                self.assertNotEqual(
                    problemi_del_workflow(path), [],
                    f"{relativo} ha gia' un runs-on esplicito e fisso in ogni job: "
                    "l'eccezione non serve piu', toglila da ECCEZIONI",
                )


class TestLetturaDiRunsOn(unittest.TestCase):
    """Le forme di `runs-on` che un grep non vedrebbe."""

    def _yaml(self, testo: str):
        import yaml

        return yaml.safe_load(testo)

    def test_etichetta_fissa(self):
        for runs_on in ("ubuntu-24.04", "ubuntu-24.04-arm", ["self-hosted", "linux"]):
            with self.subTest(runs_on=runs_on):
                self.assertEqual(problemi_del_job({"runs-on": runs_on}), [])

    def test_etichette_mobili(self):
        for runs_on in (
            "ubuntu-latest", "windows-latest", "macos-latest",
            "Ubuntu-Latest", "ubuntu-latest-4-cores", "latest",
        ):
            with self.subTest(runs_on=runs_on):
                (problema,) = problemi_del_job({"runs-on": runs_on})
                self.assertIn("etichetta mobile", problema)

    def test_latest_dentro_una_parola_non_e_mobile(self):
        self.assertEqual(problemi_del_job({"runs-on": "runner-latestate"}), [])

    def test_lista_su_una_riga_e_su_piu_righe(self):
        for testo in (
            "runs-on: [self-hosted, ubuntu-latest]",
            "runs-on:\n  - self-hosted\n  - ubuntu-latest",
        ):
            with self.subTest(testo=testo):
                (problema,) = problemi_del_job(self._yaml(testo))
                self.assertIn("etichetta mobile", problema)

    def test_mappa_con_group_e_labels(self):
        job = self._yaml("runs-on:\n  group: grandi\n  labels: [ubuntu-latest]")
        (problema,) = problemi_del_job(job)
        self.assertIn("etichetta mobile", problema)
        fisso = self._yaml("runs-on:\n  group: grandi\n  labels: ubuntu-24.04")
        self.assertEqual(problemi_del_job(fisso), [])

    def test_mappa_con_solo_group(self):
        (problema,) = problemi_del_job({"runs-on": {"group": "grandi"}})
        self.assertIn("senza `labels`", problema)

    def test_un_espressione_fa_fallire_e_il_messaggio_lo_dice(self):
        for testo in (
            "runs-on: ${{ matrix.os }}",
            "runs-on: [self-hosted, '${{ inputs.runner }}']",
            "runs-on:\n  group: ${{ vars.GRUPPO }}\n  labels: ubuntu-24.04",
            "runs-on: ${{ fromJSON('[\"ubuntu-24.04\"]') }}",
        ):
            with self.subTest(testo=testo):
                (problema,) = problemi_del_job(self._yaml(testo))
                self.assertIn("espressione", problema)
                self.assertIn("non la", problema)

    def test_runs_on_assente_vuoto_o_di_forma_ignota(self):
        self.assertEqual(problemi_del_job({"steps": []}), ["runs-on manca"])
        self.assertEqual(problemi_del_job(None), ["runs-on manca"])
        for runs_on in (None, [], 24.04):
            with self.subTest(runs_on=runs_on):
                self.assertNotEqual(problemi_del_job({"runs-on": runs_on}), [])

    def test_job_che_chiama_un_workflow_riusabile(self):
        (problema,) = problemi_del_job({"uses": "./.github/workflows/altro.yml"})
        self.assertIn("workflow riusabile", problema)


if __name__ == "__main__":
    unittest.main()
