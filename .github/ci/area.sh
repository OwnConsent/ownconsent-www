#!/usr/bin/env bash
# Rileva se un'area del repository (site/ o api/) e' presente, assente o
# incompleta. Interfaccia fissata da docs/adr/0003-contesto-ci.md, D6.
#
# Uso:   bash .github/ci/area.sh <area> [<rev>]
#   <area>  "site" oppure "api"
#   <rev>   un commit-ish; default HEAD
#
# Dipendenze: bash, git. Nessuna rete. Va eseguito dalla radice di un
# repository git.
#
# Uscita: una sola riga su stdout (vedi tabella sotto) e, se la variabile
# GITHUB_OUTPUT e' definita, una riga <area>=<stato> in coda a quel file.
#
#   stato       riga                                              exit
#   presente    area <area>/: presente (<marcatore>)               0
#   assente     area <area>/: assente                               0
#   incompleta  area <area>/: incompleta, manca <marcatore>         1
#
# area/rev non validi: exit 2, messaggio su stderr, nessuna riga di stato,
# nessuna scrittura su GITHUB_OUTPUT.

area="${1:-}"
rev="${2:-HEAD}"

case "$area" in
  site)
    marker="site/package.json"
    ;;
  api)
    marker="api/go.mod"
    ;;
  *)
    echo "area.sh: area non valida: '${area}' (atteso 'site' o 'api')" >&2
    exit 2
    ;;
esac

if ! git rev-parse --verify --quiet "${rev}^{commit}" >/dev/null; then
  echo "area.sh: rev non risolvibile: '${rev}'" >&2
  exit 2
fi

files="$(git ls-tree -r --name-only "${rev}" -- "${area}/")"

if [ -z "$files" ]; then
  status="assente"
  line="area ${area}/: assente"
  code=0
elif printf '%s\n' "$files" | grep -Fxq -- "$marker"; then
  status="presente"
  line="area ${area}/: presente (${marker})"
  code=0
else
  status="incompleta"
  line="area ${area}/: incompleta, manca ${marker}"
  code=1
fi

echo "$line"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "${area}=${status}" >> "$GITHUB_OUTPUT"
fi

exit "$code"
