#!/usr/bin/env python3
"""Figures, tables and the numbers of the text of the CrusherBayes theory manuscript, from the committed summaries.

Reads ``manuscripts/crusherbayes-theory/data/`` (``exact/*.json`` of ``sim/run_exact.py``, ``design.json`` of
``sim/run_design.py``, ``sbc.json`` and ``verify.json`` of ``sim/run_sampler.py summarize``, ``identifiability.json``,
``tau_coverage.json`` and ``pilot.json`` of ``analysis/``) and the product's ``data/derived/hp500/crusherbayes.json`` and
``manuscripts/crusherbayes/data/engine_timing.json``. Writes the figures (PDF, vector) to this folder, the tables to
``../tex/generated/tab-*.tex`` and every number the text quotes to ``../tex/generated/numbers.tex``. Nothing is typed by
hand: a number in the text is a macro defined here from a file. ``--partial`` skips a summary that does not exist yet
(during the runs); the release build runs without it and fails on a missing file.

Run:  .venv-notebooks/Scripts/python.exe manuscripts/crusherbayes-theory/figures/make_figs.py [--partial]
"""
from __future__ import annotations

import argparse
import glob
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
MS = HERE.parent
ROOT = MS.parents[1]
DATA = MS / "data"
GEN = MS / "tex" / "generated"
plt.rcParams.update({"font.size": 8, "axes.titlesize": 8, "axes.labelsize": 8, "legend.fontsize": 7, "figure.dpi": 150,
                     "pdf.fonttype": 42, "axes.spines.top": False, "axes.spines.right": False})
GRAYS = ["0.0", "0.35", "0.6", "0.8"]
MARKERS = ["o", "s", "^", "D", "v", "x"]
STYLES = ["-", "--", ":", "-."]
NS = [10, 20, 40, 80, 160]
LABEL = {"cb_oracle": "calibrated, true scalars", "cb_nominal": "calibrated, shipped scalars", "cb_ko": "calibrated, learned (KO prior)",
         "cb_orth": "calibrated, learned (orthogonal prior)", "cb_scaled": "calibrated, learned (scaled prior)",
         "ls": "least squares on setting and feed", "line": "line in the setting", "engine_nominal": "engine, shipped scalars",
         "engine_oracle": "engine, true scalars", "engine_refit": "engine refit", "constant": "training mean"}
SHORT = {"cb_oracle": "Cal. (true)", "cb_nominal": "Cal. (shipped)", "cb_ko": "Cal. KO", "cb_orth": "Cal. orth.",
         "cb_scaled": "Cal. scaled", "ls": "LS (c, f80)", "line": "Line (c)", "engine_nominal": "Engine (shipped)",
         "engine_oracle": "Engine (true)", "engine_refit": "Engine refit", "constant": "Mean"}
MACROS: dict[str, str] = {}
ENGLAB = {"affine": "affine (shipped)", "rocha": "Rocha et al. form", "rocha_half": "half exponents"}


def macro(name: str, value) -> None:
    MACROS[name] = str(value)


def fmt(x: float, d: int = 1) -> str:
    return f"{x:,.{d}f}".replace(",", "{,}")


def load(path: Path, partial: bool):
    if not path.exists():
        if partial:
            return None
        raise FileNotFoundError(f"missing summary {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def exact_cells() -> dict:
    return {json.loads(Path(f).read_text(encoding="utf-8"))["cell"]: json.loads(Path(f).read_text(encoding="utf-8"))
            for f in sorted(glob.glob(str(DATA / "exact" / "*.json")))}


def rmse(cell: dict, t: str, p: str) -> tuple[float, float]:
    s = cell["predictors_summary"][t][p]
    return s["rmse"], s["rmse_mcse"]


def save(fig, name: str) -> None:
    fig.savefig(HERE / f"{name}.pdf", bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------------------------------------------------------- figures
def fig_theory_check(cells: dict) -> None:
    """Simulated against theoretical mean squared error, every cell, the four predictors with given scalars."""
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 3.0))
    zs = []
    for ax, t, unit in zip(axes, ("tph", "kW"), ("(t/h)$^2$", "kW$^2$")):
        for k, p in enumerate(("cb_oracle", "cb_nominal", "ls", "line")):
            th, sim = [], []
            for c in cells.values():
                if t in c["theory"] and p in c["theory"][t]:
                    th.append(c["theory"][t][p]["theory_mse"])
                    sim.append(c["theory"][t][p]["sim_mse"])
                    zs.append(c["theory"][t][p]["z"])
            ax.loglog(th, sim, MARKERS[k], ms=3, mfc="none", color=GRAYS[k], label=SHORT[p])
        lo, hi = ax.get_xlim()
        ax.plot([lo, hi], [lo, hi], "-", lw=0.6, color="0.5")
        ax.xaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
        ax.yaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
        ax.set_xlabel(f"theoretical mean squared error {unit}")
        ax.set_ylabel(f"simulated mean squared error {unit}")
        ax.set_title("throughput" if t == "tph" else "power")
    axes[0].legend(frameon=False)
    save(fig, "fig-theory-check")
    z = np.abs(np.array(zs))
    macro("zMax", fmt(float(z.max()), 2))
    macro("zNum", f"{z.size:,}".replace(",", "{,}"))
    macro("zOverTwo", int((z > 2).sum()))
    macro("zOverThree", int((z > 3).sum()))
    macro("zExpectTwo", fmt(0.0455 * z.size, 0))


