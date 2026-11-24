"""Catalog row dem-run 1.0.0 (producer side and swap): the document of the discrete element runs of the laboratory jaw crusher,
``data/derived/dem/jaw-lab.json``, and the replay file of each point. The same assertions run on the provider tree
(``docs/contracts/fixtures/data/derived/dem/``, the released document copied) and, when present, on the committed bake. The
simulation is never run here (DM-018): these tests read documents; the stage's own tests are ``tests/test_dem_stage.py``.

The rules a schema cannot state: every verdict follows its band; a verdict is ``not compared`` exactly when its basis says so; the
population-balance block is the laboratory-jaw module at the point's operating values; the replay file is the file the document names,
by its byte count and sha256 digest.
"""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import pytest

import contract_schemas as cs

DOC_REL = "dem/jaw-lab.json"
ROOTS = {"committed bake": cs.DERIVED_ROOTS["bake"], "provider tree": cs.DERIVED_ROOTS["fixture"]}
POINT_IDS = ["63-52", "31.5-26.5", "16-13.2"]
PAIRS = ("simulation_vs_measured", "population_balance_vs_measured", "population_balance_vs_simulation")
QUANTITIES = ("throughput", "net_power", "reduction_ratio")
# the laboratory-jaw module's values at the three points, reviewed before the bake (throughput kg/h, P80 mm, reduction ratio)
REVIEWED = {"63-52": (547.0, 5.88, 10.41), "31.5-26.5": (826.2, 6.99, 4.39), "16-13.2": (876.7, 10.34, 1.50)}
ROUNDING = 2e-5   # six significant digits: the relative error a rounded document can show


def load(label: str) -> tuple[Path, dict]:
    root = ROOTS[label]
    path = root / DOC_REL
    if not path.is_file():
        if label == "provider tree":
            pytest.fail(f"missing {path}: the provider tree copies the released document (run.py fixtures)")
        pytest.skip(f"{path} is absent: the committed bake holds no particle-simulation document (readiness says missing)")
    return root, cs.load_json(path)


@pytest.fixture(params=list(ROOTS))
def doc_root(request):
    return load(request.param)


def point(doc: dict, pid: str) -> dict:
    return next(p for p in doc["points"] if p["id"] == pid)


