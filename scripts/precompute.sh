#!/usr/bin/env bash
# Run the offline pipeline (pass-through args). E.g.:
#   ./scripts/precompute.sh                # rebuild all replay traces + manifests from committed artifacts
#   ./scripts/precompute.sh S01            # one case
#   ./scripts/precompute.sh all --retrain  # Node sweep + torch train (needs --precompute setup + Node 20+)
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-pipeline/bin/python"; [ -x "$VP" ] || VP=".venv-pipeline/Scripts/python.exe"
"$VP" -m chancalab.pipeline "$@"
