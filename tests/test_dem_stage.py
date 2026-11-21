"""The bake stage of the discrete element runs (requirements DM-001 to DM-011, DM-018): the points, the runs with their raw records,
the replay encoding, the document builder, the units gate of the laboratory machine and the command ``dem``.

The simulation is the published package ``crushdem`` (requirements-precompute.txt); the tests that need it skip with that reason, the
others (the replay encoding, the units gate, the sources, the web bundle) run without it. Every test that runs the simulation keeps
it short: a 1 kg batch, two strokes, one overlap limit.
"""
from __future__ import annotations

import copy
import dataclasses
import hashlib
import importlib.util
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from pipeline import pipeline
from pipeline.core import unit_gate
from pipeline.dem import document, points, replay, runs
from pipeline.stages import dem as stage

sys.path.insert(0, str(Path(__file__).resolve().parent / "contracts"))   # the schema access of the contract tests
from contract_schemas import ROOT, errors  # noqa: E402

HAS_PACKAGE = importlib.util.find_spec("crushdem") is not None
needs_package = pytest.mark.skipif(not HAS_PACKAGE, reason="crushdem is not installed: install requirements-precompute.txt")
SHORT = points.RunSettings(mass_kg=1.0, max_strokes=2, overlaps=(0.3,))   # a 1 kg batch, two strokes, one overlap limit
PIPELINE = ROOT / "data-pipeline" / "pipeline"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()


# --- the sources: DM-002, DM-007, DM-018 -----------------------------------------------------------------------------------------

def _sources() -> dict[str, str]:
    files = [*sorted((PIPELINE / "dem").glob("*.py")), PIPELINE / "stages" / "dem.py"]
    return {f.relative_to(ROOT).as_posix(): f.read_text(encoding="utf-8") for f in files}


def test_the_stage_takes_the_simulation_from_the_package():
    """DM-002: the product holds no contact, breakage or stroke loop: its modules import the case from crushdem and call it."""
    src = _sources()
    assert len(src) >= 5
    for name, text in src.items():
        assert not re.search(r"\bwhile\b|def\s+(contact|breakage|stroke|step|run_cycles|integrate|neighbour)\w*|hertz|restitution|from\s+crushdem\.breakage\.tavares|\btavares_\w+\(",
                             text, re.I), f"{name} holds a piece of the particle engine"
    runs_src, document_src = src["data-pipeline/pipeline/dem/runs.py"], src["data-pipeline/pipeline/dem/document.py"]
    assert "from crushdem.cases import barrios2020" in runs_src and ".run_case(" in runs_src
    assert "from crushdem" in document_src and "compare_with_measurement" in document_src and "window_statistics" in document_src
    assert "crushdem" in (ROOT / "requirements-precompute.txt").read_text(encoding="utf-8")


def test_the_points_and_settings_are_the_definitions_and_read_no_measurement():
    """DM-007: nothing in the points, the settings or the preset texts reads a measured throughput, power or product."""
    assert [(p.id, p.feed_class, p.capacity) for p in points.POINTS] == [("63-52", "63/52", 1500), ("31.5-26.5", "31.5/26.5", 1500),
                                                                           ("16-13.2", "16/13.2", 3000)]
    s = points.DEFAULT_SETTINGS
    assert (s.seed, s.ore, s.backend, s.mass_kg, s.frequency_hz, s.closed_side_setting_m) == (1, "paper", "numba", 6.0, 6.0, 0.0075)
    assert (s.overlaps, s.stall_strokes, s.max_strokes, s.frames) == ((0.3, 0.5), 40, 400, (1, 400, 12))
    assert points.SPEED_RPM == 360.0 and points.BANDS == {"throughput": 0.10, "net_power": 0.30, "reduction_ratio": 0.15}
    text = (PIPELINE / "dem" / "points.py").read_text(encoding="utf-8")
    for measured in ("798", "937", "1220", "0.337", "0.166", "0.135", "0.34 ", "kg/h"):
        assert measured not in re.sub(r"#.*", "", text).replace("[kg/h]", ""), measured


@needs_package
def test_the_points_are_the_packages_feed_classes():
    from crushdem.cases import barrios2020 as case
    from crushdem.machines import BARRIOS_FEED_CLASSES

    for p in points.POINTS:
        c = BARRIOS_FEED_CLASSES[p.feed_class]
        assert (round(c.d_min * 1000, 6), round(c.d_max * 1000, 6)) == (p.lower_mm, p.upper_mm)
    assert tuple(case.OVERLAP_LADDER) == points.OVERLAP_LADDER and case.OVERLAP_REFERENCE == points.OVERLAP_REFERENCE
    assert case.BANDS["throughput_relative"] == points.BANDS["throughput"] and case.BANDS["net_power_relative"] == points.BANDS["net_power"]
    assert case.OPEN_SIDE_MM == points.OSS_MM


