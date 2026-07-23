#!/usr/bin/env python3
"""Regenerate the figures for the ChancaDEM comminution-studio report from the COMMITTED artifacts. Two figures:

  fig-physics.pdf   - (a) product size distributions (cumulative % passing vs sieve size) for a gyratory, a jaw
                      and a cone case; (b) the specific comminution energy vs the P80 across the seventeen cases,
                      the classical finer-product-costs-more-energy trade.
  fig-surrogate.pdf - the learned surrogate's per-output accuracy against the population-balance engine
                      (coefficient of determination and mean absolute percentage error), on a leakage-safe
                      held-out Latin-hypercube draw.

Run:  python make_figs.py     (from repo root)
Deps: matplotlib, numpy.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"

INK = "#1a1a2e"
GRID = "#d8d8e0"
MCOL = {"G": "#1b6ca8", "J": "#e07a3f", "S": "#3fa34d"}
MNAME = {"G": "gyratory", "J": "jaw", "S": "cone"}

plt.rcParams.update({
    "font.family": "serif", "font.size": 9.4, "axes.edgecolor": INK,
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.linewidth": 0.8, "figure.dpi": 200,
})


def _load():
    return json.loads((DATA / "studio.json").read_text(encoding="utf-8"))


def fig_physics():
    d = _load()
    cases = d["cases"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0))

    # (a) gradation curves: one representative per machine class
    seen = set()
    for c in cases:
        m = c["id"][0]
        if m in seen or m not in MCOL or not c.get("pass"):
            continue
        seen.add(m)
        pts = sorted((float(k), v) for k, v in c["pass"].items())
        sizes = [p[0] for p in pts]
        passing = [100 * p[1] for p in pts]
        # add the percentile anchors (p20/p50/p80 are the sizes at 20/50/80% passing)
        anchors = sorted([(c["p20"], 20), (c["p50"], 50), (c["p80"], 80)])
        xs = sizes + [a[0] for a in anchors]
        ys = passing + [a[1] for a in anchors]
        order = np.argsort(xs)
        a1.plot(np.array(xs)[order], np.array(ys)[order], "o-", color=MCOL[m], linewidth=1.6,
                markersize=3.5, label=f"{MNAME[m]} ({c['id']})")
    a1.set_xscale("log")
    a1.set_xlabel("sieve size (mm)"); a1.set_ylabel("cumulative % passing")
    a1.set_title("(a) product size distribution", fontsize=8.8)
    a1.grid(True, color=GRID, linewidth=0.7)
    a1.set_axisbelow(True)
    a1.legend(fontsize=7.4, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    for s in ("top", "right"):
        a1.spines[s].set_visible(False)

    # (b) specific energy vs P80 across the cases
    for c in cases:
        m = c["id"][0]
        a2.scatter(c["p80"], c.get("ecs", np.nan), s=34, color=MCOL.get(m, "#999"),
                   edgecolor=INK, linewidth=0.4, zorder=3)
    for m, col in MCOL.items():
        a2.scatter([], [], s=34, color=col, edgecolor=INK, label=MNAME[m])
    a2.set_xlabel("product $P_{80}$ (mm)"); a2.set_ylabel("specific energy (kWh/t)")
    a2.set_title("(b) finer product costs more energy", fontsize=8.8)
    a2.grid(True, color=GRID, linewidth=0.7)
    a2.set_axisbelow(True)
    a2.legend(fontsize=7.4, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    for s in ("top", "right"):
        a2.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-physics.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_surrogate():
    d = _load()
    po = d["surrogate"]["perOutput"]
    keys = ["p80", "p50", "p20", "pass1", "pass4", "pass8", "pass16", "pass32", "tph", "kW"]
    r2 = [po[k]["r2"] for k in keys]
    mape = [po[k]["mape_pct"] for k in keys]
    x = np.arange(len(keys))
    fig, ax = plt.subplots(figsize=(6.6, 3.1))
    b = ax.bar(x, r2, color="#1b6ca8", edgecolor=INK, linewidth=0.5, width=0.6, zorder=3)
    ax.set_ylim(0.95, 1.001)
    ax.set_ylabel("$R^2$ (surrogate vs engine)", color="#1b6ca8")
    ax.tick_params(axis="y", labelcolor="#1b6ca8")
    ax.set_xticks(x); ax.set_xticklabels(keys, rotation=35, ha="right", fontsize=7.6)
    ax.set_title("Learned surrogate accuracy per output\n(leakage-safe held-out LHS draw)", fontsize=9.0)
    ax.grid(axis="y", color=GRID, linewidth=0.7, zorder=0)
    ax.set_axisbelow(True)
    for s in ("top",):
        ax.spines[s].set_visible(False)
    ax2 = ax.twinx()
    ax2.plot(x, mape, "s--", color="#e07a3f", linewidth=1.3, markersize=5, zorder=4, label="MAPE (%)")
    for xi, mp in zip(x, mape):
        ax2.text(xi, mp + 0.25, f"{mp:.1f}", ha="center", va="bottom", fontsize=6.6, color="#c15a22")
    ax2.set_ylabel("mean abs. % error", color="#e07a3f")
    ax2.tick_params(axis="y", labelcolor="#e07a3f")
    ax2.set_ylim(0, max(mape) * 1.4)
    ax2.spines["top"].set_visible(False)
    fig.tight_layout()
    fig.savefig(HERE / "fig-surrogate.pdf", bbox_inches="tight")
    plt.close(fig)


def main():
    fig_physics()
    fig_surrogate()
    print("wrote fig-physics.pdf, fig-surrogate.pdf")


if __name__ == "__main__":
    main()
