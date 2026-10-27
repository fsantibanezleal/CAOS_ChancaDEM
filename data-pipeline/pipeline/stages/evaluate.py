"""Stage 5, evaluate (the TEST stage, heavy lane): the held-out evaluation of the two released model slots into the
``chancadem.model-metrics/v1`` document (catalog row ``model-metrics``). Held-out is an independent second Latin-hypercube
draw (seed 67890 by default), never a split of the training draw. Every number is computed here, on the held-out draw,
through onnxruntime on the SHIPPED graphs (the float32 and the int8 one), against the canonical Python engine; torch is
not used here.

Surrogate: per-output R2 and MAPE in original units (float32 graph, and MAPE of the int8 graph), the parity of the trained
torch module against the float32 graph (measured by the train stage, read from the contract) and of float32 against int8 (maximum absolute difference of the standardised outputs), and the
monotonicity of P80 in the closed-side setting on every machine. Autoencoder: false-alarm rate on the held-out points,
detection rate on planted off-manifold points, beside the envelope gate's rates on the same points.

``run`` refuses (a ``ValueError`` naming the file) to score a slot whose bundle is invalid. Deterministic: a rerun on the
same graphs reproduces the document byte for byte.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..io.formats import write_json
from ..model import sweep
from ..model.bundles import decode_outputs, load_bundle, reconstruction_score, session_for
from ..model.crusher import CrusherResult, Operating, evaluate
from ..model.crusher.encoding import ae_feats, encode_input
from .train import target_vector

MONOTONE_POINTS = 16          # closed-side settings per machine and base point
MONOTONE_TOLERANCE_MM = 1e-3  # a P80 may not fall by more than this when CSS opens (float noise of the graph)
BASE_QUANTILES = (0.25, 0.5, 0.75)   # the other five inputs sit at these fractions of the machine's range
PLANT_FACTOR = 0.5            # upward move: this fraction of the range width beyond the upper bound; downward: this fraction of the lower bound


def r2_mape(pred: np.ndarray, truth: np.ndarray) -> tuple[float, float]:
    """R squared and MAPE [%] of ``pred`` against ``truth``; R squared is 0 when ``truth`` has no variance, and the MAPE is
    taken over the points where ``truth`` is not zero."""
    ss_res = float(np.sum((pred - truth) ** 2))
    ss_tot = float(np.sum((truth - truth.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    nz = np.abs(truth) > 1e-6
    mape = float(np.mean(np.abs((pred[nz] - truth[nz]) / truth[nz])) * 100) if nz.any() else 0.0
    return r2, mape


def monotonicity_check(bundle: dict, sess) -> tuple[bool, int]:
    """P80 must not fall as CSS opens: per machine, at three base points of the other inputs, over a grid of CSS across
    the machine's range. Returns the verdict and the number of curves checked."""
    cont = list(sweep.CONTINUOUS)
    curves = 0
    for machine in sweep.MACHINES:
        rng = sweep.RANGES[machine]
        for q in BASE_QUANTILES:
            base = {k: rng[k][0] + q * (rng[k][1] - rng[k][0]) for k in cont}
            ops = []
            for t in np.linspace(0.0, 1.0, MONOTONE_POINTS):
                v = {**base, "css_mm": rng["css_mm"][0] + float(t) * (rng["css_mm"][1] - rng["css_mm"][0])}
                ops.append(Operating(machine=machine, ore_wi=sweep.wi_of_axb(v["ore_axb"]), **v))
            x = np.array([encode_input(o, bundle["in_mean"], bundle["in_std"]) for o in ops], np.float32)
            p80 = decode_outputs(sess.run(None, {"x": x})[0], bundle)[:, 0]
            curves += 1
            if np.any(np.diff(p80) < -MONOTONE_TOLERANCE_MM):
                return False, curves
    return True, curves


def planted_points(results: list[CrusherResult]) -> list[Operating]:
    """One planted off-manifold point per held-out point: its operating inputs moved outside THAT machine's training
    range, by a rule that cycles over 18 patterns by held-out index: (0..5) one input moved above the upper bound,
    (6..11) one input moved below the lower bound, (12..17) two neighbouring inputs, the first above and the second below.
    Above = upper bound + 0.5 x the range width; below = 0.5 x the lower bound. ``ore_wi`` follows the Wi rule."""
    out = []
    for i, r in enumerate(results):
        pattern = i % 18
        moves = ([(pattern, +1)] if pattern < 6 else [(pattern - 6, -1)] if pattern < 12
                 else [(pattern - 12, +1), ((pattern - 11) % 6, -1)])
        values = {k: getattr(r.op, k) for k in sweep.CONTINUOUS}
        for j, sign in moves:
            k = sweep.CONTINUOUS[j]
            lo, hi = sweep.RANGES[r.op.machine][k]
            values[k] = hi + PLANT_FACTOR * (hi - lo) if sign > 0 else PLANT_FACTOR * lo
        out.append(Operating(machine=r.op.machine, ore_wi=sweep.wi_of_axb(values["ore_axb"]), **values))
    return out


_r2_mape, _monotone, _planted = r2_mape, monotonicity_check, planted_points   # the names of the first release, until its notebooks call the public ones


