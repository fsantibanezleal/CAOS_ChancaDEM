# The offline pipeline in .venv-pipeline (pass-through args). No argument is the release bake, run.py all: the 27 cases,
# the HP500 documents, the index and the readiness; never trains. E.g.:  ./scripts/precompute.ps1 S01 --output build/smoke
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-pipeline" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv-pipeline" "bin/python" }
& $vp data-pipeline/run.py @args