def test_the_web_bundle_holds_no_simulation():
    """DM-018: no file under frontend/src imports or names a simulation step: the document is read, never computed."""
    forbidden = re.compile(r"run_case|run_cycles|verlet|hertz|contactForce|integrateStep|simulationStep|stepSimulation", re.I)
    found = []
    for f in (ROOT / "frontend" / "src").rglob("*"):
        if f.suffix in (".ts", ".tsx", ".js", ".jsx", ".mjs") and forbidden.search(f.read_text(encoding="utf-8")):
            found.append(str(f.relative_to(ROOT)))
    assert found == []
    ci = " ".join(p.read_text(encoding="utf-8") for p in (ROOT / ".github").rglob("*.yml")) if (ROOT / ".github").is_dir() else ""
    assert "run.py dem" not in ci and "crushdem" not in ci   # CI only validates the committed documents (ADR-0074)


# --- the missing package -----------------------------------------------------------------------------------------------------

def test_without_the_package_the_command_stops_and_names_the_requirements(tmp_path):
    """Without crushdem the command exits non-zero with a message naming requirements-precompute.txt, never a silent skip."""
    code = ("import sys, runpy; sys.modules['crushdem'] = None; sys.argv = ['run.py', 'dem', '--output', sys.argv[1]]; "
            "runpy.run_path('data-pipeline/run.py', run_name='__main__')")
    p = subprocess.run([sys.executable, "-c", code, str(tmp_path / "out")], capture_output=True, text=True, cwd=ROOT,
                       env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "data-pipeline")})
    assert p.returncode != 0
    assert "requirements-precompute.txt" in p.stdout + p.stderr
    assert not (tmp_path / "out" / "dem").exists()


# --- the units gate: DM-009 ----------------------------------------------------------------------------------------------------

def _mini_doc() -> dict:
    sim = {"throughput_kg_h": 600.0, "throughput_whole_run_kg_h": 580.0, "net_power_kw": 0.3, "net_power_whole_run_kw": 0.28,
           "specific_energy_kwh_t": 0.5, "p80_mm": 6.0, "p50_mm": 3.0, "largest_product_mm": 20.0, "reduction_ratio": 10.0}
    pb = {"throughput_kg_h": 547.0, "p80_mm": 5.9, "p50_mm": 3.0, "f80_mm": 60.0, "reduction_ratio": 10.4, "specific_energy_kwh_t": 1.0,
          "band": {"p80_mm": [3.3, 8.9], "p50_mm": [1.0, 5.0], "reduction_ratio": [6.0, 18.0]}}
    return {"points": [{"id": "63-52", "simulation": sim, "population_balance": pb}]}


def test_the_units_gate_refuses_a_value_outside_the_laboratory_domain():
    doc = _mini_doc()
    assert unit_gate.blocking(unit_gate.check_lab_units(doc)) == []
    for path, value, observable in ((("simulation", "net_power_kw"), 300.0, "net_power_kw"),             # watts written as kilowatts
                                    (("simulation", "throughput_kg_h"), 0.6, None),                         # inside the domain: tonnes per hour is not caught here
                                    (("simulation", "throughput_kg_h"), 600000.0, "throughput_kg_h"),     # grams per hour
                                    (("simulation", "p80_mm"), 6000.0, "p80_mm"),                          # micrometres
                                    (("population_balance", "specific_energy_kwh_t"), 3600.0, "specific_energy_kwh_t"),
                                    (("simulation", "reduction_ratio"), 5000.0, "reduction_ratio"),
                                    (("population_balance", "throughput_kg_h"), float("nan"), "throughput_kg_h")):
        bad = copy.deepcopy(doc)
        bad["points"][0][path[0]][path[1]] = value
        problems = unit_gate.blocking(unit_gate.check_lab_units(bad))
        if observable is None:
            assert problems == []
        else:
            assert problems and observable in problems[0]["observable"], (path, value)
    with pytest.raises(unit_gate.UnitGateError):
        bad = copy.deepcopy(doc)
        bad["points"][0]["simulation"]["net_power_kw"] = 300.0
        unit_gate.enforce_lab(bad)
    absent = copy.deepcopy(doc)
    absent["points"][0]["simulation"]["throughput_kg_h"] = None      # a value that is absent is not a unit error
    assert unit_gate.blocking(unit_gate.check_lab_units(absent)) == []


def test_the_laboratory_domain_comes_from_the_nameplate_not_from_a_measurement():
    d = unit_gate.LAB_DOMAIN
    assert d["throughput_kg_h"][:2] == (0.0, 3000.0) and d["net_power_kw"][:2] == (0.0, 2.2)
    assert d["size_mm"][:2] == (0.0, 90.0) and d["specific_energy_kwh_t"][:2] == (0.0, 20.0) and d["reduction_ratio"][:2] == (1.0, 90.0)
    assert all(len(v) == 4 and v[2] and v[3] for v in d.values())      # every entry states its unit and why


