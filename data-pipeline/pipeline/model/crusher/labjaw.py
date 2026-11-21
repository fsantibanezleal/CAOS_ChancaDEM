"""The laboratory jaw crusher on the canonical engine: capacity of Sastri (1994), a laboratory classification preset
with the published ranges as a band, the evaluation of a narrow feed class through the engine's own breakage and Whiten
solve, Bond's energy per unit of work index, and the ore link.

Offline only. No machine id joins the plant engine's ``Machine`` list, the learned models' encodings and the TypeScript
engine do not change, and this module has no TypeScript counterpart, so it uses ``math`` and not the ``jsmath``
helpers that keep the two engines equal. Standard library only, like the engine's other modules.

Nothing here is fitted to the throughput, the power or the product of the laboratory jaw it is compared with: the
capacity is Sastri's printed equations on the machine's geometry, the classification is the literature's first estimate
(Donovan 2003, section 2.1.2: K1 equal to the closed-side setting, K2 near the open-side setting, K3 = 2.3) and its
published ranges (King 2000, Technical Notes 5, equations 5.8 to 5.10) are the sensitivity band. No function reads a
measured value; a test greps this file for them.

Units: sizes in millimetres unless a name ends in ``_m`` (metres); throughput in t/h (``_tph``) or kg/h; speed in
strokes per minute (rpm); energy in kWh/t.
"""
from __future__ import annotations

import itertools
import math
from dataclasses import dataclass

from .breakage import breakage_matrix, phi_from_t10, specific_energy, t10_of
from .capacity import bond_power
from .classification import classify
from .engine import grid_edges, grid_mid
from .sieve import passing_at_size, size_at_passing, to_psd
from .types import PSD, Classification
from .whiten import whiten_solve

# --- Sastri (1994) constants, as printed -------------------------------------------------------------------------------
G_M_S2 = 9.81                    # gravitational acceleration, equation 4 [m/s2]
HIGH_SPEED_COEF = 450.0          # equation 4: a = 450 g / N^2, half the square of 30 s rpm (the half stroke) [s2 rpm2]
CRITICAL_SPEED_COEF = 66.4       # equation 8, the square root of 450 g [rpm m^0.5]
MIN_PER_H = 60.0                 # equations 5 and 6: strokes per minute to strokes per hour [min/h]
DEPTH_SMALL_GAPE_COEF = 3.25     # equation 12: D = 3.25 G^1.15, G and D in metres [m^(-0.15)]
DEPTH_SMALL_GAPE_EXP = 1.15      # equation 12 [dimensionless]
DEPTH_LARGE_GAPE_INTERCEPT_M = 0.21   # equation 13: D = 0.21 + 1.8 G [m]
DEPTH_LARGE_GAPE_SLOPE = 1.8     # equation 13 [dimensionless]
DEPTH_GAPE_SWITCH_M = 0.25       # equations 12 and 13 switch at this gape [m]
K1_FEED_OFFSET = 0.85            # equation 10: K1 = 0.85 - (Fav / G)^2.5 [dimensionless]
K1_FEED_EXP = 2.5                # equation 10 [dimensionless]
K2_COEF = 1.92                   # equation 11: K2 = 1.92 x 10^(-6.5 T / G) [dimensionless]
K2_EXP_PER_RATIO = 6.5           # equation 11, multiplies T / G [dimensionless]

# --- the engine's classification floor and the flags (the engine's own wording) --------------------------------------------
K2_FLOOR_OVER_K1 = 1.05          # the engine's floor: K2 is never below 1.05 K1 [dimensionless]
COND_LIMIT = 1e6                 # the engine's conditioning limit of the Whiten matrix [dimensionless]
NEAR_UNITY_RATIO = 1.05          # the engine's reduction-ratio floor for "negligible breakage" [dimensionless]
FLAG_PASS_THROUGH = "CSS ≥ feed lower limit, little size reduction (pass-through regime)"
FLAG_NEGLIGIBLE = "reduction ratio ≈ 1, negligible breakage"
FLAG_ILL_CONDITIONED = "ill-conditioned breakage matrix near choke"
FIRST_ESTIMATE_K3 = 2.3          # Donovan 2003, section 2.1.2: K3 about 2.3 [dimensionless]
KG_PER_T = 1000.0                # [kg/t]
MM_PER_M = 1000.0                # [mm/m]
J_PER_KG_PER_KWH_T = 3600.0      # 1 kWh/t = 3600 J/kg [J/kg per kWh/t]
BOND_COEF = 10.0                 # Bond (1952): W = 10 Wi (1 / sqrt(P80) - 1 / sqrt(F80)), sizes in micrometres [kWh/t]
EDGE_TOL = 1e-9                 # relative tolerance for a sieve edge to equal a class limit (float rounding of the grid) [-]
PASSING_FRACTION_F80 = 0.8       # the 80 percent passing point of a size distribution [fraction]
PASSING_FRACTION_P50 = 0.5       # the median point of a size distribution [fraction]


