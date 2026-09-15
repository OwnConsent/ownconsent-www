"""Utilita' condivise per i test del contesto `ci` (tests/ci/**).

Non e' un test: nessun test lo esegue direttamente (nessun prefisso Test/test_).

Risolve la radice degli oggetti sotto test dalla variabile d'ambiente CI_ROOT;
default: radice del repository che contiene questo file, trovata con
`git rev-parse --show-toplevel`. Questo permette di puntare i test a una copia
mutata degli oggetti sotto test (workflow, area.sh, DoD) senza mai toccare gli
originali: si esporta CI_ROOT=<copia> prima di eseguire i test.

Dipendenze dichiarate da docs/adr/0003-contesto-ci.md, D7: python3 (libreria
standard + PyYAML), git, bash. Nessun altro pacchetto.
"""
from __future__ import annotations

import os
import pathlib
import subprocess


def ci_root() -> pathlib.Path:
    env = os.environ.get("CI_ROOT")
    if env:
        return pathlib.Path(env).resolve()
    here = pathlib.Path(__file__).resolve()
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=here.parent,
        capture_output=True,
        text=True,
        check=True,
    )
    return pathlib.Path(out.stdout.strip())


def workflow_dir() -> pathlib.Path:
    return ci_root() / ".github" / "workflows"


def ci_workflow_path() -> pathlib.Path:
    return workflow_dir() / "ci.yml"


def all_workflow_paths() -> list[pathlib.Path]:
    d = workflow_dir()
    return sorted(p for p in d.iterdir() if p.suffix in (".yml", ".yaml"))


def area_sh_path() -> pathlib.Path:
    return ci_root() / ".github" / "ci" / "area.sh"


def dod_path() -> pathlib.Path:
    return ci_root() / "docs" / "DEFINITION-OF-DONE.md"


def load_yaml(path: pathlib.Path):
    import yaml

    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def on_triggers(doc: dict) -> dict:
    """YAML 1.1 legge la chiave `on:` come booleano True: normalizza."""
    if "on" in doc:
        return doc["on"] or {}
    if True in doc:
        return doc[True] or {}
    return {}


def find_steps(job: dict) -> list[dict]:
    return job.get("steps", []) or []


def step_run_text(step: dict) -> str:
    return step.get("run", "") or ""
