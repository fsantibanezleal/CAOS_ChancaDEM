# Measured resources of ChancaDEM

The evidence behind the numbers of the [`SDD.md`](SDD.md) sections Resources, Lanes and Deploy driver, for release 0.15.000.
Measured on 2026-11-23 and 2026-11-24 on the development workstation (Windows 11, Python 3.12.15, Node 24.14.1,
32 processor threads) by `tools/audit/measure_stages.py` of CAOS_MANAGE on `git archive` copies, each committed as one
snapshot in a fresh repository (the tests that read the repository through git run), so the working tree was never touched. Each
stage ran under `tools/audit/measure_command.py`, which reports the wall time, the peak memory of the command's whole process tree
(polled every 20 ms) and the bytes of content under named folders. Two runs, each on its own fresh copy:

- the first, on the release bake commit `07520a29e405df5daf6c247e53d464040c751103`, on 2026-11-23 from 21:35 to 23:53, ran the
  training, then the bake (which trains nothing and reads the trained models), then the HP500 step alone, then the particle
  document (`run.py dem` with the data root named in `CAOS_DATA_ROOT`, so the stage rebuilds the document and its replay files from
  the stored runs and runs no simulation, as the release bake does);
- the second, on `3f1b18295c1f0ede9859157eec7bd6ac11971cd9`, on 2026-11-24 from 02:32 to 03:13, ran the web install, build and unit
  tests and the Python suite, with `CAOS_DATA_ROOT` unset. That commit differs from the release bake commit only in the outputs
  of fourteen re-executed notebooks and one paragraph of `notebooks/README.md`.

The load on the workstation. During the first run it also ran this release's own Python suite (21:35 to 22:46) and the execution of
its 52 notebooks (22:47 to 00:06), and another session's test suite; that lengthens the wall times of the bake and the HP500 step
more than it changes their memory peaks. The release bake itself (`scripts/local/workflow.py generate --release` on `ea90718`,
whose result `07520a2` commits; 2026-11-23, 20:40:12 to 21:34:37), run with none of those jobs, printed for the same bake stage

```
precomputed 27 cases in 3131.7 s
dem: ran nothing; loaded from the raw records 63-52, 31.5-26.5, 16-13.2
```

that is 52.2 min against the 72.5 min measured under load. The second run had the workstation without any other job of this
release. For comparison, release 0.14.000 measured on 2026-11-20 (also on a
loaded workstation): bake 54.2 min and 1442 MB, HP500 step 52.3 min and 1592 MB, training 74.3 s and 446 MB, suite 15.6 min and
437 MB with 1714 tests; release 0.13.000, on a quiet workstation on 2026-11-15: bake 39.1 min, HP500 step 36.0 min, training
41.8 s, suite 13.9 min. `data-pipeline/pipeline/hp500/` did not change between `v0.13.000` and this release; the training runs on
torch 2.15.0 since this release (2.12.1 before), and the suite gained 121 tests, among them the stage tests that run short
particle simulations and compile the package's kernels, and it runs the staleness check of two notebooks.

## The stages

```
$ (cwd .) python.exe data-pipeline/run.py models
models: exit 0, 92.35 s, peak 461.9 MB; data/derived/models: 59745 bytes in 5 files
$ (cwd .) python.exe data-pipeline/run.py all
bake: exit 0, 4348.11 s, peak 1426.1 MB; data/derived: 2473699 bytes in 71 files
$ (cwd .) python.exe data-pipeline/run.py hp500
hp500: exit 0, 3791.12 s, peak 1534.6 MB; data/derived/hp500: 30568 bytes in 4 files
$ (cwd .) python.exe data-pipeline/run.py dem
dem: exit 0, 1.73 s, peak 93.4 MB; data/derived/dem: 2164725 bytes in 4 files
$ (cwd frontend) npm ci
install: exit 0, 93.51 s, peak 599.6 MB; node_modules: 342780475 bytes in 11560 files
$ (cwd frontend) npm run build
build: exit 0, 30.56 s, peak 692.2 MB; dist: 20905234 bytes in 178 files
$ (cwd frontend) npm test
webtests: exit 0, 15.54 s, peak 3465.3 MB
$ (cwd .) python.exe -m pytest -p no:cacheprovider --basetemp <temp root>/pt
tests: exit 0, 2219.14 s, peak 536.3 MB
```

The Python suite: 1835 passed, 27 skipped. The web unit tests: 769 tests in 41 files. (The test command leaves out `-q`, which the
repository's `addopts` already sets: a second one hides pytest's count line.) The bake's folder holds the committed particle
document and its three replay files (2,164,725 bytes), which the bake does not write.

## The particle runs

The three runs of the particle simulation are not part of a release bake when their raw records are in the data root. The first bake (2026-11-21, three processes, a workstation loaded by other sessions) wrote a wall-time file beside each raw record: 2,624 s for 63/52 mm, 375 s for 31.5/26.5 mm and 4,210 s for 16/13.2 mm, about 70 minutes for the three in three processes. The memory of those runs was not measured in that bake; the stage that rebuilds the document from the stored runs is in the table above.

## The engine time and the trace size (the lane gate)

The canonical Python engine at each case's committed parameters, after one warm-up, as the median of seven runs; the figure
reported is the median over the 27 cases and the largest:

```
27 cases: median of medians 1.40 ms, max 1.45 ms
largest trace: 4127 bytes
```

Both are far inside the lane gate's budgets (1500 ms, 256 KiB), so every case is live-eligible; the browser re-runs the
TypeScript engine, held to the Python engine by the shared reference.

## The site

`npm run build` of a clean `git archive` copy of `bd25fb2` (the same web sources as the second run) writes 20,905,234 bytes in
178 files, of which 14,848,852 bytes are the ONNX Runtime WebAssembly binary, served by the site rather than a CDN so its
version is the npm package's. The five largest JavaScript chunks: `chamber3d-DcYaWzto.js` 590 KB; `math-vendor-BZ_bdw18.js`
259 KB; `react-vendor-CNP3Vp4U.js` 219 KB; `index-D8GnKi_m.js` 218 KB; `Methodology-DOGB9mca.js` 189 KB. The committed artifacts
under `data/derived/` hold 2,473,699 bytes in 70 files, of which 2,164,725 are the particle document and its replay files. The
report's site figure is measured on that clean copy (`measure_resources.py --dist`), because a checkout whose `frontend/public`
holds untracked files copies them into its own `dist`.
