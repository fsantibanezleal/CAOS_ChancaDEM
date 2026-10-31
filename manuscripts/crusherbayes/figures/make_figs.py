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
    return tex_num(f"{x:.{d}f}")


def write(name: str, text: str) -> None:
    (GEN / name).write_text(text, encoding="utf-8")


# accuracy table
acc = [r"\begin{tabular}{@{}llrrrrr@{}}", r"\toprule",
       r"Target & Method & MAPE (\%) & RMSE & Mean log density & Coverage & Width \\", r"\midrule"]
for t, unit in (("tph", "t/h"), ("kW", "kW")):
    acc.append(rf"\multicolumn{{7}}{{@{{}}l}}{{\textit{{{'Throughput' if t == 'tph' else 'Power'} ({unit})}}}} \\")
    s = sc[t]["scores"]
    lines = [("CrusherBayes", s)] + [(n, cmp_[t][k]) for n, k in
                                     (("Setting-only line", "B_lin"), ("Refit backbone with residual band", "M0"), ("Free-form linear fit", "M2"))]
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
idt = [r"\begin{tabular}{@{}llrrrrrl@{}}", r"\toprule",
       r"Parameter & Unit & Prior mean & Prior SD & Posterior mean & Posterior SD & Ratio & Reading \\", r"\midrule"]
for r in rows:
    lab, unit = PL[r["name"]]
    reading = "identified" if r["contraction"] <= 0.5 else ("partly identified" if r["contraction"] <= 0.9 else "at its prior")
    idt.append(rf"{lab} & {unit} & {fx(r['nominal'], 2)} & {fx(r['prior_sd'], 2)} & {fx(r['posterior_mean'], 2)} & "
               rf"{fx(r['posterior_sd'], 2)} & {fx(r['contraction'], 3)} & {reading} \\")
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
    ax.vlines(x + 0.17, m0 - k80 * sig, m0 + k80 * sig, color=ORANGE, lw=2.2, label="Refit backbone, residual band", zorder=2)
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
print(f"wrote {len(MACROS)} numbers, 7 tables, 3 figures under {OUT}")
