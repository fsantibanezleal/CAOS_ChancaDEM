"""Stage 3, train (OFFLINE, the heavy precompute lane): fit the surrogate MLP (Adam 2e-3, 500 epochs, MSE in z-space)
and the denoising autoencoder (Adam 2e-3, 400 epochs, MSE on the input noised by 0.05) on a Latin-hypercube sweep of
the canonical Python engine, and release both: ``surrogate.onnx``, ``surrogate.int8.onnx``, ``surrogate.json``,
``psd-ae.onnx`` and ``psd-ae.json`` in ``models_dir`` (catalog rows ``surrogate-model`` and ``anomaly-model``).

The method is that of release 0.09.003 (which labelled the sweep with the TypeScript engine under Node); only the
labeller changed. A local release operation (ADR-0074): nothing here runs in CI, and the tests use the committed
graphs. Deterministic for a seed: torch is seeded and single-threaded. Requires torch, onnx and onnxruntime.
"""
from __future__ import annotations

import time
from pathlib import Path

import numpy as np

from ..io.formats import write_json
from ..model import sweep
from ..model.bundles import SURROGATE_OUTPUTS
from ..model.crusher.encoding import MACHINES, ae_feats, ae_input, encode_input

OPSET = 17
LOG_OUT = (True, True, True, False, False, False, False, False, False, False)   # p80, p50, p20 are fitted in log10
NOISE_STD = 0.05
EPOCHS_SURROGATE, EPOCHS_AE = 500, 400
FEATURE_ORDER = ["log10_p80_mm", "log10_p50_mm", "log10_p20_mm", "pass_1", "pass_4", "pass_8", "pass_16", "pass_32",
                 "throughput_tph", "power_kw", "reduction_ratio", "log10_f80_mm", "specific_energy_kwh_t", "feed_m"]


def input_ranges() -> dict:
    """The training ranges the contracts record (``training.input_ranges``): for each machine, each continuous input's
    ``[low, high]`` of the training draw, exactly ``sweep.RANGES`` (the same numbers, no rounding)."""
    return {m: {k: [sweep.RANGES[m][k][0], sweep.RANGES[m][k][1]] for k in sweep.CONTINUOUS} for m in sweep.MACHINES}


def _zstats(m: np.ndarray) -> tuple[list[float], list[float]]:
    """Column mean and standard deviation of the TRAINING matrix, as float32 values (the web stores float32)."""
    mu = m.mean(0)
    sd = m.std(0)
    sd[sd < 1e-8] = 1.0
    return [float(np.float32(v)) for v in mu], [float(np.float32(v)) for v in sd]


def target_vector(r) -> list[float]:
    """The ten training targets of a result, in the surrogate's output order: P80, P50 and P20 in log10, the percent passing
    at 1, 4, 8, 16 and 32 mm, the throughput and the power."""
    import math

    p = r.pct_passing
    raw = [r.p80, r.p50, r.p20, p[1], p[4], p[8], p[16], p[32], r.throughput_tph, r.power_kw]
    return [math.log10(max(v, 1e-6)) if lg else v for v, lg in zip(raw, LOG_OUT)]


_target = target_vector   # the name of the first release, until its notebooks call the public one


def _graph_record(path: Path, derived: Path, input_name: str, output_name: str) -> dict:
    import hashlib

    import onnx

    raw = path.read_bytes()
    opset = next(o.version for o in onnx.load(str(path)).opset_import if o.domain in ("", "ai.onnx"))
    return {"path": path.relative_to(derived).as_posix(), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
            "opset": int(opset), "input": input_name, "output": output_name}