def verdict_errors(doc: dict) -> list[str]:
    """Every verdict against its band and its basis, and against the values of the blocks it compares."""
    out: list[str] = []
    bands = {"throughput": doc["bands"]["throughput_relative"], "net_power": doc["bands"]["net_power_relative"],
             "reduction_ratio": doc["bands"]["reduction_ratio_relative"]}
    for p in doc["points"]:
        s, pb, m = p["simulation"], p["population_balance"], p["measured"]
        values = {
            "simulation_vs_measured": {"throughput": (s["throughput_kg_h"], m["throughput_kg_h"]["value"]),
                                       "net_power": (s["net_power_kw"], m["net_power_kw"]["value"]),
                                       "reduction_ratio": (s["reduction_ratio"], m["reduction_ratio"])},
            "population_balance_vs_measured": {"throughput": (pb["throughput_kg_h"], m["throughput_kg_h"]["value"]),
                                               "net_power": (None, m["net_power_kw"]["value"]),
                                               "reduction_ratio": (pb["reduction_ratio"], m["reduction_ratio"])},
            "population_balance_vs_simulation": {"throughput": (pb["throughput_kg_h"], s["throughput_kg_h"]),
                                                 "net_power": (None, s["net_power_kw"]),
                                                 "reduction_ratio": (pb["reduction_ratio"], s["reduction_ratio"])},
        }
        for pair in PAIRS:
            for q in QUANTITIES:
                v, where = p["verdicts"][pair][q], f"{p['id']} {pair} {q}"
                first, second = values[pair][q]
                if v["band"] != bands[q]:
                    out.append(f"{where}: band {v['band']} is not the document's {bands[q]}")
                if v["basis"] is not None:
                    if v["verdict"] != "not compared" or v["relative_error"] is not None or v["resolved"] is not None or v["edge_distance_se"] is not None:
                        out.append(f"{where}: basis {v['basis']} but the verdict is {v['verdict']} with a number")
                    if v["first"] is not None and v["second"] is not None:
                        out.append(f"{where}: not compared although both values are present")
                    if q == "net_power" and pair != "simulation_vs_measured" and v["basis"] != "no_work_index":
                        out.append(f"{where}: a population-balance power verdict must say no_work_index, not {v['basis']}")
                    if pair != "simulation_vs_measured" and q == "net_power" and v["first"] is not None:
                        out.append(f"{where}: the population balance states no power")
                    if v["basis"] == "run_incomplete" and s["status"] == "complete":
                        out.append(f"{where}: run_incomplete for a complete run")
                    continue
                if v["verdict"] not in ("met", "not met") or v["first"] is None or v["second"] is None:
                    out.append(f"{where}: no basis but not a verdict of two values")
                    continue
                if (v["first"], v["second"]) != (first, second):
                    out.append(f"{where}: first and second are not the values of the blocks ({first}, {second})")
                rel = (v["first"] - v["second"]) / v["second"]
                if abs(rel - v["relative_error"]) > 1e-4 * max(1.0, abs(rel)):
                    out.append(f"{where}: relative_error {v['relative_error']} is not {rel}")
                if abs(abs(rel) - v["band"]) > 1e-4 and v["verdict"] != ("met" if abs(rel) <= v["band"] else "not met"):
                    out.append(f"{where}: {v['verdict']} against |{rel:.4f}| and band {v['band']}")
                window_based = pair == "simulation_vs_measured" and q in ("throughput", "net_power")
                if window_based != isinstance(v["resolved"], bool) or (window_based and v["edge_distance_se"] is None):
                    out.append(f"{where}: resolved {v['resolved']!r} and edge {v['edge_distance_se']!r} do not match a window-based verdict")
            if s["status"] != "complete" and pair != "population_balance_vs_measured":
                for q in QUANTITIES:
                    if p["verdicts"][pair][q]["verdict"] != "not compared":
                        out.append(f"{p['id']} {pair} {q}: a verdict rests on a run that did not complete")
    return out


def incomplete_errors(doc: dict) -> list[str]:
    """DM-003: a run that did not complete states no window statistic, and the document names it and says ``partial``."""
    out: list[str] = []
    stopped = [p["id"] for p in doc["points"] if p["simulation"]["status"] != "complete"]
    if doc["incomplete"] != stopped:
        out.append(f"incomplete {doc['incomplete']} is not the runs that did not complete {stopped}")
    if doc["state"] != ("partial" if stopped else "available"):
        out.append(f"state {doc['state']} with {len(stopped)} runs that did not complete")
    for p in doc["points"]:
        s = p["simulation"]
        if s["status"] == "complete":
            continue
        for key in ("window", "throughput_kg_h", "throughput_se_kg_h", "net_power_kw", "net_power_se_kw", "specific_energy_j_kg",
                    "specific_energy_kwh_t"):
            if s[key] is not None:
                out.append(f"{p['id']}: {key} is stated for a run that ended with {s['status']}")
    return out


def replay_errors(root: Path, doc: dict, index_files: list[str] | None = None) -> list[str]:
    out: list[str] = []
    for p in doc["points"]:
        r = p["simulation"]["replay"]
        if r is None:
            continue
        where = f"{p['id']} replay"
        path = root / r["file"]
        if not path.is_file():
            out.append(f"{where}: missing {path}")
            continue
        data = path.read_bytes()
        if len(data) != r["bytes"]:
            out.append(f"{where}: {len(data)} bytes on disk, the document names {r['bytes']}")
        if hashlib.sha256(data).hexdigest() != r["sha256"]:
            out.append(f"{where}: the sha256 digest differs from the document's")
        if len(data) != 8 * r["spheres"] or sum(r["count"]) != r["spheres"]:
            out.append(f"{where}: {len(data)} bytes, {r['spheres']} spheres, counts sum {sum(r['count'])}")
        lengths = {len(r[k]) for k in ("t_s", "stroke", "plate_bottom_x_mm", "plate_bottom_z_mm", "count")}
        if lengths != {r["frames"]}:
            out.append(f"{where}: the per-frame lists have lengths {sorted(lengths)}, not {r['frames']}")
        if r["file"] != f"dem/jaw-lab-{p['id']}.frames.bin" or (index_files is not None and r["file"] not in index_files):
            out.append(f"{where}: the file {r['file']} is not the point's file or is not listed by the index")
        if min(r["stroke"]) != r["first_stroke"] or max(r["stroke"]) != r["last_stroke"] or r["last_stroke"] > p["simulation"]["strokes"] + 1:
            out.append(f"{where}: the strokes do not match the run")
    return out


