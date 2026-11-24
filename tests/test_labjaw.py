"""The laboratory-jaw module of the canonical engine (``pipeline.model.crusher.labjaw``).

The capacity model is Sastri (1994) as printed, held to its Table 2 (Hersam's laboratory jaw) and to the values worked
by hand for the jaw of Barrios et al. 2020; the classification preset is the literature's first estimate with King's
ranges as a band; nothing in the module reads a measured throughput, power or product size (a test greps its source).
The plant engine and the learned models' encodings are untouched (the last tests).
"""
from __future__ import annotations

import dataclasses
import math
import re
import typing
from pathlib import Path

import pytest

from pipeline.model.crusher import labjaw
from pipeline.model.crusher.breakage import specific_energy, t10_of
from pipeline.model.crusher.capacity import CAP
from pipeline.model.crusher.classification import KMODEL
from pipeline.model.crusher.encoding import MACHINES
from pipeline.model.crusher.engine import evaluate as plant_evaluate
from pipeline.model.crusher.engine import grid_edges
from pipeline.model.crusher.labjaw import (
    KING_RANGES,
    OTSUKA_BARRIOS_2020,
    axb_from_fracture_energy,
    class_f80_mm,
    class_feed,
    class_mean_mm,
    critical_speed_rpm,
    depth_between_jaws_m,
    evaluate_lab_jaw,
    feed_factor,
    jaw_capacity_tph,
    king_band,
    lab_classification,
    throw_factor,
    volumetric_capacity_m3_h,
)
from pipeline.model.crusher.machines import REF_THROW_MM
from pipeline.model.crusher.sieve import passing_at_size, size_at_passing
from pipeline.model.crusher.types import Classification, Machine, Operating

JAW = OTSUKA_BARRIOS_2020
SPEED_RPM = 360.0                                   # 6.0 Hz of the laboratory jaw
CLASSES_MM = ((63.0, 52.0), (31.5, 26.5), (16.0, 13.2))   # the three narrow feeds, (upper, lower)
AXB = 92.3                                          # an ore competence A*b of the spec's ore-link example [-]

# Sastri 1994 Table 2 (Hersam's laboratory jaw): throw T [m], T/G, Fav/G, K1, Vh K1 K3 d [t/h], density d [t/m3].
HERSAM_W_M, HERSAM_D_M, HERSAM_N_RPM, HERSAM_S_M = 0.159, 0.206, 304.0, 0.00953
TABLE_2 = (
    (0.00551, 0.0438, 0.252, 0.818, 0.780, 2.61),
    (0.00551, 0.0484, 0.279, 0.809, 0.864, 2.61),
    (0.00551, 0.0628, 0.362, 0.771, 1.119, 2.61),
    (0.00551, 0.0839, 0.483, 0.688, 1.434, 2.61),
    (0.00318, 0.0272, 0.272, 0.811, 0.427, 2.66),
    (0.00396, 0.0337, 0.270, 0.812, 0.566, 2.66),
    (0.00475, 0.0401, 0.268, 0.812, 0.701, 2.66),
    (0.00551, 0.0463, 0.266, 0.814, 0.842, 2.66),
    (0.00635, 0.0529, 0.265, 0.814, 1.003, 2.66),
)


def _eval(d_max: float = 63.0, d_min: float = 52.0, css: float = 7.5, speed: float = SPEED_RPM, axb: float = AXB, **kw):
    return evaluate_lab_jaw(JAW, d_min, d_max, css, speed, axb, **kw)


# --- 1. the capacity model, Sastri 1994 as printed ------------------------------------------------------------------

@pytest.mark.parametrize("row", range(len(TABLE_2)))
def test_sastri_table_2_rows(row: int) -> None:
    """The column Vh K1 K3 d of Table 2. Eight rows reproduce within 0.2 percent (the printed values carry three
    significant figures: half a unit of the last digit of 0.780 is 0.064 percent, plus the rounding of T, T/G, Fav/G).
    The fifth row (T 3.18 mm) is 2.5 percent from the printed 0.427 (the equations give 0.438): the printed value is not
    reproduced by the printed equations, so its tolerance is 3 percent, stated and not hidden."""
    t_m, t_over_g, fav_over_g, k1_printed, printed, density = TABLE_2[row]
    gape_m = t_m / t_over_g
    vh = volumetric_capacity_m3_h(HERSAM_N_RPM, HERSAM_W_M, HERSAM_S_M, t_m, gape_m, HERSAM_D_M)
    k1 = feed_factor(fav_over_g * gape_m, gape_m)
    assert k1 == pytest.approx(k1_printed, abs=1e-3)           # the printed K1 has three decimals
    got = vh * k1 * 1.0 * density
    tol = 0.03 if row == 4 else 0.002
    assert got == pytest.approx(printed, rel=tol)


