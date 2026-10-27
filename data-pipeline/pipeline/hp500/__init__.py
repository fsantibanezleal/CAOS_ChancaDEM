"""The HP500 real lane: the survey table contract (surveys), the calibrated backbone on the canonical Python engine
(backbone) and CrusherCal, the leave-one-survey-out validation of that backbone with a bounded residual (loo).

Data: Rocha, Campos, Silva and Tavares (2024), Minerals 14(9), 919, https://doi.org/10.3390/min14090919, CC BY 4.0.
The backbone predictions are produced by pipeline.model.crusher, the same physics the browser engine runs; this
module folder validates them out-of-sample and quantifies uncertainty. No accuracy claim is made in code; the
committed JSON documents report whatever the ten real surveys show, including null results.
"""