# --- 1. the jaw capacity model of Sastri (1994) --------------------------------------------------------------------------

def depth_between_jaws_m(gape_m: float) -> float:
    """Vertical depth between the jaws D [m] from the gape G [m]: Sastri (1994) equation 12, D = 3.25 G^1.15 for
    G <= 0.25 m, and equation 13, D = 0.21 + 1.8 G for G >= 0.25 m."""
    if gape_m <= 0:
        raise ValueError("the gape must be positive")
    if gape_m <= DEPTH_GAPE_SWITCH_M:
        return DEPTH_SMALL_GAPE_COEF * gape_m**DEPTH_SMALL_GAPE_EXP
    return DEPTH_LARGE_GAPE_INTERCEPT_M + DEPTH_LARGE_GAPE_SLOPE * gape_m


def _free_travel_m(gape_m: float, css_m: float, throw_m: float) -> float:
    """G - (S + T) [m], the gap that stays after the closed-side setting and the throw; it must be positive."""
    free = gape_m - (css_m + throw_m)
    if css_m < 0 or throw_m <= 0 or free <= 0:
        raise ValueError("the gape must exceed the closed-side setting plus the throw, and the throw must be positive")
    return free


def critical_speed_rpm(gape_m: float, css_m: float, throw_m: float, depth_m: float) -> float:
    """Critical speed Nc [rpm]: Sastri (1994) equation 8, Nc = 66.4 {[G - (S + T)] / (D T)}^0.5, lengths in metres.
    Below it the capacity rises with speed (the low-speed form), at and above it falls (the high-speed form)."""
    return CRITICAL_SPEED_COEF * math.sqrt(_free_travel_m(gape_m, css_m, throw_m) / (depth_m * throw_m))


def volumetric_capacity_m3_h(speed_rpm: float, width_m: float, css_m: float, throw_m: float, gape_m: float,
                             depth_m: float) -> float:
    """Volumetric capacity Vh [m3/h]: Sastri (1994) equations 5 and 6, Vh = 60 N w (S + T/2) a, with the height of
    the prism ``a`` of equation 2, a = D T / [G - (S + T)] (low speed), below the critical speed of equation 8, and of
    equation 4, a = 450 g / N^2 (high speed), at or above it. N in rpm, lengths in metres."""
    if speed_rpm <= 0 or width_m <= 0 or depth_m <= 0:
        raise ValueError("speed, width and depth must be positive")
    free = _free_travel_m(gape_m, css_m, throw_m)
    if speed_rpm >= critical_speed_rpm(gape_m, css_m, throw_m, depth_m):
        a_m = HIGH_SPEED_COEF * G_M_S2 / speed_rpm**2
    else:
        a_m = depth_m * throw_m / free
    return MIN_PER_H * speed_rpm * width_m * (css_m + throw_m / 2) * a_m


def feed_factor(mean_feed_m: float, gape_m: float) -> float:
    """Feed-size factor K1 [dimensionless]: Sastri (1994) equation 10, K1 = 0.85 - (Fav / G)^2.5, Fav the average feed
    size [m] and G the gape [m]. Floored at 0 so a feed close to the gape never gives a negative capacity."""
    if gape_m <= 0 or mean_feed_m < 0:
        raise ValueError("the gape must be positive and the mean feed size not negative")
    return max(0.0, K1_FEED_OFFSET - (mean_feed_m / gape_m) ** K1_FEED_EXP)


def throw_factor(throw_m: float, gape_m: float) -> float:
    """Throw factor K2 [dimensionless]: Sastri (1994) equation 11, K2 = 1.92 x 10^(-6.5 T / G), T and G in metres. This is
    Sastri's K2, not the classification parameter K2 of the Whiten model."""
    if gape_m <= 0 or throw_m < 0:
        raise ValueError("the gape must be positive and the throw not negative")
    return K2_COEF * 10 ** (-K2_EXP_PER_RATIO * throw_m / gape_m)


