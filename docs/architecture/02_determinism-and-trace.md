# Determinism and the trace

**A run is a pure function of the operating point and the seed.** The crusher engine has no random draw at all, so the
result of a case depends on its operating point only. The seed (42 by default, `SEED` in `pipeline.py`) is recorded in
every manifest and drives the places that do draw: the label-shuffle and the permutations of CrusherCal
(`hp500/loo.py`, seeds 42, 43 and 44 for the three targets) and, through its own parameter, the model training
(`stages/train.py`, 12345, with the held-out draw 67890). Every generator is made by `core/rng.py` (`make_rng`) or, for
the Latin-hypercube sweep, by the seeded mulberry32 generator of `model/sweep.py`, a pure function of the seed. No global
or implicit generator exists in the pipeline.

Consequences, each tested:

- the same inputs give byte-identical artifacts (`tests/test_pipeline_smoke.py::test_adversarial_same_seed_bakes_identical_bytes_and_a_changed_byte_of_equal_size_is_seen`);
- the committed bake is what the code regenerates (`test_the_committed_bake_is_what_the_code_regenerates`), so a
  reviewer can rebake into a sandbox and compare;
- a different seed is a different bake record (`test_a_different_seed_is_a_different_bake_record`);
- no wall clock is stored: the manifest carries the lane verdict and the budgets, not the measured time, and the
  readiness document carries the product version and the catalog's SHA-256 instead of a time, so a rebake does not dirty
  the tree.

The committed artifacts are the evidence the web replays (ADR-0054); reproducing them is a rebake, not a claim.

## The trace

`core/trace.py` (`build_trace`, schema `chancadem.trace/v1`, catalog row `trace`) is the compact replay artifact of one
case. It is not the solver state: it is the gradations on the sieve grid and two small sweeps, enough to draw every replay
view and to hold the live engine to the bake. Fields:

| Field | Content |
|---|---|
| `sieve_mm`, `mid_mm` | the 29 grid edges and the 28 class mid-sizes |
| `feed_passing`, `product_passing`, `feed_mass`, `product_mass` | the feed and the product on the grid |
| `classification` | $C(d)$ at the class mid-sizes |
| `appearance_t10` | the $t_{10}$ of the case |
| `summary` | $F_{80}$, $P_{80}$, $P_{50}$, $P_{20}$, reduction ratio, percent passing at 1, 4, 8, 16, 32 mm, throughput, power, specific energy, open-side setting, nip angle and limit, regime, validity, envelope flags, mass closure, conditioning proxy |
| `speed_sweep` | 31 speeds from 0.5 to 1.5 times the case speed, with throughput and power |
| `css_sweep` | 31 settings from 0.5 to 1.5 times the case setting (the lower end at least 1 mm), with $P_{80}$, throughput and power |

Every number is written to six significant digits as a float (`r6`) and the file is compact JSON (`io/formats.py`,
`write_json`), so a rebake is byte-identical and each trace is small: the committed 27 traces are 3.9 to 4.1 KB each.
A sweep point the engine cannot evaluate is written as 0, and an infinite conditioning proxy as the string `Infinity`.

The manifest (`core/manifest.py`) points at the trace with its byte size and sha256, and `scripts/check_artifacts.py`
recomputes both. The trace is the one place the Python and TypeScript engines meet in the App's contract: the web's parity
test runs the TypeScript engine at each manifest's point and compares it with the committed trace to the six digits
([architecture 04](04_live-lane.md)). The web's types are generated from the schema files
([architecture 08](08_data-contracts.md)).
