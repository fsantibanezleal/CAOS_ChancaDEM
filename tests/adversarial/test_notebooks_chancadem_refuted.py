"""Adversarial gates of ChancaDEM's own notebook rows (NB-026, NB-027, NB-037, NB-038, NB-040): one plant per row, built in a
copy under ``tmp_path``, plus the control that the unplanted copy passes. The committed tree is never written.

The generic plants of the notebooks gate are in ``tests/adversarial/test_notebooks_refuted.py`` (a base file)."""
from __future__ import annotations

import importlib.util
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from planting import ROOT, guard, make_tree

NOTEBOOK_PYTHON = next((p for p in (ROOT / ".venv-notebooks" / "Scripts" / "python.exe", ROOT / ".venv-notebooks" / "bin" / "python") if p.is_file()), None)
MAIN = importlib.util.spec_from_file_location("test_notebooks_chancadem", ROOT / "tests" / "test_notebooks_chancadem.py")
GATES = importlib.util.module_from_spec(MAIN)
MAIN.loader.exec_module(GATES)


@pytest.fixture(scope="module")
def base(tmp_path_factory: pytest.TempPathFactory) -> Path:
    dest = tmp_path_factory.mktemp("nbc-base")
    make_tree(dest, "notebooks", "docs/design/SDD.md", ".github", "data/derived", "data/examples", "README.md", "data-pipeline",
              "scripts/check_notebooks.py", "scripts/check_template_residue.py", "scripts/run_notebooks.py", "scripts/check_readme_areas.py",
              "scripts/check_tech_matrix.py", "VERSION", "requirements*.txt", "frontend/package.json", "frontend/package-lock.json", "pyproject.toml")
    return dest


@pytest.fixture
def repo(base: Path, tmp_path: Path) -> Path:
    dest = tmp_path / "repo"
    shutil.copytree(base, dest)
    return dest


