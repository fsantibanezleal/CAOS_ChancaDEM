"""The three operating points of the laboratory jaw crusher and the run settings (DM-001, DM-007), fixed as frozen data.

Nothing here reads a measured throughput, net power or product size of the jaw: the feed classes, the closed-side setting, the
frequency and the batch are the paper's experimental conditions (Barrios et al. 2020, Minerals 10(8):717,
https://doi.org/10.3390/min10080717, Table 2 p. 3 and section 2.2), and the bands were set before any run of the product (plan of
2026-10-27). The run controls (the overlap ladder, the stall rule, the stroke limit, the particle slots) are the package's own
defaults of its validation case and are never changed to make a run complete. A test holds the points to the package's feed classes.
"""
from __future__ import annotations

from dataclasses import dataclass

SEED = 1                          # the seed of every run [dimensionless]
ORE = "paper"                     # the package's ore derived from the paper's single-particle tests (crushdem.cases.barrios2020.paper_ore)
BACKEND = "numba"                 # the package's compiled CPU backend
ROLE = "chancadem dem-run"        # the label of the run in the package's record
CSS_MM = 7.5                      # closed-side setting of every point [mm] (Table 2, p. 3)
THROW_MM = 10.0                   # swing jaw throw [mm] (Table 2, p. 3)
OSS_MM = CSS_MM + THROW_MM        # open-side setting, the closed side plus the throw [mm] (the package's reading of the throw)
FREQUENCY_HZ = 6.0                # stroke frequency [Hz] (the paper's experiments)
SPEED_RPM = 60.0 * FREQUENCY_HZ   # the same frequency in strokes per minute [1/min]
BATCH_KG = 6.0                    # batch fed at each point [kg] (section 2.2: about 6 kg)
OVERLAP_LADDER = (0.3, 0.5)       # the overlap limits tried in turn [fraction of the smaller radius]; the package's OVERLAP_LADDER
OVERLAP_REFERENCE = 0.3           # the limit of the package's contact model that the window overlap is counted against [fraction]; the package's
STALL_STROKES = 40                # strokes without 0.1 percent of the batch passing after which a run is stalled [strokes]
MAX_STROKES = 400                 # the stroke limit of a run [strokes]
MAX_WALL_S = 1.0e9                # the wall-time limit [s]: about 31 years, so it never binds and the document never depends on the machine
MINIMUM_SPHERE_MM = 4.0           # the smallest sphere the package keeps [mm] (the ore's min_diameter); finer progeny are pooled as fines
FRAMES_PER_STROKE = 12            # frames recorded per stroke [frames/stroke]
FRAME_FIRST_STROKE = 1            # the first stroke recorded [stroke]
FRAME_LAST_STROKE = MAX_STROKES   # the last stroke recorded [stroke]: every stroke the run can reach
REPLAY_BUDGET_BYTES = 1_500_000   # the size a replay file may take [bytes]
THINNING = (12, 6, 4, 3, 2, 1)    # the frames per stroke the replay may keep, the largest that fits the budget [frames/stroke]
SIEVES_MM = (1.0, 1.4, 2.4, 3.4, 4.0, 4.75, 6.7, 9.5, 13.2, 16.0, 19.0, 22.4, 26.5, 31.5, 45.0, 63.0)  # the document's sieves [mm]: the paper's nine, the smallest sphere, and the sizes up to the coarsest feed
BANDS = {"throughput": 0.10, "net_power": 0.30, "reduction_ratio": 0.15}   # relative bands [dimensionless], set before any run
BANDS_SET = "Set before any run of the product, in the plan of 2026-10-27 (requirements DM-005): throughput within 10 percent, net power within 30 percent, the reduction ratio F80 over P80 within 15 percent."

# the paper's machine (Table 2, p. 3); the laboratory-jaw module holds the same values for the population balance
MACHINE_NAME = "Laboratory jaw crusher of Barrios et al. 2020"
MACHINE_SOURCE = "Table 2, p. 3: feed opening 140 x 90 mm, swing jaw throw 10 mm, stroke frequency 6.0 Hz, closed-side setting 7.5 mm"
PAPER_DOI = "10.3390/min10080717"
PAPER_LICENSE = "CC BY 4.0"
PAPER_PACKAGE_DATA = "the digitised figures are package data of crushdem (crushdem/cases/data/barrios2020_digitised.json)"

# the texts of the laboratory preset; each restates the comment or docstring of data-pipeline/pipeline/model/crusher/labjaw.py that carries it
PRESET_FIRST_ESTIMATE = "Donovan (2003), section 2.1.2: K1 equal to the closed-side setting, K2 near the open-side setting, K3 about 2.3"
PRESET_CAPACITY = "Sastri (1994), equation 9, W = Vh K1 K2 K3 d, with the factors of equations 2 to 13 on the machine's geometry (the laboratory-jaw module)"
PRESET_ORE_LINK = ("A times b is 3600 A b' over E50: the equation of the exponents of the two published t10 laws (Narayanan and Whiten 1988; "
                   "Tavares 2022, https://doi.org/10.14356/kona.2022012, equation 20), which is the product's own algebra and not a published conversion; "
                   "E50 is that of the particle simulation's ore at the feed class's mean size")
PRESET_POWER = "No work index, A, b or fracture energy of the ore is published, so the population balance predicts no power at these points"


@dataclass(frozen=True)
class Point:
    """One operating point: a feed class of the paper at the shared closed-side setting and frequency."""

    id: str            # the point's name, the feed class with the slash replaced
    feed_class: str    # the package's key of the feed class, upper over lower sieve [mm]
    lower_mm: float    # the lower limit of the feed class [mm]
    upper_mm: float    # the upper limit of the feed class [mm]
    capacity: int      # the particle slots of the pool [spheres]: 1500 for the two coarser classes, 3000 for the finest (about 1,300 spheres alive)


POINTS = (
    Point("63-52", "63/52", 52.0, 63.0, 1500),
    Point("31.5-26.5", "31.5/26.5", 26.5, 31.5, 1500),
    Point("16-13.2", "16/13.2", 13.2, 16.0, 3000),
)


@dataclass(frozen=True)
class RunSettings:
    """The settings of a run, as the package's ``run_case`` takes them."""

    seed: int = SEED
    ore: str = ORE
    backend: str = BACKEND
    mass_kg: float = BATCH_KG
    frequency_hz: float = FREQUENCY_HZ
    closed_side_setting_m: float = CSS_MM / 1000.0
    overlaps: tuple = OVERLAP_LADDER
    max_strokes: int = MAX_STROKES
    max_wall_s: float = MAX_WALL_S
    stall_strokes: int = STALL_STROKES
    frames: tuple | None = (FRAME_FIRST_STROKE, FRAME_LAST_STROKE, FRAMES_PER_STROKE)   # (first stroke, last stroke, per stroke), or None for no frames


DEFAULT_SETTINGS = RunSettings()


def by_id(point_id: str) -> Point:
    return next(p for p in POINTS if p.id == point_id)
