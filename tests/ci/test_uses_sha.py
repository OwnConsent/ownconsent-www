"""Action dei workflow: ogni `uses:` esterno e' fissato a uno SHA, con la versione in commento.

Non e' uno degli AC della spec (docs/spec/issue-25.json). Viene dal finding
di gravita' media del collaudo sulla PR #80 (run 37149916372):
claude-nightly-maintenance.yml e claude-release-comms.yml usavano
`actions/checkout@v4` e `anthropics/claude-code-action@v1`, con
`contents: write`. Un tag lo sposta chi controlla il repository dell'action,
senza un commit di questo repository che lo segni; uno SHA no.

La regola, per ogni workflow di `.github/workflows/` e per ogni `uses:` di
ogni passo e di ogni job (i job che chiamano un workflow riusabile):

- action esterna (`proprietario/repo[/percorso]@ref`): il ref e' di 40
  caratteri esadecimali, e sulla stessa riga segue un commento con la
  versione (`# v4.4.0`);
- esclusi, perche' non hanno un ref da fissare a uno SHA di commit:
  `./...`, azione o workflow locale, che e' gia' il contenuto di questo
  repository al commit in esecuzione; `docker://...`, immagine, il cui punto
  fisso e' un digest e non uno SHA di 40 caratteri.

I `uses:` si trovano col parser YAML; il commento si legge dal testo grezzo
della riga, perche' il parser i commenti li butta. Le due letture devono
dare lo stesso elenco, nello stesso ordine: se non lo danno il test fallisce
e lo dice, invece di accoppiare una riga al `uses:` sbagliato.

tests/ci/test_collaudo_isolamento.py ha gia' un caso simile per il solo
claude-pr-review.yml (`test_uses_fissate_a_sha_con_il_tag_in_commento`):
resta com'e'. Qui quel file e' controllato come gli altri.

Limiti:
- il commento deve avere la forma di una versione (`v4`, `v4.4.0`), ma che
  quello SHA sia davvero quella versione questo test non lo sa: non va in rete;
- la versione puo' essere solo la maggiore (`# v4`): il test non chiede il
  tag esatto;
- dentro un'azione locale (`./...`) non si guarda;
- per `docker://` non si chiede il digest.
"""
from __future__ import annotations

import re
import unittest

from helpers import all_workflow_paths, ci_root, find_steps

