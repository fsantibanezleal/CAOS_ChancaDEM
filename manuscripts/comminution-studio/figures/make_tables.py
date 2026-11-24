#!/usr/bin/env python3
"""Regenerate every result table of the ChancaDEM technical report from the COMMITTED artifacts and the product's code.

Each table is written as a LaTeX fragment (the booktabs ``tabular`` body, or a ``longtable`` for the appendix schemas) into
``manuscripts/comminution-studio/tex/tables/``; ``main.tex`` holds the float, its caption and its label and inputs the
fragment, so a new bake regenerates the numbers instead of retyping them. The SHA-256 digests of the artifacts the report
reads are written to ``manuscripts/comminution-studio/data/sha256.txt``.

Sources read (nothing else):
  data/examples/hp500-surveys.csv, data/examples/params.csv           the two source tables
  data/derived/manifests/*.json, data/derived/*/trace.json            the 27 baked cases
  data/derived/hp500/backbone.json, loo.json, crusherbayes.json       the HP500 documents
  data/derived/hp500/comparison.json                                  the paired comparison (tab-comparison)
  data/derived/readiness.json                                         the readiness rows (the counts the text states)
  data-pipeline/pipeline/model/crusher/ (evaluate, campaign)          the drift response of survey 1 (numbers-drift)
  data/derived/model-metrics.json, data/derived/models/*.json         the learned models
  docs/contracts/catalog.md, docs/contracts/schemas/*.schema.json     the data contracts
  data-pipeline/pipeline/model/crusher/ (KMODEL, CAP, REF_THROW_MM), data-pipeline/pipeline/model/sweep.py (RANGES)
  manuscripts/comminution-studio/data/resources.json                  the measured stages (measure_resources.py)
  figures/heldout_uq.py                                               the bootstrap over surveys and the published
                                                                      throughput model of Rocha et al. (tab-uncertainty)
  data-pipeline/pipeline/model/crusher/labjaw.py, tests/test_labjaw.py  the laboratory-jaw module and the printed Table 2 of
                                                                      Sastri 1994 as the test holds it (tab-sastri-table2,
                                                                      numbers-labjaw)
  data/derived/dem/jaw-lab.json                                       the laboratory-jaw document (tab-dem-runs, tab-dem-sides, tab-dem-pb,
                                                                      tab-dem-decisions, numbers-dem-results)
  the installed package crushdem (crushdem.cases.barrios2020, crushdem.machines)  the laboratory jaw case: its machine, contacts,
                                                                      ore derivation and digitised measurements
                                                                      (tab-dem-parameters, tab-lab-measured); skipped, with the
                                                                      committed fragments kept, when the package is not importable

Run:  python manuscripts/comminution-studio/figures/make_tables.py     (any working directory; numpy only)
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE.parent / "tex" / "tables"
DATA = HERE.parent / "data"
DER = ROOT / "data" / "derived"
HP = DER / "hp500"
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.model.crusher.capacity import CAP, HP500_QREF  # noqa: E402
from pipeline.model.crusher.classification import KMODEL  # noqa: E402
from pipeline.model.crusher.machines import REF_THROW_MM  # noqa: E402
from pipeline.model.sweep import RANGES  # noqa: E402

DASH = "--"
from pipeline.model.crusher.breakage import t10_of as _t10_of  # noqa: E402,F401
import inspect  # noqa: E402

from pipeline.model.crusher.breakage import t10_of as _t10_of  # noqa: E402

ENGINE_A = float(inspect.signature(_t10_of).parameters["a"].default)  # the A of the engine's t10_of, read from its code [percent]
MACHINE_NAME = {"cone-sec": "secondary cone", "cone-tert": "tertiary cone", "cone-short-head": "short-head cone",
                "gyratory": "gyratory", "jaw": "jaw"}


def _json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def tex(s: object) -> str:
    """Escape a plain string for LaTeX text mode (ASCII output)."""
    s = str(s)
    rep = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}",
           "~": r"\textasciitilde{}", "^": r"\textasciicircum{}"}
    s = "".join(rep.get(c, c) for c in s)
    uni = {"≥": r"$\geq$", "≤": r"$\leq$", "≈": r"$\approx$", "×": r"$\times$", "−": "-",
           "\u2013": "--", "\u2014": ", ", "\u2192": "to","±": r"$\pm$", "é": r"\'e", "á": r"\'a",
           "ó": r"\'o", "í": r"\'i", "ú": r"\'u", "ñ": r"\~n", "’": "'", "“": "``",
           "”": "''", "²": r"$^2$", "μ": r"$\mu$"}
    s = "".join(uni.get(c, c) for c in s)
    return s.encode("ascii", "replace").decode("ascii").replace("?", "?")


def num(v: object, nd: int = 2) -> str:
    if v is None:
        return DASH
    if isinstance(v, bool):
        return "yes" if v else "no"
    if isinstance(v, (int, float)):
        return f"${v:.{nd}f}$"
    return tex(v)


def write(name: str, body: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.tex").write_text("% generated by figures/make_tables.py; do not edit by hand\n" + body + "\n",
                                     encoding="utf-8", newline="\n")


def tabular(spec: str, head: list[str], rows: list[list[str]], groups: str = "") -> str:
    lines = [r"\begin{tabular}{" + spec + "}", r"\toprule"]
    if groups:
        lines.append(groups)
    lines.append(" & ".join(head) + r" \\")
    lines.append(r"\midrule")
    lines += [" & ".join(r) + r" \\" for r in rows]
    lines += [r"\bottomrule", r"\end{tabular}"]
    return "\n".join(lines)


# ------------------------------------------------------------------------------------------------------------------------
# the source tables and the cases
# ------------------------------------------------------------------------------------------------------------------------
def tab_surveys() -> None:
    bb = _json(HP / "backbone.json")["surveys"]
    rows = []
    for s in bb:
        m, b = s["measured"], s["backbone"]
        rows.append([str(s["n"]), num(m["css_mm"], 0), num(m["f80_mm"], 0), num(m["feed_tph"], 0), num(m["power_kw"], 0),
                     num(b["f80_model_mm"], 2), num(b["p80_mm"], 2), num(b["throughput_tph"], 1),
                     num(b["bond_power_kw"], 1), num(b["calibrated_power_kw"], 1)])
    groups = (r" & \multicolumn{4}{c}{Measured (Table A1)} & \multicolumn{5}{c}{Calibrated engine} \\"
              r" \cmidrule(lr){2-5}\cmidrule(lr){6-10}")
    head = ["Survey", "CSS (mm)", "$f_{80}$ (mm)", "Feed (t/h)", "Power (kW)", "$F_{80}$ (mm)", "$P_{80}$ (mm)",
            "$Q$ (t/h)", "Bond (kW)", "$P_c$ (kW)"]
    write("tab-surveys", tabular("@{}r rrrr rrrrr@{}", head, rows, groups))


def tab_cases() -> None:
    idx = _json(DER / "manifests" / "index.json")
    rows = []
    for c in idx["cases"]:
        m = _json(DER / "manifests" / f"{c['case_id']}.json")
        s = _json(DER / c["case_id"] / "trace.json")["summary"]
        p = m["params"]
        rows.append([tex(c["case_id"]), tex(MACHINE_NAME[p["machine"]]), num(p["css_mm"], 0), num(p["throw_mm"], 0),
                     num(p["speed_rpm"], 0), num(s["f80_mm"], 1), num(s["p80_mm"], 1), num(s["reduction_ratio"], 2),
                     num(s["throughput_tph"], 0), num(s["power_kw"], 0), tex(s["regime"]),
                     "yes" if s["valid"] else "no"])
    head = ["Case", "Machine", "CSS", "Throw", "Speed", "$F_{80}$", "$P_{80}$", "$F_{80}/P_{80}$", "$Q$", "Power",
            "Regime", "Valid"]
    units = [r"\multicolumn{1}{c}{}", "", "(mm)", "(mm)", "(rpm)", "(mm)", "(mm)", "", "(t/h)", "(kW)", "", ""]
    body = tabular("@{}l l rrr rrr rr l l@{}", head, rows)
    body = body.replace(r"\midrule", " & ".join(units) + r" \\" + "\n" + r"\midrule", 1)
    write("tab-cases", body)


def tab_machines() -> None:
    rows = []
    for mach in ("gyratory", "jaw", "cone-sec", "cone-tert", "cone-short-head"):
        k, c, r = KMODEL[mach], CAP[mach], RANGES[mach]
        rows.append([tex(MACHINE_NAME[mach]), num(k.k1a, 1), num(k.k1b, 2), num(k.k2a, 1), num(k.k2b, 2), num(k.k3, 1),
                     num(REF_THROW_MM[mach], 0), num(c.q_ref, 0), num(c.speed_opt, 0), num(c.ref_gap_mm, 0),
                     f"${r['css_mm'][0]:g}$--${r['css_mm'][1]:g}$", f"${r['speed_rpm'][0]:g}$--${r['speed_rpm'][1]:g}$"])
    head = ["Machine", "$a_1$", "$b_1$", "$a_2$", "$b_2$", "$K_3$", "$T_{ref}$", "$Q_{ref}$", "$N_{opt}$", "$g_{ref}$",
            "CSS range", "Speed range"]
    units = ["", "(mm)", "", "(mm)", "", "", "(mm)", "(t/h)", "(rpm)", "(mm)", "(mm)", "(rpm)"]
    body = tabular("@{}l rrrrr r rrr rr@{}", head, rows)
    body = body.replace(r"\midrule", " & ".join(units) + r" \\" + "\n" + r"\midrule", 1)
    write("tab-machines", body)


# ------------------------------------------------------------------------------------------------------------------------
# CrusherCal and the benchmark
# ------------------------------------------------------------------------------------------------------------------------
def tab_power_parity() -> None:
    pp = _json(HP / "loo.json")["power_parity"]
    names = [("constant_mean", "Constant mean of the ten surveys"), ("bare_bond", "Bare Bond draw $P_d$"),
             ("engine_pc_1p30_110", r"Published form $1.30\,P_d + 110$"), ("refit_pc", r"Refit form $\zeta P_d + P_n$")]
    rows = [[n, num(pp[k]["mape_pct"]), num(pp[k]["rmse"]), num(pp[k]["r2"], 3), num(pp[k]["maxdev_pct"])]
            for k, n in names]
    write("tab-power-parity", tabular("@{}l rrrr@{}", ["Power estimate (in sample)", "MAPE (\\%)", "RMSE (kW)", "$R^2$",
                                                       "Max. dev. (\\%)"], rows))


BENCH = [("constant_mean", "Constant mean"), ("M1_label_shuffle", "Label-shuffle control"),
         ("M0_backbone", "Calibrated backbone"), ("M1_residual", "Backbone with bounded residual"),
         ("M2_freeform", "Free-form fit on CSS and $f_{80}$"), ("B_lin", "Setting-only line"),
         ("Morrell", "Morrell, through the origin"), ("Morrell_noload", "Morrell with a no-load term")]
# the three BENCH rows that crusherbayes.json also scores: its comparator key (the key) and the loo.json row (the value)
BENCH_COMPARATOR_ROW = {"M0": "M0_backbone", "M2": "M2_freeform", "B_lin": "B_lin"}
BENCH_ROW_COMPARATOR = {row: comp for comp, row in BENCH_COMPARATOR_ROW.items()}


def tab_bench() -> None:
    loo = _json(HP / "loo.json")["loo"]
    cb = _json(HP / "crusherbayes.json")
    rows = []
    for key, name in BENCH:
        comp = BENCH_ROW_COMPARATOR.get(key)
        row = [name]
        for t in ("tph", "kW"):
            s = loo[t]["strict"].get(key)
            c = cb["comparators"][t].get(comp) if comp else None
            if s is None:
                row += [DASH] * 5
                continue
            row += [num(s["mape_pct"]), num(s["rmse"], 1), num(s["r2"], 3),
                    num(c["coverage_80"], 2) if c else DASH, num(c["mean_width"], 1) if c else DASH]
        rows.append(row)
    row = ["CrusherBayes (posterior predictive)"]
    for t in ("tph", "kW"):
        s = cb["loo"][t]["scores"]
        row += [num(s["mape_pct"]), num(s["rmse"], 1), DASH, num(s["coverage_80"], 2), num(s["mean_width"], 1)]
    rows.append(row)
    groups = (r" & \multicolumn{5}{c}{Throughput (t/h)} & \multicolumn{5}{c}{Power (kW)} \\"
              r" \cmidrule(lr){2-6}\cmidrule(lr){7-11}")
    head = ["Method", "MAPE", "RMSE", "$R^2$", "Cov.", "Width", "MAPE", "RMSE", "$R^2$", "Cov.", "Width"]
    write("tab-bench", tabular("@{}l rrrrr rrrrr@{}", head, rows, groups))


def tab_lpd() -> None:
    cb = _json(HP / "crusherbayes.json")
    rows = []
    for comp, name in {"B_lin": "Setting-only line", "M0": "Calibrated backbone", "M2": "Free-form fit"}.items():
        rows.append([name] + [num(cb["comparators"][t][comp]["lpd_mean"], 3) for t in ("tph", "kW")])
    rows.append(["CrusherBayes"] + [num(cb["loo"][t]["scores"]["lpd_mean"], 3) for t in ("tph", "kW")])
    write("tab-lpd", tabular("@{}l rr@{}", ["Method", "Throughput", "Power"], rows))


def tab_leaky() -> None:
    loo = _json(HP / "loo.json")["loo"]
    rows = []
    for key, name in BENCH:
        row = [name]
        for t in ("tph", "kW"):
            s, lk = loo[t]["strict"].get(key), loo[t]["leaky"].get(key)
            if s is None:
                row += [DASH] * 3
            else:
                row += [num(s["mape_pct"]), num(lk["mape_pct"]), num(s["mape_pct"] - lk["mape_pct"])]
        rows.append(row)
    groups = (r" & \multicolumn{3}{c}{Throughput MAPE (\%)} & \multicolumn{3}{c}{Power MAPE (\%)} \\"
              r" \cmidrule(lr){2-4}\cmidrule(lr){5-7}")
    head = ["Method", "Strict", "Leaky", "Gap", "Strict", "Leaky", "Gap"]
    write("tab-leaky", tabular("@{}l rrr rrr@{}", head, rows, groups))


UQ_ROWS = {"constant_mean": "Constant mean", "label_shuffle": "Label-shuffle control", "M0": "Calibrated backbone",
           "M1": "Backbone with bounded residual", "M2": "Free-form fit on CSS and $f_{80}$", "B_lin": "Setting-only line",
           "Morrell": "Morrell, through the origin", "Morrell_noload": "Morrell with a no-load term",
           "CrusherBayes": "CrusherBayes (predictive mean)",
           "Rocha_published": r"Rocha et al.\ throughput model, $\lambda_{\mathrm R}=0.84$",
           "Rocha_refit": r"Rocha et al.\ throughput model, $\lambda_{\mathrm R}$ refit per fold"}
UQ_MACRO = {"constant_mean": "Mean", "label_shuffle": "Shuf", "M0": "Bb", "M1": "Res", "M2": "Free", "B_lin": "Line",
            "Morrell": "Mor", "Morrell_noload": "Mornl", "CrusherBayes": "Cb", "Rocha_published": "Rocha",
            "Rocha_refit": "Rocharef"}


def _ci(v: float, lo: float, hi: float, sign: bool = False) -> str:
    """A value with its interval in brackets, compact enough for a seven-column table."""
    f = "+.2f" if sign else ".2f"
    g = "+.1f" if sign else ".1f"
    return f"${v:{f}}$ [${lo:{g}}$, ${hi:{g}}$]"


def tab_uncertainty() -> None:
    """The bootstrap over surveys of every held-out MAPE and of the paired differences (figures/heldout_uq.py), and the
    published throughput model of Rocha et al. run on the surveys; with the macros the text cites."""
    import heldout_uq as uq

    errs = uq.heldout_errors()
    res = uq.bootstrap(errs)
    rows = []
    for key, name in UQ_ROWS.items():
        row = [name]
        q = res["tph"].get(key)
        row += ([_ci(q["mape"], q["lo"], q["hi"]),
                 DASH if key == "B_lin" else _ci(q["d_B_lin"], q["d_B_lin_lo"], q["d_B_lin_hi"], True),
                 DASH if key == "M0" else _ci(q["d_M0"], q["d_M0_lo"], q["d_M0_hi"], True)] if q else [DASH] * 3)
        p = res["kW"].get(key)
        row += ([_ci(p["mape"], p["lo"], p["hi"]),
                 DASH if key == "B_lin" else _ci(p["d_B_lin"], p["d_B_lin_lo"], p["d_B_lin_hi"], True)] if p else [DASH] * 2)
        rows.append(row)
    groups = (r" & \multicolumn{3}{c}{Throughput} & \multicolumn{2}{c}{Power} \\"
              r" \cmidrule(lr){2-4}\cmidrule(lr){5-6}")
    head = ["Predictor", r"MAPE [95\%]", "Minus line", "Minus backbone", r"MAPE [95\%]", "Minus line"]
    write("tab-uncertainty", tabular("@{}l rrr rr@{}", head, rows, groups))

    macros = [f"\\newcommand{{\\uqB}}{{{uq.B:,}}}".replace(",", "{,}"), f"\\newcommand{{\\uqSeed}}{{{uq.BOOT_SEED}}}"]
    for t, tl in (("tph", "Q"), ("kW", "P")):
        for key, r in res[t].items():
            m = "uq" + tl + UQ_MACRO[key]
            vals = {"": r["mape"], "lo": r["lo"], "hi": r["hi"], "dl": r["d_B_lin"], "dllo": r["d_B_lin_lo"],
                    "dlhi": r["d_B_lin_hi"], "db": r["d_M0"], "dblo": r["d_M0_lo"], "dbhi": r["d_M0_hi"]}
            for suf, v in vals.items():
                fmt = f"{v:.2f}" if suf in ("", "dl", "db") else f"{v:.1f}"
                macros.append(f"\\newcommand{{\\{m}{suf}}}{{{fmt}}}")
    # the published throughput model: its parameters, the refit lambda and the work-index sensitivity
    bb = _json(HP / "backbone.json")["surveys"]
    import numpy as np

    css = np.array([s["measured"]["css_mm"] for s in bb], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in bb], float)
    q = np.array([s["measured"]["feed_tph"] for s in bb], float)
    r = uq.rocha_throughput(css, f80, q)
    lo_wi, hi_wi = (uq.rocha_throughput(css, f80, q, w) for w in uq.WI_BOUNDS)
    from pipeline.hp500.loo import mape, r2

    macros += [f"\\newcommand{{\\rochaLamLo}}{{{r['lam_fold'].min():.3f}}}",
               f"\\newcommand{{\\rochaLamHi}}{{{r['lam_fold'].max():.3f}}}",
               f"\\newcommand{{\\rochaLamAll}}{{{r['lam_all']:.3f}}}",
               f"\\newcommand{{\\rochaRsq}}{{{r2(q, r['published']):.3f}}}",
               f"\\newcommand{{\\rochaTen}}{{{r['published'][9]:.0f}}}",
               f"\\newcommand{{\\rochaWiLo}}{{{mape(q, lo_wi['published']):.2f}}}",
               f"\\newcommand{{\\rochaWiHi}}{{{mape(q, hi_wi['published']):.2f}}}"]
    write("numbers-uq", "\n".join(macros))


def tab_pairs() -> None:
    """The paired difference of every two predictors on each target (figures/heldout_uq.py ``pairwise``), drawn on the
    resamples of tab-uncertainty: one lower-triangular matrix per target, each cell the 95 % interval of the row's MAPE minus
    the column's, in bold where it excludes zero; with a macro per ordered pair (\\uq<Q|P>p<row><column>, lo, hi)."""
    import heldout_uq as uq

    pairs = uq.pairwise(uq.heldout_errors())
    macros = []

    def get(t: str, a: str, b: str) -> dict:
        if (a, b) in pairs[t]:
            return pairs[t][(a, b)]
        r = pairs[t][(b, a)]
        return {"d": -r["d"], "lo": -r["hi"], "hi": -r["lo"]}

    blocks = []
    for t, tl, title in (("tph", "Q", "Throughput"), ("kW", "P", "Power")):
        keys = [k for k in UQ_ROWS if any(k in p for p in pairs[t])]
        names = UQ_ROWS
        for a in keys:
            for b in keys:
                if a != b:
                    r = get(t, a, b)
                    m = "uq" + tl + "p" + UQ_MACRO[a] + UQ_MACRO[b]
                    macros += [f"\\newcommand{{\\{m}}}{{{r['d']:+.2f}}}", f"\\newcommand{{\\{m}lo}}{{{r['lo']:+.1f}}}",
                               f"\\newcommand{{\\{m}hi}}{{{r['hi']:+.1f}}}"]
        n = len(keys)
        lines = [r"\multicolumn{1}{@{}l}{\textit{" + title + ": row minus column}}" + "".join(
            f" & {j + 1}" for j in range(n - 1)) + r" \\", r"\midrule"]
        for i in range(n):
            row = [f"{i + 1}~{names[keys[i]]}"]
            for j in range(n - 1):
                if j >= i:
                    row.append("")
                    continue
                r = get(t, keys[i], keys[j])
                cell = f"[${r['lo']:+.1f}$, ${r['hi']:+.1f}$]"
                if r["lo"] > 0 or r["hi"] < 0:
                    cell = f"[$\\mathbf{{{r['lo']:+.1f}}}$, $\\mathbf{{{r['hi']:+.1f}}}$]"
                row.append(cell)
            lines.append(" & ".join(row) + r" \\")
        blocks.append((n, lines))
    ncol = max(n for n, _ in blocks) - 1
    body = [r"\begin{tabular}{@{}l " + "c" * ncol + "@{}}", r"\toprule"]
    for k, (_, lines) in enumerate(blocks):
        if k:
            body.append(r"\midrule")
        body += lines
    body += [r"\bottomrule", r"\end{tabular}"]
    write("tab-pairs", "\n".join(body))
    write("numbers-pairs", "\n".join(macros))


