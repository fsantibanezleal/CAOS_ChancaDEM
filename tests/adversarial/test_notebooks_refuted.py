"""Adversarial plants for the notebooks (NB-) and the README by areas (RP-): each requirement is attacked on a copy of the
committed example set, with the real guard run as a subprocess. The unplanted copy is the control: it passes, so a plant that
fails proves the rule and not a broken copy. The tests need only the standard library and pytest, so CI runs them.

The execution gate (``scripts/run_notebooks.py --check``) needs the notebook environment, which CI does not install: its two
plants skip without ``.venv-notebooks``."""
from __future__ import annotations

import base64
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from planting import ROOT, guard, make_tree

NOTEBOOK_PYTHON = next((p for p in (ROOT / ".venv-notebooks" / "Scripts" / "python.exe", ROOT / ".venv-notebooks" / "bin" / "python") if p.is_file()), None)
EN = "notebooks/en/02-threshold-and-final-size"
ES = "notebooks/es/02-threshold-and-final-size"
FOLDERS = ("frontend", "app", "data-pipeline", "notebooks", "data", "docs/contracts", "docs", "tests", "scripts", "deploy")


@pytest.fixture(scope="module")
def base(tmp_path_factory: pytest.TempPathFactory) -> Path:
    dest = tmp_path_factory.mktemp("nb-base")
    make_tree(dest, "notebooks", "docs/design/SDD.md", ".github", "data/derived", "README.md", "data-pipeline",
              "scripts/check_notebooks.py", "scripts/check_readme_areas.py", "scripts/check_tech_matrix.py", "scripts/run_notebooks.py",
              "scripts/instantiate.py", "scripts/check_template_residue.py", "VERSION", "requirements*.txt", "frontend/package.json", "frontend/package-lock.json", "pyproject.toml")
    return dest


@pytest.fixture
def repo(base: Path, tmp_path: Path) -> Path:
    dest = tmp_path / "repo"
    shutil.copytree(base, dest)
    return dest


def jedit(repo: Path, rel: str, change) -> None:
    """Load a notebook of the copy, change it, write it back."""
    path = repo / rel
    doc = json.loads(path.read_text(encoding="utf-8"))
    change(doc)
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def both(repo: Path, rel: str, change) -> None:
    """The same change in the English notebook and its Spanish counterpart (the mirror stays intact)."""
    jedit(repo, f"notebooks/en/{rel}", change)
    jedit(repo, f"notebooks/es/{rel}", change)


def fails(repo: Path, *needles: str, script: str = "check_notebooks.py") -> None:
    r = guard(repo, script)
    assert r.returncode == 1, f"the plant passed {script}:\n{r.stdout}"
    for needle in needles:
        assert needle in r.stdout, f"{needle!r} not in:\n{r.stdout}"


def first_code(doc: dict) -> dict:
    return next(c for c in doc["cells"] if c["cell_type"] == "code")


def test_the_unplanted_copy_passes_both_checks(repo: Path) -> None:
    assert guard(repo, "check_notebooks.py", ok_marker="check_notebooks: OK").returncode == 0
    assert guard(with_dirs(repo), "check_readme_areas.py", ok_marker="check_readme_areas: OK").returncode == 0


def test_a_missing_spanish_index_is_found(repo: Path) -> None:
    (repo / "notebooks" / "es" / "README.md").unlink()
    fails(repo, "notebooks/es/README.md", "layout")


def test_a_spanish_notebook_deleted_breaks_the_mirror(repo: Path) -> None:
    (repo / ES / "03-next-generation-matrix-and-final-size-derivation.ipynb").unlink()
    fails(repo, "mirror", "03-next-generation-matrix-and-final-size-derivation.ipynb")


def test_a_numbering_gap_in_both_trees_is_found(repo: Path) -> None:
    for tree in (EN, ES):
        (repo / tree / "02-the-final-size.ipynb").rename(repo / tree / "04-the-final-size.ipynb")
    fails(repo, "numbering", "no gap or repeat")