def fig_align(cells: dict) -> None:
    """V1: the paired difference of squared error of the calibrated predictor (true scalars) minus least squares, power."""
    alphas = [-1, 0, 0.5, 1, 2]
    names = {-1: "V1_am1_k0", 0: "V1_a0_k0", 0.5: "V1_a0p5_k0", 1: "V1_a1_k0", 2: "V1_a2_k0"}
    fig, ax = plt.subplots(figsize=(3.5, 2.8))
    for k, (d, n) in enumerate((("surveys", 10), ("surveys", 160), ("wide", 160), ("extrapolation", 160))):
        y, e = [], []
        for a in alphas:
            c = cells[f"{names[a]}-{d}-n{n}"]
            q = c["paired"]["kW"]["cb_oracle"]["vs_ls"]
            y.append(q["mean"])
            e.append(q["mcse"])
        ax.errorbar(alphas, y, yerr=1.96 * np.array(e), fmt=MARKERS[k] + STYLES[k % 4], ms=3, lw=0.8, color=GRAYS[k],
                    mfc="none", capsize=2, label=f"{d}, n = {n}")
        if n == 160:
            ax.plot(alphas, [-cells[f"{names[a]}-{d}-n{n}"]["fixed_design"]["kW"]["oracle"]["C"] for a in alphas], "x",
                    color="0.0", ms=4, label="theory, $-C$" if d == "surveys" else None)
    ax.axhline(0, color="0.5", lw=0.6)
    ax.axvline(0.5, color="0.5", lw=0.6, ls=":")
    ax.set_xlabel(r"share $\alpha$ of the engine's curvature in the plant")
    ax.set_ylabel("paired difference of squared error (kW$^2$)")
    ax.legend(frameon=False)
    save(fig, "fig-align")


def plant_name(cells: dict, prefix: str) -> str:
    return prefix


def fig_capacity(cells: dict) -> None:
    """C-cap: the RMSE of the calibrated predictor over that of least squares, against n, per engine and design."""
    fig, axes = plt.subplots(1, 3, figsize=(7.0, 2.6), sharey=True)
    for ax, d in zip(axes, ("surveys", "wide", "extrapolation")):
        for k, eng in enumerate(("affine", "rocha", "rocha_half")):
            for j, p in enumerate(("cb_oracle", "cb_ko")):
                r = [rmse(cells[f"Ccap_{eng}-{d}-n{n}"], "tph", p)[0] / rmse(cells[f"Ccap_{eng}-{d}-n{n}"], "tph", "ls")[0]
                     for n in NS]
                ax.semilogx(NS, r, MARKERS[k] + STYLES[j], ms=3, lw=0.8, color=GRAYS[k], mfc="none" if j else GRAYS[k],
                            label=f"{ENGLAB[eng]}, {'true' if p == 'cb_oracle' else 'learned'} scale")
        ax.axhline(1, color="0.5", lw=0.6)
        ax.set_xticks(NS)
        ax.set_xticklabels([str(n) for n in NS])
        ax.set_xlabel("training surveys n")
        ax.set_title(d)
    axes[0].set_ylabel("RMSE relative to least squares")
    axes[0].legend(frameon=False, fontsize=6, loc="lower right")
    save(fig, "fig-capacity")


def fig_nsweep(cells: dict) -> None:
    """V0: RMSE against n on the surveys window for the main predictors, both outputs."""
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.7))
    preds = ("cb_oracle", "cb_ko", "ls", "line", "engine_refit")
    for ax, t, unit in zip(axes, ("tph", "kW"), ("t/h", "kW")):
        for k, p in enumerate(preds):
            r = [rmse(cells[f"V0-surveys-n{n}"], t, p) for n in NS]
            sty = [("o", "-", "0.0"), ("s", "--", "0.3"), ("^", ":", "0.5"), ("D", "-.", "0.7"), ("v", (0, (1, 1)), "0.0")][k]
            ax.errorbar(NS, [x[0] for x in r], yerr=[1.96 * x[1] for x in r], marker=sty[0], linestyle=sty[1], ms=3,
                        lw=0.8, color=sty[2], mfc="none", capsize=2, label=SHORT[p])
        ax.set_xscale("log")
        ax.set_xticks(NS)
        ax.set_xticklabels([str(n) for n in NS])
        ax.set_xlabel("training surveys n")
        ax.set_ylabel(f"RMSE ({unit})")
        ax.set_title("throughput" if t == "tph" else "power")
    axes[1].legend(frameon=False)
    save(fig, "fig-nsweep")


def fig_tau(tc: dict) -> None:
    fig, ax = plt.subplots(figsize=(3.5, 2.7))
    taus = tc["tau"]["taus"]
    for k, n in enumerate(("10", "20", "40", "160")):
        r = tc["tau"]["by_n"][n]
        ax.semilogx(taus, r["rmse_cb"], STYLES[k], color=GRAYS[k], lw=1, label=f"n = {n}")
        ax.plot([taus[0], taus[-1]], [r["rmse_ls"]] * 2, STYLES[k], color=GRAYS[k], lw=0.4)
    ax.axvline(tc["tau"]["tau_product"], color="0.3", lw=0.6, ls="--")
    for d in tc["tau"]["by_n"]["10"]["abs_delta_k"]:
        ax.axvline(d, color="0.7", lw=0.5, ls=":")
    ax.set_xlabel(r"discrepancy scale $\tau$ (kW)")
    ax.set_ylabel("RMSE on power (kW)")
    ax.legend(frameon=False)
    save(fig, "fig-tau")
    r10, r160 = tc["tau"]["by_n"]["10"], tc["tau"]["by_n"]["160"]
    macro("tauBestTen", fmt(r10["tau_best"], 0))
    macro("tauBestOneSixty", fmt(r160["tau_best"], 0))
    macro("tauRmseBestTen", fmt(r10["rmse_cb_best"], 2))
    macro("tauRmseProdTen", fmt(r10["rmse_cb_at_product_tau"], 2))
    macro("tauRmseLsTen", fmt(r10["rmse_ls"], 2))
    macro("tauRmseLineTen", fmt(r10["rmse_line"], 2))
    macro("tauRmseProdOneSixty", fmt(r160["rmse_cb_at_product_tau"], 2))
    macro("tauRmseLsOneSixty", fmt(r160["rmse_ls"], 2))
    macro("tauRmseLineOneSixty", fmt(r160["rmse_line"], 2))
    dk = r10["abs_delta_k"]
    macro("deltaOne", fmt(dk[0], 1))
    macro("deltaTwo", fmt(dk[1], 1))
    macro("deltaThree", fmt(dk[2], 1))
    cov = [v["coverage80_exact"] for v in tc["coverage"].values()]
    macro("covExactMin", fmt(min(cov), 3))
    macro("covExactMax", fmt(max(cov), 3))


