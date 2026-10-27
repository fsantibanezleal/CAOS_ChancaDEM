"""The two learned model slots as released bundles: which are valid, and what answers for each (catalog rows
``surrogate-model`` and ``anomaly-model``).

A slot is RELEASED when its JSON contract validates against its schema (``docs/contracts/schemas``), its standardiser
vectors are consistent and every graph it names exists inside the models directory's parent (``data/derived``) with the
sha256 and the byte size the contract records. Anything else (a missing, unparsable or schema-invalid contract, a
missing or altered graph) makes the slot invalid: the bake records provenance ``baseline`` for it, readiness says
``training``, and the engine (surrogate) or the envelope gate (autoencoder) answers. This module is that whole
decision; the encodings come from ``pipeline.model.crusher.encoding`` and nowhere else.

A released slot answers only where its model APPLIES (``applicability``): the models emulate the uncalibrated engine over
the training ranges the contracts record (``training.input_ranges``), so a calibrated real case, or a point with an input
outside its machine's range, is answered by the slot's baseline, exactly as for an invalid bundle. The web side
(``frontend/src/lib/ort.ts``) applies the same rule; both run the same table of points in their tests.
"""
from __future__ import annotations

import hashlib
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from jsonschema import Draft202012Validator

from .crusher import CrusherResult, Operating, evaluate

if TYPE_CHECKING:  # the annotations only; numpy is imported where a model runs
    import numpy as np

# numpy and the encodings (which round to float32 with numpy) are imported inside the functions that run a model: the
# readiness document calls released_slots, and scripts/check_readiness.py runs in CI without the pipeline's dependencies.

SCHEMAS = Path(__file__).resolve().parents[3] / "docs" / "contracts" / "schemas"
FILES = {"surrogate-model": "surrogate.json", "anomaly-model": "psd-ae.json"}
SCHEMA_OF = {"surrogate-model": "surrogate-model.schema.json", "anomaly-model": "anomaly-model.schema.json"}
SURROGATE_OUTPUTS = ("p80_mm", "p50_mm", "p20_mm", "pass_1", "pass_4", "pass_8", "pass_16", "pass_32",
                     "throughput_tph", "power_kw")


class BundleError(ValueError):
    """A slot's bundle is not valid; the message names the file and the rule."""


