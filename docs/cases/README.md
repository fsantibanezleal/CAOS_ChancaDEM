# Cases — taxonomy & coverage matrix

`data-pipeline/chancalab/cases/circuit_cases.py` defines 17 cases across 4 categories spanning the whole comminution
circuit. The App shows **one selected case**; Experiments/Benchmark show **cross-case summaries by category**. Every
result is a calibrated-**physics-model** output (the Whiten engine), NOT a real plant.

| Category | Case ids | What they exercise |
|---|---|---|
| **primary (gyratory + jaw)** | G01, G02, J01, J02 | coarse RoM feed, wide settings, slow; gyratory (tall revolution chamber) + jaw (planar V) |
| **secondary cone** | S01–S06 | the workhorse; S01 is the reference choke optimum; soft↔hard, coarse↔fines, under/over the capacity hump |
| **tertiary (cone + short-head)** | T01, T02, H01, H02 | fine feed, tight settings, fast; short-head = finest product, smallest chamber |
| **controls** | CP1, CI1, CK1 | CP1 pass-through (negative), CI1 CSS>feed-top (invalid), CK1 calibration anchor |

## The controls (must NOT render silent garbage)

* **CP1 (negative / pass-through):** CSS (160 mm) wider than F80 — the engine must show **≈zero reduction** and flag
  the pass-through regime, not a pretty plot.
* **CI1 (invalid):** CSS (280 mm) wider than the feed top — the engine must **FLAG invalidity** (conditioning /
  mass-closure / non-negativity guard). Contract 1 also rejects it at ingestion (`cssMm > 2.5× feedX63Mm`).
* **CK1 (calibration):** an operating point matched to published industrial cone data (**Duarte et al. 2021**, DOI
  10.3390/min11111256) for absolute-number calibration; kept disjoint from the held-out validation set.

## Honesty / roadmap

* The physics engine is the source of truth and the **surrogate emulates IT, not a real plant**. The held-out
  surrogate metrics are vs an independent 2nd LHS draw of the engine.
* The **3D chamber is a kinematic animation** (honestly labelled); the offline **2-D DEM tracer** (`stages/dem.py`)
  is the documented next increment that upgrades the particle cloud.
* No real plant data is used or claimed. The calibration anchor is the only tie to published absolute numbers.

See [`../architecture/06_model-evaluation.md`](../architecture/06_model-evaluation.md) for the held-out + monotone +
AE protocol, and the per-case `data/derived/manifests/<case>.json` for the exact recorded numbers.
