"""Mutazioni del workflow e dello script del collaudo (#69), ognuna su una copia via CI_ROOT.

Non e' un test (nessun prefisso test_): e' il banco delle prove-by-mutation dei
test di test_collaudo_{esito,commenti,isolamento}.py. Ogni mutazione deve far
diventare ROSSO il test bersaglio; una riga «VERDE!!» e' un test che non prova
cio' che dichiara.

Uso, da tests/ci:  python3 mutazioni_collaudo.py [nome ...]
Per ogni mutazione: copia .github in una cartella nuova, applica la sostituzione
(che deve colpire esattamente il numero atteso di occorrenze), esegue il test
bersaglio con CI_ROOT=<copia> e poi i tre moduli del collaudo, e stampa esito."""
import os
import re
import shutil
import subprocess
import sys
import tempfile

import pathlib
TESTS = str(pathlib.Path(__file__).resolve().parent)
WT = str(pathlib.Path(TESTS).parents[1])
WF = ".github/workflows/claude-pr-review.yml"
SC = ".github/scripts/collaudo-esito.sh"
C = "test_collaudo_commenti"
E = "test_collaudo_esito"
I = "test_collaudo_isolamento"

# (nome, file, vecchio, nuovo, regex?, bersagli)
M = [
    ("gh-commenti-prima-dello-script", WF,
     '          commenti="$RUNNER_TEMP/commenti.json"\n',
     '          commenti="$RUNNER_TEMP/commenti.json"\n          gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate > /dev/null || true\n',
     False, [f"{C}.TestStaticaLetturaDeiCommenti.test_a_nessuna_lettura_dei_commenti_prima_della_decisione_sul_file",
             f"{C}.TestEsecuzioneDelloStep.test_verdetto_scritto_si_pubblica_senza_chiamare_l_api"]),
    ("nessun-verdetto-verde", WF,
     r'(revisionato\."\n\s+)exit 1 ;;', r'\1exit 0 ;;', True,
     [f"{E}.TestStaticaWorkflow.test_parola_dello_script_e_colore_del_passo",
      f"{C}.TestEsecuzioneDelloStep.test_lettura_riuscita_nessun_verdetto_rosso"]),
    ("ramo-sconosciuto-senza-non_presa", WF,
     'non_presa "$rc" "collaudo-esito.sh ha risposto con una parola sconosciuta: \'${decisione}\'." ;;',
     'exit 1 ;;', False,
     [f"{E}.TestStaticaWorkflow.test_parola_dello_script_e_colore_del_passo"]),
    ("budget-ridefinito-in-pubblica", WF,
     "    timeout-minutes: 10\n", "    timeout-minutes: 10\n    env:\n      BUDGET_VENTAGLIO_MIN: 30\n", False,
     [f"{E}.TestStaticaWorkflow.test_fonte_unica_del_budget"]),
    ("budget-spostato-nel-job-ventaglio", WF,
     "env:\n  # Fonte unica del budget: la legge il timeout-minutes dello step ventaglio\n  # e la legge .github/scripts/collaudo-esito.sh per riconoscere il timeout.\n  BUDGET_VENTAGLIO_MIN: 30\n",
     "", False,
     [f"{E}.TestStaticaWorkflow.test_budget_intero_definito_dal_workflow",
      f"{E}.TestStaticaWorkflow.test_fonte_unica_del_budget"]),
    ("timeout-job-sotto-il-budget", WF,
     "    timeout-minutes: 35\n", "    timeout-minutes: 25\n", False,
     [f"{E}.TestStaticaWorkflow.test_timeout_del_job_35_e_sopra_il_budget"]),
    ("ventaglio-copia-lo-script", WF,
     "      - name: Inizio del ventaglio\n",
     '      - name: Copia lo script\n        run: cp .github/scripts/collaudo-esito.sh "$RUNNER_TEMP/"\n\n      - name: Inizio del ventaglio\n',
     False, [f"{E}.TestStaticaWorkflow.test_script_eseguito_dal_checkout_di_pubblica"]),
    ("script-da-runner-temp", WF,
     'bash "$GITHUB_WORKSPACE/.github/scripts/collaudo-esito.sh"',
     'bash "$RUNNER_TEMP/collaudo-esito.sh"', False,
     [f"{E}.TestStaticaWorkflow.test_script_eseguito_dal_checkout_di_pubblica"]),
    ("sparse-checkout-senza-scripts", WF,
     "sparse-checkout: .github/scripts", "sparse-checkout: .github/workflows", False,
     [f"{E}.TestStaticaWorkflow.test_script_eseguito_dal_checkout_di_pubblica"]),
    ("tempi-api-non-tolleranti", WF,
     ' \\\n            2>/dev/null | head -n 1) || tempi=""', ')', False,
     [f"{C}.TestEsecuzioneDelloStep.test_verdetto_scritto_si_pubblica_senza_chiamare_l_api"]),
    ("neutralizzazione-tolta", WF,
     "          s = re.sub('cantiere-collaudo', lambda m: m.group(0).replace('-', '‑'), s, flags=re.I)\n",
     "          s = s\n", False,
     [f"{I}.TestEsecuzioneIsolamento.test_marcatore_falso_nel_testo_dell_agente_si_neutralizza"]),
    ("neutralizzazione-solo-minuscolo", WF,
     "lambda m: m.group(0).replace('-', '‑'), s, flags=re.I)",
     "lambda m: m.group(0).replace('-', '‑'), s)", False,
     [f"{I}.TestEsecuzioneIsolamento.test_marcatore_falso_nel_testo_dell_agente_si_neutralizza"]),
    ("marcatore-accettato-ovunque", SC,
     '| split("\\n")[0] | rtrimstr("\\r") == $m)',
     '| contains($m))', False,
     [f"{I}.TestEsecuzioneIsolamento.test_marcatore_vero_fuori_dal_primo_rigo_nessun_rimando",
      f"{E}.TestChiContaComeVerdettoPrecedente.test_marcatore_non_nel_primo_rigo_non_conta"]),
    ("non_presa-muta", WF,
     r"non_presa\(\) \{\n.*?\n          \}\n", "non_presa() {\n            exit 1\n          }\n", True,
     [f"{I}.TestEsecuzioneIsolamento.test_uscita_imprevista_dello_script_decisione_non_presa",
      f"{I}.TestEsecuzioneIsolamento.test_uscita_imprevista_di_prepara_decisione_non_presa"]),
    ("non_presa-uscita-fissa", WF,
     '"${SHA:0:7}" "$1" "$2" > "$corpo"', '"${SHA:0:7}" "1" "$2" > "$corpo"', False,
     [f"{I}.TestEsecuzioneIsolamento.test_uscita_imprevista_dello_script_decisione_non_presa",
      f"{I}.TestEsecuzioneIsolamento.test_uscita_imprevista_di_prepara_decisione_non_presa"]),
    ("non_presa-con-marcatore", WF,
     "printf 'Commit `%s`\\n\\n**Collaudo: decisione non presa",
     "printf '<!-- cantiere-collaudo tipo=verdetto sha=x -->\\nCommit `%s`\\n\\n**Collaudo: decisione non presa",
     False,
     [f"{I}.TestEsecuzioneIsolamento.test_uscita_imprevista_dello_script_decisione_non_presa"]),
    ("tempi-dallo-step-sbagliato", WF,
     'select(.name == "Ventaglio di revisione")', 'select(.name == "Inizio del ventaglio")', False,
     [f"{I}.TestEsecuzioneIsolamento.test_timeout_dai_tempi_dell_api_dei_job"]),
    ("tempi-da-qualunque-job", WF,
     '.jobs[] | select(.name == "ventaglio") | .steps[]', '.jobs[] | .steps[]', False,
     [f"{I}.TestEsecuzioneIsolamento.test_timeout_dai_tempi_dell_api_dei_job"]),
    ("tempi-invertiti", WF,
     '"\\(.started_at) \\(.completed_at)"', '"\\(.completed_at) \\(.started_at)"', False,
     [f"{I}.TestEsecuzioneIsolamento.test_timeout_dai_tempi_dell_api_dei_job"]),
    ("confine-maggiore-stretto", SC,
     '[ "$trascorsi" -ge $((budget * 60)) ]', '[ "$trascorsi" -gt $((budget * 60)) ]', False,
     [f"{I}.TestEsecuzioneIsolamento.test_timeout_dai_tempi_dell_api_dei_job"]),
    ("confine-meno-un-secondo", SC,
     '[ "$trascorsi" -ge $((budget * 60)) ]', '[ "$trascorsi" -ge $((budget * 60 - 1)) ]', False,
     [f"{I}.TestEsecuzioneIsolamento.test_timeout_dai_tempi_dell_api_dei_job"]),
    ("riserva-tolta", WF,
     'elif [[ "$INIZIO" =~ ^[0-9]+$ ]]; then', 'elif false; then', False,
     [f"{I}.TestEsecuzioneIsolamento.test_api_dei_job_muta_riserva_dall_inizio_registrato"]),
    ("timeout-anche-con-success", SC,
     'if [ "$esito" != "success" ] && [ "$trascorsi"', 'if [ "$trascorsi"', False,
     [f"{I}.TestEsecuzioneIsolamento.test_timeout_con_esito_success_non_e_timeout"]),
    ("ventaglio-pull-requests-write", WF,
     "      contents: read\n      pull-requests: read\n", "      contents: read\n      pull-requests: write\n", False,
     [f"{I}.TestStaticaIsolamento.test_ventaglio_senza_permessi_di_scrittura",
      f"{I}.TestStaticaIsolamento.test_pubblica_unico_job_con_pull_requests_write"]),
    ("ventaglio-senza-permissions", WF,
     "    permissions:\n      contents: read\n      pull-requests: read\n", "", False,
     [f"{I}.TestStaticaIsolamento.test_ventaglio_senza_permessi_di_scrittura"]),
    ("workflow-write-all", WF,
     "\npermissions: {}\n", "\npermissions: write-all\n", False,
     [f"{I}.TestStaticaIsolamento.test_ventaglio_senza_permessi_di_scrittura",
      f"{I}.TestStaticaIsolamento.test_workflow_senza_permessi_a_livello_workflow"]),
    ("pubblica-contents-write", WF,
     "      contents: read\n      actions: read\n", "      contents: write\n      actions: read\n", False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_unico_job_con_pull_requests_write"]),
    ("always-al-posto-di-not-cancelled", WF,
     "if: ${{ !cancelled() && github.event.pull_request.draft == false }}",
     "if: ${{ always() && github.event.pull_request.draft == false }}", False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_dipende_da_ventaglio_e_gira_con_not_cancelled"]),
    ("persist-credentials-tolto-in-pubblica", WF,
     "          persist-credentials: false\n          sparse-checkout", "          sparse-checkout", False,
     [f"{I}.TestStaticaIsolamento.test_persist_credentials_false_su_ogni_checkout"]),
    ("persist-credentials-tolto-in-ventaglio", WF,
     "          fetch-depth: 0\n          persist-credentials: false\n", "          fetch-depth: 0\n", False,
     [f"{I}.TestStaticaIsolamento.test_persist_credentials_false_su_ogni_checkout"]),
    ("output-da-step-dopo-l-agente", WF,
     r"(      inizio: \$\{\{ steps\.inizio\.outputs\.t \}\}\n)(.*?      - name: Diagnostica del ventaglio\n)",
     r"\1      x: ${{ steps.diagnostica.outputs.y }}\n\2        id: diagnostica\n",
     True,
     [f"{I}.TestStaticaIsolamento.test_output_di_ventaglio_solo_da_step_non_successivi_all_agente"]),
    ("output-dagli-outputs-dell-agente", WF,
     "      inizio: ${{ steps.inizio.outputs.t }}\n",
     "      inizio: ${{ steps.inizio.outputs.t }}\n      file: ${{ steps.ventaglio.outputs.execution_file }}\n", False,
     [f"{I}.TestStaticaIsolamento.test_output_di_ventaglio_solo_da_step_non_successivi_all_agente"]),
    ("download-nel-workspace", WF,
     "path: ${{ runner.temp }}/verdetto-ricevuto", "path: ${{ github.workspace }}", False,
     [f"{I}.TestStaticaIsolamento.test_download_fuori_dal_workspace"]),
    ("prepara-esegue-ricevuto", WF,
     "          # Un commento di GitHub non supera",
     '          bash "$RICEVUTO"\n          # Un commento di GitHub non supera', False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_non_esegue_ne_fa_source_dell_artifact"]),
    ("pubblica-source-verdetto", WF,
     '          corpo="$RUNNER_TEMP/verdetto-da-pubblicare.md"\n',
     '          corpo="$RUNNER_TEMP/verdetto-da-pubblicare.md"\n          . "$verdetto"\n', False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_non_esegue_ne_fa_source_dell_artifact"]),
    ("download-in-github-path", WF,
     "          # Un commento di GitHub non supera",
     '          echo "$RUNNER_TEMP/verdetto-ricevuto" >> "$GITHUB_PATH"\n          # Un commento di GitHub non supera', False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_non_esegue_ne_fa_source_dell_artifact"]),
    ("espressione-nel-run", WF,
     "          # Un commento di GitHub non supera",
     '          echo "${{ steps.scarica.outputs.download-path }}"\n          # Un commento di GitHub non supera', False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_nessuna_espressione_nei_run"]),
    ("sha-sostituito-da-tag", WF,
     "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4\n        with:\n          name: verdetto-tentativo",
     "actions/upload-artifact@v4\n        with:\n          name: verdetto-tentativo", False,
     [f"{I}.TestStaticaIsolamento.test_uses_fissate_a_sha_con_il_tag_in_commento"]),
    ("commento-del-tag-tolto", WF,
     "claude-code-action@8ce9314fa9a404564fa7e954cd84f25bcba2b829 # v1",
     "claude-code-action@8ce9314fa9a404564fa7e954cd84f25bcba2b829", False,
     [f"{I}.TestStaticaIsolamento.test_uses_fissate_a_sha_con_il_tag_in_commento"]),
]


def applica(root, file, vecchio, nuovo, rx):
    p = os.path.join(root, file)
    s = open(p, encoding="utf-8").read()
    if rx:
        t, n = re.subn(vecchio, nuovo, s, flags=re.S)
    else:
        n = s.count(vecchio)
        t = s.replace(vecchio, nuovo)
    if n != 1:
        raise SystemExit(f"mutazione non applicabile: {n} occorrenze di {vecchio!r} in {file}")
    open(p, "w", encoding="utf-8").write(t)


def esegui(root, target):
    env = dict(os.environ, CI_ROOT=root)
    env.pop("PYTHONDONTWRITEBYTECODE", None)
    p = subprocess.run([sys.executable, "-m", "unittest", target], cwd=TESTS, env=env,
                       capture_output=True, text=True)
    righe = [r for r in p.stderr.strip().splitlines() if r.strip()]
    return p.returncode, righe[-1] if righe else ""


def falliti(root):
    env = dict(os.environ, CI_ROOT=root)
    p = subprocess.run([sys.executable, "-m", "unittest", "-v", C, E, I], cwd=TESTS, env=env,
                       capture_output=True, text=True)
    out = []
    for r in p.stderr.splitlines():
        m = re.match(r"^(FAIL|ERROR): (test_\w+) \(([\w.]+)", r)
        if m:
            out.append(f"{m.group(3).split('.')[1]}.{m.group(2)} {m.group(1)}")
    tot = [r for r in p.stderr.splitlines() if r.startswith(("Ran ", "OK", "FAILED"))]
    return sorted(set(out)), tot


scelte = set(sys.argv[1:])
for nome, file, vecchio, nuovo, rx, bersagli in M:
    if scelte and nome not in scelte:
        continue
    root = tempfile.mkdtemp(prefix=f"mut-{nome}-")
    shutil.copytree(f"{WT}/.github", f"{root}/.github")
    applica(root, file, vecchio, nuovo, rx)
    print(f"## {nome}  ({file})")
    for b in bersagli:
        rc, ultima = esegui(root, b)
        print(f"   $ CI_ROOT={root} python3 -m unittest {b}\n     -> rc={rc} '{ultima}'  {'ROSSO' if rc else 'VERDE!!'}")
    f, tot = falliti(root)
    print(f"   tre moduli: {' '.join(tot)}; falliti: {len(f)}")
    for x in f:
        print(f"     - {x}")
    shutil.rmtree(root)
