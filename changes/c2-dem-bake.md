- The discrete element method is now a method the product runs: the bake command `data-pipeline/run.py dem` runs the laboratory jaw
  crusher of Barrios et al. 2020 at three operating points (the feed classes 63/52, 31.5/26.5 and 16/13.2 mm at 6.0 Hz and a 7.5 mm
  closed side, 6 kg batches, seed 1) through the published package `crushdem` 0.6.0, and writes the document of the new catalog row
  `dem-run` 1.0.0 (`data/derived/dem/jaw-lab.json`): the measurement, the particle simulation and the population balance of the laboratory
  preset at each point, nine verdicts per point against the bands set before the runs (throughput 10 percent, net power 30 percent,
  reduction ratio 15 percent), and one replay file of particle frames per point (16-bit spheres, thinned to 1.5 MB). A run that does not
  complete is recorded as the package leaves it, with no window statistic and every verdict that needs one `not compared`; the
  document's state is then `partial` and readiness names the incomplete points.
- The raw run records are kept outside the repository (`--runs`, or `CAOS_DATA_ROOT/chancadem/dem-runs`), keyed by the point, the
  settings, the package version and the bytes of the installed package, so a later bake of the same inputs does not run the simulation
  again. The simulation never runs in CI or in the browser.
- The units gate has a domain for the laboratory machine (nameplate and geometry, never a measured result) and holds the document's
  simulated and predicted values in the bake and again in `scripts/check_artifacts.py`, which also checks each replay file's bytes and
  sha256 digest. Readiness gains the four states of `dem-run`; the web descriptor and its conformance test read the document in both
  directions. Pins: `crushdem[jit]` 0.6.0, `numba` 0.68.1, `llvmlite` 0.50.0 (requirements-precompute.txt).
