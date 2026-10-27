"""Typed objects passed between pipeline stages, the inter-stage contract. Plain dataclasses."""
from __future__ import annotations

from dataclasses import dataclass

from ..model.crusher import Operating


@dataclass(frozen=True)
class ParamsRecord:
    """One accepted row of contract 1 (catalog row params-record): a crusher operating point under a case id."""

    case_id: str
    machine: str
    css_mm: float          # closed-side setting [mm]
    throw_mm: float        # eccentric throw [mm]
    speed_rpm: float       # eccentric or gyration speed [rev/min]
    feed_x63_mm: float     # Rosin-Rammler characteristic size of the feed [mm]
    feed_m: float          # Rosin-Rammler uniformity exponent [-]
    ore_axb: float         # JKMRC A*b [-]
    ore_wi: float          # Bond work index [kWh/t]

    def operating(self) -> Operating:
        """The engine's operating point of this record (synthetic: not calibrated)."""
        return Operating(machine=self.machine, css_mm=self.css_mm, throw_mm=self.throw_mm, speed_rpm=self.speed_rpm,
                         feed_x63_mm=self.feed_x63_mm, feed_m=self.feed_m, ore_axb=self.ore_axb, ore_wi=self.ore_wi)
