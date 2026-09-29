"""Banco per eseguire i frammenti `run:` del job `pubblica` di claude-pr-review.yml.

Non e' un test (nessun prefisso test_): lo usano test_collaudo_commenti.py e
test_collaudo_isolamento.py.

Dal #69 (659ade6) il collaudo e' in due job: `ventaglio` (l'agente) e `pubblica`.
Qui si eseguono, in ordine e cosi' come sono nel YAML, i due step di `pubblica`
che contano: «Prepara il verdetto» e «Pubblica il verdetto». Lo step di upload
del verdetto lungo non si esegue: il suo unico effetto sul seguito e' l'output
artifact-url, che il banco simula.

Fedelta' al YAML:
  - il `run:` e' estratto, non riscritto, ed eseguito con `bash -e` (la shell di
    GitHub per uno step senza `shell:` su ubuntu);
  - l'`env:` di ogni step si risolve dalle espressioni scritte nel YAML, con un
    contesto esplicito: un'espressione che il banco non conosce e' un errore,
    cosi' un env cambiato nel workflow non passa inosservato;
  - l'env a livello di workflow (BUDGET_VENTAGLIO_MIN) si legge dal YAML;
  - lo script collaudo-esito.sh e' quello di ci_root(), posato nel checkout
    finto ($GITHUB_WORKSPACE/.github/scripts), come fa lo step di checkout.

Un `gh` finto in PATH registra le chiamate e risponde a tre API:
  - …/actions/runs/N/artifacts?name=…   (JSON {"total_count": N})
  - …/actions/runs/N/attempts/N/jobs     (JSON dei job, filtrato con il --jq vero)
  - …/issues/N/comments                  (fixture dei commenti)
e a `gh pr comment --body-file`, di cui conserva i corpi.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import tempfile

from helpers import ci_root, find_steps, load_yaml, workflow_dir

FIXTURE = pathlib.Path(__file__).resolve().parent / "fixtures" / "collaudo-esito"

SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
ASSENTE, VUOTO = "assente", "vuoto"
USCITA_GH = 7
REPO = "OwnConsent/ownconsent-www"
RUN_ID = "4242"
ATTEMPT = "1"
PR = "99"
T0 = dt.datetime(2026, 9, 29, 19, 0, 0, tzinfo=dt.timezone.utc)

GH_FINTO = r"""#!/usr/bin/env bash
# gh finto: registra ogni chiamata, una per riga, in $GH_LOG.
printf '%s\n' "$*" >> "$GH_LOG"
case "$1" in
  api)
    percorso=$2; shift 2
    filtro=""
    while [ "$#" -gt 0 ]; do
      case "$1" in --jq) filtro=$2; shift ;; esac
      shift
    done
    case "$percorso" in
      */issues/*/comments)
        if [ -n "${GH_API_FALLISCE:-}" ]; then
          echo "HTTP 502: Bad Gateway" >&2
          exit "$GH_API_FALLISCE"
        fi
        risposta=$GH_API_RISPOSTA ;;
      */attempts/*/jobs)
        if [ -n "${GH_JOBS_FALLISCE:-}" ]; then
          echo "HTTP 502: Bad Gateway" >&2
          exit 1
        fi
        risposta=$GH_JOBS_RISPOSTA ;;
      */artifacts\?name=*)
        risposta=$GH_ARTIFACTS_RISPOSTA ;;
      *)
        echo "gh finto: api inattesa: $percorso" >&2
        exit 99 ;;
    esac
    if [ -n "$filtro" ]; then jq -r "$filtro" "$risposta"; else cat "$risposta"; fi
    ;;
  pr)
    if [ "$2" = comment ]; then
      n=$(ls "$GH_PUBBLICATI" | wc -l)
      while [ "$#" -gt 0 ]; do
        if [ "$1" = --body-file ]; then cp "$2" "$GH_PUBBLICATI/$n.md"; fi
        shift
      done
      echo "https://example.invalid/pr/99#issuecomment-$((9000 + n))"
    else
      echo "gh finto: pr $2 inatteso" >&2
      exit 99
    fi
    ;;
  *)
    echo "gh finto: comando inatteso: $*" >&2
    exit 99 ;;
