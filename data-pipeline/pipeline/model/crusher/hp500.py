"""The real-survey lane of the HP500 secondary cone (Minas Rio itabirite). Counterpart of the constants and the
``opOfSurvey`` of the TypeScript app layer (``frontend/src/data/real/hp500-minasrio.ts`` and
``frontend/src/state/store.ts``).

Source (open access, CC BY 4.0): Rocha, Campos, Silva and Tavares, "Fit-for-Purpose Model of HP500 Cone Crusher in
Size Reduction of Itabirite Iron Ore", Minerals 2024, 14(9), 919, DOI 10.3390/min14090919. The surveys vary only the
CSS and the feed f80; the eccentric throw and speed are machine constants. The feed is reconstructed from the measured
f80 with a Rosin-Rammler band (m = 0.9, the documented assumption); the ore competence and the Bond work index are the
itabirite blend; ``calibrated=True`` switches the engine to the Table 5 fit. The survey table itself is not here.
"""
from __future__ import annotations

import math
from typing import NamedTuple

from .capacity import HP500_QREF
from .jsmath import jpow
from .types import Operating


class Hp500Nominal(NamedTuple):
    throw_mm: float
    speed_rpm: float


# Held fixed on the real lane: a representative mid of the HP500 throw range, and the cone-sec capacity optimum.
HP500_NOMINAL = Hp500Nominal(throw_mm=34, speed_rpm=360)

# Drop-weight ore competence bands for the itabirite blend (Table 1); Wi in kWh/t.
HP500_ORE = {
    "compact": {"A": 64.5, "b": 10.5, "axb": 677.3, "wi_kwh_t": 7.2},
    "supercompact": {"A": 56.1, "b": 2.2, "axb": 123.4, "wi_kwh_t": 10.6},
}
HP500_BLEND_WI_KWH_T = 9.0     # representative blend Wi of the modeled Bond power parity readout
HP500_FEED_M = 0.9             # Rosin-Rammler uniformity of the reconstructed feed


class Hp500Scalars(NamedTuple):
    """The engine's fitted scalars on the HP500 lane that enter throughput and power, each at its nominal (Rocha et al.
    2024, Tables 4 and 5, and the itabirite blend Wi). ``evaluate(op, scalars)`` runs the engine with other values; with
    none (or the defaults) it is the shipped engine number for number. CrusherBayes (pipeline.hp500.crusherbayes) samples
    them; nothing else reads them."""
    q_ref_tph: float = HP500_QREF     # capacity base QT [t/h]
    wi_kwh_t: float = HP500_BLEND_WI_KWH_T   # Bond work index of the blend [kWh/t]
    zeta: float = 1.30                # slope of the current-based power form Pc = zeta Pd + Pn [-]
    pn_kw: float = 110.0              # no-load power Pn [kW]
    k1_scale: float = 1.0             # multiplier of the K1 fit (K1 = 0.23 CSS + 0.30 f80) [-]
    k2_scale: float = 1.0             # multiplier of the K2 fit (K2 = 12.0 + 0.55 CSS + 0.40 f80) [-]
    k3: float = 2.3                   # classification exponent K3 [-]
    t10_shift_pct: float = 0.0        # shift of the t10 constant (64) [percentage points of t10]


def x63_from_f80(f80_mm: float, m: float = HP500_FEED_M) -> float:
    """Reconstruct the Rosin-Rammler characteristic size x63 from the measured f80. From R(x) = 1 - exp[-(x / x63)^m]
    at x = f80, R = 0.8: (f80 / x63)^m = ln 5, so x63 = f80 / ln(5)^(1 / m)."""
    return f80_mm / jpow(math.log(5), 1 / m)


def operating_from_survey(css_mm: float, f80_mm: float) -> Operating:
    """The operating point of an HP500 survey, as the store's ``opOfSurvey`` builds it."""
    return Operating(
        machine="cone-sec",
        css_mm=css_mm,
        throw_mm=HP500_NOMINAL.throw_mm,
        speed_rpm=HP500_NOMINAL.speed_rpm,
        feed_x63_mm=x63_from_f80(f80_mm),
        feed_m=HP500_FEED_M,
        ore_axb=HP500_ORE["compact"]["axb"],   # metadata only: the calibrated t10 does not use A*b
        ore_wi=HP500_BLEND_WI_KWH_T,
        calibrated=True,
    )
