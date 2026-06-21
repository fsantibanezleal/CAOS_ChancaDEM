"""CONTRACT 1 — ingestion (raw operating point + feed PSD -> pipeline). The *bring-your-own-operating-point* gate.

Declares the required schema (columns, units, machine envelopes) of a crusher operating point and an EXPLICIT
outlier policy: a row is ACCEPTED iff it passes; physically-meaningless rows are REJECTED with a reason (never
silently coerced); out-of-envelope-but-plausible rows are FLAGGED (accepted; the surrogate is extrapolating and the
deep-AE anomaly score is the live guard). This is what lets ChancaDEM evaluate a NEW duty instead of only replaying
baked cases. Documented in data/README.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .schema import MACHINES, Operating

REQUIRED_COLUMNS: tuple[str, ...] = ("case_id", "machine", "cssMm", "throwMm", "speedRpm", "feedX63Mm", "feedM", "oreAxb")

# per-machine realistic operating envelope (matches the sweep RANGE): outside => FLAG (OOD), not reject.
ENVELOPE: dict[str, dict[str, tuple[float, float]]] = {
    "cone-sec":        {"cssMm": (6, 90),   "throwMm": (16, 44), "speedRpm": (180, 560), "feedX63Mm": (40, 200), "feedM": (0.7, 2.0), "oreAxb": (30, 110)},
    "cone-tert":       {"cssMm": (4, 22),   "throwMm": (10, 26), "speedRpm": (220, 600), "feedX63Mm": (15, 55),  "feedM": (0.9, 2.0), "oreAxb": (30, 110)},
    "cone-short-head": {"cssMm": (4, 16),   "throwMm": (10, 22), "speedRpm": (380, 600), "feedX63Mm": (15, 45),  "feedM": (0.9, 2.0), "oreAxb": (30, 110)},
    "gyratory":        {"cssMm": (120, 240),"throwMm": (22, 40), "speedRpm": (100, 200), "feedX63Mm": (300, 800),"feedM": (0.7, 1.4), "oreAxb": (30, 110)},
    "jaw":             {"cssMm": (50, 160), "throwMm": (24, 50), "speedRpm": (180, 380), "feedX63Mm": (180, 500),"feedM": (0.7, 1.6), "oreAxb": (35, 110)},
}
NUMERIC = ("cssMm", "throwMm", "speedRpm", "feedX63Mm", "feedM", "oreAxb")
CSS_INVALID_FACTOR = 2.5   # CSS > 2.5 x feed F63 => physically invalid (CSS wider than the feed top) => REJECT
FEEDM_RANGE = (0.3, 3.0)


def _wi_of(axb: float) -> float:
    return max(8.0, min(20.0, 8.0 + (120.0 - axb) * 0.09))


@dataclass
class ContractReport:
    accepted: list[Operating]
    rejected: list[dict[str, Any]]
    flagged: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return len(self.accepted) > 0

    def summary(self) -> str:
        return f"{len(self.accepted)} accepted, {len(self.rejected)} rejected, {len(self.flagged)} flagged"


def validate_records(raw_rows: list[dict[str, Any]]) -> ContractReport:
    """Apply CONTRACT 1 to raw operating-point rows (e.g. from a CSV). Pure; deterministic; no I/O."""
    accepted: list[Operating] = []
    rejected: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []

    for i, row in enumerate(raw_rows):
        cid = str(row.get("case_id", f"row{i}"))
        missing = [c for c in REQUIRED_COLUMNS if c not in row or row[c] in (None, "")]
        if missing:
            rejected.append({"row": i, "case_id": cid, "reason": f"missing/empty columns: {missing}"})
            continue
        machine = str(row["machine"])
        if machine not in MACHINES:
            rejected.append({"row": i, "case_id": cid, "reason": f"machine={machine!r} not in {list(MACHINES)}"})
            continue
        try:
            v = {k: float(row[k]) for k in NUMERIC}
        except (TypeError, ValueError):
            rejected.append({"row": i, "case_id": cid, "reason": "non-numeric value in a continuous field"})
            continue
        if any(math.isnan(x) or math.isinf(x) for x in v.values()) or any(x <= 0 for x in (v["cssMm"], v["throwMm"], v["speedRpm"], v["feedX63Mm"], v["feedM"])):
            rejected.append({"row": i, "case_id": cid, "reason": "NaN/Inf or non-positive value"})
            continue
        if v["cssMm"] > CSS_INVALID_FACTOR * v["feedX63Mm"]:
            rejected.append({"row": i, "case_id": cid, "reason": f"cssMm={v['cssMm']:g} > {CSS_INVALID_FACTOR}x feed F63={v['feedX63Mm']:g} (CSS wider than the feed top — physically invalid)"})
            continue

        env = ENVELOPE[machine]
        rec_flags: list[str] = []
        for k, (lo, hi) in env.items():
            if not (lo <= v[k] <= hi):
                rec_flags.append(f"{k}={v[k]:g} outside {machine} envelope [{lo:g},{hi:g}] — surrogate extrapolating (deep-AE anomaly is the live guard)")
        if v["cssMm"] >= v["feedX63Mm"]:
            rec_flags.append(f"cssMm={v['cssMm']:g} >= feed F63={v['feedX63Mm']:g} — pass-through regime (near-zero reduction)")
        if not (FEEDM_RANGE[0] <= v["feedM"] <= FEEDM_RANGE[1]):
            rec_flags.append(f"feedM={v['feedM']:g} outside [{FEEDM_RANGE[0]},{FEEDM_RANGE[1]}]")

        if rec_flags:
            flagged.append({"case_id": cid, "flags": rec_flags})
        wi = float(row.get("oreWi") or 0.0) or _wi_of(v["oreAxb"])
        accepted.append(Operating(case_id=cid, machine=machine, cssMm=v["cssMm"], throwMm=v["throwMm"],
                                  speedRpm=v["speedRpm"], feedX63Mm=v["feedX63Mm"], feedM=v["feedM"],
                                  oreAxb=v["oreAxb"], oreWi=wi, flags=tuple(rec_flags)))
    return ContractReport(accepted=accepted, rejected=rejected, flagged=flagged)


def validate_psd(edges_mm: list[float], passing: list[float]) -> tuple[bool, str]:
    """BYO feed-PSD guard: K+1 descending sieve edges + monotone non-decreasing cumulative passing in [0,1]."""
    if len(edges_mm) != len(passing):
        return False, f"edges ({len(edges_mm)}) and passing ({len(passing)}) length mismatch"
    if any(edges_mm[i] <= edges_mm[i + 1] for i in range(len(edges_mm) - 1)):
        return False, "sieve edges must be strictly descending (coarse -> fine)"
    if any(not (0.0 <= p <= 1.0) for p in passing):
        return False, "passing fractions must lie in [0,1]"
    if any(passing[i] < passing[i + 1] - 1e-9 for i in range(len(passing) - 1)):
        return False, "cumulative passing must be non-increasing as the aperture decreases"
    return True, ""