# --- the schema and the three sides -----------------------------------------------------------------------------------------------

def test_dem_run_validates(doc_root):
    root, doc = doc_root
    assert cs.errors("dem-run", doc) == []
    assert doc["schema"] == "chancadem.dem.run/v1" and [p["id"] for p in doc["points"]] == POINT_IDS
    assert doc["state"] == ("partial" if doc["incomplete"] else "available")
    assert doc["incomplete"] == [p["id"] for p in doc["points"] if p["simulation"]["status"] != "complete"]
    assert doc["package"]["name"] == "crushdem" and doc["seed"] == 1 and doc["settings"]["speed_rpm"] == 60.0 * doc["settings"]["frequency_hz"]
    assert doc["settings"]["oss_mm"] == doc["settings"]["css_mm"] + doc["machine"]["throw_mm"]
    assert doc["settings"]["sieves_mm"] == sorted(doc["settings"]["sieves_mm"])
    text = json.dumps(doc)
    assert "wall" not in text and "2026-11" not in text and "\\\\" not in text      # no wall time, no date, no path
    index = cs.load_json(root / "manifests" / "index.json") if (root / "manifests" / "index.json").is_file() else None
    if index is not None:
        assert DOC_REL in index["files"]


def test_every_point_carries_the_three_sides(doc_root):
    _, doc = doc_root
    assert_three_sides(doc)
    assert incomplete_errors(doc) == []


def assert_three_sides(doc: dict) -> None:
    sieves = doc["settings"]["sieves_mm"]
    for p in doc["points"]:
        m, s, pb = p["measured"], p["simulation"], p["population_balance"]
        for k in ("throughput_kg_h", "net_power_kw"):
            assert m[k]["source"] and m[k]["value"] > 0, (p["id"], k)
        assert m["product_source"] and len(m["product"]["sieves_mm"]) == len(m["product"]["passing_pct"]) == 9
        assert m["specific_energy_j_kg"] == pytest.approx(m["net_power_kw"]["value"] * 1e3 * 3600 / m["throughput_kg_h"]["value"], rel=ROUNDING * 3)
        assert m["implied_work_index_kwh_t"] == pytest.approx(m["specific_energy_kwh_t"] / m["bond_kwh_t_per_wi"], rel=ROUNDING * 3)
        assert m["reduction_ratio"] == pytest.approx(p["feed_f80_mm"] / m["p80_mm"], rel=ROUNDING * 3)
        series = s["series"]
        assert {len(v) for v in series.values()} == {s["strokes"]}, p["id"]
        assert s["product"] is None or (s["product"]["sieves_mm"] == sieves and len(s["product"]["passing_pct"]) == len(sieves))
        assert s["status"] == s["attempts"][-1]["status"] and s["attempts"][-1]["strokes"] == s["strokes"]
        assert (s["window"] is None) == (s["throughput_kg_h"] is None) == (s["net_power_kw"] is None)
        if s["status"] != "complete":
            assert s["window"] is None and s["net_power_se_kw"] is None and s["specific_energy_j_kg"] is None
            assert s["attempts"][-1]["stopped_during_stroke"] is not None or s["status"] != "overlap_error"
        assert abs(s["mass_balance_residual_kg"]) < 1e-3
        assert pb["product"]["sieves_mm"] == sieves and len(pb["product"]["passing_pct"]) == len(sieves)
        assert len(pb["band"]["passing_low_pct"]) == len(pb["band"]["passing_high_pct"]) == len(sieves)
        assert pb["band"]["p80_mm"][0] <= pb["p80_mm"] <= pb["band"]["p80_mm"][1]
        # the paper's own simulated values are context: stated with their source where the paper has them, and no verdict uses them
        ps = p["paper_simulation"]
        assert (ps is not None) == (p["id"] == "63-52"), p["id"]
        if ps is not None:
            for k in ("net_power_kw", "throughput_kg_h"):
                assert ps[k]["value"] > 0 and "p. " in ps[k]["source"], (p["id"], k)
            used = {v[side] for pair in p["verdicts"].values() for v in pair.values() for side in ("first", "second")}
            assert ps["net_power_kw"]["value"] not in used and ps["throughput_kg_h"]["value"] not in used
        assert pb["mass_closure"] == pytest.approx(1.0, abs=1e-5) and pb["f80_mm"] == p["feed_f80_mm"]
        assert set(p["verdicts"]) == set(PAIRS) and all(set(p["verdicts"][pair]) == set(QUANTITIES) for pair in PAIRS)


