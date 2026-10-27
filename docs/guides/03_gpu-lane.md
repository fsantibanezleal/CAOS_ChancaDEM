# Guide, the GPU lane (dormant)

ChancaDEM has no GPU step. `requirements-gpu.txt` holds only an include of `requirements-precompute.txt` and a comment: no
CUDA package is pinned and no driver or runtime matrix is recorded, because none is needed.

## Why it stays dormant

- The canonical crusher engine is plain Python and evaluates a case in 1.5 to 2.9 ms (the lane gate's measurement,
  2026-10-27); the 27-case bake takes about 5 s.
- The two learned models are tiny (11-64-64-32-10 and 14-16-6-16-14, a few thousand parameters), trained full-batch on
  6430 points: `run.py models` (train and held-out evaluation) took 76 s on the CPU on the documenting workstation, with
  `torch==2.12.1` from the CPU index and one thread.
- The browser never needs the GPU: it runs the TypeScript engine and the ONNX graphs on WASM, single-threaded.

So the models train on the CPU in minutes at most, and the committed artifacts are produced offline regardless of lane.

## When it would be activated

Only if the offline engine genuinely needs CUDA: a discrete-element simulation with breakage (the product's earlier 2-D DEM
tracer was removed and is a backlog item, [the DEM card](../frameworks/07_dem_pbm_landscape/dem-pbm.md)), a much larger
sweep or model, or a Monte-Carlo wrapper around the engine. Then:

1. Pin the CUDA build in `requirements-gpu.txt` (an exact `torch==...+cu...`, or the DEM engine's own package) and record
   the driver and runtime in this guide.
2. On a CUDA machine: `.venv-pipeline/bin/python -m pip install -r requirements-gpu.txt`.
3. Document the engine in `docs/frameworks/<NN>_<tool>/`, with its card in the same form as the existing ones.
4. Keep the contracts: the GPU job still writes the same documents (the catalog rows), and the committed artifacts, not the
   GPU, are what the site replays. `scripts/check_tech_matrix.py` then requires the SDD technology table to list the new
   pins.

Training and the bake stay out of CI whatever the lane (ADR-0074).