# the methods of hp500-comparison by their names in the report, and the macro stem of each (the document's ids are data keys)
CMP_NAME = {"M0_backbone": "Calibrated backbone", "M1_residual": "Backbone with bounded residual",
            "M2_freeform": "Free-form fit on CSS and $f_{80}$", "B_lin": "Setting-only line",
            "Morrell": "Morrell, through the origin", "Morrell_noload": "Morrell with a no-load term",
            "constant_mean": "Constant mean", "M1_label_shuffle": "Label-shuffle control",
            "crusherbayes": "CrusherBayes (predictive mean)"}
CMP_MACRO = {"M0_backbone": "Bb", "M1_residual": "Res", "M2_freeform": "Free", "B_lin": "Line", "Morrell": "Mor",
             "Morrell_noload": "Mornl", "constant_mean": "Mean", "M1_label_shuffle": "Shuf", "crusherbayes": "Cb"}


def tab_comparison() -> None:
    """The paired comparison of the held-out methods against the recommended one (data/derived/hp500/comparison.json,
    contract hp500-comparison): per target the recommended method, then every method with per-survey predictions by its
    mean paired difference, with the 95 % interval (bold where it excludes zero), the wins and p_better; with the macros the
    text cites (\\cmp<Q|P><method>, Mape, Lo, Hi, Wins, Pb; \\cmp<Q|P>Rec and Run, the names of the recommended method and of
    the runner-up)."""
    doc = _json(HP / "comparison.json")
    boot = doc["bootstrap"]
    macros = [f"\\newcommand{{\\cmpB}}{{{boot['resamples']:,}}}".replace(",", "{,}"),
              f"\\newcommand{{\\cmpSeed}}{{{boot['seed']}}}", f"\\newcommand{{\\cmpN}}{{{doc['n']}}}",
              f"\\newcommand{{\\cmpQlo}}{{{boot['quantiles'][0]}}}", f"\\newcommand{{\\cmpQhi}}{{{boot['quantiles'][1]}}}",
              f"\\newcommand{{\\cmpCbIncluded}}{{{'yes' if doc['crusherbayes']['included'] else 'no'}}}"]
    lines = []
    for t, tl, title in (("tph", "Q", "Throughput"), ("kW", "P", "Power")):
        block = doc["targets"][t]
        mape = {m["id"]: m["mape_pct"] for m in block["methods"]}
        rec, run = block["recommended"], block["runner_up"]
        bare = lambda k: CMP_NAME[k].replace(" (predictive mean)", "")  # noqa: E731
        macros += [f"\\newcommand{{\\cmp{tl}Rec}}{{{bare(rec)}}}", f"\\newcommand{{\\cmp{tl}Run}}{{{bare(run)}}}"]
        for m in block["methods"]:
            macros.append(f"\\newcommand{{\\cmp{tl}{CMP_MACRO[m['id']]}Mape}}{{{m['mape_pct']:.2f}}}")
        if lines:
            lines.append(r"\midrule")
        lines.append(r"\multicolumn{6}{@{}l}{\textit{" + title + ": every method minus " + bare(rec).lower().replace(
            "crusherbayes", "CrusherBayes") + r", the recommended method}} \\")
        lines.append(r"\midrule")
        lines.append(" & ".join([CMP_NAME[rec] + " (recommended)", num(mape[rec]), DASH, DASH, DASH, DASH]) + r" \\")
        for p in sorted(block["paired"], key=lambda r: r["mean_diff_pts"]):
            k = p["method"]
            lo, hi = p["ci95"]
            cell = f"[${lo:+.2f}$, ${hi:+.2f}$]"
            if lo > 0 or hi < 0:
                cell = f"[$\\mathbf{{{lo:+.2f}}}$, $\\mathbf{{{hi:+.2f}}}$]"
            name = CMP_NAME[k] + (" (runner-up)" if k == run else "")
            lines.append(" & ".join([name, num(mape[k]), f"${p['mean_diff_pts']:+.2f}$", cell,
                                     f"{p['wins']} of {doc['n']}", num(p["p_better"])]) + r" \\")
            m = f"cmp{tl}{CMP_MACRO[k]}"
            macros += [f"\\newcommand{{\\{m}}}{{{p['mean_diff_pts']:.2f}}}", f"\\newcommand{{\\{m}Lo}}{{{lo:.2f}}}",
                       f"\\newcommand{{\\{m}Hi}}{{{hi:.2f}}}", f"\\newcommand{{\\{m}Wins}}{{{p['wins']}}}",
                       f"\\newcommand{{\\{m}Pb}}{{{p['p_better']:.2f}}}"]
        paired_ids = {p["method"] for p in block["paired"]}
        for m in block["methods"]:
            if m["id"] != rec and m["id"] not in paired_ids:
                lines.append(" & ".join([CMP_NAME[m["id"]] + " (no per-survey predictions)", num(m["mape_pct"]), DASH, DASH,
                                         DASH, DASH]) + r" \\")
    # the document against the report's own bootstrap (figures/heldout_uq.py, another seed): the largest difference of an
    # interval end and of a point difference over every paired row, and the surveys a halved interval would need
    import heldout_uq as uq

    pairs = uq.pairwise(uq.heldout_errors())
    # heldout_uq's prediction keys (data keys of hp500-loo's strict block) against the comparison document's method ids
    from_uq = {"M0": "M0_backbone", "M1": "M1_residual", "M2": "M2_freeform", "B_lin": "B_lin", "Morrell": "Morrell",
               "Morrell_noload": "Morrell_noload", "constant_mean": "constant_mean", "CrusherBayes": "crusherbayes"}
    to_uq = {doc_id: uq_key for uq_key, doc_id in from_uq.items()}
    worst_end, worst_point = 0.0, 0.0
    for t in ("tph", "kW"):
        block = doc["targets"][t]
        for p in block["paired"]:
            a, b = to_uq[p["method"]], to_uq[block["recommended"]]
            r = pairs[t][(a, b)] if (a, b) in pairs[t] else {"d": -pairs[t][(b, a)]["d"], "lo": -pairs[t][(b, a)]["hi"],
                                                               "hi": -pairs[t][(b, a)]["lo"]}
            worst_end = max(worst_end, abs(p["ci95"][0] - r["lo"]), abs(p["ci95"][1] - r["hi"]))
            worst_point = max(worst_point, abs(p["mean_diff_pts"] - r["d"]))
    macros += [f"\\newcommand{{\\cmpAgreeEnd}}{{{worst_end:.2f}}}", f"\\newcommand{{\\cmpAgreePoint}}{{{worst_point:.3f}}}"]
    # surveys at which the interval on power of the runner-up and of CrusherBayes would exclude zero if the per-survey
    # differences kept their spread: a distance from the point difference to an interval end shrinks as sqrt(N_s / N), so the
    # end that must cross zero, the lower one, reaches it at N = N_s ((d - lo) / d)^2; the symmetric half-width (hi - lo) / 2
    # in place of d - lo gives N = N_s ((hi - lo) / 2d)^2. The text gives the two as a range (lower to upper).
    for t, tl in (("kW", "P"),):
        block = doc["targets"][t]
        for p in block["paired"]:
            if p["method"] in ("M2_freeform", "crusherbayes"):
                d, lo, hi = p["mean_diff_pts"], p["ci95"][0], p["ci95"][1]
                by_lower = doc["n"] * ((d - lo) / d) ** 2
                by_half = doc["n"] * ((hi - lo) / 2 / d) ** 2
                name = CMP_MACRO[p["method"]]
                macros += [f"\\newcommand{{\\cmp{tl}{name}NeedLower}}{{{by_lower:.0f}}}",
                           f"\\newcommand{{\\cmp{tl}{name}NeedHalf}}{{{by_half:.0f}}}",
                           f"\\newcommand{{\\cmp{tl}{name}NeedLo}}{{{min(by_lower, by_half):.0f}}}",
                           f"\\newcommand{{\\cmp{tl}{name}NeedHi}}{{{max(by_lower, by_half):.0f}}}"]
    head = ["Method", r"MAPE (\%)", "Mean $\\bar d$ (points)", r"95\% interval", "Wins", "$p_{\\mathrm{better}}$"]
    body = [r"\begin{tabular}{@{}l r r c r r@{}}", r"\toprule", " & ".join(head) + r" \\", r"\midrule"] + lines + [
        r"\bottomrule", r"\end{tabular}"]
    write("tab-comparison", "\n".join(body))
    write("numbers-comparison", "\n".join(macros))