def fig_ceiling(idf: dict) -> None:
    fig, ax = plt.subplots(figsize=(3.5, 2.6))
    ns = idf["sweep"]["n"]
    for k, key in enumerate(("fixed_speed", "varied_speed")):
        ax.semilogx(ns, [idf["sweep"][key][str(n)]["q_ref_tph"] for n in ns], MARKERS[k] + STYLES[k], ms=3, lw=0.8,
                    color=GRAYS[k], mfc="none", label="fixed speed" if k == 0 else "speed 324, 360, 396 rpm")
    ten = idf["ten_surveys"]
    ax.axhline(ten["floor_ratio_lnq_any_n_fixed_speed"], color="0.3", lw=0.6, ls="--", label="floor, any n")
    ax.plot([10], [ten["measured_ratio_sampled_scale"]["q_ref_tph"]], "*", color="0.0", ms=7, label="sampler, ten surveys")
    ax.set_xlabel("surveys n")
    ax.set_ylabel(r"posterior/prior sd of $\ln Q_{\mathrm{ref}}$")
    ax.legend(frameon=False)
    save(fig, "fig-ceiling")
    macro("ceilInfo", fmt(ten["tph_lnq_info_exact"], 1))
    macro("ceilBound", fmt(ten["tph_lnq_ceiling"], 1))
    macro("ceilPrior", fmt(ten["lnq_prior_precision"], 0))
    macro("ceilTphOnly", fmt(ten["tph_only_ratio_lnq"], 3))
    macro("ceilFloor", fmt(ten["floor_ratio_lnq_any_n_fixed_speed"], 3))
    macro("ceilLinTen", fmt(ten["linearized_ratio"]["q_ref_tph"], 3))
    macro("ceilMeasTen", fmt(ten["measured_ratio_sampled_scale"]["q_ref_tph"], 3))
    macro("ceilSweepMax", fmt(idf["sweep"]["fixed_speed"][str(ns[-1])]["q_ref_tph"], 3))
    macro("ceilSweepVaried", fmt(idf["sweep"]["varied_speed"][str(ns[-1])]["q_ref_tph"], 3))
    macro("ceilSweepN", ns[-1])
    macro("productRel", "$" + f"{ten['power_product_sensitivity_rel_diff']:.0e}".replace("e-", r"\times10^{-") + "}$")
    lin, flo = ten["linearized_ratio"]["q_ref_tph"], ten["floor_ratio_lnq_any_n_fixed_speed"]
    share = (1 - lin) / (1 - flo)
    macro("ceilShare", fmt(100 * share, 0))
    macro("ceilSharePrec", fmt(100 * (1 / lin ** 2 - 1) / (1 / flo ** 2 - 1), 0))
    meas = ten["measured_ratio_sampled_scale"]["q_ref_tph"]
    macro("ceilShareMeas", fmt(100 * (1 - meas) / (1 - flo), 0))


DESIGN_ROWS = [("D0", None, "ten surveys (throughput, power)"), ("D2", None, "ten surveys, speed 324 to 396 rpm"),
               ("D3", None, "twenty surveys, surveys window"), ("D4", None, "ten surveys, wide window"),
               ("D1", "sigma_10pct", "ten surveys and P80, noise 10\\pct{}"),
               ("D1", "sigma_5pct", "ten surveys and P80, noise 5\\pct{}"),
               ("D1", "sigma_2pct", "ten surveys and P80, noise 2\\pct{}"),
               ("D5", "sigma_2pct", "P80 (2\\pct{}) and varied speed")]
SCALAR_TEX = {"q_ref_tph": r"$Q_{\mathrm{ref}}$", "wi_kwh_t": r"$W_i$", "zeta": r"$\zeta$", "pn_kw": r"$P_n$",
              "k1_scale": r"$s_{K_1}$", "k2_scale": r"$s_{K_2}$", "k3": r"$K_3$", "t10_shift_pct": r"$\Delta t_{10}$"}


def design_entry(doc: dict, key: str, variant: str | None) -> tuple[float, dict]:
    v = doc["designs"][key]
    if variant is not None:
        v = v["variants"][variant]
    eig = v["eig_nats"]["mean"] if isinstance(v["eig_nats"], dict) else v["eig_nats"]
    con = {k: (c["mean"] if isinstance(c, dict) else c) for k, c in v["contraction"].items()}
    return eig, con


