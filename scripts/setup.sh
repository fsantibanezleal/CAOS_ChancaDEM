#!/usr/bin/env bash
# Create the venvs + install per-lane requirements + the editable package. Idempotent. No global installs.
#   .venv-pipeline = runs the DEFAULT pipeline + tests + lint (numpy + dev + editable pkg)   (clone -> test is instant)
#   .venv          = runtime/live-thin lane (requirements.txt)
# Pass --precompute to ALSO install the heavy engine (torch/onnx) for `pipeline --retrain` (also needs Node 20+).
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python}"
PRECOMPUTE=0
[ "${1:-}" = "--precompute" ] && PRECOMPUTE=1

mkvenv() { [ -d "$1" ] || "$PY" -m venv "$1"; }
venvpy() { local p="$1/bin/python"; [ -x "$p" ] || p="$1/Scripts/python.exe"; echo "$p"; }

echo "[setup] .venv-pipeline (default pipeline + tests + lint)…"
mkvenv .venv-pipeline
VP="$(venvpy .venv-pipeline)"
"$VP" -m pip install --upgrade pip -q
"$VP" -m pip install -q -r requirements.txt -r requirements-dev.txt
"$VP" -m pip install -q -e .
if [ "$PRECOMPUTE" -eq 1 ]; then
  echo "[setup] + heavy precompute engine (torch/onnx) — for --retrain (needs Node 20+ for the sweep)…"
  "$VP" -m pip install -q torch==2.12.1 --index-url https://download.pytorch.org/whl/cpu
  "$VP" -m pip install -q -r requirements-precompute.txt
fi
echo "[setup] .venv-pipeline ready."

echo "[setup] .venv (runtime/live-thin lane)…"
mkvenv .venv
VR="$(venvpy .venv)"
"$VR" -m pip install --upgrade pip -q
"$VR" -m pip install -q -r requirements.txt
echo "[setup] .venv ready. Next:  ./scripts/precompute.sh   then   ./scripts/dev.sh"