def numbers_drift() -> None:
    """The drift response of survey 1 (case HP500-01, calibrated lane) from the canonical engine, as the App draws it: the
    target by the one rule of the App and the story (the case's P80 plus 10 percent), the opening at which P80 reaches it
    (css_at_p80_target, ceiling at the top of the class's training range), the secant over that opening, the local slope at
    the current setting (the central difference of p80PerMm, h = max(0.25, 0.01 CSS)), and the cause of the bend: the setting
    at which the escape size K1 = 0.23 CSS + 0.30 F80 of the calibrated classification crosses the mid-size of the next class
    (and K2 the next one), with the finite-difference slopes on either side."""
    from pipeline.model.crusher import evaluate
    from pipeline.model.crusher.campaign import css_at_p80_target
    from pipeline.model.crusher.classification import hp500_params
    from pipeline.model.crusher.types import Operating

    op = Operating(**_json(DER / "manifests" / "HP500-01.json")["params"])
    ceil = RANGES[op.machine]["css_mm"][1]
    r0 = evaluate(op)

    def p80(css: float) -> float:
        return evaluate(Operating(**{**op.__dict__, "css_mm": css})).p80

    target = 1.1 * r0.p80
    s_star = css_at_p80_target(op, target, ceil)
    opening = s_star - op.css_mm
    secant = (p80(s_star) - r0.p80) / opening
    h = max(0.25, 0.01 * op.css_mm)
    local = (p80(op.css_mm + h) - p80(op.css_mm - h)) / (2 * h)
    f80 = r0.f80
    mids = list(r0.feed.mid_mm)
    k0 = hp500_params(op.css_mm, f80)
    m1 = min(m for m in mids if m > k0.k1)          # the class mid-size K1 reaches first as the setting opens
    m2 = min(m for m in mids if m > k0.k2)          # and K2
    s1 = (m1 - 0.3 * f80) / 0.23
    s2 = (m2 - 12.0 - 0.4 * f80) / 0.55

    def fd(a: float, b: float) -> float:
        return (p80(b) - p80(a)) / (b - a)

    below, above = fd(s1 - 0.026, s1 - 0.006), fd(s1 + 0.006, s1 + 0.026)
    k2_below, k2_above = fd(s2 - 0.026, s2 - 0.006), fd(s2 + 0.006, s2 + 0.026)
    room = ceil - op.css_mm
    j = mids.index(m1)
    edge_hi, edge_lo = r0.feed.edges_mm[j], r0.feed.edges_mm[j + 1]   # the sieves that bound the class (coarse to fine)
    write("numbers-drift", "\n".join([
        f"\\newcommand{{\\drEdgeHi}}{{{edge_hi:.2f}}}", f"\\newcommand{{\\drEdgeLo}}{{{edge_lo:.2f}}}",
        f"\\newcommand{{\\drSoneGap}}{{{s1 - op.css_mm:.2f}}}",
        f"\\newcommand{{\\drCss}}{{{op.css_mm:.0f}}}", f"\\newcommand{{\\drPnow}}{{{r0.p80:.3f}}}",
        f"\\newcommand{{\\drFeighty}}{{{f80:.2f}}}", f"\\newcommand{{\\drTarget}}{{{target:.2f}}}",
        f"\\newcommand{{\\drTargetHead}}{{{target:.3g}}}", f"\\newcommand{{\\drSstar}}{{{s_star:.3f}}}",
        f"\\newcommand{{\\drOpen}}{{{opening:.3f}}}", f"\\newcommand{{\\drOpenHead}}{{{opening:.3g}}}",
        f"\\newcommand{{\\drCeil}}{{{ceil:.0f}}}", f"\\newcommand{{\\drRoom}}{{{room:.0f}}}",
        f"\\newcommand{{\\drShare}}{{{opening / room:.2f}}}", f"\\newcommand{{\\drRise}}{{{target - r0.p80:.3f}}}",
        f"\\newcommand{{\\drSecant}}{{{secant:.3f}}}", f"\\newcommand{{\\drLocal}}{{{local:.3f}}}",
        f"\\newcommand{{\\drH}}{{{h:.2f}}}", f"\\newcommand{{\\drRatio}}{{{local / secant:.2f}}}",
        f"\\newcommand{{\\drLinOpen}}{{{(target - r0.p80) / local:.2f}}}",
        f"\\newcommand{{\\drKoneNow}}{{{k0.k1:.3f}}}", f"\\newcommand{{\\drMidOne}}{{{m1:.3f}}}",
        f"\\newcommand{{\\drSone}}{{{s1:.3f}}}", f"\\newcommand{{\\drBelow}}{{{below:.3f}}}",
        f"\\newcommand{{\\drAbove}}{{{above:.3f}}}", f"\\newcommand{{\\drKtwoNow}}{{{k0.k2:.3f}}}",
        f"\\newcommand{{\\drMidTwo}}{{{m2:.3f}}}", f"\\newcommand{{\\drStwo}}{{{s2:.3f}}}",
        f"\\newcommand{{\\drKtwoBelow}}{{{k2_below:.4f}}}", f"\\newcommand{{\\drKtwoAbove}}{{{k2_above:.4f}}}",
    ]))


RESOURCE_ROWS = [("bake", r"Bake (\texttt{run.py all}: 27 cases, the four HP500 documents, index, readiness)", "workstation"),
                 ("hp500", r"HP500 step alone (\texttt{run.py hp500}: backbone, CrusherCal, the CrusherBayes sampler, the paired comparison)", "workstation"),
                 ("dem", r"Particle document (\texttt{run.py dem}: the document and its replay files rebuilt from the stored runs)", "workstation"),
                 ("models", r"Training (\texttt{run.py models}: sweeps, two networks, export, evaluation)", "workstation, CPU"),
                 ("tests", "Python tests, the whole suite", "workstation"),
                 ("install", r"Web install (\texttt{npm ci})", "workstation, CI"),
                 ("build", r"Web build (\texttt{npm run build})", "workstation, CI"),
                 ("webtests", "Web unit tests", "workstation, CI")]


def _bytes(b: int) -> str:
    return f"{b / 1e6:.1f} MB" if b >= 1e6 else f"{b / 1e3:.0f} KB"


def _secs(s: float) -> str:
    return f"{s / 60:.1f} min" if s >= 120 else f"{s:.1f} s"


def tab_resources() -> None:
    """The measured resources of every stage, from data/resources.json (written once by measure_resources.py)."""
    doc = _json(DATA / "resources.json")
    st = {s["label"]: s for s in doc["stages"]}
    rows = []
    for label, name, where in RESOURCE_ROWS:
        s = st[label]
        sizes = s.get("sizes", {})
        disk = next(iter(sizes.values()))["bytes"] if sizes else None
        notes = ([tex(s["note"])] if s.get("note") else []) + (
            [f"exit status {s['exit']}: the run had failing tests and is a time measurement only"] if s.get("exit") else [])
        rows.append([name + (f" ({'; '.join(notes)})" if notes else ""), f"{s['peak_mb']:.0f} MB",
                     _bytes(disk) if disk is not None else "none", _secs(s["seconds"]), where])
    write("tab-resources", tabular("@{}p{0.47\\textwidth} r r r l@{}", ["Stage", "Peak memory", "Disk", "Time", "Where it runs"],
                                   rows))
    e = doc["engine"]
    write("numbers-resources", "\n".join([
        f"\\newcommand{{\\resDate}}{{{doc['measured_on']}}}", f"\\newcommand{{\\resPython}}{{{doc['host']['python']}}}",
        f"\\newcommand{{\\resThreads}}{{{doc['host']['processor_threads']}}}",
        f"\\newcommand{{\\resEngineMed}}{{{e['median_of_medians_ms']:.2f}}}", f"\\newcommand{{\\resEngineMax}}{{{e['max_median_ms']:.2f}}}",
        f"\\newcommand{{\\resBakeMin}}{{{st['bake']['seconds'] / 60:.0f}}}", f"\\newcommand{{\\resHpMin}}{{{st['hp500']['seconds'] / 60:.0f}}}",
        f"\\newcommand{{\\resModelsS}}{{{st['models']['seconds']:.0f}}}",
        f"\\newcommand{{\\resSite}}{{{doc['site']['bytes'] / 1e6:.1f}}}",
        f"\\newcommand{{\\resWasm}}{{{doc['site']['wasm_bytes'] / 1e6:.1f}}}",
        f"\\newcommand{{\\resDrift}}{{{124 * e['median_of_medians_ms'] / 1000:.2f}}}",
    ]))


def numbers_fits() -> None:
    """Per-fold refits of the calibrated backbone that the documents do not store (the capacity base Q_T and the power
    form (zeta, P_n)), and the gap between the grid F80 and the measured f80 that the calibrated relations are fed."""
    import numpy as np
    from pipeline.hp500 import loo as L

    bb = _json(HP / "backbone.json")["surveys"]
    q = np.array([s["measured"]["feed_tph"] for s in bb], float)
    p = np.array([s["measured"]["power_kw"] for s in bb], float)
    shape = np.array([s["backbone"]["throughput_tph"] for s in bb], float) / 647.0
    pd_ = np.array([s["backbone"]["bond_power_kw"] for s in bb], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in bb], float)
    grid = np.array([s["backbone"]["f80_model_mm"] for s in bb], float)
    n = q.size
    qt = np.array([L.fit_capacity_base(shape, q, L.fold_indices(n, i, False)) for i in range(n)])
    pf = np.array([L.fit_power_form(pd_, p, L.fold_indices(n, i, False)) for i in range(n)])
    gap = f80 - grid
    k = int(np.argmax(np.abs(gap)))
    write("numbers-fits", "\n".join([
        f"\\newcommand{{\\qtFoldLo}}{{{qt.min():.1f}}}", f"\\newcommand{{\\qtFoldHi}}{{{qt.max():.1f}}}",
        f"\\newcommand{{\\qtAll}}{{{L.fit_capacity_base(shape, q, np.arange(n)):.1f}}}",
        f"\\newcommand{{\\zetaFoldLo}}{{{pf[:, 0].min():.2f}}}", f"\\newcommand{{\\zetaFoldHi}}{{{pf[:, 0].max():.2f}}}",
        f"\\newcommand{{\\pnFoldLo}}{{{pf[:, 1].min():.0f}}}", f"\\newcommand{{\\pnFoldHi}}{{{pf[:, 1].max():.0f}}}",
        f"\\newcommand{{\\gridGapSurvey}}{{{k + 1}}}", f"\\newcommand{{\\gridGapGrid}}{{{grid[k]:.2f}}}",
        f"\\newcommand{{\\gridGapMeas}}{{{f80[k]:.0f}}}", f"\\newcommand{{\\gridGap}}{{{gap[k]:.1f}}}",
        f"\\newcommand{{\\gridGapKone}}{{{0.30 * gap[k]:.1f}}}", f"\\newcommand{{\\gridGapKtwo}}{{{0.40 * gap[k]:.1f}}}",
        f"\\newcommand{{\\gridGapTten}}{{{0.23 * gap[k]:.1f}}}",
        f"\\newcommand{{\\gridGapCount}}{{{int(np.sum(np.abs(gap) > 0.5))}}}",
    ]))