def design_outputs(doc: dict) -> None:
    rows = []
    entries = []
    for key, var, lab in DESIGN_ROWS:
        eig, con = design_entry(doc, key, var)
        entries.append((lab, con))
        rows.append([lab, fmt(eig, 2)] + [fmt(con[k], 2) for k in SCALAR_TEX])
    table("design", ["Design", "EIG (nats)"] + list(SCALAR_TEX.values()), rows, "@{}l" + "r" * 9 + "@{}")
    fig, ax = plt.subplots(figsize=(7.0, 2.6))
    names = list(SCALAR_TEX)
    pick = [0, 2, 3, 6]
    width = 0.8 / len(pick)
    for j, i in enumerate(pick):
        lab, con = entries[i]
        ax.bar(np.arange(len(names)) + (j - (len(pick) - 1) / 2) * width, [con[k] for k in names], width,
               color=GRAYS[j], edgecolor="0.0", lw=0.4, label=lab.replace("\\pct{}", "%"))
    ax.set_xticks(np.arange(len(names)))
    ax.set_xticklabels([SCALAR_TEX[k] for k in names])
    ax.axhline(1, color="0.5", lw=0.6)
    ax.set_ylabel("posterior/prior sd")
    ax.legend(frameon=False, ncol=4, loc="lower center", bbox_to_anchor=(0.5, 1.02), fontsize=6)
    save(fig, "fig-design")
    e0, c0 = design_entry(doc, "D0", None)
    e2, _ = design_entry(doc, "D2", None)
    e3, c3 = design_entry(doc, "D3", None)
    e4, _ = design_entry(doc, "D4", None)
    e12, c12 = design_entry(doc, "D1", "sigma_2pct")
    e15, _ = design_entry(doc, "D1", "sigma_5pct")
    e110, _ = design_entry(doc, "D1", "sigma_10pct")
    for name, val in (("eigDzero", e0), ("eigDtwo", e2), ("eigDthree", e3), ("eigDfour", e4), ("eigPtwo", e12),
                      ("eigPfive", e15), ("eigPten", e110)):
        macro(name, fmt(val, 2))
    macro("kOneDzero", fmt(c0["k1_scale"], 2))
    macro("kOnePtwo", fmt(c12["k1_scale"], 2))
    macro("kOneDthree", fmt(c3["k1_scale"], 2))
    macro("kTwoPtwo", fmt(c12["k2_scale"], 2))
    macro("tTenPtwo", fmt(c12["t10_shift_pct"], 2))
    macro("kThreePtwo", fmt(c12["k3"], 2))
    v = doc["designs"]["D1"]["variants"]["sigma_2pct"]
    macro("pEightyMean", fmt(v["p80_mean_mm"], 1))


def pm(q: dict, d: int = 1) -> str:
    """A paired mean with its 95 percent Monte Carlo interval half-width."""
    return f"{fmt(q['mean'], d)}\\pm{fmt(1.96 * q['mcse'], d)}"


