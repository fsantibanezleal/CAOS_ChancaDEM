"""The virtual plants of the CrusherBayes theory study: mean functions m_t(x) with a known truth; an observation is
m_t(x) + N(0, sigma_t^2), independent, sigma_t the posterior means of the fit to all ten surveys.

- V0: m_t(x) = f_t(theta_0; x) + z_ref(x)^T d_0,t (the product's own model at its posterior mean, z_ref the ten surveys'
  standardization).
- V1(alpha, kappa), power only (throughput as V0): with b_0 the least-squares coefficients of f_kW(theta_0) on z_ref over the
  training window's pool and e_0 = f_kW(theta_0) - z_ref^T b_0, m_kW = z_ref^T (b_0 + d_0,kW) + alpha e_0 + kappa RMS(e_0) q,
  q = z_c,ref^2 orthogonalized over that pool against (1, z_c, z_f, e_0) and scaled to unit RMS there. V1(1, 0) is V0.
- V2: m_tph = 0.84 rocha_shape(CSS, f80, 9.0) (Rocha et al. 2024's published capacity); m_kW = zeta_0 W_0 m_tph + P_n,0
  with W_0 = (f_kW(theta_0) - P_n,0)/(zeta_0 f_tph(theta_0)) the engine's Bond specific energy at theta_0.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

import engines
from heldout_uq import ROCHA, WI_BLEND, rocha_shape
from pipeline.hp500 import crusherbayes as cb

V1_GRID = ((-1.0, 0.0), (0.0, 0.0), (0.5, 0.0), (1.0, 0.0), (2.0, 0.0), (1.0, 2.0))


def v1_name(alpha: float, kappa: float) -> str:
    def tok(v: float) -> str:
        s = f"{v:g}".replace("-", "m").replace(".", "p")
        return s
    return f"V1_a{tok(alpha)}_k{tok(kappa)}"


PLANTS: dict[str, dict] = {"V0": {"kind": "V0", "outputs": ("tph", "kW")},
                           "V2": {"kind": "V2", "outputs": ("tph", "kW")}}
for _a, _k in V1_GRID:
    PLANTS[v1_name(_a, _k)] = {"kind": "V1", "alpha": _a, "kappa": _k, "outputs": ("kW",)}


@dataclass(frozen=True)
class V1Basis:
    """The pieces of V1 fitted once on the training window's pool."""
    b0: np.ndarray        # least-squares coefficients of f_kW(theta_0) on z_ref
    gamma: np.ndarray     # coefficients of z_c^2 on (1, z_c, z_f, e_0)
    q_scale: float        # RMS of the orthogonalized z_c^2
    rms_e0: float

    @classmethod
    def fit(cls, f_kw0: np.ndarray, zref: np.ndarray) -> "V1Basis":
        b0 = np.linalg.lstsq(zref, f_kw0, rcond=None)[0]
        e0 = f_kw0 - zref @ b0
        M = np.column_stack([zref, e0])
        raw = zref[:, 1] ** 2
        gamma = np.linalg.lstsq(M, raw, rcond=None)[0]
        resid = raw - M @ gamma
        return cls(b0, gamma, float(math.sqrt(np.mean(resid ** 2))), float(math.sqrt(np.mean(e0 ** 2))))

    def e0(self, f_kw0: np.ndarray, zref: np.ndarray) -> np.ndarray:
        return f_kw0 - zref @ self.b0

    def q(self, f_kw0: np.ndarray, zref: np.ndarray) -> np.ndarray:
        M = np.column_stack([zref, self.e0(f_kw0, zref)])
        return (zref[:, 1] ** 2 - M @ self.gamma) / self.q_scale

    def mean(self, alpha: float, kappa: float, f_kw0: np.ndarray, zref: np.ndarray, d0_kw: np.ndarray) -> np.ndarray:
        return (zref @ (self.b0 + d0_kw) + alpha * self.e0(f_kw0, zref)
                + kappa * self.rms_e0 * self.q(f_kw0, zref))


def v0_mean(f0: dict, zref: np.ndarray, d0: dict) -> np.ndarray:
    """(2, N): V0's throughput and power means."""
    return np.vstack([f0["tph"] + zref @ d0["tph"], f0["kW"] + zref @ d0["kW"]])


def v2_mean(points: np.ndarray, f0: dict, theta0: np.ndarray) -> np.ndarray:
    """(2, N): V2's throughput and power means."""
    s = cb.scalars_of(np.concatenate([theta0, [0.0, 0.0]]))
    m_tph = ROCHA["lam"] * rocha_shape(points[:, 0], points[:, 1], WI_BLEND)
    w0 = engines.bond_specific_energy(f0["kW"], f0["tph"], s.zeta, s.pn_kw)
    return np.vstack([m_tph, s.zeta * w0 * m_tph + s.pn_kw])


def plant_mean(name: str, points: np.ndarray, f0: dict, zref: np.ndarray, fit, basis: V1Basis | None) -> np.ndarray:
    """(2, N) means of plant ``name`` on the points (a row of NaN for an output the plant does not define)."""
    spec = PLANTS[name]
    if spec["kind"] == "V0":
        return v0_mean(f0, zref, fit.d0)
    if spec["kind"] == "V2":
        return v2_mean(points, f0, fit.theta0)
    m = v0_mean(f0, zref, fit.d0)
    m[1] = basis.mean(spec["alpha"], spec["kappa"], f0["kW"], zref, fit.d0["kW"])
    return m
