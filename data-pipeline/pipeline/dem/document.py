"""The document of the catalog row dem-run (``docs/contracts/schemas/dem-run.schema.json``): the measurement, the particle simulation
and the population balance at the three operating points, and their nine verdicts per point (DM-003 to DM-008).

``build`` is a pure function of the raw run records (``runs.RawRun``), the package's ``measured()`` and the laboratory-jaw module of
the canonical engine: no clock, no host, no path, no wall time, so two bakes of the same records are byte identical. The window
statistics, the verdicts and the resolved rule come from ``crushdem.comparison`` on the recorded series (``window_statistics``,
``analyse_strokes``, ``compare_with_measurement``, ``relative_error``, ``band_verdict``); the particle product on the document's sieves
is the package's ``passing_at`` and ``d_percent``. Nothing here reads the measurement into the simulation block or the population
balance block (DM-007), except the work index the measured energy implies, which the schema places in the population balance as a
reading of the measurement.

A run that ends in any state other than ``complete`` gives no window statistic and no verdict that needs one, even when the package
computed a window for it: its verdicts are ``not compared`` with the basis ``run_incomplete``; its series, its product so far and its
attempts are still recorded (DM-003). Every population-balance power verdict is ``not compared`` with the basis ``no_work_index``.
"""
from __future__ import annotations

import math
from collections.abc import Mapping
from types import SimpleNamespace

import numpy as np

from ..core.trace import r6
from ..model.crusher import labjaw
from ..model.crusher.breakage import specific_energy
from ..model.crusher.capacity import bond_power
from ..model.crusher.sieve import passing_at_size
from . import points as P
from .runs import MISSING_PACKAGE, PackageMissing, RawRun

SCHEMA = "chancadem.dem.run/v1"
KW_PER_W = 1.0e-3                 # [kW/W]
WH_PER_J = 1.0 / 3600.0           # J/kg to kWh/t: 1 kWh/t = 3600 J/kg [(kWh/t)/(J/kg)]
J_PER_KG_PER_KW_H_KG = 3600.0     # net power [W] times 3600 s/h over throughput [kg/h] is the specific energy [J/kg] [s/h]
QUANTITIES = ("throughput", "net_power", "reduction_ratio")


def _package():
    """The package's case module and comparison protocol, or a refusal that names requirements-precompute.txt."""
    try:
        from crushdem import comparison
        from crushdem.cases import barrios2020 as case
    except ImportError as exc:
        raise PackageMissing(MISSING_PACKAGE) from exc
    return case, comparison


