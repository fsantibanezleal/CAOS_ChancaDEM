# Measured resources of ChancaDEM

The evidence behind the numbers of the [`SDD.md`](SDD.md) sections Resources, Lanes and Deploy driver. Measured on 2026-10-27
on the development workstation (Windows 11, Python 3.13.14, Node 24.14.1) on a `git archive` copy of `task/base-0-11`, so the
working tree was never touched. Each stage was run under `tools/audit/measure_command.py` of CAOS_MANAGE, which reports the wall
time, the peak memory of the command's whole process tree (polled every 20 ms) and the bytes of content under named folders.

## The stages

```
$ measure_command.py --label bake --size data/derived -- .venv-pipeline/Scripts/python.exe data-pipeline/run.py all
bake: exit 0, 7.27 s, peak 66.5 MB; data/derived: 285678 bytes in 65 files
$ measure_command.py --label models --size data/derived/models -- .venv-pipeline/Scripts/python.exe data-pipeline/run.py models
models: exit 0, 48.24 s, peak 453.2 MB; data/derived/models: 58120 bytes in 5 files
$ measure_command.py --label tests -- .venv-pipeline/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp <temp root>
tests: 961.68 s, peak 267.7 MB
$ measure_command.py --label install --size node_modules -- npm ci
install: exit 0, 24.61 s, peak 643.9 MB; node_modules: 327874106 bytes in 11422 files
$ measure_command.py --label build --size dist -- npm run build
build: exit 0, 12.48 s, peak 567.0 MB; dist: 16820928 bytes in 159 files
$ measure_command.py --label webtests -- npm test
webtests: exit 0, 9.51 s, peak 1951.0 MB (309 tests)
```

The test suite's time is the whole suite on that copy; its pass count is the release's, recorded in the CHANGELOG.

## The engine time and the trace size (the lane gate)

The canonical Python engine at each case's committed parameters, after one warm-up, as the median of seven runs; the figure
reported is the median over the 27 cases and the largest:

```
27 cases: median of medians 1.34 ms, max 2.03 ms
largest trace: 4127 bytes
```

Both are far inside the lane gate's budgets (1500 ms, 256 KiB), so every case is live-eligible; the browser re-runs the
TypeScript engine, held to the Python engine by the shared reference.

## The site

`npm run build` writes 16,820,928 bytes in 159 files. The largest file is the ONNX Runtime WebAssembly binary
(`ort-wasm-simd-threaded*.wasm`, 13,479,970 bytes), served by the site rather than a CDN so its version is the npm package's.
The JavaScript chunks: the shell entry 230 KB, the workbench 80 KB, the 3D chamber 576 KB (three.js, loaded only when its
sub-view opens), the documentation pages 76 to 98 KB each.
