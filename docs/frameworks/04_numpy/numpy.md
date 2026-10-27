# NumPy (`numpy==2.4.6`)

## What and why

NumPy is the one dependency of the light Python lane (`requirements.txt` pins only it). The canonical crusher engine
itself is plain Python on lists of floats, deliberately, so that the order of the floating-point operations is the
TypeScript engine's (`linalg.py` ports the LU solve as written instead of calling `numpy.linalg.solve`). NumPy serves the
parts around the engine:

- the float32 rounding of the model encodings (`model/crusher/encoding.py`);
- the CrusherCal validation: the least squares, the ridge fit, the seeded permutations (`hp500/loo.py`);
- the seeded generator factory `core/rng.py` (`numpy.random.default_rng`), the only place a generator is made;
- the evaluation of the learned models (`stages/evaluate.py`).

Lane: offline. The lane gate's allowed wheel set is `{numpy}` (`core/gate.py`, `LIVE_WHEELS`); the crusher engine uses none,
so the manifests record `wheels: []`.

## Install

```
pip install numpy==2.4.6
```

`scripts/setup.sh` installs it into `.venv-pipeline` through `data-pipeline/requirements.txt`.

## Usage

```
python data-pipeline/run.py all      # the release bake, about 5 s, needs only numpy
```

Measured on 2026-10-27, 4.5 s on the documenting workstation into a sandbox. The bake needs neither torch nor Node; the
released model contracts and graphs are read as they stand in `data/derived/models/`.

## Caveats

- Determinism: every random draw comes from `make_rng(seed)`; a run is a pure function of the operating point and the
  seed, and a rebake into a sandbox on 2026-10-27 reproduced every committed trace and both HP500 documents byte for byte; the
  manifests differed only in the `models` field, because the sandbox held no released model bundle (the slots answered
  as baseline there).
- Float32 values are rounded with `numpy.float32` and everything else is a double operation, as in the browser.
