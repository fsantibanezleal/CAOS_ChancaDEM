#!/usr/bin/env bash
# The offline pipeline in .venv-pipeline (pass-through args). No argument is the release bake, run.py all: the 27 cases,
# the HP500 documents, the index and the readiness; never trains. E.g.:  ./scripts/precompute.sh S01 --output D:/_Temp/x
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-pipeline/bin/python"; [ -x "$VP" ] || VP=".venv-pipeline/Scripts/python.exe"
"$VP" data-pipeline/run.py "$@"
