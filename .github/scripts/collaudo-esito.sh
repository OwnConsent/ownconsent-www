#!/usr/bin/env bash
# Decide che cosa pubblica il collaudo quando il ventaglio e' finito.
# Tabella e regole: brief della PR collaudo-rimando-sha, decisione in
# journal/2026-09-26/221518-andrea-decisione.json e 2026-09-27/112845.
#
#   collaudo-esito.sh VERDETTO SHA COMMENTI ESITO TRASCORSI_S BUDGET_MIN CORPO
#
#   VERDETTO     file scritto dall'agente (puo' mancare)
#   SHA          github.event.pull_request.head.sha, 40 caratteri esadecimali
#   COMMENTI     output di `gh api …/issues/N/comments --paginate`: uno o piu'
#                array JSON concatenati, uno per pagina. Puo' non esistere: i
#                commenti servono solo al rimando, e il workflow li legge solo
#                quando lo script li chiede (uscita 3)
#   ESITO        steps.ventaglio.outcome
#   TRASCORSI_S  secondi misurati attorno allo step ventaglio
#   BUDGET_MIN   timeout-minutes dello step ventaglio
#   CORPO        file in cui si scrive l'inizio del commento
#
# Stampa una parola: verdetto | timeout | rimando | nessun-verdetto.
# Esce 0 quando ha deciso, 2 sugli input sbagliati, 3 se per decidere servono
# i commenti e COMMENTI non esiste (stampa servono-commenti, non scrive CORPO).
# Il colore del job lo sceglie il workflow a partire dalla parola.
set -euo pipefail

# Misurato su #64 il 27/09: l'autore dei verdetti pubblicati dal job.
AUTORE='github-actions[bot]'

if [ "$#" -ne 7 ]; then
  echo "uso: $0 VERDETTO SHA COMMENTI ESITO TRASCORSI_S BUDGET_MIN CORPO" >&2
  exit 2
fi
verdetto=$1 sha=$2 commenti=$3 esito=$4 trascorsi=$5 budget=$6 corpo=$7

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA non valido: '$sha'" >&2; exit 2; }
[[ "$trascorsi" =~ ^[0-9]+$ ]] || { echo "TRASCORSI_S non valido: '$trascorsi'" >&2; exit 2; }
[[ "$budget" =~ ^[1-9][0-9]*$ ]] || { echo "BUDGET_MIN non valido: '$budget'" >&2; exit 2; }

corto=${sha:0:7}
marcatore() { printf '<!-- cantiere-collaudo tipo=%s sha=%s -->\n' "$1" "$sha"; }

# 1. Un verdetto scritto vince su tutto, anche su un ventaglio scaduto.
if [ -s "$verdetto" ]; then
  { marcatore verdetto; printf 'Commit `%s`\n\n' "$corto"; } > "$corpo"
  echo verdetto
  exit 0
fi

# 2. Il timeout prevale sul rimando: un giro che scade e' un guasto diverso
#    dal silenzio e non va coperto. E' un'inferenza dal tempo, non un segnale
#    di GitHub: il contesto degli step non distingue una scadenza da un
#    fallimento (journal 2026-09-27/112829, punto 4).
if [ "$esito" != "success" ] && [ "$trascorsi" -ge $((budget * 60)) ]; then
  printf 'Commit `%s`\n\n**Collaudo: timeout dopo %d minuti e %d secondi** (budget dello step: %d minuti, ventaglio: `%s`). Il collaudo non ha lasciato un verdetto per questo commit.\n' \
    "$corto" $((trascorsi / 60)) $((trascorsi % 60)) "$budget" "$esito" > "$corpo"
  echo timeout
  exit 0
fi

# 3. Rimando: conta solo un commento del job il cui PRIMO rigo e' il
#    marcatore di un verdetto per lo stesso SHA. Un rimando non e' mai un
#    verdetto, e un marcatore citato dentro un testo non conta. Si prende
#    il piu' recente. Verdetto e timeout sono gia' decisi: solo qui servono
#    i commenti (finding di /code-review 65: leggerli prima faceva perdere un
#    verdetto scritto quando l'API falliva).
if [ ! -e "$commenti" ]; then
  echo servono-commenti
  exit 3
fi
url=$(jq -rn --arg autore "$AUTORE" --arg m "<!-- cantiere-collaudo tipo=verdetto sha=$sha -->" '
  [inputs | .[]
   | select(.user.login == $autore)
   | select((.body // "") | split("\n")[0] | rtrimstr("\r") == $m)]
  | sort_by(.created_at) | last | .html_url // empty' "$commenti") \
  || { echo "COMMENTI non e' JSON valido: '$commenti'" >&2; exit 2; }

if [ -n "$url" ]; then
  { marcatore rimando
    printf 'Commit `%s`\n\n' "$corto"
    printf 'Questo giro non ha scritto un verdetto. Lo stesso commit ne ha già uno: %s\n' "$url"
  } > "$corpo"
  echo rimando
  exit 0
fi

# 4. Nessun verdetto per questo SHA.
printf 'Commit `%s`\n\n**Collaudo: nessun verdetto** (ventaglio: `%s`). Non vuol dire che il collaudo abbia trovato problemi: non si sa se abbia revisionato.\n' \
  "$corto" "$esito" > "$corpo"
echo nessun-verdetto