esac
"""


def script_path() -> pathlib.Path:
    return ci_root() / ".github" / "scripts" / "collaudo-esito.sh"


def review_doc() -> dict:
    return load_yaml(workflow_dir() / "claude-pr-review.yml")


def step_di(job: dict, nome: str) -> dict:
    for s in find_steps(job):
        if s.get("name") == nome:
            return s
    raise AssertionError(f"step «{nome}» non trovato")


_ESPR = re.compile(r"\$\{\{\s*(.*?)\s*\}\}")


def risolvi(valore, contesto: dict) -> str:
    """Sostituisce ogni ${{ espressione }} con contesto[espressione]."""
    def sost(m):
        e = m.group(1)
        if e not in contesto:
            raise AssertionError(f"espressione non prevista dal banco: ${{{{ {e} }}}}")
        return str(contesto[e])
    return _ESPR.sub(sost, str(valore))


def iso(t: dt.datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def risposta_jobs(trascorsi: int) -> dict:
    """JSON dell'API dei job. Lo step che conta dura `trascorsi` secondi; attorno,
    esche con durate diverse: un altro job con uno step dallo stesso nome (messo
    prima), e altri step del job ventaglio che durano molto di piu'."""
    fine = T0 + dt.timedelta(seconds=trascorsi)
    lontano = T0 + dt.timedelta(hours=5)
    return {"total_count": 3, "jobs": [
        {"name": "altro", "steps": [
            {"name": "Ventaglio di revisione", "number": 1,
             "started_at": iso(T0), "completed_at": iso(T0 + dt.timedelta(seconds=7))}]},
        {"name": "ventaglio", "steps": [
            {"name": "Set up job", "number": 1,
             "started_at": iso(T0 - dt.timedelta(hours=5)), "completed_at": iso(T0)},
            {"name": "Inizio del ventaglio", "number": 4,
             "started_at": iso(T0 - dt.timedelta(hours=4)), "completed_at": iso(T0)},
            {"name": "Ventaglio di revisione", "number": 5,
             "started_at": iso(T0), "completed_at": iso(fine)},
            {"name": "Diagnostica del ventaglio", "number": 6,
             "started_at": iso(fine), "completed_at": iso(lontano)}]},
        {"name": "pubblica", "steps": [
            {"name": "Pubblica il verdetto", "number": 5,
             "started_at": iso(lontano), "completed_at": None}]},
    ]}


