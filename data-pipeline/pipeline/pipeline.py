"""Offline pipeline orchestrator and CLI.

The canonical bake is an explicit release operation. Tests and CI smoke runs must pass ``--output`` so they cannot mutate
committed scientific evidence.

    python data-pipeline/run.py                      # all: the 27 cases, the HP500 documents, the index, readiness
    python data-pipeline/run.py S01                  # one case
    python data-pipeline/run.py S01 --output build/smoke
    python data-pipeline/run.py readiness            # recompute data/derived/readiness.json from the catalog (no bake)
    python data-pipeline/run.py hp500                # the two HP500 documents (backbone and CrusherCal LOO)
    python data-pipeline/run.py models               # train then evaluate the two model slots (heavy lane, needs torch)
    python data-pipeline/run.py fixtures             # regenerate the provider tree docs/contracts/fixtures/data

``all`` never trains: the models are read as they stand in ``<derived>/models``.
"""
from __future__ import annotations

import argparse
import dataclasses
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import __version__, registry
from .cases import Case, text
from .cases import hp500_cases
from .core import expect as expectations
from .core import readiness, unit_gate
from .core.gate import classify_lane
from .core.manifest import build_index, flag_codes, index_entry
from .core.trace import metrics_of, r6
from .hp500 import backbone as backbone_doc
from .hp500 import loo as loo_doc
from .hp500 import surveys as survey_contract
from .io.contract import PARAMS_CSV, flags_of
from .io.formats import read_csv_rows, write_json
from .model.bundles import released_slots
from .model.crusher import CrusherResult, Operating
from .stages import export, infer, preprocess

# data-pipeline/pipeline/pipeline.py -> parents[2] = repo root (works under `pip install -e .` too)
REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED = REPO_ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
MODELS = DERIVED / "models"
RELEASED = REPO_ROOT / "data" / "derived"   # the committed bake: the source of the provider tree
FIXTURES = REPO_ROOT / "docs" / "contracts" / "fixtures" / "data"

REPO = REPO_ROOT  # the repository the readiness document describes (catalog, VERSION, the source tables)
SEED = 42
MODEL_FILES = ("models/surrogate.json", "models/surrogate.onnx", "models/surrogate.int8.onnx", "models/psd-ae.json",
               "models/psd-ae.onnx")
HP500_FILES = ("hp500/backbone.json", "hp500/loo.json")
METRICS_FILE = "model-metrics.json"


@dataclass(frozen=True)
class PipelinePaths:
    root: Path
    manifests: Path
    models: Path
    params_csv: Path
    surveys_csv: Path

    @classmethod
    def from_output(cls, output: str | Path | None = None, *, params_csv: str | Path | None = None,
                    surveys_csv: str | Path | None = None) -> "PipelinePaths":
        params = Path(params_csv) if params_csv else PARAMS_CSV
        surveys = Path(surveys_csv) if surveys_csv else survey_contract.SURVEYS_CSV
        if output is None:
            return cls(root=DERIVED, manifests=MANIFESTS, models=MODELS, params_csv=params, surveys_csv=surveys)
        root = Path(output).resolve()
        return cls(root=root, manifests=root / "manifests", models=root / "models", params_csv=params, surveys_csv=surveys)


@dataclass
class Inputs:
    """What the two source tables give: the cases to bake, the contract-1 flag codes per case, the accepted surveys."""

    cases: list[Case] = field(default_factory=list)
    extra_flags: dict[str, list[str]] = field(default_factory=dict)
    surveys: list[survey_contract.Survey] = field(default_factory=list)


def load_inputs(paths: PipelinePaths) -> Inputs:
    """Apply the two ingestion contracts. A missing params table bakes the registry's circuit cases; a rejected params row
    drops its case; a missing survey table or no accepted survey bakes no real case."""
    out = Inputs()
    circuit = registry.circuit_cases()
    if paths.params_csv.is_file():
        accepted = {r.case_id: r for r in preprocess.run(paths.params_csv).accepted}
        for c in circuit:
            rec = accepted.get(c.id)
            if rec is None:
                continue
            out.cases.append(dataclasses.replace(c, op=rec.operating()))
            out.extra_flags[c.id] = flags_of(rec)
    else:
        out.cases = circuit
    if paths.surveys_csv.is_file():
        out.surveys = survey_contract.read_surveys(paths.surveys_csv).accepted
    out.cases = out.cases + hp500_cases.build(out.surveys)
    return out


