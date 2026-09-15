"""AC4 e AC5 — docs/spec/issue-25.json.

AC4: "un commit in cui le aree site/ e api/ sono entrambe assenti... il
contesto ci termina con conclusion success, non skipped e non neutral; il log
contiene una riga con il testo `site/` e la parola «assente», e
un'altra riga con il testo `api/` e la parola «assente»."

AC5: "un commit con l'area site/ incompleta (per esempio solo
site/README.md)... il contesto ci termina con conclusion failure, e il log
contiene una riga che nomina il file mancante (`site/package.json` oppure
`api/go.mod`)."

Il job ci (ADR-0003, D6) non ha un motore proprio: chiama `.github/ci/area.sh`
per site e per api e fallisce se una delle due chiamate esce con un codice
diverso da 0. Questi test esercitano quindi direttamente l'interfaccia di
area.sh -- ingresso, righe esatte, exit code, GITHUB_OUTPUT -- su repository
git temporanei creati dal test, mai sul repository reale.
"""
from __future__ import annotations

import pathlib
import subprocess
import tempfile
import unittest

from helpers import area_sh_path


def _git(*args: str, cwd: pathlib.Path) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


def _init_repo(tmp: pathlib.Path) -> None:
    _git("init", "-q", cwd=tmp)
    _git("config", "user.email", "qa-test@example.invalid", cwd=tmp)
    _git("config", "user.name", "qa-test", cwd=tmp)


def _commit_all(tmp: pathlib.Path) -> None:
    _git("add", "-A", cwd=tmp)
    _git("commit", "-q", "-m", "commit di prova", cwd=tmp)


def _run_area(tmp: pathlib.Path, area: str, github_output: pathlib.Path):
    import os

    env = dict(os.environ)
    env["GITHUB_OUTPUT"] = str(github_output)
    return subprocess.run(
        ["bash", str(area_sh_path()), area],
        cwd=tmp,
        capture_output=True,
        text=True,
        env=env,
    )


class TestAC04AreeAssenti(unittest.TestCase):
    """AC4 -- site/ e api/ assenti: successo, log con «assente» per ciascuna."""

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.tmp = pathlib.Path(self._tmpdir.name)
        _init_repo(self.tmp)
        (self.tmp / "README.md").write_text("nessun file sotto site/ o api/\n")
        _commit_all(self.tmp)

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_site_assente_riga_e_exit_code(self):
        out = self.tmp / "gh_output_site.txt"
        r = _run_area(self.tmp, "site", out)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.strip(), "area site/: assente")
        self.assertIn("site/", r.stdout)
        self.assertIn("assente", r.stdout)
        self.assertEqual(out.read_text().strip(), "site=assente")

    def test_api_assente_riga_e_exit_code(self):
        out = self.tmp / "gh_output_api.txt"
        r = _run_area(self.tmp, "api", out)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.strip(), "area api/: assente")
        self.assertIn("api/", r.stdout)
        self.assertIn("assente", r.stdout)
        self.assertEqual(out.read_text().strip(), "api=assente")


class TestAC05AreeIncomplete(unittest.TestCase):
    """AC5 -- area con file ma senza il marcatore: fallimento, riga col file mancante."""

    def test_site_incompleta_senza_package_json(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            _init_repo(tmp)
            (tmp / "site").mkdir()
            (tmp / "site" / "README.md").write_text("progetto a meta'\n")
            _commit_all(tmp)

            out = tmp / "gh_output.txt"
            r = _run_area(tmp, "site", out)
            self.assertEqual(r.returncode, 1)
            self.assertIn("site/package.json", r.stdout)
            self.assertEqual(out.read_text().strip(), "site=incompleta")

    def test_api_incompleta_senza_go_mod(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = pathlib.Path(d)
            _init_repo(tmp)
            (tmp / "api").mkdir()
            (tmp / "api" / "README.md").write_text("modulo a meta'\n")
            _commit_all(tmp)

            out = tmp / "gh_output.txt"
            r = _run_area(tmp, "api", out)
            self.assertEqual(r.returncode, 1)
            self.assertIn("api/go.mod", r.stdout)
            self.assertEqual(out.read_text().strip(), "api=incompleta")


if __name__ == "__main__":
    unittest.main()
