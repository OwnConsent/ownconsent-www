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
     'non_presa "uscita $rc" "collaudo-esito.sh ha risposto con una parola sconosciuta: \'${decisione}\'." ;;',
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
     "      - name: Ventaglio di revisione\n",
     '      - name: Copia lo script\n        run: cp .github/scripts/collaudo-esito.sh "$RUNNER_TEMP/"\n\n      - name: Ventaglio di revisione\n',
     False, [f"{E}.TestStaticaWorkflow.test_script_eseguito_dal_checkout_di_pubblica"]),
    ("script-da-runner-temp", WF,
     'bash "$GITHUB_WORKSPACE/.github/scripts/collaudo-esito.sh"',
     'bash "$RUNNER_TEMP/collaudo-esito.sh"', False,
     [f"{E}.TestStaticaWorkflow.test_script_eseguito_dal_checkout_di_pubblica"]),
    ("sparse-checkout-senza-scripts", WF,
     "sparse-checkout: .github/scripts", "sparse-checkout: .github/workflows", False,
     [f"{E}.TestStaticaWorkflow.test_script_eseguito_dal_checkout_di_pubblica"]),
    ("tempi-api-non-tolleranti", WF,
     ' \\\n                2>/dev/null | head -n 1) || tempi=""', ')', False,
     [f"{I}.TestTempiDelVentaglio.test_2_tempi_che_servono_e_non_arrivano"]),
    ("neutralizzazione-tolta", WF,
     "          s = re.sub('cantiere-collaudo', lambda m: m.group(0).replace('-', '\\u2011'), s, flags=re.I)\n",
     "          s = s\n", False,
     [f"{I}.TestEsecuzioneIsolamento.test_marcatore_falso_nel_testo_dell_agente_si_neutralizza"]),
    ("neutralizzazione-solo-minuscolo", WF,
     "lambda m: m.group(0).replace('-', '\\u2011'), s, flags=re.I)",
     "lambda m: m.group(0).replace('-', '\\u2011'), s)", False,
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
     '"${SHA:0:7}" "$1" "$2" > "$corpo"', '"${SHA:0:7}" "uscita 9" "$2" > "$corpo"', False,
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
    ("timeout-anche-con-success", SC,
     'if [ "$esito" != "success" ] && [ "$trascorsi"', 'if [ "$trascorsi"', False,
     # Dal 78bd1c7 il workflow con esito success non chiede i tempi (trascorsi=0):
     # il test sul job resta verde con questa mutazione, la coglie lo script.
     [f"{E}.TestConfineDelTimeout.test_esito_success_oltre_il_budget_non_e_timeout"]),
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
     "if: ${{ !cancelled() && github.event.pull_request.draft == false &&",
     "if: ${{ always() && github.event.pull_request.draft == false &&", False,
     [f"{I}.TestStaticaIsolamento.test_pubblica_dipende_da_ventaglio_e_gira_con_not_cancelled"]),
    ("persist-credentials-tolto-in-pubblica", WF,
     "          persist-credentials: false\n          sparse-checkout", "          sparse-checkout", False,
     [f"{I}.TestStaticaIsolamento.test_persist_credentials_false_su_ogni_checkout"]),
    ("persist-credentials-tolto-in-ventaglio", WF,
     "          fetch-depth: 0\n          persist-credentials: false\n", "          fetch-depth: 0\n", False,
     [f"{I}.TestStaticaIsolamento.test_persist_credentials_false_su_ogni_checkout"]),
    ("output-da-step-dopo-l-agente", WF,
     r"(      esito: \$\{\{ steps\.ventaglio\.outcome \}\}\n)(.*?)(      # Il file del verdetto, se c'e', e giro\.txt passano)",
     r"\1      x: ${{ steps.dopo.outputs.y }}\n\2      - name: Dopo l'agente\n        id: dopo\n        run: true\n\n\3",
     True,
     [f"{I}.TestStaticaIsolamento.test_output_di_ventaglio_solo_da_step_non_successivi_all_agente"]),
    ("output-dagli-outputs-dell-agente", WF,
     "      esito: ${{ steps.ventaglio.outcome }}\n",
     "      esito: ${{ steps.ventaglio.outcome }}\n      file: ${{ steps.ventaglio.outputs.execution_file }}\n", False,
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
    # --- beab008: artifact del tentativo del ventaglio, artifact mancante, fork ---
    ("output-tentativo-da-altro-contesto", WF,
     "      tentativo: ${{ github.run_attempt }}\n",
     "      tentativo: ${{ github.event.pull_request.title }}\n", False,
     [f"{I}.TestStaticaIsolamento.test_output_di_ventaglio_solo_da_step_non_successivi_all_agente"]),
    ("output-tentativo-da-step-dopo-l-agente", WF,
     r"(      tentativo: )\$\{\{ github\.run_attempt \}\}\n(.*?)(      # Il file del verdetto, se c'e', e giro\.txt passano)",
     r"\1${{ steps.dopo.outputs.y }}\n\2      - name: Dopo l'agente\n        id: dopo\n        run: true\n\n\3", True,
     [f"{I}.TestStaticaIsolamento.test_output_di_ventaglio_solo_da_step_non_successivi_all_agente"]),
    ("nome-dal-run-attempt-di-pubblica-nel-download", WF,
     "          name: ${{ steps.scegli.outputs.nome }}\n",
     "          name: verdetto-tentativo-${{ github.run_attempt }}\n", False,
     [f"{I}.TestStaticaArtifactEFork.test_nome_dell_artifact_non_dal_run_attempt_di_pubblica",
      f"{I}.TestStaticaArtifactEFork.test_download_solo_con_un_nome",
      f"{I}.TestSceltaDellArtifact.test_a_rerun_del_solo_pubblica_output_presente"]),
    ("nome-dal-run-attempt-di-pubblica-in-scegli", WF,
     "          TENTATIVO: ${{ needs.ventaglio.outputs.tentativo }}\n",
     "          TENTATIVO: ${{ github.run_attempt }}\n", False,
     [f"{I}.TestStaticaArtifactEFork.test_nome_dell_artifact_non_dal_run_attempt_di_pubblica",
      f"{I}.TestSceltaDellArtifact.test_a_rerun_del_solo_pubblica_output_presente"]),
    ("scegli-ignora-l-output", WF,
     'if [[ "$TENTATIVO" =~ ^[1-9][0-9]*$ ]]; then\n            echo "tentativo del ventaglio', 'if false; then\n            echo "tentativo del ventaglio', False,
     [f"{I}.TestSceltaDellArtifact.test_a_rerun_del_solo_pubblica_output_presente",
      f"{I}.TestArtifactMancante.test_d_download_fallito"]),
    ("prepara-download-fallito-come-agente-muto", WF,
     r'          if \[ "\$SCARICATO" != "success" \]; then\n.*?exit 4\n          fi\n', "", True,
     [f"{I}.TestArtifactMancante.test_d_download_fallito",
      f"{I}.TestArtifactMancante.test_d_nessun_nome"]),
    ("pubblica-ignora-artifact-mancante", WF,
     r'          if \[ "\$ARTIFACT" = "mancante" \]; then\n.*?\n          fi\n', "", True,
     [f"{I}.TestArtifactMancante.test_d_download_fallito"]),
    ("download-senza-if", WF,
     "        if: ${{ steps.scegli.outputs.nome != '' }}\n", "", False,
     [f"{I}.TestStaticaArtifactEFork.test_download_solo_con_un_nome",
      f"{I}.TestArtifactMancante.test_d_nessun_nome"]),
    ("upload-if-no-files-found-ignore", WF,
     "          if-no-files-found: error\n          retention-days: 1\n",
     "          if-no-files-found: ignore\n          retention-days: 1\n", False,
     [f"{I}.TestStaticaArtifactEFork.test_upload_con_giro_txt_e_if_no_files_found_error"]),
    ("upload-senza-giro-txt", WF,
     "            ${{ github.workspace }}/.collaudo/giro.txt\n", "", False,
     [f"{I}.TestStaticaArtifactEFork.test_upload_con_giro_txt_e_if_no_files_found_error"]),
    ("giro-txt-non-scritto", WF,
     '          echo "tentativo ${GITHUB_RUN_ATTEMPT}" > "$GITHUB_WORKSPACE/.collaudo/giro.txt"\n', "", False,
     [f"{I}.TestStaticaArtifactEFork.test_upload_con_giro_txt_e_if_no_files_found_error"]),
    ("fork-tolto-da-ventaglio", WF,
     "    if: github.event.pull_request.draft == false && github.event.pull_request.head.repo.full_name == github.repository\n",
     "    if: github.event.pull_request.draft == false\n", False,
     [f"{I}.TestStaticaArtifactEFork.test_fork_saltato_da_entrambi_i_job"]),
    ("fork-tolto-da-pubblica", WF,
     " && github.event.pull_request.head.repo.full_name == github.repository }}", " }}", False,
     [f"{I}.TestStaticaArtifactEFork.test_fork_saltato_da_entrambi_i_job",
      f"{I}.TestStaticaArtifactEFork.test_pubblica_non_gira_se_ventaglio_e_saltato"]),
    ("fork-in-or-in-pubblica", WF,
     " && github.event.pull_request.head.repo.full_name == github.repository }}",
     " || github.event.pull_request.head.repo.full_name == github.repository }}", False,
     [f"{I}.TestStaticaArtifactEFork.test_fork_saltato_da_entrambi_i_job",
      f"{I}.TestStaticaArtifactEFork.test_pubblica_non_gira_se_ventaglio_e_saltato"]),
    ("fork-invertito-in-ventaglio", WF,
     "draft == false && github.event.pull_request.head.repo.full_name == github.repository\n",
     "draft == false && github.event.pull_request.head.repo.full_name != github.repository\n", False,
     [f"{I}.TestStaticaArtifactEFork.test_fork_saltato_da_entrambi_i_job",
      f"{I}.TestStaticaArtifactEFork.test_pubblica_non_gira_se_ventaglio_e_saltato"]),
    ("prepara-illeggibile-come-agente-muto", WF,
     '          if [ -f "$RICEVUTO" ]; then\n            python3', '          if [ -r "$RICEVUTO" ]; then\n            python3', False,
     [f"{I}.TestEsecuzioneIsolamento.test_uscita_imprevista_di_prepara_decisione_non_presa"]),
    ("non_presa-artifact-con-marcatore", WF,
     """non_presa "artifact non trovato" "L'artifact""",
     """non_presa "artifact non trovato" "<!-- cantiere-collaudo tipo=verdetto --> L'artifact""", False,
     [f"{I}.TestArtifactMancante.test_d_download_fallito"]),
    ("prepara-senza-not-cancelled", WF,
     "        id: prepara\n        if: ${{ !cancelled() }}\n", "        id: prepara\n", False,
     [f"{I}.TestStaticaArtifactEFork.test_prepara_e_pubblica_girano_anche_dopo_un_errore_di_scegli"]),
    # --- 78bd1c7: tempi dall'attempt del ventaglio, nessuna stima ---
    ("tempi-dall-attempt-di-pubblica", WF,
     '/attempts/$TENTATIVO/jobs"', '/attempts/$GITHUB_RUN_ATTEMPT/jobs"', False,
     [f"{I}.TestTempiDelVentaglio.test_1_rerun_del_solo_pubblica_tempi_dall_attempt_del_ventaglio",
      f"{C}.TestStaticaLetturaDeiCommenti.test_a_nessuna_lettura_dei_commenti_prima_della_decisione_sul_file"]),
    ("tempi-mancanti-come-zero", WF,
     r'              non_presa "tempi non leggibili" "[^\n]*\n', "              trascorsi=0\n", True,
     [f"{I}.TestTempiDelVentaglio.test_2_tempi_che_servono_e_non_arrivano"]),
    ("tempi-mancanti-stimati-da-un-istante", WF,
     r'              non_presa "tempi non leggibili" "[^\n]*\n',
     "              trascorsi=$(( $(date +%s) - 1790000000 ))\n", True,
     [f"{I}.TestTempiDelVentaglio.test_2_tempi_che_servono_e_non_arrivano"]),
    ("tempi-riserva-elif-stima", WF,
     "            else\n              non_presa \"tempi non leggibili\"",
     "            elif true; then\n              trascorsi=$(( $(date +%s) - $(date -d '-2 hours' +%s) ))\n            else\n              non_presa \"tempi non leggibili\"", False,
     [f"{I}.TestTempiDelVentaglio.test_2_tempi_che_servono_e_non_arrivano"]),
    ("api-dei-job-anche-con-success", WF,
     ' && [ "$ESITO_VENTAGLIO" != "success" ]; then', "; then", False,
     [f"{I}.TestTempiDelVentaglio.test_3_esito_success_nessuna_chiamata_ai_job"]),
    ("api-dei-job-anche-con-verdetto", WF,
     'if [ ! -s "$verdetto" ] && [ "$ESITO_VENTAGLIO"', 'if [ "$ESITO_VENTAGLIO"', False,
     [f"{I}.TestTempiDelVentaglio.test_3_verdetto_scritto_esito_failure_nessuna_chiamata_ai_job",
      f"{C}.TestEsecuzioneDelloStep.test_verdetto_scritto_si_pubblica_senza_chiamare_l_api"]),
    ("scegli-non-esporta-tentativo", WF,
     '            echo "tentativo=${TENTATIVO}" >> "$GITHUB_OUTPUT"\n', "", False,
     [f"{I}.TestTempiDelVentaglio.test_1_rerun_del_solo_pubblica_tempi_dall_attempt_del_ventaglio"]),
    # --- ca50180: riserva tolta, niente dopo l'agente, stop-commands, riga dei tempi ---
    ("riserva-ripristinata", WF,
     """          else
            echo "l'output tentativo del job ventaglio manca o non e' un numero: nessun artifact da cercare"
          fi
""",
     """          else
            TENTATIVO=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/artifacts" --paginate --jq '.artifacts[].name' \\
              | sed -n 's/^verdetto-tentativo-\\([1-9][0-9]*\\)$/\\1/p' | awk -v m="$GITHUB_RUN_ATTEMPT" '$1 <= m' | sort -n | tail -n 1)
            if [ -n "$TENTATIVO" ]; then
              echo "tentativo=${TENTATIVO}" >> "$GITHUB_OUTPUT"
              echo "nome=verdetto-tentativo-${TENTATIVO}" >> "$GITHUB_OUTPUT"
            fi
          fi
""", False,
     [f"{I}.TestSceltaDellArtifact.test_b_output_tentativo_mancante_o_non_numerico_nessuna_riserva",
      f"{I}.TestArtifactMancante.test_d_nessun_nome"]),
    ("diagnostica-ripristinata-dopo-l-agente", WF,
     "      # Il file del verdetto, se c'e', e giro.txt passano",
     """      - name: Diagnostica del ventaglio
        if: ${{ !cancelled() }}
        run: ls -la "$GITHUB_WORKSPACE/.collaudo/" || true

      # Il file del verdetto, se c'e', e giro.txt passano""", False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_ventaglio_dopo_l_agente_solo_l_upload"]),
    ("stop-commands-rimosso", WF,
     r'          echo "::stop-commands::\$\{blocco\}"\n(.*?)          echo "::\$\{blocco\}::"\n', r"\1", True,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("stop-commands-chiuso-prima-del-cat", WF,
     r'(          echo "::stop-commands::\$\{blocco\}"\n)(.*?)(          echo "::\$\{blocco\}::"\n)', r"\1\3\2", True,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("stop-commands-token-fisso", WF,
     "blocco=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \\n')", "blocco=0123456789abcdef0123456789abcdef", False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_token_nuovo_a_ogni_esecuzione"]),
    ("stop-commands-token-da-espressione", WF,
     "blocco=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \\n')", "blocco=${{ github.run_id }}", False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands"]),
    ("stop-commands-chiusura-su-altra-variabile", WF,
     '          echo "::${blocco}::"\n', '          echo "::${fine}::"\n', False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("stop-commands-a-capo-finale-tolto", WF,
     '            cat "$RICEVUTO" || echo "(verdetto.md non leggibile)"\n            echo\n',
     '            cat "$RICEVUTO" || echo "(verdetto.md non leggibile)"\n', False,
     [f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("cat-del-verdetto-fuori-dal-blocco", WF,
     '          echo "decisione: ${decisione}"\n', '          echo "decisione: ${decisione}"\n          cat "$verdetto"\n', False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("verdetto-su-stderr-fuori-dal-blocco", WF,
     '          echo "decisione: ${decisione}"\n', '          echo "decisione: ${decisione}"\n          head -c 4000 "$verdetto" >&2\n', False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("print-python-del-testo", WF,
     "          print(f'occorrenze di cantiere-collaudo neutralizzate: {n}')\n", "          print(s)\n", False,
     [f"{I}.TestStaticaDatiDellAgenteNelLog.test_dati_dell_agente_nel_log_solo_fra_stop_commands",
      f"{I}.TestStopCommandsEseguito.test_righe_dell_agente_solo_dentro_il_blocco"]),
    ("riga-dei-tempi-unica", WF,
     r'          if \[ "\$tempi_letti" = "si" \]; then\n.*?\n          fi\n',
     '          echo "ventaglio: ${ESITO_VENTAGLIO}, ${trascorsi} s su un budget di ${BUDGET_VENTAGLIO_MIN} min"\n', True,
     [f"{I}.TestRigaDeiTempi.test_tempi_non_letti"]),
    ("riga-dei-tempi-sempre-non-letti", WF,
     'if [ "$tempi_letti" = "si" ]; then', 'if false; then', False,
     [f"{I}.TestRigaDeiTempi.test_tempi_letti"]),
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
        return f"NON APPLICABILE: {n} occorrenze"
    open(p, "w", encoding="utf-8").write(t)
    return None


def esegui(root, target):
    env = dict(os.environ, CI_ROOT=root)
    env.pop("PYTHONDONTWRITEBYTECODE", None)
    p = subprocess.run([sys.executable, "-m", "unittest", target], cwd=TESTS, env=env,
                       capture_output=True, text=True)
    righe = [r for r in p.stderr.strip().splitlines() if r.strip()]
    return p.returncode, righe[-1] if righe else ""


def esiste(target):
    """Il bersaglio esiste nei test NON mutati? Un nome sbagliato darebbe un rosso
    falso (AttributeError del loader, rc=1)."""
    p = subprocess.run([sys.executable, "-c",
                        "import sys, unittest; s = unittest.defaultTestLoader.loadTestsFromName(sys.argv[1]);"
                        " sys.exit(0 if s.countTestCases() else 1)", target],
                       cwd=TESTS, capture_output=True, text=True)
    return p.returncode == 0


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
    errore = applica(root, file, vecchio, nuovo, rx)
    print(f"## {nome}  ({file})")
    if errore:
        print(f"   {errore}")
        shutil.rmtree(root)
        continue
    for b in bersagli:
        rc, ultima = esegui(root, b)
        if not esiste(b):
            print(f"   BERSAGLIO INESISTENTE: {b}")
            continue
        print(f"   $ CI_ROOT={root} python3 -m unittest {b}\n     -> rc={rc} '{ultima}'  {'ROSSO' if rc else 'VERDE!!'}")
    f, tot = falliti(root)
    print(f"   tre moduli: {' '.join(tot)}; falliti: {len(f)}")
    for x in f:
        print(f"     - {x}")
    shutil.rmtree(root)