def _engine_ms(op: Operating, repeats: int = 5) -> float:
    """The cost the lane gate judges: one engine run, after a warm-up, as the median of several. Timing the whole case
    (validation, evaluation, the cold start of the first case in a bake) made the verdict depend on bake order: the
    first case baked was once labelled precompute while it runs in microseconds (found 2026-10-04)."""
    infer.run(op)
    times = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        infer.run(op)
        times.append((time.perf_counter() - t0) * 1000.0)
    return sorted(times)[repeats // 2]


def _metrics(case: Case, result: CrusherResult) -> dict[str, float]:
    metrics = metrics_of(result)
    if case.measured is not None:
        m = case.measured
        metrics["throughput_err_pct"] = r6(100.0 * (result.throughput_tph - m["feed_tph"]) / m["feed_tph"])
        metrics["power_err_pct"] = r6(100.0 * (result.power_kw - m["power_kw"]) / m["power_kw"])
    return metrics


def _models(paths: PipelinePaths) -> dict[str, str]:
    """Per model slot: ``real`` when its released bundle is valid, ``baseline`` otherwise."""
    return {slot: "real" if ok else "baseline" for slot, ok in released_slots(paths.models).items()}


def _bake(case: Case, inputs: Inputs, paths: PipelinePaths, seed: int, models: dict[str, str]) -> dict:
    result = infer.run(case.op)
    metrics = _metrics(case, result)
    ranges = expectations.check(case.id, case.expect, metrics)   # a result outside its declared range fails the bake
    observed = [dataclasses.asdict(s) for s in inputs.surveys] if case.measured is not None else None
    unit_gate.enforce(case.id, {k: v for k, v in metrics.items() if k in unit_gate.PHYSICAL_DOMAIN},
                      unit_gate.ranges_for(case.op.machine, observed))   # CONTRACT 3: the units
    flags = flag_codes(result, inputs.extra_flags.get(case.id))
    return export.run(case=case, result=result, seed=seed, run_ms=_engine_ms(case.op), flags=flags, metrics=metrics,
                      models=models, expect=ranges, derived_dir=str(paths.root), manifests_dir=str(paths.manifests))


def precompute(case_id: str, seed: int = SEED, *, output_root: str | Path | None = None,
               params_csv: str | Path | None = None, surveys_csv: str | Path | None = None) -> dict:
    """Bake one case and return its manifest."""
    paths = PipelinePaths.from_output(output_root, params_csv=params_csv, surveys_csv=surveys_csv)
    inputs = load_inputs(paths)
    case = next((c for c in inputs.cases if c.id == case_id), None)
    if case is None:
        raise KeyError(f"unknown case: {case_id!r}. baked from the source tables: {sorted(c.id for c in inputs.cases)}")
    return _bake(case, inputs, paths, seed, _models(paths))


def bake_hp500(paths: PipelinePaths, surveys: list[survey_contract.Survey], seed: int = SEED) -> list[str]:
    """Write the two HP500 documents under ``<root>/hp500`` from the accepted surveys; none when there is no survey."""
    if not surveys:
        return []
    bb = backbone_doc.build(surveys, __version__)
    write_json(paths.root / "hp500" / "backbone.json", bb)
    write_json(paths.root / "hp500" / "loo.json", loo_doc.build(bb, __version__, seed=seed))
    return list(HP500_FILES)


def index_files(root: Path) -> list[str]:
    """The further files of ``root`` the index lists: the model contracts and graphs, the two HP500 documents and the model
    metrics, each when present."""
    return [rel for rel in (*MODEL_FILES, *HP500_FILES, METRICS_FILE) if (root / rel).is_file()]


def write_readiness(paths: PipelinePaths) -> dict:
    """Compute the readiness document for the repository and the outputs under ``paths``, and write it."""
    doc = readiness.compute(repo_root=REPO, derived_root=paths.root, models_dir=paths.models,
                            params_csv=paths.params_csv, surveys_csv=paths.surveys_csv)
    readiness.write(paths.root, doc)
    return doc


def refresh_files(paths: PipelinePaths) -> None:
    """Rewrite the index's ``files`` after a command that added or changed one (hp500, models); no-op without an index."""
    index_path = paths.manifests / "index.json"
    if not index_path.is_file():
        return
    from .io.formats import read_json

    index = read_json(index_path)
    index["files"] = index_files(paths.root)
    write_json(index_path, index)


def run_all(seed: int = SEED, *, output_root: str | Path | None = None, params_csv: str | Path | None = None,
            surveys_csv: str | Path | None = None) -> list[dict]:
    """The release bake: every case of the source tables, the HP500 documents, the index and the readiness. Never trains."""
    paths = PipelinePaths.from_output(output_root, params_csv=params_csv, surveys_csv=surveys_csv)
    inputs = load_inputs(paths)
    models = _models(paths)
    entries = []
    for c in inputs.cases:
        _bake(c, inputs, paths, seed, models)
        entries.append(index_entry(c))
    bake_hp500(paths, inputs.surveys, seed)
    write_json(paths.manifests / "index.json", build_index(entries, registry.default_case(), index_files(paths.root)))
    write_readiness(paths)
    return entries


def train_models(paths: PipelinePaths) -> None:
    """The precompute lane: train both model slots on the canonical engine, evaluate them held-out, refresh the index and
    the readiness. Needs torch, onnx and onnxruntime (requirements-precompute.txt)."""
    from .stages import evaluate, train

    train.run(paths.models, version=__version__)
    evaluate.run(paths.models, paths.root / METRICS_FILE, version=__version__)
    refresh_files(paths)
    write_readiness(paths)


def write_fixtures(out: str | Path | None = None) -> Path:
    """Regenerate the provider tree (docs/contracts/fixtures/data) from this code: FX01 at the operating point of S01, FX02
    at HP500 survey 1, their manifests and traces, the index, the two HP500 documents, the released model contracts and
    graphs and the model metrics when present, and a readiness document that says ``provider`` for every row but the
    dormant API. The two source tables are two-row samples."""
    data = Path(out).resolve() if out else FIXTURES
    derived, examples = data / "derived", data / "examples"
    for sub in (derived / "manifests", derived / "hp500", derived / "FX01", derived / "FX02", examples):
        shutil.rmtree(sub, ignore_errors=True)
    for stale in (derived / "readiness.json", derived / METRICS_FILE):
        stale.unlink(missing_ok=True)
    for rel in (*MODEL_FILES, METRICS_FILE):
        src = RELEASED / rel
        if src.is_file():
            (derived / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, derived / rel)
    paths = PipelinePaths(root=derived, manifests=derived / "manifests", models=derived / "models",
                          params_csv=PARAMS_CSV, surveys_csv=survey_contract.SURVEYS_CSV)
    surveys = survey_contract.read_surveys(paths.surveys_csv).accepted if paths.surveys_csv.is_file() else []
    inputs = Inputs(surveys=surveys)
    s01 = registry.get_case(registry.default_case())
    fx01 = dataclasses.replace(
        s01, id="FX01",
        title=text("Fixture: secondary cone at the choke optimum", "Fixture: cono secundario en el óptimo de alimentación atorada"),
        context={"problem": text("The provider case of the walking skeleton, at the operating point of case S01. It is scaffolding, labelled as a provider on every surface.",
                                 "El caso proveedor del esqueleto, en el punto de operación del caso S01. Es andamiaje, rotulado como proveedor en cada superficie."),
                 "variables": s01.context["variables"],
                 "reading": text("The real case S01 replaces it when the pipeline bakes. Read it only to check that a view works.",
                                 "El caso real S01 lo reemplaza cuando el pipeline genera. Léalo solo para comprobar que una vista funciona.")})
    cases = [fx01]
    if surveys:
        first = hp500_cases.build(surveys)[0]
        cases.append(dataclasses.replace(
            first, id="FX02", title=text("Fixture: HP500 survey 1", "Fixture: muestreo HP500 1"),
            context={"problem": text("The provider real case of the walking skeleton, at HP500 survey 1. It is scaffolding, labelled as a provider on every surface.",
                                     "El caso real proveedor del esqueleto, en el muestreo HP500 1. Es andamiaje, rotulado como proveedor en cada superficie."),
                     "variables": first.context["variables"],
                     "reading": text("The real case HP500-01 replaces it when the pipeline bakes. Read it only to check that a view works.",
                                     "El caso real HP500-01 lo reemplaza cuando el pipeline genera. Léalo solo para comprobar que una vista funciona.")}))
    models = _models(paths)
    entries = []
    for c in cases:
        _bake(c, inputs, paths, SEED, models)
        entries.append(index_entry(c))
    bake_hp500(paths, surveys)
    write_json(paths.manifests / "index.json", build_index(entries, "FX01", index_files(derived)))
    write_json(derived / "readiness.json", readiness.provider_document(repo_root=REPO))
    examples.mkdir(parents=True, exist_ok=True)
    s01_row = ",".join(str(v) for v in ("FX01", "cone-sec", 32, 30, 360, 90, 1.2, 55, 14))
    j01_row = ",".join(str(v) for v in ("FX03", "jaw", 125, 40, 300, 400, 0.9, 42, 16))
    (examples / "params.csv").write_text("case_id,machine,css_mm,throw_mm,speed_rpm,feed_x63_mm,feed_m,ore_axb,ore_wi\n"
                                         f"{s01_row}\n{j01_row}\n", encoding="utf-8", newline="\n")
    rows = read_csv_rows(paths.surveys_csv)[:2] if paths.surveys_csv.is_file() else []
    (examples / "hp500-surveys.csv").write_text(
        "survey,f80_mm,css_mm,feed_tph,power_kw\n" + "".join(f"{r['survey']},{r['f80_mm']},{r['css_mm']},{r['feed_tph']},{r['power_kw']}\n"
                                                           for r in rows), encoding="utf-8", newline="\n")
    return data


def main() -> None:
    ap = argparse.ArgumentParser(prog="pipeline.pipeline")
    ap.add_argument("command", nargs="?", default="all",
                    help="a case id, or all, readiness, hp500, models, fixtures (default all)")
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--output", type=Path,
                    help="sandbox output root (for fixtures: the fixtures data folder); omit only for an intentional canonical run")
    ap.add_argument("--params", type=Path, help="the params table (default data/examples/params.csv)")
    ap.add_argument("--surveys", type=Path, help="the survey table (default data/examples/hp500-surveys.csv)")
    args = ap.parse_args()
    paths = PipelinePaths.from_output(args.output, params_csv=args.params, surveys_csv=args.surveys)
    if args.command == "readiness":
        doc = write_readiness(paths)
        print(f"readiness -> {paths.root / 'readiness.json'} " + ", ".join(f"{e['id']}={e['state']}" for e in doc["contracts"]))
    elif args.command == "all":
        t0 = time.perf_counter()
        entries = run_all(args.seed, output_root=args.output, params_csv=args.params, surveys_csv=args.surveys)
        print(f"precomputed {len(entries)} cases in {time.perf_counter() - t0:.1f} s -> {paths.root}")
        for e in entries:
            print(f"  {e['case_id']:10s} [{e['category']['en']}]")
        print(f"index -> {paths.manifests / 'index.json'}")
    elif args.command == "hp500":
        surveys = survey_contract.read_surveys(paths.surveys_csv).accepted if paths.surveys_csv.is_file() else []
        written = bake_hp500(paths, surveys, args.seed)
        refresh_files(paths)
        write_readiness(paths)
        print(f"hp500: {', '.join(written) or 'no accepted survey, nothing written'} -> {paths.root}")
    elif args.command == "models":
        train_models(paths)
        print(f"models -> {paths.models}; metrics -> {paths.root / METRICS_FILE}")
    elif args.command == "fixtures":
        print(f"fixtures -> {write_fixtures(args.output)}")
    else:
        m = precompute(args.command, args.seed, output_root=args.output, params_csv=args.params, surveys_csv=args.surveys)
        print(f"precomputed {args.command}: lane={m['lane']} bytes={m['artifact']['bytes']} metrics={m['metrics']} "
              f"-> {paths.root / m['artifact']['path']}")


if __name__ == "__main__":
    main()