def exact_macros(cells: dict) -> None:
    """Every number of the results section that comes from the closed-form study."""
    v1 = {-1: "V1_am1_k0", 0: "V1_a0_k0", 0.5: "V1_a0p5_k0", 1: "V1_a1_k0", 2: "V1_a2_k0"}
    word = {-1: "Am", 0: "Azero", 0.5: "Ahalf", 1: "Aone", 2: "Atwo"}
    for a, nm in v1.items():
        for d, tag in (("surveys", "S"), ("extrapolation", "X"), ("wide", "W")):
            c160 = cells[f"{nm}-{d}-n160"]
            macro(f"al{word[a]}{tag}", f"{pm(c160['paired']['kW']['cb_oracle']['vs_ls'])}")
            macro(f"alC{word[a]}{tag}", fmt(c160["fixed_design"]["kW"]["oracle"]["C"], 1))
        macro(f"al{word[a]}Ten", pm(cells[f"{nm}-surveys-n10"]["paired"]["kW"]["cb_oracle"]["vs_ls"]))
    fd = cells["V1_a1_k0-surveys-n10"]["fixed_design"]["kW"]["oracle"]
    macro("alPlaneTen", fmt(fd["plane_sum"], 1))
    macro("eRmsS", fmt(cells["V1_a1_k0-surveys-n160"]["fixed_design"]["kW"]["oracle"]["e_rms"], 1))
    macro("eRmsW", fmt(cells["V1_a1_k0-wide-n160"]["fixed_design"]["kW"]["oracle"]["e_rms"], 1))
    sig_kw = cells["V0-surveys-n10"]["sigma"]["kW"]
    sig_t = cells["V0-surveys-n10"]["sigma"]["tph"]
    macro("curvShareKw", fmt(100 * fd["C"] / sig_kw ** 2, 1))
    macro("alKqS", pm(cells["V1_a1_k2-surveys-n160"]["paired"]["kW"]["cb_oracle"]["vs_ls"]))

    def ratio(cell, p, ref="ls"):
        s = cells[cell]["predictors_summary"]["tph"]
        return s[p]["rmse"] / s[ref]["rmse"]
    for eng, tag in (("affine", "Aff"), ("rocha", "Ro"), ("rocha_half", "Half")):
        for d, dt in (("surveys", "S"), ("wide", "W"), ("extrapolation", "X")):
            for n in (10, 160):
                macro(f"cap{tag}{dt}{'Ten' if n == 10 else 'Big'}", fmt(ratio(f"Ccap_{eng}-{d}-n{n}", "cb_oracle"), 3))
    macro("capRoRefitXTen", fmt(ratio("Ccap_rocha-extrapolation-n10", "engine_refit"), 3))
    macro("capRoRefitSBig", fmt(ratio("Ccap_rocha-surveys-n160", "engine_refit"), 3))
    macro("capAffRefitSBig", fmt(ratio("Ccap_affine-surveys-n160", "engine_refit"), 3))
    for d, dt in (("surveys", "S"), ("wide", "W")):
        f = cells[f"Ccap_rocha_half-{d}-n160"]["fixed_design"]["tph"]["oracle"]
        er = (f["C"] + f["e_rms"] ** 2) / 2
        macro(f"halfRho{dt}", fmt(er / (f["e_rms"] * f["r_rms"]), 2))
        macro(f"halfKappa{dt}", fmt(f["e_rms"] / f["r_rms"], 2))
    fr = cells["Ccap_rocha-surveys-n160"]["fixed_design"]["tph"]["oracle"]
    macro("rRmsTph", fmt(fr["r_rms"], 1))
    macro("rRmsTphW", fmt(cells["Ccap_rocha-wide-n160"]["fixed_design"]["tph"]["oracle"]["r_rms"], 1))
    macro("curvCeilTph", fmt(100 * fr["r_rms"] ** 2 / sig_t ** 2, 1))
    macro("rOverSigma", fmt(100 * fr["r_rms"] / sig_t, 0))
    # sample size and the line
    for t, tt in (("kW", "Kw"), ("tph", "Tph")):
        for d, dt in (("surveys", "S"), ("wide", "W")):
            f = cells[f"V0-{d}-n10"]["fixed_design"][t]["oracle"]
            macro(f"nStar{tt}{dt}", fmt(f["n_star"], 1))
            macro(f"phiTwo{tt}{dt}", fmt(f["phi2"], 0))
            macro(f"cFix{tt}{dt}", fmt(f["C"], 1))
            macro(f"planeTen{tt}{dt}", fmt(f["plane_sum"], 1))
    for n in (10, 20, 40):
        pa = cells[f"V0-surveys-n{n}"]["paired"]["kW"]
        macro(f"lineOr{['Ten', 'Twenty', 'Forty'][[10, 20, 40].index(n)]}", pm(pa["cb_oracle"]["vs_line"]))
        macro(f"lineKo{['Ten', 'Twenty', 'Forty'][[10, 20, 40].index(n)]}", pm(pa["cb_ko"]["vs_line"]))

    def r1(cell, t, p, d=1):
        return fmt(cells[cell]["predictors_summary"][t][p]["rmse"], d)
    for p, tag in (("cb_oracle", "Or"), ("cb_ko", "Ko"), ("ls", "Ls"), ("line", "Line"), ("engine_refit", "Refit"),
                   ("cb_nominal", "Nom"), ("cb_orth", "Orth"), ("cb_scaled", "Sc"), ("engine_oracle", "EngOr")):
        macro(f"rVzeroRealKw{tag}", r1("V0-real-n10", "kW", p))
        macro(f"rVzeroSTenKw{tag}", r1("V0-surveys-n10", "kW", p))
        macro(f"rVzeroSBigKw{tag}", r1("V0-surveys-n160", "kW", p))
        macro(f"rVzeroWTenKw{tag}", r1("V0-wide-n10", "kW", p))
        macro(f"rVzeroSTenTph{tag}", r1("V0-surveys-n10", "tph", p))
        macro(f"rVtwoSTenKw{tag}", r1("V2-surveys-n10", "kW", p))
        macro(f"rVtwoSBigKw{tag}", r1("V2-surveys-n160", "kW", p))
        macro(f"rVtwoSTenTph{tag}", r1("V2-surveys-n10", "tph", p))
        macro(f"rVamWFortyKw{tag}", r1("V1_am1_k0-wide-n40", "kW", p))
    f2 = cells["V2-surveys-n160"]["fixed_design"]["kW"]["oracle"]
    er = (f2["C"] + f2["e_rms"] ** 2) / 2
    macro("vtwoRho", fmt(er / (f2["e_rms"] * f2["r_rms"]), 2))
    macro("vtwoKappa", fmt(f2["e_rms"] / f2["r_rms"], 2))
    macro("vtwoC", fmt(f2["C"], 1))
    l2 = cells["V2-surveys-n10"]["oracle"]["l2_projection"]
    macro("ltwoStart", fmt(l2["objective_start"], 0))
    macro("ltwoEnd", fmt(l2["objective"], 0))
    macro("ltwoIters", len(l2["iterations"]))
    # coverage
    covs = {p: [] for p in ("cb_oracle", "cb_ko", "cb_nominal", "ls", "line", "engine_refit")}
    for c in cells.values():
        if c["cell"].startswith("V1_a1_k2-extrapolation"):
            continue                          # reported on its own: the added curvature grows outside the window
        for t in c["outputs"]:
            for p in covs:
                if p in c["predictors_summary"][t]:
                    covs[p].append(c["predictors_summary"][t][p]["coverage80"])
    for p, tag in (("cb_oracle", "Or"), ("cb_ko", "Ko"), ("cb_nominal", "Nom"), ("ls", "Ls"), ("engine_refit", "Refit")):
        macro(f"cov{tag}Min", fmt(min(covs[p]), 3))
        macro(f"cov{tag}Max", fmt(max(covs[p]), 3))
    macro("covOrSimRealKw", fmt(cells["V0-real-n10"]["predictors_summary"]["kW"]["cb_oracle"]["coverage80"], 3))
    macro("covOrSimXTenKw", fmt(cells["V0-extrapolation-n10"]["predictors_summary"]["kW"]["cb_oracle"]["coverage80"], 3))
    # the corrections of the second reading: scopes and the numbers they quote
    for d, dt in (("surveys", "S"), ("wide", "W"), ("extrapolation", "X")):
        r = ratio(f"Ccap_rocha-{d}-n160", "cb_oracle")
        macro(f"capRoMse{dt}", fmt(100 * (1 - r * r), 1))
        macro(f"capRoRmse{dt}", fmt(100 * (1 - r), 1))
    q = cells["V2-surveys-n160"]["paired"]["kW"]["cb_oracle"]["vs_ls"]
    macro("vtwoPairedBig", pm(q))
    macro("vtwoMinusC", fmt(-cells["V2-surveys-n160"]["fixed_design"]["kW"]["oracle"]["C"], 1))
    pt = cells["V0-surveys-n10"]["paired"]["tph"]
    macro("lsLineTphTen", pm(pt["ls"]["vs_line"], 0))
    macro("cbLineTphTen", pm(pt["cb_oracle"]["vs_line"], 0))
    macro("lsLineTphTwenty", pm(cells["V0-surveys-n20"]["paired"]["tph"]["ls"]["vs_line"], 0))
    macro("lineOrWTen", pm(cells["V0-wide-n10"]["paired"]["kW"]["cb_oracle"]["vs_line"]))
    macro("lineKoWTwenty", pm(cells["V0-wide-n20"]["paired"]["kW"]["cb_ko"]["vs_line"]))
    macro("lineOrRealKw", pm(cells["V0-real-n10"]["paired"]["kW"]["cb_oracle"]["vs_line"]))
    w = cells["V0-wide-n10"]["predictors_summary"]["kW"]
    macro("scaledWideWorse", fmt(100 * (w["cb_scaled"]["rmse"] / w["cb_ko"]["rmse"] - 1), 1))
    macro("covAmXBigSim", fmt(cells["V1_am1_k0-extrapolation-n160"]["predictors_summary"]["kW"]["cb_oracle"]["coverage80"], 3))
    th = [c["theory"][t][p]["theory_mse"] for c in cells.values() for t in c["theory"] for p in c["theory"][t]]
    macro("theoryMseLo", fmt(min(th), 0))
    macro("theoryMseHi", fmt(max(th), 0))
    rel = [(s["mse_mcse"] / s["mse"], p) for c in cells.values() for t in c["outputs"]
           for p, s in c["predictors_summary"][t].items()]
    macro("mcseMedian", fmt(100 * float(np.median([x for x, _ in rel])), 1))
    macro("mcseMainMax", fmt(100 * max(x for x, p in rel if p in ("cb_oracle", "cb_ko", "ls", "line")), 1))
    macro("mcseMax", fmt(100 * max(x for x, _ in rel), 1))
    macro("covOrSimWTenKw", fmt(cells["V0-wide-n10"]["predictors_summary"]["kW"]["cb_oracle"]["coverage80"], 3))
    q = cells["V1_a1_k2-extrapolation-n160"]["predictors_summary"]["kW"]
    macro("covKqXOr", fmt(q["cb_oracle"]["coverage80"], 2))
    macro("covKqXLs", fmt(q["ls"]["coverage80"], 2))
    macro("covKqXTenOr", fmt(cells["V1_a1_k2-extrapolation-n10"]["predictors_summary"]["kW"]["cb_oracle"]["coverage80"], 2))


