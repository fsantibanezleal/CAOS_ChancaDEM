# CrusherBayes theory study: the simulation harness

Manuscript analysis code (not a package) that measures when CrusherBayes, ChancaDEM's Bayesian calibration of its HP500
cone-crusher engine (`data-pipeline/pipeline/hp500/crusherbayes.py`), predicts a survey better than an empirical
regression, on virtual plants with a known truth. Everything runs in `.venv-pipeline` (numpy, emcee, pytest; no scipy).
Every script takes its output and cache roots on the command line; nothing writes to a fixed machine path. CI never runs
these bakes (ADR-0074): the summaries they write under `../data/` are committed.

## Modules

| Module | What it holds |
|---|---|
| `inputs.py` | the consumed inputs: theta_0, d_0 and sigma_t from `data/derived/hp500/crusherbayes.json` (a missing file or row stops the run), the ten surveys, the reference standardization, the inputs' SHA-256, the code commit |
| `special.py` | incomplete beta and gamma functions, the Student-t quantile, the chi-square survival function (numpy and the standard library) |
| `pools.py` | the windows "surveys" and "wide", the seeded 4,000-point pools, the designs real, surveys, wide and extrapolation, the redraw of ill-conditioned designs (cond(G) above 1e10) |
| `engines.py` | the product engine on point sets (values, P80 and central-difference Jacobians, step 1e-3 in the sampled scale, spread over worker processes, cached as .npz keyed by the point set, theta, the Jacobian flag and the engine version) and the analytic throughput engines affine, rocha and rocha_half |
| `plants.py` | the virtual plants V0, V1(alpha, kappa) and V2 |
| `predictors.py` | the eleven predictors (cb_oracle, cb_nominal, cb_ko, cb_orth, cb_scaled, ls, line, engine_nominal, engine_oracle, engine_refit, constant) |
| `theory.py` | the expected squared prediction errors, the fixed-design decomposition, the expected information gain, the SBC rank and its uniformity test |
| `run_exact.py` | the exact-route grid (176 cells: V0, six V1 variants, V2, three C-cap engines, each on 16 designs), writes `data/exact/<cell>.json` |
| `run_design.py` | the design-information study D0 to D5, writes `data/design.json` |
| `run_sampler.py` | the full posterior: `sbc`, `verify` and `summarize` (writes `data/sbc.json`, `data/verify.json`) |

## Command lines (from the repository root)

    .venv-pipeline/Scripts/python.exe -m pytest -q -p no:cacheprovider manuscripts/crusherbayes-theory/sim/tests --basetemp <temp root>/<slug>/pt
    .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_exact.py --reps 1900 --out manuscripts/crusherbayes-theory/data --cache <training root>/cbt --workers 24
    .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_design.py --out manuscripts/crusherbayes-theory/data --cache <training root>/cbt --workers 24
    .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_sampler.py sbc --out <training root>/cbt/sampler --workers 24 --chunk 24
    .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_sampler.py verify --out <training root>/cbt/sampler --cache <training root>/cbt --workers 24 --chunk 24
    .venv-pipeline/Scripts/python.exe manuscripts/crusherbayes-theory/sim/run_sampler.py summarize --out <training root>/cbt/sampler --data manuscripts/crusherbayes-theory/data

`--pilot` on `sbc` or `verify` runs one posterior and prints its wall time, tau_max and convergence. `--chunk K` stops
after K new posteriors; existing results are skipped, so repeated chunks complete the study. `run_exact.py` skips a cell
whose summary exists unless `--force`; `--only CELL ...` restricts the grid.

## Determinism

A replicate's seed is `numpy.random.SeedSequence([20261119, cell_index, replicate])`, the cell index its position in the
sorted cell list; the pools have fixed seeds; engine evaluations run in fixed chunks. The summaries are byte-identical for
any worker count (test l). `run_sampler.py verify` draws its replicate data with `run_exact.replicate_data`, so its
replicates are the exact route's (its test points the first 50 of the 200).

## Measured cost

See the section "Measured cost (2026-11-19)" below, written from the runs of that day.
