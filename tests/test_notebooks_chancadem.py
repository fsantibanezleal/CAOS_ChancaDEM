"""ChancaDEM's own notebook gates (requirement rows NB-026, NB-027, NB-037, NB-038 and NB-040 of
``docs/design/features/notebooks/requirements.md``): the committed set, read as committed.

The generic rules of the notebooks gate live in ``tests/test_check_notebooks.py`` (a base file, one plant per rule). These tests
hold what is true of this product's set: 18 notebooks per language in seven topics, built on the crusher engine and the
oracles, and the figure of a notebook that names a case runs that case. Counts are read from the committed set once and
written here as constants, so an added or removed notebook fails a test on purpose."""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data-pipeline"))


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHECK = load("check_notebooks")

# Read from notebooks/en on 2026-10-27: topic folder -> the level of each notebook, in order (06-03 is level 4 by design).
LEVELS = {
    "01-getting-started": [1, 2],
    "02-size-distributions": [1, 2],
    "03-breakage-and-classification": [1, 2, 3],
    "04-capacity-and-power": [1, 2],
    "05-real-surveys": [1, 2, 3],
    "06-crushercal": [1, 2, 4],
    "07-learned-models": [1, 2, 3],
}
PER_LANGUAGE = 18          # the sum of LEVELS
ORACLE_USERS = {           # the notebooks that import the oracles, read from notebooks/en on 2026-10-27
    "02-size-distributions/01-rosin-rammler-feed.ipynb",
    "02-size-distributions/02-grid-interpolation-and-the-oracle.ipynb",
    "03-breakage-and-classification/02-whiten-solve-step-by-step.ipynb",
    "04-capacity-and-power/02-setting-throw-and-the-bond-oracle.ipynb",
    "05-real-surveys/02-measured-against-modelled.ipynb",
}
# The template's example notebooks (the example set) and the import its engine needs.
EXAMPLE_NOTEBOOKS = (
    "01-getting-started/01-the-problem-and-the-data.ipynb",
    "01-getting-started/02-the-method-step-by-step.ipynb",
    "02-threshold-and-final-size/01-the-threshold.ipynb",
    "02-threshold-and-final-size/02-the-final-size.ipynb",
    "02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb",
)
EXAMPLE_IMPORT = "pipeline.model." + "sir"
FIGURE_CASE_NOTEBOOK = "01-getting-started/02-case-matrix-and-replay.ipynb"   # NB-040: the cell that binds S01 for its figure
FIGURE_CASE = "S01"


def notebooks(lang: str) -> list[str]:
    return sorted(p.relative_to(ROOT / "notebooks" / lang).as_posix() for p in (ROOT / "notebooks" / lang).rglob("*.ipynb"))


def doc_of(lang: str, rel: str) -> dict:
    return json.loads((ROOT / "notebooks" / lang / rel).read_text(encoding="utf-8"))


def code_of(doc: dict) -> str:
    return "\n".join(CHECK.text_of(c["source"]) for c in doc["cells"] if c["cell_type"] == "code")


# ---------------------------------------------------------------- NB-026

def test_the_committed_set_is_mirrored_in_seven_topics_and_passes_the_static_check() -> None:
    en, es = notebooks("en"), notebooks("es")
    assert en == es, "the Spanish tree must mirror the English one"
    assert len(en) == PER_LANGUAGE == sum(len(v) for v in LEVELS.values())
    for topic, levels in LEVELS.items():
        found = [doc_of("en", rel)["metadata"]["caos"]["level"] for rel in en if rel.startswith(topic + "/")]
        assert found == levels, (topic, found)
    assert sorted({rel.split("/")[0] for rel in en}) == sorted(LEVELS)
    assert CHECK.findings_of(ROOT) == []


