"""Windows, designs and seeded pools of operating points for the CrusherBayes theory study.

A point is (CSS mm, f80 mm, speed rpm); the pools are at the HP500 lane's 360 rpm. Window "surveys" is the engine's
calibrated envelope (``envelope.py``: CSS in [38, 55] mm, f80 in [47, 140] mm); window "wide" is CSS in [25, 70] mm and f80
in [40, 140] mm with the points f80 < CSS + 10 mm rejected. A pool is a seeded set of ``POOL_SIZE`` points of a window; the
seed of each window is fixed here. Designs: "real" (the ten surveys), "surveys" and "wide" (training and test points from
the window's pool), "extrapolation" (training points from the "surveys" pool, test points from the "wide" pool's points
outside the "surveys" box).

Standardization: the predictors use the training mean and population standard deviation of CSS and f80, as the product's
``crusherbayes.design`` does; ``design_matrix`` builds the rows (1, z_c, z_f).
"""
from __future__ import annotations

import numpy as np

import inputs

SPEED_RPM = 360.0
POOL_SIZE = 4000
WINDOWS = {
    "surveys": {"css": (38.0, 55.0), "f80": (47.0, 140.0), "min_gap": None},
    "wide": {"css": (25.0, 70.0), "f80": (40.0, 140.0), "min_gap": 10.0},
}
POOL_SEEDS = {"surveys": 2026111901, "wide": 2026111902}
DESIGNS = ("real", "surveys", "wide", "extrapolation")
COND_MAX = 1e10            # a training design with cond(G) above this is redrawn and counted


def window_points(window: str, size: int = POOL_SIZE, seed: int | None = None) -> np.ndarray:
    """``size`` points uniform on the window (rejection for "wide"), seeded; rows (CSS, f80, speed)."""
    w = WINDOWS[window]
    rng = np.random.default_rng(POOL_SEEDS[window] if seed is None else seed)
    out = np.empty((0, 2))
    while out.shape[0] < size:
        c = rng.uniform(*w["css"], size)
        f = rng.uniform(*w["f80"], size)
        keep = np.ones(size, bool) if w["min_gap"] is None else f >= c + w["min_gap"]
        out = np.vstack([out, np.column_stack([c, f])[keep]])
    out = out[:size]
    return np.column_stack([out, np.full(size, SPEED_RPM)])


def survey_points() -> np.ndarray:
    """The ten surveys as points (CSS, f80, 360 rpm), in the table's order."""
    css, f80, _, _ = inputs.load_surveys()
    return np.column_stack([css, f80, np.full(css.size, SPEED_RPM)])


def in_box(points: np.ndarray, window: str = "surveys") -> np.ndarray:
    w = WINDOWS[window]
    return ((points[:, 0] >= w["css"][0]) & (points[:, 0] <= w["css"][1])
            & (points[:, 1] >= w["f80"][0]) & (points[:, 1] <= w["f80"][1]))


def standardization(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mean and population standard deviation of (CSS, f80); a zero spread is replaced by 1 as in the product."""
    mu = points[:, :2].mean(axis=0)
    sd = points[:, :2].std(axis=0)
    return mu, np.where(sd == 0, 1.0, sd)


def design_matrix(points: np.ndarray, mu: np.ndarray, sd: np.ndarray) -> np.ndarray:
    """Rows (1, z_c, z_f), the product's ``crusherbayes.design``."""
    return np.column_stack([np.ones(points.shape[0]), (points[:, 0] - mu[0]) / sd[0], (points[:, 1] - mu[1]) / sd[1]])


def train_window(design: str) -> str:
    return "wide" if design == "wide" else "surveys"


def train_pool(design: str) -> str:
    return {"real": "real", "surveys": "surveys", "wide": "wide", "extrapolation": "surveys"}[design]


def test_pool(design: str) -> str:
    return {"real": "surveys", "surveys": "surveys", "wide": "wide", "extrapolation": "wide"}[design]


def conditioned(points: np.ndarray) -> bool:
    """True when the training design's G = Z^T Z (training standardization) has a condition number at most COND_MAX."""
    Z = design_matrix(points, *standardization(points))
    return bool(np.linalg.cond(Z.T @ Z) <= COND_MAX)


def draw_design(rng: np.random.Generator, design: str, n: int, n_test: int, train_pts: np.ndarray,
                test_candidates: np.ndarray) -> tuple[np.ndarray, np.ndarray, int]:
    """Training indices (into the training pool) and test indices (into the test pool), and the number of redrawn
    ill-conditioned training designs. "real" keeps the ten surveys. The training indices are drawn first, so they do not
    depend on ``n_test``; same-pool designs draw the test points from the points not used for training."""
    redraws = 0
    if design == "real":
        train = np.arange(train_pts.shape[0])
        if not conditioned(train_pts):
            raise ArithmeticError("the ten surveys' design is ill-conditioned")
    else:
        while True:
            train = rng.choice(train_pts.shape[0], size=n, replace=False)
            if conditioned(train_pts[train]):
                break
            redraws += 1
            if redraws > 1000:
                raise ArithmeticError(f"{design} n={n}: no well-conditioned design in 1000 draws")
    cand = test_candidates
    if train_pool(design) == test_pool(design):
        cand = np.setdiff1d(test_candidates, train, assume_unique=True)
    test = rng.choice(cand, size=n_test, replace=False)
    return train, test, redraws
