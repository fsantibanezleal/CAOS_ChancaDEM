"""Top-level engine: an ``Operating`` point to a full ``CrusherResult``. Counterpart of
``frontend/src/engine/engine.ts``.

This is the canonical engine of ChancaDEM. It reproduces the shipped TypeScript engine (versions 0.02 to 0.09.003)
number for number, held to it by the reference fixture ``tests/fixtures/engine-reference.json``. Physics: the Whiten
crusher model (Whiten 1972; Napier-Munn et al. 1996) with an Andersen and Napier-Munn classification, a JKMRC
t10 and Austin appearance breakage, an Evertsson capacity hump and Bond power; the HP500 calibration of Rocha et
al. 2024 on the calibrated lane. The bake of the cases, the surrogate training and the HP500 validation call
``evaluate``.
"""
from __future__ import annotations

import math
from dataclasses import replace

from .breakage import breakage_matrix, phi_from_t10, specific_energy, t10_calibrated, t10_of
from .bounds import check_bounds
from .capacity import bond_power, calibrated_power, nip_angle, nip_limit, throughput
from .classification import classification_params, classify
from .envelope import check_envelope
from .feed import make_feed, rosin_rammler_size_at
from .hp500 import Hp500Scalars
from .jsmath import jfloor
from .machines import REF_THROW_MM
from .sieve import make_grid, mid_sizes, passing_at_size, size_at_passing, to_psd
from .types import CrusherResult, Operating
from .whiten import whiten_solve

TOP_MM = 256        # sieve top size [mm]
K = 28              # sieve classes (square-root-of-two series, 256 mm down to 256 / 2^14 = 0.0156 mm)
READOUT_SIZES = (1, 4, 8, 16, 32)

_EDGES = make_grid(TOP_MM, K)
_MID = mid_sizes(_EDGES)


def grid_edges() -> list[float]:
    return list(_EDGES)


def grid_mid() -> list[float]:
    return list(_MID)


def grid_f80(op: Operating) -> float:
    """The feed 80%-passing size [mm] of an operating point read on the engine's grid, which stops at the top size: the
    F80 the model works with, below the declared one for a feed coarser than the grid."""
    return size_at_passing(make_feed(_EDGES, op.feed_x63_mm, op.feed_m), 0.8)


def evaluate(op: Operating, scalars: Hp500Scalars | None = None) -> CrusherResult:
    """Evaluate one operating point. ``scalars`` replaces the fitted scalars of the HP500 lane (CrusherBayes); None, or the
    defaults, is the shipped engine. It is only meaningful on the calibrated lane and is refused elsewhere."""
    if scalars is None:
        scalars = Hp500Scalars()
    elif not op.calibrated:
        raise ValueError("scalars replace the HP500 calibration and need a calibrated operating point")
    else:
        op = replace(op, ore_wi=scalars.wi_kwh_t)
    feed = make_feed(_EDGES, op.feed_x63_mm, op.feed_m)
    f80 = size_at_passing(feed, 0.8)

    # classification C(d); K2 tracks OSS = CSS + throw. The calibrated lane is the HP500 fit, throw-independent.
    cparams = classification_params(op.machine, op.css_mm, f80_mm=f80, calibrated=op.calibrated, throw_mm=op.throw_mm,
                                   k1_scale=scalars.k1_scale, k2_scale=scalars.k2_scale, k3=scalars.k3)
    c = [classify(d, cparams) for d in _MID]

    # breakage B from energy, t10 and Austin phi; the per-nip energy uses the machine design throw. Calibrated:
    # t10 comes straight from the HP500 fit.
    ecs = specific_energy(op.speed_rpm, REF_THROW_MM[op.machine])
    t10 = t10_calibrated(op.css_mm, f80, scalars.t10_shift_pct) if op.calibrated else t10_of(ecs, op.ore_axb)
    phi = phi_from_t10(t10)
    b = breakage_matrix(_EDGES, _MID, phi)

    w = whiten_solve(c, b, list(feed.mass), len(_MID))
    product = to_psd(_EDGES, w.product)

    p80 = size_at_passing(product, 0.8)
    p50 = size_at_passing(product, 0.5)
    p20 = size_at_passing(product, 0.2)
    reduction_ratio = f80 / p80 if p80 > 0 else 0.0
    pct_passing = {s: passing_at_size(product, s) for s in READOUT_SIZES}

    tph = throughput(op.machine, op.css_mm, op.throw_mm, op.speed_rpm, op.calibrated, scalars.q_ref_tph)
    bond_pd = bond_power(tph, f80, p80, op.ore_wi)
    # calibrated: the HP500 current-based model; synthetic keeps the raw Bond draw
    power_kw = calibrated_power(bond_pd, scalars.zeta, scalars.pn_kw) if op.calibrated else bond_pd

    oss_mm = op.css_mm + op.throw_mm
    nip = nip_angle(op.machine, op.css_mm)
    nip_lim = nip_limit()

    # regime and validity
    flags: list[str] = []
    regime = "choke"
    valid = True
    if op.css_mm >= f80:   # setting wider than 80% of the feed: most material passes ungripped
        regime = "pass-through"
        if op.css_mm >= feed.edges_mm[0]:
            valid = False
            flags.append("CSS ≥ feed top size, nothing is gripped")
        else:
            flags.append("CSS ≥ F80, little size reduction (pass-through regime)")
    if reduction_ratio < 1.05 and valid:
        regime = "pass-through" if regime == "choke" else regime
        flags.append("reduction ratio ≈ 1, negligible breakage")
    if not math.isfinite(w.cond) or w.cond > 1e6:
        valid = False
        flags.append("ill-conditioned breakage matrix near choke")
    if op.css_mm >= feed.edges_mm[0]:
        regime = "invalid"

    # envelope gate: a physically-nonsensical point is also marked invalid
    # the calibrated support is tested on the F80 the feed declares, not on the grid-truncated f80 above (a 180 mm feed
    # reads about 136 mm on the 256 mm grid); rounded to a micrometre so a survey on the 140 mm edge is not pushed over it
    # by float noise (the x63 of a survey is rebuilt from its f80 by the inverse law)
    declared_f80 = jfloor(rosin_rammler_size_at(0.8, op.feed_x63_mm, op.feed_m) * 1e6 + 0.5) / 1e6
    env = check_envelope(op, f80, declared_f80)
    for code in env.codes:
        if code not in flags:
            flags.append(code)
    if env.implausible:
        valid = False

    # sourced warnings, never invalid: a setting below the vendor minimum, a reduction ratio above the typical ceiling
    for code in check_bounds(op.machine, op.css_mm, reduction_ratio):
        if code not in flags:
            flags.append(code)

    return CrusherResult(
        op=op, feed=feed, product=product,
        f80=f80, p80=p80, p50=p50, p20=p20, reduction_ratio=reduction_ratio, pct_passing=pct_passing,
        throughput_tph=tph, power_kw=power_kw, specific_energy_kwh_t=ecs,
        oss_mm=oss_mm, nip_angle_deg=nip, nip_limit_deg=nip_lim, regime=regime,
        valid=valid, flags=tuple(flags), mass_closure=w.mass_closure, cond_estimate=w.cond,
        out_of_envelope=not env.in_envelope, implausible=env.implausible, envelope_codes=env.codes,
    )