def numbers_ranking() -> None:
    """The throughput backbone's figures by what was fitted where, and the two throughput predictors that the paired
    comparison does not rank. The engine at its shipped constants (``tph_parity``: the base-case capacity HP500_QREF of a
    Bruno simulation, nothing fitted to the surveys) and the capacity base fitted on all ten surveys (the leaky fold, the
    in-sample figure) are kept apart. The engine at its shipped constants and the published model of Rocha et al. are paired
    with CrusherBayes (CrusherBayes minus the predictor) on the resamples of ``hp500-comparison``, which are those of the
    CrusherBayes manuscript (its seed, its number of resamples, its quantiles)."""
    import heldout_uq as uq
    import numpy as np

    lo = _json(HP / "loo.json")
    cmp_ = _json(HP / "comparison.json")
    cb = _json(HP / "crusherbayes.json")
    bb = _json(HP / "backbone.json")["surveys"]
    ship = lo["tph_parity"]["backbone"]
    leaky = lo["loo"]["tph"]["leaky"]["M0_backbone"]
    strict = lo["loo"]["tph"]["strict"]
    per = lo["tph_parity"]["per_survey"]
    meas = np.array([r["measured"] for r in per], float)
    pred_ship = np.array([r["backbone"] for r in per], float)
    k = int(np.argmax(np.abs(pred_ship - meas) / meas))
    css = np.array([s["measured"]["css_mm"] for s in bb], float)
    f80 = np.array([s["measured"]["f80_mm"] for s in bb], float)
    assert np.array_equal(meas, np.array(lo["loo"]["tph"]["measured"], float))
    slope = float(np.polyfit(css, meas, 1)[0])
    boot = cmp_["bootstrap"]
    n = meas.size
    idx = np.random.default_rng(boot["seed"]).integers(0, n, size=(boot["resamples"], n))
    a_cb = uq.ape(meas, np.array(cb["loo"]["tph"]["pred_mean"], float))
    pairs = {}
    for name, pred in (("Ship", pred_ship), ("Rocha", uq.rocha_throughput(css, f80, meas)["published"])):
        d = a_cb - uq.ape(meas, pred)
        s = d[idx].mean(axis=1)
        q_lo, q_hi = np.percentile(s, boot["quantiles"])
        pairs[name] = (float(d.mean()), float(q_lo), float(q_hi))
    ranked = {m["id"] for m in cmp_["targets"]["tph"]["methods"] if not m["control"]}
    assert "crusherbayes" in ranked and cmp_["targets"]["tph"]["recommended"] == "crusherbayes"
    lines = [
        f"\\newcommand{{\\qtShip}}{{{HP500_QREF:.0f}}}",
        f"\\newcommand{{\\bbShipMape}}{{{ship['mape_pct']:.2f}}}",
        f"\\newcommand{{\\bbShipRsq}}{{{ship['r2']:.3f}}}",
        f"\\newcommand{{\\bbShipMaxdev}}{{{ship['maxdev_pct']:.2f}}}",
        f"\\newcommand{{\\bbShipMaxdevSurvey}}{{{per[k]['n']}}}",
        f"\\newcommand{{\\bbShipMaxdevMeas}}{{{meas[k]:.0f}}}",
        f"\\newcommand{{\\bbLeakyMape}}{{{leaky['mape_pct']:.2f}}}",
        f"\\newcommand{{\\bbLeakyGap}}{{{strict['M0_backbone']['mape_pct'] - leaky['mape_pct']:.2f}}}",
        f"\\newcommand{{\\bbNestedCovN}}{{{int(sum(strict['uq']['nested_covered']))}}}",
        f"\\newcommand{{\\bbBandPct}}{{{100 * strict['uq']['nominal_coverage']:.0f}}}",
        f"\\newcommand{{\\uqLevelPct}}{{{100 * uq.LEVEL:.0f}}}",
        f"\\newcommand{{\\lineSlopeQ}}{{{slope:.0f}}}",
        f"\\newcommand{{\\rankN}}{{{len(ranked)}}}",
    ]
    for name, (d, q_lo, q_hi) in pairs.items():
        lines += [f"\\newcommand{{\\rank{name}D}}{{{d:+.2f}}}", f"\\newcommand{{\\rank{name}Lo}}{{{q_lo:+.2f}}}",
                  f"\\newcommand{{\\rank{name}Hi}}{{{q_hi:+.2f}}}"]
    write("numbers-ranking", "\n".join(lines))


def tab_band() -> None:
    loo = _json(HP / "loo.json")["loo"]
    rows = []
    for i in range(10):
        row = [str(i + 1)]
        for t in ("tph", "kW"):
            meas = loo[t]["measured"][i]
            pred = loo[t]["strict"]["pred"]["M0"][i]
            uq = loo[t]["strict"]["uq"]
            row += [num(meas - pred, 1), num(uq["nested_sigma"][i], 1), num(1.2816 * uq["nested_sigma"][i], 1),
                    "yes" if uq["nested_covered"][i] else "no"]
        rows.append(row)
    groups = (r" & \multicolumn{4}{c}{Throughput (t/h)} & \multicolumn{4}{c}{Power (kW)} \\"
              r" \cmidrule(lr){2-5}\cmidrule(lr){6-9}")
    head = ["Survey", "Residual", "$\\sigma_{-i}$", "Half-width", "Inside", "Residual", "$\\sigma_{-i}$", "Half-width",
            "Inside"]
    write("tab-band", tabular("@{}r rrrl rrrl@{}", head, rows, groups))
    # the range of the nested half-width of the throughput band, in t/h and in percent of the mean measured throughput
    q = loo["tph"]
    half = [1.2816 * s for s in q["strict"]["uq"]["nested_sigma"]]
    mean_q = sum(q["measured"]) / len(q["measured"])
    write("numbers-band", "\n".join([
        f"\\newcommand{{\\bandQlo}}{{{min(half):.1f}}}", f"\\newcommand{{\\bandQhi}}{{{max(half):.1f}}}",
        f"\\newcommand{{\\bandQrelLo}}{{{100 * min(half) / mean_q:.1f}}}",
        f"\\newcommand{{\\bandQrelHi}}{{{100 * max(half) / mean_q:.1f}}}"]))


def tab_morrell() -> None:
    mf = _json(HP / "loo.json")["loo"]["kW"]["strict"]["morrell_fit"]
    rows = [[str(i + 1), num(mf["m_ic_kwh_t"][i], 3), num(mf["m_ic_noload_kwh_t"][i], 3), num(mf["no_load_kw"][i], 1),
             "yes" if mf["noload_variant_m_ic_positive"][i] else "no"] for i in range(10)]
    head = ["Held-out survey", "$M_{ic}$, origin (kWh/t)", "$M_{ic}$, no-load (kWh/t)", "$P_{noload}$ (kW)",
            "$M_{ic}>0$ (no-load)"]
    write("tab-morrell", tabular("@{}r rrrl@{}", head, rows))


# ------------------------------------------------------------------------------------------------------------------------
# CrusherBayes
# ------------------------------------------------------------------------------------------------------------------------
NAMES = {"q_ref_tph": r"$Q_T$, capacity base", "wi_kwh_t": r"$W_i$, blend work index", "zeta": r"$\zeta$, power slope",
         "pn_kw": r"$P_n$, no-load power", "k1_scale": r"$s_1$, multiplier of $K_1$", "k2_scale": r"$s_2$, multiplier of $K_2$",
         "k3": r"$K_3$, classification exponent", "t10_shift_pct": r"$\Delta t_{10}$, shift of the constant 64",
         "sigma_tph": r"$\sigma_Q$, throughput noise", "sigma_kW": r"$\sigma_P$, power noise",
         "discrepancy_tph_constant": r"$d_{Q0}$, throughput constant", "discrepancy_tph_css": r"$d_{Q1}$, throughput slope on CSS",
         "discrepancy_tph_f80": r"$d_{Q2}$, throughput slope on $f_{80}$",
         "discrepancy_kW_constant": r"$d_{P0}$, power constant", "discrepancy_kW_css": r"$d_{P1}$, power slope on CSS",
         "discrepancy_kW_f80": r"$d_{P2}$, power slope on $f_{80}$"}
UNIT = {"-": "--", "t10 percentage points": "points"}


def tab_priors() -> None:
    cb = _json(HP / "crusherbayes.json")
    rows = []
    for p in cb["priors"]:
        scale = "log" if p["log"] else "linear"
        lo, hi = p["lo"], p["hi"]
        rows.append([NAMES[p["name"]], tex(UNIT.get(p["unit"], p["unit"])), num(p["nominal"], 2), scale, num(p["sd"], 2),
                     f"$[{lo:.3f},\\ {hi:.3f}]$"])
    head = ["Scalar", "Unit", "Nominal", "Scale", "Prior sd", "Truncation (on the scale)"]
    write("tab-priors", tabular("@{}l l r l r l@{}", head, rows))


def tab_contraction() -> None:
    cb = _json(HP / "crusherbayes.json")
    rows = []
    for r in cb["contraction"]:
        rows.append([NAMES[r["name"]], tex(UNIT.get(r["unit"], r["unit"])), num(r["nominal"], 2), num(r["prior_sd"], 2),
                     num(r["posterior_mean"], 2), num(r["posterior_sd"], 2), num(r["contraction"], 3)])
    head = ["Parameter", "Unit", "Prior centre", "Prior sd", "Posterior mean", "Posterior sd", "Contraction"]
    write("tab-contraction", tabular("@{}l l rrrrr@{}", head, rows))


def tab_convergence() -> None:
    cb = _json(HP / "crusherbayes.json")
    rows = []
    for f in cb["convergence"]["folds"]:
        rows.append([tex(f["fold"]) if f["fold"] != "all" else "all ten", num(f["tau_max"], 1), str(f["post_burn_steps"]),
                     num(f["chain_over_tau"], 1), num(f["acceptance_fraction"], 3), str(f["samples"]),
                     "yes" if f["converged"] else "no"])
    head = ["Posterior (held-out survey)", r"$\hat\tau_{\max}$ (steps)", "Post-burn steps", r"Steps$/\hat\tau_{\max}$",
            "Acceptance", "Retained samples", "Converged"]
    write("tab-convergence", tabular("@{}l rrrrrl@{}", head, rows))


def tab_adoption() -> None:
    k = _json(HP / "crusherbayes.json")["kill_criterion"]
    rows = [
        ["Power MAPE against the setting-only line (points)", num(k["power_mape_pct"]), num(k["power_mape_blin_pct"]),
         num(k["power_gain_over_blin_pts"]), f"gain $\\geq {k['margin_mape_pts']:.0f}$", "yes" if k["a_power_beats_blin_by_margin"] else "no"],
        ["Throughput MAPE against the backbone (points)", num(k["tph_mape_pct"]), num(k["tph_mape_m0_pct"]),
         num(k["tph_gain_over_m0_pts"]), f"gain $\\geq {k['margin_mape_pts']:.0f}$", "yes" if k["a_tph_beats_m0_by_margin"] else "no"],
        ["Throughput coverage of the 80\\% interval", num(k["coverage"]["tph"]), DASH, DASH,
         f"${k['coverage_band'][0]:.1f}$ to ${k['coverage_band'][1]:.1f}$", "no" if k["coverage_outside_band"]["tph"] else "yes"],
        ["Power coverage of the 80\\% interval", num(k["coverage"]["kW"]), DASH, DASH,
         f"${k['coverage_band'][0]:.1f}$ to ${k['coverage_band'][1]:.1f}$", "no" if k["coverage_outside_band"]["kW"] else "yes"],
        ["Throughput mean width (t/h) against the backbone band", num(k["mean_width"]["tph"], 1),
         num(k["mean_width_crushercal"]["tph"], 1), num(k["mean_width_crushercal"]["tph"] - k["mean_width"]["tph"], 1),
         "not wider", "no" if k["band_wider_than_crushercal"]["tph"] else "yes"],
        ["Power mean width (kW) against the backbone band", num(k["mean_width"]["kW"], 1),
         num(k["mean_width_crushercal"]["kW"], 1), num(k["mean_width_crushercal"]["kW"] - k["mean_width"]["kW"], 1),
         "not wider", "no" if k["band_wider_than_crushercal"]["kW"] else "yes"],
    ]
    head = ["Term of the adoption rule", "CrusherBayes", "Reference", "Difference", "Condition", "Met"]
    write("tab-adoption", tabular("@{}l rrr l l@{}", head, rows))


