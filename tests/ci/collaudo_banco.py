"""Banco per eseguire i frammenti `run:` del job `pubblica` di claude-pr-review.yml.

Non e' un test (nessun prefisso test_): lo usano test_collaudo_commenti.py e
test_collaudo_isolamento.py.

Dal #69 (659ade6) il collaudo e' in due job: `ventaglio` (l'agente) e `pubblica`.
Qui si eseguono, in ordine e cosi' come sono nel YAML, gli step `run:` di
`pubblica` che contano: «Scegli il verdetto» (da beab008), «Prepara il verdetto»
e «Pubblica il verdetto». Gli step `uses:` si simulano:
  - «Ricevi il verdetto» (download-artifact): il suo `if:` si valuta (sono
    ammesse solo le forme che il banco conosce); con un nome, scarica
    l'artifact con quel nome se esiste nel run, altrimenti outcome failure;
    con name vuoto scarica TUTTI gli artifact del run, ognuno in una
    sottocartella col suo nome (download-artifact action.yml, input name:
    'If unspecified, all artifacts for the run are downloaded');
  - «Conserva il verdetto intero»: solo l'output artifact-url.

Un artifact del ventaglio contiene sempre giro.txt (beab008) e, se l'agente
l'ha scritto, verdetto.md. «Agente muto» = artifact col solo giro.txt.

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
  - …/actions/runs/N/artifacts           (JSON degli artifact del run, --jq vero)
  - …/actions/runs/N/attempts/A/jobs     (JSON dei job DELL'ATTEMPT A, filtrato con il
                                          --jq vero; un attempt che il banco non
                                          conosce risponde 404)
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
        a=${percorso%/jobs}; a=${a##*/attempts/}
        risposta="$GH_JOBS_DIR/$a.json"
        if [ ! -f "$risposta" ]; then
          echo "HTTP 404: Not Found" >&2
          exit 1
        fi ;;
      */actions/runs/*/artifacts)
        if [ -n "${GH_ARTIFACTS_FALLISCE:-}" ]; then
          echo "HTTP 502: Bad Gateway" >&2
          exit 1
        fi
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


def risposta_jobs(trascorsi) -> dict:
    """JSON dell'API dei job di un attempt. Lo step che conta dura `trascorsi`
    secondi; attorno, esche con durate diverse: un altro job con uno step dallo
    stesso nome (messo prima), e altri step del job ventaglio che durano molto di
    piu'. trascorsi=None: l'attempt in cui il ventaglio non ha girato (rerun del
    solo pubblica: la copia del ventaglio non ha gli step, voce 2026-09-29/104703).
    trascorsi="vuoti": lo step c'e' ma completed_at e' null."""
    if trascorsi is None:
        return {"total_count": 2, "jobs": [
            {"name": "ventaglio", "steps": []},
            {"name": "pubblica", "steps": [
                {"name": "Pubblica il verdetto", "number": 5,
                 "started_at": iso(T0), "completed_at": None}]}]}
    if trascorsi == "vuoti":
        return {"total_count": 1, "jobs": [
            {"name": "ventaglio", "steps": [
                {"name": "Ventaglio di revisione", "number": 5,
                 "started_at": iso(T0), "completed_at": None}]}]}
    fine = T0 + dt.timedelta(seconds=trascorsi)
    lontano = T0 + dt.timedelta(hours=5)
    return {"total_count": 3, "jobs": [
        {"name": "altro", "steps": [
            {"name": "Ventaglio di revisione", "number": 1,
             "started_at": iso(T0), "completed_at": iso(T0 + dt.timedelta(seconds=7))}]},
        {"name": "ventaglio", "steps": [
            {"name": "Set up job", "number": 1,
             "started_at": iso(T0 - dt.timedelta(hours=5)), "completed_at": iso(T0)},
            {"name": "Commit sotto collaudo", "number": 4,
             "started_at": iso(T0 - dt.timedelta(hours=4)), "completed_at": iso(T0)},
            {"name": "Ventaglio di revisione", "number": 5,
             "started_at": iso(T0), "completed_at": iso(fine)},
            {"name": "Diagnostica del ventaglio", "number": 6,
             "started_at": iso(fine), "completed_at": iso(lontano)}]},
        {"name": "pubblica", "steps": [
            {"name": "Pubblica il verdetto", "number": 5,
             "started_at": iso(lontano), "completed_at": None}]},
    ]}


NOME_DI = "verdetto-tentativo-{}".format
IF_DOWNLOAD = "${{ steps.scegli.outputs.nome != '' }}"