def test_table_2_fifth_row_is_the_only_one_outside_two_tenths_of_a_percent() -> None:
    off = []
    for t_m, t_over_g, fav_over_g, _k1, printed, density in TABLE_2:
        gape_m = t_m / t_over_g
        vh = volumetric_capacity_m3_h(HERSAM_N_RPM, HERSAM_W_M, HERSAM_S_M, t_m, gape_m, HERSAM_D_M)
        got = vh * feed_factor(fav_over_g * gape_m, gape_m) * density
        if abs(got - printed) / printed > 0.002:
            off.append(round(got / printed - 1, 3))
    assert off == [0.025]


def test_otsuka_values_to_four_significant_figures() -> None:
    g = JAW.gape_mm / 1000
    s, t = 0.0075, JAW.throw_mm / 1000
    d = depth_between_jaws_m(g)
    assert d == pytest.approx(0.2038, rel=5e-4)
    assert critical_speed_rpm(g, s, t, d) == pytest.approx(396.0, rel=5e-4)
    assert volumetric_capacity_m3_h(SPEED_RPM, 0.140, s, t, g, d) == pytest.approx(1.0627, rel=5e-4)
    assert throw_factor(t, g) == pytest.approx(0.3640, rel=5e-4)
    expected = {57.5: (0.5237, 547.0), 29.0: (0.7911, 826.2), 14.6: (0.8394, 876.7)}
    for fav_mm, (k1, w_kg_h) in expected.items():
        assert feed_factor(fav_mm / 1000, g) == pytest.approx(k1, rel=5e-4)
        cap = jaw_capacity_tph(SPEED_RPM, 0.140, s, t, g, fav_mm / 1000, 2.70, 1.0)
        assert cap.branch == "low-speed"
        assert cap.w_tph * 1000 == pytest.approx(w_kg_h, rel=5e-4)   # Eq. 9 with the K2 of Eq. 11


def test_the_capacity_result_carries_every_factor() -> None:
    g = 0.090
    cap = jaw_capacity_tph(SPEED_RPM, 0.140, 0.0075, 0.010, g, 0.0575, 2.70, 1.0)
    assert dataclasses.is_dataclass(cap) and cap.__dataclass_params__.frozen
    assert {f.name for f in dataclasses.fields(cap)} == {
        "depth_m", "critical_speed_rpm", "branch", "vh_m3_h", "k1", "k2", "k3", "density_t_m3", "w_tph"}
    assert cap.w_tph == pytest.approx(cap.vh_m3_h * cap.k1 * cap.k2 * cap.k3 * cap.density_t_m3, rel=1e-12)


def test_capacity_is_continuous_at_the_critical_speed_and_peaks_there() -> None:
    g, s, t, w = 0.090, 0.0075, 0.010, 0.140
    d = depth_between_jaws_m(g)
    nc = critical_speed_rpm(g, s, t, d)
    at = volumetric_capacity_m3_h(nc, w, s, t, g, d)
    # The two forms meet within 0.2 percent: the printed 66.4 of Eq. 8 is rounded (450 g / 66.4^2 is 1.0013 of 1).
    just_below = volumetric_capacity_m3_h(nc * (1 - 1e-9), w, s, t, g, d)
    assert at == pytest.approx(just_below, rel=2e-3)
    below = [volumetric_capacity_m3_h(nc * f, w, s, t, g, d) for f in (0.5, 0.7, 0.9, 0.99)]
    above = [volumetric_capacity_m3_h(nc * f, w, s, t, g, d) for f in (1.01, 1.2, 1.6, 2.0)]
    assert below == sorted(below) and above == sorted(above, reverse=True)
    assert max(below) < at * 1.0001 and max(above) < at * 1.0001
    # the branch is a result: at or above the critical speed it is the high-speed form
    assert jaw_capacity_tph(nc, w, s, t, g, 0.03, 2.7).branch == "high-speed"
    assert jaw_capacity_tph(nc * 0.999, w, s, t, g, 0.03, 2.7).branch == "low-speed"


