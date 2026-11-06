"""The local workflow is configured for ChancaDEM and its readiness provider judges the product (unit B1, template 0.15.000).

`scripts/local/workflow.json` came from the template with the example's namespace, inputs and producer plan; these tests hold
it to the product's real bake (`data-pipeline/run.py all`), its released models as authored inputs of that bake, the catalog's
declared exceptions and the declared provider `scripts/local/readiness_provider.py`, which `scripts/check_readiness.py` calls.
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "scripts/local/workflow.json"
PROVIDER = ROOT / "scripts/local/readiness_provider.py"
EXAMPLE = ("caos-product-" + "template", "template-" + "finalize", "template-" + "validate", "E" + "X0", "CTRL_" + "degenerate",
           "params-" + "record")  # spelled in pieces, so this file holds no example residue itself


def settings() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def provider():
    spec = importlib.util.spec_from_file_location("chancadem_readiness_provider", PROVIDER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def catalog_rows() -> dict[str, str]:
    """id -> documents column of the catalog's contract table."""
    rows, header = {}, None
    for line in (ROOT / "docs/contracts/catalog.md").read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells[:2] == ["id", "version"] and "documents" in cells:
            header = cells
        elif header and len(cells) == len(header) and not set(cells[0]) <= {"-", ":"}:
            rows[cells[0]] = cells[header.index("documents")]
    return rows


def test_the_workflow_names_the_product_and_its_real_bake():
    config = settings()
    raw = CONFIG.read_text(encoding="utf-8")
    assert not [token for token in EXAMPLE if token in raw], "the template example's names remain in workflow.json"
    assert config["environment_namespace"] == "chancadem" and config["external_environments_required"] is True
    assert config["generation"] == [{"script": "data-pipeline/run.py", "args": ["all", "--output", "{derived}"]}]
    assert [row["script"] for row in config["validators"]] == ["scripts/check_artifacts.py", "scripts/check_documents.py"]
    assert config["promote"] == ["data/derived"], "the released models live in data/derived/models; models/ holds none"
    assert config["readiness_provider"] == "scripts/local/readiness_provider.py" and config["product_admission"] is True
    assert config["api"]["active"] is False


def test_the_bake_inputs_are_the_source_tables_and_the_released_models():
    inputs = settings()["stage_inputs"]
    assert {"data/examples/params.csv", "data/examples/hp500-surveys.csv"} <= set(inputs)
    released = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "data/derived/models").iterdir() if p.is_file())
    assert sorted(i for i in inputs if i.startswith("data/derived/models/")) == released
    assert "data/derived/model-metrics.json" in inputs, "run.py all never trains, so the metrics of the models lane are an input"
    assert all((ROOT / name).is_file() for name in inputs)


def test_the_readiness_exceptions_are_the_catalogs():
    config = settings()
    ready = json.loads((ROOT / "data/derived/readiness.json").read_text(encoding="utf-8"))
    not_available = {row["id"]: row["state"] for row in ready["contracts"] if row["state"] != "available"}
    assert config["readiness_exceptions"] == not_available == {"api": "missing"}
    assert config["readiness_excludes"] == ["readiness"] and "readiness" in catalog_rows()


def test_every_shipped_document_of_the_catalog_is_required():
    required = set(settings()["required"])
    assert {"data/derived/manifests/index.json", "data/derived/readiness.json"} <= required
    assert all((ROOT / name).is_file() for name in required)


def test_check_readiness_runs_the_declared_provider_on_the_repository():
    done = subprocess.run([sys.executable, str(ROOT / "scripts/check_readiness.py")], capture_output=True, text=True,
                          cwd=ROOT, check=False)
    assert done.returncode == 0, done.stdout + done.stderr
    assert "readiness: current (declared product provider)" in done.stdout


@pytest.fixture()
def tree(tmp_path: Path) -> Path:
    """A copy of the committed bake, judged by the checkout's provider as a stage would be."""
    root = tmp_path / "stage"
    shutil.copytree(ROOT / "data/derived", root / "data/derived")
    return root


def test_the_provider_accepts_an_exact_copy_of_the_bake(tree):
    provider().validate(tree)


def test_adversarial_the_provider_refuses_a_relabelled_state(tree):
    path = tree / "data/derived/readiness.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    next(row for row in doc["contracts"] if row["id"] == "trace")["state"] = "partial"
    path.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ValueError, match="contracts/trace"):
        provider().validate(tree)


def test_adversarial_the_provider_refuses_a_reserialised_document(tree):
    path = tree / "data/derived/readiness.json"
    path.write_text(json.dumps(json.loads(path.read_text(encoding="utf-8")), indent=2), encoding="utf-8")
    with pytest.raises(ValueError, match="serialisation"):
        provider().validate(tree)


def test_adversarial_the_provider_refuses_a_case_dropped_from_the_index(tree):
    """Fresh readiness cannot hide a missing case: the index is judged against the cases the source tables bake."""
    path = tree / "data/derived/manifests/index.json"
    index = json.loads(path.read_text(encoding="utf-8"))
    dropped = index["cases"].pop()["case_id"]
    path.write_text(json.dumps(index), encoding="utf-8")
    with pytest.raises(ValueError, match=f"case index: .*{dropped}"):
        provider().validate(tree)


def test_adversarial_the_provider_refuses_an_absent_readiness_document(tree):
    (tree / "data/derived/readiness.json").unlink()
    with pytest.raises(ValueError, match="readiness.json is absent"):
        provider().validate(tree)


def test_adversarial_the_provider_runs_without_numpy():
    """CI runs the readiness check without the pipeline's numerical dependencies."""
    code = ("import sys, runpy; sys.modules['numpy'] = None; sys.argv = [sys.argv[1]]; "
            "runpy.run_path(sys.argv[0], run_name='__main__')")
    done = subprocess.run([sys.executable, "-c", code, str(PROVIDER)], capture_output=True, text=True, cwd=ROOT, check=False)
    assert done.returncode == 0, done.stdout + done.stderr
    assert "readiness: current" in done.stdout