def run(models_dir: Path, out_path: Path, *, version: str, test_seed: int = 67890, n_per_machine: int = 480) -> dict:
    """Write and return the ``chancadem.model-metrics/v1`` document for the bundles in ``models_dir``. Raises
    ``ValueError`` naming the file when a slot's bundle is invalid (nothing is written then)."""
    models_dir = Path(models_dir)
    sbundle = load_bundle("surrogate-model", models_dir)   # BundleError is a ValueError that names the file
    abundle = load_bundle("anomaly-model", models_dir)

    held = sweep.label(sweep.draw(n_per_machine, test_seed))
    s32 = session_for(models_dir, sbundle["graphs"]["float32"])
    s8 = session_for(models_dir, sbundle["graphs"]["int8"])
    x = np.array([encode_input(r.op, sbundle["in_mean"], sbundle["in_std"]) for r in held], np.float32)
    z32 = s32.run(None, {"x": x})[0]
    z8 = s8.run(None, {"x": x})[0]
    pred32, pred8 = decode_outputs(z32, sbundle), decode_outputs(z8, sbundle)
    raw = np.array([target_vector(r) for r in held])
    truth = raw.copy()
    log = np.array(sbundle["out_log"], dtype=bool)
    truth[:, log] = np.power(10.0, raw[:, log])

    per_output = {}
    for j, name in enumerate(sbundle["output_order"]):
        r2, mape = r2_mape(pred32[:, j], truth[:, j])
        _r2_8, mape8 = r2_mape(pred8[:, j], truth[:, j])
        per_output[name] = {"r2": round(r2, 4), "mape_pct": round(mape, 3), "mape_pct_int8": round(mape8, 3)}

    if "export_parity_max_abs" not in sbundle["training"]:
        raise ValueError(f"{models_dir / 'surrogate.json'}: training.export_parity_max_abs is absent; the bundle does not "
                         "record that the export preserved the trained module (retrain it)")
    parity = {"torch_vs_float32_max_abs": sbundle["training"]["export_parity_max_abs"],
              "float32_vs_int8_max_abs": float(f"{float(np.max(np.abs(z32.astype(np.float64) - z8))):.6g}")}
    mono, curves = monotonicity_check(sbundle, s32)

    sa = session_for(models_dir, abundle["graph"])
    threshold = abundle["threshold_p99"]
    scores = np.array([reconstruction_score(ae_feats(r), abundle, sa) for r in held])
    alarm = ~np.isfinite(scores) | (scores > threshold)
    planted = [evaluate(op) for op in planted_points(held)]
    planted = [r for r in planted if all(np.isfinite(ae_feats(r)))]
    pscores = np.array([reconstruction_score(ae_feats(r), abundle, sa) for r in planted])
    detected = ~np.isfinite(pscores) | (pscores > threshold)

    doc = {
        "schema": "chancadem.model-metrics/v1",
        "engine_version": version,
        "surrogate": {
            "n_train": sbundle["training"]["n_train"], "n_test": len(held), "test_seed": test_seed,
            "per_output": per_output, "p80_monotone_vs_css": bool(mono), "parity": parity,
            "note": ("The surrogate emulates the canonical Python engine (a calibrated cheap physics model), not a real plant. "
                     f"Held-out is an independent second Latin-hypercube draw (seed {test_seed}, {n_per_machine} points per "
                     "machine, degenerate draws dropped), not a split of the training draw. R2 and MAPE are in original "
                     "units, computed through onnxruntime on the shipped float32 graph (MAPE also on the int8 graph). "
                     "Parity is the maximum absolute difference of the standardised outputs on the held-out draw. "
                     "torch_vs_float32 is the trained torch module against the exported float32 graph, measured by the train "
                     "stage right after export, before the module was discarded, and carried in the surrogate contract "
                     "(training.export_parity_max_abs); float32_vs_int8 is the float32 graph against the dynamically "
                     "quantised one, measured here through onnxruntime. The int8 graph's worst standardised difference is "
                     "larger, while its MAPE stays within about half a point of the float32 one. Monotonicity: P80 does not fall by more than "
                     f"{MONOTONE_TOLERANCE_MM:g} mm as CSS opens, on {curves} curves ({MONOTONE_POINTS} settings across each "
                     "machine's range at the 25%, 50% and 75% points of its other inputs).")},
        "anomaly": {
            "n_heldout": len(held), "false_alarm_rate": round(float(alarm.mean()), 4), "n_planted": len(planted),
            "detection_rate": round(float(detected.mean()), 4),
            "envelope_false_alarm_rate": round(float(np.mean([r.out_of_envelope for r in held])), 4),
            "envelope_detection_rate": round(float(np.mean([r.out_of_envelope for r in planted])), 4),
            "planted": ("One planted point per held-out point, its operating inputs moved outside that machine's training range "
                        "and then run through the engine: by held-out index modulo 18, one of the six continuous inputs "
                        "(CSS, throw, speed, feed x63, feed m, ore A*b) moved above its upper bound by half the range width "
                        "(patterns 0 to 5), one moved below its lower bound to half the bound (6 to 11), or two neighbouring "
                        "inputs moved, the first above and the second below (12 to 17); ore_wi follows the A*b rule. Points "
                        "whose engine result has a non-finite feature are left out."),
            "note": (f"Alarm threshold: {threshold} (the 99th percentile of the training scores); a score above it, or a "
                     "non-finite score, is an alarm. The envelope gate is the engine's rule check (out_of_envelope): on the "
                     "synthetic lane it flags only physically implausible inputs (CSS at or above F80, a non-positive "
                     "CSS or feed size), so a point that is physically plausible but outside the training range passes "
                     "it; the autoencoder scores distance from the training manifold, the complementary check.")},
    }
    write_json(Path(out_path), doc)
    return doc