def test_high_speed_form_is_the_printed_equation_6() -> None:
    g, s, t, w, n = 0.090, 0.0075, 0.010, 0.140, 500.0
    d = depth_between_jaws_m(g)
    assert n > critical_speed_rpm(g, s, t, d)
    expected = 60 * n * w * (s + t / 2) * (450 * 9.81 / n**2)
    assert volumetric_capacity_m3_h(n, w, s, t, g, d) == pytest.approx(expected, rel=1e-12)


def test_depth_between_jaws_uses_the_two_branches_of_eqs_12_and_13() -> None:
    assert depth_between_jaws_m(0.25) == pytest.approx(3.25 * 0.25**1.15, rel=1e-12)
    assert depth_between_jaws_m(0.25) == pytest.approx(0.21 + 1.8 * 0.25, rel=5e-3)   # the two meet at 0.25 m
    assert depth_between_jaws_m(0.5) == pytest.approx(0.21 + 1.8 * 0.5, rel=1e-12)


def test_a_coarser_feed_lowers_the_capacity() -> None:
    g, s, t = 0.090, 0.0075, 0.010
    ws = [jaw_capacity_tph(SPEED_RPM, 0.140, s, t, g, fav, 2.7).w_tph for fav in (0.0146, 0.029, 0.0575)]
    assert ws[0] > ws[1] > ws[2] > 0


def test_a_feed_at_or_above_the_gape_is_refused_and_k2_never_below_the_floor() -> None:
    with pytest.raises(ValueError):
        jaw_capacity_tph(SPEED_RPM, 0.140, 0.0075, 0.010, 0.090, 0.090, 2.7)       # mean size at the gape
    with pytest.raises(ValueError):
        volumetric_capacity_m3_h(SPEED_RPM, 0.140, 0.0075, 0.010, 0.0175, 0.2)    # S + T at the gape: no space
    assert feed_factor(0.0, 0.09) == pytest.approx(0.85)
    assert feed_factor(0.0899, 0.090) >= 0.0                                       # never a negative capacity


# --- 2. the laboratory machine and its preset -----------------------------------------------------------------------

def test_the_machine_and_the_first_estimate() -> None:
    assert dataclasses.is_dataclass(JAW) and JAW.__dataclass_params__.frozen
    assert (JAW.gape_mm, JAW.width_mm, JAW.throw_mm, JAW.density_t_m3, JAW.material_k3) == (90.0, 140.0, 10.0, 2.70, 1.0)
    c = lab_classification(7.5, 10.0)
    assert isinstance(c, Classification)
    assert (c.k1, c.k2, c.k3) == pytest.approx((7.5, 17.5, 2.3))


def test_oss_over_css_lies_inside_kings_alpha2_range() -> None:
    lo, hi = KING_RANGES.alpha2
    assert (lo, hi) == (1.7, 3.5)
    assert lo < (7.5 + 10.0) / 7.5 < hi
    assert KING_RANGES.alpha1 == (0.5, 0.95) and KING_RANGES.n == (1.0, 3.0)
    assert "King" in KING_RANGES.source and "5.8" in KING_RANGES.source


def test_alpha2_overrides_the_open_side_and_k2_is_floored() -> None:
    c = lab_classification(7.5, 10.0, alpha1=0.5, alpha2=3.5, n=3.0)
    assert (c.k1, c.k2, c.k3) == pytest.approx((3.75, 26.25, 3.0))
    # a K2 that would fall below 1.05 K1 is lifted to it (the engine's own floor)
    f = lab_classification(10.0, 0.0, alpha1=1.0, alpha2=None)                    # OSS = CSS: K2 = K1
    assert f.k2 == pytest.approx(1.05 * f.k1)
    g = lab_classification(10.0, 10.0, alpha1=0.95, alpha2=0.9)
    assert g.k2 == pytest.approx(1.05 * g.k1)


# --- 3. the feed ------------------------------------------------------------------------------------------------------

def test_class_feed_sums_to_one_and_63_52_lies_in_one_sieve_class() -> None:
    for d_max, d_min in CLASSES_MM:
        psd = class_feed(d_min, d_max)
        assert sum(psd.mass) == pytest.approx(1.0, abs=1e-12)
        assert psd.edges_mm == tuple(grid_edges())
        assert len([m for m in psd.mass if m > 0]) == 1                     # each narrow class sits in one sieve class
    assert class_feed(52.0, 63.0).passing[0] == pytest.approx(1.0)


