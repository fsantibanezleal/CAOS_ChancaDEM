"""Train the two learned ONNX models on the Latin-hypercube sweep of the live crusher engine, and export them
for in-browser inference (onnxruntime-web):

  • SURROGATE — a small MLP that emulates the (cheap, analytic) Whiten+Evertsson+Bond engine: operating
    parameters → product P80/P50/P20, %-passing at {1,4,8,16,32} mm, throughput, power, in a single forward
    pass. It gives an instant, differentiable what-if the closed-form grid cannot give live, and an honest
    benchmark (it emulates the physics it is measured against, NOT a real plant).
  • PSD AUTOENCODER — a denoising autoencoder over the product-gradation signature; its reconstruction error is
    an operating-anomaly score that DOUBLES as the surrogate's out-of-distribution guard (a query far from the
    training manifold reconstructs poorly → "the surrogate is extrapolating, distrust it").

The feature encoding here is the SINGLE SOURCE OF TRUTH the web app reproduces (src/lib/ort.ts + the engine).
A frozen scaler.json applies identical z-scoring at train and inference time (the #1 ONNX deployment bug is a
train/serve scaling mismatch); a PyTorch↔onnxruntime parity check guards it.

Run:  python train.py        (after `node --import tsx tools/sweep/gen_sweep.mjs` has produced the datasets)
"""
from __future__ import annotations
import os, json, math, numpy as np, torch, torch.nn as nn

torch.manual_seed(0); np.random.seed(0)
HERE = os.path.dirname(__file__)
SWEEP = os.path.abspath(os.path.join(HERE, "..", "sweep"))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public"))
os.makedirs(OUT, exist_ok=True)

MACHINES = ["cone-sec", "cone-tert", "jaw"]
CONT = ["cssMm", "throwMm", "speedRpm", "feedX63Mm", "feedM", "oreAxb"]   # 6 continuous inputs (z-scored)
# 10 surrogate outputs; sizes predicted in log10-space (positivity + lower MAPE over ~a decade), then z-scored.
OUTS = ["p80", "p50", "p20", "pass1", "pass4", "pass8", "pass16", "pass32", "tph", "kW"]
LOG_OUT = {"p80", "p50", "p20"}
# 14 AE features (the product-gradation signature) — all available live from the engine result.
AE_FEATS = ["p80L", "p50L", "p20L", "pass1", "pass4", "pass8", "pass16", "pass32", "tph", "kW", "reduction", "f80L", "ecs", "feedM"]


def load(name):
    rows = [json.loads(l) for l in open(os.path.join(SWEEP, name)) if l.strip()]
    return [r for r in rows if r.get("valid")]


def enc_in(rows):
    X = np.zeros((len(rows), 9), np.float32)
    for i, r in enumerate(rows):
        X[i, MACHINES.index(r["machine"])] = 1.0
        for j, k in enumerate(CONT):
            X[i, 3 + j] = r[k]
    return X


def enc_out(rows):
    Y = np.zeros((len(rows), 10), np.float32)
    for i, r in enumerate(rows):
        for j, k in enumerate(OUTS):
            v = r[k]
            Y[i, j] = math.log10(max(v, 1e-6)) if k in LOG_OUT else v
    return Y


def enc_ae(rows):
    A = np.zeros((len(rows), 14), np.float32)
    for i, r in enumerate(rows):
        A[i] = [math.log10(max(r["p80"], 1e-6)), math.log10(max(r["p50"], 1e-6)), math.log10(max(r["p20"], 1e-6)),
                r["pass1"], r["pass4"], r["pass8"], r["pass16"], r["pass32"], r["tph"], r["kW"],
                r["reduction"], math.log10(max(r["f80"], 1e-6)), r["ecs"], r["feedM"]]
    return A


class Surrogate(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(9, 64), nn.GELU(), nn.Linear(64, 64), nn.GELU(),
                                 nn.Linear(64, 32), nn.GELU(), nn.Linear(32, 10))

    def forward(self, x):
        return self.net(x)