@dataclass(frozen=True)
class JawCapacity:
    """The factors of Sastri's equation 9. ``k1``, ``k2`` and ``k3`` are Sastri's capacity factors, not the Whiten
    classification parameters."""

    depth_m: float             # vertical depth between the jaws D [m], equations 12 and 13 or as given
    critical_speed_rpm: float  # Nc [rpm], equation 8
    branch: str                # "low-speed" (equation 5) below Nc, "high-speed" (equation 6) at or above it
    vh_m3_h: float             # volumetric capacity [m3/h]
    k1: float                  # feed-size factor [-], equation 10
    k2: float                  # throw factor [-], equation 11
    k3: float                  # material factor [-]: 1.0 harder materials, 0.6 softer ones such as coal and coke
    density_t_m3: float        # true density of the ore [t/m3]
    w_tph: float               # capacity W = Vh K1 K2 K3 d [t/h], equation 9


def jaw_capacity_tph(speed_rpm: float, width_m: float, css_m: float, throw_m: float, gape_m: float,
                     mean_feed_m: float, density_t_m3: float, k3: float = 1.0, depth_m: float | None = None) -> JawCapacity:
    """Capacity of a jaw crusher in t/h: Sastri (1994) equation 9, W = Vh K1 K2 K3 d, with every factor returned.
    Speed in rpm, lengths in metres, density in t/m3. ``depth_m`` None takes equations 12 and 13. A mean feed size at or
    above the gape is refused."""
    if density_t_m3 <= 0 or k3 <= 0:
        raise ValueError("the density and the material factor must be positive")
    if not 0 < mean_feed_m < gape_m:
        raise ValueError("the mean feed size must be positive and below the gape")
    depth = depth_between_jaws_m(gape_m) if depth_m is None else depth_m
    nc = critical_speed_rpm(gape_m, css_m, throw_m, depth)
    vh = volumetric_capacity_m3_h(speed_rpm, width_m, css_m, throw_m, gape_m, depth)
    k1 = feed_factor(mean_feed_m, gape_m)
    k2 = throw_factor(throw_m, gape_m)
    return JawCapacity(
        depth_m=depth, critical_speed_rpm=nc, branch="high-speed" if speed_rpm >= nc else "low-speed", vh_m3_h=vh,
        k1=k1, k2=k2, k3=k3, density_t_m3=density_t_m3, w_tph=vh * k1 * k2 * k3 * density_t_m3,
    )


# --- 2. the laboratory machine and its classification preset ---------------------------------------------------------------

@dataclass(frozen=True)
class LabJaw:
    """A laboratory jaw crusher, as the capacity model and the evaluation need it."""

    gape_mm: float        # feed opening, the gape G [mm]
    width_mm: float       # jaw width w [mm]
    throw_mm: float       # swing jaw throw T [mm]; the open-side setting is the closed-side setting plus this
    density_t_m3: float   # true density of the ore [t/m3]
    material_k3: float    # Sastri's material factor [-]: 1.0 harder materials, 0.6 softer ones


# Barrios, Jimenez-Herrera, Fuentes-Torres and Tavares (2020), Minerals 10(8):717, https://doi.org/10.3390/min10080717:
# Table 2 (feed
# opening 140 x 90 mm, throw 10 mm; the closed discharge and the stroke frequency are the operating point, not the
# machine) and Table 3 (ore density 2700 kg/m3). The ore is a gold-bearing intrusive rock, predominantly granodiorite
# (section 2.1 of the paper): a harder material in Sastri's two classes (K3 = 1.0).
OTSUKA_BARRIOS_2020 = LabJaw(gape_mm=90.0, width_mm=140.0, throw_mm=10.0, density_t_m3=2.70, material_k3=1.0)


@dataclass(frozen=True)
class KingRanges:
    """The published ranges of the classification parameters of a crusher."""

    alpha1: tuple[float, float]   # K1 = alpha1 CSS, the range of alpha1 [-]
    alpha2: tuple[float, float]   # K2 = alpha2 CSS, the range of alpha2 [-]
    n: tuple[float, float]        # the exponent of the classification curve (K3) [-]
    source: str