# --- the replay encoding: DM-010 ------------------------------------------------------------------------------------------------

CHAMBER = {"units": "m", "width_m": 0.14, "top_gap_m": 0.09, "closed_side_setting_m": 0.0075, "plate_height_m": 0.22666688710500632,
           "plate_length_m": 0.24121386301345468, "pivot_m": [0.09, 0.0, 0.22666688710500632], "fixed_plate_x_m": 0.0,
           "fixed_plate_z_m": [0.0, 0.5266668871050063], "swing_plate_closed_bottom_edge_m": [0.0075, 0.0, 0.0],
           "discharge_z_m": -0.05, "hopper_height_m": 0.3}


def _rotated_edge(angle: float) -> tuple[float, float]:
    """The swing plate's bottom edge after a rotation by ``angle`` [rad] about the pivot: x and z [m] (the package's sign)."""
    px, _, pz = CHAMBER["pivot_m"]
    ex, _, ez = CHAMBER["swing_plate_closed_bottom_edge_m"]
    dx, dz = ex - px, ez - pz
    return px + math.cos(angle) * dx - math.sin(angle) * dz, pz + math.sin(angle) * dx + math.cos(angle) * dz


def _synthetic_frames(strokes: int, per_stroke: int, spheres: int = 40, seed: int = 3, partial_last: int | None = None) -> dict:
    rng = np.random.default_rng(seed)
    t, stroke, plate, counts = [], [], [], []
    for s in range(1, strokes + 1):
        n = per_stroke if (s < strokes or partial_last is None) else partial_last
        for j in range(1, n + 1):
            time = (s - 1 + j / per_stroke) / 6.0
            angle = 0.04 * math.sin(2 * math.pi * 6.0 * time) + 0.04
            t.append(time)
            stroke.append(s)
            plate.append((angle, _rotated_edge(angle)[0]))
            counts.append(int(spheres - j % 7))
    offsets = np.concatenate([[0], np.cumsum(counts)]).astype(np.int64)
    n_all = int(offsets[-1])
    arrays = {"x_m": rng.uniform(-0.05, 0.07, n_all).astype(np.float32), "y_m": rng.uniform(-0.068, 0.068, n_all).astype(np.float32),
              "z_m": rng.uniform(-0.05, 0.42, n_all).astype(np.float32), "radius_m": rng.uniform(0.002, 0.0314, n_all).astype(np.float32),
              "offsets": offsets, "t_s": np.array(t), "stroke": np.array(stroke, dtype=np.int64), "plate": np.array(plate)}
    return {"arrays": arrays, "chamber": CHAMBER, "spec": [1, 400, per_stroke], "reason": None}


def test_the_replay_round_trip_decodes_within_half_a_quantisation_step():
    frames = _synthetic_frames(strokes=4, per_stroke=12)
    data, block = replay.encode(frames, points.POINTS[0], 1_500_000)
    assert block["frames_per_stroke"] == 12 and block["frames"] == 48 and block["bytes"] == len(data) == 8 * block["spheres"]
    assert block["sha256"] == hashlib.sha256(data).hexdigest() and block["file"] == "dem/jaw-lab-63-52.frames.bin"
    assert sum(block["count"]) == block["spheres"] and len(block["count"]) == len(block["t_s"]) == len(block["stroke"]) == block["frames"]
    assert block["encoding"]["record"] == "uint16le x, uint16le y, uint16le z, uint16le radius"
    dec = replay.decode(data, block)
    a = frames["arrays"]
    for name, src, rng_key in (("x", "x_m", "x_range_mm"), ("y", "y_m", "y_range_mm"), ("z", "z_m", "z_range_mm")):
        lo, hi = block["encoding"][rng_key]
        step = (hi - lo) / 65535.0
        assert np.abs(dec[name] - a[src].astype(np.float64) * 1000.0).max() <= step / 2 + 1e-9
    assert np.abs(dec["radius"] - a["radius_m"].astype(np.float64) * 1000.0).max() <= block["encoding"]["radius_max_mm"] / 65535.0 / 2 + 1e-9