def test_class_feed_integrates_the_mass_over_each_sieve_class_for_a_wide_class() -> None:
    d_min, d_max = 20.0, 100.0
    psd = class_feed(d_min, d_max)
    assert sum(psd.mass) == pytest.approx(1.0, abs=1e-12)
    cum = lambda d: (min(max(d, d_min), d_max) ** 4 - d_min**4) / (d_max**4 - d_min**4)    # noqa: E731
    for i, m in enumerate(psd.mass):
        assert m == pytest.approx(cum(psd.edges_mm[i]) - cum(psd.edges_mm[i + 1]), abs=1e-12)
    assert len([m for m in psd.mass if m > 0]) > 2


def test_class_f80_is_the_analytic_value() -> None:
    assert class_f80_mm(52.0, 63.0) == pytest.approx(61.24, abs=5e-3)
    assert class_mean_mm(52.0, 63.0) == 57.5 and class_mean_mm(26.5, 31.5) == 29.0 and class_mean_mm(13.2, 16.0) == 14.6
    # the size at 80 percent of the class's mass: round trip through the cumulative law
    d = class_f80_mm(13.2, 16.0)
    assert (d**4 - 13.2**4) / (16.0**4 - 13.2**4) == pytest.approx(0.8, abs=1e-12)


@pytest.mark.parametrize("d_min,d_max", [(0.0, 10.0), (-1.0, 10.0), (10.0, 10.0), (20.0, 10.0), (float("nan"), 10.0)])
def test_class_feed_refuses_bad_limits(d_min: float, d_max: float) -> None:
    with pytest.raises(ValueError):
        class_feed(d_min, d_max)


def test_a_feed_class_at_or_above_the_gape_is_refused() -> None:
    with pytest.raises(ValueError):
        evaluate_lab_jaw(JAW, 52.0, 90.0, 7.5, SPEED_RPM, AXB)                 # upper limit at the gape
    with pytest.raises(ValueError):
        evaluate_lab_jaw(JAW, 80.0, 120.0, 7.5, SPEED_RPM, AXB)
    with pytest.raises(ValueError):
        evaluate_lab_jaw(JAW, 60.0, 50.0, 7.5, SPEED_RPM, AXB)


# --- 4. the evaluation -----------------------------------------------------------------------------------------------

def test_the_evaluation_closes_mass_and_is_finer_than_the_feed() -> None:
    for d_max, d_min in CLASSES_MM:
        r = _eval(d_max, d_min)
        assert sum(r.product.mass) == pytest.approx(1.0, abs=1e-9)
        assert r.mass_closure < 1e-9
        assert r.p80_mm < r.f80_mm and r.p50_mm < r.p80_mm
        assert r.product.passing[0] == pytest.approx(1.0, abs=1e-9)


def test_every_product_size_is_below_the_feeds_top_size() -> None:
    for d_max, d_min in CLASSES_MM:
        r = _eval(d_max, d_min)
        assert passing_at_size(r.product, d_max) == pytest.approx(1.0, abs=1e-12)
        assert r.p80_mm < d_max


def test_a_tighter_setting_gives_a_finer_product() -> None:
    p80 = [_eval(css=css).p80_mm for css in (4.0, 5.5, 7.5, 10.0)]
    assert p80 == sorted(p80) and len(set(p80)) == 4
    p50 = [_eval(css=css).p50_mm for css in (4.0, 5.5, 7.5, 10.0)]
    assert p50 == sorted(p50)


def test_the_result_is_identical_on_a_second_call_and_the_feed_is_not_changed() -> None:
    a, b = _eval(), _eval()
    assert a == b