@pytest.mark.parametrize("lang", ["en", "es"])
def test_every_notebook_imports_the_pipeline_and_defines_no_engine_name(lang: str) -> None:
    engine = CHECK.engine_names(ROOT)
    assert {"load_bundle", "rosin_rammler_passing", "bond_energy_kwh_t"} <= engine
    for rel in notebooks(lang):
        code = code_of(doc_of(lang, rel))
        assert re.search(r"^\s*from pipeline[\w.]* import ", code, re.M), f"{lang}/{rel} imports nothing from the pipeline"
        assert not (CHECK.defined_names(code) & engine), f"{lang}/{rel} defines an engine name"


# ---------------------------------------------------------------- NB-027

def example_residue(root: Path) -> list[str]:
    """The notebooks of the template's example in a tree: by path, and by the example engine import in any notebook."""
    found = []
    for lang in ("en", "es"):
        for rel in EXAMPLE_NOTEBOOKS:
            if (root / "notebooks" / lang / rel).is_file():
                found.append(f"{lang}/{rel}")
        for path in sorted((root / "notebooks" / lang).rglob("*.ipynb")):
            if EXAMPLE_IMPORT in path.read_text(encoding="utf-8"):
                found.append(f"{lang}/{path.relative_to(root / 'notebooks' / lang).as_posix()}")
    return sorted(set(found))


def test_the_notebook_trees_hold_no_notebook_of_the_template_example() -> None:
    assert example_residue(ROOT) == []


def test_the_products_own_files_hold_no_example_residue() -> None:
    """The residue guard lists no line outside the base test files (which the template's own fix handles)."""
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "check_template_residue.py"), str(ROOT)], capture_output=True,
                       encoding="utf-8", errors="replace", cwd=ROOT, timeout=120)
    own = [ln.strip() for ln in r.stdout.splitlines() if re.match(r"\s+\S+:\d+: ", ln) and not ln.strip().startswith("tests/")]
    assert own == [], own


# ---------------------------------------------------------------- NB-038

@pytest.mark.parametrize("lang", ["en", "es"])
def test_the_oracles_are_imported_by_the_notebooks_that_use_them_and_defined_in_none(lang: str) -> None:
    from pipeline import oracles
    names = {n for n in dir(oracles) if not n.startswith("_") and callable(getattr(oracles, n))}
    assert {"rosin_rammler_passing", "bond_energy_kwh_t", "mass_closure"} <= names
    users = set()
    for rel in notebooks(lang):
        code = code_of(doc_of(lang, rel))
        assert not (CHECK.defined_names(code) & names), f"{lang}/{rel} defines an oracle"
        if re.search(r"^\s*from pipeline\.oracles import ", code, re.M):
            users.add(rel)
    assert users == ORACLE_USERS, users ^ ORACLE_USERS


# ---------------------------------------------------------------- NB-040

@pytest.mark.parametrize("lang", ["en", "es"])
def test_the_figure_cell_of_the_case_matrix_binds_its_case_and_carries_that_case_numbers(lang: str) -> None:
    """The sweep figure is titled 'Case S01': its cell binds S01 itself (not the last loop variable) and its committed output
    holds the power S01 draws at the tightest and the widest setting, which this test recomputes from data/derived."""
    from pipeline.model.crusher import Operating, evaluate
    doc = doc_of(lang, FIGURE_CASE_NOTEBOOK)
    cell = next(c for c in doc["cells"] if c["cell_type"] == "code" and "np.linspace(0.5, 1.5, 11)" in CHECK.text_of(c["source"]))
    body = [ln for ln in CHECK.text_of(cell["source"]).splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    assert body[0] == f'base = Operating(**manifests["{FIGURE_CASE}"]["params"])', body[0]
    manifest = json.loads((ROOT / "data" / "derived" / "manifests" / f"{FIGURE_CASE}.json").read_text(encoding="utf-8"))
    base = Operating(**manifest["params"])
    lo, hi = (round(evaluate(replace(base, css_mm=base.css_mm * k)).power_kw) for k in (0.5, 1.5))
    printed = "".join(CHECK.text_of(o.get("text", "")) for o in cell["outputs"])
    assert re.search(rf"\b{lo}\b\D+\b{hi}\b", printed), (lo, hi, printed)
