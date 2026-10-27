"""CONTRACT 3 (units gate, conventions/units-gate.md) at run time and CONTRACT 3b (constants declare their unit) at
author time, each with planted defects. The gate is about units, not accuracy: an honest but poor prediction passes."""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

import pytest
from pipeline import pipeline
from pipeline.core import unit_gate

ROOT = Path(__file__).resolve().parents[1]
CHECK_CONSTANTS = ROOT / "scripts" / "check_unit_constants.py"
RANGES = {"throughput_tph": (800.0, 1700.0), "power_kw": (180.0, 360.0), "p80_mm": (0.0, 256.0)}


def verdict(preds: dict[str, float], ranges=RANGES) -> list[dict]:
    return unit_gate.check_units("probe", preds, ranges)


def test_in_range_predictions_pass() -> None:
    assert verdict({"throughput_tph": 1209.0, "power_kw": 400.0, "p80_mm": 32.0}) == []


def test_adversarial_a_non_finite_prediction_fails() -> None:
    for bad in (math.nan, math.inf, -math.inf):
        problems = verdict({"throughput_tph": bad})
        assert [p["violation"] for p in problems] == ["non_finite_prediction"] and problems[0]["blocking"]


def test_adversarial_a_prediction_in_the_wrong_unit_fails() -> None:
    # power in watts, throughput in kg per hour or t per day, a size in metres: each a different quantity or scale
    assert verdict({"power_kw": 300_000.0})[0]["violation"] == "prediction_outside_observable"
    assert verdict({"throughput_tph": 1_200_000.0})[0]["violation"] == "prediction_outside_observable"
    assert verdict({"throughput_tph": 29_000.0})[0]["violation"] == "prediction_outside_observable"
    assert verdict({"p80_mm": 3.2e5})[0]["violation"] == "prediction_outside_observable"


def test_the_gate_is_not_an_accuracy_gate() -> None:
    """Honest but poor: 1.5 times the largest measured power and under three quarters of the smallest measured
    throughput are wrong, in the right units."""
    assert verdict({"power_kw": 540.0, "throughput_tph": 590.0}) == []
    assert verdict({"power_kw": 180.0 - 170.0}) == []                 # 10 kW against 180 to 360 kW
    assert verdict({"throughput_tph": 800.0 - 800.0}) == []           # zero throughput is a finite, in-range answer


def test_a_prediction_exactly_one_range_outside_is_the_edge() -> None:
    lo, hi = RANGES["power_kw"]
    span = hi - lo
    assert verdict({"power_kw": hi + span}) == [] and verdict({"power_kw": hi + span + 1.0}) != []
    assert verdict({"power_kw": lo - span}) == [] and verdict({"power_kw": lo - span - 1.0}) != []


def test_an_observable_without_a_declared_range_is_a_defect() -> None:
    problems = verdict({"viscosity_pas": 1.0})
    assert [p["violation"] for p in problems] == ["no_declared_range"] and problems[0]["blocking"]


def test_the_swap_of_two_quantities_is_not_caught_by_range_alone() -> None:
    """Documented limit: kW and t/h overlap numerically on an HP500 range, so a swap between them passes this gate;
    the cross-case and expected-range checks (tests/test_cases.py) are what refuse it."""
    assert verdict({"throughput_tph": 300.0}) == []


def test_ranges_follow_the_case_kind() -> None:
    measured = [{"survey": i, "f80_mm": 80.0 + i, "css_mm": 45.0, "feed_tph": 800.0 + 100 * i, "power_kw": 200.0 + 10 * i}
                for i in range(1, 11)]
    real = unit_gate.ranges_for("cone-sec", measured)
    assert real["throughput_tph"] == (900.0, 1800.0) and real["power_kw"] == (210.0, 300.0) and real["f80_mm"] == (81.0, 90.0)
    assert real["p80_mm"] == unit_gate.PHYSICAL_DOMAIN["p80_mm"][:2]            # unmeasured: the engine's declared domain
    synthetic = unit_gate.ranges_for("gyratory", None)
    assert synthetic["throughput_tph"][1] > unit_gate.ranges_for("jaw", None)["throughput_tph"][1]
    for name, (lo, hi) in synthetic.items():
        assert lo < hi, name


def test_every_physical_domain_states_its_unit_and_reason() -> None:
    for name, entry in unit_gate.PHYSICAL_DOMAIN.items():
        assert len(entry) == 4 and entry[3].strip() and entry[2].strip(), name


def test_the_bake_runs_the_gate_and_refuses_a_wrong_unit(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from pipeline.model.crusher.types import CrusherResult
    from pipeline.stages import infer

    real = infer.run

    def watts(op):
        r = real(op)
        return CrusherResult(**{**r.__dict__, "power_kw": r.power_kw * 1000.0})

    monkeypatch.setattr(infer, "run", watts)
    with pytest.raises(unit_gate.UnitGateError, match="power_kw"):
        pipeline.precompute("S01", output_root=tmp_path / "bad")


def run_constants(*args: str, root: Path = ROOT) -> subprocess.CompletedProcess:
    """Run the script of ``root`` (the gate resolves its tree from its own location)."""
    script = root / "scripts" / "check_unit_constants.py"
    return subprocess.run([sys.executable, str(script), *args], capture_output=True, text=True, cwd=root, check=False)


def test_constants_gate_passes_on_the_repository() -> None:
    p = run_constants()
    assert p.returncode == 0, p.stdout + p.stderr


def test_adversarial_a_constant_without_its_unit_fails(tmp_path: Path) -> None:
    """Plant a module with a float literal in a copy of the tree: the gate names it; declaring the unit passes."""
    repo = tmp_path / "repo"
    (repo / "scripts").mkdir(parents=True)
    (repo / "scripts" / "check_unit_constants.py").write_bytes(CHECK_CONSTANTS.read_bytes())
    mod = repo / "data-pipeline" / "pipeline" / "model" / "crusher"
    mod.mkdir(parents=True)
    (mod / "planted.py").write_text("LIMIT = 137.5\n\ndef f(x):\n    return min(x, LIMIT)\n", encoding="utf-8")
    (repo / "scripts" / ".unit_constants_allow.json").write_text("{}", encoding="utf-8")
    p = run_constants(root=repo)
    assert p.returncode == 1 and "planted.py" in p.stdout and "137.5" in p.stdout
    key = "data-pipeline/pipeline/model/crusher/planted.py::137.5"
    (repo / "scripts" / ".unit_constants_allow.json").write_text(
        json.dumps({key: {"reason": "TODO: state what unit this number assumes", "source": "x"}}), encoding="utf-8")
    assert run_constants(root=repo).returncode == 1                       # baselined but not justified
    (repo / "scripts" / ".unit_constants_allow.json").write_text(
        json.dumps({key: {"reason": "IN MILLIMETRES: a size limit of the planted module.", "source": "x"}}), encoding="utf-8")
    assert run_constants(root=repo).returncode == 0