# King, R. P., Technical Notes 5, Crushers (2000), equations 5.8 to 5.10, pages 5-4 and 5-5: "alpha1 varies from about 0.5
# to 0.95 and alpha2 varies from about 1.7 to 3.5. n is usually approximately 2 but can be as low as 1 and as high as 3."
KING_RANGES = KingRanges(
    alpha1=(0.5, 0.95), alpha2=(1.7, 3.5), n=(1.0, 3.0),
    source="King (2000), Technical Notes 5, Crushers, equations 5.8 to 5.10, pages 5-4 and 5-5",
)


def lab_classification(css_mm: float, throw_mm: float, alpha1: float = 1.0, alpha2: float | None = None,
                       n: float = FIRST_ESTIMATE_K3) -> Classification:
    """The laboratory classification [mm]: K1 = alpha1 CSS, K2 = OSS = CSS + throw when ``alpha2`` is None and alpha2 CSS
    otherwise, K3 = n (a dimensionless exponent), K2 floored at 1.05 K1 as the engine does. The defaults are the first
    estimate of Donovan (2003), section 2.1.2 (K1 the closed-side setting, K2 the open-side setting, K3 = 2.3); the
    ranges of King (2000) are ``KING_RANGES``."""
    if css_mm <= 0 or throw_mm < 0:
        raise ValueError("the closed-side setting must be positive and the throw not negative")
    k1 = alpha1 * css_mm
    k2 = css_mm + throw_mm if alpha2 is None else alpha2 * css_mm
    return Classification(k1=k1, k2=max(k2, K2_FLOOR_OVER_K1 * k1), k3=n)


# --- 3. the feed ---------------------------------------------------------------------------------------------------------------

def _check_class(d_min_mm: float, d_max_mm: float) -> None:
    if not (0 < d_min_mm < d_max_mm) or not math.isfinite(d_max_mm):
        raise ValueError("a feed class needs 0 < d_min < d_max")


def _class_cum(d_mm: float, d_min_mm: float, d_max_mm: float) -> float:
    """Cumulative mass fraction of a class of spheres with diameters uniform in [d_min, d_max] passing d [mm]: mass goes
    as d^3, so the cumulative mass goes as d^4."""
    if d_mm <= d_min_mm * (1 + EDGE_TOL):
        return 0.0
    if d_mm >= d_max_mm * (1 - EDGE_TOL):
        return 1.0   # exact: a sieve edge that equals a class limit up to the grid's rounding gives no residue mass
    return (d_mm**4 - d_min_mm**4) / (d_max_mm**4 - d_min_mm**4)


def class_feed(d_min_mm: float, d_max_mm: float) -> PSD:
    """The mass distribution of a narrow feed class on the engine's grid [mm]: spheres with diameters uniform in
    [d_min, d_max], its cumulative mass passing d being (d^4 - d_min^4) / (d_max^4 - d_min^4), integrated over each
    sieve class so mass is conserved. A class inside one sieve class gives one non-zero class."""
    _check_class(d_min_mm, d_max_mm)
    edges = grid_edges()
    if d_max_mm > edges[0]:
        raise ValueError("the feed class exceeds the top size of the engine's grid")
    mass = [_class_cum(edges[i], d_min_mm, d_max_mm) - _class_cum(edges[i + 1], d_min_mm, d_max_mm) for i in range(len(edges) - 1)]
    return to_psd(edges, mass)


def class_f80_mm(d_min_mm: float, d_max_mm: float) -> float:
    """The analytic F80 of a feed class [mm]: the size at 80 percent of the cumulative mass, (d_min^4 + 0.8 (d_max^4 -
    d_min^4))^(1/4)."""
    _check_class(d_min_mm, d_max_mm)
    return (d_min_mm**4 + PASSING_FRACTION_F80 * (d_max_mm**4 - d_min_mm**4)) ** 0.25


def class_mean_mm(d_min_mm: float, d_max_mm: float) -> float:
    """The arithmetic mean of the class limits [mm], Sastri's average feed size Fav (his Table 2 uses it)."""
    _check_class(d_min_mm, d_max_mm)
    return (d_min_mm + d_max_mm) / 2


