"""The oracles (data-pipeline/pipeline/oracles.py): independent closed-form checks of the product, the notebooks import them.

An oracle shares no code with the engine, so these tests set it against the engine, the baked case and the closed form
itself, and read its source for any import of the engine."""
from __future__ import annotations

import ast
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline import oracles  # noqa: E402
from pipeline.model.crusher import Operating, evaluate, grid_edges  # noqa: E402
from pipeline.model.crusher.feed import make_feed, rosin_rammler_passing  # noqa: E402
from pipeline.model.crusher.sieve import passing_at_size  # noqa: E402


@pytest.mark.parametrize("m", [0.3, 0.9, 1.2, 4.0])
def test_rosin_rammler_passes_one_minus_one_over_e_at_x63(m: float) -> None:
    assert oracles.rosin_rammler_passing(90.0, 90.0, m) == pytest.approx(1 - 1 / math.e, abs=1e-12)
    assert oracles.rosin_rammler_x63_passing() == pytest.approx(0.6321205588285577, abs=1e-15)
    assert rosin_rammler_passing(90.0, 90.0, m) == pytest.approx(1 - 1 / math.e, abs=1e-12)   # the engine agrees


def test_the_engine_feed_on_its_grid_follows_the_law_truncated_at_the_grid() -> None:
    """The engine feed is the Rosin-Rammler law cut to the grid (top 256 mm to the finest edge) and renormalised."""
    edges = grid_edges()
    feed = make_feed(edges, 90.0, 1.2)
    top, bottom = (oracles.rosin_rammler_passing(x, 90.0, 1.2) for x in (edges[0], edges[-1]))
    for edge in (128.0, 64.0, 16.0, 4.0):
        expected = (oracles.rosin_rammler_passing(edge, 90.0, 1.2) - bottom) / (top - bottom)
        assert passing_at_size(feed, edge) == pytest.approx(expected, abs=1e-6)


def test_the_inverse_law_and_the_f80_closed_form() -> None:
    for m in (0.9, 1.2):
        x = oracles.rosin_rammler_size_at(0.8, 90.0, m)
        assert x == pytest.approx(90.0 * math.log(5) ** (1 / m), rel=1e-12)
        assert oracles.rosin_rammler_passing(x, 90.0, m) == pytest.approx(0.8, abs=1e-12)
    with pytest.raises(ValueError):
        oracles.rosin_rammler_size_at(1.0, 90.0, 1.2)


def test_bond_energy_closed_form_and_the_engine_power() -> None:
    # 10 * 14 * (1/sqrt(28000) - 1/sqrt(126000)) kWh/t, worked by hand: 10*14*(0.0059761 - 0.0028172) = 0.4422
    assert oracles.bond_energy_kwh_t(126.0, 28.0, 14.0) == pytest.approx(0.44224, abs=1e-4)
    assert oracles.bond_energy_kwh_t(28.0, 126.0, 14.0) == 0.0 and oracles.bond_energy_kwh_t(0.0, 5.0, 14.0) == 0.0
    r = evaluate(Operating("cone-sec", 32, 30, 360, 90, 1.2, 55, 14))
    assert oracles.bond_power_kw(r.throughput_tph, r.f80, r.p80, 14.0) == pytest.approx(r.power_kw, rel=1e-9)


def test_mass_closure_of_a_baked_product() -> None:
    trace = json.loads((ROOT / "data" / "derived" / "S01" / "trace.json").read_text(encoding="utf-8"))
    assert oracles.mass_closure(trace["feed_mass"], trace["product_mass"]) < 1e-4
    assert oracles.mass_closure([0.5, 0.5], [0.4, 0.5]) == pytest.approx(0.1)


def test_the_oracle_shares_no_code_with_the_engine() -> None:
    tree = ast.parse((ROOT / "data-pipeline" / "pipeline" / "oracles.py").read_text(encoding="utf-8"))
    imported = {n.module or "" for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)} | {
        a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
    assert not any("model" in m or m.startswith("pipeline") for m in imported), imported