def test_the_ranges_come_from_the_geometry_and_the_feed_class_not_from_the_data():
    f1, f2 = _synthetic_frames(strokes=2, per_stroke=12, seed=1), _synthetic_frames(strokes=2, per_stroke=12, seed=9)
    b1, b2 = replay.encode(f1, points.POINTS[0], 10**7)[1], replay.encode(f2, points.POINTS[0], 10**7)[1]
    assert b1["encoding"] == b2["encoding"] and b1["geometry"] == b2["geometry"]       # the data's extremes changed, the ranges did not
    small = _synthetic_frames(1, 12)
    small["arrays"]["radius_m"][:] = 0.002
    radii = [replay.encode(small, p, 10**7)[1]["encoding"]["radius_max_mm"] for p in points.POINTS]
    assert radii[0] > radii[1] > radii[2]                                                # the feed class sets the radius range
    g = b1["geometry"]
    assert g["fixed_plate_x_mm"] == 0.0 and g["swing_pivot_mm"] == pytest.approx([90.0, 226.667], abs=1e-3)
    assert g["discharge_z_mm"] == -50.0 and g["hopper_height_mm"] == 300.0 and g["width_mm"] == 140.0


def test_a_sphere_outside_its_range_is_an_error_never_clipped():
    frames = _synthetic_frames(strokes=1, per_stroke=12)
    frames["arrays"]["x_m"][3] = 1.0                      # one metre: far outside the chamber
    with pytest.raises(replay.RangeError):
        replay.encode(frames, points.POINTS[0], 10**7)
    frames = _synthetic_frames(strokes=1, per_stroke=12)
    frames["arrays"]["radius_m"][0] = 0.2                 # a sphere larger than the feed class
    with pytest.raises(replay.RangeError):
        replay.encode(frames, points.POINTS[0], 10**7)


def test_the_thinning_keeps_the_largest_rate_that_fits_the_budget_and_the_end_of_every_stroke():
    frames = _synthetic_frames(strokes=6, per_stroke=12, spheres=100)
    full = replay.encode(frames, points.POINTS[0], 10**9)[1]
    assert full["frames_per_stroke"] == 12
    for k in (6, 4, 3, 2, 1):
        budget = int(full["bytes"] * k / 12) + 4800
        _, b = replay.encode(frames, points.POINTS[0], budget)
        assert b["frames_per_stroke"] >= k and b["bytes"] <= budget
        assert b["frames"] == 6 * b["frames_per_stroke"]
        ends = [t for t, s in zip(b["t_s"], b["stroke"])]
        for s in range(1, 7):
            last_t = [t for t, st in zip(ends, b["stroke"]) if st == s][-1]
            assert last_t == pytest.approx(s / 6.0, abs=1e-5)                    # the frame at the end of each stroke is kept
    with pytest.raises(replay.BudgetError):
        replay.encode(frames, points.POINTS[0], 8 * 100)                          # not even one frame per stroke fits


def test_a_run_stopped_in_a_stroke_is_replayed_up_to_its_stop():
    frames = _synthetic_frames(strokes=3, per_stroke=12, partial_last=5)
    _, b = replay.encode(frames, points.POINTS[0], 10**9)
    assert b["frames"] == 12 * 2 + 5 and b["last_stroke"] == 3 and b["first_stroke"] == 1


def test_the_plate_bottom_edge_is_the_rotation_of_the_closed_edge_by_the_recorded_angle():
    frames = _synthetic_frames(strokes=3, per_stroke=12)
    _, b = replay.encode(frames, points.POINTS[0], 10**9)
    for i, (angle, _) in enumerate(frames["arrays"]["plate"]):
        x, z = _rotated_edge(float(angle))
        assert b["plate_bottom_x_mm"][i] == pytest.approx(x * 1000.0, abs=1e-3)      # six significant digits
        assert b["plate_bottom_z_mm"][i] == pytest.approx(z * 1000.0, abs=2e-3)   # z from the pivot, the plate's length and x


# --- the runs of the package: DM-008, DM-010 -------------------------------------------------------------------------------------

@pytest.fixture(scope="module")
def short(tmp_path_factory):
    """Three short runs through the stage (one folder of raw records, three processes), a second run of the first point in another
    process, and a third without frames."""
    base = tmp_path_factory.mktemp("short")
    folder = base / "raw"
    first = runs.run_points(points.POINTS, SHORT, folder, jobs=3, log=lambda s: None)
    again = runs.run_points([points.POINTS[0]], SHORT, None, jobs=1, log=lambda s: None)
    bare = runs.run_points([points.POINTS[0]], dataclasses.replace(SHORT, frames=None), None, jobs=1, log=lambda s: None)
    return {"folder": folder, "first": first, "again": again.runs["63-52"], "bare": bare.runs["63-52"], "base": base}


@needs_package
def test_a_short_run_is_reproduced_bit_for_bit(short):
    a, b = short["first"].runs["63-52"], short["again"]
    assert a.record == b.record
    assert a.frames["chamber"] == b.frames["chamber"] and a.frames["reason"] == b.frames["reason"]
    for name, arr in a.frames["arrays"].items():
        assert np.array_equal(arr, b.frames["arrays"][name]), name
    assert "wall_time_s" not in json.dumps(a.record) and "started_utc" not in json.dumps(a.record)      # no wall time, no date in a record


