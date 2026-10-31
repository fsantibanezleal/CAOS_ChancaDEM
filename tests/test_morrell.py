"""Morrell's size-specific crusher energy (GMSG guideline Annex B, B.2.2, equations B4 and B5): the equations as the
guideline prints them, their units and the rule on S_c, then the HP500 fit (M_ic and the no-load term per fold)."""
from __future__ import annotations

import math

import numpy as np
import pytest

from pipeline.hp500 import morrell_fit
from pipeline.model.crusher import morrell


def _by_hand(x1: float, x2: float, mic: float, k2: float = 1.0) -> float:
    f = lambda x: -(0.295 + x / 1_000_000)   # noqa: E731
    s = 55 * (x1 * x2) ** -0.2
    s = 1.0 if s > 1 else s
    return s * k2 * mic * 4 * (x2 ** f(x2) - x1 ** f(x1))


def test_the_equation_b4_as_printed() -> None:
    assert morrell.crusher_specific_energy_kwh_t(100_000, 30_000, 4.0) == pytest.approx(_by_hand(100_000, 30_000, 4.0))
    assert morrell.crusher_specific_energy_kwh_t(100_000, 30_000, 4.0, closed_circuit=False) == pytest.approx(
        _by_hand(100_000, 30_000, 4.0, k2=1.19))


def test_units_give_kwh_per_tonne_and_kw() -> None:
    """The size term is dimensionless, so W_c has the unit of M_ic (kWh/t) and linear in it; times t/h it is kW."""
    one = morrell.crusher_specific_energy_kwh_t(100_000, 30_000, 1.0)
    assert morrell.crusher_specific_energy_kwh_t(100_000, 30_000, 5.0) == pytest.approx(5.0 * one)
    assert 0.0 < morrell.crusher_specific_energy_kwh_t(100_000, 30_000, 4.0) < 5.0     # a crusher draws tenths of a kWh/t
    kw = morrell.crusher_power_kw(100_000, 30_000, 4.0, 1000.0, no_load_kw=50.0)
    assert kw == pytest.approx(morrell.crusher_specific_energy_kwh_t(100_000, 30_000, 4.0) * 1000.0 + 50.0)


def test_sc_is_applied_below_one_and_dropped_above_one() -> None:
    sc = 55 * (100_000 * 30_000) ** -0.2
    assert sc < 1.0 and morrell.hardness_parameter(100_000, 30_000) == pytest.approx(sc)
    assert morrell.hardness_parameter(100, 100) == 1.0      # 55 (1e4)^-0.2 = 8.7 > 1: not applied
    assert morrell.hardness_parameter(100_000, 30_000) < morrell.hardness_parameter(1_000, 300)


def test_adversarial_a_non_positive_size_is_refused() -> None:
    for x1, x2 in ((0, 10), (10, 0), (-5, 10)):
        with pytest.raises(ValueError):
            morrell.size_term(x1, x2)
        with pytest.raises(ValueError):
            morrell.hardness_parameter(x1, x2)


def test_the_size_term_is_positive_when_the_product_is_finer_and_zero_at_no_reduction() -> None:
    assert morrell.size_term(100_000, 30_000) > 0
    assert morrell.size_term(50_000, 50_000) == pytest.approx(0.0)


def test_the_fits_recover_a_planted_m_ic_and_no_load() -> None:
    g = np.array([40.0, 55.0, 70.0, 90.0, 120.0, 150.0])
    kw = 3.7 * g + 25.0
    idx = np.arange(g.size)
    assert morrell_fit.fit_through_origin(g, 3.7 * g, idx) == pytest.approx(3.7)
    m, p = morrell_fit.fit_with_no_load(g, kw, idx)
    assert (m, p) == (pytest.approx(3.7), pytest.approx(25.0))


def test_the_design_column_is_the_equation_times_the_throughput() -> None:
    g = morrell_fit.design_column(np.array([88.0]), np.array([30.0]), np.array([1000.0]))
    assert g[0] == pytest.approx(_by_hand(88_000, 30_000, 1.0) * 1000.0)
    assert math.isfinite(g[0]) and g[0] > 0
