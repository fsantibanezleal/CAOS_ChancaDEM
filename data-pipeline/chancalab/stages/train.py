"""Stage 3 — train (OFFLINE, heavy lane): fit the surrogate MLP (Adam 2e-3, 500 ep, MSE in z-space) and the
denoising AE (Adam 2e-3, 400 ep, MSE on noised input) on the sweep. Deterministic. Requires torch (lazy)."""
from __future__ import annotations

import numpy as np


def _zstats(M: np.ndarray):
    mu = M.mean(0)
    sd = M.std(0)
    sd[sd < 1e-8] = 1.0
    return mu.astype(np.float32), sd.astype(np.float32)


def run(tr_rows: list[dict]) -> dict:
    import torch

    from ..model.psd_ae import AE
    from ..model.surrogate import Surrogate
    from .feature_extraction import NM, enc_ae, enc_in, enc_out

    torch.manual_seed(0)
    np.random.seed(0)

    Xtr, Ytr = enc_in(tr_rows), enc_out(tr_rows)
    xmu, xsd = _zstats(Xtr[:, NM:])
    ymu, ysd = _zstats(Ytr)
    Ztr = Xtr.copy()
    Ztr[:, NM:] = (Xtr[:, NM:] - xmu) / xsd
    Wtr = (Ytr - ymu) / ysd

    sur = Surrogate()
    opt = torch.optim.Adam(sur.parameters(), 2e-3, weight_decay=1e-5)
    xt, yt = torch.tensor(Ztr), torch.tensor(Wtr)
    for ep in range(500):
        opt.zero_grad()
        loss = ((sur(xt) - yt) ** 2).mean()
        loss.backward()
        opt.step()
        if ep % 100 == 0:
            print(f"  surrogate ep{ep} mse {loss.item():.4f}", flush=True)
    sur.eval()

    Atr = enc_ae(tr_rows)
    amu, asd = _zstats(Atr)
    Sa = (Atr - amu) / asd
    ae = AE()
    opt2 = torch.optim.Adam(ae.parameters(), 2e-3, weight_decay=1e-5)
    at = torch.tensor(Sa)
    for ep in range(400):
        opt2.zero_grad()
        noisy = at + 0.05 * torch.randn_like(at)
        loss = ((ae(noisy) - at) ** 2).mean()
        loss.backward()
        opt2.step()
        if ep % 100 == 0:
            print(f"  ae ep{ep} mse {loss.item():.4f}", flush=True)
    ae.eval()
    with torch.no_grad():
        rec = ((ae(at) - at) ** 2).mean(1).numpy()
    return {"surrogate": sur, "ae": ae, "xmu": xmu, "xsd": xsd, "ymu": ymu, "ysd": ysd,
            "amu": amu, "asd": asd, "rec_mean": float(rec.mean()), "thr": float(np.percentile(rec, 99))}
