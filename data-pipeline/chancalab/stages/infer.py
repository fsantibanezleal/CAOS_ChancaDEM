"""Stage 4 — infer (heavy lane): run the trained surrogate over the held-out rows in z-space and inverse-transform
to original units (the offline mirror of the in-browser surrogate path). Requires torch (lazy)."""
from __future__ import annotations

import numpy as np


def run(train_out: dict, te_rows: list[dict]) -> np.ndarray:
    import torch

    from .feature_extraction import NM, OUTS, enc_in

    sur = train_out["surrogate"]
    xmu, xsd, ymu, ysd = train_out["xmu"], train_out["xsd"], train_out["ymu"], train_out["ysd"]
    Xte = enc_in(te_rows)
    Zte = Xte.copy()
    Zte[:, NM:] = (Xte[:, NM:] - xmu) / xsd
    with torch.no_grad():
        pred_z = sur(torch.tensor(Zte.astype(np.float32))).numpy()
    pred = pred_z * ysd + ymu
    log = [k in {"p80", "p50", "p20"} for k in OUTS]
    for j, is_log in enumerate(log):
        if is_log:
            pred[:, j] = np.power(10.0, pred[:, j])
    return pred