# ------------------------------------------------------------------------------------------------------------------------
# the learned models
# ------------------------------------------------------------------------------------------------------------------------
OUTPUT_NAME = {"p80_mm": "$P_{80}$", "p50_mm": "$P_{50}$", "p20_mm": "$P_{20}$", "pass_1": "passing 1 mm",
               "pass_4": "passing 4 mm", "pass_8": "passing 8 mm", "pass_16": "passing 16 mm", "pass_32": "passing 32 mm",
               "throughput_tph": "throughput", "power_kw": "power"}


def tab_surrogate() -> None:
    po = _json(DER / "model-metrics.json")["surrogate"]["per_output"]
    rows = [[OUTPUT_NAME[k], num(v["r2"], 4), num(v["mape_pct"], 3), num(v["mape_pct_int8"], 3),
             num(v["mape_pct_int8"] - v["mape_pct"], 3)] for k, v in po.items()]
    head = ["Output", "$R^2$ (float32)", "MAPE float32 (\\%)", "MAPE int8 (\\%)", "Difference (points)"]
    write("tab-surrogate", tabular("@{}l rrrr@{}", head, rows))


def tab_anomaly() -> None:
    a = _json(DER / "model-metrics.json")["anomaly"]
    ae = _json(DER / "models" / "psd-ae.json")
    rows = [["False-alarm rate on the held-out draw", num(a["false_alarm_rate"], 4), num(a["envelope_false_alarm_rate"], 4)],
            ["Detection rate on planted off-manifold points", num(a["detection_rate"], 4), num(a["envelope_detection_rate"], 4)],
            ["Points scored (held-out, planted)", f"${a['n_heldout']}$, ${a['n_planted']}$", f"${a['n_heldout']}$, ${a['n_planted']}$"],
            ["Alarm threshold (99th percentile of training scores)", num(ae["threshold_p99"], 5), DASH],
            ["Mean training reconstruction score", num(ae["train_recon_mean"], 5), DASH]]
    write("tab-anomaly", tabular("@{}l rr@{}", ["Quantity", "Autoencoder", "Envelope check"], rows))


# ------------------------------------------------------------------------------------------------------------------------
# the data contracts
# ------------------------------------------------------------------------------------------------------------------------
def catalog_rows() -> list[dict]:
    lines = (ROOT / "docs" / "contracts" / "catalog.md").read_text(encoding="utf-8").splitlines()
    head, out = None, []
    for line in lines:
        if not line.lstrip().startswith("|"):
            if head and out:
                break
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells[:2] == ["id", "version"]:
            head = cells
            continue
        if head and not set(cells[0]) <= set("-: "):
            out.append(dict(zip(head, cells)))
    return out


def tab_contracts() -> None:
    rows = []
    for r in catalog_rows():
        owner = r["owner"].replace("data-pipeline/pipeline/", "pipeline/")
        schema = Path(r["schema file"]).name
        rows.append([r"\texttt{" + tex(r["id"]) + "}", tex(r["version"]), r"\texttt{" + tex(owner) + "}",
                     r"\texttt{" + tex(schema) + "}", tex(r["status"])])
    head = ["Contract", "Version", "Producer (owner)", "Schema file", "Status"]
    write("tab-contracts", tabular("@{}l l p{0.29\\textwidth} p{0.30\\textwidth} l@{}", head, rows))
    # the version of every contract as the catalog states it, so the text never types one: \cver{<id>}
    macros = [r"\expandafter\def\csname cv@" + r["id"] + r"\endcsname{" + r["version"] + "}" for r in catalog_rows()]
    macros.append(r"\newcommand{\cver}[1]{\ifcsname cv@#1\endcsname\csname cv@#1\endcsname\else"
                  r"\errmessage{no contract #1 in the catalog}\fi}")
    # the counts the text states in words: contracts in the catalog, readiness rows and the rows available in the build
    words = {10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen"}
    ready = _json(DER / "readiness.json")["contracts"]
    avail = sum(1 for c in ready if c["state"] == "available")
    macros += [f"\\newcommand{{\\ncontracts}}{{{words[len(catalog_rows())]}}}",
               f"\\newcommand{{\\nreadyrows}}{{{words[len(ready)]}}}",
               f"\\newcommand{{\\nreadyavail}}{{{words[avail]}}}"]
    write("numbers-contracts", "\n".join(macros))


def _def_of(v: dict, defs: dict) -> dict | None:
    """The definition a local ``$ref`` names, or None."""
    return defs.get(v["$ref"].split("/")[-1]) if "$ref" in v else None


def _alternatives(v: dict) -> list[dict]:
    """The alternatives of a ``oneOf`` or ``anyOf``, the null one last."""
    alts = [a for a in (v.get("oneOf") or v.get("anyOf") or []) if isinstance(a, dict)]
    return sorted(alts, key=lambda a: a.get("type") == "null")


def _type_of(v: dict, defs: dict) -> str:
    d = _def_of(v, defs)
    if d is not None:
        return _type_of(d, defs)
    if "$ref" in v:
        return v["$ref"].split("/")[-1]
    alts = _alternatives(v)
    if alts:
        return " or ".join(dict.fromkeys(_type_of(a, defs) for a in alts))
    for m in v.get("allOf", []):
        if isinstance(m, dict) and ("$ref" in m or "type" in m):
            return _type_of(m, defs)
    if "const" in v:
        return "const"
    if "enum" in v:
        return "enum"
    t = v.get("type", "any")
    if isinstance(t, list):
        t = " or ".join(t)
    if t == "array" and isinstance(v.get("items"), dict):
        return f"array of {_type_of(v['items'], defs)}"
    if t == "array" and isinstance(v.get("prefixItems"), list) and v["prefixItems"]:
        inner = " or ".join(dict.fromkeys(_type_of(p, defs) for p in v["prefixItems"]))
        return f"array of {inner}"
    return t


def _range_of(v: dict, defs: dict) -> str:
    d = _def_of(v, defs)
    if d is not None:
        return _range_of(d, defs)
    alts = _alternatives(v)
    if alts:
        return " or ".join(r for r in (_range_of(a, defs) for a in alts) if r)
    parts = []
    if "const" in v:
        parts.append(chr(0) + str(v["const"]) + chr(1))
    if "enum" in v:
        parts.append(", ".join("null" if e is None else str(e) for e in v["enum"]))
    for key, sym in (("minimum", ">="), ("exclusiveMinimum", ">"), ("maximum", "<="), ("exclusiveMaximum", "<")):
        if key in v:
            parts.append(f"{sym} {v[key]}")
    if "minItems" in v or "maxItems" in v:
        lo, hi = v.get("minItems"), v.get("maxItems")
        if hi is None and v.get("items") is False and isinstance(v.get("prefixItems"), list):
            hi = len(v["prefixItems"])   # no item past the prefix: the prefix length is the maximum
        if lo is not None and hi is not None and lo == hi:
            parts.append(f"exactly {lo} items")
        elif hi is None:
            parts.append(f"at least {lo} items")
        elif lo is None:
            parts.append(f"at most {hi} items")
        else:
            parts.append(f"{lo} to {hi} items")
    if "pattern" in v:
        parts.append("pattern " + chr(0) + v["pattern"] + chr(1))
    items = v.get("items")
    if isinstance(items, dict) and not parts:
        sub = _range_of(items, defs)
        if sub:
            parts.append("items " + sub)
    return "; ".join(parts)


def breakable(text: str) -> str:
    """A break point between the characters of a pattern marked by chr(0) and chr(1) (a regular expression has no spaces)."""
    def split(m: re.Match) -> str:
        toks = re.findall(r"\\[a-zA-Z]+\{\}|\\.|.", m.group(1))
        return r"\allowbreak{}".join(toks)
    return re.sub(chr(0) + "(.*?)" + chr(1), split, text)


def _record(v: dict, defs: dict, chain: tuple[str, ...]) -> tuple[dict, set, str, tuple[str, ...]] | None:
    """The fields of a record schema ``v``, their required set and the separator of the path to them: ``.`` for an object
    with properties, ``[].`` for an array whose items are one, ``.<key>.`` for a map (additionalProperties or
    patternProperties) whose values are one. A ``$ref``, the ``allOf`` members that name fields and a single non-null
    ``oneOf``/``anyOf`` alternative are followed; None for a leaf. ``chain`` holds the definitions already entered, so a
    recursive schema stops."""
    if "$ref" in v:
        name = v["$ref"].split("/")[-1]
        d = defs.get(name)
        if d is None or name in chain:
            return None
        return _record(d, defs, chain + (name,))
    alts = [a for a in _alternatives(v) if a.get("type") != "null"]
    if len(alts) == 1:
        return _record(alts[0], defs, chain)
    if len(alts) > 1:   # several record alternatives: the union of their fields, required where every alternative requires
        subs = [_record(a, defs, chain) for a in alts]
        if all(sub is not None and sub[2] == "." for sub in subs):
            merged: dict = {}
            for sub in subs:
                for k, f in sub[0].items():
                    if k not in merged:
                        merged[k] = f
                    elif f != merged[k]:   # a field in several alternatives with different schemas: one of them
                        prev = merged[k]["oneOf"] if "oneOf" in merged[k] and "type" not in merged[k] else [merged[k]]
                        desc = next((g["description"] for g in [*prev, f] if g.get("description")), None)
                        merged[k] = {"oneOf": [*prev, f], **({"description": desc} if desc else {})}
            return merged, set.intersection(*(sub[1] for sub in subs)), ".", chain
    props: dict = dict(v.get("properties") or {})
    req = set(v.get("required", []))
    entered = chain
    for m in v.get("allOf", []):
        if isinstance(m, dict) and ("$ref" in m or "properties" in m) and "if" not in m:
            sub = _record(m, defs, chain)
            if sub is not None and sub[2] == ".":
                props = {**sub[0], **props}
                req |= sub[1]
                entered = sub[3] if not v.get("properties") else entered   # a bare allOf of one definition is that definition
    if props:
        return props, req, ".", entered
    if v.get("type") == "array" and isinstance(v.get("items"), dict):
        sub = _record(v["items"], defs, chain)
        if sub is not None and sub[2] == ".":
            return sub[0], sub[1], "[].", sub[3]
    maps = [v["additionalProperties"]] if isinstance(v.get("additionalProperties"), dict) else []
    maps += [p for p in (v.get("patternProperties") or {}).values() if isinstance(p, dict)]
    for mv in maps:
        sub = _record(mv, defs, chain)
        if sub is not None and sub[2] == ".":
            return sub[0], sub[1], ".<key>.", sub[3]
    return None


UNIT_BRACKET = re.compile(r"\s*\[([^\[\]]+)\]\.?\s*$")


def _meaning(v: dict, defs: dict) -> tuple[str, str]:
    """The field's description (its own, else the one of the definition it names) and its unit: the bracket that ends the
    description (``... [t/h].``), the schemas' notation for the unit of a field."""
    desc = v.get("description")
    if not desc:
        d = _def_of(v, defs)
        desc = d.get("description") if d else None
    desc = re.sub(r"\s+", " ", (desc or "").strip())
    m = UNIT_BRACKET.search(desc)
    unit = ""
    if m:
        unit, desc = m.group(1).strip(), desc[:m.start()].rstrip()
        desc = desc if not desc or desc.endswith((".", ":", ")")) else desc + "."
    desc = desc.replace("verdict", "decision")   # the report's vocabulary; the field names stay verbatim
    return desc, unit


def schema_longtable(cid: str, version: str, schema_path: Path) -> None:
    """The appendix table of one contract: every field down to its leaves (through ``$ref``, ``$defs``, ``allOf``, ``items``
    and maps), with its type, range, requirement, unit and meaning as the schema states them."""
    s = _json(schema_path)
    defs = s.get("$defs", {})
    rows = []
    first: dict[str, str] = {}

    def field(path: str) -> str:
        """A dotted path in typewriter type that may break after a dot or an underscore (a long path fits its column)."""
        return r"\texttt{" + tex(path).replace(".", r".\allowbreak{}").replace(r"\_", r"\_\allowbreak{}") + "}"

    def walk(props: dict, prefix: str, required: set, chain: tuple[str, ...]) -> None:
        for k, v in props.items():
            if not isinstance(v, dict):
                continue
            name = prefix + k
            rng = _range_of(v, defs)
            desc, unit = _meaning(v, defs)
            sub = _record(v, defs, chain)
            # a definition's fields are listed once, under the first path that reaches it; a later path refers to it
            entered = sub[3][-1] if sub is not None and sub[3] != chain else None
            meaning = tex(desc) if desc else ""
            if entered in first:
                meaning = (meaning + " " if meaning else "") + "Its fields are those of " + field(first[entered]) + "."
            rows.append([field(name), tex(_type_of(v, defs)), breakable(tex(rng)) if rng else DASH,
                         "yes" if k in required else "no", tex(unit.replace("dimensionless", "--").replace("percentage points", "points")) if unit else DASH, meaning or DASH])
            if sub is not None and entered not in first:
                fields, req, sep, sub_chain = sub
                if entered is not None:
                    first[entered] = name
                walk(fields, name + sep, req, sub_chain)

    walk(s.get("properties", {}), "", set(s.get("required", [])), ())
    caption = (r"Fields of the \texttt{" + tex(cid) + "} contract, version $" + tex(version) + "$"
               + r", generated from its schema file \texttt{" + tex(schema_path.name) + "}: the dotted path of each field "
               r"down to its leaves (\texttt{[]} an element of a list, \texttt{<key>} any key of a map; a structure met "
               "again is listed once, where it first appears), its type, its range or allowed values as the schema states "
               "them, whether it is required at its level, its unit and its meaning.")
    head = r"Field & Type & Range or values & Req. & Unit & Meaning \\"
    lines = [r"\begingroup\scriptsize",
             r"\begin{longtable}{@{}p{0.20\textwidth} p{0.09\textwidth} p{0.16\textwidth} p{0.04\textwidth} "
             r"p{0.07\textwidth} p{0.30\textwidth}@{}}",
             r"\caption{" + caption + r"}\label{tab:schema-" + cid + r"}\\",
             r"\toprule", head, r"\midrule", r"\endfirsthead",
             r"\multicolumn{6}{@{}l}{\footnotesize Table~\thetable{} (continued)}\\", r"\toprule", head, r"\midrule",
             r"\endhead", r"\bottomrule", r"\endfoot"]
    # a schema field is quoted verbatim, so its key may be a word the checks refuse in prose: a field named verdict (the voice
    # check) and a key that is a method's ladder id (M1_residual, pred.M2: the internal-names check). The marker names it on
    # that line only, and only in the Field column: the Meaning column names every method by its name.
    def marker(r: list[str]) -> str:
        notes = [n for n, hit in (("voice-ok", "verdict" in r[0]), ("internal-name-ok", re.search(r"(?<![A-Za-z0-9])M\d", r[0])))
                 if hit]
        return (" % " + " ".join(notes) + ": schema field name") if notes else ""

    lines += [" & ".join(r) + r" \\" + marker(r) for r in rows]
    lines += [r"\end{longtable}", r"\endgroup"]
    write(f"schema-{cid}", "\n".join(lines))


def schemas() -> None:
    for r in catalog_rows():
        path = ROOT / r["schema file"]
        if path.name.endswith(".schema.json"):
            schema_longtable(r["id"], r["version"], path)
    api = _json(ROOT / "docs" / "contracts" / "api.openapi.json")
    rows = []
    for p, ops in api["paths"].items():
        for verb, op in ops.items():
            summ = re.sub(r"\s+", " ", (op.get("summary") or op.get("description") or "").strip())
            if len(summ) > 120:
                summ = summ[:117].rsplit(" ", 1)[0] + " ..."
            rows.append([r"\texttt{" + tex(verb.upper() + " " + p) + "}", tex(", ".join(op.get("responses", {}).keys())),
                         tex(summ) if summ else DASH])
    version = next(r["version"] for r in catalog_rows() if r["id"] == "api")
    caption = (r"Routes of the \texttt{api} contract, version $" + tex(version) + r"$, generated from the OpenAPI document "
               r"\texttt{api.openapi.json}: each route with its method, the response codes it declares and its summary.")
    head = r"Route & Responses & Meaning \\"
    lines = [r"\begingroup\scriptsize",
             r"\begin{longtable}{@{}p{0.32\textwidth} p{0.12\textwidth} p{0.48\textwidth}@{}}",
             r"\caption{" + caption + r"}\label{tab:schema-api}\\", r"\toprule", head, r"\midrule", r"\endfirsthead",
             r"\multicolumn{3}{@{}l}{\footnotesize Table~\thetable{} (continued)}\\", r"\toprule", head, r"\midrule",
             r"\endhead", r"\bottomrule", r"\endfoot"]
    lines += [" & ".join(r) + r" \\" for r in rows]
    lines += [r"\end{longtable}", r"\endgroup"]
    write("schema-api", "\n".join(lines))


# ------------------------------------------------------------------------------------------------------------------------
# provenance
# ------------------------------------------------------------------------------------------------------------------------
HASHED = ["data/examples/hp500-surveys.csv", "data/examples/params.csv", "data/derived/hp500/backbone.json",
          "data/derived/hp500/loo.json", "data/derived/hp500/crusherbayes.json", "data/derived/hp500/comparison.json",
          "data/derived/model-metrics.json",
          "data/derived/models/surrogate.onnx", "data/derived/models/psd-ae.onnx", "data/derived/manifests/index.json",
          "data-pipeline/pipeline/model/crusher/labjaw.py", "docs/contracts/schemas/dem-run.schema.json",
          "data/derived/dem/jaw-lab.json"]


def hashes() -> None:
    rows, lines = [], []
    for rel in HASHED:
        h = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
        lines.append(f"{h}  {rel}")
        rows.append([r"\texttt{" + tex(rel) + "}", r"\texttt{" + h[:16] + r"\ldots}"])
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "sha256.txt").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    write("tab-hashes", tabular("@{}l l@{}", ["Artifact", "SHA-256 (first 16 hex digits)"], rows))