@needs_package
def test_frames_do_not_change_the_run(short):
    with_frames, without = short["again"].record, short["bare"].record
    assert short["bare"].frames is None
    assert with_frames["attempts"][-1]["series"] == without["attempts"][-1]["series"]
    assert with_frames == without


@needs_package
def test_raw_records_are_reused_and_a_changed_setting_or_package_build_misses(short, monkeypatch):
    folder = short["folder"]
    second = runs.run_points(points.POINTS, SHORT, folder, jobs=3, log=lambda s: None)
    assert second.ran == [] and second.loaded == ["63-52", "31.5-26.5", "16-13.2"]
    for pid, raw in second.runs.items():
        assert raw.record == short["first"].runs[pid].record
        assert all(np.array_equal(v, short["first"].runs[pid].frames["arrays"][k]) for k, v in raw.frames["arrays"].items())
    p = points.POINTS[0]
    key = runs.run_key(p, SHORT)
    assert runs.run_key(p, dataclasses.replace(SHORT, max_strokes=4)) != key                    # a changed setting misses
    assert runs.run_key(points.POINTS[1], SHORT) != key
    assert runs.load_raw(folder, p, runs.run_key(p, dataclasses.replace(SHORT, max_strokes=4))) is None
    monkeypatch.setattr(runs, "package_digest", lambda: "another build")                        # a different package build never matches
    assert runs.run_key(p, SHORT) != key and runs.load_raw(folder, p, runs.run_key(p, SHORT)) is None


@needs_package
def test_a_record_that_fails_to_load_is_run_again_and_replaced(tmp_path):
    p = points.POINTS[1]
    out = runs.run_points([p], SHORT, tmp_path, jobs=1, log=lambda s: None)
    js = next(tmp_path.glob("*.json"))
    npz = next(tmp_path.glob("*.npz"))
    js_text = js.read_text(encoding="utf-8")
    npz.write_bytes(b"not an npz")
    again = runs.run_points([p], SHORT, tmp_path, jobs=1, log=lambda s: None)
    assert again.ran == ["31.5-26.5"] and again.loaded == []
    assert again.runs["31.5-26.5"].record == out.runs["31.5-26.5"].record and js.read_text(encoding="utf-8") == js_text
    assert runs.load_raw(tmp_path, p, runs.run_key(p, SHORT)) is not None


@needs_package
def test_the_replay_of_a_real_run_decodes_to_the_recorded_positions_and_clips_nothing(short):
    raw = short["first"].runs["63-52"]
    data, block = replay.encode(raw.frames, raw.point, points.REPLAY_BUDGET_BYTES)
    a = raw.frames["arrays"]
    assert block["spheres"] == len(a["x_m"]) and block["frames_per_stroke"] == 12 and block["last_stroke"] == 2
    dec = replay.decode(data, block)
    lo, hi = block["encoding"]["z_range_mm"]
    assert np.abs(dec["z"] - a["z_m"].astype(np.float64) * 1000.0).max() <= (hi - lo) / 65535.0 / 2 + 1e-9
    assert np.abs(dec["radius"] - a["radius_m"].astype(np.float64) * 1000.0).max() <= block["encoding"]["radius_max_mm"] / 65535 / 2 + 1e-9
    for i, (angle, x) in enumerate(a["plate"]):                      # the recorded angle and the closed edge give the recorded x
        assert block["plate_bottom_x_mm"][i] == pytest.approx(x * 1000.0, abs=1e-3)
        px, pz = block["geometry"]["swing_pivot_mm"]
        ex, ez = block["geometry"]["swing_closed_bottom_mm"]
        rx = px + math.cos(angle) * (ex - px) - math.sin(angle) * (ez - pz)
        rz = pz + math.sin(angle) * (ex - px) + math.cos(angle) * (ez - pz)
        assert block["plate_bottom_x_mm"][i] == pytest.approx(rx, abs=2e-3) and block["plate_bottom_z_mm"][i] == pytest.approx(rz, abs=2e-3)


# --- the document builder: DM-003, DM-005, DM-007 ---------------------------------------------------------------------------------