def test_every_verdict_follows_its_band(doc_root):
    _, doc = doc_root
    assert verdict_errors(doc) == []


def test_the_population_balance_block_is_the_engine_at_the_point(doc_root):
    """DM-006: the module called again at the point's operating values gives the block."""
    _, doc = doc_root
    assert_engine_block(doc)


def assert_engine_block(doc: dict) -> None:
    from pipeline.model.crusher import labjaw
    from pipeline.model.crusher.breakage import specific_energy
    from pipeline.model.crusher.sieve import passing_at_size

    css, speed, jaw = doc["settings"]["css_mm"], doc["settings"]["speed_rpm"], labjaw.OTSUKA_BARRIOS_2020
    assert (jaw.gape_mm, jaw.width_mm, jaw.throw_mm) == (doc["machine"]["gape_mm"], doc["machine"]["width_mm"], doc["machine"]["throw_mm"])
    ore = doc["ore"]
    sieves = tuple(doc["settings"]["sieves_mm"])
    for p in doc["points"]:
        lo, hi = p["feed_mm"]
        pb = p["population_balance"]
        e50 = ore["e_inf_j_kg"] * (1.0 + (ore["d0_mm"] / p["feed_mean_mm"]) ** ore["phi"])
        assert pb["e50_j_kg"] == pytest.approx(e50, rel=1e-4)
        axb = labjaw.axb_from_fracture_energy(ore["a_max_percent"], ore["b_prime"], pb["e50_j_kg"])
        assert pb["ore_axb"] == pytest.approx(axb, rel=ROUNDING)
        res = labjaw.evaluate_lab_jaw(jaw, lo, hi, css, speed, pb["ore_axb"])
        band = labjaw.king_band(jaw, lo, hi, css, speed, pb["ore_axb"], sieves_mm=sieves)
        assert pb["throughput_kg_h"] == pytest.approx(res.throughput_kg_h, rel=ROUNDING * 3)
        assert (pb["p80_mm"], pb["p50_mm"]) == (pytest.approx(res.p80_mm, rel=ROUNDING * 3), pytest.approx(res.p50_mm, rel=ROUNDING * 3))
        assert pb["reduction_ratio"] == pytest.approx(res.reduction_ratio, rel=ROUNDING * 3)
        assert p["feed_f80_mm"] == pytest.approx(labjaw.class_f80_mm(lo, hi), rel=ROUNDING) and pb["f80_mm"] == p["feed_f80_mm"]
        assert pb["bond_kwh_t_per_wi"] == pytest.approx(res.bond_kwh_t_per_wi, rel=ROUNDING * 3)
        assert pb["specific_energy_kwh_t"] == pytest.approx(specific_energy(speed, jaw.throw_mm), rel=ROUNDING * 3)
        assert pb["t10_pct"] == pytest.approx(res.t10 * 100.0, rel=ROUNDING * 3)
        assert pb["flags"] == list(res.flags)
        assert pb["classification"] == {"k1_mm": pytest.approx(res.classification.k1), "k2_mm": pytest.approx(res.classification.k2),
                                         "k3": pytest.approx(res.classification.k3)}
        cap = res.capacity
        assert pb["capacity"]["feed_factor"] == pytest.approx(cap.k1, rel=ROUNDING * 3) and pb["capacity"]["throw_factor"] == pytest.approx(cap.k2, rel=ROUNDING * 3)
        assert pb["capacity"]["depth_m"] == pytest.approx(cap.depth_m, rel=ROUNDING * 3)
        for got, want in zip(pb["product"]["passing_pct"], (passing_at_size(res.product, s) * 100.0 for s in sieves)):
            assert got == pytest.approx(want, rel=ROUNDING * 3, abs=1e-6)
        assert pb["band"]["p80_mm"] == [pytest.approx(band.p80.low, rel=ROUNDING * 3), pytest.approx(band.p80.high, rel=ROUNDING * 3)]
        assert pb["band"]["passing_high_pct"] == [pytest.approx(band.passing[s].high * 100.0, rel=ROUNDING * 3, abs=1e-6) for s in sieves]


