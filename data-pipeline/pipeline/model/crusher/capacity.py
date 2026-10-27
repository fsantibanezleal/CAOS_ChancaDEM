"""Capacity, power and nip geometry. Counterpart of ``frontend/src/engine/capacity.ts``.

Capacity (Evertsson flow model, reduced form): throughput is unimodal in eccentric speed. At low speed the chamber
discharges slowly; past an optimum the gyrating head obstructs free fall faster than gravity clears material, so
capacity falls (the capacity hump). Q = Q_ref * openFactor * s * e^(1 - s) with s = speed / speed_opt (peaks at
s = 1) and openFactor proportional to the discharge opening (CSS + throw / 2). A reduced parametric form of
Evertsson (2000), Cone Crusher Performance; absolute numbers are illustrative per-machine references.

Power (Bond 1952): W = 10 Wi (1 / sqrt(P80) - 1 / sqrt(F80)) [kWh/t] with sizes in micrometres; draw [kW] = W * Q.
The calibrated lane uses the HP500 current-based model of Rocha et al. 2024, Table 5: Pc = 1.30 Pd + 110 kW.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .jsmath import jdiv, jexp, jmax, jsqrt


@dataclass(frozen=True)
class CapModel:
    q_ref: float        # reference capacity [t/h]
    speed_opt: float    # optimal eccentric speed [rpm]
    ref_gap_mm: float   # reference discharge gap [mm]


CAP: dict[str, CapModel] = {
    "cone-short-head": CapModel(200, 480, 12),   # tertiary short-head: finer, faster, smaller gap
    "gyratory": CapModel(4500, 150, 175),        # primary gyratory: very high t/h, slow gyration, OSS-set
    "cone-sec": CapModel(520, 360, 38),
    "cone-tert": CapModel(240, 400, 16),
    "jaw": CapModel(700, 300, 110),
}

# HP500 calibrated capacity base (Rocha et al. 2024, Table 4): anchored at QT of about 647 t/h. Real lane only.
HP500_QREF = 647


def throughput(machine: str, css_mm: float, throw_mm: float, speed_rpm: float, calibrated: bool = False) -> float:
    """Throughput [t/h] from machine, CSS, throw and speed. Unimodal in speed (the capacity hump)."""
    m = CAP[machine]
    q_ref = HP500_QREF if (calibrated and machine == "cone-sec") else m.q_ref
    open_factor = (css_mm + throw_mm / 2) / m.ref_gap_mm
    s = speed_rpm / m.speed_opt
    hump = s * jexp(1 - s)   # peaks at s = 1, value 1
    return jmax(0.0, q_ref * open_factor * hump)


def calibrated_power(bond_pd_kw: float) -> float:
    """HP500 current-based power: Pc = 1.30 Pd + 110 kW (no-load), Pd the Bond net comminution draw."""
    return 1.3 * bond_pd_kw + 110


def optimal_speed(machine: str) -> float:
    """The speed [rpm] that maximizes throughput for a machine (the hump apex)."""
    return CAP[machine].speed_opt


def bond_power(tph: float, f80_mm: float, p80_mm: float, wi: float) -> float:
    """Bond power draw [kW] from throughput and F80 / P80 [mm]."""
    f80um = f80_mm * 1000
    p80um = p80_mm * 1000
    if p80um <= 0 or f80um <= 0:
        return 0.0
    w = 10 * wi * (jdiv(1, jsqrt(p80um)) - jdiv(1, jsqrt(f80um)))   # kWh/t
    return jmax(0.0, w * tph)


def nip_angle(machine: str, css_mm: float) -> float:
    """Nip angle [deg], rising modestly with a wider setting (cone about 22 to 28, jaw about 18 to 26)."""
    base = 19 if machine == "jaw" else 22
    m = CAP[machine]
    return base + 6 * (css_mm / m.ref_gap_mm - 1) * 0.5


def nip_limit(mu: float = 0.35) -> float:
    """Grip limit 2 atan(mu) [deg]: a particle is nipped iff the nip angle is at or below it. mu about 0.35."""
    return (2 * math.atan(mu) * 180) / math.pi