def test_the_result_fields_and_the_analytic_f80_for_the_reduction_ratio() -> None:
    r = _eval()
    assert r.f80_mm == pytest.approx(61.24, abs=5e-3)
    assert r.grid_f80_mm == pytest.approx(size_at_passing(r.feed, 0.8))
    assert r.grid_f80_mm != pytest.approx(r.f80_mm, abs=1e-3)               # the interpolated one differs: not used
    assert r.reduction_ratio == pytest.approx(r.f80_mm / r.p80_mm, rel=1e-12)
    assert r.reduction_ratio != pytest.approx(r.grid_f80_mm / r.p80_mm, rel=1e-6)
    ecs = specific_energy(SPEED_RPM, JAW.throw_mm)
    assert r.t10 == pytest.approx(t10_of(ecs, AXB), rel=1e-12)
    assert r.classification == lab_classification(7.5, 10.0)
    assert r.throughput_kg_h == pytest.approx(r.throughput_tph * 1000, rel=1e-12)
    assert r.throughput_tph == pytest.approx(r.capacity.w_tph, rel=1e-12)
    assert r.capacity.w_tph * 1000 == pytest.approx(
        jaw_capacity_tph(SPEED_RPM, 0.140, 0.0075, 0.010, 0.090, 0.0575, 2.70, 1.0).w_tph * 1000, rel=1e-12)
    assert r.flags == () and not r.pass_through and not r.ill_conditioned and math.isfinite(r.cond_estimate)


def test_bond_energy_per_unit_of_work_index() -> None:
    r = _eval()
    want = 10 * (1 / math.sqrt(r.p80_mm * 1000) - 1 / math.sqrt(r.f80_mm * 1000))
    assert r.bond_kwh_t_per_wi == pytest.approx(want, rel=1e-12)
    assert 0 < r.bond_kwh_t_per_wi < 1
    assert not hasattr(r, "power_kw")                                      # no power: the ore's work index is unpublished


def test_a_setting_at_or_above_the_feeds_lower_limit_is_flagged_as_pass_through() -> None:
    r = _eval(css=55.0)                                                    # CSS above the 52 mm lower limit
    assert r.pass_through and any("pass-through" in f for f in r.flags)
    assert r.p80_mm > 0                                                    # evaluated, never silently dropped
    assert not _eval(css=7.5).pass_through


def test_a_classification_can_be_supplied() -> None:
    narrow = Classification(k1=5.0, k2=12.0, k3=2.0)
    r = _eval(classification=narrow)
    assert r.classification == narrow and r.p80_mm < _eval().p80_mm


# --- 5. the band ---------------------------------------------------------------------------------------------------

def test_the_band_covers_the_eight_corners_and_names_the_corner_of_each_extreme() -> None:
    sieves = (2.0, 4.0, 8.0, 16.0)
    band = king_band(JAW, 52.0, 63.0, 7.5, SPEED_RPM, AXB, sieves_mm=sieves)
    assert band.n_corners == 8
    assert band.p80.low <= band.p80.high and band.p50.low <= band.p50.high
    assert set(band.passing) == set(sieves)
    corners = {(a1, a2, n) for a1 in KING_RANGES.alpha1 for a2 in KING_RANGES.alpha2 for n in KING_RANGES.n}
    for ext in (band.p80, band.p50, *band.passing.values()):
        assert ext.low_corner in corners and ext.high_corner in corners
        assert ext.low <= ext.high
    # the extreme is what that corner gives
    for which, value in (("low_corner", band.p80.low), ("high_corner", band.p80.high)):
        a1, a2, n = getattr(band.p80, which)
        r = _eval(classification=lab_classification(7.5, 10.0, alpha1=a1, alpha2=a2, n=n))
        assert r.p80_mm == pytest.approx(value, rel=1e-12)


def test_the_first_estimate_lies_inside_the_band() -> None:
    """alpha1 = 1.0 of the first estimate is just above King's 0.95, but K2 = OSS (alpha2 2.33) is inside the range, and
    the band's P80 extremes bracket the first estimate's P80."""
    for d_max, d_min in CLASSES_MM:
        band = king_band(JAW, d_min, d_max, 7.5, SPEED_RPM, AXB)
        assert band.p80.low <= _eval(d_max, d_min).p80_mm <= band.p80.high
        assert band.p50.low <= _eval(d_max, d_min).p50_mm <= band.p50.high


# --- 6. the ore link -----------------------------------------------------------------------------------------------

def test_axb_from_fracture_energy() -> None:
    assert axb_from_fracture_energy(59.7, 0.025, 58.2) == pytest.approx(92.3, abs=0.05)
    assert axb_from_fracture_energy(59.7, 0.025, 26.6) == pytest.approx(201.7, abs=0.5)   # the coarser class's E50
    doc = (axb_from_fracture_energy.__doc__ or "").lower()
    for needle in ("3600", "narayanan", "tavares", "no source states", "particle size", "e50"):
        assert needle in doc


# --- 7. nothing measured is read; the plant engine is untouched --------------------------------------------------------