# --- 4. the evaluation --------------------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class LabJawResult:
    d_min_mm: float                  # lower limit of the feed class [mm]
    d_max_mm: float                  # upper limit of the feed class [mm]
    css_mm: float                    # closed-side setting [mm]
    speed_rpm: float                 # strokes per minute [rpm]
    feed: PSD                        # the class on the engine's grid
    product: PSD                     # the Whiten product on the engine's grid
    classification: Classification   # K1, K2 [mm] and K3 [-] used
    t10: float                       # t10 of the breakage function [fraction]
    f80_mm: float                    # analytic F80 of the feed class [mm]
    grid_f80_mm: float               # F80 read on the grid by interpolation [mm]
    p80_mm: float                    # product P80 on the grid [mm]
    p50_mm: float                    # product P50 on the grid [mm]
    reduction_ratio: float           # analytic F80 over P80 [-]
    capacity: JawCapacity            # the capacity result of Sastri's equation 9
    throughput_tph: float            # [t/h]
    throughput_kg_h: float           # [kg/h]
    bond_kwh_t_per_wi: float         # Bond's energy per unit of work index [kWh/t per kWh/t of Wi]; no power is returned
    mass_closure: float              # |sum(product) - sum(feed)| of the Whiten solve [-]
    cond_estimate: float             # conditioning proxy of (I - B C) [-]
    pass_through: bool               # the setting is at or above the feed's lower limit
    ill_conditioned: bool            # the Whiten matrix is ill conditioned
    flags: tuple[str, ...]           # the engine's wording of the flags above


def evaluate_lab_jaw(jaw: LabJaw, d_min_mm: float, d_max_mm: float, css_mm: float, speed_rpm: float, ore_axb: float,
                     classification: Classification | None = None) -> LabJawResult:
    """Evaluate a narrow feed class [mm] on a laboratory jaw: the product by the engine's classification, breakage
    (t10 from ``specific_energy(speed_rpm, throw)`` and the ore's A*b, dimensionless) and Whiten solve, the throughput by
    Sastri's equation 9 at the mean of the class limits, and Bond's energy per unit of work index. ``classification`` None
    takes the first estimate ``lab_classification(css_mm, jaw.throw_mm)``. The feed's upper limit at or above the gape, or
    limits not 0 < d_min < d_max, raise ``ValueError``; a setting at or above the lower limit is evaluated and flagged."""
    _check_class(d_min_mm, d_max_mm)
    if d_max_mm >= jaw.gape_mm:
        raise ValueError("the feed class must be below the gape")
    if css_mm <= 0 or speed_rpm <= 0:
        raise ValueError("the closed-side setting and the speed must be positive")
    cls = lab_classification(css_mm, jaw.throw_mm) if classification is None else classification

    edges, mid = grid_edges(), grid_mid()
    feed = class_feed(d_min_mm, d_max_mm)
    t10 = t10_of(specific_energy(speed_rpm, jaw.throw_mm), ore_axb)
    n = len(mid)
    w = whiten_solve([classify(d, cls) for d in mid], breakage_matrix(edges, mid, phi_from_t10(t10)), list(feed.mass), n)
    product = to_psd(edges, w.product)

    f80 = class_f80_mm(d_min_mm, d_max_mm)
    p80 = size_at_passing(product, PASSING_FRACTION_F80)
    p50 = size_at_passing(product, PASSING_FRACTION_P50)
    ratio = f80 / p80 if p80 > 0 else 0.0
    cap = jaw_capacity_tph(speed_rpm, jaw.width_mm / MM_PER_M, css_mm / MM_PER_M, jaw.throw_mm / MM_PER_M,
                           jaw.gape_mm / MM_PER_M, class_mean_mm(d_min_mm, d_max_mm) / MM_PER_M, jaw.density_t_m3,
                           jaw.material_k3)
    # the engine's Bond form at a work index of one and a throughput of one: kWh/t per kWh/t of work index
    bond = bond_power(1.0, f80, p80, 1.0)

    pass_through = css_mm >= d_min_mm
    ill = not math.isfinite(w.cond) or w.cond > COND_LIMIT
    flags: list[str] = []
    if pass_through:
        flags.append(FLAG_PASS_THROUGH)
    if ratio < NEAR_UNITY_RATIO:
        flags.append(FLAG_NEGLIGIBLE)
    if ill:
        flags.append(FLAG_ILL_CONDITIONED)

    return LabJawResult(
        d_min_mm=d_min_mm, d_max_mm=d_max_mm, css_mm=css_mm, speed_rpm=speed_rpm, feed=feed, product=product,
        classification=cls, t10=t10, f80_mm=f80, grid_f80_mm=size_at_passing(feed, PASSING_FRACTION_F80), p80_mm=p80,
        p50_mm=p50, reduction_ratio=ratio, capacity=cap, throughput_tph=cap.w_tph, throughput_kg_h=cap.w_tph * KG_PER_T,
        bond_kwh_t_per_wi=bond, mass_closure=w.mass_closure, cond_estimate=w.cond, pass_through=pass_through,
        ill_conditioned=ill, flags=tuple(flags),
    )


