"""Collaudo: l'agente attende i subagent prima di chiudere (#76).

Non e' uno degli AC della spec (docs/spec/issue-25.json). Viene dalla decisione
del 05/10/2026 (journal/2026-10-05/165842-orchestrator-decisione.json): col
prompt di prima l'agente lanciava i subagent in background e chiudeva il turno
con un messaggio di attesa; l'action esce al primo result, e il verdetto non si
scriveva.

Test statici sullo step dell'agente di claude-pr-review.yml, letti col parser
YAML:

- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` vale "1" nell'env dello step;
- il prompt non cita `${CLAUDE_PLUGIN_ROOT}` ne' un SKILL.md: in CI il plugin
  non e' caricato e il percorso non si risolve;
- il prompt porta le tre regole di esecuzione, in testa, prima della procedura;
- in `--allowedTools` c'e' `Agent` e non `Task`.

Limite: questi test leggono il file. Che la variabile arrivi al processo di
Claude Code e che l'agente segua le regole lo dice solo una run dal vivo.
"""
from __future__ import annotations

import shlex
import unittest

from collaudo_banco import review_doc
from helpers import find_steps

ID_AGENTE = "ventaglio"
VARIABILE = "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"
INIZIO_PROCEDURA = "Esegui il collaudo della PR"
REGOLA_PRIMO_PIANO = ("I subagent si lanciano con lo strumento Agent in primo piano, mai in "
                      "background: `run_in_background` non si usa, o vale `false`. Dopo averli "
                      "lanciati attendi il loro esito nello stesso turno, prima di ogni altra cosa.")
REGOLA_VERDETTO = ("Il lavoro finisce solo quando il file del verdetto è scritto. Scrivi il "
                   "verdetto prima di terminare.")
REGOLA_ATTESA = ("Un messaggio che dice di attendere i subagent non chiude il lavoro: non "
                 "terminare il turno con un messaggio di attesa.")


def _agente() -> dict:
    passi = [s for s in find_steps(review_doc()["jobs"]["ventaglio"]) if s.get("id") == ID_AGENTE]
    assert len(passi) == 1, f"step con id {ID_AGENTE}: {len(passi)}"
    return passi[0]


def _prompt() -> str:
    """Il prompt con gli spazi normalizzati: un a capo spostato non e' una regola tolta."""
    return " ".join(str(_agente()["with"]["prompt"]).split())


def _strumenti(opzione: str) -> list[str]:
    argomenti = shlex.split(str(_agente()["with"]["claude_args"]))
    valori = [argomenti[i + 1] for i, a in enumerate(argomenti) if a == opzione]
    assert len(valori) == 1, f"{opzione} compare {len(valori)} volte"
    return valori[0].split(",")


class TestStaticaAttesaDeiSubagent(unittest.TestCase):

    def test_lo_step_dell_agente_e_la_claude_code_action(self):
        self.assertEqual(str(_agente().get("uses", "")).split("@")[0],
                         "anthropics/claude-code-action")

    def test_variabile_a_1_nell_env_dello_step_dell_agente(self):
        env = _agente().get("env") or {}
        self.assertIn(VARIABILE, env)
        # Stringa, non intero: un 1 senza virgolette e' un numero per il parser.
        self.assertEqual(env[VARIABILE], "1")

    def test_prompt_senza_riferimento_alla_skill(self):
        prompt = _prompt()
        self.assertNotIn("CLAUDE_PLUGIN_ROOT", prompt)
        self.assertNotIn("SKILL.md", prompt)

    def _in_testa(self, regola: str):
        prompt = _prompt()
        self.assertEqual(prompt.count(regola), 1)
        self.assertEqual(prompt.count(INIZIO_PROCEDURA), 1)
        self.assertLess(prompt.index(regola), prompt.index(INIZIO_PROCEDURA),
                        "la regola sta dopo l'inizio della procedura")

    def test_regola_dei_subagent_in_primo_piano(self):
        self._in_testa(REGOLA_PRIMO_PIANO)

    def test_regola_del_verdetto_prima_di_terminare(self):
        self._in_testa(REGOLA_VERDETTO)

    def test_regola_dell_attesa(self):
        self._in_testa(REGOLA_ATTESA)

    def test_agent_e_non_task_fra_gli_strumenti_ammessi(self):
        ammessi = _strumenti("--allowedTools")
        self.assertIn("Agent", ammessi)
        self.assertNotIn("Task", ammessi)


if __name__ == "__main__":
    unittest.main()
