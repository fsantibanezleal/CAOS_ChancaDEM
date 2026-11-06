#!/usr/bin/env python3
"""Regenerate every figure, table and number of the CrusherBayes preprint from the COMMITTED artifacts.

Reads (never writes) ``data/derived/hp500/crusherbayes.json``, ``loo.json``, ``backbone.json`` and
``data/examples/hp500-surveys.csv``. Writes, inside ``manuscripts/crusherbayes/`` only:

  figures/fig-band.pdf         held-out 80 percent predictive band against the measured value, power and throughput
  figures/fig-posterior.pdf    prior against posterior of every parameter (a normal summary of the posterior)
  figures/fig-contraction.pdf  posterior over prior standard deviation per parameter
  tex/generated/numbers.tex    one \\newcommand per number quoted in the prose
  tex/generated/tab-*.tex      the tables of the paper
  data/claims.json             every quoted number with the artifact path and the JSON key it was read from

Run:  python manuscripts/crusherbayes/figures/make_figs.py     (from anywhere)
Deps: matplotlib, numpy.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
ROOT = HERE.parents[2]
DER = ROOT / "data" / "derived" / "hp500"
CSV = ROOT / "data" / "examples" / "hp500-surveys.csv"
GEN = OUT / "tex" / "generated"
DATA = OUT / "data"
REL = {"cb": "data/derived/hp500/crusherbayes.json", "loo": "data/derived/hp500/loo.json",
       "bb": "data/derived/hp500/backbone.json", "csv": "data/examples/hp500-surveys.csv"}

INK, GRID = "#1a1a2e", "#d8d8e0"
BLUE, ORANGE, GREY, GREEN = "#0072B2", "#D55E00", "#6b6b7a", "#009E73"

plt.rcParams.update({
    "font.size": 8, "axes.edgecolor": INK, "axes.labelcolor": INK, "xtick.color": INK, "ytick.color": INK,
    "text.color": INK, "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.5, "axes.axisbelow": True, "pdf.fonttype": 42,
    "legend.frameon": False,
})

cb = json.loads((DER / "crusherbayes.json").read_text(encoding="utf-8"))
loo = json.loads((DER / "loo.json").read_text(encoding="utf-8"))
bb = json.loads((DER / "backbone.json").read_text(encoding="utf-8"))
with CSV.open(encoding="utf-8") as fh:
    surveys = list(csv.DictReader(fh))
css = np.array([float(r["css_mm"]) for r in surveys])
f80 = np.array([float(r["f80_mm"]) for r in surveys])
tph_m = np.array([float(r["feed_tph"]) for r in surveys])
kw_m = np.array([float(r["power_kw"]) for r in surveys])
assert list(tph_m) == cb["loo"]["tph"]["measured"] and list(kw_m) == cb["loo"]["kW"]["measured"]

CLAIMS: dict[str, dict] = {}
MACROS: dict[str, str] = {}


def tex_num(s: str) -> str:
    return s.replace("-", "$-$") if s.startswith("-") else s


def put(name: str, value, artifact: str, key: str, digits: int | None = None, note: str = "") -> str:
    """Register one quoted number: the LaTeX macro, and the claims row (value, artifact path, JSON key)."""
    text = f"{value:.{digits}f}" if digits is not None else str(value)
    MACROS[name] = tex_num(text)
    CLAIMS[name] = {"value": text, "artifact": REL.get(artifact, artifact), "key": key, **({"note": note} if note else {})}
    return text


# ---------------------------------------------------------------- numbers quoted in the prose
sc = cb["loo"]
cmp_ = cb["comparators"]
kc = cb["kill_criterion"]
conv = cb["convergence"]
meth = cb["method"]
for t, tk in (("tph", "Tph"), ("kW", "Kw")):
    s = sc[t]["scores"]
    for k, nm in (("mape_pct", "Mape"), ("rmse", "Rmse"), ("lpd_mean", "Lpd"), ("coverage_80", "Cov"), ("mean_width", "Width")):
        put(f"cb{tk}{nm}", s[k], "cb", f"loo.{t}.scores.{k}", 2 if k != "coverage_80" else 1)
    for c, ck in (("B_lin", "Blin"), ("M0", "Back"), ("M2", "Free")):
        for k, nm in (("mape_pct", "Mape"), ("rmse", "Rmse"), ("lpd_mean", "Lpd"), ("coverage_80", "Cov"), ("mean_width", "Width")):
            put(f"{ck}{tk}{nm}", cmp_[t][c][k], "cb", f"comparators.{t}.{c}.{k}", 2 if k != "coverage_80" else 1)
put("constTphMape", loo["loo"]["tph"]["strict"]["constant_mean"]["mape_pct"], "loo", "loo.tph.strict.constant_mean.mape_pct", 2)
put("constKwMape", loo["loo"]["kW"]["strict"]["constant_mean"]["mape_pct"], "loo", "loo.kW.strict.constant_mean.mape_pct", 2)
put("morrellMape", loo["loo"]["kW"]["strict"]["Morrell"]["mape_pct"], "loo", "loo.kW.strict.Morrell.mape_pct", 2)
put("morrellNoloadMape", loo["loo"]["kW"]["strict"]["Morrell_noload"]["mape_pct"], "loo", "loo.kW.strict.Morrell_noload.mape_pct", 2)
put("shuffleTphMape", loo["loo"]["tph"]["strict"]["M1_label_shuffle"]["mape_pct"], "loo", "loo.tph.strict.M1_label_shuffle.mape_pct", 2)
# derived widths
w_red_kw = 100 * (1 - cb["loo"]["kW"]["scores"]["mean_width"] / cmp_["kW"]["M0"]["mean_width"])
w_red_tph = 100 * (1 - cb["loo"]["tph"]["scores"]["mean_width"] / cmp_["tph"]["M0"]["mean_width"])
put("widthRedKw", w_red_kw, "cb", "derived: 100 (1 - loo.kW.scores.mean_width / comparators.kW.M0.mean_width)", 1)
put("widthRedTph", w_red_tph, "cb", "derived: 100 (1 - loo.tph.scores.mean_width / comparators.tph.M0.mean_width)", 1)
# dropping rule
put("gainBlinKw", kc["power_gain_over_blin_pts"], "cb", "kill_criterion.power_gain_over_blin_pts", 2)
put("gainBackTph", kc["tph_gain_over_m0_pts"], "cb", "kill_criterion.tph_gain_over_m0_pts", 2)
put("marginPts", kc["margin_mape_pts"], "cb", "kill_criterion.margin_mape_pts", 1)
put("covLo", kc["coverage_band"][0], "cb", "kill_criterion.coverage_band[0]", 1)
put("covHi", kc["coverage_band"][1], "cb", "kill_criterion.coverage_band[1]", 1)
assert kc["a_holds"] is True and kc["b_holds"] is False
# convergence
folds = conv["folds"]
taus = [f["tau_max"] for f in folds]
ratios = [f["chain_over_tau"] for f in folds]
accs = [f["acceptance_fraction"] for f in folds]
put("tauMin", min(taus), "cb", "convergence.folds[*].tau_max (min)", 1)
put("tauMax", max(taus), "cb", "convergence.folds[*].tau_max (max)", 1)
put("ratioMin", min(ratios), "cb", "convergence.folds[*].chain_over_tau (min)", 1)
put("ratioMax", max(ratios), "cb", "convergence.folds[*].chain_over_tau (max)", 1)
put("accMin", min(accs), "cb", "convergence.folds[*].acceptance_fraction (min)", 3)
put("accMax", max(accs), "cb", "convergence.folds[*].acceptance_fraction (max)", 3)
put("nPosteriors", len(folds), "cb", "convergence.folds (length)")
put("tauFactor", conv["tau_factor"], "cb", "convergence.tau_factor")
assert conv["all_converged"] is True
put("walkers", meth["walkers"], "cb", "method.walkers")
put("steps", meth["steps"], "cb", "method.steps")
put("burn", meth["burn_in_steps"], "cb", "method.burn_in_steps")
put("thin", meth["thin"], "cb", "method.thin")
put("draws", meth["predictive_draws_per_sample"], "cb", "method.predictive_draws_per_sample")
put("postSteps", folds[0]["post_burn_steps"], "cb", "convergence.folds[0].post_burn_steps")
put("nSamples", folds[0]["samples"], "cb", "convergence.folds[0].samples")
put("samplerVersion", meth["sampler_version"], "cb", "method.sampler_version")
put("seed", cb["seed"], "cb", "seed")
put("tauTph", meth["discrepancy_prior_sd"]["tph"], "cb", "method.discrepancy_prior_sd.tph", 0)
put("tauKw", meth["discrepancy_prior_sd"]["kW"], "cb", "method.discrepancy_prior_sd.kW", 0)
put("noiseMedTph", meth["noise_prior"]["median"]["tph"], "cb", "method.noise_prior.median.tph", 0)
put("noiseMedKw", meth["noise_prior"]["median"]["kW"], "cb", "method.noise_prior.median.kW", 0)
put("nSurveys", cb["n"], "cb", "n")
put("sha", cb["inputs_sha256"], "cb", "inputs_sha256")
put("shaDoc", hashlib.sha256((DER / "crusherbayes.json").read_bytes()).hexdigest(), "cb", "sha256 of the file", note="computed by make_figs.py")
# survey ranges
for nm, arr, key in (("css", css, "css_mm"), ("fEighty", f80, "f80_mm"), ("tphM", tph_m, "feed_tph"), ("kwM", kw_m, "power_kw")):
    put(f"{nm}Min", int(arr.min()), "csv", f"{key} (min)")
    put(f"{nm}Max", int(arr.max()), "csv", f"{key} (max)")
# correlations (derived)
cal_kw = np.array([s["backbone"]["calibrated_power_kw"] for s in bb["surveys"]])
bond_kw = np.array([s["backbone"]["bond_power_kw"] for s in bb["surveys"]])
put("rMeasCss", np.corrcoef(kw_m, css)[0, 1], "csv", "Pearson r of power_kw with css_mm (derived)", 2)
put("rEngCss", np.corrcoef(cal_kw, css)[0, 1], "bb", "Pearson r of surveys[*].backbone.calibrated_power_kw with css_mm (derived)", 2)
put("calKwMin", cal_kw.min(), "bb", "surveys[*].backbone.calibrated_power_kw (min)", 0)
put("calKwMax", cal_kw.max(), "bb", "surveys[*].backbone.calibrated_power_kw (max)", 0)
put("bondKwMin", bond_kw.min(), "bb", "surveys[*].backbone.bond_power_kw (min)", 0)
put("bondKwMax", bond_kw.max(), "bb", "surveys[*].backbone.bond_power_kw (max)", 0)
# contraction rows
rows = cb["contraction"]
byname = {r["name"]: r for r in rows}
short = {"q_ref_tph": "qRef", "wi_kwh_t": "wi", "zeta": "zeta", "pn_kw": "pn", "k1_scale": "kOneScale", "k2_scale": "kTwoScale",
         "k3": "kThree", "t10_shift_pct": "tShift", "sigma_tph": "sigTph", "sigma_kW": "sigKw",
         "discrepancy_tph_constant": "dTphConst", "discrepancy_tph_css": "dTphCss", "discrepancy_tph_f80": "dTphF",
         "discrepancy_kW_constant": "dKwConst", "discrepancy_kW_css": "dKwCss", "discrepancy_kW_f80": "dKwF"}
for name, r in byname.items():
    for k, nm, d in (("contraction", "Contr", 3), ("posterior_mean", "Mean", 2), ("posterior_sd", "Sd", 2), ("prior_sd", "PriorSd", 2)):
        put(f"{short[name]}{nm}", r[k], "cb", f"contraction[name={name}].{k}", d)
put("qRefNominal", byname["q_ref_tph"]["nominal"], "cb", "contraction[name=q_ref_tph].nominal", 0)
sd_css = float(css.std())
put("sdCss", sd_css, "csv", "population standard deviation of css_mm of the ten surveys (derived)", 1)
put("dKwPerMm", byname["discrepancy_kW_css"]["posterior_mean"] / sd_css, "cb",
    "contraction[name=discrepancy_kW_css].posterior_mean / sdCss (derived)", 1)
put("dTphPerMm", byname["discrepancy_tph_css"]["posterior_mean"] / sd_css, "cb",
    "contraction[name=discrepancy_tph_css].posterior_mean / sdCss (derived)", 1)
c_ident = [r["name"] for r in rows if r["contraction"] <= 0.5]
c_part = [r["name"] for r in rows if 0.5 < r["contraction"] <= 0.9]
c_none = [r["name"] for r in rows if r["contraction"] > 0.9]
put("nIdent", len(c_ident), "cb", "contraction[*].contraction <= 0.5 (count, derived)")
put("nPart", len(c_part), "cb", "contraction[0.5 < *.contraction <= 0.9] (count, derived)")
put("nNone", len(c_none), "cb", "contraction[*].contraction > 0.9 (count, derived)")
put("nParams", len(rows), "cb", "contraction (length)")

# ---------------------------------------------------------------- tables
GEN.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)


def fx(x, d=2):
    text = f"{x:.{d}f}"
    return tex_num(text.lstrip("-") if float(text) == 0 else text)   # never a negative zero


def write(name: str, text: str) -> None:
    (GEN / name).write_text(text, encoding="utf-8")


# accuracy table
acc = [r"\begin{tabular}{@{}llrrrrr@{}}", r"\toprule",
       r"Target & Method & MAPE (\%) & RMSE & Mean log density & Coverage & Width \\", r"\midrule"]
for t, unit in (("tph", "t/h"), ("kW", "kW")):
    acc.append(rf"\multicolumn{{7}}{{@{{}}l}}{{\textit{{{'Throughput' if t == 'tph' else 'Power'} ({unit})}}}} \\")
    s = sc[t]["scores"]
    lines = [("CrusherBayes", s)] + [(n, cmp_[t][k]) for n, k in
                                     (("Setting-only line", "B_lin"), ("Refit engine with residual band", "M0"), ("Free-form linear fit", "M2"))]
    for n, v in lines:
        acc.append(rf"& {n} & {fx(v['mape_pct'])} & {fx(v['rmse'])} & {fx(v['lpd_mean'], 3)} & {fx(v['coverage_80'], 1)} & {fx(v['mean_width'], 1)} \\")
    acc.append(r"\midrule" if t == "tph" else r"\bottomrule")
acc.append(r"\end{tabular}")
write("tab-accuracy.tex", "\n".join(acc) + "\n")

# priors table
pri = [r"\begin{tabular}{@{}llrrl@{}}", r"\toprule", r"Scalar & Unit & Nominal & Prior (sampled scale) & Range \\", r"\midrule"]
LAB = {"q_ref_tph": r"$Q_{\mathrm{ref}}$", "wi_kwh_t": r"$W_i$", "zeta": r"$\zeta$", "pn_kw": r"$P_n$", "k1_scale": r"$s_{K_1}$",
       "k2_scale": r"$s_{K_2}$", "k3": r"$K_3$", "t10_shift_pct": r"$\Delta t_{10}$"}
UNIT = {"q_ref_tph": "t/h", "wi_kwh_t": "kWh/t", "zeta": "--", "pn_kw": "kW", "k1_scale": "--", "k2_scale": "--", "k3": "--",
        "t10_shift_pct": "points of $t_{10}$"}
for p in cb["priors"]:
    nm = p["name"]
    if p["log"]:
        prior = rf"$\ln x \sim N({fx(p['mu'], 2)},\,{fx(p['sd'], 2)}^2)$"
        rng = f"{fx(math.exp(p['lo']), 2)} to {fx(math.exp(p['hi']), 1)}"
    else:
        prior = rf"$N({fx(p['mu'], 1)},\,{fx(p['sd'], 1)}^2)$"
        rng = f"{fx(p['lo'], 1)} to {fx(p['hi'], 1)}"
    pri.append(rf"{LAB[nm]} & {UNIT[nm]} & {fx(p['nominal'], 2)} & {prior} & {rng} \\")
pri += [r"\bottomrule", r"\end{tabular}"]
write("tab-priors.tex", "\n".join(pri) + "\n")

# identifiability table
PL = {"q_ref_tph": (r"$Q_{\mathrm{ref}}$", "t/h"), "wi_kwh_t": (r"$W_i$", "kWh/t"), "zeta": (r"$\zeta$", "--"),
      "pn_kw": (r"$P_n$", "kW"), "k1_scale": (r"$s_{K_1}$", "--"), "k2_scale": (r"$s_{K_2}$", "--"), "k3": (r"$K_3$", "--"),
      "t10_shift_pct": (r"$\Delta t_{10}$", "points"), "sigma_tph": (r"$\sigma_{\mathrm{tph}}$", "t/h"),
      "sigma_kW": (r"$\sigma_{\mathrm{kW}}$", "kW"), "discrepancy_tph_constant": (r"$d_{\mathrm{tph},0}$", "t/h"),
      "discrepancy_tph_css": (r"$d_{\mathrm{tph},1}$ (setting)", "t/h"), "discrepancy_tph_f80": (r"$d_{\mathrm{tph},2}$ ($f_{80}$)", "t/h"),
      "discrepancy_kW_constant": (r"$d_{\mathrm{kW},0}$", "kW"), "discrepancy_kW_css": (r"$d_{\mathrm{kW},1}$ (setting)", "kW"),
      "discrepancy_kW_f80": (r"$d_{\mathrm{kW},2}$ ($f_{80}$)", "kW")}
TH = json.loads((DATA / "theory.json").read_text(encoding="utf-8"))
THREL = "manuscripts/crusherbayes/data/theory.json"


def prior_mean(r: dict) -> float:
    """Prior mean on the natural scale: theory.json for the engine scalars (sampled truncated prior), the log-normal
    mean median * exp(s^2 / 2) for a noise scale, zero for a discrepancy coefficient."""
    if r["name"] in TH["prior_mean_natural"]:
        return TH["prior_mean_natural"][r["name"]]
    if r["name"].startswith("sigma_"):
        return r["nominal"] * math.exp(meth["noise_prior"]["log_sd"] ** 2 / 2)
    return 0.0


idt = [r"\begin{tabular}{@{}llrrrrrrl@{}}", r"\toprule",
       r"Parameter & Unit & Nominal (prior median) & Prior mean & Prior SD & Posterior mean & Posterior SD & Ratio & Reading \\",
       r"\midrule"]
for r in rows:
    lab, unit = PL[r["name"]]
    reading = "identified" if r["contraction"] <= 0.5 else ("partly identified" if r["contraction"] <= 0.9 else "not contracted")
    idt.append(rf"{lab} & {unit} & {fx(r['nominal'], 2)} & {fx(prior_mean(r), 2)} & {fx(r['prior_sd'], 2)} & "
               rf"{fx(r['posterior_mean'], 2)} & {fx(r['posterior_sd'], 2)} & {fx(r['contraction'], 3)} & {reading} \\")
    if r["name"] in ("t10_shift_pct", "sigma_kW", "discrepancy_tph_f80"):
        idt.append(r"\midrule")
idt += [r"\bottomrule", r"\end{tabular}"]
write("tab-identifiability.tex", "\n".join(idt) + "\n")

# convergence table
cv = [r"\begin{tabular}{@{}lrrrr@{}}", r"\toprule", r"Posterior & $\tau_{\max}$ (steps) & Post-burn steps / $\tau_{\max}$ & Acceptance & Retained samples \\", r"\midrule"]
for f in folds:
    lab = "all ten surveys" if f["fold"] == "all" else f"without survey {f['fold']}"
    cv.append(rf"{lab} & {fx(f['tau_max'], 1)} & {fx(f['chain_over_tau'], 1)} & {fx(f['acceptance_fraction'], 3)} & {f['samples']} \\")
cv += [r"\bottomrule", r"\end{tabular}"]
write("tab-convergence.tex", "\n".join(cv) + "\n")

# survey table
sv = [r"\begin{tabular}{@{}rrrrr@{}}", r"\toprule", r"Survey & Setting (mm) & $f_{80}$ (mm) & Throughput (t/h) & Power (kW) \\", r"\midrule"]
for r in surveys:
    sv.append(rf"{r['survey']} & {int(float(r['css_mm']))} & {int(float(r['f80_mm']))} & {int(float(r['feed_tph']))} & {int(float(r['power_kw']))} \\")
sv += [r"\bottomrule", r"\end{tabular}"]
write("tab-surveys.tex", "\n".join(sv) + "\n")

# dropping-rule table
kr = [r"\begin{tabular}{@{}lrr@{}}", r"\toprule", r"Term & Throughput & Power \\", r"\midrule",
      rf"MAPE of CrusherBayes (\%) & {fx(kc['tph_mape_pct'])} & {fx(kc['power_mape_pct'])} \\",
      rf"MAPE of the reference (\%) & {fx(kc['tph_mape_m0_pct'])} & {fx(kc['power_mape_blin_pct'])} \\",
      rf"Gain over the reference (points) & {fx(kc['tph_gain_over_m0_pts'])} & {fx(kc['power_gain_over_blin_pts'])} \\",
      rf"Gain of at least {fx(kc['margin_mape_pts'], 0)} points & {'yes' if kc['a_tph_beats_m0_by_margin'] else 'no'} & {'yes' if kc['a_power_beats_blin_by_margin'] else 'no'} \\",
      rf"Coverage & {fx(kc['coverage']['tph'], 1)} & {fx(kc['coverage']['kW'], 1)} \\",
      rf"Coverage outside {fx(kc['coverage_band'][0], 1)} to {fx(kc['coverage_band'][1], 1)} & {'yes' if kc['coverage_outside_band']['tph'] else 'no'} & {'yes' if kc['coverage_outside_band']['kW'] else 'no'} \\",
      rf"Mean width (t/h, kW) & {fx(kc['mean_width']['tph'], 1)} & {fx(kc['mean_width']['kW'], 1)} \\",
      rf"Mean width of the residual band & {fx(kc['mean_width_crushercal']['tph'], 1)} & {fx(kc['mean_width_crushercal']['kW'], 1)} \\",
      rf"Band wider than the residual band & {'yes' if kc['band_wider_than_crushercal']['tph'] else 'no'} & {'yes' if kc['band_wider_than_crushercal']['kW'] else 'no'} \\",
      r"\bottomrule", r"\end{tabular}"]
write("tab-dropping-rule.tex", "\n".join(kr) + "\n")

# ---------------------------------------------------------------- the comparison with the published methods, with intervals
# Every method is scored on the same ten surveys from the committed held-out predictions (strict leave-one-survey-out: every
# scalar a method fits on the surveys is refit without the held-out one). Two rows fit nothing on the surveys: the bare Bond
# draw (work index of the ore blend) and the engine at its shipped constants (the product's engine: the classification,
# t10, zeta and Pn numbers of Rocha et al. 2024 inside the product's reduced capacity form and its Bond draw, so not the
# model of Rocha et al.; those numbers were fitted by them on these surveys). The 95 percent intervals of MAPE and RMSE are percentile bootstraps over
# the ten surveys (B resamples, seeded); the interval of a coverage is the Wilson score interval of a binomial proportion.
BOOT = 20000
BOOT_SEED = 42
rng_boot = np.random.default_rng(BOOT_SEED)
BOOT_IDX = rng_boot.integers(0, 10, size=(BOOT, 10))
strict = {t: loo["loo"][t]["strict"] for t in ("tph", "kW")}
meas = {"tph": tph_m, "kW": kw_m}
PRED: dict[str, dict[str, tuple[str, np.ndarray, str]]] = {
    "kW": {
        "cb": ("CrusherBayes", np.array(sc["kW"]["pred_mean"]), "eight scalars, noise, discrepancy"),
        "blin": ("Setting-only line", np.array(strict["kW"]["pred"]["B_lin"]), "intercept, slope"),
        "free": ("Free-form linear fit", np.array(strict["kW"]["pred"]["M2"]), "intercept, two slopes"),
        "mnl": ("Morrell with no-load term", np.array(strict["kW"]["pred"]["Morrell_noload"]), "$M_{ic}$, no-load power"),
        "back": ("Refit power form", np.array(strict["kW"]["pred"]["M0"]), r"$\zeta$, $P_n$"),
        "resid": ("Refit power form with bounded residual", np.array(strict["kW"]["pred"]["M1"]), r"$\zeta$, $P_n$, ridge residual"),
        "mor": ("Morrell through the origin", np.array(strict["kW"]["pred"]["Morrell"]), "$M_{ic}$"),
        "const": ("Constant mean", None, "the mean"),
        "bond": ("Bond draw, blend work index", np.array([r["bare_bond"] for r in loo["power_parity"]["per_survey"]]), "none"),
        "pub": ("Engine at its shipped constants", np.array([r["engine_pc"] for r in loo["power_parity"]["per_survey"]]),
                "none"),
    },
    "tph": {
        "cb": ("CrusherBayes", np.array(sc["tph"]["pred_mean"]), "eight scalars, noise, discrepancy"),
        "back": ("Refit capacity base", np.array(strict["tph"]["pred"]["M0"]), r"$Q_{\mathrm{ref}}$"),
        "free": ("Free-form linear fit", np.array(strict["tph"]["pred"]["M2"]), "intercept, two slopes"),
        "resid": ("Capacity base with bounded residual", np.array(strict["tph"]["pred"]["M1"]), r"$Q_{\mathrm{ref}}$, ridge residual"),
        "blin": ("Setting-only line", np.array(strict["tph"]["pred"]["B_lin"]), "intercept, slope"),
        "const": ("Constant mean", None, "the mean"),
        "pub": ("Engine at its shipped constants", np.array([r["backbone"] for r in loo["tph_parity"]["per_survey"]]),
                "none"),
    },
}
for t in ("tph", "kW"):   # the constant mean of each fold: the mean of the nine training surveys
    m = meas[t]
    PRED[t]["const"] = ("Constant mean", np.array([np.mean(np.delete(m, i)) for i in range(10)]), "the mean")
    for key, (_, p, _) in PRED[t].items():
        if key == "const":
            assert abs(100 * np.mean(np.abs(p - m) / m) - loo["loo"][t]["strict"]["constant_mean"]["mape_pct"]) < 0.01
assert abs(100 * np.mean(np.abs(PRED["kW"]["bond"][1] - kw_m) / kw_m) - loo["power_parity"]["bare_bond"]["mape_pct"]) < 0.05


def ape(t: str, key: str) -> np.ndarray:
    return 100.0 * np.abs(PRED[t][key][1] - meas[t]) / meas[t]


def boot_ci(values: np.ndarray, stat=np.mean) -> tuple[float, float]:
    s = stat(values[BOOT_IDX], axis=1)
    return float(np.quantile(s, 0.025)), float(np.quantile(s, 0.975))


def rmse_ci(err: np.ndarray) -> tuple[float, float]:
    s = np.sqrt(np.mean(err[BOOT_IDX] ** 2, axis=1))
    return float(np.quantile(s, 0.025)), float(np.quantile(s, 0.975))


def wilson(k: int, n: int, z: float = 1.959964) -> tuple[float, float]:
    p = k / n
    den = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return centre - half, centre + half


BANDED = {"cb": None, "blin": "B_lin", "back": "M0", "free": "M2"}
# where the held-out document stores a method's MAPE, the text and tables print that value; the recomputation from the
# predictions (stored to two decimals) must agree with it to 0.02 points, and only the bootstrap intervals come from it
DOC_MAPE = {"kW": {"blin": "B_lin", "mnl": "Morrell_noload", "resid": "M1_residual", "mor": "Morrell", "const": "constant_mean"},
            "tph": {"blin": "B_lin", "resid": "M1_residual", "const": "constant_mean"}}
STATS: dict[str, dict[str, dict]] = {"tph": {}, "kW": {}}
for t in ("tph", "kW"):
    for key, (label, p, fitted) in PRED[t].items():
        a = ape(t, key)
        err = p - meas[t]
        mape = float(a.mean())
        if key in DOC_MAPE[t]:
            doc_mape = loo["loo"][t]["strict"][DOC_MAPE[t][key]]["mape_pct"]
            assert abs(doc_mape - mape) < 0.02, (t, key, doc_mape, mape)
            mape = doc_mape
        row = {"label": label, "fitted": fitted, "mape": mape, "mape_ci": boot_ci(a),
               "rmse": float(np.sqrt(np.mean(err ** 2))), "rmse_ci": rmse_ci(err)}
        if key in BANDED:
            s = sc[t]["scores"] if key == "cb" else cmp_[t][BANDED[key]]
            k = int(round(s["coverage_80"] * 10))
            row.update(coverage=s["coverage_80"], coverage_ci=wilson(k, 10), width=s["mean_width"], lpd=s["lpd_mean"])
        STATS[t][key] = row
tk = {"tph": "Tph", "kW": "Kw"}
KEYN = {"cb": "Cb", "blin": "Blin", "free": "Free", "mnl": "Mnl", "back": "Back", "resid": "Resid", "mor": "Mor",
        "const": "Const", "bond": "Bond", "pub": "Pub"}
for t in ("tph", "kW"):
    for key, row in STATS[t].items():
        base = f"{KEYN[key].lower()}{tk[t]}"
        put(f"{base}MapeBoot", row["mape"], "loo" if key != "cb" else "cb", f"mean absolute percentage error of {key} ({t}), recomputed", 2)
        put(f"{base}MapeLo", row["mape_ci"][0], "loo", f"2.5 percent bootstrap quantile of the MAPE of {key} ({t}), {BOOT} resamples, seed {BOOT_SEED}", 1)
        put(f"{base}MapeHi", row["mape_ci"][1], "loo", f"97.5 percent bootstrap quantile of the MAPE of {key} ({t})", 1)
        if "coverage_ci" in row:
            put(f"{base}CovLo", row["coverage_ci"][0], "cb", f"Wilson 95 percent lower bound of the coverage of {key} ({t})", 2)
            put(f"{base}CovHi", row["coverage_ci"][1], "cb", f"Wilson 95 percent upper bound of the coverage of {key} ({t})", 2)
# paired differences: CrusherBayes minus each comparator, the same bootstrap resamples (positive: CrusherBayes is worse)
PAIRED: dict[str, dict[str, dict]] = {"tph": {}, "kW": {}}
for t in ("tph", "kW"):
    acb = ape(t, "cb")
    for key in PRED[t]:
        if key == "cb":
            continue
        d = acb - ape(t, key)
        s = d[BOOT_IDX].mean(axis=1)
        PAIRED[t][key] = {"diff": float(d.mean()), "ci": (float(np.quantile(s, 0.025)), float(np.quantile(s, 0.975))),
                          "p_better": float(np.mean(s < 0)), "wins": int(np.sum(d < 0))}
        base = f"d{KEYN[key]}{tk[t]}"
        put(f"{base}", PAIRED[t][key]["diff"], "cb", f"mean over surveys of APE(CrusherBayes) - APE({key}) ({t}), points", 2)
        put(f"{base}Lo", PAIRED[t][key]["ci"][0], "cb", f"2.5 percent paired-bootstrap quantile ({t}, {key})", 2)
        put(f"{base}Hi", PAIRED[t][key]["ci"][1], "cb", f"97.5 percent paired-bootstrap quantile ({t}, {key})", 2)
        put(f"{base}Wins", PAIRED[t][key]["wins"], "cb", f"surveys where CrusherBayes has the lower APE ({t}, {key})")
put("nBoot", BOOT, "cb", "bootstrap resamples (make_figs.py constant)")
put("bootSeed", BOOT_SEED, "cb", "bootstrap seed (make_figs.py constant)")
for key, nm in (("zeta", "refitZeta"), ("pn", "refitPn")):
    put(nm, loo["power_parity"]["refit_pc"][key], "loo", f"power_parity.refit_pc.{key}", 2 if key == "zeta" else 1)
put("pubKwMapeDoc", loo["power_parity"]["engine_pc_1p30_110"]["mape_pct"], "loo", "power_parity.engine_pc_1p30_110.mape_pct", 2)
put("bondKwMapeDoc", loo["power_parity"]["bare_bond"]["mape_pct"], "loo", "power_parity.bare_bond.mape_pct", 2)
put("pubTphMapeDoc", loo["tph_parity"]["backbone"]["mape_pct"], "loo", "tph_parity.backbone.mape_pct", 2)
put("residTphMapeDoc", loo["loo"]["tph"]["strict"]["M1_residual"]["mape_pct"], "loo", "loo.tph.strict.M1_residual.mape_pct", 2)
put("residKwMapeDoc", loo["loo"]["kW"]["strict"]["M1_residual"]["mape_pct"], "loo", "loo.kW.strict.M1_residual.mape_pct", 2)
mic = loo["loo"]["kW"]["strict"]["morrell_fit"]
put("micMin", min(mic["m_ic_kwh_t"]), "loo", "loo.kW.strict.morrell_fit.m_ic_kwh_t (min)", 2)
put("micMax", max(mic["m_ic_kwh_t"]), "loo", "loo.kW.strict.morrell_fit.m_ic_kwh_t (max)", 2)
put("noloadMin", min(mic["no_load_kw"]), "loo", "loo.kW.strict.morrell_fit.no_load_kw (min)", 0)
put("noloadMax", max(mic["no_load_kw"]), "loo", "loo.kW.strict.morrell_fit.no_load_kw (max)", 0)
r_tph_css = float(np.corrcoef(tph_m, css)[0, 1])
put("rTphCss", r_tph_css, "csv", "Pearson r of feed_tph with css_mm (derived)", 2)
put("rKwTph", float(np.corrcoef(kw_m, tph_m)[0, 1]), "csv", "Pearson r of power_kw with feed_tph (derived)", 2)
p80_bb = np.array([s["backbone"]["p80_mm"] for s in bb["surveys"]])
put("rKwPeighty", float(np.corrcoef(kw_m, p80_bb)[0, 1]), "bb", "Pearson r of power_kw with surveys[*].backbone.p80_mm (derived)", 2)
put("peightyMin", p80_bb.min(), "bb", "surveys[*].backbone.p80_mm (min)", 1)
put("peightyMax", p80_bb.max(), "bb", "surveys[*].backbone.p80_mm (max)", 1)


def ci(lo_hi, d=1):
    return f"[{fx(lo_hi[0], d)}, {fx(lo_hi[1], d)}]"


cmp_rows = [r"\begin{tabular}{@{}lllrlrll@{}}", r"\toprule",
            r"Target & Method & Fitted on the training surveys & MAPE (\%) & 95\% interval & RMSE & Coverage [95\% interval] & Width \\",
            r"\midrule"]
for t, unit in (("kW", "kW"), ("tph", "t/h")):
    cmp_rows.append(rf"\multicolumn{{8}}{{@{{}}l}}{{\textit{{{'Power' if t == 'kW' else 'Throughput'} ({unit})}}}} \\")
    for key, row in STATS[t].items():
        cov = f"{fx(row['coverage'], 1)} {ci(row['coverage_ci'], 2)}" if "coverage" in row else "--"
        wid = fx(row["width"], 1) if "width" in row else "--"
        cmp_rows.append(rf"& {row['label']} & {row['fitted']} & {fx(row['mape'])} & {ci(row['mape_ci'])} & {fx(row['rmse'], 1)} & {cov} & {wid} \\")
    cmp_rows.append(r"\midrule" if t == "kW" else r"\bottomrule")
cmp_rows.append(r"\end{tabular}")
write("tab-comparison.tex", "\n".join(cmp_rows) + "\n")

pr = [r"\begin{tabular}{@{}llrlrr@{}}", r"\toprule",
      r"Target & Comparator & $\Delta$ MAPE (points) & 95\% interval & $P(\Delta<0)$ & Surveys won \\", r"\midrule"]
for t, unit in (("kW", "kW"), ("tph", "t/h")):
    pr.append(rf"\multicolumn{{6}}{{@{{}}l}}{{\textit{{{'Power' if t == 'kW' else 'Throughput'}}}}} \\")
    for key, row in PAIRED[t].items():
        pr.append(rf"& {PRED[t][key][0]} & {fx(row['diff'])} & {ci(row['ci'], 2)} & {fx(row['p_better'], 3)} & {row['wins']} of 10 \\")
    pr.append(r"\midrule" if t == "kW" else r"\bottomrule")
pr.append(r"\end{tabular}")
write("tab-paired.tex", "\n".join(pr) + "\n")

# ---------------------------------------------------------------- the ablation (documents of ablation/run_ablation.py)
ABL_DIR = DATA / "ablation"
ABL_ORDER = [("full", "The method (seed 42)"), ("full-seed43", "The method, seed 43"), ("full-seed44", "The method, seed 44"),
             ("no-discrepancy", "Without the discrepancy"), ("engine-fixed", "Engine scalars fixed at nominal"),
             ("balance-fixed", "Population-balance scalars fixed"), ("wide-priors", "Engine prior widths doubled"),
             ("tau-half", r"Discrepancy scale $\tau_t$ halved"), ("tau-double", r"Discrepancy scale $\tau_t$ doubled"),
             ("stretch-move", "Stretch move instead of differential evolution")]
ABL: dict[str, dict] = {"full": cb}
missing = [n for n, _ in ABL_ORDER[1:] if not (ABL_DIR / f"{n}.json").is_file()]
if missing:
    raise SystemExit(f"the ablation documents {missing} are missing: run manuscripts/crusherbayes/ablation/run_ablation.py first")
for n, _ in ABL_ORDER[1:]:
    ABL[n] = json.loads((ABL_DIR / f"{n}.json").read_text(encoding="utf-8"))
    assert ABL[n]["n"] == 10 and ABL[n]["loo"]["kW"]["measured"] == cb["loo"]["kW"]["measured"]
ABL_SHORT = {"full": "Full", "full-seed43": "SeedB", "full-seed44": "SeedC", "no-discrepancy": "NoDisc", "engine-fixed": "EngFix",
             "balance-fixed": "BalFix", "wide-priors": "Wide", "tau-half": "TauHalf", "tau-double": "TauDouble",
             "stretch-move": "Stretch"}
CONTR_KEYS = {"q_ref_tph": "QRef", "wi_kwh_t": "Wi", "zeta": "Zeta", "pn_kw": "Pn", "k3": "KThree"}
ab = [r"\begin{tabular}{@{}lrrrrrrrr@{}}", r"\toprule",
      r"Variant & \multicolumn{3}{c}{Throughput} & \multicolumn{3}{c}{Power} & $\tau_{\max}$ & Converged \\",
      r" & MAPE & Cov. & Width & MAPE & Cov. & Width & (steps) & \\", r"\midrule"]
for n, label in ABL_ORDER:
    d = ABL[n]
    s_t, s_k = d["loo"]["tph"]["scores"], d["loo"]["kW"]["scores"]
    taus_n = [f["tau_max"] for f in d["convergence"]["folds"]]
    nconv = sum(f["converged"] for f in d["convergence"]["folds"])
    ab.append(rf"{label} & {fx(s_t['mape_pct'])} & {fx(s_t['coverage_80'], 1)} & {fx(s_t['mean_width'], 0)} & "
              rf"{fx(s_k['mape_pct'])} & {fx(s_k['coverage_80'], 1)} & {fx(s_k['mean_width'], 1)} & "
              rf"{fx(min(taus_n), 0)}--{fx(max(taus_n), 0)} & {nconv} of {len(taus_n)} \\")
    if n in ("full-seed44",):
        ab.append(r"\midrule")
    sh = ABL_SHORT[n]
    for t in ("tph", "kW"):
        for k, nm in (("mape_pct", "Mape"), ("coverage_80", "Cov"), ("mean_width", "Width"), ("lpd_mean", "Lpd")):
            put(f"ab{sh}{tk[t]}{nm}", d["loo"][t]["scores"][k], "cb" if n == "full" else f"manuscripts/crusherbayes/data/ablation/{n}.json",
                f"loo.{t}.scores.{k}", 2 if k != "coverage_80" else 1)
    put(f"ab{sh}Conv", nconv, f"manuscripts/crusherbayes/data/ablation/{n}.json", "convergence.folds[*].converged (count)")
    put(f"ab{sh}TauMax", max(taus_n), f"manuscripts/crusherbayes/data/ablation/{n}.json", "convergence.folds[*].tau_max (max)", 1)
    put(f"ab{sh}TauMin", min(taus_n), f"manuscripts/crusherbayes/data/ablation/{n}.json", "convergence.folds[*].tau_max (min)", 1)
    if n != "full":
        put(f"ab{sh}Wall", d["wall_seconds"] / 60.0, f"manuscripts/crusherbayes/data/ablation/{n}.json", "wall_seconds / 60", 1)
    byn = {r["name"]: r for r in d["contraction"]}
    for k, nm in CONTR_KEYS.items():
        put(f"ab{sh}{nm}Contr", byn[k]["contraction"], f"manuscripts/crusherbayes/data/ablation/{n}.json",
            f"contraction[name={k}].contraction", 3)
    for k, nm in (("discrepancy_kW_css", "DKwCss"), ("discrepancy_tph_css", "DTphCss")):
        put(f"ab{sh}{nm}Mean", byn[k]["posterior_mean"], f"manuscripts/crusherbayes/data/ablation/{n}.json",
            f"contraction[name={k}].posterior_mean", 1)
    put(f"ab{sh}KillA", "holds" if d["kill_criterion"]["a_holds"] else "fails", "cb", "kill_criterion.a_holds")
    put(f"ab{sh}KillB", "holds" if d["kill_criterion"]["b_holds"] else "fails", "cb", "kill_criterion.b_holds")
    put(f"ab{sh}Verdict", d["kill_criterion"]["verdict"], "cb", "kill_criterion.verdict")
ab += [r"\bottomrule", r"\end{tabular}"]
write("tab-ablation.tex", "\n".join(ab) + "\n")
seeds = [ABL[n] for n in ("full", "full-seed43", "full-seed44")]
for t in ("tph", "kW"):
    v = [d["loo"][t]["scores"]["mape_pct"] for d in seeds]
    put(f"seedSpread{tk[t]}", max(v) - min(v), "cb", f"max - min over seeds 42, 43, 44 of loo.{t}.scores.mape_pct", 2)
    w = [d["loo"][t]["scores"]["mean_width"] for d in seeds]
    put(f"seedWidthSpread{tk[t]}", max(w) - min(w), "cb", f"max - min over seeds 42, 43, 44 of loo.{t}.scores.mean_width", 1)
put("balFixGainKw", cb["loo"]["kW"]["scores"]["mape_pct"] - ABL["balance-fixed"]["loo"]["kW"]["scores"]["mape_pct"], "cb",
    "loo.kW.scores.mape_pct (method) - the same of data/ablation/balance-fixed.json", 2)
walls = [ABL[n]["wall_seconds"] for n, _ in ABL_ORDER[1:]]
put("wallMin", min(walls) / 60.0, "cb", "min of ablation wall_seconds / 60", 0)
put("wallMax", max(walls) / 60.0, "cb", "max of ablation wall_seconds / 60", 0)
put("ablCpu", ABL["full-seed43"]["machine"]["cpu_count"], "cb", "ablation machine.cpu_count")

# ---------------------------------------------------------------- the theory checks (analysis/theory_check.py)
put("thOutOfSpan", f"{TH['throughput_shape_out_of_span_rel']:.1e}".replace("e-", r"\times 10^{-") + "}", THREL,
    "throughput_shape_out_of_span_rel")
put("thRidge", f"{TH['kw_jacobian_wi_minus_zeta_rel']:.1e}".replace("e-", r"\times 10^{-") + "}", THREL,
    "kw_jacobian_wi_minus_zeta_rel")
put("thCorrWz", TH["laplace_corr_wi_zeta"], THREL, "laplace_corr_wi_zeta", 2)
for t in ("tph", "kW"):
    s = TH["shrinkage"][t]
    put(f"thLam{tk[t]}", s["lambda_method"], THREL, f"shrinkage.{t}.lambda_method", 2)
    put(f"thAtMethod{tk[t]}", s["at_method"]["mape_pct"], THREL, f"shrinkage.{t}.at_method.mape_pct", 2)
    put(f"thOls{tk[t]}", s["curve"][0]["mape_pct"], THREL, f"shrinkage.{t}.curve[lambda=0].mape_pct", 2)
    put(f"thBig{tk[t]}", s["curve"][-1]["mape_pct"], THREL, f"shrinkage.{t}.curve[lambda=1000].mape_pct", 2)
    put(f"thWeight{tk[t]}", s["engine_weight_at_method"], THREL, f"shrinkage.{t}.engine_weight_at_method", 2)
    best = min(s["curve"], key=lambda c: c["mape_pct"])
    put(f"thMin{tk[t]}", best["mape_pct"], THREL, f"shrinkage.{t}.curve (min mape_pct)", 2)
    put(f"thArgmin{tk[t]}", best["lambda"], THREL, f"shrinkage.{t}.curve (lambda at the min)", 1)
inf = {r["name"]: r for r in TH["information"]}
fr = [inf[n]["kW"]["fraction_in_span"] for n in inf]
put("thSpanMin", min(fr), THREL, "information[*].kW.fraction_in_span (min)", 3)
put("thSpanTShift", inf["t10_shift_pct"]["kW"]["fraction_in_span"], THREL, "information[t10_shift_pct].kW.fraction_in_span", 3)
put("thSpanKOne", inf["k1_scale"]["kW"]["fraction_in_span"], THREL, "information[k1_scale].kW.fraction_in_span", 3)
lap = {r["name"]: r for r in TH["laplace"]}
# both ratios on the natural scale: the linearized SD mapped by the delta method (theory_check.py), the sampler's as stored
dev = {r["name"]: abs(r["predicted_ratio_natural"] - r["sampler_ratio"]) for r in TH["laplace"]}
worst = max(dev, key=dev.get)
put("thLapMaxDev", dev[worst], THREL, "max |laplace[*].predicted_ratio_natural - sampler_ratio|", 3)
put("thLapMaxDevRest", max(v for k, v in dev.items() if k != worst), THREL,
    "max |laplace[*].predicted_ratio_natural - sampler_ratio| over the parameters other than the largest", 3)
assert worst == "pn_kw", worst   # the text names the parameter of the largest difference
for nm, key in (("QRef", "q_ref_tph"), ("Zeta", "zeta"), ("Wi", "wi_kwh_t"), ("Pn", "pn_kw"), ("KOne", "k1_scale"),
                ("KTwo", "k2_scale"), ("KThree", "k3"), ("TShift", "t10_shift_pct")):
    put(f"thLap{nm}", lap[key]["predicted_ratio_natural"], THREL, f"laplace[{key}].predicted_ratio_natural", 3)
    put(f"thLapLog{nm}", lap[key]["predicted_ratio"], THREL, f"laplace[{key}].predicted_ratio (sampled scale)", 3)
pb_nat = [lap[k]["predicted_ratio_natural"] for k in ("k1_scale", "k2_scale", "k3", "t10_shift_pct")]
put("thLapPbMin", min(pb_nat), THREL, "min laplace[population-balance scalars].predicted_ratio_natural", 2)
put("thLapPbMax", max(pb_nat), THREL, "max laplace[population-balance scalars].predicted_ratio_natural", 2)
bk, by = TH["engine_power_affine_coef"], TH["measured_power_affine_coef"]
put("thEngSlope", bk[1], THREL, "engine_power_affine_coef[1]", 1)
put("thMeasSlope", by[1], THREL, "measured_power_affine_coef[1]", 1)
put("thEngLevel", bk[0], THREL, "engine_power_affine_coef[0]", 0)
put("thMeasLevel", by[0], THREL, "measured_power_affine_coef[0]", 0)
put("thSvMin", min(TH["design_singular_values"]), THREL, "design_singular_values (min)", 2)
put("thSvMax", max(TH["design_singular_values"]), THREL, "design_singular_values (max)", 2)
NAMEL = {**{k: v[0] for k, v in PL.items()}}
lt = [r"\begin{tabular}{@{}lrrrr@{}}", r"\toprule",
      r"Parameter & Share in span & Linearized & Sampled & Difference \\",
      r" & (power sensitivity) & ratio & ratio & \\", r"\midrule"]
for r in TH["laplace"]:
    nm = r["name"]
    share = fx(inf[nm]["kW"]["fraction_in_span"], 3) if nm in inf else "--"
    lt.append(rf"{NAMEL[nm]} & {share} & {fx(r['predicted_ratio_natural'], 3)} & {fx(r['sampler_ratio'], 3)} & "
              rf"{fx(r['predicted_ratio_natural'] - r['sampler_ratio'], 3)} \\")
    if nm == "t10_shift_pct":
        lt.append(r"\midrule")
lt += [r"\bottomrule", r"\end{tabular}"]
write("tab-laplace.tex", "\n".join(lt) + "\n")

# ---------------------------------------------------------------- the seeds: Monte Carlo spread of the identification
SEEDS = (("full", 42), ("full-seed43", 43), ("full-seed44", 44))
seed_rows = {n: {r["name"]: r for r in ABL[n]["contraction"]} for n, _ in SEEDS}
ratio_spread = {k: max(seed_rows[n][k]["contraction"] for n, _ in SEEDS) - min(seed_rows[n][k]["contraction"] for n, _ in SEEDS)
                for k in byname}
worst_ratio = max(ratio_spread, key=ratio_spread.get)
assert worst_ratio == "k1_scale", worst_ratio   # the text names it
put("seedRatioSpread", ratio_spread[worst_ratio], "cb",
    "max over parameters of (max - min over seeds 42, 43, 44 of contraction[name].contraction)", 3)
put("seedRatioSpreadRest", max(v for k, v in ratio_spread.items() if k != worst_ratio), "cb",
    "the same maximum over the parameters other than k1_scale", 3)
# the population-balance multipliers: their posterior mean against the prior mean, in prior standard deviations, per seed
tau_all = next(f["tau_max"] for f in folds if f["fold"] == "all")
ess_all = meth["walkers"] * folds[0]["post_burn_steps"] / tau_all
put("essAll", ess_all, "cb", "walkers * post_burn_steps / tau_max of the fit to all ten surveys (derived)", 0)
for key, nm in (("k1_scale", "KOne"), ("k2_scale", "KTwo")):
    pm = TH["prior_mean_natural"][key]
    means = [seed_rows[n][key]["posterior_mean"] for n, _ in SEEDS]
    shifts = [(m - pm) / byname[key]["prior_sd"] for m in means]
    put(f"pm{nm}", pm, THREL, f"prior_mean_natural.{key}", 3)
    put(f"seedMean{nm}Min", min(means), "cb", f"min over seeds of contraction[name={key}].posterior_mean", 3)
    put(f"seedMean{nm}Max", max(means), "cb", f"max over seeds of contraction[name={key}].posterior_mean", 3)
    put(f"shift{nm}Min", min(shifts), "cb", f"min over seeds of (posterior_mean - prior mean) / prior_sd, {key}", 2)
    put(f"shift{nm}Max", max(shifts), "cb", f"max over seeds of (posterior_mean - prior mean) / prior_sd, {key}", 2)
    put(f"mcse{nm}", byname[key]["posterior_sd"] / math.sqrt(ess_all), "cb",
        f"contraction[name={key}].posterior_sd / sqrt(essAll) (derived)", 3)
    put(f"seedMeanSpread{nm}", max(means) - min(means), "cb", f"max - min over seeds of the posterior mean of {key}", 3)
for key, nm in (("k1_scale", "KOne"), ("k2_scale", "KTwo"), ("k3", "KThree"), ("t10_shift_pct", "TShift")):
    put(f"pm{nm}Ratio", byname[key]["contraction"], "cb", f"contraction[name={key}].contraction", 3)
# the feed F80 the engine evaluates on its sieve grid (theory.json), against the measured f80
ff = {r["survey"]: r for r in TH["feed_f80"]}
for sv, sw in ((7, "Seven"), (8, "Eight")):   # a TeX macro name holds letters only
    put(f"gridFeighty{sw}", ff[sv]["f80_engine_grid_mm"], THREL, f"feed_f80[survey={sv}].f80_engine_grid_mm", 1)
    put(f"measFeighty{sw}", ff[sv]["f80_measured_mm"], THREL, f"feed_f80[survey={sv}].f80_measured_mm", 0)
gap_rest = max(abs(r["f80_engine_grid_mm"] - r["f80_measured_mm"]) for r in TH["feed_f80"] if r["survey"] not in (7, 8))
put("gridFeightyGapRest", gap_rest, THREL, "max |f80_engine_grid_mm - f80_measured_mm| over surveys other than 7 and 8", 1)
# the surveys outside each held-out 80 percent band (the reading of the band figure)
def outside(t: str, lo: np.ndarray, hi: np.ndarray) -> list[int]:
    m = meas[t]
    return [i + 1 for i in range(10) if not lo[i] <= m[i] <= hi[i]]


def words(ids: list[int]) -> str:
    return "none" if not ids else (str(ids[0]) if len(ids) == 1 else ", ".join(map(str, ids[:-1])) + f" and {ids[-1]}")


for t in ("tph", "kW"):
    lo_cb, hi_cb = np.array(sc[t]["lo80"]), np.array(sc[t]["hi80"])
    st_ = loo["loo"][t]["strict"]
    k80 = st_["uq"]["band_halfwidth"] / st_["uq"]["sigma"]
    m0, sg = np.array(st_["pred"]["M0"]), np.array(st_["uq"]["nested_sigma"])
    out_cb, out_m0 = outside(t, lo_cb, hi_cb), outside(t, m0 - k80 * sg, m0 + k80 * sg)
    assert len(out_cb) == round(10 * (1 - sc[t]["scores"]["coverage_80"]))
    assert len(out_m0) == round(10 * (1 - cmp_[t]["M0"]["coverage_80"]))
    put(f"outCb{tk[t]}", words(out_cb), "cb", f"surveys whose measurement lies outside loo.{t}.lo80..hi80 (derived)")
    put(f"outBack{tk[t]}", words(out_m0), "loo", f"surveys outside the nested residual band of loo.{t}.strict M0 (derived)")
    half_cb = (hi_cb - lo_cb) / 2
    put(f"halfCb{tk[t]}Min", half_cb.min(), "cb", f"min of (hi80 - lo80) / 2, {t}", 0)
    put(f"halfCb{tk[t]}Max", half_cb.max(), "cb", f"max of (hi80 - lo80) / 2, {t}", 0)
    put(f"halfBack{tk[t]}Min", (k80 * sg).min(), "loo", f"min of the residual-band half-width of M0, {t}", 0)
    put(f"halfBack{tk[t]}Max", (k80 * sg).max(), "loo", f"max of the residual-band half-width of M0, {t}", 0)
    put(f"cb{tk[t]}CovN", 10 - len(out_cb), "cb", f"surveys inside loo.{t}.lo80..hi80 (count, derived)")
put("balFixOverSeed", (cb["loo"]["kW"]["scores"]["mape_pct"] - ABL["balance-fixed"]["loo"]["kW"]["scores"]["mape_pct"])
    / (max(d["loo"]["kW"]["scores"]["mape_pct"] for d in seeds) - min(d["loo"]["kW"]["scores"]["mape_pct"] for d in seeds)),
    "cb", "balFixGainKw / seedSpreadKw (unrounded, derived)", 0)


def reading(ratio: float) -> str:
    return "identified" if ratio <= 0.5 else ("partly identified" if ratio <= 0.9 else "not contracted")


for k in byname:   # the text states that no parameter changes its reading from one seed to another
    assert len({reading(seed_rows[n][k]["contraction"]) for n, _ in SEEDS}) == 1, k
# the engine's wall time per evaluation (analysis/engine_timing.py)
ET = json.loads((DATA / "engine_timing.json").read_text(encoding="utf-8"))
ETREL = "manuscripts/crusherbayes/data/engine_timing.json"
put("engineMs", ET["ms_per_evaluation_median"], ETREL, "ms_per_evaluation_median", 1)
put("engineMsEvals", ET["evaluations"], ETREL, "evaluations")

(GEN / "numbers.tex").write_text("% generated by figures/make_figs.py from the committed artifacts; do not edit\n" +
                                 "".join(f"\\newcommand{{\\{k}}}{{{v}}}\n" for k, v in sorted(MACROS.items())), encoding="utf-8")
(DATA / "claims.json").write_text(json.dumps(CLAIMS, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- figure 1: held-out band against the measured value
def band_panel(ax, t, unit, title):
    meas = np.array(cb["loo"][t]["measured"])
    lo, hi, mean = (np.array(cb["loo"][t][k]) for k in ("lo80", "hi80", "pred_mean"))
    strict = loo["loo"][t]["strict"]
    m0 = np.array(strict["pred"]["M0"])
    sig = np.array(strict["uq"]["nested_sigma"])
    k80 = strict["uq"]["band_halfwidth"] / strict["uq"]["sigma"]
    blin = np.array(strict["pred"]["B_lin"])
    x = np.arange(1, 11)
    ax.vlines(x - 0.17, lo, hi, color=BLUE, lw=2.2, label="CrusherBayes 80% band", zorder=2)
    ax.plot(x - 0.17, mean, "o", color=BLUE, ms=3.2, zorder=3)
    ax.vlines(x + 0.17, m0 - k80 * sig, m0 + k80 * sig, color=ORANGE, lw=2.2, label="Refit engine, residual band", zorder=2)
    ax.plot(x + 0.17, m0, "o", color=ORANGE, ms=3.2, zorder=3)
    ax.plot(x, blin, "_", color=GREEN, ms=7, mew=1.6, label="Setting-only line", zorder=3)
    ax.plot(x, meas, "D", color=INK, ms=3.6, label="Measured", zorder=4)
    ax.set_xticks(x)
    ax.set_xlabel("Held-out survey")
    ax.set_ylabel(f"{title} ({unit})")


fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.9))
band_panel(axs[0], "kW", "kW", "Power")
band_panel(axs[1], "tph", "t/h", "Throughput")
axs[0].set_title("(a) power", loc="left", fontsize=8)
axs[1].set_title("(b) throughput", loc="left", fontsize=8)
h, l = axs[0].get_legend_handles_labels()
fig.legend(h, l, loc="lower center", ncol=4, fontsize=7, bbox_to_anchor=(0.5, -0.02))
fig.tight_layout(rect=(0, 0.08, 1, 1))
fig.savefig(OUT / "figures" / "fig-band.pdf")
plt.close(fig)

# ---------------------------------------------------------------- figure 2: prior against posterior per parameter
def prior_density(name):
    """(x grid, density) of the prior on the natural scale of the parameter, truncation included."""
    if name in byname and any(p["name"] == name for p in cb["priors"]):
        p = next(q for q in cb["priors"] if q["name"] == name)
        u = np.linspace(p["lo"], p["hi"], 4000)
        dens_u = np.exp(-0.5 * ((u - p["mu"]) / p["sd"]) ** 2)
        if p["log"]:
            x, dens = np.exp(u), dens_u / np.exp(u)
        else:
            x, dens = u, dens_u
    elif name.startswith("sigma"):
        med = meth["noise_prior"]["median"]["tph" if name.endswith("tph") else "kW"]
        u = np.linspace(0.0, math.log(1000.0), 4000)
        dens_u = np.exp(-0.5 * ((u - math.log(med)) / meth["noise_prior"]["log_sd"]) ** 2)
        x, dens = np.exp(u), dens_u / np.exp(u)
    else:
        tau = meth["discrepancy_prior_sd"]["tph" if "tph" in name else "kW"]
        x = np.linspace(-4 * tau, 4 * tau, 4000)
        dens = np.exp(-0.5 * (x / tau) ** 2)
    dens = dens / np.trapezoid(dens, x)
    return x, dens


NAMES = {k: PL[k][0] for k in PL}
fig, axs = plt.subplots(4, 4, figsize=(7.2, 6.6))
for ax, r in zip(axs.flat, rows):
    x, d = prior_density(r["name"])
    cdf = np.cumsum(d) * (x[1] - x[0])
    cdf = cdf / cdf[-1]
    xlo, xhi = np.interp([0.002, 0.998], cdf, x)
    m, s = r["posterior_mean"], r["posterior_sd"]
    xs = np.linspace(min(xlo, m - 3.5 * s), max(xhi, m + 3.5 * s), 600)
    prior_y = np.interp(xs, x, d, left=0, right=0)
    post_y = np.exp(-0.5 * ((xs - m) / s) ** 2) / (s * math.sqrt(2 * math.pi))
    ax.fill_between(xs, prior_y, color=GREY, alpha=0.35, lw=0, label="prior")
    ax.plot(xs, post_y, color=BLUE, lw=1.4, label="posterior")
    ax.axvline(r["nominal"], color=INK, lw=0.6, ls=":")
    ax.axvline(prior_mean(r), color=GREY, lw=0.6, ls="--")
    ax.set_yticks([])
    ax.set_xlabel(f"{PL[r['name']][0]} ({PL[r['name']][1]})" if PL[r["name"]][1] != "--" else PL[r["name"]][0], fontsize=7)
    ax.set_title(f"ratio {r['contraction']:.2f}", fontsize=7, loc="right", color=GREY)
    ax.tick_params(labelsize=6.5)
h, l = axs[0, 0].get_legend_handles_labels()
fig.legend(h, l, loc="lower center", ncol=2, fontsize=7, bbox_to_anchor=(0.5, -0.005))
fig.tight_layout(rect=(0, 0.03, 1, 1))
fig.savefig(OUT / "figures" / "fig-posterior.pdf")
plt.close(fig)

# ---------------------------------------------------------------- figure 3: contraction per parameter
order = sorted(rows, key=lambda r: r["contraction"])
fig, ax = plt.subplots(figsize=(3.5, 3.6))
yy = np.arange(len(order))
colors = [BLUE if r["contraction"] <= 0.5 else (GREEN if r["contraction"] <= 0.9 else GREY) for r in order]
ax.barh(yy, [r["contraction"] for r in order], color=colors, height=0.7)
ax.set_yticks(yy)
ax.set_yticklabels([PL[r["name"]][0] for r in order], fontsize=7)
ax.axvline(1.0, color=INK, lw=0.7, ls=":")
ax.axvline(0.5, color=INK, lw=0.5, ls="--")
ax.set_xlabel("posterior SD over prior SD")
ax.invert_yaxis()
fig.tight_layout()
fig.savefig(OUT / "figures" / "fig-contraction.pdf")
plt.close(fig)


# ---------------------------------------------------------------- figure 4: held-out MAPE with bootstrap intervals, all methods
def mape_panel(ax, t, title):
    rows_t = sorted(STATS[t].items(), key=lambda kv: kv[1]["mape"], reverse=True)
    yy = np.arange(len(rows_t))
    for y, (key, row) in zip(yy, rows_t):
        col = BLUE if key == "cb" else (GREEN if key == "blin" else GREY)
        ax.plot(row["mape_ci"], [y, y], color=col, lw=1.6)
        ax.plot(row["mape"], y, "o" if key != "pub" else "s", color=col, ms=4)
    ax.set_yticks(yy)
    ax.set_yticklabels([row["label"] for _, row in rows_t], fontsize=6.5)
    ax.set_xlabel("held-out MAPE (%), 95% interval")
    ax.set_title(title, loc="left", fontsize=8)


fig, axs = plt.subplots(1, 2, figsize=(7.2, 3.2))
mape_panel(axs[0], "kW", "(a) power")
mape_panel(axs[1], "tph", "(b) throughput")
fig.tight_layout()
fig.savefig(OUT / "figures" / "fig-comparison.pdf")
plt.close(fig)


# ---------------------------------------------------------------- figure 5: the outputs against the closed-side setting
def setting_panel(ax, t, unit, title):
    meas_t = meas[t]
    lo, hi = np.array(sc[t]["lo80"]), np.array(sc[t]["hi80"])
    mean = np.array(sc[t]["pred_mean"])
    # surveys at the same setting are spread by 0.9 mm so that their markers do not overlap (the setting is read at the centre)
    rank = np.array([np.sum(css[:i] == css[i]) for i in range(10)])
    count = np.array([np.sum(css == c) for c in css])
    x = css + 0.9 * (rank - (count - 1) / 2)
    ax.vlines(x + 0.25, lo, hi, color=BLUE, lw=1.6, label="CrusherBayes 80% interval (held out)")
    ax.plot(x + 0.25, mean, "o", color=BLUE, ms=3)
    ax.plot(x - 0.25, PRED[t]["pub"][1], "s", color=ORANGE, ms=3.2, mfc="none", label="engine at its shipped constants")
    ax.plot(x, PRED[t]["blin"][1], "_", color=GREEN, ms=8, mew=1.6, label="setting-only line (held out)")
    ax.plot(x, meas_t, "D", color=INK, ms=3.4, label="measured")
    ax.set_xlabel("closed-side setting (mm)")
    ax.set_ylabel(f"{title} ({unit})")
    ax.set_title(f"({'a' if t == 'kW' else 'b'}) {title.lower()}", loc="left", fontsize=8)


fig, axs = plt.subplots(1, 2, figsize=(7.2, 3.0))
setting_panel(axs[0], "kW", "kW", "Power")
setting_panel(axs[1], "tph", "t/h", "Throughput")
h, l = axs[0].get_legend_handles_labels()
fig.legend(h, l, loc="lower center", ncol=4, fontsize=6.5, bbox_to_anchor=(0.5, -0.01))
fig.tight_layout(rect=(0, 0.09, 1, 1))
fig.savefig(OUT / "figures" / "fig-setting.pdf")
plt.close(fig)

# ---------------------------------------------------------------- figure 6: the ablation
fig, axs = plt.subplots(1, 2, figsize=(7.2, 3.1), sharey=True)
yy = np.arange(len(ABL_ORDER))
for ax, t, unit in ((axs[0], "kW", "kW"), (axs[1], "tph", "t/h")):
    m_ = [ABL[n]["loo"][t]["scores"]["mape_pct"] for n, _ in ABL_ORDER]
    w_ = [ABL[n]["loo"][t]["scores"]["mean_width"] for n, _ in ABL_ORDER]
    cv_ = [ABL[n]["loo"][t]["scores"]["coverage_80"] for n, _ in ABL_ORDER]
    ax.barh(yy, m_, color=[BLUE if n.startswith("full") else GREY for n, _ in ABL_ORDER], height=0.6)
    ref = STATS[t]["blin" if t == "kW" else "back"]["mape"]
    ax.axvline(ref, color=GREEN if t == "kW" else ORANGE, lw=1.0, ls="--")
    for y, mv, wv, cvv in zip(yy, m_, w_, cv_):
        ax.text(mv + 0.4, y, f"cov {cvv:.1f}, width {wv:.0f} {unit}", va="center", fontsize=6)
    ax.set_xlabel("held-out MAPE (%)")
    ax.set_xlim(0, max(m_) * 1.9)
    ax.set_title(f"({'a' if t == 'kW' else 'b'}) {'power' if t == 'kW' else 'throughput'}", loc="left", fontsize=8)
axs[0].set_yticks(yy)
axs[0].set_yticklabels([lab.replace(r"$\tau_t$", "tau") for _, lab in ABL_ORDER], fontsize=6.5)
axs[0].invert_yaxis()
fig.tight_layout()
fig.savefig(OUT / "figures" / "fig-ablation.pdf")
plt.close(fig)

# ---------------------------------------------------------------- figure 7: convergence of every posterior
fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.6))
labels = [str(f["fold"]) if f["fold"] != "all" else "all" for f in folds]
xx = np.arange(len(folds))
axs[0].bar(xx, taus, color=BLUE, width=0.6, label="differential-evolution moves")
st = ABL["stretch-move"]["convergence"]["folds"]
axs[0].plot(xx, [f["tau_max"] for f in st], "D", color=ORANGE, ms=3.5, label="stretch move")
axs[0].axhline((meth["steps"] - meth["burn_in_steps"]) / conv["tau_factor"], color=INK, lw=0.7, ls="--")
axs[0].set_xticks(xx)
axs[0].set_xticklabels(labels, fontsize=6.5)
axs[0].set_xlabel("posterior (held-out survey)")
axs[0].set_ylabel("largest autocorrelation time (steps)")
axs[0].legend(fontsize=6.5)
axs[0].set_title("(a) autocorrelation time", loc="left", fontsize=8)
axs[1].bar(xx, ratios, color=BLUE, width=0.6)
axs[1].plot(xx, [f["chain_over_tau"] for f in st], "D", color=ORANGE, ms=3.5)
axs[1].axhline(conv["tau_factor"], color=INK, lw=0.7, ls="--")
axs[1].set_xticks(xx)
axs[1].set_xticklabels(labels, fontsize=6.5)
axs[1].set_xlabel("posterior (held-out survey)")
axs[1].set_ylabel("post-burn steps / autocorrelation time")
axs[1].set_title("(b) chain length in autocorrelation times", loc="left", fontsize=8)
fig.tight_layout()
fig.savefig(OUT / "figures" / "fig-convergence.pdf")
plt.close(fig)

# ---------------------------------------------------------------- figure 8: the shrinkage closed form over lambda
fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.7))
for ax, t, title in ((axs[0], "kW", "(a) power"), (axs[1], "tph", "(b) throughput")):
    s = TH["shrinkage"][t]
    lam = np.array([c["lambda"] for c in s["curve"][1:]])
    mp = np.array([c["mape_pct"] for c in s["curve"][1:]])
    ax.semilogx(lam, mp, color=INK, lw=1.2, label="closed form, scalars at nominal")
    ax.axhline(s["curve"][0]["mape_pct"], color=GREY, lw=0.8, ls=":", label=r"closed form at $\lambda = 0$")
    ax.plot([s["lambda_method"]], [s["at_method"]["mape_pct"]], "o", color=INK, ms=4)
    ax.axhline(s["cb_mape_pct"], color=BLUE, lw=1.0, ls="--", label="CrusherBayes (sampled)")
    ax.axhline(STATS[t]["blin"]["mape"], color=GREEN, lw=1.0, ls="-.", label="setting-only line")
    ax.axvline(s["lambda_method"], color=GREY, lw=0.6)
    ax.set_xlabel(r"shrinkage $\lambda=\sigma_t^2/\tau_t^2$")
    ax.set_ylabel("held-out MAPE (%)")
    ax.set_title(title, loc="left", fontsize=8)
h, l = axs[0].get_legend_handles_labels()
fig.legend(h, l, loc="lower center", ncol=4, fontsize=6.5, bbox_to_anchor=(0.5, -0.01))
fig.tight_layout(rect=(0, 0.1, 1, 1))
fig.savefig(OUT / "figures" / "fig-shrinkage.pdf")
plt.close(fig)
print(f"wrote {len(MACROS)} numbers, 11 tables, 8 figures under {OUT}")
