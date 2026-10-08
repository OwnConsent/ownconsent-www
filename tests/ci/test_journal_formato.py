"""Formato delle voci di journal/: campo obbligatorio per tipo e nome del file.

Non e' uno degli AC della spec (docs/spec/issue-25.json). Viene dalla issue #70:
la tabella «Tipi di voce» di docs/JOURNAL.md dichiara un campo che non puo'
mancare per ogni tipo, e niente lo controllava. Misurato su origin/main 062c19f
l'08/10/2026: 536 voci, 24 senza il campo obbligatorio, 31 col nome `HHMM-`
invece di `HHMMSS-`.

La regola, per ogni `journal/<data>/<nome>.json`:

- il file e' un oggetto JSON con `tipo` e `ts`;
- se il tipo e' nella tabella, ogni campo obbligatorio c'e' e non e' vuoto
  (`null`, stringa vuota, lista vuota e oggetto vuoto valgono come assenti);
- il nome comincia con `HHMMSS-`.

Le voci non si modificano (docs/JOURNAL.md, «Le correzioni si aggiungono»):
quelle che gia' violano la regola sono un ELENCO CHIUSO, qui sotto. Una voce
nuova non ci entra: si scrive giusta. TestEccezioni diventa rosso se l'elenco
nomina un file che non esiste o che la regola la rispetta gia'.

Limiti, dichiarati:

- il tipo `correzione` non ha campi obbligatori nella tabella, solo un esempio:
  quali siano (`corregge` stringa o lista, `come_lo_so`) e' una decisione aperta
  nella #70. Qui non si controlla;
- un tipo che la tabella non conosce passa senza controllo dei campi;
- il nome non viene confrontato con `ts`, `agente` e `tipo` della voce;
- il contenuto del campo non viene giudicato: basta che non sia vuoto.
"""
from __future__ import annotations

import json
import re
import unittest

from helpers import ci_root

# docs/JOURNAL.md, tabella «Tipi di voce».
OBBLIGATORI: dict[str, tuple[str, ...]] = {
    "decisione": ("alternative",),
    "gate": ("chi_ha_deciso", "cosa_serviva"),
    "fallimento": ("cosa_si_e_imparato",),
    "misura": ("evidenza",),
    "consegna": ("dod_soddisfatta",),
}

NOME_RE = re.compile(r"^[0-9]{6}-")

# Voci senza il campo obbligatorio, come (percorso relativo, campo mancante).
# Elenco chiuso, misurato su origin/main 062c19f.
ECCEZIONI_CAMPI: frozenset[tuple[str, str]] = frozenset({
    ("journal/2026-09-15/091954-devops-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-20/161048-privacy-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-20/172822-qa-test-decisione.json", "alternative"),
    ("journal/2026-09-20/1900-qa-test-decisione.json", "alternative"),
    ("journal/2026-09-20/191022-qa-test-misura.json", "evidenza"),
    ("journal/2026-09-22/105330-design-misura.json", "evidenza"),
    ("journal/2026-09-22/105600-design-fallimento.json", "cosa_si_e_imparato"),
    ("journal/2026-09-22/110500-design-misura.json", "evidenza"),
    ("journal/2026-09-22/112000-design-fallimento.json", "cosa_si_e_imparato"),
    ("journal/2026-09-22/112100-design-decisione.json", "alternative"),
    ("journal/2026-09-23/170339-qa-test-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-23/170529-qa-test-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-23/171115-qa-test-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-23/171350-qa-test-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-23/171534-qa-test-consegna.json", "dod_soddisfatta"),
    ("journal/2026-09-26/153522-orchestrator-fallimento.json", "cosa_si_e_imparato"),
    ("journal/2026-09-26/185415-andrea-decisione.json", "alternative"),
    ("journal/2026-09-26/211944-orchestrator-fallimento.json", "cosa_si_e_imparato"),
    ("journal/2026-09-26/213119-andrea-decisione.json", "alternative"),
    ("journal/2026-09-26/221157-orchestrator-fallimento.json", "cosa_si_e_imparato"),
    ("journal/2026-09-26/221518-andrea-decisione.json", "alternative"),
    ("journal/2026-09-27/174454-orchestrator-misura.json", "evidenza"),
    ("journal/2026-09-27/181005-orchestrator-misura.json", "evidenza"),
    ("journal/2026-09-27/183324-orchestrator-misura.json", "evidenza"),
})

