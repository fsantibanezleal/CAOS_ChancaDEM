"""Pipeline smoke and determinism: a bake regenerates byte for byte, the controls run without crashing, the missing-data
states of the two source tables bake what they can, and the commands write only where they are told."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import pytest
from pipeline import pipeline, registry

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"


def tree(root: Path) -> dict[str, str]:
    """Every file under ``root`` (relative path) with its sha256."""
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob("*")) if p.is_file() and p.name != ".gitkeep"}


def with_models(root: Path) -> Path:
    shutil.copytree(DERIVED / "models", root / "models")
    shutil.copyfile(DERIVED / "model-metrics.json", root / "model-metrics.json")   # the precompute lane's outputs, as released
    return root


@pytest.fixture(scope="module")
def two_bakes(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    base = tmp_path_factory.mktemp("determinism")
    a, b = with_models(base / "a"), with_models(base / "b")
    pipeline.run_all(output_root=a)
    pipeline.run_all(output_root=b)
    return a, b


def test_adversarial_same_seed_bakes_identical_bytes_and_a_changed_byte_of_equal_size_is_seen(two_bakes) -> None:
    a, b = two_bakes
    ta, tb = tree(a), tree(b)
    assert ta == tb and len(ta) > 27 * 2          # not equal because both are empty
    assert "manifests/index.json" in ta and "readiness.json" in ta and "hp500/loo.json" in ta


def test_a_changed_byte_of_equal_size_is_seen(two_bakes) -> None:
    """The control of the comparison above: a copy of a trace with one digit changed has the size of the original and must
    be told apart from it."""
    a, _ = two_bakes
    first = a / "S01" / "trace.json"
    raw = bytearray(first.read_bytes())
    at = next(i for i in range(len(raw) - 1, -1, -1) if chr(raw[i]).isdigit())
    raw[at] = ord("0") if raw[at] != ord("0") else ord("1")
    assert len(raw) == first.stat().st_size and bytes(raw) != first.read_bytes()
    assert hashlib.sha256(bytes(raw)).hexdigest() != hashlib.sha256(first.read_bytes()).hexdigest()


def test_the_committed_bake_is_what_the_code_regenerates(two_bakes) -> None:
    """data/derived is the product of the code on the committed inputs: nothing was edited by hand."""
    a, _ = two_bakes
    committed, fresh = tree(DERIVED), tree(a)
    assert fresh == committed, sorted(k for k in committed.keys() | fresh.keys() if committed.get(k) != fresh.get(k))


def test_a_different_seed_is_a_different_bake_record(tmp_path: Path) -> None:
    a = pipeline.precompute("S01", seed=7, output_root=tmp_path / "a")
    b = pipeline.precompute("S01", seed=8, output_root=tmp_path / "b")
    assert a["seed"] == 7 and b["seed"] == 8


def test_the_controls_run_and_the_negative_one_does_not_reduce(tmp_path: Path) -> None:
    out = tmp_path / "derived"
    for cid in ("CP1", "CI1"):
        m = pipeline.precompute(cid, output_root=out)
        trace = json.loads((out / m["artifact"]["path"]).read_text(encoding="utf-8"))
        assert trace["summary"]["reduction_ratio"] < 1.3, cid
    assert trace["summary"]["valid"] is False


def test_run_all_writes_the_27_cases_the_index_and_the_hp500_documents(tmp_path: Path) -> None:
    out = tmp_path / "derived"
    entries = pipeline.run_all(output_root=out)
    assert len(entries) == 27 == len(registry.list_cases(pipeline.load_inputs(pipeline.PipelinePaths.from_output(out)).surveys))
    idx = json.loads((out / "manifests" / "index.json").read_text(encoding="utf-8"))
    assert idx["n_cases"] == 27 and idx["schema"] == "chancadem.index/v1" and idx["default_case"] == "S01"
    assert [c["case_id"] for c in idx["cases"]] == sorted(c["case_id"] for c in idx["cases"])
    assert idx["files"] == ["hp500/backbone.json", "hp500/loo.json", "hp500/crusherbayes.json"]   # no models in a bare sandbox
    assert all((out / f).is_file() for f in idx["files"])


def test_the_index_lists_the_models_and_the_metrics_when_present(tmp_path: Path) -> None:
    out = with_models(tmp_path / "derived")
    pipeline.run_all(output_root=out)
    idx = json.loads((out / "manifests" / "index.json").read_text(encoding="utf-8"))
    assert idx["files"] == [*pipeline.MODEL_FILES, *pipeline.HP500_FILES, "model-metrics.json"]


def planted_params(tmp_path: Path, extra: str = "", drop: str | None = None) -> Path:
    lines = (ROOT / "data" / "examples" / "params.csv").read_text(encoding="utf-8").splitlines()
    kept = [ln for ln in lines if drop is None or not ln.startswith(drop + ",")]
    path = tmp_path / "params.csv"
    path.write_text("\n".join(kept) + "\n" + extra, encoding="utf-8")
    return path


def test_a_rejected_params_row_is_dropped_and_the_rest_is_baked(tmp_path: Path) -> None:
    params = planted_params(tmp_path, drop="S02", extra="S02,cone-sec,-3,32,300,120,1,80,11\n")
    out = tmp_path / "bake"
    entries = pipeline.run_all(output_root=out, params_csv=params)
    ids = [e["case_id"] for e in entries]
    assert "S02" not in ids and len(ids) == 26 and not (out / "S02").exists()
    ready = json.loads((out / "readiness.json").read_text(encoding="utf-8"))
    row = next(e for e in ready["contracts"] if e["id"] == "params-record")
    assert row["state"] == "partial" and row["missing"] == ["S02"]


def test_a_missing_params_table_bakes_the_registry_cases(tmp_path: Path) -> None:
    out = tmp_path / "bake"
    entries = pipeline.run_all(output_root=out, params_csv=tmp_path / "absent.csv")
    assert len(entries) == 27
    ready = json.loads((out / "readiness.json").read_text(encoding="utf-8"))
    assert next(e for e in ready["contracts"] if e["id"] == "params-record")["state"] == "missing"


def test_a_params_table_point_replaces_the_registry_point(tmp_path: Path) -> None:
    text = (ROOT / "data" / "examples" / "params.csv").read_text(encoding="utf-8").replace("S01,cone-sec,32,", "S01,cone-sec,34,")
    path = tmp_path / "params.csv"
    path.write_text(text, encoding="utf-8")
    m = pipeline.precompute("S01", output_root=tmp_path / "b", params_csv=path)
    assert m["params"]["css_mm"] == 34.0


def test_a_missing_survey_table_bakes_no_real_case_and_no_hp500_document(tmp_path: Path) -> None:
    out = tmp_path / "bake"
    entries = pipeline.run_all(output_root=out, surveys_csv=tmp_path / "absent.csv")
    assert len(entries) == 17 and not (out / "hp500").exists()
    idx = json.loads((out / "manifests" / "index.json").read_text(encoding="utf-8"))
    assert idx["files"] == []
    ready = json.loads((out / "readiness.json").read_text(encoding="utf-8"))
    states = {e["id"]: e["state"] for e in ready["contracts"]}
    assert states["hp500-survey"] == states["hp500-backbone"] == states["hp500-loo"] == states["hp500-crusherbayes"] == "missing"


def test_a_rejected_survey_drops_its_case_and_readiness_lists_its_number(tmp_path: Path) -> None:
    lines = (ROOT / "data" / "examples" / "hp500-surveys.csv").read_text(encoding="utf-8").splitlines()
    lines[3] = "3,-47,48,1240,262"        # survey 3: a negative f80
    path = tmp_path / "surveys.csv"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    out = tmp_path / "bake"
    entries = pipeline.run_all(output_root=out, surveys_csv=path)
    ids = [e["case_id"] for e in entries]
    assert "HP500-03" not in ids and len([i for i in ids if i.startswith("HP500")]) == 9
    ready = json.loads((out / "readiness.json").read_text(encoding="utf-8"))
    row = next(e for e in ready["contracts"] if e["id"] == "hp500-survey")
    assert row["state"] == "partial" and row["missing"] == ["3"]


def test_the_tests_never_write_the_committed_tree() -> None:
    """The autouse sandbox points the canonical roots into a temporary directory."""
    assert pipeline.DERIVED != DERIVED and pipeline.MODELS == pipeline.DERIVED / "models"
    pipeline.precompute("S01")
    assert (pipeline.DERIVED / "S01" / "trace.json").is_file()


def test_the_cli_commands(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    out = tmp_path / "cli"
    for argv in (["all"], ["S03"], ["readiness"], ["hp500"]):
        monkeypatch.setattr("sys.argv", ["run.py", *argv, "--output", str(out)])
        pipeline.main()
    text = capsys.readouterr().out
    assert "precomputed 27 cases" in text and "precomputed S03" in text and "readiness ->" in text and "hp500:" in text
    assert (out / "readiness.json").is_file() and (out / "hp500" / "loo.json").is_file()
    monkeypatch.setattr("sys.argv", ["run.py", "--output", str(tmp_path / "default")])
    pipeline.main()                                                                     # no command is all
    assert (tmp_path / "default" / "manifests" / "index.json").is_file()


def test_the_fixtures_command_writes_the_provider_tree_into_a_sandbox(tmp_path: Path) -> None:
    out = pipeline.write_fixtures(tmp_path / "fx")
    idx = json.loads((out / "derived" / "manifests" / "index.json").read_text(encoding="utf-8"))
    assert [c["case_id"] for c in idx["cases"]] == ["FX01", "FX02"] and idx["default_case"] == "FX01"
    ready = json.loads((out / "derived" / "readiness.json").read_text(encoding="utf-8"))
    states = {e["id"]: e["state"] for e in ready["contracts"]}
    assert states.pop("api") == "missing" and set(states.values()) == {"provider"}
    assert (out / "examples" / "params.csv").is_file() and (out / "examples" / "hp500-surveys.csv").is_file()
