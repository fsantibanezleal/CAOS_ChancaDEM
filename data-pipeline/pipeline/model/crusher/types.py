"""Domain types of the crusher engine. Counterpart of ``frontend/src/engine/types.ts``.

All physical quantities are SI-ish mining units: sizes in millimetres, throughput in tonnes per hour, power in
kilowatts, specific energy in kWh per tonne. ``Operating`` is exactly the sliders the studio exposes;
``CrusherResult`` is a complete evaluation of one operating point. Field names are the snake_case of the TypeScript
camelCase names (``cssMm`` is ``css_mm``).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Machine = Literal["cone-sec", "cone-tert", "cone-short-head", "gyratory", "jaw"]
Regime = Literal["choke", "trickle", "pass-through", "invalid"]


@dataclass(frozen=True)
class Operating:
    """The operating point. ``calibrated`` selects the HP500 secondary-cone parameters calibrated to the
    Rocha et al. 2024 surveys (the real-survey lane); synthetic operation leaves it False."""

    machine: Machine
    css_mm: float        # closed-side setting (narrowest gap) [mm]
    throw_mm: float      # eccentric throw = OSS - CSS [mm]
    speed_rpm: float     # eccentric or gyration speed [rev/min]
    feed_x63_mm: float   # Rosin-Rammler characteristic size of the feed (63.2% passing) [mm]
    feed_m: float        # Rosin-Rammler uniformity exponent of the feed [-]
    ore_axb: float       # JKMRC drop-weight ore competence A*b [-] (lower is harder)
    ore_wi: float        # Bond work index [kWh/t]
    calibrated: bool = False


@dataclass(frozen=True)
class PSD:
    """Particle-size distribution on the engine's geometric sieve grid."""

    edges_mm: tuple[float, ...]   # K+1 sieve aperture edges, descending (coarse to fine) [mm]
    mid_mm: tuple[float, ...]     # K geometric class mid-sizes [mm]
    mass: tuple[float, ...]       # K normalized mass fraction per class (sum = 1)
    passing: tuple[float, ...]    # K+1 cumulative fraction passing at each edge [0..1]


@dataclass(frozen=True)
class Classification:
    """Classification (selection) parameters K1, K2, K3 of the Whiten model."""

    k1: float
    k2: float
    k3: float


@dataclass(frozen=True)
class CrusherResult:
    op: Operating
    feed: PSD
    product: PSD
    f80: float
    p80: float
    p50: float
    p20: float
    reduction_ratio: float               # F80 / P80
    pct_passing: dict[int, float] = field(default_factory=dict)   # product fraction passing at 1, 4, 8, 16, 32 mm
    throughput_tph: float = 0.0
    power_kw: float = 0.0
    specific_energy_kwh_t: float = 0.0   # Ecs effectively applied [kWh/t]
    oss_mm: float = 0.0                  # open-side setting = CSS + throw [mm]
    nip_angle_deg: float = 0.0
    nip_limit_deg: float = 0.0           # grip limit 2 * atan(mu) [deg]
    regime: Regime = "choke"
    valid: bool = True
    flags: tuple[str, ...] = ()          # why a point is flagged invalid or extrapolating
    out_of_envelope: bool = False        # any envelope check tripped (implausible or extrapolating)
    implausible: bool = False            # physically nonsensical input (worse than extrapolation)
    envelope_codes: tuple[str, ...] = ()
    mass_closure: float = 0.0            # |sum(product) - sum(feed)|, about 0
    cond_estimate: float = 0.0           # conditioning proxy of (I - B*C)
