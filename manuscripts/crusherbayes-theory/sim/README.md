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

## Measured cost (2026-11-19, 32 logical processors shared with other sessions)

| Run | Wall time | Notes |
|---|---|---|
| tests (18) | 49 s to 66 s | of which about 45 s are the two tiny sampler runs of test m |
| `run_exact.py --reps 1900 --workers 22`, first run | 20 min 37 s | 1,016 s building the context (two 4,000-point pools with Jacobians, the two L2 projections of V2 at up to 20 Gauss-Newton iterations each), 1,237 s for the 176 cells |
| the same with the engine cache present (`--force`) | 2 min 24 s | the summaries are byte-identical to the first run's but for the code commit |
| `run_design.py --workers 22` | 46 s (2 s cached) | the Jacobians at theta_0 on both pools |
| `run_sampler.py sbc --pilot` (real Config) | 2,543 s | one process, tau_max 58.9, converged; it shared the machine with the exact run for its first 20 minutes |
| `run_sampler.py verify --pilot` (real Config) | see the theory-harness report of 2026-11-19 | one process |

The per-replicate arrays of the exact route take 7.8 GB under `<cache>/exact/`; the engine caches 46 MB.

Caveat on the V2 oracle: the L2 projection reached its 20-iteration cap on both windows with the objective still falling
by less than 0.1 percent per iteration, and three scalars at their prior bounds (P_n = 0, K3 = 4, the t10 shift at -15 on
the surveys window); the record of every iteration is in each V2 cell's `oracle.l2_projection`.