def run(models_dir: Path, *, version: str, seed: int = 12345, n_per_machine: int = 1400,
        test_seed: int = 67890, test_n_per_machine: int = 480) -> dict:
    """Train both models and write the five files into ``models_dir`` (a folder named ``models`` inside the derived
    folder). ``test_seed`` and ``test_n_per_machine`` only size the held-out draw the contract records (``n_test``);
    the held-out metrics are computed by ``stages/evaluate.py``. Returns the paths, the sizes and the seconds."""
    import onnx  # noqa: F401  (fail early when the heavy lane is incomplete)
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic

    from ..model.psd_ae import ARCHITECTURE as AE_ARCH
    from ..model.psd_ae import AE, N_FEAT
    from ..model.surrogate import ARCHITECTURE as SUR_ARCH
    from ..model.surrogate import NIN, Surrogate

    t0 = time.time()
    models_dir = Path(models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    derived = models_dir.parent
    torch.set_num_threads(1)
    torch.manual_seed(seed)
    np.random.seed(seed)

    train = sweep.label(sweep.draw(n_per_machine, seed))
    held = sweep.label(sweep.draw(test_n_per_machine, test_seed))
    n_test = len(held)

    # standardisation statistics from the TRAINING draw only; the encodings are the browser's (encoding.py)
    cont = np.array([[getattr(r.op, k) for k in sweep.CONTINUOUS] for r in train])
    in_mean, in_std = _zstats(cont)
    x = np.array([encode_input(r.op, in_mean, in_std) for r in train], np.float32)
    y_raw = np.array([target_vector(r) for r in train])
    out_mean, out_std = _zstats(y_raw)
    y = ((y_raw - np.array(out_mean)) / np.array(out_std)).astype(np.float32)

    sur = Surrogate()
    opt = torch.optim.Adam(sur.parameters(), 2e-3, weight_decay=1e-5)
    xt, yt = torch.tensor(x), torch.tensor(y)
    for ep in range(EPOCHS_SURROGATE):
        opt.zero_grad()
        loss = ((sur(xt) - yt) ** 2).mean()
        loss.backward()
        opt.step()
        if ep % 100 == 0:
            print(f"  surrogate ep{ep} mse {loss.item():.4f}", flush=True)
    sur.eval()

    feats = np.array([ae_feats(r) for r in train])
    ae_mean, ae_std = _zstats(feats)
    a = np.array([ae_input(list(f), ae_mean, ae_std) for f in feats], np.float32)
    ae = AE()
    opt2 = torch.optim.Adam(ae.parameters(), 2e-3, weight_decay=1e-5)
    at = torch.tensor(a)
    for ep in range(EPOCHS_AE):
        opt2.zero_grad()
        loss = ((ae(at + NOISE_STD * torch.randn_like(at)) - at) ** 2).mean()
        loss.backward()
        opt2.step()
        if ep % 100 == 0:
            print(f"  ae ep{ep} mse {loss.item():.4f}", flush=True)
    ae.eval()
    with torch.no_grad():
        rec = ((ae(at) - at) ** 2).mean(1).numpy().astype(np.float64)
    threshold = float(np.percentile(rec, 99))

    # export: opset 17, a dynamic batch axis (the web feeds one row, the evaluate stage feeds the whole draw)
    paths = {name: models_dir / name for name in ("surrogate.onnx", "surrogate.int8.onnx", "psd-ae.onnx")}
    torch.onnx.export(sur, torch.zeros(2, NIN), str(paths["surrogate.onnx"]), dynamo=False, input_names=["x"],
                      output_names=["y"], dynamic_axes={"x": {0: "n"}, "y": {0: "n"}}, opset_version=OPSET)
    torch.onnx.export(ae, torch.zeros(2, N_FEAT), str(paths["psd-ae.onnx"]), dynamo=False, input_names=["x"],
                      output_names=["xr"], dynamic_axes={"x": {0: "n"}, "xr": {0: "n"}}, opset_version=OPSET)
    quantize_dynamic(str(paths["surrogate.onnx"]), str(paths["surrogate.int8.onnx"]), weight_type=QuantType.QInt8)

    # export parity, measured while the trained modules still exist: the trained torch module against the exported
    # float32 graph through onnxruntime, on the held-out draw (standardised outputs, maximum absolute difference)
    import onnxruntime as ort

    def _ort(path: Path):
        return ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])

    xh = np.array([encode_input(r.op, in_mean, in_std) for r in held], np.float32)
    ah = np.array([ae_input(ae_feats(r), ae_mean, ae_std) for r in held], np.float32)
    with torch.no_grad():
        sur_torch, ae_torch = sur(torch.tensor(xh)).numpy(), ae(torch.tensor(ah)).numpy()
    sur_onnx = _ort(paths["surrogate.onnx"]).run(None, {"x": xh})[0]
    ae_onnx = _ort(paths["psd-ae.onnx"]).run(None, {"x": ah})[0]
    sur_parity = float(np.max(np.abs(sur_torch.astype(np.float64) - sur_onnx)))
    ae_parity = float(np.max(np.abs(ae_torch.astype(np.float64) - ae_onnx)))

    torch_version = torch.__version__.split("+")[0]
    ranges = "; ".join(f"{m}: " + ", ".join(f"{k} {lo:g} to {hi:g}" for k, (lo, hi) in sweep.RANGES[m].items())
                       for m in sweep.MACHINES)
    surrogate_doc = {
        "schema": "chancadem.surrogate/v1", "engine_version": version, "machine_order": list(MACHINES),
        "input_order": list(sweep.CONTINUOUS), "in_mean": in_mean, "in_std": in_std,
        "output_order": list(SURROGATE_OUTPUTS), "out_log": list(LOG_OUT), "out_mean": out_mean, "out_std": out_std,
        "graphs": {"float32": _graph_record(paths["surrogate.onnx"], derived, "x", "y"),
                   "int8": _graph_record(paths["surrogate.int8.onnx"], derived, "x", "y")},
        "architecture": f"{SUR_ARCH}; Adam 2e-3, weight decay 1e-5, {EPOCHS_SURROGATE} full-batch epochs, MSE in z-space",
        "training": {
            "seed": seed, "n_train": len(train), "n_test": n_test,
            "sampler": (f"Latin-hypercube sweep of the canonical Python engine, {n_per_machine} points per machine "
                        f"(seed {seed}, mulberry32), each machine over its own ranges ({ranges}); ore_wi = clamp(8 + "
                        f"(120 - ore_axb) * 0.09, 8, 20); degenerate draws dropped; the held-out draw is an independent "
                        f"second Latin-hypercube draw of {test_n_per_machine} points per machine (seed {test_seed})"),
            "input_ranges": input_ranges(), "torch_version": torch_version,
            "export_parity_max_abs": float(f"{sur_parity:.6g}")},
    }
    anomaly_doc = {
        "schema": "chancadem.anomaly/v1", "engine_version": version, "feature_order": FEATURE_ORDER,
        "mean": ae_mean, "std": ae_std, "threshold_p99": round(threshold, 5),
        "train_recon_mean": round(float(rec.mean()), 5),
        "graph": _graph_record(paths["psd-ae.onnx"], derived, "x", "xr"),
        "architecture": f"{AE_ARCH}; Adam 2e-3, weight decay 1e-5, {EPOCHS_AE} full-batch epochs, MSE on the input noised "
                        f"by Gaussian noise of std {NOISE_STD}",
        "training": {"seed": seed, "n_train": len(train), "noise_std": NOISE_STD, "input_ranges": input_ranges(),
                     "torch_version": torch_version,
                     "export_parity_max_abs": float(f"{ae_parity:.6g}")},
    }
    write_json(models_dir / "surrogate.json", surrogate_doc)
    write_json(models_dir / "psd-ae.json", anomaly_doc)
    return {"models_dir": str(models_dir), "paths": {**{k: str(v) for k, v in paths.items()},
                                                     "surrogate.json": str(models_dir / "surrogate.json"),
                                                     "psd-ae.json": str(models_dir / "psd-ae.json")},
            "n_train": len(train), "n_test": n_test, "threshold_p99": anomaly_doc["threshold_p99"],
            "export_parity_max_abs": {"surrogate": surrogate_doc["training"]["export_parity_max_abs"], "anomaly": anomaly_doc["training"]["export_parity_max_abs"]},
            "seconds": round(time.time() - t0, 1)}
