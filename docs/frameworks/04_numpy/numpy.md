# NumPy (`numpy==2.4.6`)

**What:** the array workhorse.
**Why binding:** it is the **only** dependency of the default (light) pipeline — the per-output metrics encoding, the
seeded RNG, and the replay-layer assembly run on numpy. This is what lets a clone rebuild the entire replay layer +
pass the tests **without torch or Node** (the surrogate/AE ONNX + the engine's `case-results.json` are committed).

**Lane:** both — the light replay path (always) and the heavy precompute path (alongside torch).

## Install

`pip install numpy==2.4.6` (the whole of `requirements.txt`; `setup.sh` installs it into both venvs).

## Usage

`python -m chancalab.pipeline all` (numpy-only) rebuilds every per-case trace + manifest from `case-results.json` +
`surrogate_metrics.json`.
