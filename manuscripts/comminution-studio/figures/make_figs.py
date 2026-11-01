#!/usr/bin/env python3
"""Regenerate every figure of the ChancaDEM technical report from the COMMITTED artifacts, as vector PDF.

  fig-physics.pdf     (a) product size distributions of one gyratory, jaw, secondary, tertiary and short-head case;
                      (b) product P80 against throughput for the 17 circuit cases, coloured by machine type.
                      Reads data/derived/<case>/trace.json and data/examples/params.csv.
  fig-surrogate.pdf   the learned surrogate per output on the independent held-out draw (R2 and MAPE).
                      Reads data/derived/model-metrics.json.
  fig-loo.pdf         the ten HP500 surveys, measured against the strict leave-one-survey-out prediction of
                      each method (throughput and power) with the CrusherBayes 80 percent interval.
                      Reads data/derived/hp500/loo.json and crusherbayes.json.
  fig-contraction.pdf the posterior over prior standard deviation of every CrusherBayes parameter.
                      Reads data/derived/hp500/crusherbayes.json.

Run:  python manuscripts/comminution-studio/figures/make_figs.py     (any working directory)
Deps: matplotlib, numpy.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DER = ROOT / "data" / "derived"
HP = DER / "hp500"

INK = "#1a1a2e"
GRID = "#d8d8e0"
MACH = {
    "gyratory": ("#1b6ca8", "gyratory"),
    "jaw": ("#e07a3f", "jaw"),
    "cone-sec": ("#3fa34d", "cone (secondary)"),
    "cone-tert": ("#7b4fa0", "cone (tertiary)"),
    "cone-short-head": ("#b23a48", "cone (short-head)"),
}
REPRESENTATIVE = {"G01": "gyratory", "J01": "jaw", "S01": "cone-sec", "T01": "cone-tert", "H01": "cone-short-head"}

plt.rcParams.update({
    "font.family": "serif", "font.size": 9.0, "axes.edgecolor": INK, "axes.labelcolor": INK,
    "text.color": INK, "xtick.color": INK, "ytick.color": INK, "axes.linewidth": 0.8,
    "pdf.fonttype": 42, "figure.dpi": 200,
})


def _json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _clean(ax) -> None:
    ax.grid(True, color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)


def fig_physics() -> None:
    with (ROOT / "data" / "examples" / "params.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    machine = {r["case_id"]: r["machine"] for r in rows}
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0))
    for cid, m in REPRESENTATIVE.items():
        t = _json(DER / cid / "trace.json")
        a1.plot(t["sieve_mm"], [100 * v for v in t["product_passing"]], "-", color=MACH[m][0], lw=1.5,
                label=f"{MACH[m][1]} ({cid})")
    a1.set_xscale("log")
    a1.set_xlabel("sieve size (mm)")
    a1.set_ylabel("cumulative % passing")
    a1.set_title("(a) product size distribution", fontsize=8.6)
    a1.legend(fontsize=6.8, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    _clean(a1)
    for cid, m in machine.items():
        s = _json(DER / cid / "trace.json")["summary"]
        a2.scatter(s["p80_mm"], s["throughput_tph"], s=30, color=MACH[m][0], edgecolor=INK, linewidth=0.4, zorder=3)
    for col, lab in MACH.values():
        a2.scatter([], [], s=30, color=col, edgecolor=INK, label=lab)
    a2.set_xscale("log")
    a2.set_yscale("log")
    a2.set_xlabel("product $P_{80}$ (mm)")
    a2.set_ylabel("throughput (t/h)")
    a2.set_title("(b) throughput against product size", fontsize=8.6)
    a2.legend(fontsize=6.8, frameon=True, facecolor="white", edgecolor=GRID, loc="lower right")
    _clean(a2)
    fig.tight_layout()
    fig.savefig(HERE / "fig-physics.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_surrogate() -> None:
    po = _json(DER / "model-metrics.json")["surrogate"]["per_output"]
    keys = list(po)
    r2 = [po[k]["r2"] for k in keys]
    mape = [po[k]["mape_pct"] for k in keys]
    x = np.arange(len(keys))
    fig, ax = plt.subplots(figsize=(6.6, 3.0))
    ax.bar(x, r2, color="#1b6ca8", edgecolor=INK, linewidth=0.5, width=0.6, zorder=3)
    ax.set_ylim(0.95, 1.001)
    ax.set_ylabel("$R^2$ against the engine", color="#1b6ca8")
    ax.set_xticks(x)
    ax.set_xticklabels([k.replace("_", " ") for k in keys], rotation=35, ha="right", fontsize=7.4)
    _clean(ax)
    ax2 = ax.twinx()
    ax2.plot(x, mape, "s--", color="#e07a3f", lw=1.3, ms=4.5, zorder=4)
    for xi, mp in zip(x, mape):
        ax2.text(xi, mp + 0.3, f"{mp:.1f}", ha="center", va="bottom", fontsize=6.6, color="#c15a22")
    ax2.set_ylabel("MAPE (%)", color="#e07a3f")
    ax2.set_ylim(0, max(mape) * 1.4)
    ax2.spines["top"].set_visible(False)
    fig.tight_layout()
    fig.savefig(HERE / "fig-surrogate.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_loo() -> None:
    loo = _json(HP / "loo.json")["loo"]
    cb = _json(HP / "crusherbayes.json")["loo"]
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 3.2))
    spec = [("tph", "throughput (t/h)", ["M0", "B_lin", "M2"], "(a) throughput"),
            ("kW", "power (kW)", ["M0", "B_lin", "M2", "Morrell_noload"], "(b) power")]
    style = {"M0": ("#8c8c9a", "o", "calibrated backbone"), "B_lin": ("#e07a3f", "s", "setting-only line"),
             "M2": ("#3fa34d", "^", "free-form fit"), "Morrell_noload": ("#7b4fa0", "v", "Morrell with no-load term")}
    for ax, (key, lab, methods, title) in zip(axes, spec):
        meas = np.array(loo[key]["measured"])
        lo, hi = np.array(cb[key]["lo80"]), np.array(cb[key]["hi80"])
        mean = np.array(cb[key]["pred_mean"])
        ax.errorbar(meas, mean, yerr=[mean - lo, hi - mean], fmt="D", color="#1b6ca8", ms=4.5, lw=0.9,
                    capsize=2, zorder=4, label="CrusherBayes (80% interval)")
        for m in methods:
            col, mk, name = style[m]
            ax.scatter(meas, loo[key]["strict"]["pred"][m], s=16, marker=mk, color=col, alpha=0.85, zorder=3, label=name)
        allp = np.concatenate([meas, lo, hi] + [np.array(loo[key]["strict"]["pred"][m]) for m in methods])
        lim = [allp.min() * 0.95, allp.max() * 1.03]
        ax.plot(lim, lim, color=INK, lw=0.8, ls=":")
        ax.set_xlim(lim)
        ax.set_ylim(lim)
        ax.set_xlabel(f"measured {lab}")
        ax.set_ylabel(f"held-out prediction, {lab}")
        ax.set_title(title, fontsize=8.6)
        ax.legend(fontsize=6.2, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
        _clean(ax)
    fig.tight_layout()
    fig.savefig(HERE / "fig-loo.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_contraction() -> None:
    rows = _json(HP / "crusherbayes.json")["contraction"]
    names = [r["name"].replace("_", " ") for r in rows]
    vals = np.array([r["contraction"] for r in rows])
    order = np.argsort(vals)
    fig, ax = plt.subplots(figsize=(6.6, 3.9))
    y = np.arange(len(rows))
    cols = ["#1b6ca8" if vals[i] < 0.5 else "#b23a48" if vals[i] > 0.85 else "#e07a3f" for i in order]
    ax.barh(y, vals[order], color=cols, edgecolor=INK, linewidth=0.4, zorder=3)
    ax.axvline(0.5, color=INK, lw=0.8, ls="--")
    ax.axvline(1.0, color=INK, lw=0.8, ls=":")
    ax.set_yticks(y)
    ax.set_yticklabels([names[i] for i in order], fontsize=7.2)
    ax.set_xlabel("posterior standard deviation over prior standard deviation")
    ax.set_xlim(0, 1.1)
    _clean(ax)
    fig.tight_layout()
    fig.savefig(HERE / "fig-contraction.pdf", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    fig_physics()
    fig_surrogate()
    fig_loo()
    fig_contraction()
    print("figures written to", HERE)
