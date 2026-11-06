"""The variants of the CrusherBayes ablation: each one changes one component of the method and nothing else.

Every variant runs the product's own code (``pipeline.hp500.crusherbayes.build``) on the committed backbone and CrusherCal
documents, with the same folds, the same sampler size and a fixed seed. A variant is applied by changing module constants of
``pipeline.hp500.crusherbayes`` (the priors, the discrepancy scale) or the move of the ``emcee`` sampler, in the parent
process and, through the pool initializer, in every worker process, so the parent and the workers see the same model.

Variants (name: what changes):

  full-seed43, full-seed44   the method as committed, with another seed (Monte Carlo spread of the sampler)
  no-discrepancy             the discrepancy prior scale tau is 1e-6 of its value: the likelihood is the engine plus noise
  engine-fixed               the eight engine scalars are held at their nominal value (prior sd 1e-4 of the method's): only
                             the discrepancy and the noise are learned
  balance-fixed              the four population-balance scalars (s_K1, s_K2, K3, t10 shift) are held at their nominal value;
                             capacity, work index and power form are sampled
  wide-priors                the prior standard deviation of every engine scalar is doubled (bounds unchanged)
  tau-half, tau-double       the discrepancy prior scale tau is halved or doubled
  stretch-move               the affine-invariant stretch move of Goodman and Weare replaces the differential-evolution moves
"""
from __future__ import annotations

from pipeline.hp500 import crusherbayes as cb

ORIGINAL_INIT = cb._init_worker
ORIGINAL_PRIORS = cb.PRIORS
ORIGINAL_TAU = dict(cb.DISCREPANCY_SD)
FIXED_SD_FACTOR = 1e-4
NO_DISCREPANCY_FACTOR = 1e-6
BALANCE = ("k1_scale", "k2_scale", "k3", "t10_shift_pct")

VARIANTS = {
    "full-seed43": {"seed": 43},
    "full-seed44": {"seed": 44},
    "no-discrepancy": {"tau_factor": NO_DISCREPANCY_FACTOR},
    "engine-fixed": {"fix": tuple(p.name for p in ORIGINAL_PRIORS)},
    "balance-fixed": {"fix": BALANCE},
    "wide-priors": {"prior_sd_factor": 2.0},
    "tau-half": {"tau_factor": 0.5},
    "tau-double": {"tau_factor": 2.0},
    "stretch-move": {"move": "stretch"},
}


def apply(name: str) -> None:
    """Set the module constants of ``pipeline.hp500.crusherbayes`` (and the sampler move) for the variant ``name``."""
    v = VARIANTS[name]
    priors = []
    for p in ORIGINAL_PRIORS:
        sd = p.sd * v.get("prior_sd_factor", 1.0)
        if p.name in v.get("fix", ()):
            sd = p.sd * FIXED_SD_FACTOR
        priors.append(p._replace(sd=sd))
    cb.PRIORS = tuple(priors)
    cb.DISCREPANCY_SD.clear()
    cb.DISCREPANCY_SD.update({t: s * v.get("tau_factor", 1.0) for t, s in ORIGINAL_TAU.items()})
    if v.get("move") == "stretch":
        import emcee

        base = emcee.EnsembleSampler
        if not getattr(base, "_cb_stretch", False):
            class StretchSampler(base):
                _cb_stretch = True

                def __init__(self, *args, moves=None, **kwargs):
                    super().__init__(*args, moves=emcee.moves.StretchMove(), **kwargs)

            emcee.EnsembleSampler = StretchSampler


def init_worker(name: str, specs: list[dict]) -> None:
    """The pool initializer of a variant: the variant first, then the product's own initializer."""
    apply(name)
    ORIGINAL_INIT(specs)