def test_a_level_that_decreases_is_found(repo: Path) -> None:
    both(repo, "02-threshold-and-final-size/01-the-threshold.ipynb", lambda d: d["metadata"]["caos"].update(level=3))
    fails(repo, "levels", "decreases inside the topic")


def test_a_topic_without_level_two_is_found(repo: Path) -> None:
    both(repo, "01-getting-started/02-the-method-step-by-step.ipynb", lambda d: d["metadata"]["caos"].update(level=1))
    fails(repo, "no level 2 notebook")


def test_a_missing_reason_for_level_three_is_found(repo: Path) -> None:
    index = repo / "notebooks" / "en" / "README.md"
    text = index.read_text(encoding="utf-8")
    assert "No level 3:" in text
    index.write_text(text.replace("No level 3:", "Level 3 left out:"), encoding="utf-8")
    fails(repo, "01-getting-started", "no level 3 notebook and its row gives no reason")


def test_a_notebook_dropped_from_the_index_is_found(repo: Path) -> None:
    index = repo / "notebooks" / "es" / "README.md"
    text = index.read_text(encoding="utf-8")
    index.write_text(text.replace("01-the-threshold.ipynb", "elided.ipynb"), encoding="utf-8")
    fails(repo, "notebooks/es/README.md", "is not listed")


def test_an_sdd_claim_without_a_level_four_notebook_is_found(repo: Path) -> None:
    sdd = repo / "docs" / "design" / "SDD.md"
    text = sdd.read_text(encoding="utf-8")
    assert "None claimed." in text
    sdd.write_text(text.replace("None claimed.", "- BS-1: a component beyond the state of the art, with its evidence and its source.", 1), encoding="utf-8")
    fails(repo, "BS-1", "covered by no level 4 notebook")
    # a notebook claiming what the SDD does not list is found too
    sdd.write_text(text, encoding="utf-8")
    both(repo, "02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb", lambda d: d["metadata"]["caos"].update(beyond=["BS-7"]))
    fails(repo, "BS-7")


def test_a_renamed_section_is_found(repo: Path) -> None:
    def rename(doc: dict) -> None:
        for c in doc["cells"]:
            if c["cell_type"] == "markdown" and c["source"][0].startswith("## Results"):
                c["source"][0] = "## Findings\n"
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", rename)
    fails(repo, "'## Results' is missing", "'## Findings' is not a section of the anatomy")


def test_a_title_cell_turned_into_code_is_found(repo: Path) -> None:
    def retype(doc: dict) -> None:
        doc["cells"][0].update(cell_type="code", execution_count=None, outputs=[])
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", retype)
    fails(repo, "the first cell is not a markdown cell")


def test_a_code_cell_stripped_of_its_comment_is_found(repo: Path) -> None:
    def strip(doc: dict) -> None:
        cell = first_code(doc)
        cell["source"] = [ln for ln in cell["source"] if not ln.lstrip().startswith("#")]
    jedit(repo, "notebooks/es/01-getting-started/02-the-method-step-by-step.ipynb", strip)
    fails(repo, "carries no comment line")


def test_a_data_path_that_does_not_exist_is_found(repo: Path) -> None:
    both(repo, "01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: d["metadata"]["caos"]["data"].append("data/derived/never-baked/trace.json"))
    fails(repo, "data path 'data/derived/never-baked/trace.json'")
    jedit(repo, "notebooks/en/01-getting-started/02-the-method-step-by-step.ipynb", lambda d: d["metadata"]["caos"].update(packages=["numpy==1.0.0"]))
    fails(repo, "'numpy==1.0.0' is not a pin of notebooks/requirements.txt")


def test_widgets_metadata_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: d["metadata"].update(widgets={"state": {}}))
    fails(repo, "notebook metadata beyond kernelspec, language_info and caos")
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: d["metadata"].pop("widgets"))
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: first_code(d)["metadata"].update(execution={"iopub.execute_input": "t"}))
    fails(repo, "metadata beyond tags")


