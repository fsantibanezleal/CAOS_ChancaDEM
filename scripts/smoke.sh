#!/usr/bin/env bash
# Smoke: validate the CONTRACT 2 and 3 artifacts on disk (index, manifests and traces consistent; expected ranges; units gate)
# and the engine's constants (CONTRACT 3b). The built site is
# measured by `npm run gate` in frontend/, and the deployed one by scripts/check_live.py.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=".venv-pipeline/bin/python"; [ -x "$PY" ] || PY=".venv-pipeline/Scripts/python.exe"
[ -x "$PY" ] || PY="${PYTHON:-python}"
"$PY" scripts/check_artifacts.py
"$PY" scripts/check_unit_constants.py