def esegui_job(*, verdetto=ASSENTE, esito="failure", trascorsi=100,
               api_fallisce=False, risposta="vuoto.json", commenti_piantati=None,
               jobs_falliscono=False, inizio=None, artefatti_contati=None,
               scaricato=None, testo_grezzo=None):
    """Esegue «Prepara il verdetto» e poi «Pubblica il verdetto» del job pubblica.

    verdetto          ASSENTE (nessun artifact), VUOTO, o il testo del file
    esito             needs.ventaglio.outputs.esito
    trascorsi         durata dello step agente secondo l'API dei job
    jobs_falliscono   l'API dei job risponde con un errore
    inizio            needs.ventaglio.outputs.inizio (default: adesso, cosi' la
                      riserva darebbe ~0 s e non puo' simulare un timeout)
    artefatti_contati total_count dell'API degli artifact (default: 1 se c'e'
                      un verdetto, 0 altrimenti)
    scaricato         outcome del download (default: success se c'e' un verdetto)

    Ritorna dict(rc, rc_prepara, uscite_prepara, stdout, chiamate_gh, api,
    api_commenti, pubblicati)."""
    doc = review_doc()
    job = doc["jobs"]["pubblica"]
    prepara = step_di(job, "Prepara il verdetto")
    pubblica = step_di(job, "Pubblica il verdetto")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        ws, rt, binf, pub = tmp / "ws", tmp / "runner_temp", tmp / "bin", tmp / "pubblicati"
        for d in (ws / ".github" / "scripts", rt, binf, pub):
            d.mkdir(parents=True)
        shutil.copy(script_path(), ws / ".github" / "scripts" / "collaudo-esito.sh")
        c_temp = str(rt)
        # Il download, se c'e' un artifact, lo posa dove dice il YAML.
        scarica = step_di(job, "Ricevi il verdetto")
        destinazione = pathlib.Path(risolvi(scarica["with"]["path"], {"runner.temp": c_temp}))
        if verdetto != ASSENTE:
            destinazione.mkdir(parents=True)
            f = destinazione / "verdetto.md"
            if testo_grezzo is not None:
                f.write_bytes(testo_grezzo)
            else:
                f.write_text("" if verdetto == VUOTO else verdetto, encoding="utf-8")
        if scaricato is None:
            scaricato = "success" if verdetto != ASSENTE else "failure"
        if artefatti_contati is None:
            artefatti_contati = 0 if verdetto == ASSENTE else 1
        if commenti_piantati:
            shutil.copy(FIXTURE / commenti_piantati, rt / "commenti.json")
        f_art = tmp / "artifacts.json"
        f_art.write_text(json.dumps({"total_count": artefatti_contati}), encoding="utf-8")
        f_jobs = tmp / "jobs.json"
        f_jobs.write_text(json.dumps(risposta_jobs(trascorsi)), encoding="utf-8")
        gh = binf / "gh"
        gh.write_text(GH_FINTO, encoding="utf-8")
        gh.chmod(gh.stat().st_mode | stat.S_IXUSR)
        log = tmp / "gh.log"
        log.touch()
        if inizio is None:
            inizio = str(int(dt.datetime.now().timestamp()))

        base = {
            "PATH": f"{binf}{os.pathsep}{os.environ['PATH']}",
            "HOME": str(tmp),
            "GITHUB_WORKSPACE": str(ws),
            "RUNNER_TEMP": c_temp,
            "GITHUB_REPOSITORY": REPO,
            "GITHUB_RUN_ID": RUN_ID,
            "GITHUB_RUN_ATTEMPT": ATTEMPT,
            "GH_LOG": str(log),
            "GH_PUBBLICATI": str(pub),
            "GH_API_RISPOSTA": str(FIXTURE / risposta),
            "GH_JOBS_RISPOSTA": str(f_jobs),
            "GH_ARTIFACTS_RISPOSTA": str(f_art),
        }
        if api_fallisce:
            base["GH_API_FALLISCE"] = str(USCITA_GH)
        if jobs_falliscono:
            base["GH_JOBS_FALLISCE"] = "1"
        for k, v in (doc.get("env") or {}).items():
            base[k] = str(v)
        for k, v in (job.get("env") or {}).items():
            base[k] = str(v)

        contesto = {
            "github.token": "finto",
            "runner.temp": c_temp,
            "github.run_attempt": ATTEMPT,
            "github.event.pull_request.number": PR,
            "github.event.pull_request.head.sha": SHA,
            "steps.scarica.outcome": scaricato,
            "needs.ventaglio.outputs.esito": esito,
            "needs.ventaglio.outputs.inizio": inizio,
        }

        def esegui_step(step, nome_file):
            out = tmp / f"{nome_file}.output"
            out.touch()
            env = dict(base)
            env["GITHUB_OUTPUT"] = str(out)
            for k, v in (step.get("env") or {}).items():
                env[k] = risolvi(v, contesto)
            frammento = tmp / f"{nome_file}.sh"
            frammento.write_text(step["run"], encoding="utf-8")
            p = subprocess.run(["bash", "-e", str(frammento)], env=env, cwd=ws,
                               capture_output=True, text=True, timeout=60)
            uscite = {}
            for r in out.read_text(encoding="utf-8").splitlines():
                if "=" in r:
                    k, v = r.split("=", 1)
                    uscite[k] = v
            return p, uscite

        p1, uscite = esegui_step(prepara, "prepara")
        contesto["steps.prepara.outcome"] = "success" if p1.returncode == 0 else "failure"
        contesto["steps.prepara.outputs.uscita"] = uscite.get("uscita", "")
        contesto["steps.prepara.outputs.lungo"] = uscite.get("lungo", "")
        contesto["steps.artefatto.outputs.artifact-url"] = (
            "https://example.invalid/artifacts/1" if uscite.get("lungo") == "true" else "")
        p2, _ = esegui_step(pubblica, "pubblica")

        chiamate = [r for r in log.read_text(encoding="utf-8").splitlines() if r]
        pubblicati = [f.read_text(encoding="utf-8")
                      for f in sorted(pub.iterdir(), key=lambda f: int(f.stem))]
        api = [c for c in chiamate if c.startswith("api ")]
        return dict(rc=p2.returncode, rc_prepara=p1.returncode, uscite_prepara=uscite,
                    stdout=p1.stdout + p1.stderr + p2.stdout + p2.stderr,
                    chiamate_gh=chiamate, api=api,
                    api_commenti=[c for c in api if "/comments" in c],
                    api_jobs=[c for c in api if "/jobs" in c],
                    api_artefatti=[c for c in api if "/artifacts" in c],
                    pubblicati=pubblicati)