def _fake_record(point: points.Point, status: str, strokes: int = 24, with_window: bool = True) -> runs.RawRun:
    """A raw record in the shape of the package's run_case, built here (no simulation): a series with a window of discharge."""
    from crushdem.cases import barrios2020 as case

    ore = runs._jsonable(case.paper_ore("A", seed=1)[0].describe())
    rows = []
    for k in range(1, strokes + 1):
        passed = 6.0 * min(1.0, k / (strokes - 2)) if with_window else 0.0
        rows.append({"stroke": k, "t_s": k / 6.0, "swing_plate_w": 300.0 + 20.0 * math.sin(k), "passed_kg": passed, "n_hold": 100,
                     "hold_up_kg": 6.0 - passed, "pending_kg": 0.0, "max_overlap": 0.1})
    sizes = [0.004 + 0.0005 * i for i in range(60)]
    prod_total = rows[-1]["passed_kg"]
    cum = [(i + 1) / len(sizes) for i in range(len(sizes))]
    att = {"status": status, "error": "the run is unstable or the time step too large" if status == "overlap_error" else None,
           "max_overlap_fraction": 0.5, "max_overlap_reached": 0.25, "stopped_during_stroke": strokes + 1 if status == "overlap_error" else None,
           "backend": "numba", "strokes": strokes, "steps": 1000 * strokes, "dt_s": 1e-6, "sim_time_s": strokes / 6.0, "capacity": point.capacity,
           "series": rows, "flow": {"mass_in_kg": 6.0, "mass_out_kg": prod_total * 0.9, "fines_kg": prod_total * 0.1, "hold_up_kg": 6.0 - prod_total,
                                    "balance_residual_kg": 0.0, "n_in": 100, "n_out": 80, "n_hold": 100, "pending_kg": 0.0},
           "product": {"total_kg": prod_total, "fines_kg": prod_total * 0.1, "sizes_m": sizes if prod_total else [],
                       "cum_mass_passing": cum if prod_total else []},
           "breakage": {"n_events": 50, "n_progeny": 400, "mass_broken_kg": 5.0, "fines_kg": 0.1, "n_deferred_cap": 0, "n_deferred_placement": 3,
                        "peak_particles": 300, "injected_energy_j": 1.0, "absorbed_energy_j": 40.0},
           "mass_balance_residual_kg": 0.0}
    record = {"name": point.id, "role": points.ROLE, "ore": ore, "mass_requested_kg": 6.0, "frequency_hz": 6.0, "seed": 1, "attempts": [att],
              "final_attempt": 0}
    return runs.RawRun(point=point, record=record, frames=None, key="k" * 64)


def _fake_runs(statuses=("complete", "complete", "complete")) -> dict:
    return {p.id: _fake_record(p, s) for p, s in zip(points.POINTS, statuses)}


@needs_package
def test_a_run_that_does_not_complete_is_recorded_as_such():
    """DM-003: a record ending in overlap_error gives partial, no window statistic and not compared with the basis run_incomplete,
    even though the package would find a window in its series."""
    from crushdem import comparison

    raws = _fake_runs(("complete", "overlap_error", "complete"))
    series = raws["31.5-26.5"].record["attempts"][0]["series"]
    assert comparison.window_statistics(series, 1.0 / 6.0)["window"] is not None          # the package computes a window for it
    doc = document.build(raws, VERSION)
    assert errors("dem-run", doc) == []
    assert doc["state"] == "partial" and doc["incomplete"] == ["31.5-26.5"]
    p = next(p for p in doc["points"] if p["id"] == "31.5-26.5")
    sim = p["simulation"]
    assert sim["status"] == "overlap_error" and sim["error"] and sim["window"] is None and sim["strokes"] == 24
    for key in ("throughput_kg_h", "throughput_se_kg_h", "net_power_kw", "net_power_se_kw", "power_trend_stationary", "specific_energy_j_kg",
                "specific_energy_kwh_t", "window_strokes_above_overlap_reference"):
        assert sim[key] is None, key
    assert sim["attempts"][-1]["stopped_during_stroke"] == 25 and len(sim["series"]["stroke"]) == 24      # what was run is still recorded
    for pair in ("simulation_vs_measured", "population_balance_vs_simulation"):
        for q, v in p["verdicts"][pair].items():
            if pair == "population_balance_vs_simulation" and q == "net_power":
                assert v["basis"] == "no_work_index"
                continue
            assert (v["verdict"], v["basis"], v["resolved"], v["edge_distance_se"], v["relative_error"]) == ("not compared", "run_incomplete", None, None, None), (pair, q)
    ok = next(p for p in doc["points"] if p["id"] == "63-52")
    assert ok["verdicts"]["simulation_vs_measured"]["throughput"]["verdict"] in ("met", "not met")
    assert ok["verdicts"]["simulation_vs_measured"]["throughput"]["resolved"] in (True, False)


@needs_package
def test_a_complete_run_without_a_window_and_a_run_that_passed_nothing():
    rec = _fake_record(points.POINTS[0], "complete", strokes=4)               # fewer strokes than a window needs
    doc = document.build({**_fake_runs(), "63-52": rec}, VERSION)
    v = doc["points"][0]["verdicts"]["simulation_vs_measured"]
    assert (v["throughput"]["basis"], v["net_power"]["basis"]) == ("no_window", "no_window")
    assert doc["points"][0]["simulation"]["window"] is None and doc["state"] == "available"
    nothing = _fake_record(points.POINTS[2], "stalled", strokes=45, with_window=False)
    doc = document.build({**_fake_runs(), "16-13.2": nothing}, VERSION)
    s = doc["points"][2]["simulation"]
    assert s["product"] is None and s["p80_mm"] is None and s["reduction_ratio"] is None and s["largest_product_mm"] is None
    assert doc["points"][2]["verdicts"]["simulation_vs_measured"]["reduction_ratio"]["basis"] == "run_incomplete"
    assert errors("dem-run", doc) == []