def test_an_execution_count_gap_is_found(repo: Path) -> None:
    def gap(doc: dict) -> None:
        codes = [c for c in doc["cells"] if c["cell_type"] == "code"]
        codes[2]["execution_count"] = 9
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", gap)
    fails(repo, "expected 3")


def test_a_planted_traceback_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/01-getting-started/02-the-method-step-by-step.ipynb", lambda d: first_code(d)["outputs"].append(
        {"output_type": "error", "ename": "KeyError", "evalue": "x", "traceback": ["Traceback"]}))
    fails(repo, "an error output (KeyError)")
    jedit(repo, "notebooks/es/01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: first_code(d)["outputs"].append(
        {"output_type": "stream", "name": "stderr", "text": "warning\n"}))
    fails(repo, "a stderr stream")


def test_a_machine_path_and_a_token_in_an_output_are_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/02-threshold-and-final-size/01-the-threshold.ipynb", lambda d: first_code(d)["outputs"].append(
        {"output_type": "stream", "name": "stdout", "text": "C:\\Users\\someone\\Documents\\x.csv\n"}))
    fails(repo, "holds a machine path")
    jedit(repo, "notebooks/es/02-threshold-and-final-size/02-the-final-size.ipynb", lambda d: d["cells"][1].update(
        source=d["cells"][1]["source"] + ["\n", "\n", "ghp_" + "Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6"]))
    fails(repo, "holds a token pattern")


def test_an_image_above_the_limit_is_found(repo: Path) -> None:
    big = base64.b64encode(b"\x01" * 500_000).decode()
    jedit(repo, "notebooks/en/01-getting-started/02-the-method-step-by-step.ipynb", lambda d: first_code(d)["outputs"].append(
        {"output_type": "display_data", "data": {"image/png": big}, "metadata": {}}))
    fails(repo, "an image (image/png)", "byte limit")


def test_a_cell_deleted_from_the_spanish_counterpart_is_found(repo: Path) -> None:
    def drop(doc: dict) -> None:
        del doc["cells"][-1]
    jedit(repo, "notebooks/es/01-getting-started/01-the-problem-and-the-data.ipynb", drop)
    fails(repo, "not a full counterpart")


def test_a_source_missing_from_the_sdd_is_found(repo: Path) -> None:
    both(repo, "01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: d["metadata"]["caos"]["sources"].append("https://doi.org/10.1000/never-researched"))
    fails(repo, "'https://doi.org/10.1000/never-researched' is not a source the SDD lists")


def test_a_copy_of_the_engine_in_a_cell_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/01-getting-started/02-the-method-step-by-step.ipynb", lambda d: first_code(d).update(
        source=["# my own copy of the engine\n", "def simulate(p, dt=0.25):\n", "    return p"]))
    fails(repo, "defines 'simulate'", "import it instead of re-implementing it")


def test_ci_executing_the_notebooks_is_found(repo: Path) -> None:
    (repo / ".github" / "workflows" / "notebooks.yml").write_text("on: push\njobs:\n  x:\n    steps:\n      - run: python scripts/run_notebooks.py --check\n", encoding="utf-8")
    fails(repo, "notebooks.yml", "the execution is a local release gate, never CI")
    (repo / ".github" / "workflows" / "notebooks.yml").unlink()
    ci = repo / ".github" / "workflows" / "ci.yml"
    ci.write_text(ci.read_text(encoding="utf-8").replace("python scripts/check_notebooks.py", "python scripts/other.py"), encoding="utf-8")
    fails(repo, "no step runs `python scripts/check_notebooks.py`")


def test_an_unpinned_notebook_requirement_is_found(repo: Path) -> None:
    req = repo / "notebooks" / "requirements.txt"
    req.write_text(req.read_text(encoding="utf-8") + "nbconvert>=7\n", encoding="utf-8")
    fails(repo, "'nbconvert>=7' is not an exact pin")
    r = guard(repo, "check_tech_matrix.py")
    assert r.returncode == 1 and "nbconvert" in r.stdout