def parity_numbers() -> None:
    """The size of the shared engine reference and the largest relative difference of the Python engine against it,
    recomputed with the comparison of ``tests/test_crusher_engine.py`` (needs pytest importable, as in the pipeline venv)."""
    sys.path.insert(0, str(ROOT / "tests"))
    import test_crusher_engine as t  # noqa: E402

    ref = _json(ROOT / "tests" / "fixtures" / "engine-reference.json")
    worst = 0.0
    for p in ref["points"]:
        got = t.python_point(p, ref["scaler"])
        worst = max(worst, t._worst_rel({"result": p["result"], "features": p["features"]}, got))
    mant, exp = f"{worst:.1e}".split("e")
    # the setting-only line in closed form: leverages h_ii of the survey settings and the leave-one-out residuals e_i / (1 - h_ii)
    import numpy as np

    with (ROOT / "data" / "examples" / "hp500-surveys.csv").open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    s = np.array([float(r["css_mm"]) for r in rows])
    lev = 1.0 / s.size + (s - s.mean()) ** 2 / np.sum((s - s.mean()) ** 2)
    A = np.column_stack([np.ones(s.size), s])
    out = {}
    for key, col in (("P", "power_kw"), ("Q", "feed_tph")):
        y = np.array([float(r[col]) for r in rows])
        coef = np.linalg.lstsq(A, y, rcond=None)[0]
        e = y - A @ coef
        out[key] = (100 * np.mean(np.abs(e / y)), 100 * np.mean(np.abs(e / (1 - lev) / y)))
    write("numbers", "\n".join([
        f"\\newcommand{{\\nrefpoints}}{{{len(ref['points'])}}}",
        f"\\newcommand{{\\refworst}}{{{mant}\\times10^{{{int(exp)}}}}}",
        f"\\newcommand{{\\levmin}}{{{lev.min():.3f}}}",
        f"\\newcommand{{\\levmax}}{{{lev.max():.3f}}}",
        f"\\newcommand{{\\lineinP}}{{{out['P'][0]:.2f}}}",
        f"\\newcommand{{\\linelooP}}{{{out['P'][1]:.2f}}}",
        f"\\newcommand{{\\lineinQ}}{{{out['Q'][0]:.2f}}}",
        f"\\newcommand{{\\linelooQ}}{{{out['Q'][1]:.2f}}}",
    ]))



# ---------------------------------------------------------------------------------------------------------------------
# the laboratory jaw: the capacity model of Sastri (1994), the discrete element case and the measurements it is held to
# ---------------------------------------------------------------------------------------------------------------------
def _literal_assignments(path: Path, names: set[str]) -> dict:
    """The literal values assigned to ``names`` at module level of a Python file, read without importing it (so the printed
    Table 2 of Sastri 1994 stays in ONE place, tests/test_labjaw.py, and the report reads it from there)."""
    import ast

    out: dict = {}
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id in names:
                out[target.id] = ast.literal_eval(node.value)
            elif isinstance(target, ast.Tuple) and all(isinstance(e, ast.Name) for e in target.elts):
                keys = [e.id for e in target.elts]
                if names.issuperset(keys):
                    out.update(dict(zip(keys, ast.literal_eval(node.value))))
    missing = names - out.keys()
    if missing:
        raise KeyError(f"{path.name} no longer assigns {sorted(missing)} as literals")
    return out


def tab_sastri_table2() -> None:
    """The nine rows of Table 2 of Sastri (1994) (Hersam's laboratory jaw), recomputed by the product's laboratory-jaw module
    against the printed column, and the numbers of the laboratory jaw of Barrios et al. that the text quotes."""
    from pipeline.model.crusher import labjaw as lj

    held = _literal_assignments(ROOT / "tests" / "test_labjaw.py",
                                {"TABLE_2", "HERSAM_W_M", "HERSAM_D_M", "HERSAM_N_RPM", "HERSAM_S_M"})
    rows, rels, worst, worst_row = [], [], 0.0, 0
    for i, (t_m, t_over_g, fav_over_g, k1_printed, printed, density) in enumerate(held["TABLE_2"], 1):
        gape = t_m / t_over_g
        vh = lj.volumetric_capacity_m3_h(held["HERSAM_N_RPM"], held["HERSAM_W_M"], held["HERSAM_S_M"], t_m, gape, held["HERSAM_D_M"])
        k1 = lj.feed_factor(fav_over_g * gape, gape)
        got = vh * k1 * 1.0 * density
        rel = 100.0 * (got - printed) / printed
        rels.append(rel)
        if abs(rel) > abs(worst):
            worst, worst_row = rel, i
        rows.append([str(i), num(1e3 * t_m, 2), num(t_over_g, 4), num(fav_over_g, 3), num(k1_printed, 3), num(k1, 3),
                     num(density, 2), num(printed, 3), num(got, 3), num(rel, 2)])
    head = ["Row", "$T$ (mm)", "$T/G$", r"$\bar F/G$", r"$k_{\mathrm F}$ printed", r"$k_{\mathrm F}$ computed",
            r"$\rho_s$ (t/m$^3$)", r"$Q_{\mathrm S}$ printed (t/h)", r"$Q_{\mathrm S}$ computed (t/h)", "Difference (\\%)"]
    write("tab-sastri-table2", tabular("@{}r r r r r r r r r r@{}", head, rows))
    jaw = lj.OTSUKA_BARRIOS_2020
    g, s_m, t_m = jaw.gape_mm / 1e3, 7.5e-3, jaw.throw_mm / 1e3
    depth = lj.depth_between_jaws_m(g)
    nc = lj.critical_speed_rpm(g, s_m, t_m, depth)
    n_rows = len(held["TABLE_2"])
    within = sum(1 for r in rels if abs(r) <= 0.2)
    write("numbers-labjaw", "\n".join([
        f"\\newcommand{{\\labjawDepth}}{{{depth:.4f}}}",
        f"\\newcommand{{\\labjawCrit}}{{{nc:.0f}}}",
        f"\\newcommand{{\\labjawKT}}{{{lj.throw_factor(t_m, g):.3f}}}",
        f"\\newcommand{{\\sastriRows}}{{{n_rows}}}",
        f"\\newcommand{{\\sastriWithin}}{{{within}}}",
        f"\\newcommand{{\\sastriWorstRow}}{{{worst_row}}}",
        f"\\newcommand{{\\sastriWorstPct}}{{{abs(worst):.1f}}}",
        f"\\newcommand{{\\sastriHersamN}}{{{held['HERSAM_N_RPM']:.0f}}}",
        f"\\newcommand{{\\sastriMatch}}{{{100 * (lj.CRITICAL_SPEED_COEF ** 2 / (lj.HIGH_SPEED_COEF * lj.G_M_S2) - 1):.2f}}}",
    ]))


def _crushdem():
    try:
        import crushdem  # noqa: F401
        from crushdem.cases import barrios2020 as case
        from crushdem.machines import barrios_contact_table, jaw_barrios2020
    except ImportError as exc:  # the committed fragments stay as they are
        print(f"crushdem is not importable ({exc}): tab-dem-parameters and tab-lab-measured are not regenerated")
        return None
    return case, barrios_contact_table, jaw_barrios2020