class AE(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc = nn.Sequential(nn.Linear(14, 16), nn.GELU(), nn.Linear(16, 6), nn.GELU())
        self.dec = nn.Sequential(nn.Linear(6, 16), nn.GELU(), nn.Linear(16, 14))

    def forward(self, x):
        return self.dec(self.enc(x))


def zstats(M):
    mu = M.mean(0); sd = M.std(0); sd[sd < 1e-8] = 1.0
    return mu.astype(np.float32), sd.astype(np.float32)


def main():
    tr, te = load("cz-sweep.jsonl"), load("cz-sweep-test.jsonl")
    print(f"train {len(tr)} | test {len(te)}")

    Xtr, Ytr = enc_in(tr), enc_out(tr)
    Xte, Yte = enc_in(te), enc_out(te)
    # input z-scoring: only the 6 continuous dims (one-hot stays 0/1)
    xmu, xsd = zstats(Xtr[:, 3:]); ymu, ysd = zstats(Ytr)
    def zin(X):
        Z = X.copy(); Z[:, 3:] = (X[:, 3:] - xmu) / xsd; return Z
    Ztr, Zte = zin(Xtr), zin(Xte)
    Wtr = (Ytr - ymu) / ysd

    # ---- train surrogate ----
    sur = Surrogate(); opt = torch.optim.Adam(sur.parameters(), 2e-3, weight_decay=1e-5)
    xt, yt = torch.tensor(Ztr), torch.tensor(Wtr)
    for ep in range(500):
        opt.zero_grad(); loss = ((sur(xt) - yt) ** 2).mean(); loss.backward(); opt.step()
        if ep % 100 == 0: print(f"  surrogate ep{ep} mse {loss.item():.4f}")

    # ---- held-out metrics in ORIGINAL units (inverse-transform) ----
    sur.eval()
    with torch.no_grad():
        pred_z = sur(torch.tensor(Zte)).numpy()
    pred = pred_z * ysd + ymu
    def inv(col, name):
        return np.power(10.0, col) if name in LOG_OUT else col
    metrics = {}
    for j, name in enumerate(OUTS):
        p = inv(pred[:, j], name); t = inv(Yte[:, j], name)
        ss_res = float(np.sum((p - t) ** 2)); ss_tot = float(np.sum((t - t.mean()) ** 2))
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
        nz = np.abs(t) > 1e-6
        mape = float(np.mean(np.abs((p[nz] - t[nz]) / t[nz])) * 100) if nz.any() else 0.0
        metrics[name] = {"r2": round(r2, 4), "mape_pct": round(mape, 3)}
        print(f"  {name:7s} R2 {r2:.4f}  MAPE {mape:.2f}%")

    # ---- monotonicity check: P80 must rise with CSS (manifest CI gate) ----
    base = {"machine": "cone-sec", "cssMm": 16, "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55}
    css_grid = [12, 20, 32, 50, 80]
    def predict_one(op):
        x = np.zeros((1, 9), np.float32); x[0, MACHINES.index(op["machine"])] = 1
        for j, k in enumerate(CONT): x[0, 3 + j] = op[k]
        x[:, 3:] = (x[:, 3:] - xmu) / xsd
        with torch.no_grad(): z = sur(torch.tensor(x)).numpy()[0]
        v = z * ysd + ymu
        return float(10 ** v[0])      # p80
    p80s = [predict_one({**base, "cssMm": c}) for c in css_grid]
    mono = all(p80s[i] >= p80s[i - 1] - 1e-3 for i in range(1, len(p80s)))
    print(f"  surrogate P80 vs CSS {['%.1f' % p for p in p80s]}  monotone={mono}")

    # ---- train denoising AE on the product-gradation signature (valid points only) ----
    Atr, Ate = enc_ae(tr), enc_ae(te)
    amu, asd = zstats(Atr)
    Sa_tr = (Atr - amu) / asd
    ae = AE(); opt2 = torch.optim.Adam(ae.parameters(), 2e-3, weight_decay=1e-5)
    at = torch.tensor(Sa_tr)
    for ep in range(400):
        opt2.zero_grad()
        noisy = at + 0.05 * torch.randn_like(at)        # denoising
        loss = ((ae(noisy) - at) ** 2).mean(); loss.backward(); opt2.step()
        if ep % 100 == 0: print(f"  ae ep{ep} mse {loss.item():.4f}")
    ae.eval()
    with torch.no_grad():
        rec = ((ae(at) - at) ** 2).mean(1).numpy()
    thr = float(np.percentile(rec, 99))
    print(f"  AE recon-error: mean {rec.mean():.4f}  p99 threshold {thr:.4f}")

    # ---- export ONNX (dynamic batch) ----
    os.environ["PYTHONIOENCODING"] = "utf-8"
    sur_path = os.path.join(OUT, "surrogate.onnx")
    torch.onnx.export(sur, torch.zeros(2, 9), sur_path, dynamo=False, input_names=["x"], output_names=["y"],
                      dynamic_axes={"x": {0: "n"}, "y": {0: "n"}}, opset_version=17)
    ae_path = os.path.join(OUT, "psd-ae.onnx")
    torch.onnx.export(ae, torch.zeros(2, 14), ae_path, dynamo=False, input_names=["x"], output_names=["xr"],
                      dynamic_axes={"x": {0: "n"}, "xr": {0: "n"}}, opset_version=17)
    # int8 variant (for the honest size/latency table only — its slightly-worse MAPE is reported, never silently used)
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        quantize_dynamic(sur_path, os.path.join(OUT, "surrogate.int8.onnx"), weight_type=QuantType.QInt8)
    except Exception as e:
        print("  int8 quantization skipped:", e)

    # ---- scalers + threshold + metrics (the frozen inference contract) ----
    json.dump({
        "inputOrder": ["machine_cone-sec", "machine_cone-tert", "machine_jaw", *CONT],
        "inMean": xmu.tolist(), "inStd": xsd.tolist(),     # for the 6 continuous dims (one-hot not scaled)
        "outputOrder": OUTS, "outLog": [k in LOG_OUT for k in OUTS],
        "outMean": ymu.tolist(), "outStd": ysd.tolist(),
    }, open(os.path.join(OUT, "scaler.json"), "w"), indent=0)
    json.dump({"featOrder": AE_FEATS, "mean": amu.tolist(), "std": asd.tolist()},
              open(os.path.join(OUT, "ae_scaler.json"), "w"), indent=0)
    json.dump({"threshold_p99": round(thr, 5), "trainReconMean": round(float(rec.mean()), 5)},
              open(os.path.join(OUT, "ae_threshold.json"), "w"), indent=0)
    json.dump({"nTrain": len(tr), "nTest": len(te), "perOutput": metrics, "p80MonotoneVsCss": mono,
               "note": "Surrogate emulates the calibrated cheap physics engine, NOT a real plant. Held-out = an independent 2nd LHS draw (seed 67890), not a row-split."},
              open(os.path.join(OUT, "surrogate_metrics.json"), "w"), indent=2)

    # ---- parity: PyTorch vs onnxruntime on fixed vectors (web parity is structural via the same .onnx) ----
    import onnxruntime as ort
    sess = ort.InferenceSession(sur_path, providers=["CPUExecutionProvider"])
    probe = Zte[:5].astype(np.float32)
    with torch.no_grad(): torch_y = sur(torch.tensor(probe)).numpy()
    ort_y = sess.run(["y"], {"x": probe})[0]
    parity = float(np.max(np.abs(torch_y - ort_y)))
    print(f"  PyTorch↔onnxruntime parity max|Δ| = {parity:.2e}")
    assert parity < 1e-4, "ONNX parity exceeded tolerance"

    print("wrote surrogate.onnx, surrogate.int8.onnx, psd-ae.onnx, scaler.json, ae_scaler.json, ae_threshold.json, surrogate_metrics.json")


if __name__ == "__main__":
    main()