def test_the_runner_strips_what_was_planted_in_the_metadata() -> None:
    spec = importlib.util.spec_from_file_location("run_notebooks_under_test", ROOT / "scripts" / "run_notebooks.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    nb = {"cells": [{"cell_type": "code", "id": "a", "source": "1", "execution_count": 1, "outputs": [], "metadata": {
        "execution": {"shell.execute_reply": "2026-10-20T10:00:00"}, "scrolled": True}}],
        "metadata": {"kernelspec": {"display_name": "Python 3.13 (x)", "language": "python", "name": "python3"},
                     "language_info": {"name": "python", "version": "3.13.1"}, "caos": {}, "widgets": {}, "vscode": {"interpreter": "x"}},
        "nbformat": 4, "nbformat_minor": 5}
    clean = runner.strip_volatile(nb)
    assert set(clean["metadata"]) == {"kernelspec", "language_info", "caos"} and clean["metadata"]["language_info"] == {"name": "python"}
    assert clean["cells"][0]["metadata"] == {}


def run_release_gate(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([str(NOTEBOOK_PYTHON), str(repo / "scripts" / "run_notebooks.py"), *args], capture_output=True, encoding="utf-8",
                          errors="replace", cwd=repo, timeout=600)


@pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")
def test_a_raising_notebook_fails_the_release_gate(repo: Path) -> None:
    only = "notebooks/en/02-threshold-and-final-size/01-the-threshold.ipynb"
    assert run_release_gate(repo, "--check", "--only", only).returncode == 0
    jedit(repo, only, lambda d: first_code(d).update(source=["# this cell raises\n", "raise RuntimeError('planted')"]))
    r = run_release_gate(repo, "--check", "--only", only)
    assert r.returncode == 1 and "01-the-threshold.ipynb" in r.stdout and "RuntimeError" in r.stdout


@pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")
def test_a_missing_artifact_stops_the_run_naming_its_path(repo: Path) -> None:
    only = "notebooks/en/02-threshold-and-final-size/01-the-threshold.ipynb"
    (repo / "data" / "derived" / "manifests" / "EX02_epidemic.json").unlink()
    r = run_release_gate(repo, "--check", "--only", only)
    assert r.returncode == 1 and "EX02_epidemic.json" in r.stdout, r.stdout


# ---------------------------------------------------------------- the README by areas

def with_dirs(repo: Path) -> Path:
    for folder in FOLDERS:
        (repo / folder).mkdir(parents=True, exist_ok=True)
    readme = repo / "README.md"
    if readme.is_file():  # the documents the README rows point to exist in the real repository; here one empty file each
        for target in re.findall(r"\[[^\]]*\]\(([^)\s]+)\)", readme.read_text(encoding="utf-8")):
            rel = target.split("#")[0]
            if rel and not re.match(r"^[a-z]+:", rel) and not (repo / rel).exists():
                (repo / rel).parent.mkdir(parents=True, exist_ok=True)
                (repo / rel).write_text("x", encoding="utf-8")
    return repo


def readme_edit(repo: Path, old: str, new: str) -> None:
    path = repo / "README.md"
    text = path.read_text(encoding="utf-8")
    assert old in text, f"README.md does not contain {old!r}: the plant would change nothing"
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def test_a_readme_without_areas_is_found(repo: Path) -> None:
    readme_edit(with_dirs(repo), "## Areas", "## What is in it")
    fails(repo, "no section '## Areas'", script="check_readme_areas.py")


def test_a_dropped_area_row_is_found(repo: Path) -> None:
    text = (repo / "README.md").read_text(encoding="utf-8")
    kept = "\n".join(ln for ln in text.split("\n") if not ln.startswith("| Notebooks |"))
    (repo / "README.md").write_text(kept, encoding="utf-8")
    fails(with_dirs(repo), "the area 'Notebooks' has no row", script="check_readme_areas.py")


def test_a_row_with_no_status_is_found(repo: Path) -> None:
    readme_edit(with_dirs(repo), "| active | The committed derived artifacts", "| somewhere in between | The committed derived artifacts")
    fails(repo, "the area 'Data' has no status", script="check_readme_areas.py")
    readme_edit(repo, "dormant: this solution does not require it at the moment", "dormant")
    fails(repo, "'API' is dormant with no reason", script="check_readme_areas.py")


def test_a_dead_folder_link_is_found(repo: Path) -> None:
    with_dirs(repo)
    shutil.rmtree(repo / "deploy")
    fails(repo, "links 'deploy/', which does not exist", script="check_readme_areas.py")


def test_a_packages_row_without_pypi_is_found(repo: Path) -> None:
    readme_edit(with_dirs(repo), "[numpy 2.4.6](https://pypi.org/project/numpy/2.4.6/), [source](https://github.com/numpy/numpy)", "numpy")
    fails(repo, "links no package on PyPI", script="check_readme_areas.py")


def test_an_instantiate_that_drops_the_areas_writes_a_failing_readme(repo: Path) -> None:
    path = repo / "scripts" / "instantiate.py"
    text = path.read_text(encoding="utf-8")
    assert "*areas(a)," in text
    path.write_text(text.replace("*areas(a),", ""), encoding="utf-8")
    spec = importlib.util.spec_from_file_location("instantiate_planted", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    import argparse
    args = argparse.Namespace(slug="demo", name="Demo", repo="CAOS_Demo", deploy="pages", domain="", visibility="public",
                              tagline_en="One.", tagline_es="Una.", holder="H", year=2026, no_run=True)
    (repo / "README.md").write_text(module.readme(args), encoding="utf-8")
    fails(with_dirs(repo), "no section '## Areas'", script="check_readme_areas.py")


def test_the_example_notebooks_left_in_a_product_are_listed(repo: Path, tmp_path: Path) -> None:
    product = tmp_path / "product"
    shutil.copytree(repo / "notebooks", product / "notebooks")
    shutil.copytree(repo / "scripts", product / "scripts")
    for n in range(12):
        (product / "src").mkdir(exist_ok=True)
        (product / "src" / f"m{n}.py").write_text("x = 1\n", encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=product, check=True)
    r = subprocess.run([sys.executable, str(product / "scripts" / "check_template_residue.py"), str(product)], capture_output=True, text=True, cwd=product)
    assert r.returncode == 1 and "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb" in r.stdout, r.stdout


# ---------------------------------------------------------------- the review fixes (F3, F4, F5, F6, F9)

def test_a_notebook_that_runs_pip_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb", lambda d: first_code(d).update(
        source="# install here\n%pip install numpy==2.4.6"))
    fails(repo, "a notebook never runs pip itself (convention section 4)")


