# Measured resources of ChancaDEM

The evidence behind the numbers of the [`SDD.md`](SDD.md) sections Resources, Lanes and Deploy driver. Measured on 2026-11-15 on the
development workstation (Windows 11, Python 3.12.15, Node 24.14.1, 32 processor threads) by
`tools/audit/measure_stages.py` of CAOS_MANAGE on a `git archive` copy of the release commit `d836e9dc96c9f1e1a6f8ae65eeb1d474130f0dde`, committed as one snapshot in a
fresh repository (the tests that read the repository through git run), so the working tree was never touched. Each stage ran under
`tools/audit/measure_command.py`, which reports the wall time, the peak memory of the command's whole process tree (polled every
20 ms) and the bytes of content under named folders. Two runs, each on its own fresh copy of the same commit: the first ran the
training, then the bake (which trains nothing and reads the trained models), then the HP500 step alone; the second ran the web
install, build and unit tests and the Python suite. A first attempt at the second group failed on the measuring environment, not on
the product (an unset `CAOS_TEMP_ROOT`, a `CAOS_DATA_ROOT` that redirected the site's data copy, and a copy without a git
repository), and was rerun once those were fixed; its records are not used.

## The stages

```
$ (cwd .) python.exe data-pipeline/run.py models
models: exit 0, 41.82 s, peak 443.7 MB; data/derived/models: 59480 bytes in 5 files
$ (cwd .) python.exe data-pipeline/run.py all
bake: exit 0, 2343.68 s, peak 1525.3 MB; data/derived: 308364 bytes in 67 files
$ (cwd .) python.exe data-pipeline/run.py hp500
hp500: exit 0, 2157.86 s, peak 1549.0 MB; data/derived/hp500: 30568 bytes in 4 files
$ (cwd frontend) npm ci
install: exit 0, 12.43 s, peak 708.1 MB; node_modules: 329009652 bytes in 11508 files
$ (cwd frontend) npm run build
build: exit 0, 9.14 s, peak 648.4 MB; dist: 17222309 bytes in 174 files
$ (cwd frontend) npm test
webtests: exit 0, 6.88 s, peak 3214.0 MB
$ (cwd .) python.exe -m pytest -q -p no:cacheprovider --basetemp <temp root>/pt
tests: exit 0, 832.54 s, peak 452.3 MB
```

The Python suite: 1707 passed, 27 skipped. The web unit tests: 562 tests.

## The engine time and the trace size (the lane gate)

The canonical Python engine at each case's committed parameters, after one warm-up, as the median of seven runs; the figure
reported is the median over the 27 cases and the largest:

```
27 cases: median of medians 1.46 ms, max 1.61 ms
largest trace: 4127 bytes
```

Both are far inside the lane gate's budgets (1500 ms, 256 KiB), so every case is live-eligible; the browser re-runs the
TypeScript engine, held to the Python engine by the shared reference.

## The site

`npm run build` of the release tree writes 17,222,593 bytes in 174 files (the measured build in the copy wrote 17,222,309: the
284 bytes between them are the commit and time stamps of `build.json`), of which 13,479,978 bytes are the ONNX Runtime
WebAssembly binary, served by the site rather than a CDN so its version is the npm package's. The five largest JavaScript chunks:
`chamber3d-BvVGqlXm.js` 586 KB; `math-vendor-BZ_bdw18.js` 259 KB; `react-vendor-CNP3Vp4U.js` 219 KB; `index-BRDYGVRr.js` 214 KB; `Methodology-CuZaGm2j.js` 135 KB. The committed artifacts under `data/derived/` hold 308,364
bytes in 66 files.