MEASURED = ("799", "938", "1220", "1533", "0.34", "7.1", "0.426", "0.135", "0.166", "0.337", "1.22", "0.799", "0.938")


def _measured_hits(src: str) -> list[str]:
    return [m for m in MEASURED if re.search(r"(?<![\d.])" + re.escape(m) + r"(?![\d])", src)]


def test_the_module_source_holds_no_measured_value_of_the_laboratory_jaw() -> None:
    """No constant of the module equals or derives from the measured throughputs, the net power or the measured product
    sizes of the jaw it is compared with (the research ledger lists them: 799, 938 and 1220 kg/h, 0.34 kW, d80 7.1 mm,
    0.135, 0.166 and 0.337 kW, 0.426 kWh/t)."""
    src = Path(labjaw.__file__).read_text(encoding="utf-8")
    assert _measured_hits(src) == []
    assert "measured" not in {n.lower() for n in dir(labjaw)}
    # the standard library only, as the engine's modules are
    imported = set(re.findall(r"^(?:from|import)\s+([\w.]+)", src, flags=re.M))
    assert {i for i in imported if not i.startswith(".")} <= {"__future__", "itertools", "math", "dataclasses", "typing"}
    assert "import numpy" not in src


def test_the_plant_engine_holds_exactly_the_five_plant_machines() -> None:
    five = {"cone-sec", "cone-tert", "cone-short-head", "gyratory", "jaw"}
    assert set(typing.get_args(Machine)) == five
    assert set(CAP) == five and set(KMODEL) == five and set(REF_THROW_MM) == five and set(MACHINES) == five
    assert len(MACHINES) == 5                                              # the surrogate's one-hot width is 5
    assert not any("lab" in m for m in (*CAP, *KMODEL, *MACHINES))


def test_the_plant_jaw_is_unchanged_by_a_laboratory_evaluation() -> None:
    op = Operating("jaw", css_mm=110.0, throw_mm=25.0, speed_rpm=300.0, feed_x63_mm=250.0, feed_m=1.5, ore_axb=60.0, ore_wi=14.0)
    before = plant_evaluate(op)
    _eval()
    king_band(JAW, 52.0, 63.0, 7.5, SPEED_RPM, AXB)
    assert plant_evaluate(op) == before
    assert before.throughput_tph == pytest.approx(CAP["jaw"].q_ref * (110.0 + 12.5) / 110.0 * 1.0, rel=1e-9)


# --- adversarial: each planted defect must be caught --------------------------------------------------------------------

def test_adversarial_a_planted_measured_constant_is_caught_by_the_grep() -> None:
    clean = Path(labjaw.__file__).read_text(encoding="utf-8")
    assert _measured_hits(clean + "\nCALIBRATION_KG_H = 799\n") == ["799"]
    assert _measured_hits(clean + "\nP_KW = 0.34\n") == ["0.34"]
    assert _measured_hits(clean + "\nX = 1220.0\n") == ["1220"]
    assert _measured_hits(clean + "\nOK = 0.3401 + 17.1 + 7.15\n") == []        # a longer number is another number


def test_adversarial_a_planted_change_of_a_sastri_equation_fails_the_table(monkeypatch: pytest.MonkeyPatch) -> None:
    def rows_off() -> int:
        n = 0
        for t_m, t_over_g, fav_over_g, _k1, printed, density in TABLE_2:
            g = t_m / t_over_g
            vh = volumetric_capacity_m3_h(HERSAM_N_RPM, HERSAM_W_M, HERSAM_S_M, t_m, g, HERSAM_D_M)
            n += abs(vh * feed_factor(fav_over_g * g, g) * density - printed) / printed > 0.03
        return n
    assert rows_off() == 0
    monkeypatch.setattr(labjaw, "K1_FEED_EXP", 2.0)                       # equation 10 with the wrong exponent
    assert rows_off() >= 5
    monkeypatch.undo()
    monkeypatch.setattr(labjaw, "MIN_PER_H", 6.0)                         # a lost factor of ten in equations 5 and 6
    assert rows_off() == len(TABLE_2)


