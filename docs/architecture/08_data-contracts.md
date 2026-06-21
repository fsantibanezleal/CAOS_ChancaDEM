# 08 — The two data contracts

The full schemas live in [`../../data/README.md`](../../data/README.md); this is the architecture-level summary.

## Contract 1 — ingestion (operating point + feed PSD → pipeline)

`data-pipeline/chancalab/io/contract.py`. The *bring-your-own-operating-point* gate. `validate_records` accepts an
operating row iff it satisfies the schema (`machine ∈ {cone-sec, cone-tert, cone-short-head, gyratory, jaw}`,
positive numeric css/throw/speed/feed/m/axb), **rejects** with a reason otherwise (bad machine, non-numeric,
`cssMm > 2.5× feedX63Mm` = CSS wider than the feed top), and **flags** out-of-machine-envelope or pass-through rows
(`cssMm ≥ feedX63Mm`). A `validate_psd` guard checks a bring-your-own feed PSD (descending sieve edges, monotone
passing). A committed `data/examples/operating.csv` PASSES Contract 1 (a clone-time test asserts it).

## Contract 2 — artifact (pipeline → web)

`data-pipeline/chancalab/core/{trace.py, manifest.py}`. Each case writes a compact `data/derived/<case>/trace.json`
(`chancadem.trace/v1`) + a manifest `data/derived/manifests/<case>.json` (`chancadem.manifest/v2`) recording the
category/stage, seed, engine+version, the shared ONNX, the trace byte size, the lane/gate verdict, the Contract-1
flags, and the case metrics; a flat `index.json` inventories all cases.
`frontend/src/lib/contract.types.ts` mirrors these schemas so a drift fails `tsc`; `scripts/check_artifacts.py`
(CI) enforces that every manifest points to a real trace of the recorded byte size with a consistent lane verdict.
