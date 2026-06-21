"""Typed objects passed between pipeline stages — the inter-stage contract. Plain dataclasses (no heavy deps); the
same types describe an operating point whether it came from a case, a CSV, or a live bring-your-own query."""
from __future__ import annotations

from dataclasses import dataclass, field

MACHINES = ("cone-sec", "cone-tert", "cone-short-head", "gyratory", "jaw")
SIEVE_GRID_MM = (1, 4, 8, 16, 32)          # the %-passing grid the surrogate predicts
SURROGATE_OUTPUTS = ("p80", "p50", "p20", "pass1", "pass4", "pass8", "pass16", "pass32", "tph", "kW")


@dataclass(frozen=True)
class Operating:
    """One validated crusher operating point (CONTRACT 1 output) — exactly the studio's sliders."""
    case_id: str
    machine: str               # one of MACHINES
    cssMm: float               # closed-side setting (narrowest gap) [mm]
    throwMm: float             # eccentric throw = OSS - CSS [mm]
    speedRpm: float            # eccentric / gyration speed [rev/min]
    feedX63Mm: float           # Rosin-Rammler characteristic size of the feed (63.2% passing) [mm]
    feedM: float               # Rosin-Rammler uniformity exponent of the feed [-]
    oreAxb: float              # JKMRC drop-weight ore competence A*b [-] (lower = harder)
    oreWi: float = 0.0         # Bond work index [kWh/t] (derived from A*b if 0)
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class CrusherResult:
    """The engine output summary for one operating point (the trace payload). Mirrors the TS CrusherResult."""
    case_id: str
    p80: float
    p50: float
    p20: float
    pct_passing: dict          # {1,4,8,16,32: fraction}
    throughput_tph: float
    power_kw: float
    reduction_ratio: float
    specific_energy_kwh_t: float
    regime: str                # choke | trickle | pass-through | invalid
    valid: bool
    extra: dict = field(default_factory=dict)
