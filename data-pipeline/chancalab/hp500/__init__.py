"""CrusherCal: the leave-one-survey-out (LOO) validation of the calibrated HP500 backbone + a bounded residual.

The backbone predictions are produced by the SAME live TypeScript engine the browser runs (bridged to
data/derived/hp500/backbone.json by sweep/bake_hp500.mjs); this package only VALIDATES them out-of-sample and
quantifies uncertainty. No accuracy claim is made in code; the committed JSON traces report whatever the 10
real surveys show, including null results.
"""
