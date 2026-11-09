#!/usr/bin/env python3
"""Regenerate every figure of the ChancaDEM technical report as vector PDF, from the COMMITTED artifacts and, where a
figure needs a curve no artifact stores, from the product's own engine code (named per figure below).

  fig-dataflow.pdf     the pipeline, the documents it writes and the lanes that read them (a diagram of the repository).
  fig-physics.pdf      (a) product size distributions of one gyratory, jaw, secondary, tertiary and short-head case;
                       (b) product P80 against throughput for the 17 circuit cases, by machine type.
                       Reads data/derived/<case>/trace.json and data/examples/params.csv.
  fig-chamber.pdf      (a) the classification function C(d) of case S01 at three settings; (b) the Austin appearance
                       function at three t10 values. Calls pipeline.model.crusher.classification and .breakage.
  fig-sweeps.pdf       (a) the capacity against eccentric speed of the secondary cases S01, S02 and S03 (the speed sweeps of
                       their traces); (b) P80 and throughput of S01 against the setting (its setting sweep).
  fig-surveys.pdf      the ten HP500 surveys: measured power and throughput against the setting, with the setting-only line
                       fitted on all ten. Reads data/examples/hp500-surveys.csv.
  fig-power-parity.pdf the in-sample power of the calibrated engine per survey (bare Bond draw, published form, refit form)
                       against the measured power. Reads data/derived/hp500/loo.json (power_parity).
  fig-loo.pdf          the ten surveys, measured against the strict leave-one-survey-out prediction of each method, with the
                       CrusherBayes 80 percent interval. Reads data/derived/hp500/loo.json and crusherbayes.json.
  fig-bands.pdf        the held-out residual of the calibrated backbone per survey against its nested 80 percent band.
                       Reads data/derived/hp500/loo.json (uq).
  fig-morrell.pdf      the per-fold fitted crushing work index and no-load power of the two Morrell variants.
                       Reads data/derived/hp500/loo.json (morrell_fit).
  fig-contraction.pdf  the posterior over prior standard deviation of every CrusherBayes parameter.
                       Reads data/derived/hp500/crusherbayes.json.
  fig-surrogate.pdf    the learned surrogate per output on the independent held-out draw (R2 and MAPE).
                       Reads data/derived/model-metrics.json.
  fig-drift.pdf        hours until the P80 of case S01 reaches a target, against the drift rate of the setting, for the
                       three targets of the shared reference table. Reads tests/fixtures/campaign-reference.json.
  fig-drift-response.pdf  (a) P80 of survey 1 (HP500-01) against the setting over the drawn range, the target of the App's
                       rule, the secant to its crossing, the local slope and the K1 class crossing; (b) the slope of P80 by
                       finite differences. Calls pipeline.model.crusher.evaluate, .campaign and .classification.
  fig-replacement.pdf  the particle-replacement walk on the chamber of case S01 against the Whiten product, by number of
                       parcels (five seeds each). Calls pipeline.model.crusher.whiten.replacement_walk and evaluate.

Run:  python manuscripts/comminution-studio/figures/make_figs.py     (any working directory)
Deps: matplotlib, numpy (the notebook environment of the product carries both).
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DER = ROOT / "data" / "derived"
HP = DER / "hp500"
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.model.crusher import evaluate  # noqa: E402
from pipeline.model.crusher.breakage import appearance_cum, phi_from_t10  # noqa: E402
from pipeline.model.crusher.classification import classification_params, classify  # noqa: E402
from pipeline.model.crusher.engine import grid_f80  # noqa: E402
from pipeline.model.crusher.types import Operating  # noqa: E402
from pipeline.model.crusher.whiten import assemble_chamber, replacement_walk  # noqa: E402

INK = "#1a1a2e"
GRID = "#d8d8e0"
BLUE, ORANGE, GREEN, PURPLE, RED, GREY = "#1b6ca8", "#e07a3f", "#3fa34d", "#7b4fa0", "#b23a48", "#8c8c9a"
MACH = {
    "gyratory": (BLUE, "gyratory", "o", "-"),
    "jaw": (ORANGE, "jaw", "s", "--"),
    "cone-sec": (GREEN, "cone (secondary)", "^", "-."),
    "cone-tert": (PURPLE, "cone (tertiary)", "D", ":"),
    "cone-short-head": (RED, "cone (short-head)", "v", (0, (5, 1, 1, 1))),
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


def _save(fig, name: str) -> None:
    fig.tight_layout()
    fig.savefig(HERE / name, bbox_inches="tight")
    plt.close(fig)


def _surveys() -> list[dict]:
    with (ROOT / "data" / "examples" / "hp500-surveys.csv").open(encoding="utf-8") as fh:
        return [{k: float(v) for k, v in r.items()} for r in csv.DictReader(fh)]


# ------------------------------------------------------------------------------------------------------------------------
def fig_dataflow() -> None:
    fig, ax = plt.subplots(figsize=(7.2, 4.1))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 60)
    ax.axis("off")

    def box(x, y, w, h, text, fill="#ffffff", bold=False):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4,rounding_size=1.2", fc=fill, ec=INK, lw=0.8))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=6.9,
                fontweight="bold" if bold else "normal", wrap=True)

    def arrow(x0, y0, x1, y1, style="-|>", ls="-"):
        ax.add_patch(FancyArrowPatch((x0, y0), (x1, y1), arrowstyle=style, mutation_scale=8, lw=0.8, color=INK,
                                     linestyle=ls))

    ax.text(1, 57.5, "Inputs", fontsize=7.6, fontweight="bold")
    ax.text(27, 57.5, "Offline pipeline (data-pipeline/run.py)", fontsize=7.6, fontweight="bold")
    ax.text(75, 57.5, "Readers", fontsize=7.6, fontweight="bold")
    box(1, 44, 19, 9, "params.csv\n(params-record,\n17 circuit cases)", "#eef3f8")
    box(1, 31, 19, 9, "hp500-surveys.csv\n(hp500-survey,\nten surveys)", "#eef3f8")
    n_schemas = len(list((ROOT / "docs" / "contracts" / "schemas").glob("*.schema.json")))
    box(1, 14, 19, 11, f"docs/contracts/\ncatalog.md and\n{n_schemas} schema files", "#eef3f8")
    box(26, 44, 20, 9, "preprocess:\nvalidate the rows", "#f4f4f6")
    box(26, 31, 20, 9, "infer: the engine\n(Whiten, capacity,\npower, envelope)", "#f4f4f6", bold=True)
    box(26, 18, 20, 9, "hp500: backbone,\nleave-one-out,\nCrusherBayes, comparison", "#f4f4f6")
    box(26, 5, 20, 9, "models (torch, local):\ntrain, export ONNX,\nevaluate held out", "#f4f4f6")
    box(51, 44, 19, 9, "export: trace.json\nand manifest per case,\nindex.json", "#fdf3ea")
    box(51, 31, 19, 9, "readiness.json\n(state per\ncontract)", "#fdf3ea")
    box(51, 18, 19, 9, "backbone.json, loo.json,\ncrusherbayes.json,\ncomparison.json", "#fdf3ea")
    box(51, 5, 19, 9, "surrogate, psd-ae\n(.json + .onnx),\nmodel-metrics.json", "#fdf3ea")
    box(76, 40, 22, 13, "Web (static site):\nreplay of the documents,\nlive TypeScript engine,\nonnxruntime-web", "#eef6ee")
    box(76, 22, 22, 12, "Dormant API (app/):\nGET only, 503 with the\nstate when a document\nis absent", "#eef6ee")
    box(76, 5, 22, 12, "Notebooks, report\nfigures and tables\n(read the same\ndocuments)", "#eef6ee")
    arrow(20, 48.5, 26, 48.5)
    arrow(36, 44, 36, 40)
    arrow(20, 35.5, 25.6, 25.0)
    arrow(46, 35.5, 51, 48.5)
    arrow(36, 31, 36, 27)
    arrow(46, 22.5, 51, 22.5)
    arrow(36, 18, 36, 14)
    arrow(46, 9.5, 51, 9.5)
    ax.plot([20.4, 23.0, 48.5], [21.0, 29.0, 29.0], color=INK, lw=0.8, ls="--")
    arrow(48.5, 29.0, 50.6, 32.0, ls="--")
    for y in (48.5, 22.5, 9.5):
        arrow(70, y, 76, 46.5 if y > 30 else (28 if y > 15 else 11))
    arrow(70, 35.5, 76, 28)
    arrow(70, 35.5, 76, 46.5)
    ax.text(48.5, 0.6, "dashed: the readiness document is computed from the catalog and the repository state",
            ha="center", fontsize=6.3, style="italic")
    _save(fig, "fig-dataflow.pdf")


def fig_physics() -> None:
    with (ROOT / "data" / "examples" / "params.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    machine = {r["case_id"]: r["machine"] for r in rows}
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0))
    for cid, m in REPRESENTATIVE.items():
        t = _json(DER / cid / "trace.json")
        col, lab, _mk, ls = MACH[m]
        a1.plot(t["sieve_mm"], [100 * v for v in t["product_passing"]], color=col, lw=1.5, ls=ls, label=f"{lab} ({cid})")
    a1.set_xscale("log")
    a1.set_xlabel("sieve size (mm)")
    a1.set_ylabel("cumulative % passing")
    a1.set_title("(a) product size distribution", fontsize=8.6)
    a1.legend(fontsize=6.8, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    _clean(a1)
    for cid, m in machine.items():
        if cid in CONTROLS:
            continue                        # the three controls are not machines of the circuit
        s = _json(DER / cid / "trace.json")["summary"]
        col, _lab, mk, _ls = MACH[m]
        a2.scatter(s["p80_mm"], s["throughput_tph"], s=30, color=col, marker=mk, edgecolor=INK, linewidth=0.4, zorder=3)
    for col, lab, mk, _ls in MACH.values():
        a2.scatter([], [], s=30, color=col, marker=mk, edgecolor=INK, label=lab)
    a2.set_xscale("log")
    a2.set_yscale("log")
    a2.set_xlabel("product $P_{80}$ (mm)")
    a2.set_ylabel("throughput (t/h)")
    a2.set_title("(b) throughput against product size", fontsize=8.6)
    a2.legend(fontsize=6.8, frameon=True, facecolor="white", edgecolor=GRID, loc="lower right")
    _clean(a2)
    _save(fig, "fig-physics.pdf")


def fig_chamber() -> None:
    op = Operating(**_json(DER / "manifests" / "S01.json")["params"])
    f80 = grid_f80(op)
    d = np.logspace(np.log10(5), np.log10(150), 400)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 2.9))
    for css, col, ls in ((24.0, BLUE, "--"), (32.0, GREEN, "-"), (40.0, ORANGE, ":")):
        p = classification_params(op.machine, css, f80_mm=f80, calibrated=False, throw_mm=op.throw_mm)
        a1.plot(d, [classify(x, p) for x in d], color=col, ls=ls, lw=1.5,
                label=f"CSS {css:.0f} mm ($K_1$ {p.k1:.1f}, $K_2$ {p.k2:.1f})")
    a1.set_xscale("log")
    a1.set_xlabel("particle size $d$ (mm)")
    a1.set_ylabel("classification $C(d)$")
    a1.set_title("(a) classification of case S01", fontsize=8.6)
    a1.legend(fontsize=6.5, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    _clean(a1)
    u = np.logspace(-3, 0, 400)
    for t10, col, ls in ((0.10, BLUE, "--"), (0.25, GREEN, "-"), (0.40, ORANGE, ":")):
        phi = phi_from_t10(t10)
        a2.plot(u, [appearance_cum(x, phi) for x in u], color=col, ls=ls, lw=1.5,
                label=f"$t_{{10}}$ = {t10:.2f} ($\\varphi$ = {phi:.3f})")
    a2.axvline(0.1, color=INK, lw=0.7, ls=":")
    a2.set_xscale("log")
    a2.set_xlabel("relative size $u = x/y$")
    a2.set_ylabel("cumulative appearance $B(u)$")
    a2.set_title("(b) Austin appearance function", fontsize=8.6)
    a2.legend(fontsize=6.5, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    _clean(a2)
    _save(fig, "fig-chamber.pdf")


def fig_sweeps() -> None:
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 2.9))
    for cid, col, ls, mk in (("S01", GREEN, "-", "o"), ("S02", BLUE, "--", "s"), ("S03", ORANGE, ":", "^")):
        t = _json(DER / cid / "trace.json")
        sw, op = t["speed_sweep"], _json(DER / "manifests" / f"{cid}.json")["params"]
        a1.plot(sw["speed_rpm"], sw["throughput_tph"], color=col, ls=ls, lw=1.4, label=f"{cid} ({op['speed_rpm']:.0f} rpm)")
        a1.scatter([op["speed_rpm"]], [t["summary"]["throughput_tph"]], color=col, marker=mk, edgecolor=INK, zorder=4, s=22)
    a1.axvline(360, color=INK, lw=0.7, ls=":")
    a1.set_xlabel("eccentric speed (rpm)")
    a1.set_ylabel("throughput (t/h)")
    a1.set_title("(a) capacity against speed", fontsize=8.6)
    a1.legend(fontsize=6.6, frameon=True, facecolor="white", edgecolor=GRID, loc="lower right")
    _clean(a1)
    t = _json(DER / "S01" / "trace.json")
    cs = t["css_sweep"]
    a2.plot(cs["css_mm"], cs["p80_mm"], color=GREEN, lw=1.5, label="$P_{80}$ (left)")
    a2.set_xlabel("closed-side setting (mm)")
    a2.set_ylabel("product $P_{80}$ (mm)")
    a2.set_title("(b) the setting trade-off of S01", fontsize=8.6)
    _clean(a2)
    a3 = a2.twinx()
    a3.plot(cs["css_mm"], cs["throughput_tph"], color=ORANGE, lw=1.5, ls="--", label="throughput (right)")
    a3.set_ylabel("throughput (t/h)")
    a3.spines["top"].set_visible(False)
    h1, l1 = a2.get_legend_handles_labels()
    h2, l2 = a3.get_legend_handles_labels()
    a2.legend(h1 + h2, l1 + l2, fontsize=6.6, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    _save(fig, "fig-sweeps.pdf")


def fig_surveys() -> None:
    s = _surveys()
    css = np.array([r["css_mm"] for r in s])
    f80 = np.array([r["f80_mm"] for r in s])
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 3.0), layout="constrained")
    for ax, key, lab, loc in ((axes[0], "power_kw", "measured power (kW)", "upper right"),
                              (axes[1], "feed_tph", "measured feed rate (t/h)", "lower right")):
        y = np.array([r[key] for r in s])
        sc = ax.scatter(css, y, c=f80, cmap="viridis", s=36, edgecolor=INK, linewidth=0.5, zorder=3)
        a, b = np.polyfit(css, y, 1)[::-1]
        xs = np.linspace(36, 57, 10)
        ax.plot(xs, a + b * xs, color=INK, lw=0.9, ls="--", label=f"line on all ten: {a:.0f} {b:+.2f} CSS")
        for r, x, yy in zip(s, css, y):
            ax.annotate(f"{int(r['survey'])}", (x, yy), xytext=(3, 3), textcoords="offset points", fontsize=6)
        ax.set_xlabel("closed-side setting (mm)")
        ax.set_ylabel(lab)
        ax.legend(fontsize=6.4, frameon=True, facecolor="white", edgecolor=GRID, loc=loc)
        _clean(ax)
    cb = fig.colorbar(sc, ax=axes, shrink=0.85, pad=0.02)
    cb.set_label("feed $f_{80}$ (mm)")
    axes[0].set_title("(a) power", fontsize=8.6)
    axes[1].set_title("(b) feed rate", fontsize=8.6)
    fig.savefig(HERE / "fig-surveys.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_power_parity() -> None:
    ps = _json(HP / "loo.json")["power_parity"]["per_survey"]
    n = np.array([p["n"] for p in ps])
    fig, ax = plt.subplots(figsize=(6.6, 2.8))
    w = 0.2
    ax.bar(n - 1.5 * w, [p["measured"] for p in ps], w, color=INK, label="measured")
    ax.bar(n - 0.5 * w, [p["bare_bond"] for p in ps], w, color=GREY, hatch="//", edgecolor=INK, lw=0.3, label="bare Bond draw")
    ax.bar(n + 0.5 * w, [p["engine_pc"] for p in ps], w, color=ORANGE, hatch="..", edgecolor=INK, lw=0.3,
           label="published form $1.30 P_d + 110$")
    ax.bar(n + 1.5 * w, [p["refit_pc"] for p in ps], w, color=GREEN, hatch="xx", edgecolor=INK, lw=0.3,
           label="refit form $\\zeta P_d + P_n$")
    ax.set_xticks(n)
    ax.set_xticklabels([f"{int(k)}\n{p['css']:.0f} mm" for k, p in zip(n, ps)], fontsize=6.6)
    ax.set_xlabel("survey and its closed-side setting")
    ax.set_ylabel("power (kW)")
    # the legend above the axes, so it covers none of the bars
    ax.legend(fontsize=6.4, ncol=4, frameon=False, loc="lower center", bbox_to_anchor=(0.5, 1.0))
    _clean(ax)
    _save(fig, "fig-power-parity.pdf")


def fig_loo() -> None:
    loo = _json(HP / "loo.json")["loo"]
    cb = _json(HP / "crusherbayes.json")["loo"]
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 3.2))
    # keys of the held-out documents, in the order the legend shows them; the power panel adds the last one
    style = {"M0": (GREY, "o", "calibrated backbone"), "B_lin": (ORANGE, "s", "setting-only line"),
             "M2": (GREEN, "^", "free-form fit"), "Morrell_noload": (PURPLE, "v", "Morrell with no-load term")}
    spec = [("tph", "throughput (t/h)", False, "(a) throughput"), ("kW", "power (kW)", True, "(b) power")]
    for ax, (key, lab, with_noload, title) in zip(axes, spec):
        methods = [m for m in style if with_noload or m != "Morrell_noload"]
        meas = np.array(loo[key]["measured"])
        lo, hi = np.array(cb[key]["lo80"]), np.array(cb[key]["hi80"])
        mean = np.array(cb[key]["pred_mean"])
        ax.errorbar(meas, mean, yerr=[mean - lo, hi - mean], fmt="D", color=BLUE, ms=4.5, lw=0.9,
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
        _clean(ax)
    # one legend below both panels, so no marker or interval of a survey is hidden behind it
    handles, labels = axes[1].get_legend_handles_labels()
    fig.legend(handles, labels, fontsize=6.4, frameon=False, loc="upper center", bbox_to_anchor=(0.5, 0.02), ncol=5)
    _save(fig, "fig-loo.pdf")


def fig_bands() -> None:
    loo = _json(HP / "loo.json")["loo"]
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.8))
    for ax, key, lab, title in ((axes[0], "tph", "t/h", "(a) throughput"), (axes[1], "kW", "kW", "(b) power")):
        meas = np.array(loo[key]["measured"])
        pred = np.array(loo[key]["strict"]["pred"]["M0"])
        uq = loo[key]["strict"]["uq"]
        half = 1.2816 * np.array(uq["nested_sigma"])
        n = np.arange(1, 11)
        ax.fill_between(n, -half, half, color=BLUE, alpha=0.18, step="mid", label="nested 80% band")
        cov = np.array(uq["nested_covered"])
        ax.scatter(n[cov], (meas - pred)[cov], color=INK, marker="o", s=22, zorder=3, label="inside")
        ax.scatter(n[~cov], (meas - pred)[~cov], color=RED, marker="x", s=30, zorder=3, label="outside")
        ax.axhline(0, color=INK, lw=0.6)
        ax.set_xticks(n)
        ax.set_xlabel("held-out survey")
        ax.set_ylabel(f"measured minus backbone ({lab})")
        ax.set_title(f"{title}: coverage {uq['nested_coverage']:.2f}", fontsize=8.6)
        ax.legend(fontsize=6.4, frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.2), ncol=3)
        _clean(ax)
    _save(fig, "fig-bands.pdf")


def fig_morrell() -> None:
    mf = _json(HP / "loo.json")["loo"]["kW"]["strict"]["morrell_fit"]
    n = np.arange(1, 11)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 2.7))
    a1.plot(n, mf["m_ic_kwh_t"], "o-", color=GREEN, lw=1.2, ms=4, label="through the origin")
    a1.plot(n, mf["m_ic_noload_kwh_t"], "s--", color=PURPLE, lw=1.2, ms=4, label="with a no-load term")
    a1.axhline(0, color=INK, lw=0.6)
    a1.set_xticks(n)
    a1.set_xlabel("held-out survey of the fold")
    a1.set_ylabel("fitted $M_{ic}$ (kWh/t)")
    a1.set_title("(a) crushing work index per fold", fontsize=8.6)
    a1.legend(fontsize=6.6, frameon=True, facecolor="white", edgecolor=GRID, loc="center right")
    _clean(a1)
    meas_max = max(_json(HP / "loo.json")["loo"]["kW"]["measured"])
    a2.bar(n, mf["no_load_kw"], color=PURPLE, alpha=0.75, edgecolor=INK, lw=0.4, label="fitted no-load power")
    a2.axhline(meas_max, color=INK, lw=0.9, ls="--", label=f"largest measured power ({meas_max:.0f} kW)")
    a2.set_xticks(n)
    a2.set_xlabel("held-out survey of the fold")
    a2.set_ylabel("power (kW)")
    a2.set_title("(b) no-load term per fold", fontsize=8.6)
    a2.legend(fontsize=6.6, frameon=True, facecolor="white", edgecolor=GRID, loc="lower right")
    _clean(a2)
    _save(fig, "fig-morrell.pdf")


SYMBOL = {"q_ref_tph": "$Q_T$", "wi_kwh_t": "$W_i$", "zeta": r"$\zeta$", "pn_kw": "$P_n$", "k1_scale": "$s_1$ (on $K_1$)",
          "k2_scale": "$s_2$ (on $K_2$)", "k3": "$K_3$", "t10_shift_pct": r"$\Delta t_{10}$", "sigma_tph": r"$\sigma_Q$",
          "sigma_kW": r"$\sigma_P$", "discrepancy_tph_constant": "$d_{Q0}$", "discrepancy_tph_css": "$d_{Q1}$ (setting)",
          "discrepancy_tph_f80": "$d_{Q2}$ ($f_{80}$)", "discrepancy_kW_constant": "$d_{P0}$",
          "discrepancy_kW_css": "$d_{P1}$ (setting)", "discrepancy_kW_f80": "$d_{P2}$ ($f_{80}$)"}
OUTPUT_LABEL = {"p80_mm": "$P_{80}$", "p50_mm": "$P_{50}$", "p20_mm": "$P_{20}$", "pass_1": "passing 1 mm",
                "pass_4": "passing 4 mm", "pass_8": "passing 8 mm", "pass_16": "passing 16 mm", "pass_32": "passing 32 mm",
                "throughput_tph": "throughput $Q$", "power_kw": "power $P$"}
CONTROLS = ("CP1", "CI1", "CK1")


def fig_contraction() -> None:
    rows = _json(HP / "crusherbayes.json")["contraction"]
    names = [SYMBOL[r["name"]] for r in rows]
    vals = np.array([r["contraction"] for r in rows])
    order = np.argsort(vals)
    fig, ax = plt.subplots(figsize=(6.6, 3.9))
    y = np.arange(len(rows))
    cols = [BLUE if vals[i] < 0.5 else RED if vals[i] > 0.9 else ORANGE for i in order]
    hatches = ["" if vals[i] < 0.5 else "//" if vals[i] > 0.9 else ".." for i in order]
    bars = ax.barh(y, vals[order], color=cols, edgecolor=INK, linewidth=0.4, zorder=3)
    for b, h in zip(bars, hatches):
        b.set_hatch(h)
    ax.axvline(0.5, color=INK, lw=0.8, ls="--")
    ax.axvline(0.9, color=INK, lw=0.8, ls=":")   # the thresholds of the CrusherBayes manuscript: 0.5 and 0.9
    ax.set_yticks(y)
    ax.set_yticklabels([names[i] for i in order], fontsize=7.2)
    ax.set_xlabel("posterior standard deviation over prior standard deviation")
    ax.set_xlim(0, 1.1)
    _clean(ax)
    _save(fig, "fig-contraction.pdf")


def fig_surrogate() -> None:
    po = _json(DER / "model-metrics.json")["surrogate"]["per_output"]
    keys = list(po)
    r2 = [po[k]["r2"] for k in keys]
    mape = [po[k]["mape_pct"] for k in keys]
    x = np.arange(len(keys))
    fig, ax = plt.subplots(figsize=(6.6, 3.0))
    ax.bar(x, mape, color=BLUE, edgecolor=INK, linewidth=0.5, width=0.6, zorder=3)
    for xi, mp in zip(x, mape):
        ax.text(xi, mp + 0.15, f"{mp:.1f}", ha="center", va="bottom", fontsize=6.8, color=INK)
    ax.set_ylim(0, max(mape) * 1.25)
    ax.set_ylabel("MAPE against the engine (%, bars)")
    ax.set_xticks(x)
    ax.set_xticklabels([OUTPUT_LABEL[k] for k in keys], rotation=35, ha="right", fontsize=7.4)
    _clean(ax)
    ax2 = ax.twinx()
    ax2.plot(x, r2, "s", color=INK, ms=4.5, mfc="white", zorder=4)
    ax2.set_ylabel("$R^2$ against the engine (open squares)")
    ax2.set_ylim(0.97, 1.0)
    ax2.spines["top"].set_visible(False)
    _save(fig, "fig-surrogate.pdf")


def fig_drift() -> None:
    rows = {r["id"]: r for r in _json(ROOT / "tests" / "fixtures" / "campaign-reference.json")["rows"]}
    d = np.logspace(-2, 0, 200)
    fig, ax = plt.subplots(figsize=(5.4, 3.0))
    for rid, col, ls in (("S01-plus3", BLUE, "--"), ("S01-plus10", GREEN, "-"), ("S01-plus30", ORANGE, ":")):
        r = rows[rid]
        delta = r["css_target_mm"] - r["op"]["css_mm"]
        ax.plot(d, delta / d, color=col, ls=ls, lw=1.5,
                label=f"target $P_{{80}}$ {r['p80_target_mm']:.2f} mm (opening {delta:.2f} mm)")
    ax.axhline(45, color=INK, lw=0.9, ls="-.", label="45 h re-set interval of one plant")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("drift rate of the closed-side setting (mm/h)")
    ax.set_ylabel("operating hours to the target")
    ax.legend(fontsize=6.3, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    _clean(ax)
    _save(fig, "fig-drift.pdf")


def fig_drift_response() -> None:
    """(a) P80 of survey 1 (HP500-01, calibrated lane) against the setting over the drawn range, with the target by the App's
    rule (P80 plus 10 percent), the secant to its crossing, the tangent of the local slope at the current setting and the
    setting where K1 crosses the next class mid-size; (b) the slope of P80 in the setting by finite differences of 0.02 mm."""
    from pipeline.model.crusher.campaign import css_at_p80_target
    from pipeline.model.crusher.classification import hp500_params
    from pipeline.model.sweep import RANGES

    op = Operating(**_json(DER / "manifests" / "HP500-01.json")["params"])
    ceil = RANGES[op.machine]["css_mm"][1]

    def p80(css: float) -> float:
        return evaluate(Operating(**{**op.__dict__, "css_mm": css})).p80

    r0 = evaluate(op)
    s0, p0 = op.css_mm, r0.p80
    target = 1.1 * p0
    s_star = css_at_p80_target(op, target, ceil)
    secant = (p80(s_star) - p0) / (s_star - s0)
    h = max(0.25, 0.01 * s0)
    local = (p80(s0 + h) - p80(s0 - h)) / (2 * h)
    k0 = hp500_params(s0, r0.f80)
    m1 = min(m for m in r0.feed.mid_mm if m > k0.k1)
    s1 = (m1 - 0.3 * r0.f80) / 0.23
    css = np.linspace(s0, ceil, 361)
    p = np.array([p80(c) for c in css])
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 2.9))
    a1.plot(css, p, color=BLUE, lw=1.5, label="engine $P_{80}$ (survey 1, calibrated)")
    a1.axhline(target, color=RED, lw=0.9, ls="--", label=f"target {target:.2f} mm ($P_{{80}}$ plus 10%)")
    a1.plot([s0, s_star], [p0, target], color=GREEN, lw=1.2, ls="-", marker="o", ms=3,
            label=f"secant to the crossing, {secant:.3f} mm/mm")
    tx = np.array([s0, s0 + 12.0])
    a1.plot(tx, p0 + local * (tx - s0), color=ORANGE, lw=1.2, ls=":", label=f"local slope at {s0:.0f} mm, {local:.3f} mm/mm")
    a1.axvline(s1, color=GREY, lw=0.8, ls="-.", label=f"$K_1$ reaches the {m1:.2f} mm class at {s1:.2f} mm")
    a1.set_xlabel("closed-side setting (mm)")
    a1.set_ylabel("product $P_{80}$ (mm)")
    a1.set_title("(a) the drawn range and its secant", fontsize=8.6)
    a1.legend(fontsize=5.9, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    _clean(a1)
    step = 0.02
    xs = np.arange(s0, ceil - step, step)
    slope = np.array([(p80(x + step) - p80(x)) / step for x in xs])
    a2.plot(xs + step / 2, slope, color=BLUE, lw=0.9, label="finite difference over 0.02 mm")
    a2.axhline(secant, color=GREEN, lw=1.0, ls="-", label="secant over the opening to the target")
    a2.axvline(s1, color=GREY, lw=0.8, ls="-.")
    a2.axvline(s_star, color=RED, lw=0.8, ls="--", label=f"target reached at {s_star:.2f} mm")
    a2.set_xlabel("closed-side setting (mm)")
    a2.set_ylabel("slope of $P_{80}$ (mm per mm)")
    a2.set_title("(b) the slope is piecewise in the setting", fontsize=8.6)
    a2.legend(fontsize=5.9, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    _clean(a2)
    _save(fig, "fig-drift-response.pdf")
    print(f"drift response: P80 {p0:.3f} mm, target {target:.3f} mm at {s_star:.3f} mm, secant {secant:.4f}, local {local:.4f}, "
          f"K1 crossing {s1:.3f} mm")


def fig_replacement() -> None:
    op = Operating(**_json(DER / "manifests" / "S01.json")["params"])
    c, b = assemble_chamber(op)
    r = evaluate(op)
    f = np.array(r.feed.mass)
    p = np.array(r.product.mass)
    x = np.linalg.solve(np.eye(c.size) - b * c[None, :], f)
    nips_expected = float(np.sum(c * x))
    counts = [100, 300, 1000, 3000, 10000, 30000, 100000]
    errs, nips = [], []
    for n in counts:
        e, k = [], []
        for seed in range(5):
            walk, nip = replacement_walk(c, b, f, n, seed)
            e.append(np.max(np.abs(walk - p)))
            k.append(nip)
        errs.append(e)
        nips.append(k)
    errs, nips = np.array(errs), np.array(nips)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 2.8))
    for j in range(5):
        a1.scatter(counts, errs[:, j], color=GREY, s=10, zorder=2)
    a1.plot(counts, errs.mean(axis=1), "o-", color=BLUE, lw=1.3, ms=4, zorder=3, label="mean over five seeds")
    ref = errs.mean(axis=1)[0] * np.sqrt(counts[0] / np.array(counts))
    a1.plot(counts, ref, color=INK, ls="--", lw=0.8, label="slope $-1/2$")
    a1.set_xscale("log")
    a1.set_yscale("log")
    a1.set_xlabel("parcels in the walk")
    a1.set_ylabel("max. class difference to Whiten")
    a1.set_title("(a) product mass per class", fontsize=8.6)
    a1.legend(fontsize=6.6, frameon=True, facecolor="white", edgecolor=GRID, loc="lower left")
    _clean(a1)
    a2.plot(counts, nips.mean(axis=1), "s-", color=GREEN, lw=1.3, ms=4, label="mean nips per parcel (walk)")
    a2.fill_between(counts, nips.min(axis=1), nips.max(axis=1), color=GREEN, alpha=0.2, label="range over seeds")
    a2.axhline(nips_expected, color=INK, ls="--", lw=0.9, label=f"$\\sum_i c_i x_i$ = {nips_expected:.4f}")
    a2.set_xscale("log")
    a2.set_xlabel("parcels in the walk")
    a2.set_ylabel("nips per parcel")
    a2.set_title("(b) breakage events per parcel", fontsize=8.6)
    a2.legend(fontsize=6.6, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    _clean(a2)
    _save(fig, "fig-replacement.pdf")
    print(f"replacement walk: expected nips {nips_expected:.6f}; mean max error at {counts[-1]} parcels "
          f"{errs.mean(axis=1)[-1]:.5f}")


if __name__ == "__main__":
    fig_dataflow()
    fig_physics()
    fig_chamber()
    fig_sweeps()
    fig_surveys()
    fig_power_parity()
    fig_loo()
    fig_bands()
    fig_morrell()
    fig_contraction()
    fig_surrogate()
    fig_drift()
    fig_drift_response()
    fig_replacement()
    print("figures written to", HERE)
