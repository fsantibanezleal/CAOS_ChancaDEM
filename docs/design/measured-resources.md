# Measured resources of ChancaDEM

The evidence behind the numbers of the [`SDD.md`](SDD.md) sections Resources, Lanes and Deploy driver. Measured on 2026-11-20 on the
development workstation (Windows 11, Python 3.12.15, Node 24.14.1, 32 processor threads) by `tools/audit/measure_stages.py` of
CAOS_MANAGE on `git archive` copies, each committed as one snapshot in a fresh repository (the tests that read the repository through
git run), so the working tree was never touched. Each stage ran under `tools/audit/measure_command.py`, which reports the wall time,
the peak memory of the command's whole process tree (polled every 20 ms) and the bytes of content under named folders. Two runs,
each on its own fresh copy: the first, on the release bake commit `958de379c4e1b9cb6f6b15890694131f0cad2fd9`, ran the training, then
the bake (which trains nothing and reads the trained models), then the HP500 step alone; the second, on the commit after it,
`78ee92802a69a292ba6c327593f8187a03d04c72`, which changes only tests and contract fixtures, ran the web install, build and unit tests
and the Python suite. A first attempt at the second group, on the release bake commit, failed on the measuring environment and on the
release head: a `CAOS_DATA_ROOT` set in the measuring shell redirected the site's data copy (the build stopped), and three tests
failed on the new notebook and the contract fixtures, fixed in the commit the second run measured; its records are not used.

The workstation ran other sessions' jobs (test suites, an experiment) during both runs, about 15 percent of the processor when the
first started. That lengthens the wall times more than it changes the memory peaks: the pipeline code and its dependencies are the
ones measured for 0.13.000 on 2026-11-15 (no change in `data-pipeline/` or the requirements between `v0.13.000` and `958de37`), when
the bake took 39.1 min, the HP500 step 36.0 min, the training 41.8 s and the suite 13.9 min, with peaks within 6 percent of these.

## The stages

```
$ (cwd .) python.exe data-pipeline/run.py models
models: exit 0, 74.28 s, peak 446.3 MB; data/derived/models: 59480 bytes in 5 files
$ (cwd .) python.exe data-pipeline/run.py all
bake: exit 0, 3252.97 s, peak 1442.1 MB; data/derived: 308364 bytes in 67 files
$ (cwd .) python.exe data-pipeline/run.py hp500
hp500: exit 0, 3137.48 s, peak 1592.0 MB; data/derived/hp500: 30568 bytes in 4 files
$ (cwd frontend) npm ci
install: exit 0, 17.31 s, peak 638.7 MB; node_modules: 329015953 bytes in 11509 files
$ (cwd frontend) npm run build
build: exit 0, 11.78 s, peak 642.2 MB; dist: 17223081 bytes in 174 files
$ (cwd frontend) npm test
webtests: exit 0, 9.1 s, peak 3090.7 MB
$ (cwd .) python.exe -m pytest -p no:cacheprovider --basetemp <temp root>/pt
tests: exit 0, 938.98 s, peak 436.7 MB
```

The Python suite: 1714 passed, 27 skipped. The web unit tests: 562 tests in 38 files. (The test command leaves out `-q`, which the
repository's `addopts` already sets: a second one hides pytest's count line.)

## The engine time and the trace size (the lane gate)

The canonical Python engine at each case's committed parameters, after one warm-up, as the median of seven runs; the figure
reported is the median over the 27 cases and the largest:

```
27 cases: median of medians 1.31 ms, max 1.46 ms
largest trace: 4127 bytes
```

Both are far inside the lane gate's budgets (1500 ms, 256 KiB), so every case is live-eligible; the browser re-runs the
TypeScript engine, held to the Python engine by the shared reference.

## The site

`npm run build` of a clean `git archive` copy of `78ee928` writes 17,223,048 bytes in 174 files (the measured build in the copy wrote
17,223,081: the 33 bytes between them are the commit and time stamps of `build.json`), of which 13,479,978 bytes are the ONNX
Runtime WebAssembly binary, served by the site rather than a CDN so its version is the npm package's. The five largest JavaScript
chunks: `chamber3d-fd1zuzq4.js` 586 KB; `math-vendor-BZ_bdw18.js` 259 KB; `react-vendor-CNP3Vp4U.js` 219 KB; `index-BnYhul9X.js`
214 KB; `Methodology-CEFJNGhK.js` 135 KB. The committed artifacts under `data/derived/` hold 308,364 bytes in 66 files. The report's site figure is measured on that clean copy
(`measure_resources.py --dist`), because a checkout whose `frontend/public` holds untracked files copies them into its own `dist`.