def tab_dem_parameters() -> None:
    """Every parameter of the discrete element model of the laboratory jaw with its value as the installed package holds it, its
    unit and where it comes from: the paper's tables, the package's derivation of the ore from the paper's single-particle
    tests, or an assumption."""
    got = _crushdem()
    if got is None:
        return
    case, contact_table, jaw = got
    import crushdem

    m = jaw()
    prov = {n: v for n, v, _ in m.provenance}
    ore, der = case.paper_ore("A", seed=1)
    ct = contact_table()
    ore_m, steel_m = ct.materials
    shear = lambda mat: mat.youngs_modulus / (2.0 * (1.0 + mat.poisson))  # noqa: E731
    paper, derived, assumed = "paper", "derived from the paper", "assumption"
    def g(x: float) -> str:
        mant, _, exp = f"{x:.3e}".partition("e")
        return f"${float(mant):g}\\times10^{{{int(exp)}}}$"

    rows = [
        ["Machine", "", "", "", ""],
        ["Feed opening, width and gap", r"$w$, $G$", f"{1e3 * prov['width_m']:g} and {1e3 * prov['top_gap_m']:g}", "mm", paper + ", Table 2"],
        ["Closed-side setting", r"$S$", f"{1e3 * prov['closed_side_setting_m']:g}", "mm", paper + ", Table 2"],
        ["Swing jaw throw (read as the opening of the bottom edge)", r"$T$", f"{1e3 * prov['throw_m']:g}", "mm", paper + " (reading: " + assumed + ")"],
        ["Stroke frequency", r"$f$", f"{prov['frequency_hz']:g}", "Hz", paper + ", Table 2"],
        ["Nip angle between the plates", r"$\psi_{\mathrm n}$", f"{prov['nip_angle_deg']:g}", "deg", assumed],
        ["Plate height and length", r"$H_{\mathrm p}$, $L_{\mathrm p}$", f"{1e3 * prov['plate_height_m']:.1f} and {1e3 * prov['plate_length_m']:.1f}", "mm", "derived from the gaps and the nip angle"],
        ["Peak swing angle", r"$\theta_{\max}$", f"{prov['swing_angle_max_rad']:.5f}", "rad", "derived: the bottom edge opens by the throw"],
        ["Swing law", "", "harmonic rocking about the top pivot", "", assumed],
        ["Contacts", "", "", "", ""],
        ["Ore density, shear modulus, Poisson ratio", r"$\rho$, $G_{\mathrm{sh}}$, $\nu_{\mathrm P}$", f"{ore_m.density:g}, {g(shear(ore_m))}, {ore_m.poisson:g}", "kg/m$^3$, Pa, --", paper + ", Table 3"],
        ["Steel density, shear modulus, Poisson ratio", r"$\rho$, $G_{\mathrm{sh}}$, $\nu_{\mathrm P}$", f"{steel_m.density:g}, {g(shear(steel_m))}, {steel_m.poisson:g}", "kg/m$^3$, Pa, --", paper + ", Table 3"],
        ["Restitution, friction, rolling friction of ore on ore", r"$e_{\mathrm r}$, $\mu_{\mathrm c}$, $\mu_{\mathrm r}$", f"{ct.restitution[0][0]:g}, {ct.mu[0][0]:g}, {ct.mu_r[0][0]:g}", "--", paper + ", Table 4"],
        ["Restitution, friction, rolling friction of steel on ore", r"$e_{\mathrm r}$, $\mu_{\mathrm c}$, $\mu_{\mathrm r}$", f"{ct.restitution[0][1]:g}, {ct.mu[0][1]:g}, {ct.mu_r[0][1]:g}", "--", paper + ", Table 4"],
        ["Tangential damping ratio", r"$x_{\gamma,t}$", f"{ct.xt[0][0]:g}", "--", "package default"],
        ["Ore (breakage), derived in the package from the single-particle tests of Fig.~6b", "", "", "", ""],
        ["Fracture energy at large size", r"$E_\infty$", f"{ore.e_inf:.2f}", "J/kg", derived + ", fit to the two coarse classes"],
        ["Size scale of the size effect", r"$d_0$", f"{1e3 * ore.d0:.1f}", "mm", derived + ", same fit"],
        ["Size exponent", r"$\phi_E$", f"{ore.phi:g}", "--", assumed + ": the gneiss value of Tavares (2022), fixed"],
        ["Variance of the logarithm of the fracture energy", r"$\sigma_E^2$", f"{ore.variance:g}", "--",
         f"{derived}: the data give {der['variance_from_data']:.2f}, limited to the upper end of the range of Tavares (2022)"],
        ["Damage coefficient", r"$\gamma_D$", f"{ore.gamma:g}", "--", assumed + ": Tavares (2022), mean of 3 to 4"],
        ["Maximum $t_{10}$ of one event and exponent", r"$A$, $b'$", f"{ore.a_max:g}, {ore.b_prime:g}", "\\%, --", assumed + ": the gneiss row of Tavares (2022), Table 4"],
        ["Upper truncation of the fracture energy", r"$E_{\max}/E_{50}$", r"$\infty$", "--", assumed + ": the plain lognormal"],
        ["Smallest sphere kept", r"$d_{\min}$", f"{1e3 * ore.min_diameter:g}", "mm", assumed],
        ["Run control", "", "", "", ""],
        ["Time step as a fraction of the Rayleigh time of the smallest sphere", "", "0.1", "--", "package default of the case"],
        ["Steps between services of the feed, the discharge and the breakage", "", "50", "steps", "package default"],
        ["Overlap limits tried in turn", "", " and ".join(f"{x:g}" for x in case.OVERLAP_LADDER), "of the smaller radius", "package default of the case"],
        ["Strokes without progress that stop a run as stalled", "", "40", "strokes", "package default of the case command"],
        ["Largest number of strokes", "", "400", "strokes", "package default of the case command"],
    ]
    caption = (r"Parameters of the discrete element model of the laboratory jaw as the installed package \texttt{crushdem} holds them: the machine and "
               "the contacts from the paper's tables, the ore derived in the package from the paper's single-particle tests (pass A of the two "
               "digitisation passes), and the run control, each with its unit and its origin: the paper, a derivation from the paper, an "
               "assumption or a package default. Generated from the installed package.")
    head = r"Parameter & Symbol & Value & Unit & Origin \\"
    lines = [r"\begingroup\scriptsize",
             r"\begin{longtable}{@{}p{0.28\textwidth} p{0.09\textwidth} p{0.13\textwidth} p{0.10\textwidth} p{0.26\textwidth}@{}}",
             r"\caption{" + caption + r"}\label{tab:dem-params}\\", r"\toprule", head, r"\midrule", r"\endfirsthead",
             r"\multicolumn{5}{@{}l}{\footnotesize Table~\thetable{} (continued)}\\", r"\toprule", head, r"\midrule", r"\endhead",
             r"\bottomrule", r"\endfoot"]
    for r in rows:
        if not r[1] and not r[2] and not r[3]:
            lines.append(r"\multicolumn{5}{@{}l}{\emph{" + r[0] + r"}} \\")
        else:
            lines.append(" & ".join(r) + r" \\")
    lines += [r"\end{longtable}", r"\endgroup"]
    write("tab-dem-parameters", "\n".join(lines))
    stiff = case.contact_check_fig6a(case.load_digitised())["stiffness_ratio"]
    write("numbers-dem", "\n".join([
        f"\\newcommand{{\\demPackageVersion}}{{{'.'.join(str(int(x)) for x in crushdem.__version__.split('.'))}}}",
        f"\\newcommand{{\\demStiffRatio}}{{{stiff:.1f}}}",
        f"\\newcommand{{\\demSigmaData}}{{{der['variance_from_data']:.2f}}}",
        f"\\newcommand{{\\demPhiFree}}{{{der['free_three_class_fit']['phi']:.2f}}}",
    ]))


def tab_lab_measured() -> None:
    """What the laboratory tests measured at the three feed classes, as the package digitised it from the figures of the paper
    (two passes: the mean is the value, their difference the digitisation noise)."""
    got = _crushdem()
    if got is None:
        return
    case = got[0]
    rows = []
    for fc in ("63/52", "31.5/26.5", "16/13.2"):
        m = case.measured(fc)
        rows.append([tex(fc), f"{num(m.throughput_kg_h, 1)} $\\pm$ {num(m.throughput_noise_kg_h, 1)}",
                     num(m.net_power_kw, 4) if fc == "63/52" else f"{num(m.net_power_kw, 4)} $\\pm$ {num(m.net_power_noise_kw, 4)}",
                     f"{num(m.product['noise_pct_max'], 2)} and {num(m.product['noise_pct_rms'], 2)}"])
    write("tab-lab-measured", tabular("@{}l r r r@{}", ["Feed class (mm)", "Throughput (kg/h)", "Net power (kW)",
                                                        "Product, largest and rms pass difference (points)"], rows))
    dig = case.load_digitised()
    noise = dig["fig6b_noise"]
    write("numbers-lab", "\n".join([
        f"\\newcommand{{\\labFsixNoiseMax}}{{{100 * max(v['max_abs_ln_force'] for v in noise.values()):.1f}}}",
        f"\\newcommand{{\\labFsixN}}{{{noise['63/53']['n_pairs']}}}",
        "\\newcommand{\\labQcross}{%.0f}" % (0.5 * sum(dig["throughput_kg_h"]["cross_check_fig13a_time_mean_1_to_24_5_s"][k] for k in ("A", "B"))),
    ]))



# ---------------------------------------------------------------------------------------------------------------------
# the committed document of the laboratory jaw (contract dem-run): data/derived/dem/jaw-lab.json
# ---------------------------------------------------------------------------------------------------------------------
DEM_DOC = DER / "dem" / "jaw-lab.json"
POINT_WORD = {"63-52": "Coarse", "31.5-26.5": "Mid", "16-13.2": "Fine"}
PAIR_NAME = {"simulation_vs_measured": "particle simulation against measurement",
             "population_balance_vs_measured": "population balance against measurement",
             "population_balance_vs_simulation": "population balance against particle simulation"}
SIDE_SHORT = {"simulation_vs_measured": "sim/meas", "population_balance_vs_measured": "pb/meas", "population_balance_vs_simulation": "pb/sim"}
QUANTITY_NAME = {"throughput": ("throughput", "kg/h", 1), "net_power": ("net power", "kW", 3), "reduction_ratio": ("reduction ratio", "--", 2)}


def _dem() -> dict:
    """The committed document with each measured value that carries its source reduced to the value (its digitisation noise kept
    beside it as ``<name>_noise``)."""
    d = _json(DEM_DOC)
    for p in d["points"]:
        m = p["measured"]
        for k in list(m):
            if isinstance(m[k], dict) and "digitisation_noise" in m[k]:
                m[k + "_noise"] = m[k]["digitisation_noise"]
                m[k] = m[k]["value"]
    return d


def _v(x: object, nd: int = 2) -> str:
    """A value to nd decimals in math mode, or the dash for an absent one (never a made-up number)."""
    return DASH if x is None else num(x, nd)


def _limit_text(a: dict) -> str:
    return f"{a['max_overlap_fraction']:g}: " + {"complete": "complete", "overlap_error": "overlap error"}.get(a["status"], a["status"]) + f" ({a['strokes']})"