def _round(x):
    """Six significant digits on every float (``r6``), as the pipeline's other documents; a non-finite number is refused."""
    if isinstance(x, bool):
        return x
    if isinstance(x, float):
        if not math.isfinite(x):
            raise ValueError("the document holds a number that is not finite")
        return r6(x)
    if isinstance(x, dict):
        return {k: _round(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_round(v) for v in x]
    return x


# --- the verdicts ---------------------------------------------------------------------------------------------------------------

def _not_compared(first, second, band, basis) -> dict:
    return {"first": first, "second": second, "relative_error": None, "band": band, "verdict": "not compared", "basis": basis,
            "resolved": None, "edge_distance_se": None}


def _verdict(comparison, first, second, band, resolved=None, edge=None) -> dict:
    """The band rule of the package on two values: met when the absolute relative error is within the band."""
    return {"first": first, "second": second, "relative_error": comparison.relative_error(first, second), "band": band,
            "verdict": comparison.band_verdict(first, second, band), "basis": None, "resolved": resolved, "edge_distance_se": edge}


def _plain(comparison, first, second, band, absent_basis) -> dict:
    """A verdict that rests on no window statistic: not compared with ``absent_basis`` when a value is absent, the band rule otherwise."""
    if first is None or second is None:
        return _not_compared(first, second, band, absent_basis)
    return _verdict(comparison, first, second, band)


# --- the three sides -----------------------------------------------------------------------------------------------------------------

def _measured_block(case, point: P.Point, f80: float) -> dict:
    m = case.measured(point.feed_class)
    prod = m.product
    sizes, passing = [float(s) for s in prod["sizes_mm"]], [float(v) for v in prod["passing_pct"]]
    p80 = float(np.interp(80.0, passing, sizes))                    # linear on the digitised curve, as the package's compare does
    p50 = float(np.interp(50.0, passing, sizes))
    j_kg = m.net_power_kw * 1e3 * J_PER_KG_PER_KW_H_KG / m.throughput_kg_h
    kwh_t = j_kg * WH_PER_J
    bond = bond_power(1.0, f80, p80, 1.0)
    power_noise = 0.0 if m.net_power_source.startswith("text") else m.net_power_noise_kw    # zero for a value the paper states in its text
    return {
        "throughput_kg_h": {"value": m.throughput_kg_h, "digitisation_noise": m.throughput_noise_kg_h, "source": m.throughput_source},
        "net_power_kw": {"value": m.net_power_kw, "digitisation_noise": power_noise, "source": m.net_power_source},
        "specific_energy_j_kg": j_kg, "specific_energy_kwh_t": kwh_t,
        "product": {"sieves_mm": sizes, "passing_pct": passing}, "product_source": prod["source"],
        "product_noise_pct": float(prod["noise_pct_max"]), "p80_mm": p80, "p50_mm": p50, "reduction_ratio": f80 / p80,
        "bond_kwh_t_per_wi": bond, "implied_work_index_kwh_t": kwh_t / bond,
    }


def _whole_run(rows: list[dict]) -> tuple[float | None, float | None]:
    """The whole run's throughput [kg/h] and net power [kW]: the mass passed over the run's time and the mean of the per-stroke powers."""
    if not rows:
        return None, None
    return rows[-1]["passed_kg"] / rows[-1]["t_s"] * 3600.0, float(np.mean([r["swing_plate_w"] for r in rows])) * KW_PER_W


def _simulation_block(case, comparison, point: P.Point, rec: dict, f80: float, settings: P.RunSettings, replay: dict | None) -> tuple[dict, dict]:
    """The particle simulation of a point from its raw record, and the facts the verdicts need."""
    final = rec["attempts"][rec["final_attempt"]]
    flow, prod, brk = final["flow"], final["product"], final["breakage"]
    rows = final["series"]
    complete = final["status"] == "complete"
    period = 1.0 / rec["frequency_hz"]
    min_d_m = rec["ore"]["min_diameter_m"]
    stats = comparison.window_statistics(rows, period) if (complete and rows) else {"window": None}
    window = stats["window"]
    whole_q, whole_p = _whole_run(rows)
    sim: dict = {"status": final["status"], "error": final["error"],
                 "attempts": [{"max_overlap_fraction": a["max_overlap_fraction"], "status": a["status"], "strokes": a["strokes"],
                               "stopped_during_stroke": a["stopped_during_stroke"], "max_overlap_reached": a["max_overlap_reached"],
                               "held_spheres": a["flow"]["n_hold"], "hold_up_kg": a["flow"]["hold_up_kg"],
                               "mass_passed_kg": a["flow"]["mass_out_kg"] + a["flow"]["fines_kg"],
                               "peak_particles": a["breakage"]["peak_particles"],
                               "deferred_placements": a["breakage"]["n_deferred_placement"]} for a in rec["attempts"]],
                 "capacity_slots": final["capacity"], "strokes": final["strokes"], "steps": final["steps"], "time_step_s": final["dt_s"],
                 "simulated_s": final["sim_time_s"], "mass_fed_kg": flow["mass_in_kg"], "mass_passed_kg": flow["mass_out_kg"] + flow["fines_kg"],
                 "held_spheres": flow["n_hold"], "hold_up_kg": flow["hold_up_kg"], "pending_kg": flow["pending_kg"]}
    if window is None:
        sim.update(window=None, throughput_kg_h=None, throughput_se_kg_h=None, net_power_kw=None, net_power_se_kw=None,
                   power_trend_stationary=None, specific_energy_j_kg=None, specific_energy_kwh_t=None,
                   window_strokes_above_overlap_reference=None, throughput_whole_run_kg_h=whole_q, net_power_whole_run_kw=whole_p)
    else:
        analysis = comparison.analyse_strokes(rows, period, mass_fed_kg=flow["mass_in_kg"], overlap_reference=P.OVERLAP_REFERENCE)
        sim.update(window={"first_stroke": window.first_stroke, "last_stroke": window.last_stroke, "strokes": window.n},
                   throughput_kg_h=stats["throughput"]["mean"], throughput_se_kg_h=stats["throughput"]["se"],
                   net_power_kw=stats["power"]["mean"] * KW_PER_W, net_power_se_kw=stats["power"]["se"] * KW_PER_W,
                   power_trend_stationary=stats["trend"]["stationary"], specific_energy_j_kg=stats["specific_energy_j_kg"],
                   specific_energy_kwh_t=stats["specific_energy_j_kg"] * WH_PER_J,
                   window_strokes_above_overlap_reference=analysis["window_overlap"]["n_strokes_above_reference"],
                   throughput_whole_run_kg_h=analysis["throughput_whole_run_kg_h"],
                   net_power_whole_run_kw=analysis["whole_run_mean_swing_plate_power_w"] * KW_PER_W)
    passed_any = prod["total_kg"] > 0
    if passed_any:
        at = comparison.passing_at(prod, list(P.SIEVES_MM), min_d_m)
        sizes = prod["sizes_m"]
        p80, p50 = comparison.d_percent(prod, 0.8), comparison.d_percent(prod, 0.5)
        sim.update(product={"sieves_mm": list(P.SIEVES_MM), "passing_pct": [at[f"{s:g}"] for s in P.SIEVES_MM]}, p80_mm=p80, p50_mm=p50,
                   reduction_ratio=None if not p80 else f80 / p80, fines_below_minimum_pct=prod["fines_kg"] / prod["total_kg"] * 100.0,
                   largest_product_mm=1e3 * max(sizes) if sizes else None,
                   spheres_above_open_side=sum(1 for s in sizes if s > case.OPEN_SIDE_MM * 1e-3))
    else:
        sim.update(product=None, p80_mm=None, p50_mm=None, reduction_ratio=None, fines_below_minimum_pct=None, largest_product_mm=None,
                   spheres_above_open_side=None)
    sim.update(breakage={"events": brk["n_events"], "progeny": brk["n_progeny"], "peak_particles": brk["peak_particles"],
                         "deferred_placements": brk["n_deferred_placement"], "injected_energy_j": brk["injected_energy_j"],
                         "absorbed_energy_j": brk["absorbed_energy_j"]},
               mass_balance_residual_kg=final["mass_balance_residual_kg"],
               series={"stroke": [r["stroke"] for r in rows], "t_s": [r["t_s"] for r in rows], "plate_power_w": [r["swing_plate_w"] for r in rows],
                       "passed_kg": [r["passed_kg"] for r in rows], "held": [r["n_hold"] for r in rows],
                       "hold_up_kg": [r["hold_up_kg"] for r in rows], "pending_kg": [r["pending_kg"] for r in rows],
                       "max_overlap": [r["max_overlap"] for r in rows]},
               replay=replay)
    return sim, {"complete": complete, "window": window is not None, "rows": rows, "period": period}


def _population_balance(jaw, point: P.Point, ore: dict, measured: dict, f80: float) -> dict:
    """The laboratory-jaw module of the canonical engine at the point's operating values, with the ore's own fracture energies."""
    from crushdem.breakage import median_fracture_energy

    mean_mm = labjaw.class_mean_mm(point.lower_mm, point.upper_mm)
    e50 = median_fracture_energy(mean_mm / 1000.0, SimpleNamespace(e_inf=ore["e_inf_j_kg"], d0=ore["d0_m"], phi=ore["phi"]))
    axb = labjaw.axb_from_fracture_energy(ore["a_max_percent"], ore["b_prime"], e50)
    res = labjaw.evaluate_lab_jaw(jaw, point.lower_mm, point.upper_mm, P.CSS_MM, P.SPEED_RPM, axb)
    band = labjaw.king_band(jaw, point.lower_mm, point.upper_mm, P.CSS_MM, P.SPEED_RPM, axb, sieves_mm=P.SIEVES_MM)
    cap = res.capacity
    return {
        "classification": {"k1_mm": res.classification.k1, "k2_mm": res.classification.k2, "k3": res.classification.k3},
        "e50_j_kg": e50, "ore_axb": axb, "specific_energy_kwh_t": specific_energy(P.SPEED_RPM, jaw.throw_mm), "t10_pct": res.t10 * 100.0,
        "capacity": {"depth_m": cap.depth_m, "critical_speed_rpm": cap.critical_speed_rpm,
                     "regime": "below_critical_speed" if cap.branch == "low-speed" else "at_or_above_critical_speed",
                     "volumetric_m3_h": cap.vh_m3_h, "feed_factor": cap.k1, "throw_factor": cap.k2, "material_factor": cap.k3,
                     "density_t_m3": cap.density_t_m3},
        "throughput_kg_h": res.throughput_kg_h, "f80_mm": f80, "p80_mm": res.p80_mm, "p50_mm": res.p50_mm, "reduction_ratio": res.reduction_ratio,
        "product": {"sieves_mm": list(P.SIEVES_MM), "passing_pct": [passing_at_size(res.product, s) * 100.0 for s in P.SIEVES_MM]},
        "band": {"p80_mm": [band.p80.low, band.p80.high], "p50_mm": [band.p50.low, band.p50.high],
                 "reduction_ratio": [f80 / band.p80.high, f80 / band.p80.low],
                 "passing_low_pct": [band.passing[s].low * 100.0 for s in P.SIEVES_MM],
                 "passing_high_pct": [band.passing[s].high * 100.0 for s in P.SIEVES_MM]},
        "bond_kwh_t_per_wi": res.bond_kwh_t_per_wi, "implied_work_index_kwh_t": measured["specific_energy_kwh_t"] / res.bond_kwh_t_per_wi,
        "mass_closure": float(sum(res.product.mass)), "flags": list(res.flags),
    }


def _verdicts(case, comparison, point: P.Point, meas: dict, sim: dict, pb: dict, facts: dict) -> dict:
    """The nine verdicts of a point. A verdict that rests on the particle run is not compared when the run did not complete."""
    complete, has_window = facts["complete"], facts["window"]
    bands = P.BANDS
    m_q, m_p, m_r = meas["throughput_kg_h"]["value"], meas["net_power_kw"]["value"], meas["reduction_ratio"]
    window_basis = "run_incomplete" if not complete else "no_window"
    ratio_basis = "run_incomplete" if not complete else "nothing_passed"
    s_ratio = sim["reduction_ratio"] if complete else None
    s_q = sim["throughput_kg_h"] if has_window else None
    s_p = sim["net_power_kw"] if has_window else None

    sim_vs_meas: dict = {}
    if has_window:
        ref = comparison.compare_with_measurement(facts["rows"], facts["period"], {"power": m_p * 1e3, "throughput": m_q},
                                                  {"power": bands["net_power"], "throughput": bands["throughput"]})
        for q, key, scale in (("throughput", "throughput", 1.0), ("net_power", "power", KW_PER_W)):
            r = ref[key]
            z = r["z_edge"]
            sim_vs_meas[q] = {"first": r["simulated"] * scale, "second": m_q if q == "throughput" else m_p, "relative_error": r["relative_error"],
                              "band": r["band"], "verdict": r["verdict"], "basis": None, "resolved": bool(r["resolved"]),
                              "edge_distance_se": z if math.isfinite(z) else None}
    else:
        sim_vs_meas["throughput"] = _not_compared(None, m_q, bands["throughput"], window_basis)
        sim_vs_meas["net_power"] = _not_compared(None, m_p, bands["net_power"], window_basis)
    sim_vs_meas["reduction_ratio"] = (_not_compared(None, m_r, bands["reduction_ratio"], ratio_basis) if s_ratio is None
                                      else _verdict(comparison, s_ratio, m_r, bands["reduction_ratio"]))
    pb_vs_meas = {"throughput": _verdict(comparison, pb["throughput_kg_h"], m_q, bands["throughput"]),
                  "net_power": _not_compared(None, m_p, bands["net_power"], "no_work_index"),
                  "reduction_ratio": _verdict(comparison, pb["reduction_ratio"], m_r, bands["reduction_ratio"])}
    pb_vs_sim = {"throughput": (_not_compared(pb["throughput_kg_h"], None, bands["throughput"], window_basis) if s_q is None
                                else _verdict(comparison, pb["throughput_kg_h"], s_q, bands["throughput"])),
                 "net_power": _not_compared(None, s_p, bands["net_power"], "no_work_index"),
                 "reduction_ratio": (_not_compared(pb["reduction_ratio"], None, bands["reduction_ratio"], ratio_basis) if s_ratio is None
                                     else _verdict(comparison, pb["reduction_ratio"], s_ratio, bands["reduction_ratio"]))}
    return {"simulation_vs_measured": sim_vs_meas, "population_balance_vs_measured": pb_vs_meas, "population_balance_vs_simulation": pb_vs_sim}


def build(raw_runs: Mapping[str, RawRun], version: str, replays: Mapping[str, dict] | None = None,
          settings: P.RunSettings = P.DEFAULT_SETTINGS) -> dict:
    """The document of dem-run from the raw records of the three points (a mapping from point id), the version that writes it and the
    replay blocks the stage encoded (a mapping from point id; a point without one has ``replay: null``)."""
    case, comparison = _package()
    replays = replays or {}
    first = raw_runs[P.POINTS[0].id].record
    jaw = labjaw.OTSUKA_BARRIOS_2020
    ore_rec = first["ore"]
    cls = labjaw.lab_classification(P.CSS_MM, jaw.throw_mm)
    if cls.k2 != P.OSS_MM or P.CSS_MM != cls.k1:
        raise ValueError("the laboratory preset's first estimate is no longer K1 equal to the closed side and K2 to the open side")
    ore = {"name": ore_rec["name"], "density_kg_m3": case.ORE_MATERIAL.density, "e_inf_j_kg": ore_rec["e_inf_j_kg"], "d0_mm": ore_rec["d0_m"] * 1e3,
           "phi": ore_rec["phi"], "variance": ore_rec["variance"], "gamma": ore_rec["gamma"], "a_max_percent": ore_rec["a_max_percent"],
           "b_prime": ore_rec["b_prime"], "derivation": " ".join(f"{p['name']}: {p['source']}." for p in ore_rec["provenance"])}
    backends = {a["backend"] for rr in raw_runs.values() for a in rr.record["attempts"]}
    if len(backends) != 1:
        raise ValueError(f"the runs ran on more than one backend: {sorted(backends)}")
    pts, incomplete = [], []
    for point in P.POINTS:
        raw = raw_runs[point.id]
        rec = raw.record
        f80 = labjaw.class_f80_mm(point.lower_mm, point.upper_mm)
        meas = _measured_block(case, point, f80)
        sim, facts = _simulation_block(case, comparison, point, rec, f80, settings, replays.get(point.id))
        pb = _population_balance(jaw, point, rec["ore"], meas, f80)
        if sim["status"] != "complete":
            incomplete.append(point.id)
        pts.append({"id": point.id, "feed_class": point.feed_class, "feed_mm": [point.lower_mm, point.upper_mm],
                    "feed_mean_mm": labjaw.class_mean_mm(point.lower_mm, point.upper_mm), "feed_f80_mm": f80, "measured": meas,
                    "simulation": sim, "population_balance": pb, "verdicts": _verdicts(case, comparison, point, meas, sim, pb, facts)})
    from .runs import package_version

    doc = {
        "schema": SCHEMA, "engine_version": version,
        "machine": {"name": P.MACHINE_NAME, "gape_mm": jaw.gape_mm, "width_mm": jaw.width_mm, "throw_mm": jaw.throw_mm, "source": P.MACHINE_SOURCE},
        "source": {"paper": case.PAPER["reference"], "doi": P.PAPER_DOI, "license": P.PAPER_LICENSE,
                   "digitised": f"{case.load_digitised()['method']}; {P.PAPER_PACKAGE_DATA}"},
        "package": {"name": "crushdem", "version": package_version(), "backend": next(iter(backends))},
        "seed": first["seed"],
        "bands": {"throughput_relative": P.BANDS["throughput"], "net_power_relative": P.BANDS["net_power"],
                  "reduction_ratio_relative": P.BANDS["reduction_ratio"], "set": P.BANDS_SET},
        "settings": {"css_mm": P.CSS_MM, "oss_mm": P.OSS_MM, "frequency_hz": first["frequency_hz"], "speed_rpm": 60.0 * first["frequency_hz"],
                     "batch_kg": first["mass_requested_kg"], "overlap_ladder": list(settings.overlaps), "overlap_reference": P.OVERLAP_REFERENCE,
                     "stall_strokes": settings.stall_strokes, "max_strokes": settings.max_strokes,
                     "minimum_sphere_mm": ore_rec["min_diameter_m"] * 1e3, "sieves_mm": list(P.SIEVES_MM)},
        "ore": ore,
        "preset": {"k1_over_css": cls.k1 / P.CSS_MM, "k2": "open-side setting", "k3": cls.k3, "first_estimate_source": P.PRESET_FIRST_ESTIMATE,
                   "k1_over_css_range": list(labjaw.KING_RANGES.alpha1), "k2_over_css_range": list(labjaw.KING_RANGES.alpha2),
                   "k3_range": list(labjaw.KING_RANGES.n), "ranges_source": labjaw.KING_RANGES.source, "capacity_model": P.PRESET_CAPACITY,
                   "material_factor": jaw.material_k3, "ore_link": P.PRESET_ORE_LINK, "power": P.PRESET_POWER},
        "state": "partial" if incomplete else "available", "incomplete": incomplete, "points": pts,
    }
    return _round(doc)
