"""The Whiten classification (selection) function C(d). Counterpart of ``frontend/src/engine/classification.ts``.

C(d) is the probability that a particle of size d entering the chamber is nipped and broken rather than passing
straight through (Whiten 1972; the K1/K2/K3 parameterization of Andersen and Napier-Munn 1988 and Napier-Munn et
al., Mineral Comminution Circuits, JKMRC 1996):

    C(d) = 0                                    for d <= K1
    C(d) = 1 - ((K2 - d) / (K2 - K1))^K3        for K1 < d < K2
    C(d) = 1                                    for d >= K2

K1 is linear in the closed-side setting. K2, the open-side capture threshold, tracks OSS = CSS + throw, so a larger
throw coarsens the product at fixed CSS (Evertsson 1999, DOI 10.1016/S0892-6875(99)00136-3). The per-machine slopes
are provisional literature-typical values. The calibrated path (cone-sec, f80 supplied) is the HP500 fit to the 10
Minas Rio surveys (Rocha et al. 2024, Table 5, DOI 10.3390/min14090919): K1 = 0.23 CSS + 0.30 f80,
K2 = 12.0 + 0.55 CSS + 0.40 f80, K3 = 2.3, independent of the throw.
"""
from __future__ import annotations

from dataclasses import dataclass

from .jsmath import jdiv, jmax, jpow
from .machines import REF_THROW_MM
from .types import Classification

# Fraction of the throw deviation (from the design throw) added to K2, as a multiple of the K2-vs-CSS slope. 0.5
# mirrors the mean-gap convention used for capacity (CSS + throw / 2).
K2_THROW_FRAC = 0.5


@dataclass(frozen=True)
class KModel:
    k1a: float
    k1b: float
    k2a: float
    k2b: float
    k3: float


KMODEL: dict[str, KModel] = {
    "cone-sec": KModel(0.2, 0.90, 6.0, 1.95, 2.3),
    "cone-tert": KModel(0.1, 0.85, 3.0, 1.75, 2.5),
    "cone-short-head": KModel(0.1, 0.82, 2.4, 1.65, 2.7),   # tighter classification (longer parallel zone)
    "gyratory": KModel(0.6, 0.95, 10.0, 2.10, 2.0),          # coarse primary, OSS-controlled
    "jaw": KModel(2.0, 0.95, 20.0, 2.30, 2.1),
}


def hp500_params(css_mm: float, f80_mm: float) -> Classification:
    """HP500 secondary-cone classification calibrated to the 10 Minas Rio surveys (Rocha et al. 2024, Table 5)."""
    k1 = 0.23 * css_mm + 0.3 * f80_mm
    k2 = 12.0 + 0.55 * css_mm + 0.4 * f80_mm
    return Classification(k1=k1, k2=jmax(k2, k1 * 1.05), k3=2.3)


def classification_params(
    machine: str,
    css_mm: float,
    f80_mm: float | None = None,
    calibrated: bool = False,
    throw_mm: float | None = None,
) -> Classification:
    """Build K1, K2, K3 from machine, CSS and throw. Synthetic path: K1 linear in CSS, K2 linear in CSS and throw,
    centered on the machine design throw. Calibrated path: the HP500 fit, linear in CSS and f80."""
    if calibrated and machine == "cone-sec" and f80_mm is not None:
        return hp500_params(css_mm, f80_mm)
    km = KMODEL[machine]
    d_throw = (REF_THROW_MM[machine] if throw_mm is None else throw_mm) - REF_THROW_MM[machine]
    k1 = km.k1a + km.k1b * css_mm
    k2 = km.k2a + km.k2b * css_mm + km.k2b * K2_THROW_FRAC * d_throw
    return Classification(k1=k1, k2=jmax(k2, k1 * 1.05), k3=km.k3)


def classify(d_mm: float, c: Classification) -> float:
    """Classification probability for a particle of size d [mm]. Monotone non-decreasing in d, in [0, 1]."""
    if d_mm <= c.k1:
        return 0.0
    if d_mm >= c.k2:
        return 1.0
    r = jdiv(c.k2 - d_mm, c.k2 - c.k1)
    return 1 - jpow(r, c.k3)
