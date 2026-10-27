"""Catalog row readiness 1.0.0 (producer side): data-pipeline/pipeline/core/readiness.py computes every row's declared
state from docs/contracts/catalog.md and the repository. One test per state of the catalog's Missing-data table, each
reached through the real ``compute`` on a temporary copy of the repository inputs; each document is checked against the
schema and each reason against the catalog's own table (parsed here, never copied)."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from pipeline import pipeline
from pipeline.core import readiness
from pipeline.io.formats import write_json

from contract_schemas import ROOT, errors

CATALOG = ROOT / "docs" / "contracts" / "catalog.md"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
OLDER = VERSION.rsplit(".", 1)[0] + ".001"  # an engine version that is not VERSION
NO_NUMPY = ("import sys, runpy; sys.modules['numpy'] = None; path = sys.argv[1]; sys.argv = sys.argv[1:]; "
            "runpy.run_path(path, run_name='__main__')")
DERIVED_DOCS = ("hp500/backbone.json", "hp500/loo.json", "model-metrics.json")


def _table(section: str) -> list[list[str]]:
    text = CATALOG.read_text(encoding="utf-8").replace("\r\n", "\n")
    body = text.split(f"## {section}\n", 1)[1].split("\n## ", 1)[0]
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in body.splitlines() if ln.startswith("|")]
    return rows[2:]  # the header and the separator


def template(condition: str) -> tuple[str, str]:
    """The English and Spanish reason of the Missing-data row whose condition contains ``condition``."""
    for cells in _table("Missing-data states"):
        if len(cells) == 6 and condition in cells[1]:
            return cells[4], cells[5]
    raise AssertionError(f"no Missing-data row mentions {condition!r}")


def fill(tpl: tuple[str, str], **vals: object) -> dict:
    out = {}
    for lang, text in zip(("en", "es"), tpl):
        for k, v in vals.items():
            text = text.replace("{" + k + "}", str(v))
        out[lang] = text
    return out


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    """A temporary repository: the catalog, VERSION, the two source tables and the committed bake with the documents of
    older engine versions re-labelled with the current one."""
    r = tmp_path / "repo"
    (r / "docs" / "contracts").mkdir(parents=True)
    shutil.copy(CATALOG, r / "docs" / "contracts" / "catalog.md")
    shutil.copy(ROOT / "VERSION", r / "VERSION")
    (r / "data").mkdir()
    shutil.copytree(ROOT / "data" / "examples", r / "data" / "examples")
    shutil.copytree(ROOT / "data" / "derived", r / "data" / "derived", ignore=shutil.ignore_patterns("readiness.json"))
    for rel in DERIVED_DOCS:
        path = r / "data" / "derived" / rel
        doc = json.loads(path.read_text(encoding="utf-8"))
        doc["engine_version"] = VERSION
        write_json(path, doc)
    return r


def run(r: Path) -> dict:
    doc = readiness.compute(repo_root=r, derived_root=r / "data" / "derived", models_dir=r / "data" / "derived" / "models")
    assert errors("readiness", doc) == []
    return doc


def entry(doc: dict, row: str) -> dict:
    return next(e for e in doc["contracts"] if e["id"] == row)


def derived(r: Path, rel: str) -> Path:
    return r / "data" / "derived" / rel


def test_committed_readiness_is_current(tmp_path):
    doc = readiness.compute(repo_root=ROOT, derived_root=ROOT / "data" / "derived", models_dir=ROOT / "data" / "derived" / "models")
    out = tmp_path / "derived"
    readiness.write(out, doc)
    assert (out / "readiness.json").read_bytes() == (ROOT / "data" / "derived" / "readiness.json").read_bytes()


def test_catalog_rows_in_order_without_readiness():
    rows = readiness.parse_catalog(CATALOG.read_text(encoding="utf-8"))
    assert [r["id"] for r in rows] == ["params-record", "hp500-survey", "case-index", "case-manifest", "trace", "hp500-backbone",
                                        "hp500-loo", "surrogate-model", "anomaly-model", "model-metrics", "readiness", "api"]
    assert {"id", "version", "status", "provider"} <= set(rows[0])
    doc = readiness.compute(repo_root=ROOT, derived_root=ROOT / "data" / "derived", models_dir=ROOT / "data" / "derived" / "models")
    assert [e["id"] for e in doc["contracts"]] == [r["id"] for r in rows if r["id"] != "readiness"]
    assert doc["product_version"] == VERSION


def test_state_available(repo):
    doc = run(repo)
    for e in doc["contracts"]:
        if e["id"] != "api":
            assert (e["state"], e["provenance"], e["reason"], e["missing"]) == ("available", "real", None, []), e["id"]
    assert entry(doc, "api")["state"] == "missing"
    assert entry(doc, "api")["provenance"] is None
    assert entry(doc, "api")["reason"] == fill(template("always, in the static document"))


def test_adversarial_state_partial_manifests(repo):
    derived(repo, "manifests/S02.json").unlink()
    doc = run(repo)
    e = entry(doc, "case-manifest")
    assert (e["state"], e["provenance"]) == ("partial", "real")
    assert e["reason"] == fill(template("a manifest the index lists is absent"), n=1, total=27)
    assert e["missing"] == ["manifests/S02.json"]
    assert entry(doc, "trace")["state"] == "available"  # the absent manifest names no artifact to count


def test_state_partial_traces(repo):
    derived(repo, "S02/trace.json").unlink()
    derived(repo, "S03/trace.json").unlink()
    doc = run(repo)
    e = entry(doc, "trace")
    assert (e["state"], e["provenance"]) == ("partial", "real")
    assert e["reason"] == fill(template("an artifact a present manifest names is absent"), n=2, total=27)
    assert e["missing"] == ["S02/trace.json", "S03/trace.json"]
    assert entry(doc, "case-manifest")["state"] == "available"


def test_state_partial_params(repo):
    path = repo / "data" / "examples" / "params.csv"
    path.write_text(path.read_text(encoding="utf-8") + "ZZBAD,cone-sec,-1,30,360,90,1.2,55,14\nAABAD,hammer,30,30,360,90,1.2,55,14\n",
                    encoding="utf-8")
    e = entry(run(repo), "params-record")
    assert (e["state"], e["provenance"]) == ("partial", "real")
    assert e["reason"] == fill(template("contract 1 rejects some rows"), n=2, total=19)
    assert e["missing"] == ["AABAD", "ZZBAD"]


def test_state_partial_surveys(repo):
    path = repo / "data" / "examples" / "hp500-surveys.csv"
    lines = path.read_text(encoding="utf-8").splitlines()
    lines[2], lines[10] = "2,0,54,1267,212", "10,81,55,abc,187"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    e = entry(run(repo), "hp500-survey")
    assert (e["state"], e["provenance"]) == ("partial", "real")
    assert e["reason"] == fill(template("the survey contract rejects some rows"), n=2, total=10)
    assert e["missing"] == ["10", "2"] or e["missing"] == ["2", "10"]
    assert e["missing"] == sorted(e["missing"])


def test_adversarial_state_stale(repo):
    idx = derived(repo, "manifests/index.json")
    doc = json.loads(idx.read_text(encoding="utf-8"))
    doc["engine_version"] = OLDER
    write_json(idx, doc)
    out = run(repo)
    for row in ("case-index", "case-manifest", "trace"):
        e = entry(out, row)
        assert (e["state"], e["provenance"]) == ("stale", "real"), row
        assert e["reason"] == fill(template("differs from `VERSION`"), engine_version=OLDER, version=VERSION)
        assert e["missing"] == []


@pytest.mark.parametrize("row,rel", [("hp500-backbone", "hp500/backbone.json"), ("hp500-loo", "hp500/loo.json"),
                                     ("model-metrics", "model-metrics.json")])
def test_adversarial_state_stale_documents(repo, row, rel):
    path = derived(repo, rel)
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["engine_version"] = OLDER
    write_json(path, doc)
    e = entry(run(repo), row)
    assert (e["state"], e["provenance"]) == ("stale", "real")
    assert e["reason"] == fill(template("the document's `engine_version` differs"), engine_version=OLDER, version=VERSION)


def test_first_matching_rule_wins(repo):
    """A bake that is both partial and stale reports partial (the order of the catalog's table)."""
    idx = derived(repo, "manifests/index.json")
    doc = json.loads(idx.read_text(encoding="utf-8"))
    doc["engine_version"] = OLDER
    write_json(idx, doc)
    derived(repo, "manifests/S01.json").unlink()
    out = run(repo)
    assert entry(out, "case-manifest")["state"] == "partial"
    assert entry(out, "case-index")["state"] == "stale"


def test_adversarial_state_provider_through_a_catalog_copy(repo):
    cat = repo / "docs" / "contracts" / "catalog.md"
    text = cat.read_text(encoding="utf-8")
    row = next(ln for ln in text.splitlines() if ln.startswith("| case-index |"))
    cells = row.split("|")
    cells[-2] = " active "
    cat.write_text(text.replace(row, "|".join(cells)), encoding="utf-8")
    doc = run(repo)
    e = entry(doc, "case-index")
    provider = "fixture:docs/contracts/fixtures/data/derived/manifests/index.json"
    assert (e["state"], e["status"], e["provenance"]) == ("provider", "active", "fixture")
    assert e["reason"] == fill(template("the catalog `status` is `active`"), provider=provider)
    assert entry(doc, "case-manifest")["state"] == "available"
    ref = readiness.compute(repo_root=ROOT, derived_root=ROOT / "data" / "derived", models_dir=ROOT / "data" / "derived" / "models")
    assert doc["catalog_sha256"] != ref["catalog_sha256"]


def test_state_training_without_a_bundle(repo):
    derived(repo, "models/surrogate.json").unlink()
    doc = run(repo)
    e = entry(doc, "surrogate-model")
    assert (e["state"], e["provenance"]) == ("training", "baseline")
    assert e["reason"] == fill(template("`data/derived/models/surrogate.json` or a graph it names"))
    assert entry(doc, "anomaly-model")["state"] == "available"


def test_adversarial_state_training_with_a_tampered_graph(repo):
    graph = derived(repo, "models/psd-ae.onnx")
    graph.write_bytes(graph.read_bytes() + b"\x00")
    doc = run(repo)
    e = entry(doc, "anomaly-model")
    assert (e["state"], e["provenance"]) == ("training", "baseline")
    assert e["reason"] == fill(template("`data/derived/models/psd-ae.json` or its graph"))
    assert entry(doc, "surrogate-model")["state"] == "available"


def test_adversarial_state_training_with_an_invalid_bundle(repo):
    bundle = derived(repo, "models/surrogate.json")
    bundle.write_text("not json", encoding="utf-8")
    assert entry(run(repo), "surrogate-model")["provenance"] == "baseline"
    bundle.write_text('{"schema":"chancadem.surrogate/v1"}', encoding="utf-8")
    assert entry(run(repo), "surrogate-model")["state"] == "training"


def test_adversarial_state_missing_without_an_index(repo):
    derived(repo, "manifests/index.json").unlink()
    doc = run(repo)
    for row in ("case-index", "case-manifest", "trace"):
        e = entry(doc, row)
        assert (e["state"], e["provenance"], e["missing"]) == ("missing", None, []), row
        assert e["reason"] == fill(template("`data/derived/manifests/index.json` is absent")), row


def test_state_missing_without_a_params_table(repo):
    (repo / "data" / "examples" / "params.csv").unlink()
    e = entry(run(repo), "params-record")
    assert (e["state"], e["provenance"]) == ("missing", None)
    assert e["reason"] == fill(template("`data/examples/params.csv` is absent"))


def test_state_missing_without_a_survey_table(repo):
    (repo / "data" / "examples" / "hp500-surveys.csv").unlink()
    e = entry(run(repo), "hp500-survey")
    assert (e["state"], e["provenance"]) == ("missing", None)
    assert e["reason"] == fill(template("`data/examples/hp500-surveys.csv` is absent"))


def test_state_missing_hp500_documents(repo):
    derived(repo, "hp500/backbone.json").unlink()
    derived(repo, "hp500/loo.json").unlink()
    doc = run(repo)
    for row in ("hp500-backbone", "hp500-loo"):
        e = entry(doc, row)
        assert (e["state"], e["provenance"], e["missing"]) == ("missing", None, []), row
        assert e["reason"] == fill(template("the document is absent"))      # the first row with that condition: the HP500 one


def test_state_missing_model_metrics(repo):
    derived(repo, "model-metrics.json").unlink()
    e = entry(run(repo), "model-metrics")
    assert (e["state"], e["provenance"]) == ("missing", None)
    assert e["reason"] == ({"en": "The models were not evaluated in this build.", "es": "Los modelos no se evaluaron en esta versión."})


def test_every_reason_of_the_code_is_a_reason_of_the_catalog():
    """Each template of core/readiness.py is one of the (en, es) pairs of the catalog's Missing-data table."""
    pairs = {(c[4], c[5]) for c in _table("Missing-data states") if len(c) == 6 and c[4] != "null"}
    ours = {v for k, v in vars(readiness).items() if k.startswith("T_") and isinstance(v, tuple)}
    assert ours <= pairs, ours - pairs
    assert pairs <= ours, pairs - ours


def set_status(r: Path, row_id: str, status: str) -> None:
    """Rewrite the status cell of catalog row ``row_id`` in the repository copy ``r``."""
    cat = r / "docs" / "contracts" / "catalog.md"
    text = cat.read_text(encoding="utf-8")
    row = next(ln for ln in text.splitlines() if ln.startswith(f"| {row_id} |"))
    cells = row.split("|")
    cells[-2] = f" {status} "
    cat.write_text(text.replace(row, "|".join(cells)), encoding="utf-8")


@pytest.mark.parametrize("bad", ["stub", "live", "Active", "REAL", "real extra", "baseline", ""])
def test_a_status_other_than_real_or_active_fails(repo, bad):
    set_status(repo, "case-index", bad)
    with pytest.raises(ValueError) as exc:
        readiness.compute(repo_root=repo, derived_root=derived(repo, ""), models_dir=derived(repo, "models"))
    assert "case-index" in str(exc.value) and "real" in str(exc.value) and "active" in str(exc.value)


def test_table_padding_is_formatting_not_a_status(repo):
    set_status(repo, "case-index", "   real   ")
    assert entry(run(repo), "case-index")["state"] == "available"


def test_adversarial_check_readiness_reports_an_unknown_status(repo):
    set_status(repo, "case-index", "stub")
    p = _check(repo)
    assert p.returncode == 1, p.stdout + p.stderr
    assert "case-index" in p.stdout and "real" in p.stdout and "active" in p.stdout
    assert "Traceback" not in p.stdout + p.stderr


def test_unknown_row_gets_only_the_generic_rules(repo):
    cat = repo / "docs" / "contracts" / "catalog.md"
    text = cat.read_text(encoding="utf-8")
    row = next(ln for ln in text.splitlines() if ln.startswith("| params-record |"))
    own = row.replace("| params-record |", "| my-own-row |", 1)
    cat.write_text(text.replace(row, row + "\n" + own), encoding="utf-8")
    assert entry(run(repo), "my-own-row")["state"] == "available"
    own_active = own.split("|")
    own_active[-2] = " active "
    cat.write_text(text.replace(row, row + "\n" + "|".join(own_active)), encoding="utf-8")
    assert entry(run(repo), "my-own-row")["state"] == "provider"


def test_determinism_and_normalised_hash(repo):
    a, b = run(repo), run(repo)
    assert a == b
    cat = repo / "docs" / "contracts" / "catalog.md"
    cat.write_bytes(cat.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
    assert run(repo)["catalog_sha256"] == a["catalog_sha256"]


def test_run_all_writes_a_valid_readiness(tmp_path):
    out = tmp_path / "bake"
    shutil.copytree(ROOT / "data" / "derived" / "models", out / "models")
    pipeline.run_all(seed=42, output_root=out)
    doc = json.loads((out / "readiness.json").read_text(encoding="utf-8"))
    assert errors("readiness", doc) == []
    for row in ("params-record", "hp500-survey", "case-index", "case-manifest", "trace", "hp500-backbone", "hp500-loo",
                "surrogate-model", "anomaly-model"):
        assert entry(doc, row)["state"] == "available", row
    assert entry(doc, "model-metrics")["state"] == "missing"       # run.py models writes it; the bake never trains


def _check(root: Path | None = None, *, no_numpy: bool = False) -> subprocess.CompletedProcess:
    script = str(ROOT / "scripts" / "check_readiness.py")
    args = [str(root)] if root else []
    cmd = [sys.executable, "-c", NO_NUMPY, script, *args] if no_numpy else [sys.executable, script, *args]
    return subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)


def test_check_readiness_passes_on_the_repository():
    p = _check()
    assert p.returncode == 0, p.stdout + p.stderr
    assert "readiness: current" in p.stdout


def test_adversarial_check_readiness_without_numpy_fails_loudly_and_says_why():
    p = _check(no_numpy=True)
    assert p.returncode == 1, p.stdout + p.stderr
    assert "numpy" in p.stdout and "Traceback" not in p.stdout + p.stderr


def test_adversarial_check_readiness_fails_on_a_changed_catalog(tmp_path):
    r = tmp_path / "repo"
    shutil.copytree(ROOT / "data", r / "data")
    (r / "docs" / "contracts").mkdir(parents=True)
    shutil.copy(ROOT / "VERSION", r / "VERSION")
    cat = CATALOG.read_text(encoding="utf-8")
    (r / "docs" / "contracts" / "catalog.md").write_text(cat.replace("One row per", "One Row per", 1), encoding="utf-8")
    p = _check(r)
    assert p.returncode == 1, p.stdout + p.stderr
    assert "catalog_sha256" in p.stdout
    assert "python data-pipeline/run.py readiness" in p.stdout