def _posa_artifact(cartella: pathlib.Path, verdetto) -> None:
    cartella.mkdir(parents=True, exist_ok=True)
    (cartella / "giro.txt").write_text("tentativo ?\n", encoding="utf-8")
    if verdetto != ASSENTE:
        (cartella / "verdetto.md").write_text("" if verdetto == VUOTO else verdetto,
                                              encoding="utf-8")


def esegui_job(*, verdetto=ASSENTE, esito="failure", trascorsi=100,
               api_fallisce=False, risposta="vuoto.json", commenti_piantati=None,
               jobs_falliscono=False, tentativo="1", run_attempt="1", tempi=None,
               artefatti=None, download_fallisce=False, artefatti_falliscono=False,
               altri_nel_run=("verdetto-completo-tentativo-1",), prepara_illeggibile=False):
    """Esegue Scegli, (Ricevi simulato), Prepara, Pubblica del job pubblica.

    verdetto          contenuto dell'artifact del tentativo `tentativo`:
                      ASSENTE (solo giro.txt: agente muto), VUOTO, o il testo
    tentativo         needs.ventaglio.outputs.tentativo ("" = output vuoto)
    run_attempt       github.run_attempt / GITHUB_RUN_ATTEMPT del job pubblica
    artefatti         {nome: contenuto} degli artifact del ventaglio nel run;
                      default {verdetto-tentativo-<tentativo o run_attempt>: verdetto}
    altri_nel_run     altri nomi che l'API elenca (non del ventaglio)
    download_fallisce il download fallisce anche se l'artifact esiste
    artefatti_falliscono l'API degli artifact risponde con un errore
    tempi             {attempt: trascorsi | None | "vuoti"} per l'API dei job, per
                      attempt; default: l'attempt del ventaglio (il tentativo
                      valido, o il piu' alto degli artifact non oltre run_attempt,
                      o run_attempt) con `trascorsi`, ogni altro attempt fino a
                      run_attempt senza step
    esito, trascorsi, jobs_falliscono, api_fallisce, risposta,
    commenti_piantati: come prima (vedi test_collaudo_commenti.py)

    Ritorna dict(rc, rc_prepara, uscite_prepara, nome, scaricato, stdout,
    chiamate_gh, api, api_commenti, api_jobs, api_artefatti, pubblicati)."""
    doc = review_doc()
    job = doc["jobs"]["pubblica"]
    scegli = step_di(job, "Scegli il verdetto")
    scarica = step_di(job, "Ricevi il verdetto")
    prepara = step_di(job, "Prepara il verdetto")
    pubblica = step_di(job, "Pubblica il verdetto")
    if artefatti is None:
        artefatti = {NOME_DI(tentativo or run_attempt): verdetto}
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        ws, rt, binf, pub = tmp / "ws", tmp / "runner_temp", tmp / "bin", tmp / "pubblicati"
        for d in (ws / ".github" / "scripts", rt, binf, pub):
            d.mkdir(parents=True)
        shutil.copy(script_path(), ws / ".github" / "scripts" / "collaudo-esito.sh")
        c_temp = str(rt)
        if commenti_piantati:
            shutil.copy(FIXTURE / commenti_piantati, rt / "commenti.json")
        f_art = tmp / "artifacts.json"
        nomi_run = list(altri_nel_run) + list(artefatti)
        f_art.write_text(json.dumps({"total_count": len(nomi_run), "artifacts": [
            {"id": 100 + i, "name": n} for i, n in enumerate(nomi_run)]}), encoding="utf-8")
        if tempi is None:
            if re.fullmatch(r"[1-9][0-9]*", tentativo or ""):
                a_v = tentativo
            else:
                numeri = [int(m.group(1)) for n in artefatti
                          for m in [re.fullmatch(r"verdetto-tentativo-([1-9][0-9]*)", n)] if m
                          and int(m.group(1)) <= int(run_attempt)]
                a_v = str(max(numeri)) if numeri else run_attempt
            tempi = {str(a): None for a in range(1, max(int(run_attempt), int(a_v)) + 1)}
            tempi[a_v] = trascorsi
        d_jobs = tmp / "jobs"
        d_jobs.mkdir()
        for a, t in tempi.items():
            (d_jobs / f"{a}.json").write_text(json.dumps(risposta_jobs(t)), encoding="utf-8")
        gh = binf / "gh"
        gh.write_text(GH_FINTO, encoding="utf-8")
        gh.chmod(gh.stat().st_mode | stat.S_IXUSR)
        log = tmp / "gh.log"
        log.touch()

        base = {
            "PATH": f"{binf}{os.pathsep}{os.environ['PATH']}",
            "HOME": str(tmp),
            "GITHUB_WORKSPACE": str(ws),
            "RUNNER_TEMP": c_temp,
            "GITHUB_REPOSITORY": REPO,
            "GITHUB_RUN_ID": RUN_ID,
            "GITHUB_RUN_ATTEMPT": run_attempt,
            "GH_LOG": str(log),
            "GH_PUBBLICATI": str(pub),
            "GH_API_RISPOSTA": str(FIXTURE / risposta),
            "GH_JOBS_DIR": str(d_jobs),
            "GH_ARTIFACTS_RISPOSTA": str(f_art),
        }
        if api_fallisce:
            base["GH_API_FALLISCE"] = str(USCITA_GH)
        if jobs_falliscono:
            base["GH_JOBS_FALLISCE"] = "1"
        if artefatti_falliscono:
            base["GH_ARTIFACTS_FALLISCE"] = "1"
        for k, v in (doc.get("env") or {}).items():
            base[k] = str(v)
        for k, v in (job.get("env") or {}).items():
            base[k] = str(v)

        contesto = {
            "github.token": "finto",
            "runner.temp": c_temp,
            "github.run_attempt": run_attempt,
            "github.event.pull_request.number": PR,
            "github.event.pull_request.head.sha": SHA,
            "needs.ventaglio.outputs.esito": esito,
            "needs.ventaglio.outputs.tentativo": tentativo,
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

        p0, u0 = esegui_step(scegli, "scegli")
        nome = u0.get("nome", "")
        contesto["steps.scegli.outputs.nome"] = nome
        contesto["steps.scegli.outputs.tentativo"] = u0.get("tentativo", "")

        # «Ricevi il verdetto», simulato. L'if si valuta solo nelle forme note.
        cond = scarica.get("if")
        if cond is None:
            gira = p0.returncode == 0
        elif str(cond).strip() == IF_DOWNLOAD:
            gira = p0.returncode == 0 and nome != ""
        else:
            raise AssertionError(f"if del download non previsto dal banco: {cond!r}")
        destinazione = pathlib.Path(risolvi(scarica["with"]["path"], {"runner.temp": c_temp}))
        nome_chiesto = risolvi(scarica["with"].get("name", ""), contesto)
        if not gira:
            scaricato = "skipped"
        elif download_fallisce:
            scaricato = "failure"
        elif nome_chiesto == "":
            for n, v in artefatti.items():
                _posa_artifact(destinazione / n, v)
            scaricato = "success"
        elif nome_chiesto in artefatti:
            _posa_artifact(destinazione, artefatti[nome_chiesto])
            scaricato = "success"
        else:
            scaricato = "failure"
        if prepara_illeggibile and (destinazione / "verdetto.md").exists():
            (destinazione / "verdetto.md").chmod(0)
        contesto["steps.scarica.outcome"] = scaricato

        p1, uscite = esegui_step(prepara, "prepara")
        contesto["steps.prepara.outcome"] = "success" if p1.returncode == 0 else "failure"
        contesto["steps.prepara.outputs.uscita"] = uscite.get("uscita", "")
        contesto["steps.prepara.outputs.lungo"] = uscite.get("lungo", "")
        contesto["steps.prepara.outputs.artifact"] = uscite.get("artifact", "")
        contesto["steps.artefatto.outputs.artifact-url"] = (
            "https://example.invalid/artifacts/1" if uscite.get("lungo") == "true" else "")
        p2, _ = esegui_step(pubblica, "pubblica")

        chiamate = [r for r in log.read_text(encoding="utf-8").splitlines() if r]
        pubblicati = [f.read_text(encoding="utf-8")
                      for f in sorted(pub.iterdir(), key=lambda f: int(f.stem))]
        api = [c for c in chiamate if c.startswith("api ")]
        return dict(rc=p2.returncode, tentativo_scelto=u0.get("tentativo", ""), rc_scegli=p0.returncode, rc_prepara=p1.returncode,
                    uscite_prepara=uscite, nome=nome, nome_chiesto=nome_chiesto,
                    scaricato=scaricato,
                    stdout=p0.stdout + p0.stderr + p1.stdout + p1.stderr + p2.stdout + p2.stderr,
                    chiamate_gh=chiamate, api=api,
                    api_commenti=[c for c in api if "/comments" in c],
                    api_jobs=[c for c in api if "/jobs" in c],
                    api_artefatti=[c for c in api if "/artifacts" in c],
                    pubblicati=pubblicati)