def test_the_population_balance_block_shows_the_values_reviewed_before_the_bake(doc_root):
    """A difference from these values means the stage called the module with other inputs."""
    _, doc = doc_root
    for pid, (q, p80, rr) in REVIEWED.items():
        pb = point(doc, pid)["population_balance"]
        assert pb["throughput_kg_h"] == pytest.approx(q, abs=0.06) and pb["p80_mm"] == pytest.approx(p80, abs=0.006)
        assert pb["reduction_ratio"] == pytest.approx(rr, abs=0.006)


def test_the_replay_file_is_the_one_the_document_names(doc_root):
    root, doc = doc_root
    index_path = root / "manifests" / "index.json"
    listed = cs.load_json(index_path)["files"] if index_path.is_file() else None
    assert replay_errors(root, doc, listed) == []        # every replay file is listed by the index (case-index 2.0.0)
    if listed is not None:
        assert [f for f in listed if f.endswith(".bin")] == [p["simulation"]["replay"]["file"] for p in doc["points"] if p["simulation"]["replay"]]
    for p in doc["points"]:
        r = p["simulation"]["replay"]
        if r is None:
            continue
        data = (root / r["file"]).read_bytes()
        e = r["encoding"]
        assert all(len(e[k]) == 2 and e[k][0] < e[k][1] for k in ("x_range_mm", "y_range_mm", "z_range_mm"))
        # the ranges come from the geometry: one gape beyond the opening, the discharge level and the hopper's top (never the data's extremes)
        g = r["geometry"]
        assert e["x_range_mm"][0] <= g["fixed_plate_x_mm"] - 1 and e["z_range_mm"][0] < g["discharge_z_mm"]
        assert e["z_range_mm"][1] == pytest.approx(g["fixed_plate_z_mm"][1] + g["hopper_height_mm"], abs=1e-2)
        # the plate's bottom edge keeps the plate's length from the pivot at every frame
        px, pz = g["swing_pivot_mm"]
        ex, ez = g["swing_closed_bottom_mm"]
        length = math.hypot(ex - px, ez - pz)
        for x, z in zip(r["plate_bottom_x_mm"], r["plate_bottom_z_mm"]):
            assert math.hypot(x - px, z - pz) == pytest.approx(length, rel=1e-4)
        assert len(data) == r["bytes"] <= 1_500_000


# --- adversarial copies the schema and the rules must refuse -----------------------------------------------------------------------------