# Voci col nome `HHMM-`. Elenco chiuso, misurato su origin/main 062c19f.
ECCEZIONI_NOME: frozenset[str] = frozenset({
    "journal/2026-09-13/1600-product-spec-fallimento.json",
    "journal/2026-09-13/1601-product-spec-gate.json",
    "journal/2026-09-13/1606-product-spec-decisione.json",
    "journal/2026-09-13/1607-product-spec-decisione.json",
    "journal/2026-09-13/1608-product-spec-decisione.json",
    "journal/2026-09-13/1609-product-spec-decisione.json",
    "journal/2026-09-13/1610-product-spec-decisione.json",
    "journal/2026-09-13/1613-feature-gate.json",
    "journal/2026-09-13/1617-product-spec-fallimento.json",
    "journal/2026-09-13/1618-product-spec-decisione.json",
    "journal/2026-09-13/1641-feature-decisione.json",
    "journal/2026-09-13/1649-product-spec-decisione-2.json",
    "journal/2026-09-13/1649-product-spec-decisione.json",
    "journal/2026-09-13/1649-product-spec-fallimento.json",
    "journal/2026-09-13/1650-product-spec-decisione-2.json",
    "journal/2026-09-13/1650-product-spec-decisione-3.json",
    "journal/2026-09-13/1650-product-spec-decisione-4.json",
    "journal/2026-09-13/1650-product-spec-decisione.json",
    "journal/2026-09-13/1651-product-spec-decisione.json",
    "journal/2026-09-13/1657-product-spec-gate.json",
    "journal/2026-09-13/1701-product-spec-gate.json",
    "journal/2026-09-13/1701-product-spec-misura.json",
    "journal/2026-09-13/1703-feature-decisione.json",
    "journal/2026-09-13/1708-orchestrator-decisione.json",
    "journal/2026-09-13/1708-orchestrator-gate.json",
    "journal/2026-09-13/1717-orchestrator-decisione.json",
    "journal/2026-09-13/1717-orchestrator-fallimento.json",
    "journal/2026-09-13/1725-product-spec-decisione.json",
    "journal/2026-09-13/1727-product-spec-fallimento.json",
    "journal/2026-09-13/1727-product-spec-misura.json",
    "journal/2026-09-20/1900-qa-test-decisione.json",
})


def voci() -> list:
    return sorted((ci_root() / "journal").glob("*/*.json"))


def _relativo(path) -> str:
    return path.relative_to(ci_root()).as_posix()


def _vuoto(valore) -> bool:
    return valore is None or valore == "" or valore == [] or valore == {}


def campi_mancanti(path) -> list[str]:
    """Campi obbligatori assenti o vuoti; un problema di forma vale come campo."""
    try:
        voce = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError) as errore:
        return [f"<json non valido: {errore}>"]
    if not isinstance(voce, dict):
        return ["<la voce non e' un oggetto JSON>"]
    mancanti = [campo for campo in ("tipo", "ts") if _vuoto(voce.get(campo))]
    for campo in OBBLIGATORI.get(voce.get("tipo"), ()):
        if _vuoto(voce.get(campo)):
            mancanti.append(campo)
    return mancanti


def nome_valido(path) -> bool:
    return bool(NOME_RE.match(path.name))


class TestCampiObbligatori(unittest.TestCase):
    def test_ogni_voce_ha_il_campo_obbligatorio_del_suo_tipo(self):
        controllate = 0
        for path in voci():
            relativo = _relativo(path)
            fuori_elenco = [
                campo
                for campo in campi_mancanti(path)
                if (relativo, campo) not in ECCEZIONI_CAMPI
            ]
            controllate += 1
            with self.subTest(voce=relativo):
                self.assertEqual(fuori_elenco, [], relativo)
        self.assertGreater(controllate, 0, "nessuna voce controllata")


class TestNomeDelFile(unittest.TestCase):
    def test_ogni_voce_ha_il_nome_hhmmss(self):
        controllate = 0
        for path in voci():
            relativo = _relativo(path)
            if relativo in ECCEZIONI_NOME:
                continue
            controllate += 1
            with self.subTest(voce=relativo):
                self.assertTrue(nome_valido(path), relativo)
        self.assertGreater(controllate, 0, "nessuna voce controllata")


class TestEccezioni(unittest.TestCase):
    """L'elenco non puo' restare dimenticato ne' allargarsi in silenzio."""

    def test_ogni_eccezione_sui_campi_e_ancora_una_violazione(self):
        presenti = {_relativo(p): p for p in voci()}
        for relativo, campo in sorted(ECCEZIONI_CAMPI):
            with self.subTest(voce=relativo, campo=campo):
                self.assertIn(relativo, presenti, "l'eccezione nomina un file che non esiste")
                self.assertIn(
                    campo,
                    campi_mancanti(presenti[relativo]),
                    "il campo c'e': l'eccezione va tolta",
                )

    def test_ogni_eccezione_sul_nome_e_ancora_una_violazione(self):
        presenti = {_relativo(p): p for p in voci()}
        for relativo in sorted(ECCEZIONI_NOME):
            with self.subTest(voce=relativo):
                self.assertIn(relativo, presenti, "l'eccezione nomina un file che non esiste")
                self.assertFalse(
                    nome_valido(presenti[relativo]),
                    "il nome e' gia' HHMMSS: l'eccezione va tolta",
                )

    def test_gli_elenchi_hanno_la_misura_dichiarata(self):
        self.assertEqual(len(ECCEZIONI_CAMPI), 24)
        self.assertEqual(len(ECCEZIONI_NOME), 31)


if __name__ == "__main__":
    unittest.main()