@needs_package
def test_every_population_balance_power_verdict_is_not_compared_for_want_of_a_work_index():
    doc = document.build(_fake_runs(), VERSION)
    for p in doc["points"]:
        for pair in ("population_balance_vs_measured", "population_balance_vs_simulation"):
            v = p["verdicts"][pair]["net_power"]
            assert (v["verdict"], v["basis"], v["first"], v["relative_error"]) == ("not compared", "no_work_index", None, None)


@needs_package
def test_the_document_is_a_function_of_the_records(short):
    a = document.build(_fake_runs(), VERSION)
    b = document.build(copy.deepcopy(_fake_runs()), VERSION)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    text = json.dumps(a)
    assert not re.search(r"wall|20\d\d-\d\d-\d\d|[A-Z]:[\\/]|/home/", text.replace("2026-10-27", ""))        # no wall time, date, host or path


@needs_package
def test_no_input_reads_the_measured_outcome(monkeypatch):
    """DM-007: with the measured values replaced, only the measured block and the verdicts move."""
    from crushdem.cases import barrios2020 as case

    raws = _fake_runs()
    base = document.build(raws, VERSION)
    real = case.measured

    def other(feed_class=case.DEFAULT_FEED_CLASS):
        m = real(feed_class)
        product = dict(m.product, passing_pct=[min(100.0, v * 0.9 + 3.0) for v in m.product["passing_pct"]])
        return dataclasses.replace(m, throughput_kg_h=m.throughput_kg_h * 1.7, net_power_kw=m.net_power_kw * 0.4, product=product)

    monkeypatch.setattr(case, "measured", other)
    moved = document.build(raws, VERSION)
    assert moved["points"][0]["measured"] != base["points"][0]["measured"] and moved["points"][0]["verdicts"] != base["points"][0]["verdicts"]
    for name in ("machine", "source", "package", "seed", "bands", "settings", "ore", "preset", "state", "incomplete"):
        assert moved[name] == base[name], name
    for a, b in zip(base["points"], moved["points"]):
        assert a["simulation"] == b["simulation"]
        pa, pb = dict(a["population_balance"]), dict(b["population_balance"])
        # the work index the measured energy implies is a reading of the measurement (the schema says so): it moves with it
        assert pa.pop("implied_work_index_kwh_t") != pb.pop("implied_work_index_kwh_t")
        assert pa == pb
        assert {k: v for k, v in a.items() if k not in ("measured", "verdicts", "simulation", "population_balance")} == \
               {k: v for k, v in b.items() if k not in ("measured", "verdicts", "simulation", "population_balance")}


@needs_package
def test_the_window_and_the_resolved_rule_are_the_packages_on_the_recorded_series():
    from crushdem import comparison
    from crushdem.cases import barrios2020 as case

    raws = _fake_runs()
    doc = document.build(raws, VERSION)
    for p in doc["points"]:
        series = raws[p["id"]].record["attempts"][0]["series"]
        m = case.measured(p["feed_class"])
        ref = comparison.compare_with_measurement(series, 1.0 / 6.0, {"power": m.net_power_kw * 1e3, "throughput": m.throughput_kg_h},
                                                  {"power": points.BANDS["net_power"], "throughput": points.BANDS["throughput"]})
        stats = comparison.window_statistics(series, 1.0 / 6.0)
        s, v = p["simulation"], p["verdicts"]["simulation_vs_measured"]
        assert s["window"] == {"first_stroke": ref["window"][0], "last_stroke": ref["window"][1], "strokes": stats["window"].n}
        assert s["throughput_kg_h"] == pytest.approx(ref["throughput"]["simulated"], rel=2e-5)
        assert s["throughput_se_kg_h"] == pytest.approx(ref["throughput"]["se"], rel=2e-5)
        assert s["net_power_kw"] == pytest.approx(ref["power"]["simulated"] / 1e3, rel=2e-5)
        assert s["net_power_se_kw"] == pytest.approx(ref["power"]["se"] / 1e3, rel=2e-5)
        for q, key in (("throughput", "throughput"), ("net_power", "power")):
            assert v[q]["resolved"] is ref[key]["resolved"] and v[q]["verdict"] == ref[key]["verdict"]
            assert v[q]["edge_distance_se"] == pytest.approx(ref[key]["z_edge"], rel=2e-5)
            assert v[q]["relative_error"] == pytest.approx(ref[key]["relative_error"], rel=2e-5)