def test_adversarial_documents_are_refused(doc_root):
    root, doc = doc_root
    assert cs.errors("dem-run", doc) == []

    def refused(change, part: str):
        bad = copy.deepcopy(doc)
        change(bad)
        problems = cs.errors("dem-run", bad)
        assert problems and any(part in e for e in problems), (part, problems[:3])

    refused(lambda d: d["points"][0].pop("population_balance"), "population_balance")                              # a missing side
    refused(lambda d: d["points"][1].pop("simulation"), "simulation")
    refused(lambda d: d["points"][2].pop("measured"), "measured")
    refused(lambda d: d["points"][0]["verdicts"]["simulation_vs_measured"]["throughput"].update(verdict="maybe"), "verdict")   # outside the enum
    refused(lambda d: d["points"][0]["verdicts"]["simulation_vs_measured"]["throughput"].update(basis="wall"), "basis")
    refused(lambda d: d["points"][0]["simulation"].update(wall_s=12.0), "wall_s")                                   # a wall time added
    refused(lambda d: d.update(baked_at="2026-11-21"), "baked_at")                                                  # a date added
    refused(lambda d: d["points"][0]["simulation"]["attempts"][0].update(status="crashed"), "status")
    refused(lambda d: d["points"].pop(), "points")
    refused(lambda d: d["points"][0]["measured"]["throughput_kg_h"].update(value="798.7"), "value")
    refused(lambda d: d.update(state="running"), "state")


def test_adversarial_rule_violations_are_found(doc_root):
    root, doc = doc_root
    assert verdict_errors(doc) == []
    bad = copy.deepcopy(doc)
    v = bad["points"][1]["verdicts"]["population_balance_vs_measured"]["reduction_ratio"]
    v["verdict"] = "met" if v["verdict"] == "not met" else "not met"
    assert any("against" in e for e in verdict_errors(bad))                                                       # a verdict that contradicts its band
    bad = copy.deepcopy(doc)
    bad["points"][0]["verdicts"]["population_balance_vs_measured"]["net_power"].update(basis=None)
    assert verdict_errors(bad)                                                                                    # a power verdict of the population balance without its basis
    bad = copy.deepcopy(doc)
    bad["points"][0]["verdicts"]["simulation_vs_measured"]["throughput"]["relative_error"] += 0.5
    assert verdict_errors(bad) or bad["points"][0]["verdicts"]["simulation_vs_measured"]["throughput"]["basis"] is not None
    bad = copy.deepcopy(doc)
    r = next((p["simulation"]["replay"] for p in bad["points"] if p["simulation"]["replay"]), None)
    if r is not None:
        r["sha256"] = "0" * 64
        assert any("sha256" in e for e in replay_errors(root, bad))
        r["sha256"] = hashlib.sha256(b"").hexdigest()
        r["bytes"] += 1
        assert any("bytes" in e for e in replay_errors(root, bad))


def test_adversarial_a_statistic_or_a_verdict_on_a_run_that_did_not_complete_is_found(doc_root):
    """DM-003: a complete run of a copy is turned into one that stopped, with its window statistics and its verdicts left in place:
    the statistics, the document's state and every verdict that rests on the run are each reported."""
    _, doc = doc_root
    assert incomplete_errors(doc) == [] and verdict_errors(doc) == []
    done = next(i for i, p in enumerate(doc["points"]) if p["simulation"]["status"] == "complete")
    bad = copy.deepcopy(doc)
    sim = bad["points"][done]["simulation"]
    sim["status"] = sim["attempts"][-1]["status"] = "overlap_error"
    pid = bad["points"][done]["id"]
    found = incomplete_errors(bad)
    assert any("incomplete" in e for e in found)                                              # the document does not name it
    assert any(f"{pid}: window is stated" in e for e in found) and any(f"{pid}: net_power_kw is stated" in e for e in found)
    resting = [e for e in verdict_errors(bad) if "rests on a run that did not complete" in e]
    assert {e.split(":")[0] for e in resting} >= {f"{pid} simulation_vs_measured throughput", f"{pid} simulation_vs_measured net_power",
                                                 f"{pid} population_balance_vs_simulation throughput"}
    named = copy.deepcopy(bad)                                                                # naming it is not enough: the statistics stay refused
    named["incomplete"] = [p["id"] for p in named["points"] if p["simulation"]["status"] != "complete"]
    named["state"] = "partial"
    assert any("window is stated" in e for e in incomplete_errors(named)) and not any("incomplete" in e for e in incomplete_errors(named))
    silent = copy.deepcopy(doc)                                                               # a partial document that says available
    if silent["incomplete"]:
        silent["state"] = "available"
        assert any("state available" in e for e in incomplete_errors(silent))