def test_a_drive_path_written_as_a_python_literal_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/es/02-threshold-and-final-size/01-the-threshold.ipynb", lambda d: first_code(d).update(
        source="# a literal\nroot = 'D:\\\\_Datos\\\\sir'"))
    fails(repo, "holds a machine path")


def test_a_package_installed_from_its_release_tag_is_held_to_its_exact_form(repo: Path) -> None:
    req = repo / "notebooks" / "requirements.txt"
    saved = req.read_text(encoding="utf-8")
    good = "riskvalidation @ git+https://github.com/fsantibanezleal/CAOS_RiskValidation.git@v0.8.0"
    req.write_text(saved + good + "\n", encoding="utf-8")
    r = guard(repo, "check_notebooks.py")
    assert r.returncode == 0, r.stdout  # the form is accepted as a requirement line (no notebook uses it yet)
    req.write_text(saved + "riskvalidation @ git+https://github.com/fsantibanezleal/CAOS_RiskValidation.git@main\n", encoding="utf-8")
    fails(repo, "is not an exact pin")


def test_a_notebook_outside_the_layout_is_found_and_not_run(repo: Path) -> None:
    src = repo / "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb"
    shutil.copy2(src, repo / "notebooks/en/99-loose.ipynb")
    fails(repo, "notebooks/en/99-loose.ipynb", "notebooks/<language>/<topic>/<notebook>.ipynb")


