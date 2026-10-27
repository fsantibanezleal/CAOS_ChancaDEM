"""The Latin-hypercube sweep of the canonical Python engine: the training and the held-out operating points of the
two learned models. A port of ``gen_sweep.mjs`` of release 0.09.003 (which ran the TypeScript engine under Node):
the same generator (mulberry32), the same per-machine ranges, the same Latin-hypercube construction and the same
rule for the Bond work index, so a seed yields the very points the Node script yielded. Only the engine that labels
them changed (``pipeline.model.crusher``). A module folder of the pipeline run by path (ADR-0057).

Each machine is sampled only over its own realistic operating envelope (a gyratory never runs a 6 mm CSS), so the
surrogate learns each machine's regime, not a shared rectangle.
"""
from __future__ import annotations

import math

from .crusher import evaluate
from .crusher.types import CrusherResult, Operating

MACHINES = ("cone-sec", "cone-tert", "jaw", "cone-short-head", "gyratory")
CONTINUOUS = ("css_mm", "throw_mm", "speed_rpm", "feed_x63_mm", "feed_m", "ore_axb")

# Per-machine continuous ranges (min, max) in the order of CONTINUOUS. Source: gen_sweep.mjs of release 0.09.003,
# the RANGE table (css, throwMm, speed, x63, m, axb); `git show origin/develop:data-pipeline/pipeline/sweep/gen_sweep.mjs`.
RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "cone-sec": {"css_mm": (6, 90), "throw_mm": (16, 44), "speed_rpm": (180, 560), "feed_x63_mm": (40, 200),
                 "feed_m": (0.7, 2.0), "ore_axb": (30, 110)},
    "cone-tert": {"css_mm": (4, 22), "throw_mm": (10, 26), "speed_rpm": (220, 600), "feed_x63_mm": (15, 55),
                  "feed_m": (0.9, 2.0), "ore_axb": (30, 110)},
    "jaw": {"css_mm": (50, 160), "throw_mm": (24, 50), "speed_rpm": (180, 380), "feed_x63_mm": (180, 500),
            "feed_m": (0.7, 1.6), "ore_axb": (35, 110)},
    "cone-short-head": {"css_mm": (4, 16), "throw_mm": (10, 22), "speed_rpm": (380, 600), "feed_x63_mm": (15, 45),
                        "feed_m": (0.9, 2.0), "ore_axb": (30, 110)},
    "gyratory": {"css_mm": (120, 240), "throw_mm": (22, 40), "speed_rpm": (100, 200), "feed_x63_mm": (300, 800),
                 "feed_m": (0.7, 1.4), "ore_axb": (30, 110)},
}

_M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """``Math.imul``: the low 32 bits of the product, as a signed 32-bit integer."""
    r = (a * b) & _M32
    return r - (1 << 32) if r & 0x80000000 else r


def _i32(x: int) -> int:
    x &= _M32
    return x - (1 << 32) if x & 0x80000000 else x


class Mulberry32:
    """The deterministic generator of ``gen_sweep.mjs`` (mulberry32): a pure function of the seed."""

    def __init__(self, seed: int):
        self.a = _i32(int(seed))

    def __call__(self) -> float:
        self.a = _i32(self.a + 0x6D2B79F5)
        a = self.a
        t = _imul(a ^ ((a & _M32) >> 15), 1 | a)
        t = _i32(t + _imul(t ^ ((t & _M32) >> 7), 61 | t)) ^ t
        return (((t ^ ((t & _M32) >> 14)) & _M32)) / 4294967296


def wi_of_axb(axb: float) -> float:
    """Bond work index from the ore competence A*b (harder ore, lower A*b, higher Wi); it keeps power tied to hardness
    without a free input dimension (the surrogate stays at 6 continuous inputs plus the 5 machine one-hots)."""
    return max(8.0, min(20.0, 8.0 + (120.0 - axb) * 0.09))


def lhs(n: int, d: int, rnd) -> list[list[float]]:
    """Latin hypercube: per dimension a random permutation of ``n`` stratified cells, jittered inside the cell;
    returns ``n`` points of ``d`` uniforms in (0, 1). The draw order is that of gen_sweep.mjs."""
    cols = []
    for _ in range(d):
        perm = list(range(n))
        for i in range(n - 1, 0, -1):
            k = int(rnd() * (i + 1))
            perm[i], perm[k] = perm[k], perm[i]
        cols.append([(p + rnd()) / n for p in perm])
    return [[c[i] for c in cols] for i in range(n)]


def draw(n_per_machine: int, seed: int) -> list[Operating]:
    """``n_per_machine`` Latin-hypercube points for each machine, in MACHINES order, deterministic for ``seed``.
    Every point is returned, the physically degenerate ones included: the caller filters them."""
    rnd = Mulberry32(seed)
    points: list[Operating] = []
    for machine in MACHINES:
        rng = RANGES[machine]
        for u in lhs(n_per_machine, len(CONTINUOUS), rnd):
            v = {k: rng[k][0] + u[j] * (rng[k][1] - rng[k][0]) for j, k in enumerate(CONTINUOUS)}
            points.append(Operating(machine=machine, ore_wi=wi_of_axb(v["ore_axb"]), **v))
    return points


def is_trainable(r: CrusherResult) -> bool:
    """The 0.09.003 rule for a labelled point: a physically degenerate draw (CSS at or above the feed top, an
    ill-conditioned breakage matrix, a reduction ratio under 1.02, a non-finite or non-positive P80) is dropped from
    both the training labels and the held-out score; the deployed models are queried inside the manifold, and the
    envelope gate (not the surrogate) owns the degenerate region."""
    return bool(r.valid and r.regime != "invalid" and r.reduction_ratio >= 1.02 and math.isfinite(r.p80) and r.p80 > 0)


def label(points: list[Operating]) -> list[CrusherResult]:
    """The canonical engine's result for every point that ``is_trainable``, in draw order."""
    results = (evaluate(p) for p in points)
    return [r for r in results if is_trainable(r)]