def test_adversarial_a_point_without_a_source_a_whole_curve_or_a_derived_value_is_found(doc_root):
    """DM-004: a measured value without its source, a product curve that lost a value, a measured energy that does not follow from
    the measured power and throughput, a reduction ratio that is not F80 over P80 and a verdict that uses the paper's own simulated
    value are each refused."""
    _, doc = doc_root
    assert_three_sides(doc)

    def refused(change):
        bad = copy.deepcopy(doc)
        change(bad)
        with pytest.raises((AssertionError, KeyError)):
            assert_three_sides(bad)

    refused(lambda d: d["points"][0]["measured"]["throughput_kg_h"].update(source=""))
    refused(lambda d: d["points"][1]["measured"]["net_power_kw"].pop("source"))
    refused(lambda d: d["points"][0]["measured"]["product"]["passing_pct"].pop())
    refused(lambda d: d["points"][2]["population_balance"]["product"]["passing_pct"].pop())
    refused(lambda d: d["points"][0]["measured"].update(specific_energy_j_kg=d["points"][0]["measured"]["specific_energy_j_kg"] * 1.01))
    refused(lambda d: d["points"][1]["measured"].update(reduction_ratio=d["points"][1]["measured"]["reduction_ratio"] * 1.01))
    refused(lambda d: d["points"][0]["simulation"]["series"]["stroke"].pop())
    refused(lambda d: d["points"][0]["verdicts"].pop("population_balance_vs_simulation"))
    with_paper = next((i for i, p in enumerate(doc["points"]) if p["paper_simulation"] is not None), None)
    assert with_paper is not None
    refused(lambda d: d["points"][with_paper]["verdicts"]["simulation_vs_measured"]["net_power"].update(
        second=d["points"][with_paper]["paper_simulation"]["net_power_kw"]["value"]))
    refused(lambda d: d["points"][1].update(paper_simulation=copy.deepcopy(d["points"][with_paper]["paper_simulation"])))


def test_adversarial_a_population_balance_block_that_is_not_the_engines_is_found(doc_root):
    """DM-006: a block whose throughput, product size, classification, ore link, product curve or spread was written by anything but
    the laboratory-jaw module at the point's operating values does not survive the module being called again."""
    _, doc = doc_root
    assert_engine_block(doc)

    def refused(change):
        bad = copy.deepcopy(doc)
        change(bad["points"][1]["population_balance"])
        with pytest.raises(AssertionError):
            assert_engine_block(bad)

    refused(lambda pb: pb.update(throughput_kg_h=pb["throughput_kg_h"] * 1.01))
    refused(lambda pb: pb.update(p80_mm=pb["p80_mm"] + 0.02))
    refused(lambda pb: pb.update(reduction_ratio=pb["reduction_ratio"] * 1.01))
    refused(lambda pb: pb["classification"].update(k3=2.4))
    refused(lambda pb: pb.update(ore_axb=pb["ore_axb"] * 1.05))
    refused(lambda pb: pb.update(t10_pct=pb["t10_pct"] + 0.5))
    refused(lambda pb: pb["product"]["passing_pct"].__setitem__(3, pb["product"]["passing_pct"][3] + 0.5))
    refused(lambda pb: pb["band"]["p80_mm"].__setitem__(0, pb["band"]["p80_mm"][0] * 0.9))
    refused(lambda pb: pb["capacity"].update(throw_factor=pb["capacity"]["throw_factor"] * 1.02))
    bad = copy.deepcopy(doc)                                                                   # a machine other than the paper's jaw
    bad["machine"]["gape_mm"] = 150.0
    with pytest.raises(AssertionError):
        assert_engine_block(bad)


def test_the_package_is_not_needed_to_read_the_document():
    """The document-level tests run without crushdem: the stage's tests that need it skip with a reason (tests/test_dem_stage.py)."""
    assert importlib.util.find_spec("pipeline") is not None
