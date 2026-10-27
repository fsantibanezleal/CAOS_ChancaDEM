"""Oracles: independent closed-form checks the engine, the baked artifacts and the notebooks are held to.

An oracle shares no code with the engine (``pipeline/model/``): it states a relation the product must agree with, so a
disagreement is a finding about one of the two. The notebooks import it, as they import every method (CAOS_MANAGE
``conventions/product-notebooks.md`` section 1); none defines its own copy. Standard library only.

- Rosin-Rammler (1933): the cumulative passing is ``1 - exp(-(x / x63)^m)``, so at ``x = x63`` it equals ``1 - 1/e`` for
  every ``m``; the 80 percent passing size is ``x63 * ln(5)^(1/m)``.
- Bond (1952): the energy to reduce a feed of size F80 to a product of size P80 is
  ``W = 10 Wi (1 / sqrt(P80) - 1 / sqrt(F80))`` kWh/t with the sizes in micrometres and the work index Wi in kWh/t.
- Mass closure: a crusher neither creates nor destroys mass, so the product gradation sums to the feed gradation.
"""
from __future__ import annotations

import math

UM_PER_MM = 1000.0   # micrometres in a millimetre, converts the engine's mm sizes to the micrometres of the Bond relation


def rosin_rammler_passing(x_mm: float, x63_mm: float, m: float) -> float:
    """Cumulative fraction passing size ``x_mm`` of a Rosin-Rammler feed with characteristic size ``x63_mm`` and exponent ``m``."""
    if x_mm <= 0:
        return 0.0
    return 1.0 - math.exp(-((x_mm / x63_mm) ** m))


def rosin_rammler_x63_passing() -> float:
    """The passing fraction at x = x63 for every m: 1 - 1/e = 0.6321..."""
    return 1.0 - 1.0 / math.e


def rosin_rammler_size_at(fraction: float, x63_mm: float, m: float) -> float:
    """The size [mm] at a cumulative passing ``fraction`` in (0, 1): the inverse of the Rosin-Rammler law."""
    if not 0.0 < fraction < 1.0:
        raise ValueError(f"fraction {fraction} must lie strictly between 0 and 1")
    return x63_mm * (-math.log(1.0 - fraction)) ** (1.0 / m)


def bond_energy_kwh_t(f80_mm: float, p80_mm: float, wi_kwh_t: float) -> float:
    """Bond energy [kWh/t] for a reduction from ``f80_mm`` to ``p80_mm`` at work index ``wi_kwh_t``; zero for no reduction."""
    if f80_mm <= 0 or p80_mm <= 0:
        return 0.0
    return max(0.0, 10.0 * wi_kwh_t * (1.0 / math.sqrt(p80_mm * UM_PER_MM) - 1.0 / math.sqrt(f80_mm * UM_PER_MM)))


def bond_power_kw(throughput_tph: float, f80_mm: float, p80_mm: float, wi_kwh_t: float) -> float:
    """Bond draw [kW]: the energy per tonne times the tonnes per hour."""
    return bond_energy_kwh_t(f80_mm, p80_mm, wi_kwh_t) * throughput_tph


def mass_closure(feed_mass: list[float], product_mass: list[float]) -> float:
    """The absolute difference between the product and the feed mass (both fractions summing to one): zero when closed."""
    return abs(sum(product_mass) - sum(feed_mass))
