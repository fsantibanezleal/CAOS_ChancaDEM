"""Expected ranges (core/expect.py): a baked value outside its case's range fails the bake, with its name."""
import pytest
from pipeline import registry
from pipeline.core.expect import METRICS, ExpectationError, check
from pipeline.hp500.surveys import read_surveys
from pipeline.stages import infer
from pipeline.core.trace import metrics_of

VALUES = {"p80_mm": 28.0, "p50_mm": 12.0, "p20_mm": 4.0, "f80_mm": 126.0, "reduction_ratio": 4.5, "throughput_tph": 640.0,
          "power_kw": 290.0, "specific_energy_kwh_t": 1.0}


def test_every_registered_case_meets_its_declared_range() -> None:
    for case in registry.list_cases(read_surveys().accepted):
        ranges = check(case.id, case.expect, metrics_of(infer.run(case.op)))
        assert ranges, case.id


def test_the_ranges_are_returned_as_written_to_the_manifest() -> None:
    assert check("X", {"p80_mm": (20, 35), "power_kw": (200.0, 400.0)}, VALUES) == {"p80_mm": [20.0, 35.0], "power_kw": [200.0, 400.0]}


def test_a_value_outside_its_range_is_named() -> None:
    with pytest.raises(ExpectationError, match=r"p80_mm=28 outside \[30, 35\]"):
        check("X", {"p80_mm": (30, 35)}, VALUES)


def test_every_metric_out_of_range_is_named_in_one_error() -> None:
    with pytest.raises(ExpectationError) as e:
        check("X", {"p80_mm": (30, 35), "throughput_tph": (1, 2)}, VALUES)
    assert "p80_mm" in str(e.value) and "throughput_tph" in str(e.value)


def test_adversarial_a_case_without_expectations_or_with_an_unknown_metric_fails() -> None:
    with pytest.raises(ExpectationError, match="no expected range"):
        check("X", {}, VALUES)
    with pytest.raises(ExpectationError, match="unknown expected metric 'peak'"):
        check("X", {"peak": (0.0, 1.0)}, VALUES)
    with pytest.raises(ExpectationError, match="empty range"):
        check("X", {"p80_mm": (35, 30)}, VALUES)
    assert set(VALUES) == set(METRICS)