def jedit(repo: Path, rel: str, change) -> None:
    path = repo / rel
    doc = json.loads(path.read_text(encoding="utf-8"))
    change(doc)
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def run_release_gate(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([str(NOTEBOOK_PYTHON), str(repo / "scripts" / "run_notebooks.py"), *args], capture_output=True, encoding="utf-8",
                          errors="replace", cwd=repo, timeout=600)


def test_the_unplanted_copy_passes_the_static_check(repo: Path) -> None:
    r = guard(repo, "check_notebooks.py")
    assert r.returncode == 0, r.stdout


def test_a_spanish_notebook_deleted_from_a_copy_breaks_the_mirror(repo: Path) -> None:
    """NB-026: the committed set is mirrored; without one Spanish notebook the static check fails naming it, and the copy is no longer mirrored."""
    gone = "05-real-surveys/02-measured-against-modelled.ipynb"
    (repo / "notebooks" / "es" / gone).unlink()
    r = guard(repo, "check_notebooks.py")
    assert r.returncode == 1 and "mirror" in r.stdout and "02-measured-against-modelled.ipynb" in r.stdout, r.stdout
    en = sorted(p.relative_to(repo / "notebooks" / "en").as_posix() for p in (repo / "notebooks" / "en").rglob("*.ipynb"))
    es = sorted(p.relative_to(repo / "notebooks" / "es").as_posix() for p in (repo / "notebooks" / "es").rglob("*.ipynb"))
    assert en != es and len(es) == GATES.PER_LANGUAGE - 1, "the copy must no longer be mirrored and hold 17 Spanish notebooks"


def test_an_example_notebook_planted_into_a_tree_is_found_by_the_residue_guard_and_the_rule(repo: Path, tmp_path: Path) -> None:
    """NB-027: the residue guard names the planted example notebook by its content (the example engine and an example case id), and the
    test's own rule names it by its path; the control, the unplanted copy, passes both."""
    product = tmp_path / "product"
    make_tree(product, "notebooks", "scripts/check_template_residue.py")
    for n in range(12):
        (product / "src").mkdir(exist_ok=True)
        (product / "src" / f"m{n}.py").write_text("x = 1\n", encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=product, check=True)
    subprocess.run(["git", "add", "-A"], cwd=product, check=True)

    def residue() -> subprocess.CompletedProcess:
        subprocess.run(["git", "add", "-A"], cwd=product, check=True)
        return subprocess.run([sys.executable, str(product / "scripts" / "check_template_residue.py"), str(product)], capture_output=True,
                              encoding="utf-8", errors="replace", cwd=product, timeout=120)
    control = residue()
    assert control.returncode == 0, control.stdout
    assert GATES.example_residue(product) == []
    rel = GATES.EXAMPLE_NOTEBOOKS[2]
    planted = product / "notebooks" / "en" / rel
    planted.parent.mkdir(parents=True, exist_ok=True)
    case = "EX0" + "2_epidemic"
    planted.write_text(json.dumps({"cells": [{"cell_type": "code", "source": [f"from {GATES.EXAMPLE_IMPORT} import simulate\n", f"params_of('{case}')"]}]}, indent=1) + "\n", encoding="utf-8")
    r = residue()
    assert r.returncode == 1 and f"notebooks/en/{rel}" in r.stdout and "an example case id" in r.stdout, r.stdout
    assert GATES.example_residue(product) == [f"en/{rel}"]


def test_a_notebook_that_defines_an_oracle_in_a_cell_is_found(repo: Path) -> None:
    """NB-038: a private copy of rosin_rammler_passing planted in a cell of the first notebook that imports the oracles."""
    rel = "notebooks/en/" + sorted(GATES.ORACLE_USERS)[0]

    def plant(doc: dict) -> None:
        cell = next(c for c in doc["cells"] if c["cell_type"] == "code")
        cell["source"] = ["# a private copy of the oracle\n", "def rosin_rammler_passing(x, x63, m):\n", "    return x\n"]
    jedit(repo, rel, plant)
    r = guard(repo, "check_notebooks.py")
    assert r.returncode == 1 and "defines 'rosin_rammler_passing'" in r.stdout and "import it instead" in r.stdout, r.stdout


def test_a_rosin_rammler_oracle_with_a_perturbed_exponent_fails_the_closed_form(repo: Path) -> None:
    """NB-037: the law 1 - exp(-(x / x63)^m) is the check; an oracle whose exponent is 0.9 m breaks it and breaks the round trip
    through its own inverse."""
    path = repo / "data-pipeline" / "pipeline" / "oracles.py"
    text = path.read_text(encoding="utf-8")
    assert "((x_mm / x63_mm) ** m)" in text
    path.write_text(text.replace("((x_mm / x63_mm) ** m)", "((x_mm / x63_mm) ** (0.9 * m))"), encoding="utf-8")
    spec = importlib.util.spec_from_file_location("oracles_planted", path)
    planted = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(planted)
    closed = 1.0 - math.exp(-((50.0 / 90.0) ** 1.2))
    assert abs(planted.rosin_rammler_passing(50.0, 90.0, 1.2) - closed) > 1e-3, "the planted law must violate the closed form"
    size = planted.rosin_rammler_size_at(0.8, 90.0, 1.2)
    assert abs(planted.rosin_rammler_passing(size, 90.0, 1.2) - 0.8) > 1e-3, "the planted law must break the round trip through the inverse"


@pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")
@pytest.mark.parametrize("lang", ["en", "es"])
def test_a_figure_cell_that_loses_its_case_is_stale(repo: Path, lang: str, tmp_path: Path) -> None:
    """NB-040, local-only: the figure says Case S01; a cell that binds the last loop case instead writes other numbers and the
    release gate finds the committed outputs stale."""
    only = f"notebooks/{lang}/{GATES.FIGURE_CASE_NOTEBOOK}"
    temp = tmp_path / "gate"
    assert run_release_gate(repo, "--check", "--only", only, "--tmp", str(temp)).returncode == 0

    def lose_case(doc: dict) -> None:
        cell = next(c for c in doc["cells"] if c["cell_type"] == "code" and "np.linspace(0.5, 1.5, 11)" in "".join(c["source"]))
        assert any(f'manifests["{GATES.FIGURE_CASE}"]' in ln for ln in cell["source"])
        cell["source"] = [ln.replace(f'manifests["{GATES.FIGURE_CASE}"]', "manifests[k]") for ln in cell["source"]]
        assert not any(f'manifests["{GATES.FIGURE_CASE}"]' in ln for ln in cell["source"])
    jedit(repo, only, lose_case)
    r = run_release_gate(repo, "--check", "--only", only, "--tmp", str(temp))
    assert r.returncode == 1 and "stale" in r.stdout and "02-case-matrix-and-replay.ipynb" in r.stdout, r.stdout