SBC_TEX = {"q_ref_tph": r"$\ln Q_{\mathrm{ref}}$", "wi_kwh_t": r"$\ln W_i$", "zeta": r"$\ln\zeta$", "pn_kw": r"$P_n$",
           "k1_scale": r"$\ln s_{K_1}$", "k2_scale": r"$\ln s_{K_2}$", "k3": r"$K_3$", "t10_shift_pct": r"$\Delta t_{10}$",
           "log_sigma_tph": r"$\ln\sigma_{\mathrm{tph}}$", "log_sigma_kW": r"$\ln\sigma_{\mathrm{kW}}$",
           "discrepancy_tph_constant": r"$d_{\mathrm{tph},0}$", "discrepancy_tph_css": r"$d_{\mathrm{tph},c}$",
           "discrepancy_tph_f80": r"$d_{\mathrm{tph},f}$", "discrepancy_kW_constant": r"$d_{\mathrm{kW},0}$",
           "discrepancy_kW_css": r"$d_{\mathrm{kW},c}$", "discrepancy_kW_f80": r"$d_{\mathrm{kW},f}$",
           "loglik": "log likelihood"}


def binom_band(n: int, p: float, lo: float = 0.005, hi: float = 0.995) -> tuple[int, int]:
    """The 99 percent band of a Binomial(n, p) count (Talts et al.'s histogram band), from the exact cumulative mass."""
    pmf = [math.comb(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n + 1)]
    cdf = np.cumsum(pmf)
    return int(np.searchsorted(cdf, lo)), int(np.searchsorted(cdf, hi))