# --- the stage: DM-001, DM-010, DM-011 --------------------------------------------------------------------------------------------

@pytest.fixture(scope="module")
def baked(short, tmp_path_factory):
    out = tmp_path_factory.mktemp("sandbox")
    paths = pipeline.PipelinePaths.from_output(out)
    doc = stage.run(paths, seed=points.SEED, runs_dir=short["folder"], jobs=3, settings=SHORT)
    return {"doc": doc, "root": out, "paths": paths}


@needs_package
def test_the_stage_writes_the_document_and_one_replay_file_per_point(baked):
    root, doc = baked["root"], baked["doc"]
    written = json.loads((root / "dem" / "jaw-lab.json").read_text(encoding="utf-8"))
    assert written == doc and errors("dem-run", written) == []
    assert written["state"] == "partial" and written["incomplete"] == ["63-52", "31.5-26.5", "16-13.2"]    # three strokes are not a batch
    for p in written["points"]:
        r = p["simulation"]["replay"]
        data = (root / r["file"]).read_bytes()
        assert r["file"] == f"dem/jaw-lab-{p['id']}.frames.bin" and len(data) == r["bytes"] == 8 * r["spheres"]
        assert hashlib.sha256(data).hexdigest() == r["sha256"]
    assert sorted(f.name for f in (root / "dem").iterdir()) == ["jaw-lab-16-13.2.frames.bin", "jaw-lab-31.5-26.5.frames.bin",
                                                               "jaw-lab-63-52.frames.bin", "jaw-lab.json"]


@needs_package
def test_two_bakes_of_the_same_records_are_byte_identical_and_the_index_lists_the_document(baked, short, tmp_path):
    second = pipeline.PipelinePaths.from_output(tmp_path / "again")
    stage.run(second, seed=points.SEED, runs_dir=short["folder"], jobs=3, settings=SHORT)
    for f in (baked["root"] / "dem").iterdir():
        assert f.read_bytes() == (tmp_path / "again" / "dem" / f.name).read_bytes(), f.name
    listed = pipeline.index_files(baked["root"])
    assert "dem/jaw-lab.json" in listed
    assert not [f for f in listed if f.endswith(".bin")]      # the case-index schema admits .json and .onnx only: the document names its replay files


@needs_package
def test_the_stage_refuses_a_value_outside_the_laboratory_domain(short, tmp_path, monkeypatch):
    real = document.build

    def wrong_unit(raws, version, replays=None, settings=None):
        doc = real(raws, version, replays, settings)
        doc["points"][0]["population_balance"]["throughput_kg_h"] = 5.0e6      # grams per hour
        return doc

    monkeypatch.setattr(stage.document, "build", wrong_unit)
    with pytest.raises(unit_gate.UnitGateError):
        stage.run(pipeline.PipelinePaths.from_output(tmp_path / "bad"), seed=points.SEED, runs_dir=short["folder"], jobs=3, settings=SHORT)
    assert not (tmp_path / "bad" / "dem" / "jaw-lab.json").exists()           # nothing is written after a refusal


@needs_package
def test_the_command_refreshes_the_index_and_the_readiness(short, tmp_path):
    out = tmp_path / "out"
    shutil_copy = __import__("shutil").copytree
    shutil_copy(ROOT / "data" / "derived" / "models", out / "models")
    pipeline.run_all(seed=42, output_root=out)
    code = ("import sys, runpy; sys.argv = ['run.py', 'dem', '--output', sys.argv[1], '--runs', sys.argv[2], '--jobs', '3']; "
            "import pipeline.dem.points as P; P.DEFAULT_SETTINGS = P.RunSettings(mass_kg=1.0, max_strokes=2, overlaps=(0.3,)); "
            "import pipeline.stages.dem as D; D.DEFAULT_SETTINGS = P.DEFAULT_SETTINGS; "
            "runpy.run_path('data-pipeline/run.py', run_name='__main__')")
    p = subprocess.run([sys.executable, "-c", code, str(out), str(short["folder"])], capture_output=True, text=True, cwd=ROOT,
                       env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "data-pipeline")})
    assert p.returncode == 0, p.stdout + p.stderr
    assert "loaded from the raw records 63-52, 31.5-26.5, 16-13.2" in p.stdout
    index = json.loads((out / "manifests" / "index.json").read_text(encoding="utf-8"))
    assert "dem/jaw-lab.json" in index["files"]
    ready = json.loads((out / "readiness.json").read_text(encoding="utf-8"))
    entry = next(e for e in ready["contracts"] if e["id"] == "dem-run")
    assert entry["state"] == "partial" and entry["missing"] == ["16-13.2", "31.5-26.5", "63-52"]