def tab_dem_results() -> None:
    """The result tables and macros of the laboratory jaw, read from the committed document of the contract dem-run."""
    d = _dem()
    pts = d["points"]
    names = {p["id"]: p["id"].replace("-", "/") for p in pts}
    # --- the runs -------------------------------------------------------------------------------------------------------
    head = ["Quantity"] + [r"$" + names[p["id"]] + r"$~mm" for p in pts]
    rows = []

    def row(label, fn):
        rows.append([label] + [fn(p) for p in pts])

    row("State of the final attempt", lambda p: tex(p["simulation"]["status"].replace("_", " ")))
    row("Attempts (overlap limit: end, strokes)", lambda p: tex("; ".join(_limit_text(a) for a in p["simulation"]["attempts"])))
    row("Strokes, steps ($10^6$) of the final attempt", lambda p: f"{p['simulation']['strokes']}, {num(p['simulation']['steps'] / 1e6, 2)}")
    row("Simulated time (s)", lambda p: _v(p["simulation"]["simulated_s"], 2))
    row("Mass fed and passed (kg)", lambda p: f"{num(p['simulation']['mass_fed_kg'], 3)} and {num(p['simulation']['mass_passed_kg'], 3)}")
    row("Spheres and mass held at the end (kg)", lambda p: f"{p['simulation']['held_spheres']} and {num(p['simulation']['hold_up_kg'], 3)}")
    row("Window (first and last stroke)", lambda p: (f"{p['simulation']['window']['first_stroke']} and {p['simulation']['window']['last_stroke']}" if p["simulation"]["window"] else DASH))
    row("Window strokes above the reference overlap", lambda p: (str(p["simulation"]["window_strokes_above_overlap_reference"]) if p["simulation"]["window"] else DASH))
    row("Power stationary in the window", lambda p: (num(p["simulation"]["power_trend_stationary"]) if p["simulation"]["window"] else DASH))
    row("Whole-run throughput (kg/h)", lambda p: _v(p["simulation"]["throughput_whole_run_kg_h"], 0))
    row("Whole-run net power (kW)", lambda p: _v(p["simulation"]["net_power_whole_run_kw"], 3))
    row("Peak number of spheres (pool)", lambda p: f"{p['simulation']['breakage']['peak_particles']} ({p['simulation']['capacity_slots']})")
    row("Breakage events and progeny", lambda p: f"{p['simulation']['breakage']['events']} and {p['simulation']['breakage']['progeny']}")
    row("Placements deferred for want of room", lambda p: str(p["simulation"]["breakage"]["deferred_placements"]))
    row("Injected and absorbed energy (J)", lambda p: f"{num(p['simulation']['breakage']['injected_energy_j'], 1)} and {num(p['simulation']['breakage']['absorbed_energy_j'], 0)}")
    row("Fines below the smallest sphere (\\%)", lambda p: _v(p["simulation"]["fines_below_minimum_pct"], 1))
    row("Largest product sphere (mm); spheres above the open side", lambda p: f"{num(p['simulation']['largest_product_mm'], 1)}; {p['simulation']['spheres_above_open_side']}")
    row("Mass-balance residual (kg)", lambda p: _sci(p["simulation"]["mass_balance_residual_kg"]))
    write("tab-dem-runs", tabular("@{}p{0.34\\textwidth} p{0.19\\textwidth} p{0.19\\textwidth} p{0.19\\textwidth}@{}", head, rows))

    # --- the three sides ------------------------------------------------------------------------------------------------
    srows = []
    for p in pts:
        m, s, b = p["measured"], p["simulation"], p["population_balance"]
        band = b["band"]
        nm = r"$" + names[p["id"]] + r"$"
        srows.append([nm, "throughput (kg/h)", _v(m["throughput_kg_h"], 1), _pm(s["throughput_kg_h"], s["throughput_se_kg_h"], 0), _v(b["throughput_kg_h"], 0)])
        srows.append(["", "net power (kW)", _v(m["net_power_kw"], 3), _pm(s["net_power_kw"], s["net_power_se_kw"], 3), DASH])
        srows.append(["", "specific energy (J/kg)", _v(m["specific_energy_j_kg"], 0), _v(s["specific_energy_j_kg"], 0), DASH])
        dag = "" if s["status"] == "complete" else r"$^{\dagger}$"
        srows.append(["", "$P_{80}$ (mm)", _v(m["p80_mm"], 2), _v(s["p80_mm"], 2) + dag, _rng(b["p80_mm"], band["p80_mm"], 2)])
        srows.append(["", "$P_{50}$ (mm)", _v(m["p50_mm"], 2), _v(s["p50_mm"], 2) + dag, _rng(b["p50_mm"], band["p50_mm"], 2)])
        srows.append(["", "reduction ratio", _v(m["reduction_ratio"], 2), _v(s["reduction_ratio"], 2) + dag, _rng(b["reduction_ratio"], band["reduction_ratio"], 2)])
    write("tab-dem-sides", tabular("@{}l l r r r@{}", ["Point (mm)", "Quantity", "Measured", "Particle simulation", "Population balance [spread]"], srows))

    # --- the population balance -----------------------------------------------------------------------------------------
    prow = []

    def prow_add(label, fn):
        prow.append([label] + [fn(p) for p in pts])

    prow_add("Median fracture energy $E_{50}$ at the class mean size (J/kg)", lambda p: _v(p["population_balance"]["e50_j_kg"], 1))
    prow_add(r"Ore competence $A\times b$", lambda p: _v(p["population_balance"]["ore_axb"], 1))
    prow_add("Specific energy $E_{cs}$ (kWh/t) and $t_{10}$ (\\%)", lambda p: f"{num(p['population_balance']['specific_energy_kwh_t'], 3)} and {num(p['population_balance']['t10_pct'], 1)}")
    prow_add("Feed-size factor $k_{\\mathrm F}$ and throw factor $k_{\\mathrm T}$", lambda p: f"{num(p['population_balance']['capacity']['feed_factor'], 3)} and {num(p['population_balance']['capacity']['throw_factor'], 3)}")
    prow_add("Volume per hour $V_h$ (m$^3$/h) and critical speed (rpm)", lambda p: f"{num(p['population_balance']['capacity']['volumetric_m3_h'], 3)} and {num(p['population_balance']['capacity']['critical_speed_rpm'], 0)}")
    prow_add("Capacity (kg/h)", lambda p: _v(p["population_balance"]["throughput_kg_h"], 0))
    prow_add("Analytic $F_{80}$ (mm)", lambda p: _v(p["population_balance"]["f80_mm"], 2))
    prow_add("Bond energy per unit of work index $w_{\\mathrm B}$", lambda p: _v(p["population_balance"]["bond_kwh_t_per_wi"], 4))
    prow_add("Work index implied by the measured energy at the predicted sizes $W_i^{\\ast}$ (kWh/t)", lambda p: _v(p["population_balance"]["implied_work_index_kwh_t"], 2))
    prow_add("Work index implied at the measured sizes (kWh/t)", lambda p: _v(p["measured"]["implied_work_index_kwh_t"], 2))
    prow_add("Flags of the engine", lambda p: tex("; ".join(p["population_balance"]["flags"]) or "none"))
    write("tab-dem-pb", tabular("@{}p{0.34\\textwidth} p{0.19\\textwidth} p{0.19\\textwidth} p{0.19\\textwidth}@{}", head, prow))

    # --- the decisions --------------------------------------------------------------------------------------------------
    lines = [r"\begingroup\scriptsize",
             r"\begin{longtable}{@{}l l l r r r l p{0.17\textwidth} l@{}}",
             r"\caption{The $27$ decisions of the laboratory jaw, read from the committed document: for each operating point, each pair of sides "
             r"and each quantity (the bands are $10$ percent for the throughput, $30$ for the net power and $15$ for the reduction ratio RR; sides: sim is the particle simulation, meas the measurement, pb the population balance), the two values (the first side against the second), the relative error of Equation~\eqref{eq:proto-band}, the "
             r"decision, the basis of a decision that is not compared and, for a decision that rests on a steady window, whether it is resolved (the "
             r"nearer band edge more than two standard errors from the window mean) and that distance in standard errors. Generated from "
             r"\texttt{jaw-lab.json}.}\label{tab:dem-decisions}\\",
             r"\toprule", r"Point & Sides & Quantity & First & Second & Error (\%) & Decision & Basis & Resolved \\", r"\midrule", r"\endfirsthead",
             r"\multicolumn{9}{@{}l}{\footnotesize Table~\thetable{} (continued)}\\", r"\toprule",
             r"Point & Sides & Quantity & First & Second & Error (\%) & Decision & Basis & Resolved \\", r"\midrule", r"\endhead",
             r"\bottomrule", r"\endfoot"]
    counts = {"met": 0, "not met": 0, "not compared": 0}
    for p in pts:
        for pair, label in PAIR_NAME.items():
            for q, (qn, unit, nd) in QUANTITY_NAME.items():
                v = p["verdicts"][pair][q]
                counts[v["verdict"]] += 1
                res = DASH if v["resolved"] is None else ("yes" if v["resolved"] else "no") + (f" ({num(v['edge_distance_se'], 1)})" if v["edge_distance_se"] is not None else "")
                lines.append(" & ".join([r"$" + names[p["id"]] + r"$", SIDE_SHORT[pair], {"throughput": "throughput", "net_power": "power", "reduction_ratio": "RR"}[q], _v(v["first"], nd), _v(v["second"], nd),
                                         _v(None if v["relative_error"] is None else 100 * v["relative_error"], 1),
                                         tex(v["verdict"].replace("verdict", "decision")), tex((v["basis"] or "").replace("_", " ")) or DASH, res]) + r" \\")
    lines += [r"\end{longtable}", r"\endgroup"]
    write("tab-dem-decisions", "\n".join(lines))

    # --- macros ---------------------------------------------------------------------------------------------------------
    geo = pts[0]["simulation"]["replay"]["geometry"]
    mac = [f"\\newcommand{{\\demPlateHeight}}{{{geo['swing_pivot_mm'][1]:.1f}}}",
           f"\\newcommand{{\\demPbDepthMm}}{{{1e3 * pts[0]['population_balance']['capacity']['depth_m']:.1f}}}",
           f"\\newcommand{{\\demEngineA}}{{{ENGINE_A:g}}}",
           f"\\newcommand{{\\demOreA}}{{{d['ore']['a_max_percent']:g}}}",
           f"\\newcommand{{\\demDecMet}}{{{counts['met']}}}", f"\\newcommand{{\\demDecNotMet}}{{{counts['not met']}}}",
           f"\\newcommand{{\\demDecNotComp}}{{{counts['not compared']}}}", f"\\newcommand{{\\demDecAll}}{{{sum(counts.values())}}}",
           f"\\newcommand{{\\demDocVersion}}{{{d['engine_version']}}}", f"\\newcommand{{\\demSeed}}{{{d['seed']}}}"]
    for p in pts:
        w = POINT_WORD[p["id"]]
        m, s, b = p["measured"], p["simulation"], p["population_balance"]
        vs, vp = p["verdicts"]["simulation_vs_measured"], p["verdicts"]["population_balance_vs_measured"]
        pairs = {
            "Qsim": (s["throughput_kg_h"], 0), "QsimSe": (s["throughput_se_kg_h"], 0), "Qmeas": (m["throughput_kg_h"], 0), "Qpb": (b["throughput_kg_h"], 0),
            "Psim": (s["net_power_kw"], 3), "PsimSe": (s["net_power_se_kw"], 3), "Pmeas": (m["net_power_kw"], 3),
            "RRsim": (s["reduction_ratio"], 2), "RRmeas": (m["reduction_ratio"], 2), "RRpb": (b["reduction_ratio"], 2),
            "Dsim": (s["p80_mm"], 1), "Dmeas": (m["p80_mm"], 1), "Dpb": (b["p80_mm"], 1), "DpbLo": (b["band"]["p80_mm"][0], 1), "DpbHi": (b["band"]["p80_mm"][1], 1),
            "Fsim": (s["fines_below_minimum_pct"], 1), "Esim": (s["specific_energy_j_kg"], 0), "Emeas": (m["specific_energy_j_kg"], 0),
            "Strokes": (s["strokes"], 0), "WinFirst": (s["window"]["first_stroke"] if s["window"] else None, 0),
            "WinLast": (s["window"]["last_stroke"] if s["window"] else None, 0), "WinN": (s["window"]["strokes"] if s["window"] else None, 0),
            "WinAbove": (s["window_strokes_above_overlap_reference"], 0), "Held": (s["held_spheres"], 0), "HoldKg": (s["hold_up_kg"], 2),
            "Passed": (s["mass_passed_kg"], 2), "Peak": (s["breakage"]["peak_particles"], 0), "Events": (s["breakage"]["events"], 0),
            "Deferred": (s["breakage"]["deferred_placements"], 0), "Above": (s["spheres_above_open_side"], 0), "Largest": (s["largest_product_mm"], 1),
            "QwholeSim": (s["throughput_whole_run_kg_h"], 0), "PwholeSim": (s["net_power_whole_run_kw"], 3), "Slots": (s["capacity_slots"], 0),
            "Wi": (b["implied_work_index_kwh_t"], 1), "WiMeas": (m["implied_work_index_kwh_t"], 1), "Axb": (b["ore_axb"], 0), "Esub": (b["e50_j_kg"], 1),
            "SimTime": (s["simulated_s"], 1), "Steps": (None if s["steps"] is None else s["steps"] / 1e6, 2),
            "FeightyMm": (p["feed_f80_mm"], 2),
            "PaperP": (_paper(p, "net_power_kw"), 2), "PaperQ": (_paper(p, "throughput_kg_h"), 0),
            "PaperPerr": (None if _paper(p, "net_power_kw") is None else 100 * (_paper(p, "net_power_kw") / m["net_power_kw"] - 1), 1),
            "PaperQerr": (None if _paper(p, "throughput_kg_h") is None else 100 * (_paper(p, "throughput_kg_h") / m["throughput_kg_h"] - 1), 0),
            "PaperQratio": (None if _paper(p, "throughput_kg_h") is None or s["throughput_kg_h"] is None else s["throughput_kg_h"] / _paper(p, "throughput_kg_h"), 1),
            "TtenEng": (b["t10_pct"], 2),
            "TtenOreA": (d["ore"]["a_max_percent"] * (1 - math.exp(-(b["ore_axb"] / d["ore"]["a_max_percent"]) * b["specific_energy_kwh_t"])), 2),
            "Qratio": (None if s["throughput_kg_h"] is None else s["throughput_kg_h"] / m["throughput_kg_h"], 2),
            "Eratio": (None if s["specific_energy_j_kg"] is None else s["specific_energy_j_kg"] / m["specific_energy_j_kg"], 2),
            "Pratio": (None if s["net_power_kw"] is None else s["net_power_kw"] / m["net_power_kw"], 2),
            "PbQerrAbs": (None if vp["throughput"]["relative_error"] is None else abs(100 * vp["throughput"]["relative_error"]), 1),
            "PbRRerrAbs": (None if vp["reduction_ratio"]["relative_error"] is None else abs(100 * vp["reduction_ratio"]["relative_error"]), 1),
            "ErrPsimAbs": (None if vs["net_power"]["relative_error"] is None else abs(100 * vs["net_power"]["relative_error"]), 1),
            "ErrQsim": (None if vs["throughput"]["relative_error"] is None else 100 * vs["throughput"]["relative_error"], 0),
            "ErrPsim": (None if vs["net_power"]["relative_error"] is None else 100 * vs["net_power"]["relative_error"], 1),
            "ErrRRsim": (None if vs["reduction_ratio"]["relative_error"] is None else 100 * vs["reduction_ratio"]["relative_error"], 1),
            "ErrQpb": (None if vp["throughput"]["relative_error"] is None else 100 * vp["throughput"]["relative_error"], 1),
            "ErrRRpb": (None if vp["reduction_ratio"]["relative_error"] is None else 100 * vp["reduction_ratio"]["relative_error"], 1),
        }
        for k, (val, nd) in pairs.items():
            if val is not None:
                mac.append(f"\\newcommand{{\\dem{w}{k}}}{{{val:.{nd}f}}}")
        mac.append(f"\\newcommand{{\\dem{w}Status}}{{{s['status'].replace('_', ' ')}}}")
        mac.append(f"\\newcommand{{\\dem{w}Att}}{{{len(s['attempts'])}}}")
    write("numbers-dem-results", "\n".join(mac))


def _paper(p: dict, key: str) -> float | None:
    """The source paper's own simulated value at a point (contract dem-run 1.1.0), or None where the paper states none."""
    ps = p.get("paper_simulation")
    return None if not ps or ps.get(key) is None else ps[key]["value"]


def _sci(x: float) -> str:
    mant, _, exp = f"{x:.1e}".partition("e")
    return f"${float(mant):g}\\times10^{{{int(exp)}}}$"


def _pm(v: object, se: object, nd: int) -> str:
    return DASH if v is None else f"{num(v, nd)} $\\pm$ {num(se, nd)}"


def _rng(v: object, rng: list, nd: int) -> str:
    return f"{num(v, nd)} [{num(rng[0], nd)}, {num(rng[1], nd)}]"


if __name__ == "__main__":
    parity_numbers()
    tab_surveys()
    tab_cases()
    tab_machines()
    tab_power_parity()
    tab_bench()
    tab_lpd()
    tab_leaky()
    tab_uncertainty()
    tab_pairs()
    tab_comparison()
    numbers_drift()
    numbers_fits()
    numbers_ranking()
    tab_resources()
    tab_band()
    tab_morrell()
    tab_priors()
    tab_contraction()
    tab_convergence()
    tab_adoption()
    tab_surrogate()
    tab_anomaly()
    tab_contracts()
    schemas()
    tab_sastri_table2()
    tab_dem_parameters()
    tab_lab_measured()
    tab_dem_results()
    hashes()
    print("tables written to", OUT)