def sampler_outputs(sbc: dict, ver: dict) -> None:
    """The simulation-based calibration and the verification of the full sampler."""
    N, B = sbc["n_posteriors"], sbc["bins"]
    lo, hi = binom_band(N, 1.0 / B)
    names = [k for k in SBC_TEX if k in sbc["ranks"]]
    fig, axes = plt.subplots(3, 6, figsize=(7.0, 3.6), sharey=True)
    for ax, nm in zip(axes.flat, names):
        h = sbc["ranks"][nm]["histogram"]
        ax.bar(range(B), h, width=0.9, color="0.6", edgecolor="0.0", lw=0.3)
        ax.axhspan(lo, hi, color="0.85", zorder=0)
        ax.set_title(SBC_TEX[nm], fontsize=7)
        ax.set_xticks([])
    for ax in list(axes.flat)[len(names):]:
        ax.axis("off")
    fig.text(0.5, 0.01, "rank bin (10 bins of the 100 ranks)", ha="center")
    fig.text(0.005, 0.5, "posteriors", va="center", rotation=90)
    fig.tight_layout(rect=(0.02, 0.03, 1, 1))
    save(fig, "fig-sbc")
    pv = {nm: sbc["ranks"][nm]["p_value"] for nm in names}
    rows = [[SBC_TEX[nm], fmt(sbc["ranks"][nm]["chi2"], 1), f"{pv[nm]:.3f}"] for nm in names]
    half = (len(rows) + 1) // 2
    paired = [rows[i] + (rows[i + half] if i + half < len(rows) else ["", "", ""]) for i in range(half)]
    table("sbc", ["Quantity", "$\\chi^2_9$", "$p$", "Quantity", "$\\chi^2_9$", "$p$"], paired, "@{}lrrlrr@{}")
    worst = min(pv, key=pv.get)
    macro("sbcN", N)
    macro("sbcConverged", sbc["converged"])
    macro("sbcSteps", f"{sbc['config']['steps']:,}".replace(",", "{,}"))
    macro("sbcBurn", f"{sbc['config']['burn']:,}".replace(",", "{,}"))
    macro("sbcMinP", f"{pv[worst]:.3f}")
    macro("sbcMinPName", SBC_TEX[worst])
    macro("sbcLikP", f"{pv['loglik']:.3f}")
    macro("sbcBelowOne", sum(1 for v in pv.values() if v < 0.01))
    macro("sbcBonfP", f"{0.05 / len(pv):.4f}")
    macro("sbcBelowBonf", sum(1 for v in pv.values() if v < 0.05 / len(pv)))
    macro("sbcQuantities", len(pv))
    macro("sbcBandLo", lo)
    macro("sbcBandHi", hi)
    macro("sbcWallHours", fmt(sbc["wall_seconds_mean"] / 3600, 2))
    macro("sbcTauMax", fmt(sbc["tau_max_max"], 0))
    macro("sbcRedraws", sbc["redraws_engine_failure"])
    rows = []
    for cell, lab in (("V0-real-n10", "V0, real, n = 10"), ("V2-real-n10", "V2, real, n = 10"), ("V0-surveys-n10", "V0, surveys, 10")):
        c = ver["cells"][cell]
        for t, unit in (("tph", "t/h"), ("kW", "kW")):
            o = c["outputs"][t]
            r_s = math.sqrt(o["sampler"]["mse"]["mean"])
            row = [f"{lab}, {'throughput' if t == 'tph' else 'power'}", fmt(r_s, 1)]
            for p in ("cb_oracle", "cb_ko", "ls"):
                row.append(fmt(math.sqrt(o["exact"][p]["mse"]["mean"]), 1))
            q = o["paired_mse"]["sampler_minus_cb_ko"]
            row.append(f"${fmt(q['mean'], 0)}\\pm{fmt(1.96 * q['mcse'], 0)}$")
            row.append(fmt(o["sampler"]["coverage80"]["mean"], 2))
            rows.append(row)
        macro(f"verN{['VzeroReal', 'VtwoReal', 'VzeroS'][[ 'V0-real-n10', 'V2-real-n10', 'V0-surveys-n10'].index(cell)]}",
              c["n_posteriors"])
    table("verify", ["Cell, output", "Sampler", "True", "KO lin.", "LS", "Sampler $-$ KO", "Cov."], rows, "@{}lrrrrrr@{}")
    macro("verPosteriors", ver["n_posteriors"])
    macro("verConverged", sum(c["converged"] for c in ver["cells"].values()))
    macro("verWallHours", fmt(np.mean([c["wall_seconds_mean"] for c in ver["cells"].values()]) / 3600, 2))


# ---------------------------------------------------------------------------------------------------------------- tables
def table(name: str, header: list[str], rows: list[list[str]], align: str) -> None:
    lines = [r"\begin{tabular}{" + align + "}", r"\toprule", " & ".join(header) + r" \\", r"\midrule"]
    lines += [" & ".join(r) + r" \\" for r in rows]
    lines += [r"\bottomrule", r"\end{tabular}"]
    (GEN / f"tab-{name}.tex").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def tab_scalars(fit_doc: dict) -> None:
    import sys
    sys.path.insert(0, str(ROOT / "data-pipeline"))
    from pipeline.hp500 import crusherbayes as cb
    rows_by = {c["name"]: c for c in fit_doc["contraction"]}
    sym = {"q_ref_tph": r"$Q_{\mathrm{ref}}$ (t/h)", "wi_kwh_t": r"$W_i$ (kWh/t)", "zeta": r"$\zeta$", "pn_kw": r"$P_n$ (kW)",
           "k1_scale": r"$s_{K_1}$", "k2_scale": r"$s_{K_2}$", "k3": r"$K_3$", "t10_shift_pct": r"$\Delta t_{10}$ (points)"}
    rows = []
    for p in cb.PRIORS:
        rows.append([sym[p.name], fmt(p.nominal, 2), ("log " if p.log else "") + fmt(p.sd, 2),
                     fmt(rows_by[p.name]["posterior_mean"], 3)])
    table("scalars", ["Scalar", "Shipped", "Prior sd", "Plant truth"], rows, "@{}lrrr@{}")


def tab_cells(cells: dict) -> None:
    def count(prefix):
        return sum(1 for k in cells if k.startswith(prefix))
    rows = [["V0", "throughput, power", "real; surveys, wide, extrapolation", "10; 10 to 160", "11", f"{count('V0-')}"],
            ["V1($\\alpha$, 0), 5 values", "power", "the same", "the same", "11", f"{sum(count(f'V1_a{a}_k0-') for a in ('m1', '0', '0p5', '1', '2'))}"],
            ["V1(1, 2)", "power", "the same", "the same", "11", f"{count('V1_a1_k2-')}"],
            ["V2", "throughput, power", "the same", "the same", "11", f"{count('V2-')}"],
            ["C-cap, 3 engines", "throughput", "the same", "the same", "9", f"{count('Ccap_')}"]]
    table("cells", ["Plant", "Outputs", "Designs", "n", "Predictors", "Cells"], rows, "@{}llllrr@{}")
    any_cell = next(iter(cells.values()))
    macro("cellsTotal", len(cells))
    macro("repsPerCell", f"{any_cell['reps']:,}".replace(",", "{,}"))


def tab_main(cells: dict) -> None:
    keys = [("V0-real-n10", "kW", "V0, real, n = 10"), ("V0-surveys-n160", "kW", "V0, surveys, n = 160"),
            ("V1_am1_k0-surveys-n160", "kW", "V1($-1$), surveys, 160"), ("V1_a2_k0-surveys-n160", "kW", "V1(2), surveys, 160"),
            ("V2-real-n10", "tph", "V2 tph, real, 10"), ("V2-extrapolation-n40", "tph", "V2 tph, extrap., 40"),
            ("Ccap_rocha-extrapolation-n40", "tph", "Rocha engine, extrap., 40")]
    preds = ["cb_oracle", "cb_ko", "ls", "line", "engine_refit"]
    rows = []
    for k, t, lab in keys:
        c = cells[k]
        row = [lab]
        for p in preds:
            if p in c["predictors_summary"][t]:
                m, s = rmse(c, t, p)
                row.append(f"{m:.1f} $\\pm$ {1.96 * s:.1f}")
            else:
                row.append("--")
        rows.append(row)
    table("main", ["Cell"] + [SHORT[p] for p in preds], rows, "@{}lrrrrr@{}")


