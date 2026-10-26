"""A declared-partial bake builds (catalog: Missing-data states, partial): scripts/check_artifacts.py accepts an absent
manifest or artifact only when the readiness lists it in the ``missing`` of a ``partial`` row, and still stops on any
other absence. frontend/src/lib/declared.test.ts holds the same rule for the build's copy-data step."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from pipeline.core import readiness

from contract_schemas import ROOT

SCRIPT = ROOT / "scripts" / "check_artifacts.py"


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    """A repository copy (catalog, VERSION, the bake, the models) whose readiness is recomputed on demand."""
    r = tmp_path / "repo"
    (r / "docs" / "contracts").mkdir(parents=True)
    shutil.copy(ROOT / "docs" / "contracts" / "catalog.md", r / "docs" / "contracts" / "catalog.md")
    shutil.copy(ROOT / "VERSION", r / "VERSION")
    shutil.copytree(ROOT / "data", r / "data")
    shutil.copytree(ROOT / "models", r / "models")
    return r


def recompute(r: Path) -> dict:
    doc = readiness.compute(repo_root=r, derived_root=r / "data" / "derived", models_dir=r / "models")
    readiness.write(r / "data" / "derived", doc)
    return doc


def check(r: Path) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), str(r)], capture_output=True, text=True, cwd=ROOT)


def test_a_complete_bake_passes(repo):
    p = check(repo)
    assert p.returncode == 0, p.stdout + p.stderr


def test_a_declared_absent_trace_builds_with_a_warning(repo):
    (repo / "data" / "derived" / "EX03_fast_burn" / "trace.json").unlink()
    doc = recompute(repo)
    assert next(e for e in doc["contracts"] if e["id"] == "trace")["missing"] == ["EX03_fast_burn/trace.json"]
    p = check(repo)
    assert p.returncode == 0, p.stdout + p.stderr
    assert "EX03_fast_burn/trace.json" in p.stdout and "WARN" in p.stdout


def test_a_declared_absent_manifest_builds_with_a_warning(repo):
    (repo / "data" / "derived" / "manifests" / "EX01_subcritical.json").unlink()
    recompute(repo)
    p = check(repo)
    assert p.returncode == 0, p.stdout + p.stderr
    assert "manifests/EX01_subcritical.json" in p.stdout and "WARN" in p.stdout


def test_adversarial_an_undeclared_absent_trace_stops(repo):
    recompute(repo)  # the readiness says every trace is there ...
    (repo / "data" / "derived" / "EX03_fast_burn" / "trace.json").unlink()  # ... and one is not
    p = check(repo)
    assert p.returncode == 1, p.stdout + p.stderr
    assert "missing artifact" in p.stdout and "EX03_fast_burn/trace.json" in p.stdout.replace("\\", "/")


def test_a_declared_path_that_is_present_is_not_an_error(repo):
    (repo / "data" / "derived" / "EX03_fast_burn" / "trace.json").unlink()
    doc = recompute(repo)
    (repo / "data" / "derived" / "EX03_fast_burn" / "trace.json").write_bytes(
        (ROOT / "data" / "derived" / "EX03_fast_burn" / "trace.json").read_bytes())
    assert next(e for e in doc["contracts"] if e["id"] == "trace")["state"] == "partial"
    p = check(repo)
    assert p.returncode == 0, p.stdout + p.stderr


def test_only_the_declared_path_is_tolerated(repo):
    (repo / "data" / "derived" / "EX03_fast_burn" / "trace.json").unlink()
    recompute(repo)
    (repo / "data" / "derived" / "EX02_epidemic" / "trace.json").unlink()  # a second absence, not declared
    p = check(repo)
    assert p.returncode == 1, p.stdout + p.stderr
    assert "EX02_epidemic/trace.json" in p.stdout.replace("\\", "/")


def test_an_absent_index_still_stops(repo):
    (repo / "data" / "derived" / "manifests" / "index.json").unlink()
    assert check(repo).returncode == 1