def test_an_ipynb_with_an_em_dash_or_an_emoji_is_found_by_the_content_standards(tmp_path: Path) -> None:
    """F4: the guard read .md and .json but skipped .ipynb, where the runner writes raw characters."""
    repo = tmp_path / "r"
    (repo / "scripts").mkdir(parents=True)
    (repo / "notebooks" / "en" / "01-x").mkdir(parents=True)
    shutil.copy2(ROOT / "scripts" / "check_content_standards.py", repo / "scripts" / "check_content_standards.py")
    nb = repo / "notebooks" / "en" / "01-x" / "01-y.ipynb"
    nb.write_text(json.dumps({"cells": [{"cell_type": "markdown", "metadata": {}, "source": ["# A title \u2014 with a dash \U0001F600\n"]}],
                              "metadata": {}, "nbformat": 4, "nbformat_minor": 5}, ensure_ascii=False), encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
    r = subprocess.run([sys.executable, "-X", "utf8", "scripts/check_content_standards.py"], capture_output=True, encoding="utf-8", errors="replace", cwd=repo)
    assert r.returncode == 1 and "01-y.ipynb" in r.stdout and "em-dash" in r.stdout and "emoji" in r.stdout, r.stdout + r.stderr


def test_a_printed_traceback_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/02-threshold-and-final-size/02-the-final-size.ipynb", lambda d: first_code(d)["outputs"].append(
        {"output_type": "stream", "name": "stdout", "text": "Traceback (most recent call last):\n  File \"x.py\", line 1\nKeyError: 'a'\n"}))
    fails(repo, "prints a traceback")


def test_a_source_missing_from_the_references_and_a_missing_install_line_are_found(repo: Path) -> None:
    rel = "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb"

    def drop_references(doc: dict) -> None:
        cell = next(c for c in doc["cells"] if "".join(c["source"]).startswith("## References"))
        cell["source"] = ["## References\n", "\n", "- A work cited without its link.\n"]
    jedit(repo, rel, drop_references)
    fails(repo, "the References section does not list")

    def drop_install(doc: dict) -> None:
        cell = next(c for c in doc["cells"] if "".join(c["source"]).startswith("## Setup"))
        cell["source"] = ["## Setup\n", "\n", "numpy==2.4.6 and matplotlib==3.11.2 are installed somehow.\n"]
    jedit(repo, rel, drop_install)
    fails(repo, "shows no `pip install` line")


def test_a_notebook_that_defines_the_final_size_oracle_is_found(repo: Path) -> None:
    jedit(repo, "notebooks/en/02-threshold-and-final-size/02-the-final-size.ipynb", lambda d: first_code(d).update(
        source=["# a private copy of the oracle\n", "def final_size(r0):\n", "    return r0\n"]))
    fails(repo, "defines 'final_size'", "import it instead")


def test_the_runner_coalesces_split_streams() -> None:
    spec = importlib.util.spec_from_file_location("run_notebooks_coalesce", ROOT / "scripts" / "run_notebooks.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    nb = {"cells": [{"cell_type": "code", "id": "a", "source": "1", "execution_count": 1, "metadata": {}, "outputs": [
        {"output_type": "stream", "name": "stdout", "text": ["R0 = ", "beta / gamma ="]},
        {"output_type": "stream", "name": "stdout", "text": " 2.75\n"}]}], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}
    outputs = runner.strip_volatile(nb)["cells"][0]["outputs"]
    assert len(outputs) == 1 and outputs[0]["text"] == ["R0 = beta / gamma = 2.75\n"]


@pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")
def test_a_hand_edited_output_fails_the_release_gate(repo: Path) -> None:
    only = "notebooks/en/02-threshold-and-final-size/01-the-threshold.ipynb"
    path = repo / only
    text = path.read_text(encoding="utf-8")
    path.write_text(text.replace("herd threshold: 0.636", "herd threshold: 0.999", 1), encoding="utf-8")
    assert path.read_text(encoding="utf-8") != text, "the plant must change an output"
    r = run_release_gate(repo, "--check", "--only", only)
    assert r.returncode == 1 and "stale" in r.stdout and "01-the-threshold.ipynb" in r.stdout, r.stdout


@pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")
def test_a_loose_notebook_stops_the_release_gate(repo: Path) -> None:
    shutil.copy2(repo / "notebooks/en/02-threshold-and-final-size/01-the-threshold.ipynb", repo / "notebooks/en/99-loose.ipynb")
    r = run_release_gate(repo, "--check")
    assert r.returncode == 1 and "99-loose.ipynb" in r.stdout and "ran   " not in r.stdout, r.stdout


def readme_areas(repo: Path) -> tuple[str, str, str]:
    text = (repo / "README.md").read_text(encoding="utf-8")
    start = text.index("## Areas")
    end = text.index("\n## ", start + 5)
    return text[:start], text[start:end], text[end:]


def test_the_areas_section_before_the_purpose_is_found(repo: Path) -> None:
    pre, areas, rest = readme_areas(repo)
    title, _, body = pre.partition("\n")
    (repo / "README.md").write_text(f"{title}\n\n{areas}\n{body}{rest}", encoding="utf-8")
    fails(with_dirs(repo), "comes after the purpose and the live URLs", script="check_readme_areas.py")


def test_a_row_that_holds_a_dash_is_found(repo: Path) -> None:
    pre, areas, rest = readme_areas(repo)
    rows = [ln for ln in areas.splitlines() if ln.startswith("| Data |")]
    assert rows
    cells = rows[0].split("|")
    cells[4] = " - "
    (repo / "README.md").write_text(pre + areas.replace(rows[0], "|".join(cells)) + rest, encoding="utf-8")
    fails(with_dirs(repo), "'Data'", "'What it holds'", script="check_readme_areas.py")


def test_a_dead_document_link_in_a_row_is_found(repo: Path) -> None:
    readme_edit(with_dirs(repo), "[guide 08](docs/guides/08_notebooks.md)", "[guide 08](docs/guides/08_absent.md)")
    fails(repo, "links 'docs/guides/08_absent.md', which does not exist", script="check_readme_areas.py")


def test_a_wrong_final_size_oracle_fails_the_relation(repo: Path) -> None:
    """NB-037: the relation the oracle must solve is the check; an oracle with a perturbed exponent breaks it."""
    path = repo / "data-pipeline" / "pipeline" / "oracles.py"
    text = path.read_text(encoding="utf-8")
    assert "math.exp(-r0 * z)" in text
    path.write_text(text.replace("math.exp(-r0 * z)", "math.exp(-0.9 * r0 * z)"), encoding="utf-8")
    spec = importlib.util.spec_from_file_location("oracles_planted", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    z = module.final_size(2.75)
    import math
    assert abs(z - (1.0 - math.exp(-2.75 * z))) > 1e-3, "the planted oracle must violate z = 1 - exp(-R0 z)"


@pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")
def test_a_convergence_cell_that_loses_its_case_is_stale(repo: Path) -> None:
    """NB-040, local-only: the figure says EX02_epidemic, so a cell that runs the last loop case writes other numbers and the
    release gate finds the committed outputs stale."""
    only = "notebooks/en/01-getting-started/02-the-method-step-by-step.ipynb"

    def lose_case(doc: dict) -> None:
        cell = next(c for c in doc["cells"] if c["cell_type"] == "code" and "steps = [1.0, 0.5" in "".join(c["source"]))
        cell["source"] = [ln for ln in cell["source"] if "params_of(\"EX02_epidemic\")" not in ln]
        assert not any("EX02_epidemic\")" in ln for ln in cell["source"])
    assert run_release_gate(repo, "--check", "--only", only).returncode == 0
    jedit(repo, only, lose_case)
    r = run_release_gate(repo, "--check", "--only", only)
    assert r.returncode == 1 and "stale" in r.stdout, r.stdout