# Una riga che dichiara un `uses:`, di passo (`- uses:` o `uses:` sotto
# `- name:`) o di job. Il valore puo' essere fra virgolette.
RIGA_USES_RE = re.compile(r"""^\s*(?:-\s+)?uses:\s*(?P<q>['"]?)(?P<valore>[^\s'"#]+)(?P=q)(?P<resto>.*)$""")
ESTERNA_RE = re.compile(r"^[\w.-]+/[\w./-]+@(?P<ref>.+)$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
COMMENTO_VERSIONE_RE = re.compile(r"^\s+#\s*v\d+(\.\d+)*\s*$")


def esclusa(valore: str) -> bool:
    # ./... : azione o workflow locale, nessun ref: e' questo repository.
    # docker://... : immagine, il punto fisso e' un digest, non uno SHA di commit.
    return valore.startswith("./") or valore.startswith("docker://")


def uses_dichiarati(doc) -> list[str]:
    """I `uses:` letti dal parser YAML, nell'ordine del file."""
    jobs = doc.get("jobs") if isinstance(doc, dict) else None
    if not isinstance(jobs, dict):
        return []
    trovati = []
    for job in jobs.values():
        job = job or {}
        if "uses" in job:
            trovati.append(str(job["uses"]))
        trovati += [str(s["uses"]) for s in find_steps(job) if isinstance(s, dict) and "uses" in s]
    return trovati


def righe_uses(testo: str) -> list[tuple[int, str, str]]:
    """(numero di riga, valore, resto della riga) per ogni riga `uses:` del testo grezzo."""
    righe = []
    for n, riga in enumerate(testo.splitlines(), start=1):
        m = RIGA_USES_RE.match(riga)
        if m:
            righe.append((n, m.group("valore"), m.group("resto")))
    return righe


def problemi_del_testo(testo: str) -> list[str]:
    """Perche' i `uses:` di un workflow non sono fissati; [] se lo sono."""
    import yaml

    doc = yaml.safe_load(testo)
    jobs = doc.get("jobs") if isinstance(doc, dict) else None
    if not isinstance(jobs, dict) or not jobs:
        return ["nessun job letto dal file: la regola non e' verificabile"]
    dichiarati = uses_dichiarati(doc)
    righe = righe_uses(testo)
    if [valore for _, valore, _ in righe] != dichiarati:
        return [
            "i `uses:` letti dal parser YAML e quelli letti riga per riga non coincidono "
            f"(parser: {dichiarati!r}; righe: {[v for _, v, _ in righe]!r}): ogni `uses:` "
            "sta su una riga sua, e nessun'altra riga comincia con `uses:`"
        ]
    problemi = []
    for n, valore, resto in righe:
        if esclusa(valore):
            continue
        m = ESTERNA_RE.match(valore)
        if not m:
            problemi.append(f"riga {n}: `{valore}` non ha la forma proprietario/repo@ref")
            continue
        if not SHA_RE.match(m.group("ref")):
            problemi.append(
                f"riga {n}: `{valore}` non e' fissata a uno SHA di 40 caratteri esadecimali"
            )
        if not COMMENTO_VERSIONE_RE.match(resto):
            problemi.append(
                f"riga {n}: dopo `{valore}` manca il commento con la versione (`# v1.2.3`)"
            )
    return problemi


def _relativo(path) -> str:
    return path.relative_to(ci_root()).as_posix()


class TestUsesDeiWorkflow(unittest.TestCase):
    def test_ogni_action_esterna_e_fissata_a_sha_con_la_versione_in_commento(self):
        controllati = 0
        for path in all_workflow_paths():
            controllati += 1
            with self.subTest(workflow=_relativo(path)):
                self.assertEqual(
                    problemi_del_testo(path.read_text(encoding="utf-8")), [], _relativo(path)
                )
        self.assertGreater(controllati, 0, "nessun workflow controllato")

    def test_la_regola_ha_qualcosa_da_controllare(self):
        """Senza nessun `uses:` esterno letto, il verde sopra non proverebbe niente."""
        esterni = 0
        for path in all_workflow_paths():
            testo = path.read_text(encoding="utf-8")
            esterni += sum(1 for _, valore, _ in righe_uses(testo) if not esclusa(valore))
        self.assertGreater(esterni, 0, "nessun `uses:` esterno trovato nei workflow")


SHA = "11d5960a326750d5838078e36cf38b85af677262"


def _workflow(*righe_dei_passi: str) -> str:
    passi = "\n".join(f"      {r}" for r in righe_dei_passi)
    return f"jobs:\n  uno:\n    runs-on: ubuntu-24.04\n    steps:\n{passi}\n"


class TestLetturaDiUses(unittest.TestCase):
    """Le forme di `uses:` e i due modi di sbagliarle."""

    def test_sha_con_versione_in_commento(self):
        for commento in ("# v4.4.0", "# v4", "#v1.0.241", "# v7.0.0  "):
            with self.subTest(commento=commento):
                self.assertEqual(
                    problemi_del_testo(_workflow(f"- uses: actions/checkout@{SHA} {commento}")), []
                )

    def test_uses_sotto_name_e_fra_virgolette(self):
        testo = _workflow(
            "- name: Checkout",
            f"  uses: actions/checkout@{SHA} # v4.4.0",
            f"- uses: 'actions/setup-go@{SHA}' # v5.6.0",
            f'- uses: "github/codeql-action/init@{SHA}" # v3.1.0',
        )
        self.assertEqual(problemi_del_testo(testo), [])

    def test_tag_al_posto_dello_sha(self):
        for ref in ("v4", "v4.4.0", "main", SHA[:7], SHA.upper(), SHA + "0"):
            with self.subTest(ref=ref):
                problemi = problemi_del_testo(_workflow(f"- uses: actions/checkout@{ref} # v4.4.0"))
                self.assertEqual(len(problemi), 1, problemi)
                self.assertIn("non e' fissata a uno SHA", problemi[0])

    def test_tag_senza_commento_da_due_problemi(self):
        problemi = problemi_del_testo(_workflow("- uses: actions/checkout@v4"))
        self.assertEqual(len(problemi), 2, problemi)

    def test_commento_assente_o_che_non_e_una_versione(self):
        for coda in ("", " # checkout", " # 4.4.0", " # v", " # v4.4.0 fissata", " # latest"):
            with self.subTest(coda=coda):
                problemi = problemi_del_testo(_workflow(f"- uses: actions/checkout@{SHA}{coda}"))
                self.assertEqual(len(problemi), 1, problemi)
                self.assertIn("manca il commento con la versione", problemi[0])

    def test_senza_ref(self):
        (problema,) = problemi_del_testo(_workflow("- uses: actions/checkout"))
        self.assertIn("non ha la forma", problema)

    def test_locali_e_docker_esclusi(self):
        testo = _workflow(
            "- uses: ./.github/actions/prepara",
            "- uses: docker://alpine:3.20",
        )
        self.assertEqual(problemi_del_testo(testo), [])

    def test_job_che_chiama_un_workflow_riusabile(self):
        base = "jobs:\n  uno:\n    uses: {}\n"
        self.assertEqual(problemi_del_testo(base.format("./.github/workflows/altro.yml")), [])
        self.assertEqual(
            problemi_del_testo(base.format(f"org/repo/.github/workflows/w.yml@{SHA} # v2.0.0")), []
        )
        problemi = problemi_del_testo(base.format("org/repo/.github/workflows/w.yml@main"))
        self.assertEqual(len(problemi), 2, problemi)

    def test_una_riga_uses_che_il_parser_non_vede_fa_fallire(self):
        """Un `uses:` dentro uno scalare a blocco: le due letture divergono, e si dice."""
        testo = _workflow(
            f"- uses: actions/checkout@{SHA} # v4.4.0",
            "- run: |",
            "    cat <<'EOF'",
            "    uses: actions/checkout@v4",
            "    EOF",
        )
        (problema,) = problemi_del_testo(testo)
        self.assertIn("non coincidono", problema)

    def test_nessun_job(self):
        (problema,) = problemi_del_testo("name: vuoto\n")
        self.assertIn("nessun job", problema)


if __name__ == "__main__":
    unittest.main()