def test_adversarial_a_planted_branch_error_breaks_continuity_at_the_critical_speed(monkeypatch: pytest.MonkeyPatch) -> None:
    g, s, t, w = 0.090, 0.0075, 0.010, 0.140
    d = depth_between_jaws_m(g)
    nc = critical_speed_rpm(g, s, t, d)
    monkeypatch.setattr(labjaw, "HIGH_SPEED_COEF", 4.5 * 9.81)            # a factor of 100 on the high-speed prism height
    jump = volumetric_capacity_m3_h(nc, w, s, t, g, d) / volumetric_capacity_m3_h(nc * (1 - 1e-9), w, s, t, g, d)
    assert abs(jump - 1) > 0.5


def test_adversarial_a_sixth_machine_would_be_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(CAP, "lab-jaw", CAP["jaw"])
    with pytest.raises(AssertionError):
        test_the_plant_engine_holds_exactly_the_five_plant_machines()


def test_adversarial_a_k2_below_the_floor_is_lifted_never_returned_as_asked() -> None:
    for kwargs in ({"alpha1": 0.95, "alpha2": 0.9}, {"alpha1": 1.0, "alpha2": 1.0}, {"alpha1": 0.5, "alpha2": 0.4}):
        c = lab_classification(7.5, 10.0, **kwargs)
        assert c.k2 >= 1.05 * c.k1 - 1e-12 and c.k2 > c.k1
    assert lab_classification(7.5, 0.0).k2 == pytest.approx(1.05 * 7.5)           # OSS = CSS


def test_adversarial_bad_limits_and_a_class_at_the_gape_are_refused_and_f80_is_analytic() -> None:
    for d_min, d_max in ((0.0, 10.0), (10.0, 10.0), (20.0, 10.0), (-5.0, 10.0), (float("nan"), 10.0), (5.0, float("inf"))):
        with pytest.raises(ValueError):
            class_feed(d_min, d_max)
        with pytest.raises(ValueError):
            class_f80_mm(d_min, d_max)
    with pytest.raises(ValueError):
        evaluate_lab_jaw(JAW, 52.0, JAW.gape_mm, 7.5, SPEED_RPM, AXB)
    r = _eval()
    assert r.reduction_ratio == pytest.approx(61.24 / r.p80_mm, rel=1e-3)           # the analytic F80, not the grid's 59.7
    assert abs(r.reduction_ratio - r.grid_f80_mm / r.p80_mm) > 0.1


def test_adversarial_a_setting_above_the_lower_limit_is_flagged_and_a_supplied_classification_is_reported() -> None:
    flagged = _eval(css=60.0)
    assert flagged.pass_through and flagged.flags and flagged.reduction_ratio > 0
    base = _eval()
    planted = Classification(k1=1.0, k2=2.0, k3=1.0)                               # a classification the preset never gives
    r = _eval(classification=planted)
    assert r.classification == planted and r.classification != base.classification
    assert r.p80_mm != pytest.approx(base.p80_mm, rel=1e-3)


def test_adversarial_the_band_extreme_is_the_value_of_its_corner_and_not_of_the_opposite_one() -> None:
    band = king_band(JAW, 52.0, 63.0, 7.5, SPEED_RPM, AXB)
    assert band.p80.low < band.p80.high and band.p80.low_corner != band.p80.high_corner
    a1, a2, n = band.p80.low_corner
    at_low = _eval(classification=lab_classification(7.5, 10.0, alpha1=a1, alpha2=a2, n=n)).p80_mm
    a1, a2, n = band.p80.high_corner
    at_high = _eval(classification=lab_classification(7.5, 10.0, alpha1=a1, alpha2=a2, n=n)).p80_mm
    assert at_low == pytest.approx(band.p80.low, rel=1e-12) and at_high == pytest.approx(band.p80.high, rel=1e-12)
    assert at_low != pytest.approx(at_high, rel=1e-3)


def test_adversarial_a_planted_conversion_factor_of_the_ore_link_is_visible() -> None:
    v = axb_from_fracture_energy(59.7, 0.025, 58.2)
    assert v == pytest.approx(92.3, abs=0.05)
    assert abs(1000 * 59.7 * 0.025 / 58.2 - v) > 50                               # 1000 in place of 3600 would give 25.6
    assert axb_from_fracture_energy(59.7, 0.05, 58.2) == pytest.approx(2 * v, rel=1e-12)
    assert axb_from_fracture_energy(59.7, 0.025, 29.1) == pytest.approx(2 * v, rel=1e-12)   # inverse in E50
    with pytest.raises(ValueError):
        axb_from_fracture_energy(59.7, 0.025, 0.0)