@lru_cache(maxsize=None)
def _validator(slot: str) -> Draft202012Validator:
    schema = json.loads((SCHEMAS / SCHEMA_OF[slot]).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _graphs(slot: str, bundle: dict) -> list[dict]:
    return [bundle["graphs"]["float32"], bundle["graphs"]["int8"]] if slot == "surrogate-model" else [bundle["graph"]]


def load_bundle(slot: str, models_dir: Path) -> dict:
    """The validated contract of ``slot`` in ``models_dir``; raises ``BundleError`` naming the file otherwise."""
    models_dir = Path(models_dir)
    path = models_dir / FILES[slot]
    try:
        bundle = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BundleError(f"{path}: cannot be read as JSON ({type(exc).__name__})") from exc
    problems = sorted(e.message for e in _validator(slot).iter_errors(bundle))
    if problems:
        raise BundleError(f"{path}: fails {SCHEMA_OF[slot]}: {problems[0]}")
    standardisers = (("in_mean", "in_std", "input_order"), ("out_mean", "out_std", "output_order")) \
        if slot == "surrogate-model" else (("mean", "std", "feature_order"),)
    for mean, std, order in standardisers:
        if not (len(bundle[mean]) == len(bundle[std]) == len(bundle[order])) or not all(
                math.isfinite(v) for v in bundle[mean] + bundle[std]) or not all(s > 0 for s in bundle[std]):
            raise BundleError(f"{path}: {mean} and {std} must be finite, {std} positive, both as long as {order}")
    for g in _graphs(slot, bundle):
        gpath = models_dir.parent / g["path"]
        try:
            raw = gpath.read_bytes()
        except OSError as exc:
            raise BundleError(f"{gpath}: the graph {path.name} names is absent") from exc
        if len(raw) != g["bytes"] or hashlib.sha256(raw).hexdigest() != g["sha256"]:
            raise BundleError(f"{gpath}: bytes or sha256 differ from {path.name}")
    return bundle


def released_slots(models_dir: Path) -> dict[str, bool]:
    """``{"surrogate-model": ..., "anomaly-model": ...}``: true when the slot's contract validates and every graph it
    names exists with its sha256 and bytes."""
    out = {}
    for slot in FILES:
        try:
            load_bundle(slot, Path(models_dir))
            out[slot] = True
        except BundleError:
            out[slot] = False
    return out


@lru_cache(maxsize=16)
def _session(path: str, sha256: str):
    """One single-threaded onnxruntime session per graph (the sha256 keys the cache, so an altered graph is a new key)."""
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(path, sess_options=options, providers=["CPUExecutionProvider"])


def session_for(models_dir: Path, graph: dict):
    """The onnxruntime session of a graph record of a validated bundle."""
    return _session(str(Path(models_dir).parent / graph["path"]), graph["sha256"])


def engine_outputs(r: CrusherResult) -> dict[str, float]:
    """The surrogate's ten outputs as the engine itself gives them (the slot's baseline answer)."""
    p = r.pct_passing
    return {"p80_mm": r.p80, "p50_mm": r.p50, "p20_mm": r.p20, "pass_1": p[1], "pass_4": p[4], "pass_8": p[8],
            "pass_16": p[16], "pass_32": p[32], "throughput_tph": r.throughput_tph, "power_kw": r.power_kw}


def decode_outputs(z: np.ndarray, bundle: dict) -> np.ndarray:
    """Standardised graph outputs (rows of 10) to original units: ``z * out_std + out_mean`` then 10 ** where
    ``out_log``."""
    import numpy as np

    v = z.astype(np.float64) * np.array(bundle["out_std"]) + np.array(bundle["out_mean"])
    log = np.array(bundle["out_log"], dtype=bool)
    v[:, log] = np.power(10.0, v[:, log])
    return v


def applicability(op: Operating, bundle: dict) -> tuple[bool, list[str]]:
    """Whether the models apply to ``op`` and, when they do not, the reason codes. One rule, identical on the web side: a
    calibrated point is refused with ``["calibrated_case"]`` (the models emulate the uncalibrated engine); an uncalibrated
    point is refused with one ``"outside_training_range:<input>"`` per continuous input outside its machine's inclusive
    ``training.input_ranges`` entry, in the contract's order (a value that is not a number is outside)."""
    if op.calibrated:
        return False, ["calibrated_case"]
    ranges = bundle["training"]["input_ranges"].get(op.machine)
    if ranges is None:
        return False, ["outside_training_range:machine"]
    reasons = [f"outside_training_range:{name}" for name, (lo, hi) in ranges.items()
               if not lo <= getattr(op, name) <= hi]
    return not reasons, reasons


def surrogate_graph(op: Operating, bundle: dict, models_dir: Path) -> dict[str, float]:
    """The released graph's ten decoded outputs at ``op``, with NO applicability check: the network's raw answer, for
    showing what it does outside its domain (notebook 07-03). The views and the bake never call this; they call
    ``surrogate_predict``, which refuses a point the rule does not cover."""
    import numpy as np

    from .crusher.encoding import encode_input

    x = np.array([encode_input(op, bundle["in_mean"], bundle["in_std"])], np.float32)
    z = session_for(models_dir, bundle["graphs"]["float32"]).run(None, {"x": x})[0]
    values = decode_outputs(z, bundle)[0]
    return {k: float(v) for k, v in zip(bundle["output_order"], values)}


def surrogate_predict(op: Operating, models_dir: Path) -> tuple[dict, str]:
    """The ten decoded outputs and provenance ``real`` when the surrogate slot is released and the model applies to ``op``;
    the engine's own values and ``baseline`` when the slot is not released or the point is outside the model's domain."""
    try:
        bundle = load_bundle("surrogate-model", Path(models_dir))
    except BundleError:
        return engine_outputs(evaluate(op)), "baseline"
    if not applicability(op, bundle)[0]:
        return engine_outputs(evaluate(op)), "baseline"
    return surrogate_graph(op, bundle, Path(models_dir)), "real"


def reconstruction_score(feats: list[float], bundle: dict, sess) -> float:
    """Mean squared reconstruction error over the 14 standardised features (NaN when a feature is not finite)."""
    import numpy as np

    from .crusher.encoding import ae_input

    x = np.array([ae_input(feats, bundle["mean"], bundle["std"])], np.float32)
    xr = sess.run(None, {"x": x})[0]
    return float(np.mean((xr.astype(np.float64) - x.astype(np.float64)) ** 2))


def anomaly_graph(result: CrusherResult, bundle: dict, models_dir: Path) -> dict:
    """``{"score", "threshold", "is_anomaly"}`` from the released graph, with NO applicability check (a score that is not
    finite, from a result with no finite feature, counts as anomalous): the autoencoder's raw reading, for showing what it
    does outside its domain (notebook 07-03). The views and the bake call ``anomaly_score``."""
    from .crusher.encoding import AE_FEATURES, ae_feats

    assert len(bundle["mean"]) == AE_FEATURES
    score = reconstruction_score(ae_feats(result), bundle, session_for(models_dir, bundle["graph"]))
    threshold = bundle["threshold_p99"]
    return {"score": score, "threshold": threshold, "is_anomaly": bool(not math.isfinite(score) or score > threshold)}


def anomaly_score(result: CrusherResult, models_dir: Path) -> tuple[dict, str]:
    """``{"score", "threshold", "is_anomaly"}`` with provenance ``real`` when the anomaly slot is released and the model
    applies to the result's operating point; otherwise the envelope gate's verdict ``{"is_anomaly": out_of_envelope}``
    with ``baseline`` (the slot is not released, the point is calibrated, or an input is outside the training range)."""
    try:
        bundle = load_bundle("anomaly-model", Path(models_dir))
    except BundleError:
        return {"is_anomaly": bool(result.out_of_envelope)}, "baseline"
    if not applicability(result.op, bundle)[0]:
        return {"is_anomaly": bool(result.out_of_envelope)}, "baseline"
    return anomaly_graph(result, bundle, Path(models_dir)), "real"


__all__ = ["BundleError", "anomaly_graph", "anomaly_score", "applicability", "decode_outputs", "engine_outputs", "load_bundle", "released_slots",
           "surrogate_graph", "surrogate_predict"]
