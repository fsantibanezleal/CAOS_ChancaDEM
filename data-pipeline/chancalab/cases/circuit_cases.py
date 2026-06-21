"""ChancaDEM cases spanning CATEGORIES (the comminution-circuit taxonomy). Each case is a complete operating point;
the App loads ONE and every view reacts; Experiments/Benchmark show cross-case summaries by category. Mirrors the
SPA's src/data/cases.ts. CP1/CI1 are deliberate negative/invalid CONTROLS (the engine must show ~zero reduction or
flag invalidity, not a pretty plot); CK1 is the absolute-number calibration anchor (Duarte et al. 2021).
All results are calibrated-PHYSICS-model outputs (the engine), NOT a real plant — stated openly."""
from __future__ import annotations

from dataclasses import dataclass

PRIMARY = "primary (gyratory + jaw)"
SECONDARY = "secondary cone"
TERTIARY = "tertiary (cone + short-head)"
CONTROL = "controls (negative / invalid / calibration)"


@dataclass(frozen=True)
class Case:
    id: str
    name: str
    category: str
    stage: str                 # primary | secondary | tertiary | control
    machine: str
    cssMm: float
    throwMm: float
    speedRpm: float
    feedX63Mm: float
    feedM: float
    oreAxb: float
    oreWi: float
    expected_band: str
    validation_anchor: str
    real_or_synthetic: str = "physics"   # calibrated-physics-model output, not a real plant
    control: str | None = None           # negative | invalid | calibration


CASES: list[Case] = [
    # ---- PRIMARY ----
    Case("G01", "Gyratory primary · hard · RoM", PRIMARY, "primary", "gyratory", 165, 30, 150, 600, 0.8, 40, 16,
         "very high tonnage, modest reduction; slow gyration, OSS-controlled wide setting", "circuit primary gyratory, hard RoM"),
    Case("G02", "Gyratory primary · soft · high-tonnage", PRIMARY, "primary", "gyratory", 195, 32, 160, 700, 0.85, 78, 12,
         "max throughput near the slow gyratory optimum", "circuit primary gyratory, soft ore"),
    Case("J01", "Jaw primary · hard · RoM", PRIMARY, "primary", "jaw", 125, 40, 300, 400, 0.9, 42, 16,
         "single-toggle V mechanism; near-CSS product at a wide setting", "circuit primary jaw, hard RoM"),
    Case("J02", "Jaw primary · medium · trickle", PRIMARY, "primary", "jaw", 80, 36, 280, 300, 1.0, 55, 14,
         "trickle-fed below choke — low fill, near-CSS product", "circuit primary jaw, trickle"),
    # ---- SECONDARY (S01 is the reference operating point) ----
    Case("S01", "Cone secondary · medium · choke", SECONDARY, "secondary", "cone-sec", 32, 30, 360, 90, 1.2, 55, 14,
         "well-graded choke feed at the capacity optimum — the reference point", "secondary-cone choke optimum (default)"),
    Case("S02", "Cone secondary · soft · coarse", SECONDARY, "secondary", "cone-sec", 40, 32, 300, 120, 1.0, 80, 11,
         "soft ore, coarse feed, open setting, below-optimum speed", "secondary cone, soft/coarse"),
    Case("S03", "Cone secondary · hard · over-speed", SECONDARY, "secondary", "cone-sec", 50, 30, 470, 130, 1.0, 38, 17,
         "past the capacity hump — tonnage falls as speed rises", "secondary cone, over the hump"),
    Case("S04", "Cone secondary · hard · RoM", SECONDARY, "secondary", "cone-sec", 80, 36, 360, 180, 0.9, 40, 16,
         "heavy-duty secondary on RoM feed at the optimum", "secondary cone, hard RoM"),
    Case("S05", "Cone secondary · fines-heavy", SECONDARY, "secondary", "cone-sec", 16, 26, 360, 55, 1.6, 55, 14,
         "tight setting, fines-heavy feed — high reduction, packing risk", "secondary cone, fines-heavy"),
    Case("S06", "Cone secondary · trickle-fed", SECONDARY, "secondary", "cone-sec", 12, 22, 360, 60, 1.2, 55, 14,
         "tight setting, single-particle feeding — low fill, near-CSS product", "secondary cone, trickle"),
    # ---- TERTIARY ----
    Case("T01", "Cone tertiary · fines", TERTIARY, "tertiary", "cone-tert", 8, 16, 400, 28, 1.5, 55, 14,
         "fine feed, tight setting at the higher tertiary optimum speed", "tertiary cone, fines"),
    Case("T02", "Cone tertiary · hard · closed", TERTIARY, "tertiary", "cone-tert", 10, 18, 410, 32, 1.4, 38, 18,
         "very tight closed setting — high reduction into the fine end", "tertiary cone, hard closed"),
    Case("H01", "Short-head tertiary · fine product", TERTIARY, "tertiary", "cone-short-head", 6, 14, 500, 22, 1.6, 55, 14,
         "finest product, fastest, smallest chamber — the cubicity duty", "short-head tertiary, fine"),
    Case("H02", "Short-head tertiary · hard · choke", TERTIARY, "tertiary", "cone-short-head", 10, 16, 470, 30, 1.5, 36, 18,
         "choke-fed on hard ore — tightest classification, high specific energy", "short-head tertiary, hard choke"),
    # ---- CONTROLS ----
    Case("CP1", "Pass-through (negative control)", CONTROL, "control", "cone-sec", 160, 30, 360, 90, 1.2, 55, 14,
         "CSS wider than F80 — ~zero reduction, pass-through regime flagged (NOT a pretty plot)",
         "negative control", control="negative"),
    Case("CI1", "CSS > feed top (invalid control)", CONTROL, "control", "cone-sec", 280, 30, 360, 90, 1.2, 55, 14,
         "CSS wider than the feed top — engine must FLAG invalidity (conditioning / mass-closure)",
         "invalid control", control="invalid"),
    Case("CK1", "Calibration anchor (HP-class cone)", CONTROL, "control", "cone-sec", 25, 30, 350, 80, 1.15, 52, 15,
         "matched to published industrial cone data for absolute-number calibration",
         "Duarte et al. 2021 (DOI 10.3390/min11111256)", control="calibration"),
]
