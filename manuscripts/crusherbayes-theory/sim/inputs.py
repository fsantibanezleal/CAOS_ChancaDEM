"""The consumed inputs of the CrusherBayes theory harness, read once and checked: the product's fit to all ten surveys
(``data/derived/hp500/crusherbayes.json``, schema ``chancadem.hp500.crusherbayes/v1``), the survey table
(``data/examples/hp500-surveys.csv``), the reference standardization, the inputs' SHA-256 and the code commit.

Missing-data behavior (the brief): an absent document or a missing ``contraction`` row stops the run with the name of what
is missing; there is no fallback value.
"""
from __future__ import annotations

import csv
import hashlib
import math
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

import numpy as np

SIM = Path(__file__).resolve().parent
ROOT = SIM.parents[2]
for _p in (str(ROOT / "data-pipeline"), str(ROOT / "manuscripts" / "comminution-studio" / "figures")):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from pipeline.hp500 import crusherbayes as cb  # noqa: E402

FIT_PATH = ROOT / "data" / "derived" / "hp500" / "crusherbayes.json"
SURVEYS_PATH = ROOT / "data" / "examples" / "hp500-surveys.csv"
HELDOUT_PATH = ROOT / "manuscripts" / "comminution-studio" / "figures" / "heldout_uq.py"
FIT_SCHEMA = "chancadem.hp500.crusherbayes/v1"
TARGETS = cb.TARGETS


class MissingInput(RuntimeError):
    """A consumed input is absent; the message names it."""


class Fit(NamedTuple):
    theta0: np.ndarray            # the eight engine scalars, sampled scale (log of the natural value for log scalars)
    d0: dict                      # per target, the three discrepancy coefficients (constant, css, f80)
    sigma: dict                   # per target, the posterior-mean noise scale


def load_fit(path: Path = FIT_PATH) -> Fit:
    """theta_0, d_0 and sigma_t from the posterior means of the fit to all ten surveys."""
    import json
    if not Path(path).exists():
        raise MissingInput(f"missing input: {path}")
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    if doc.get("schema") != FIT_SCHEMA:
        raise MissingInput(f"{path}: schema {doc.get('schema')!r}, expected {FIT_SCHEMA}")
    rows = {r["name"]: r for r in doc.get("contraction", [])}

    def get(name: str) -> float:
        if name not in rows:
            raise MissingInput(f"{path}: missing contraction row {name!r}")
        return float(rows[name]["posterior_mean"])

    theta0 = np.array([math.log(get(p.name)) if p.log else get(p.name) for p in cb.PRIORS])
    d0 = {t: np.array([get(f"discrepancy_{t}_{term}") for term in cb.DISCREPANCY_TERMS]) for t in TARGETS}
    sigma = {t: get(f"sigma_{t}") for t in TARGETS}
    return Fit(theta0, d0, sigma)


def load_surveys(path: Path = SURVEYS_PATH) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """(CSS mm, f80 mm, throughput t/h, power kW) of the ten surveys, in the table's order."""
    if not Path(path).exists():
        raise MissingInput(f"missing input: {path}")
    with Path(path).open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    return tuple(np.array([float(r[k]) for r in rows]) for k in ("css_mm", "f80_mm", "feed_tph", "power_kw"))


def reference_standardization() -> tuple[np.ndarray, np.ndarray]:
    """The mean and population standard deviation of (CSS, f80) over the ten surveys."""
    css, f80, _, _ = load_surveys()
    return np.array([css.mean(), f80.mean()]), np.array([css.std(), f80.std()])


def digests() -> dict[str, str]:
    """SHA-256 of every consumed input file, keyed by its path relative to the repository."""
    out = {}
    for p in (FIT_PATH, SURVEYS_PATH, HELDOUT_PATH, ROOT / "VERSION"):
        out[p.relative_to(ROOT).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
    return out


def code_commit() -> str:
    """The last commit that changed the harness code (``sim/``; the code is committed before a run). Not HEAD: other work
    lands on the branch during a long run, and a summary must not depend on when it was written."""
    try:
        return subprocess.run(["git", "-C", str(ROOT), "log", "-1", "--format=%H", "--", str(SIM)], capture_output=True,
                              text=True, check=True).stdout.strip() or "unknown"
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def engine_version() -> str:
    return (ROOT / "VERSION").read_text(encoding="utf-8").strip()
