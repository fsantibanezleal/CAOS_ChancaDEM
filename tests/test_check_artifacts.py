"""scripts/check_artifacts.py over the shipped artifacts: every drift it exists to catch, planted in a copy of the bake."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check_artifacts.py"


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    r = tmp_path / "repo"
    shutil.copytree(ROOT / "data", r / "data")
    return r


def check(r: Path) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), str(r)], capture_output=True, text=True, cwd=ROOT)


def edit_manifest(r: Path, case: str, fn) -> None:
    path = r / "data" / "derived" / "manifests" / f"{case}.json"
    m = json.loads(path.read_text(encoding="utf-8"))
    fn(m)
    path.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def test_the_shipped_bake_passes(repo):
    p = check(repo)
    assert p.returncode == 0 and "27 cases" in p.stdout, p.stdout + p.stderr


def test_adversarial_a_trace_changed_by_one_byte_of_equal_size_fails_on_the_sha256(repo):
    trace = repo / "data" / "derived" / "S01" / "trace.json"
    raw = bytearray(trace.read_bytes())
    at = next(i for i in range(len(raw) - 1, -1, -1) if chr(raw[i]).isdigit())
    raw[at] = ord("0") if raw[at] != ord("0") else ord("1")
    trace.write_bytes(bytes(raw))
    p = check(repo)
    assert p.returncode == 1 and "sha256" in p.stdout and "byte drift" not in p.stdout


def test_adversarial_a_changed_size_fails_on_the_bytes(repo):
    trace = repo / "data" / "derived" / "S01" / "trace.json"
    trace.write_bytes(trace.read_bytes() + b" ")
    assert "byte drift" in check(repo).stdout


def test_adversarial_a_mislabelled_lane_fails(repo):
    edit_manifest(repo, "S01", lambda m: m.update(lane="precompute"))
    assert "lane/gate mismatch" in check(repo).stdout
    edit_manifest(repo, "S01", lambda m: (m.update(lane="precompute"), m["gate"].update(lane="precompute")))
    assert "precompute without a reason" in check(repo).stdout


def test_adversarial_a_gate_whose_numbers_decide_precompute_fails_when_the_lane_is_live(repo):
    edit_manifest(repo, "S02", lambda m: m["gate"].update(trace_bytes_budget=1))
    assert "the gate's" in check(repo).stdout


def test_adversarial_a_metric_outside_its_expected_range_fails(repo):
    edit_manifest(repo, "S01", lambda m: m["metrics"].update(p80_mm=90.0))
    p = check(repo)
    assert p.returncode == 1 and "S01: p80_mm=90.0 outside" in p.stdout


def test_adversarial_the_units_gate_runs_over_the_shipped_artifacts(repo):
    """A cell baked with a power in watts: the expected range for it is dropped so only the units gate can refuse it."""
    def watts(m):
        m["metrics"]["power_kw"] = m["metrics"]["power_kw"] * 1000.0

    edit_manifest(repo, "S01", watts)
    p = check(repo)
    assert p.returncode == 1 and "units gate" in p.stdout and "power_kw" in p.stdout


def test_adversarial_a_real_case_is_held_to_the_measured_range(repo):
    edit_manifest(repo, "HP500-01", lambda m: (m["metrics"].update(throughput_tph=60000.0), m["expect"].pop("throughput_tph")))
    p = check(repo)
    assert p.returncode == 1 and "units gate" in p.stdout and "throughput_tph" in p.stdout


def test_a_file_the_index_lists_must_exist(repo):
    (repo / "data" / "derived" / "hp500" / "loo.json").unlink()
    p = check(repo)
    assert p.returncode == 1 and "declared by the index but missing" in p.stdout


def plant_dem(r: Path, power_kw: float = 0.3, frames: bytes = b"\x01\x00" * 8) -> Path:
    """A minimal dem-run document and its replay file in a copy of the bake (the check reads only the values it gates and the replay block)."""
    import hashlib

    derived = r / "data" / "derived" / "dem"
    derived.mkdir(parents=True, exist_ok=True)
    (derived / "jaw-lab-63-52.frames.bin").write_bytes(frames)
    doc = {"points": [{"id": "63-52", "simulation": {"net_power_kw": power_kw, "throughput_kg_h": 600.0, "p80_mm": 6.0,
                                                      "replay": {"file": "dem/jaw-lab-63-52.frames.bin", "bytes": len(frames),
                                                                 "sha256": hashlib.sha256(frames).hexdigest()}},
                       "population_balance": {"throughput_kg_h": 547.0, "p80_mm": 5.9}}]}
    (derived / "jaw-lab.json").write_text(json.dumps(doc), encoding="utf-8")
    return derived


def test_a_particle_simulation_document_in_its_units_with_its_replay_passes(repo):
    plant_dem(repo)
    p = check(repo)
    assert p.returncode == 0, p.stdout + p.stderr


def test_adversarial_a_particle_simulation_power_in_watts_fails_the_laboratory_units_gate(repo):
    plant_dem(repo, power_kw=300.0)
    p = check(repo)
    assert p.returncode == 1 and "laboratory jaw" in p.stdout and "net_power_kw" in p.stdout


def test_adversarial_a_replay_file_changed_by_one_byte_fails_on_the_sha256_and_a_changed_size_on_the_bytes(repo):
    derived = plant_dem(repo)
    frames = derived / "jaw-lab-63-52.frames.bin"
    frames.write_bytes(b"\x02\x00" + frames.read_bytes()[2:])
    p = check(repo)
    assert p.returncode == 1 and "sha256" in p.stdout and "byte drift" not in p.stdout
    frames.write_bytes(frames.read_bytes() + b"\x00")
    assert "byte drift" in check(repo).stdout
    frames.unlink()
    assert "missing replay file" in check(repo).stdout


def test_a_bake_without_the_particle_simulation_passes(repo):
    shutil.rmtree(repo / "data" / "derived" / "dem", ignore_errors=True)       # readiness says missing for dem-run: nothing else fails
    assert check(repo).returncode == 0