# --- 5. the band ---------------------------------------------------------------------------------------------------------------

Corner = tuple[float, float, float]   # (alpha1, alpha2, n)
DEFAULT_BAND_SIEVES_MM = (1.0, 2.0, 4.0, 8.0, 16.0)   # sieve apertures read for the passing band [mm]


@dataclass(frozen=True)
class BandExtreme:
    low: float
    low_corner: Corner    # the corner of King's ranges that gives the lowest value
    high: float
    high_corner: Corner   # the corner that gives the highest value


@dataclass(frozen=True)
class KingBand:
    p80: BandExtreme                       # [mm]
    p50: BandExtreme                       # [mm]
    passing: dict[float, BandExtreme]      # fraction passing at each sieve [mm] (the key)
    n_corners: int


def _extreme(values: dict[Corner, float]) -> BandExtreme:
    low = min(values, key=lambda c: values[c])
    high = max(values, key=lambda c: values[c])
    return BandExtreme(low=values[low], low_corner=low, high=values[high], high_corner=high)


def king_band(jaw: LabJaw, d_min_mm: float, d_max_mm: float, css_mm: float, speed_rpm: float, ore_axb: float,
              sieves_mm: tuple[float, ...] = DEFAULT_BAND_SIEVES_MM) -> KingBand:
    """The sensitivity band over the published ranges of King (2000): the evaluation at the eight corners (alpha1 0.5 and
    0.95, alpha2 1.7 and 3.5, n 1 and 3) and, for P80 [mm], P50 [mm] and the fraction passing at each of ``sieves_mm``, the
    lowest and highest value with the corner (alpha1, alpha2, n) that gives each."""
    results: dict[Corner, LabJawResult] = {}
    for a1, a2, n in itertools.product(KING_RANGES.alpha1, KING_RANGES.alpha2, KING_RANGES.n):
        cls = lab_classification(css_mm, jaw.throw_mm, alpha1=a1, alpha2=a2, n=n)
        results[(a1, a2, n)] = evaluate_lab_jaw(jaw, d_min_mm, d_max_mm, css_mm, speed_rpm, ore_axb, classification=cls)
    return KingBand(
        p80=_extreme({c: r.p80_mm for c, r in results.items()}),
        p50=_extreme({c: r.p50_mm for c, r in results.items()}),
        passing={s: _extreme({c: passing_at_size(r.product, s) for c, r in results.items()}) for s in sieves_mm},
        n_corners=len(results),
    )


# --- 6. the ore link -----------------------------------------------------------------------------------------------------------

def axb_from_fracture_energy(a_max_percent: float, b_prime: float, e50_j_kg: float) -> float:
    """The JKMRC ore competence A*b [percent per kWh/t] from the fracture-energy parameters: 3600 A b' / E50, with A the
    asymptote of t10 [percent], b' the dimensionless exponent of Tavares (2022) and E50 the median fracture energy
    [J/kg] (1 kWh/t = 3600 J/kg).

    It equates the exponents of the two published t10 laws, t10 = A (1 - exp(-b Ecs)) (Narayanan and Whiten 1988) and
    t10 = A (1 - exp(-b' E / E50)) (Tavares 2022, https://doi.org/10.14356/kona.2022012, equation 20), so b = b' / E50 on
    one energy basis. No source states this conversion: it is the algebra of the two forms. It makes b depend on the
    particle size through E50, while the engine holds b constant for an ore, so the value is that of one size class."""
    if e50_j_kg <= 0:
        raise ValueError("E50 must be positive")
    return J_PER_KG_PER_KWH_T * a_max_percent * b_prime / e50_j_kg


__all__ = [
    "LabJaw", "OTSUKA_BARRIOS_2020", "KING_RANGES", "KingRanges", "JawCapacity", "LabJawResult", "KingBand", "BandExtreme",
    "depth_between_jaws_m", "critical_speed_rpm", "volumetric_capacity_m3_h", "feed_factor", "throw_factor",
    "jaw_capacity_tph", "lab_classification", "class_feed", "class_f80_mm", "class_mean_mm", "evaluate_lab_jaw",
    "king_band", "axb_from_fracture_energy",
]