def tab_priors(cells: dict) -> None:
    rows = []
    for k, t, lab in [("V0-surveys-n10", "kW", "V0 power, surveys, 10"), ("V0-surveys-n160", "kW", "V0 power, surveys, 160"),
                      ("V0-surveys-n10", "tph", "V0 tph, surveys, 10"), ("V2-surveys-n10", "tph", "V2 tph, surveys, 10"),
                      ("V2-extrapolation-n40", "kW", "V2 power, extrap., 40"), ("V1_am1_k0-wide-n40", "kW", "V1($-1$) power, wide, 40")]:
        c = cells[k]
        row = [lab]
        for p in ("cb_oracle", "cb_nominal", "cb_ko", "cb_orth", "cb_scaled", "engine_refit", "ls"):
            m, s = rmse(c, t, p)
            row.append(f"{m:.1f}")
        rows.append(row)
    table("ablation", ["Cell", "True", "Shipped", "KO", "Orth.", "Scaled", "No discr.", "LS"], rows, "@{}lrrrrrrr@{}")


def write_numbers(fit_doc: dict, timing: dict, pilot: dict) -> None:
    rows = {c["name"]: c for c in fit_doc["contraction"]}
    macro("sigTph", fmt(rows["sigma_tph"]["posterior_mean"], 1))
    macro("sigKw", fmt(rows["sigma_kW"]["posterior_mean"], 1))
    macro("engineMs", fmt(timing["ms_per_evaluation_median"], 2))
    evals = fit_doc["method"]["walkers"] * fit_doc["method"]["steps"] * (fit_doc["n"] - 1)
    macro("cbCpuHours", fmt(evals * timing["ms_per_evaluation_median"] / 1000 / 3600, 1))
    macro("tauTen", fmt([f for f in fit_doc["convergence"]["folds"] if f["fold"] == "all"][0]["tau_max"], 0))
    macro("pilotPlantKw", fmt(pilot["kW"]["plant_departure_sd"], 1))
    macro("pilotEngKw", fmt(pilot["kW"]["engine_departure_sd"], 2))
    macro("pilotPlantTph", fmt(pilot["tph"]["plant_departure_sd"], 1))
    macro("pilotEngTph", fmt(pilot["tph"]["engine_departure_sd"], 2))
    macro("pilotCorrKw", fmt(pilot["kW"]["corr"], 2))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--partial", action="store_true")
    a = ap.parse_args()
    GEN.mkdir(parents=True, exist_ok=True)
    fit_doc = json.loads((ROOT / "data/derived/hp500/crusherbayes.json").read_text(encoding="utf-8"))
    timing = json.loads((ROOT / "manuscripts/crusherbayes/data/engine_timing.json").read_text(encoding="utf-8"))
    pilot = load(DATA / "pilot.json", False)
    write_numbers(fit_doc, timing, pilot)
    tab_scalars(fit_doc)
    fig_ceiling(load(DATA / "identifiability.json", False))
    fig_tau(load(DATA / "tau_coverage.json", False))
    design_outputs(load(DATA / "design.json", False))
    cells = exact_cells()
    complete = len(cells) == 176
    if not complete and not a.partial:
        raise FileNotFoundError(f"{len(cells)} of 176 exact-route summaries")
    if complete:
        fig_theory_check(cells)
        fig_align(cells)
        fig_capacity(cells)
        fig_nsweep(cells)
        tab_cells(cells)
        tab_main(cells)
        tab_priors(cells)
        exact_macros(cells)
    runs = load(DATA / "run_times.json", False)
    env = runs["environment"]
    macro("envCpus", env["cpu_count"])
    macro("envPython", env["python"])
    macro("envNumpy", env["numpy"])
    macro("envEmcee", env["emcee"])
    macro("envPlatform", env["platform"].split("-")[0] + " " + env["platform"].split("-")[1])

    def span(sec: float) -> str:
        h, rem = divmod(int(round(sec)), 3600)
        m, s = divmod(rem, 60)
        return (f"{h}~h~{m}~min" if h else (f"{m}~min~{s}~s" if m else f"{s}~s"))
    for key, name in (("exact", "runExactTime"), ("design", "runDesignTime"), ("identifiability", "runIdentTime"),
                      ("tau_coverage", "runTauTime")):
        r = runs["runs"][key]
        macro(name, f"{span(r['wall_seconds'])} on {r['workers']} processes")
    sbc, ver = load(DATA / "sbc.json", a.partial), load(DATA / "verify.json", a.partial)
    if sbc is None or ver is None:
        for k in ("sbcN", "sbcAbstract", "sbcText", "runSamplerTime"):
            macro(k, r"\textbf{[pending]}")
    else:
        sampler_outputs(sbc, ver)
        tot = sum(r["wall_seconds"] for k, r in runs["runs"].items() if k.startswith("sampler"))
        wk = max(r["workers"] for k, r in runs["runs"].items() if k.startswith("sampler"))
        macro("runSamplerTime", f"{span(tot)} on {wk} processes")
    lines = ["% Written by figures/make_figs.py from the committed summaries; do not edit."]
    lines += [f"\\newcommand{{\\{k}}}{{{v}}}" for k, v in sorted(MACROS.items())]
    (GEN / "numbers.tex").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(MACROS)} macros; exact cells {len(cells)}")


if __name__ == "__main__":
    main()
