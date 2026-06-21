# Run the offline pipeline (pass-through args). E.g.:
#   ./scripts/precompute.ps1                # rebuild all replay traces + manifests from committed artifacts
#   ./scripts/precompute.ps1 S01            # one case
#   ./scripts/precompute.ps1 all --retrain  # Node sweep + torch train (needs -Precompute setup + Node 20+)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-pipeline" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv-pipeline" "bin/python" }
& $vp -m chancalab.pipeline @args
