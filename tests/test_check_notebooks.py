"""The notebooks gate (scripts/check_notebooks.py) and the runner (scripts/run_notebooks.py): one plant per rule, built in a
temporary repository, plus a control (the clean repository passes) and the committed example set.

The plants are the failure each rule exists for. The static check is standard library only, so these tests run wherever
pytest does; the three runner tests that execute a notebook need ``.venv-notebooks`` (``scripts/setup.sh --notebooks``) and
skip without it."""
from __future__ import annotations

import base64
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PYTHON = next((p for p in (ROOT / ".venv-notebooks" / "Scripts" / "python.exe", ROOT / ".venv-notebooks" / "bin" / "python") if p.is_file()), None)


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHECK = load("check_notebooks")
RUNNER = load("run_notebooks")

HEADINGS = {
    "en": ["Objectives", "Setup", "Data", "Method", "State of the art", "Beyond the state of the art", "Results", "Summary", "References"],
    "es": ["Objetivos", "Preparación", "Datos", "Método", "Estado del arte", "Más allá del estado del arte", "Resultados", "Resumen", "Referencias"],
}
LOW = [1, 1, 1, 1, 3, 4, 1, 1, 1]
NO_L3 = {"en": "No level 3:", "es": "Sin nivel 3:"}
PIN = "numpy==2.4.6"
DATA = "data/derived/x.json"
SOURCE = "https://doi.org/10.1098/rspa.1927.0118"


def write_json(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def make_notebook(lang: str, topic: str, level: int, beyond: tuple[str, ...] = ()) -> dict:
    cells: list[dict] = []
    count = [0]

    def md(text: str) -> None:
        cells.append({"cell_type": "markdown", "id": f"c{len(cells):02d}", "metadata": {}, "source": text})

    def code(text: str) -> None:
        count[0] += 1
        cells.append({"cell_type": "code", "id": f"c{len(cells):02d}", "metadata": {}, "source": text,
                      "execution_count": count[0], "outputs": [{"output_type": "stream", "name": "stdout", "text": "ok\n"}]})

    md(f"# Title\n\n- Level: {level}\n- Prerequisites: none\n- Reading time: 10 minutes")
    for heading, low in zip(HEADINGS[lang], LOW):
        if level < low or (low == 4 and level != 4):
            continue
        if heading in ("Setup", "Preparación"):
            md(f"## {heading}\n\nWhat the next cell does, and why. Install with `pip install {PIN}`.")
        elif heading in ("References", "Referencias"):
            md(f"## {heading}\n\n- Kermack and McKendrick (1927). {SOURCE}")
        else:
            md(f"## {heading}\n\nText.")
        if heading in ("Setup", "Preparación", "Method", "Método"):
            versions = "# print the version of a package\nimport importlib.metadata as md\nprint(md.version('numpy'))"
            code(versions if heading in ("Setup", "Preparación") else "# print a number\nprint(1)")
    return {"cells": cells, "nbformat": 4, "nbformat_minor": 5, "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"},
        "caos": {"language": lang, "topic": topic, "level": level, "title": f"{topic} {level}", "packages": [PIN], "data": [DATA],
                 "sources": [SOURCE], "beyond": list(beyond)}}}


TOPICS = {"01-basics": [1, 2], "02-advanced": [1, 2, 3]}


def make_repo(root: Path, claims: tuple[str, ...] = (), level4: tuple[str, ...] = ()) -> Path:
    """A small valid repository: two topics (the first has no level 3 and says why), the SDD section, the CI steps and the data."""
    (root / "notebooks").mkdir(parents=True)
    (root / "notebooks" / "README.md").write_text("# Notebooks\n", encoding="utf-8")
    (root / "notebooks" / "requirements.txt").write_text(f"# pins\n{PIN}\n", encoding="utf-8")
    (root / "data" / "derived").mkdir(parents=True)
    (root / DATA).write_text("{}", encoding="utf-8")
    (root / "docs" / "design").mkdir(parents=True)
    section = "\n".join(f"- {c}: evidence, source" for c in claims) if claims else "None claimed."
    (root / "docs" / "design" / "SDD.md").write_text(f"# SDD\n\n## Research basis\n\nKermack and McKendrick 1927, https://doi.org/10.1098/rspa.1927.0118\n\n## Oracles\n\ntext\n\n## Beyond the state of the art\n\n{section}\n\n## Deploy driver\n\ntext\n", encoding="utf-8")
    (root / ".github" / "workflows").mkdir(parents=True)
    (root / ".github" / "workflows" / "ci.yml").write_text(
        "steps:\n  - run: python scripts/check_notebooks.py\n  - run: python scripts/check_readme_areas.py\n", encoding="utf-8")
    for lang in ("en", "es"):
        index = [f"# index {lang}", "", "| Topic | Level 3 |", "|---|---|"]
        for topic, levels in TOPICS.items():
            index.append(f"| {topic} | " + (NO_L3[lang] + " the topic has no state of the art to compare" if 3 not in levels else "yes") + " |")
        for topic, levels in TOPICS.items():
            for n, level in enumerate(levels, 1):
                name = f"{n:02d}-note.ipynb"
                index.append(f"- {topic}/{name}")
                write_json(root / "notebooks" / lang / topic / name, make_notebook(lang, topic, level))
        if level4:
            write_json(root / "notebooks" / lang / "02-advanced" / "04-beyond.ipynb", make_notebook(lang, "02-advanced", 4, level4))
            index.append("- 02-advanced/04-beyond.ipynb")
        (root / "notebooks" / lang / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    return root


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    return make_repo(tmp_path / "repo")


def edit(root: Path, lang: str, rel: str, change) -> None:
    path = root / "notebooks" / lang / rel
    doc = json.loads(path.read_text(encoding="utf-8"))
    change(doc)
    write_json(path, doc)


def found(root: Path, *needles: str) -> bool:
    """True when one finding holds every needle (a file and the rule or its words)."""
    return any(all(n in f for n in needles) for f in CHECK.findings_of(root))


def test_a_clean_repository_passes(repo: Path) -> None:
    assert CHECK.findings_of(repo) == []


def test_missing_layout_files_are_found(repo: Path) -> None:
    for rel in ("README.md", "requirements.txt", "en/README.md", "es/README.md"):
        saved = (repo / "notebooks" / rel).read_bytes()
        (repo / "notebooks" / rel).unlink()
        assert found(repo, f"notebooks/{rel}", "layout"), rel
        (repo / "notebooks" / rel).write_bytes(saved)
    (repo / "notebooks" / "en" / "01-basics" / "notes.txt").write_text("x", encoding="utf-8")
    assert found(repo, "notes.txt", "only notebooks live in a topic folder")


def test_a_path_missing_from_one_tree_is_found(repo: Path) -> None:
    (repo / "notebooks" / "es" / "02-advanced" / "03-note.ipynb").unlink()
    assert found(repo, "notebooks/es/02-advanced/03-note.ipynb", "mirror")
    (repo / "notebooks" / "en" / "01-basics" / "01-note.ipynb").unlink()
    assert found(repo, "notebooks/en/01-basics/01-note.ipynb", "mirror")


def test_numbering_gap_is_found(repo: Path) -> None:
    for lang in ("en", "es"):
        (repo / "notebooks" / lang / "02-advanced" / "03-note.ipynb").rename(repo / "notebooks" / lang / "02-advanced" / "05-note.ipynb")
    assert found(repo, "02-advanced", "numbering", "no gap or repeat")
    (repo / "notebooks" / "en" / "01-basics").rename(repo / "notebooks" / "en" / "1-basics")
    assert found(repo, "numbering", "'1-basics' is not NN-slug")


def test_a_decreasing_level_is_found(repo: Path) -> None:
    for lang in ("en", "es"):
        edit(repo, lang, "02-advanced/03-note.ipynb", lambda d: d["metadata"]["caos"].update(level=1))
    assert found(repo, "notebooks/en/02-advanced", "levels", "decreases")


def test_a_topic_without_level_two_is_found(repo: Path) -> None:
    edit(repo, "en", "01-basics/02-note.ipynb", lambda d: d["metadata"]["caos"].update(level=1))
    assert found(repo, "notebooks/en/01-basics", "no level 2 notebook")


def test_a_topic_without_level_three_needs_a_reason(repo: Path) -> None:
    index = repo / "notebooks" / "en" / "README.md"
    index.write_text(index.read_text(encoding="utf-8").replace(" the topic has no state of the art to compare", ""), encoding="utf-8")
    assert found(repo, "notebooks/en/README.md", "01-basics", "no level 3", "reason")
    index = repo / "notebooks" / "es" / "README.md"
    index.write_text(index.read_text(encoding="utf-8").replace("Sin nivel 3:", "Sin nivel tres:"), encoding="utf-8")
    assert found(repo, "notebooks/es/README.md", "01-basics", "no level 3")


def test_an_unlisted_notebook_is_found(repo: Path) -> None:
    index = repo / "notebooks" / "es" / "README.md"
    index.write_text(index.read_text(encoding="utf-8").replace("- 02-advanced/03-note.ipynb\n", ""), encoding="utf-8")
    assert found(repo, "notebooks/es/README.md", "03-note.ipynb", "is not listed")


def test_an_uncovered_claim_is_found(tmp_path: Path) -> None:
    root = make_repo(tmp_path / "a", claims=("BS-1", "BS-2"), level4=("BS-1",))
    assert found(root, "notebooks/en", "BS-2", "covered by no level 4 notebook")
    assert found(root, "notebooks/es", "BS-2", "covered by no level 4 notebook")
    assert not found(root, "BS-1", "covered by no level 4")
    unknown = make_repo(tmp_path / "b", claims=("BS-1",), level4=("BS-1", "BS-9"))
    assert found(unknown, "BS-9", "is not a claim of the SDD")
    sdd = unknown / "docs" / "design" / "SDD.md"
    sdd.write_text(sdd.read_text(encoding="utf-8").replace("## Beyond the state of the art", "## Something else"), encoding="utf-8")
    assert found(unknown, "docs/design/SDD.md", "no section")


def test_a_missing_and_a_misordered_section_are_found(repo: Path) -> None:
    def drop_results(doc: dict) -> None:
        doc["cells"] = [c for c in doc["cells"] if not c["source"].startswith("## Results")]
    edit(repo, "en", "01-basics/01-note.ipynb", drop_results)
    assert found(repo, "01-basics/01-note.ipynb", "anatomy", "'## Results' is missing")

    def swap(doc: dict) -> None:
        a = next(i for i, c in enumerate(doc["cells"]) if c["source"].startswith("## Data"))
        b = next(i for i, c in enumerate(doc["cells"]) if c["source"].startswith("## Summary"))
        doc["cells"][a], doc["cells"][b] = doc["cells"][b], doc["cells"][a]
    edit(repo, "en", "01-basics/02-note.ipynb", swap)
    assert found(repo, "01-basics/02-note.ipynb", "sections out of order")
    # a Spanish heading in the English tree is not a section of the anatomy
    edit(repo, "en", "02-advanced/01-note.ipynb", lambda d: d["cells"][1].update(source="## Objetivos\n\nText."))
    assert found(repo, "02-advanced/01-note.ipynb", "'## Objetivos' is not a section of the anatomy")


def test_a_first_cell_that_is_code_is_found(repo: Path) -> None:
    def first_code(doc: dict) -> None:
        doc["cells"][0] = {"cell_type": "code", "id": "c00", "metadata": {}, "source": "# x\n1", "execution_count": 1, "outputs": []}
        for n, c in enumerate((c for c in doc["cells"] if c["cell_type"] == "code"), 1):
            c["execution_count"] = n
    edit(repo, "en", "01-basics/01-note.ipynb", first_code)
    assert found(repo, "01-basics/01-note.ipynb", "the first cell is not a markdown cell")


def test_a_code_cell_without_comment_or_explanation_is_found(repo: Path) -> None:
    def uncomment(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["source"] = "print(1)  \nx = '# not a comment'"
    edit(repo, "en", "01-basics/01-note.ipynb", uncomment)
    assert found(repo, "01-basics/01-note.ipynb", "carries no comment line")

    def adjacent(doc: dict) -> None:
        i = next(i for i, c in enumerate(doc["cells"]) if c["cell_type"] == "code")
        doc["cells"].insert(i + 1, {"cell_type": "code", "id": "cx", "metadata": {}, "source": "# two in a row\n1", "execution_count": 2, "outputs": []})
        for n, c in enumerate((c for c in doc["cells"] if c["cell_type"] == "code"), 1):
            c["execution_count"] = n
    edit(repo, "es", "01-basics/02-note.ipynb", adjacent)
    assert found(repo, "es/01-basics/02-note.ipynb", "is not preceded by a markdown cell")


def test_the_caos_block_must_agree_with_the_repository(repo: Path) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: d["metadata"]["caos"].update(language="es"))
    assert found(repo, "en/01-basics/01-note.ipynb", "caos.language is 'es'")
    edit(repo, "en", "01-basics/02-note.ipynb", lambda d: d["metadata"]["caos"].update(topic="02-advanced"))
    assert found(repo, "en/01-basics/02-note.ipynb", "caos.topic is '02-advanced'")
    edit(repo, "en", "02-advanced/01-note.ipynb", lambda d: d["metadata"]["caos"].update(packages=["numpy==9.9.9"]))
    assert found(repo, "02-advanced/01-note.ipynb", "numpy==9.9.9", "is not a pin of notebooks/requirements.txt")
    edit(repo, "en", "02-advanced/02-note.ipynb", lambda d: d["metadata"]["caos"].update(data=["data/derived/absent.json"]))
    assert found(repo, "02-advanced/02-note.ipynb", "data path 'data/derived/absent.json'")
    edit(repo, "en", "02-advanced/03-note.ipynb", lambda d: d["metadata"].pop("caos"))
    assert found(repo, "02-advanced/03-note.ipynb", "the caos block is missing")
    # a pin of the requirements file that the text never writes
    edit(repo, "es", "01-basics/01-note.ipynb", lambda d: d["cells"].__setitem__(2, {**d["cells"][2], "source": "## Preparación\n\nInstale."}))
    assert found(repo, "es/01-basics/01-note.ipynb", "is not written in the notebook's text")


def test_extra_metadata_is_found(repo: Path) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: d["metadata"].update(widgets={"state": {}}))
    assert found(repo, "01-basics/01-note.ipynb", "notebook metadata beyond kernelspec, language_info and caos")
    edit(repo, "en", "01-basics/02-note.ipynb", lambda d: d["cells"][1]["metadata"].update(collapsed=True))
    assert found(repo, "01-basics/02-note.ipynb", "cell 2 metadata beyond tags")
    edit(repo, "en", "02-advanced/01-note.ipynb", lambda d: d["cells"][1]["metadata"].update(tags=["note"]))
    assert not found(repo, "02-advanced/01-note.ipynb", "metadata beyond")


def test_execution_counts_must_run_in_order(repo: Path) -> None:
    def skip(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["execution_count"] = 3
    edit(repo, "en", "01-basics/01-note.ipynb", skip)
    assert found(repo, "01-basics/01-note.ipynb", "execution", "expected 1")
    edit(repo, "en", "01-basics/02-note.ipynb", lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(execution_count=None))
    assert found(repo, "01-basics/02-note.ipynb", "execution_count None")


def test_an_error_output_and_a_stderr_stream_are_found(repo: Path) -> None:
    def err(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"] = [
            {"output_type": "error", "ename": "ValueError", "evalue": "x", "traceback": ["boom"]}]
    edit(repo, "en", "01-basics/01-note.ipynb", err)
    assert found(repo, "01-basics/01-note.ipynb", "an error output (ValueError)")

    def stderr(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"] = [{"output_type": "stream", "name": "stderr", "text": "warn\n"}]
    edit(repo, "es", "01-basics/02-note.ipynb", stderr)
    assert found(repo, "es/01-basics/02-note.ipynb", "a stderr stream")


@pytest.mark.parametrize("text", ["C:\\Users\\someone\\data.csv", "D:" + "/_Repos/x", "/home/someone/x", "/Users/someone/x", "\\Users\\x",
                                  "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4", "-----BEGIN RSA PRIVATE KEY-----", "api_key = 'abcdef123456'"])
def test_a_machine_path_and_a_token_are_found(repo: Path, text: str) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: d["cells"][1].update(source=d["cells"][1]["source"] + f"\n\n{text}"))
    kind = "secret" if any(t in text for t in ("ghp_", "KEY", "api_key")) else "path"
    assert found(repo, "01-basics/01-note.ipynb", f": {kind}:")

    # the same text in an output is found too
    def out(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"] = [{"output_type": "stream", "name": "stdout", "text": text + "\n"}]
    edit(repo, "en", "01-basics/02-note.ipynb", out)
    assert found(repo, "01-basics/02-note.ipynb", f": {kind}:")


def test_urls_and_plain_prose_are_not_machine_paths(repo: Path) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: d["cells"][1].update(source="## Objectives\n\nSee https://doi.org/10.1/x and the note: /relative/path, e.g. a:b."))
    assert CHECK.findings_of(repo) == []


def test_oversize_notebook_and_image_are_found(repo: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    png = base64.b64encode(b"\x00" * (CHECK.MAX_IMAGE_BYTES + 100)).decode()

    def image(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"] = [
            {"output_type": "display_data", "data": {"image/png": png}, "metadata": {}}]
    edit(repo, "en", "01-basics/01-note.ipynb", image)
    assert found(repo, "01-basics/01-note.ipynb", "an image (image/png)", "limit")
    monkeypatch.setattr(CHECK, "MAX_NOTEBOOK_BYTES", 500)
    assert found(repo, "02-advanced/01-note.ipynb", "size", "byte limit of a notebook")


def test_a_spanish_notebook_that_is_not_a_counterpart_is_found(repo: Path) -> None:
    def drop(doc: dict) -> None:
        doc["cells"] = [c for c in doc["cells"] if c["cell_type"] != "code"][:]
    edit(repo, "es", "01-basics/01-note.ipynb", drop)
    assert found(repo, "es/01-basics/01-note.ipynb", "mirror", "not a full counterpart")
    edit(repo, "es", "01-basics/02-note.ipynb", lambda d: d["metadata"]["caos"].update(data=[]))
    assert found(repo, "es/01-basics/02-note.ipynb", "mirror", "caos.data differs")


def test_a_source_the_sdd_does_not_list_is_found(repo: Path) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: d["metadata"]["caos"].update(sources=["https://doi.org/10.1000/not-in-the-sdd"]))
    assert found(repo, "en/01-basics/01-note.ipynb", "is not a source the SDD lists")
    # a DOI written in another form is the same source
    sdd = repo / "docs" / "design" / "SDD.md"
    sdd.write_text(sdd.read_text(encoding="utf-8") + "\nAlso doi:10.1000/NOT-IN-THE-SDD.\n", encoding="utf-8")
    assert not found(repo, "en/01-basics/01-note.ipynb", "is not a source the SDD lists")
    edit(repo, "en", "01-basics/02-note.ipynb", lambda d: d["metadata"]["caos"].update(sources=[]))
    assert found(repo, "en/01-basics/02-note.ipynb", "caos.sources is not a non-empty list")


def test_a_notebook_that_redefines_the_engine_is_found(repo: Path) -> None:
    model = repo / "data-pipeline" / "pipeline" / "model"
    model.mkdir(parents=True)
    (model / "sir.py").write_text("def simulate(p):\n    return p\n\n\ndef _private():\n    pass\n", encoding="utf-8")

    def copy(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["source"] = "# a copy of the engine\ndef simulate(p):\n    return p"
    edit(repo, "en", "01-basics/01-note.ipynb", copy)
    assert found(repo, "01-basics/01-note.ipynb", "defines 'simulate'", "import it instead")
    # a helper of the notebook's own and an import are fine
    edit(repo, "en", "01-basics/02-note.ipynb", lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(
        source="# a reader of the artifacts\nfrom pipeline.model.sir import simulate\n\n\ndef read_artifact(x):\n    return x"))
    assert not found(repo, "01-basics/02-note.ipynb", "engine")


def test_ci_must_run_the_static_checks_and_never_the_notebooks(repo: Path) -> None:
    ci = repo / ".github" / "workflows" / "ci.yml"
    ci.write_text("steps:\n  - run: python scripts/check_notebooks.py\n", encoding="utf-8")
    assert found(repo, "ci.yml", "check_readme_areas.py")
    ci.write_text("steps:\n  - run: python scripts/check_readme_areas.py\n", encoding="utf-8")
    assert found(repo, "ci.yml", "check_notebooks.py")
    ci.unlink()
    assert found(repo, "ci.yml", "the workflow is missing")
    ci.write_text("steps:\n  - run: python scripts/check_notebooks.py\n  - run: python scripts/check_readme_areas.py\n", encoding="utf-8")
    (repo / ".github" / "workflows" / "nightly.yml").write_text("steps:\n  - run: python scripts/run_notebooks.py\n", encoding="utf-8")
    assert found(repo, "nightly.yml", "runs the notebooks", "local release gate")


def test_notebook_pins_are_exact_and_in_the_sdd_table(tmp_path: Path) -> None:
    """notebooks/requirements.txt is read by the technology-matrix guard: an unpinned line, or a pin the SDD does not hold, fails."""
    sandbox = tmp_path / "t"
    for rel in ("scripts/check_tech_matrix.py", "docs/design/SDD.md", "requirements-precompute.txt", "requirements-dev.txt", "data-pipeline/requirements.txt",
                "notebooks/requirements.txt", "frontend/package.json", "frontend/package-lock.json", "requirements-gpu.txt", "requirements-api.txt", "pyproject.toml"):
        if (ROOT / rel).is_file():
            (sandbox / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / rel, sandbox / rel)

    def tech() -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(sandbox / "scripts" / "check_tech_matrix.py"), str(sandbox)], capture_output=True, text=True, cwd=sandbox)
    assert tech().returncode == 0, tech().stdout
    req = sandbox / "notebooks" / "requirements.txt"
    saved = req.read_text(encoding="utf-8")
    req.write_text(saved + "nbclient>=0.1\n", encoding="utf-8")
    assert tech().returncode == 1 and "nbclient" in tech().stdout
    req.write_text(saved.replace("matplotlib==3.11.2", "matplotlib==3.11.1"), encoding="utf-8")
    assert tech().returncode == 1 and "matplotlib" in tech().stdout
    req.write_text(saved, encoding="utf-8")
    assert CHECK.unpinned_lines(sandbox) == []
    req.write_text(saved + "nbclient>=0.1\n", encoding="utf-8")
    assert CHECK.unpinned_lines(sandbox) == ["nbclient>=0.1"]


# ---------------------------------------------------------------- the runner

def test_the_runner_strips_volatile_metadata() -> None:
    nb = {"cells": [{"cell_type": "code", "id": "a", "source": "1", "execution_count": 1, "outputs": [], "metadata": {
        "execution": {"iopub.execute_input": "2026-10-20T10:00:00"}, "tags": ["keep"], "collapsed": True}},
        {"cell_type": "markdown", "id": "b", "source": "x", "metadata": {"scrolled": True}}],
        "metadata": {"kernelspec": {"display_name": "Python 3.13.1 (venv)", "language": "python", "name": "python3"},
                     "language_info": {"name": "python", "version": "3.13.1", "file_extension": ".py"}, "caos": {"level": 1},
                     "widgets": {"state": {}}, "papermill": {"duration": 1.0}},
        "nbformat": 4, "nbformat_minor": 5}
    clean = RUNNER.strip_volatile(nb)
    assert clean["metadata"] == {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                                 "language_info": {"name": "python"}, "caos": {"level": 1}}
    assert clean["cells"][0]["metadata"] == {"tags": ["keep"]} and clean["cells"][1]["metadata"] == {}
    assert nb["metadata"]["widgets"] == {"state": {}}  # the input is not mutated


def runner_repo(tmp_path: Path, body: str) -> tuple[Path, Path]:
    """A temporary repository holding the runner and one notebook whose code cell is ``body``."""
    base = make_repo(tmp_path / "r")
    (base / "scripts").mkdir()
    shutil.copy2(ROOT / "scripts" / "run_notebooks.py", base / "scripts" / "run_notebooks.py")
    (base / "VERSION").write_text("0.0.0\n", encoding="utf-8")
    path = base / "notebooks" / "en" / "01-basics" / "01-note.ipynb"
    doc = json.loads(path.read_text(encoding="utf-8"))
    code = next(c for c in doc["cells"] if c["cell_type"] == "code")
    code["source"], code["outputs"], code["execution_count"] = body, [], None
    write_json(path, doc)
    return base, path


def run_runner(base: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([str(NOTEBOOK_PYTHON), str(base / "scripts" / "run_notebooks.py"), *args], capture_output=True, encoding="utf-8",
                          errors="replace", cwd=base, timeout=300)


needs_env = pytest.mark.skipif(NOTEBOOK_PYTHON is None, reason="the notebook environment is not built (scripts/setup.sh --notebooks)")


@needs_env
def test_the_runner_executes_in_place_and_check_writes_nothing(tmp_path: Path) -> None:
    base, path = runner_repo(tmp_path, "# a first cell\nprint(6 * 7)")
    before = path.read_bytes()
    checked = run_runner(base, "--check", "--only", "notebooks/en/01-basics/01-note.ipynb")
    assert checked.returncode == 1 and "stale" in checked.stdout, "a notebook never run has no fresh outputs: " + checked.stdout
    assert path.read_bytes() == before, "--check must write nothing"
    ran = run_runner(base, "--only", "notebooks/en/01-basics/01-note.ipynb")
    assert ran.returncode == 0, ran.stdout + ran.stderr
    assert path.read_bytes() != before
    doc = json.loads(path.read_text(encoding="utf-8"))
    code = [c for c in doc["cells"] if c["cell_type"] == "code"]
    assert [c["execution_count"] for c in code] == list(range(1, len(code) + 1))
    assert "".join(code[0]["outputs"][0]["text"]) == "42\n"
    assert doc["metadata"]["language_info"] == {"name": "python"} and all(set(c["metadata"]) <= {"tags"} for c in doc["cells"])
    assert run_runner(base, "--check", "--only", "notebooks/en/01-basics/01-note.ipynb").returncode == 0


@needs_env
def test_the_runner_fails_a_raising_notebook_naming_it(tmp_path: Path) -> None:
    base, path = runner_repo(tmp_path, "# this cell raises\nraise RuntimeError('boom')")
    before = path.read_bytes()
    r = run_runner(base, "--check", "--only", "notebooks/en/01-basics/01-note.ipynb")
    assert r.returncode == 1 and "FAIL" in r.stdout and "01-note.ipynb" in r.stdout and "RuntimeError" in r.stdout, r.stdout
    r = run_runner(base, "--only", "notebooks/en/01-basics/01-note.ipynb")
    assert r.returncode == 1 and path.read_bytes() == before, "a failed run must not rewrite the notebook"


@needs_env
def test_the_runner_fails_a_missing_artifact_naming_its_path(tmp_path: Path) -> None:
    base, _ = runner_repo(tmp_path, "# read an artifact that is not there\nfrom pathlib import Path\nPath('../../../data/derived/absent-artifact.json').read_text()")
    r = run_runner(base, "--check", "--only", "notebooks/en/01-basics/01-note.ipynb")
    assert r.returncode == 1 and "absent-artifact.json" in r.stdout, r.stdout


# ---------------------------------------------------------------- the committed example set

def test_the_committed_set_passes_the_static_check() -> None:
    assert CHECK.findings_of(ROOT) == []


def test_the_committed_set_covers_both_languages_and_a_level_three() -> None:
    trees = {lang: sorted(p.relative_to(ROOT / "notebooks" / lang).as_posix() for p in (ROOT / "notebooks" / lang).rglob("*.ipynb")) for lang in ("en", "es")}
    assert trees["en"] == trees["es"] and len(trees["en"]) >= 5
    levels = {json.loads((ROOT / "notebooks" / "en" / rel).read_text(encoding="utf-8"))["metadata"]["caos"]["level"] for rel in trees["en"]}
    assert levels == {1, 2, 3}


def test_the_example_notebooks_import_the_engine_and_never_redefine_it() -> None:
    engine = CHECK.engine_names(ROOT)
    assert "simulate" in engine
    for path in (ROOT / "notebooks").rglob("*.ipynb"):
        doc = json.loads(path.read_text(encoding="utf-8"))
        code = "\n".join(CHECK.text_of(c["source"]) for c in doc["cells"] if c["cell_type"] == "code")
        assert "from pipeline.model.sir import simulate" in code, path.name
        assert not (CHECK.defined_names(code) & engine), path.name


def test_the_residue_guard_lists_the_example_notebooks(tmp_path: Path) -> None:
    """An instantiated product (no sentinel) sees the example notebooks as residue to replace, like the rest of the example."""
    product = tmp_path / "product"
    shutil.copytree(ROOT / "notebooks", product / "notebooks")
    for n in range(12):
        (product / "src").mkdir(exist_ok=True)
        (product / "src" / f"m{n}.py").write_text("x = 1\n", encoding="utf-8")
    shutil.copytree(ROOT / "scripts", product / "scripts", ignore=shutil.ignore_patterns("__pycache__", "node_modules"))
    subprocess.run(["git", "init", "-q"], cwd=product, check=True)
    r = subprocess.run([sys.executable, str(product / "scripts" / "check_template_residue.py"), str(product)], capture_output=True, text=True, cwd=product)
    assert r.returncode == 1 and "notebooks/en/01-getting-started/01-the-problem-and-the-data.ipynb" in r.stdout, r.stdout


# ---------------------------------------------------------------- the review fixes (template 0.10.000, findings F1 to F15)

GIT_URL = "git+https://github.com/fsantibanezleal/CAOS_RiskValidation.git@v0.8.0"
GIT_LINE = f"riskvalidation @ {GIT_URL}"
TAG_SENTENCE = {"en": "not yet published on PyPI; installed from its release tag",
                "es": "todavía no publicado en PyPI; instalado desde su etiqueta de versión"}


def use_git_pin(repo: Path, *, sentence: bool = True, install: bool = True, entry: str = GIT_LINE, line: str = GIT_LINE) -> None:
    """F3: the product consumes a package of its own not yet on PyPI, installed from its release tag, in both trees."""
    req = repo / "notebooks" / "requirements.txt"
    req.write_text(req.read_text(encoding="utf-8") + line + "\n", encoding="utf-8")
    for lang in ("en", "es"):
        for topic, levels in TOPICS.items():
            for n in range(1, len(levels) + 1):
                def change(doc: dict, lang: str = lang) -> None:
                    doc["metadata"]["caos"]["packages"] = [PIN, entry]
                    setup = next(c for c in doc["cells"] if c["source"].startswith(("## Setup", "## Preparación")))
                    if install:
                        setup["source"] += f'\n\n```\npip install "{GIT_URL}"\n```'
                    if sentence:
                        setup["source"] += f"\n\n{TAG_SENTENCE[lang]}."
                edit(repo, lang, f"{topic}/{n:02d}-note.ipynb", change)


def test_a_package_installed_from_its_release_tag_passes_in_its_exact_form(repo: Path) -> None:
    use_git_pin(repo)
    assert CHECK.findings_of(repo) == []


def test_a_release_tag_package_needs_its_sentence(repo: Path) -> None:
    use_git_pin(repo, sentence=False)
    assert found(repo, "riskvalidation @ git+", "not yet published on PyPI; installed from its release tag")


def test_a_release_tag_package_needs_the_install_line(repo: Path) -> None:
    use_git_pin(repo, install=False)
    assert found(repo, "pip install", GIT_URL)


@pytest.mark.parametrize("line", [
    "riskvalidation @ https://example.org/riskvalidation-0.8.0.zip",
    "riskvalidation @ git+https://gitlab.com/o/riskvalidation.git@v0.8.0",
    "riskvalidation @ git+https://github.com/o/riskvalidation.git@main",
    "riskvalidation @ git+https://github.com/o/riskvalidation.git",
    "riskvalidation>=0.8.0",
    "riskvalidation==v0.8.0 extra",
])
def test_any_other_requirement_form_is_refused(repo: Path, line: str) -> None:
    req = repo / "notebooks" / "requirements.txt"
    req.write_text(req.read_text(encoding="utf-8") + line + "\n", encoding="utf-8")
    assert found(repo, "notebooks/requirements.txt", "pins", repr(line))


@pytest.mark.parametrize("entry", ["riskvalidation==v0.8.0", "riskvalidation @ git+https://github.com/fsantibanezleal/CAOS_RiskValidation.git@v0.9.0",
                                   "riskvalidation"])
def test_a_package_entry_that_is_not_an_exact_requirements_line_is_refused(repo: Path, entry: str) -> None:
    use_git_pin(repo, entry=entry)
    assert found(repo, "metadata", repr(entry))


@pytest.mark.parametrize("code", [
    "%pip install numpy==2.4.6", "!pip install numpy", "%conda install numpy", "!conda install numpy", "  %pip install numpy",
    "import subprocess, sys\nsubprocess.run([sys.executable, '-m', 'pip', 'install', 'numpy'])",
    "import os\nos.system('python -m pip install numpy')", "import os\nos.system(\"pip install numpy\")",
])
def test_a_notebook_never_runs_pip(repo: Path, code: str) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(source=f"# install\n{code}"))
    assert found(repo, "01-basics/01-note.ipynb", "anatomy", "a notebook never runs pip itself (convention section 4)")


def test_a_comment_that_names_pip_is_not_running_it(repo: Path) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(
        source="# pip install numpy is done in the Setup text, never here\nimport importlib.metadata\nprint(1)"))
    assert CHECK.findings_of(repo) == []


@pytest.mark.parametrize("text", ["p = 'D:\\\\_Datos\\\\sir'", "WindowsPath('D:\\\\_Temp\\\\x')", "c:\\\\Users\\\\someone", "E:/_Datos/sir",
                                  "/opt/runner/work/repo/x", "/tmp/x.json", "/root/.cache/x", "/var/log/x", "/srv/data/x"])
def test_a_drive_path_literal_and_the_posix_roots_are_found(repo: Path, text: str) -> None:
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(source=f"# a path\n{text}"))
    assert found(repo, "01-basics/01-note.ipynb", ": path:")

    def out(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"] = [{"output_type": "stream", "name": "stdout", "text": text + "\n"}]
    edit(repo, "en", "01-basics/02-note.ipynb", out)
    assert found(repo, "01-basics/02-note.ipynb", ": path:")


def test_prose_that_only_looks_like_a_path_is_not_one(repo: Path) -> None:
    text = "Ratio a:b, https://doi.org/10.1/x, https://example.org/opt/y, the path data/tmp/x, ../tmp/z, Note: and 5:1."
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: d["cells"][1].update(source=f"## Objectives\n\n{text}"))
    assert CHECK.findings_of(repo) == []


def test_a_traceback_printed_to_stdout_is_found(repo: Path) -> None:
    def tb(doc: dict) -> None:
        next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"] = [
            {"output_type": "stream", "name": "stdout", "text": "Traceback (most recent call last):\n  File \"x\", line 1\nKeyError: 'a'\n"}]
    edit(repo, "en", "01-basics/01-note.ipynb", tb)
    assert found(repo, "01-basics/01-note.ipynb", "output", "prints a traceback")


@pytest.mark.parametrize("rel", ["notebooks/en/00-loose.ipynb", "notebooks/00-loose.ipynb", "notebooks/en/01-basics/extra/01-deep.ipynb",
                                 "notebooks/fr/01-basics/01-note.ipynb"])
def test_a_notebook_outside_the_layout_is_found(repo: Path, rel: str) -> None:
    target = repo / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(repo / "notebooks" / "en" / "01-basics" / "01-note.ipynb", target)
    assert found(repo, rel, "layout", "notebooks/<language>/<topic>/<notebook>.ipynb")


def test_the_install_line_and_the_references_are_enforced(repo: Path) -> None:
    def no_install(doc: dict) -> None:
        setup = next(c for c in doc["cells"] if c["source"].startswith("## Setup"))
        setup["source"] = f"## Setup\n\nThe pin is {PIN} but no command is shown."
    edit(repo, "en", "01-basics/01-note.ipynb", no_install)
    assert found(repo, "en/01-basics/01-note.ipynb", "anatomy", "pip install", PIN)

    def two_pins_one_line(doc: dict) -> None:
        setup = next(c for c in doc["cells"] if c["source"].startswith("## Preparación"))
        setup["source"] = f"## Preparación\n\n```\npip install matplotlib==3.11.2 \\\n  {PIN}\n```"
    edit(repo, "es", "01-basics/01-note.ipynb", two_pins_one_line)
    assert not found(repo, "es/01-basics/01-note.ipynb", "pip install")

    def no_reference(doc: dict) -> None:
        refs = next(c for c in doc["cells"] if c["source"].startswith("## References"))
        refs["source"] = "## References\n\n- Kermack and McKendrick (1927), without a link."
    edit(repo, "en", "01-basics/02-note.ipynb", no_reference)
    assert found(repo, "en/01-basics/02-note.ipynb", "sources", "References", SOURCE)


# ---- the runner: coalesced streams (F2), the fresh-versus-committed comparison (F10), the layout (F9)

def test_consecutive_streams_of_one_name_are_coalesced() -> None:
    nb = {"cells": [{"cell_type": "code", "id": "a", "source": "x", "execution_count": 1, "metadata": {}, "outputs": [
        {"output_type": "stream", "name": "stdout", "text": ["R0 = ", "beta / gamma ="]},
        {"output_type": "stream", "name": "stdout", "text": " 2.75\n"},
        {"output_type": "stream", "name": "stderr", "text": "warn\n"},
        {"output_type": "stream", "name": "stdout", "text": "after\n"},
        {"output_type": "display_data", "data": {"text/plain": "x"}, "metadata": {}},
        {"output_type": "stream", "name": "stdout", "text": "tail "},
        {"output_type": "stream", "name": "stdout", "text": "end\n"}]}], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}
    outs = RUNNER.strip_volatile(nb)["cells"][0]["outputs"]
    assert [(o["output_type"], o.get("name")) for o in outs] == [("stream", "stdout"), ("stream", "stderr"), ("stream", "stdout"),
                                                                 ("display_data", None), ("stream", "stdout")]
    assert outs[0]["text"] == ["R0 = beta / gamma = 2.75\n"]
    assert "".join(outs[4]["text"]) == "tail end\n"
    assert len(nb["cells"][0]["outputs"]) == 7, "the input is not mutated"


@needs_env
def test_a_print_in_two_chunks_writes_one_stream_byte_identical_across_runs(tmp_path: Path) -> None:
    base, path = runner_repo(tmp_path, "# print in two chunks\nimport time\nprint('a', end='', flush=True)\ntime.sleep(0.3)\nprint('b')")
    args = ("--only", "notebooks/en/01-basics/01-note.ipynb")
    assert run_runner(base, *args).returncode == 0
    first = path.read_bytes()
    doc = json.loads(first.decode("utf-8"))
    outputs = next(c for c in doc["cells"] if c["cell_type"] == "code")["outputs"]
    assert len(outputs) == 1 and "".join(outputs[0]["text"]) == "ab\n", outputs
    assert run_runner(base, *args).returncode == 0
    assert path.read_bytes() == first


@needs_env
def test_check_fails_a_notebook_whose_committed_outputs_are_stale(tmp_path: Path) -> None:
    base, path = runner_repo(tmp_path, "# a first cell\nprint(6 * 7)")
    args = ("--only", "notebooks/en/01-basics/01-note.ipynb")
    assert run_runner(base, *args).returncode == 0
    assert run_runner(base, "--check", *args).returncode == 0, "a fresh in-place run passes the comparison"
    path.write_text(path.read_text(encoding="utf-8").replace('"42\\n"', '"43\\n"'), encoding="utf-8")
    stale = run_runner(base, "--check", *args)
    assert stale.returncode == 1 and "stale" in stale.stdout and "01-note.ipynb" in stale.stdout, stale.stdout


@needs_env
def test_the_runner_refuses_a_notebook_outside_the_layout_and_runs_none(tmp_path: Path) -> None:
    base, path = runner_repo(tmp_path, "# a first cell\nprint(6 * 7)")
    loose = base / "notebooks" / "en" / "00-loose.ipynb"
    shutil.copy2(path, loose)
    before = path.read_bytes()
    r = run_runner(base)
    assert r.returncode == 1 and "00-loose.ipynb" in r.stdout and "notebooks/<language>/<topic>/<notebook>.ipynb" in r.stdout, r.stdout
    assert path.read_bytes() == before, "nothing ran, nothing was written"


# ---- the example set after the fixes (F1, F12, F13, F14)

def cells_of(lang: str, rel: str) -> list[dict]:
    return json.loads((ROOT / "notebooks" / lang / rel).read_text(encoding="utf-8"))["cells"]


@pytest.mark.parametrize("lang", ["en", "es"])
def test_the_convergence_cell_names_the_case_it_runs(lang: str) -> None:
    """F1: the figure is titled EX02_epidemic, so the cell binds that case itself instead of reusing the last loop variable."""
    cells = cells_of(lang, "01-getting-started/02-the-method-step-by-step.ipynb")
    cell = next(c for c in cells if c["cell_type"] == "code" and "steps = [1.0, 0.5" in CHECK.text_of(c["source"]))
    code = CHECK.text_of(cell["source"])
    body = [ln for ln in code.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    assert body[0] == 'p = params_of("EX02_epidemic")', body[0]
    printed = "".join(CHECK.text_of(o.get("text", "")) for o in cell["outputs"])
    assert "0.933717" in printed and "0.300894" not in printed, printed  # EX02's first attack rate, not EX04's


@pytest.mark.parametrize("lang,fixed,stale", [("en", "0.000002", "about 0.00005 for the cases that ended"),
                                              ("es", "0,000002", "cerca de 0,00005 en los casos que terminaron")])
def test_the_fast_burn_difference_is_stated_for_both_cases(lang: str, fixed: str, stale: str) -> None:
    """F12: the derived relation differs from level 2 by 0.00005 for the epidemic case and 0.000002 for the fast burn."""
    text = "\n".join(CHECK.text_of(c["source"]) for c in cells_of(lang, "02-threshold-and-final-size/03-next-generation-matrix-and-final-size-derivation.ipynb"))
    assert fixed in text and stale not in text


def test_the_spanish_final_size_notebook_uses_one_decimal_separator() -> None:
    """F13: the Spanish prose writes its decimals with a comma, every number of the notebook's prose, in the same cell too."""
    import re
    for c in cells_of("es", "02-threshold-and-final-size/02-the-final-size.ipynb"):
        if c["cell_type"] == "markdown":
            prose = re.sub(r"`[^`]*`|https?://\S+|10\.\d{4,9}/\S+", "", CHECK.text_of(c["source"]))
            assert not re.search(r"\d\.\d", prose), prose[:200]


def test_the_final_size_solver_is_imported_by_the_notebooks_and_defined_in_none() -> None:
    """F14: a method is imported, never defined in a notebook; the solver lives in data-pipeline/pipeline/oracles.py."""
    assert "final_size" in CHECK.engine_names(ROOT)
    users = 0
    for path in (ROOT / "notebooks").rglob("*.ipynb"):
        code = "\n".join(CHECK.text_of(c["source"]) for c in json.loads(path.read_text(encoding="utf-8"))["cells"] if c["cell_type"] == "code")
        assert "final_size" not in CHECK.defined_names(code), path.name
        if "final_size(" in code:
            users += 1
            assert "from pipeline.oracles import final_size" in code, path.name
    assert users == 6


def test_a_notebook_that_redefines_the_oracle_is_found(repo: Path) -> None:
    oracles = repo / "data-pipeline" / "pipeline"
    oracles.mkdir(parents=True)
    (oracles / "oracles.py").write_text("def final_size(r0):\n    return r0\n", encoding="utf-8")
    edit(repo, "en", "01-basics/01-note.ipynb", lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(
        source="# a copy of the oracle\ndef final_size(r0):\n    return r0"))
    assert found(repo, "01-basics/01-note.ipynb", "defines 'final_size'", "import it instead")


def test_a_notebook_with_packages_prints_their_versions(repo: Path) -> None:
    """F11: the Setup section is followed by a code cell that prints the versions (importlib.metadata)."""
    def drop(doc: dict) -> None:
        for c in doc["cells"]:
            if c["cell_type"] == "code" and "importlib.metadata" in c["source"]:
                c["source"] = "# print a number\nprint(1)"
    edit(repo, "en", "01-basics/01-note.ipynb", drop)
    assert found(repo, "en/01-basics/01-note.ipynb", "anatomy", "importlib.metadata")


# ---------------------------------------------------------------- the method packages (0.11.000, NB-043 to NB-047)

FAKE_PIN = "fakepkg==1.2.3"


def fake_package(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A small package on ``sys.path`` with no distribution metadata: public names in its modules, a private module, a ``tests``
    folder and a nested package. Its ``__init__`` raises at the end, so any import of it fails the test."""
    site = tmp_path / "site"
    pkg = site / "fakepkg"
    (pkg / "tests").mkdir(parents=True)
    (pkg / "sub").mkdir()
    (pkg / "__init__.py").write_text("def init_public():\n    pass\n\n\nraise RuntimeError('fakepkg was imported')\n", encoding="utf-8")
    (pkg / "core.py").write_text("class Solver:\n    pass\n\n\ndef fit_model(x):\n    return x\n\n\nasync def fetch_all():\n    pass\n\n\n"
                                 "def _hidden():\n    pass\n\n\nif True:\n    def nested_not_top_level():\n        pass\n", encoding="utf-8")
    (pkg / "_private.py").write_text("def from_private_module():\n    pass\n", encoding="utf-8")
    (pkg / "tests" / "test_core.py").write_text("def test_inside_tests():\n    pass\n", encoding="utf-8")
    (pkg / "sub" / "__init__.py").write_text("def sub_public():\n    pass\n", encoding="utf-8")
    (pkg / "sub" / "deep.py").write_text("def deep_public():\n    pass\n", encoding="utf-8")
    monkeypatch.syspath_prepend(str(site))
    return site


def declare(root: Path, packages, pin: str | None = FAKE_PIN) -> None:
    (root / "product.json").write_text(json.dumps({"name": "x", "method_packages": packages}), encoding="utf-8")
    if pin:
        with (root / "notebooks" / "requirements.txt").open("a", encoding="utf-8") as f:
            f.write(pin + "\n")


def define_in_first_code_cell(root: Path, source: str, lang: str = "en", rel: str = "01-basics/01-note.ipynb") -> None:
    edit(root, lang, rel, lambda d: next(c for c in d["cells"] if c["cell_type"] == "code").update(source=source))


def test_adversarial_the_public_names_of_a_method_package_are_read_without_importing_it(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_package(tmp_path, monkeypatch)
    names = CHECK.package_public_names("fakepkg")
    assert names == {"init_public", "Solver", "fit_model", "fetch_all", "sub_public", "deep_public"}, names
    assert "fakepkg" not in sys.modules, "the source is read with ast, the package is never imported"
    assert CHECK.package_public_names("a_package_that_is_nowhere_installed") is None


def test_adversarial_a_notebook_that_defines_a_method_package_name_is_found(repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_package(tmp_path, monkeypatch)
    declare(repo, ["fakepkg"])
    assert CHECK.findings_of(repo) == []
    define_in_first_code_cell(repo, "# a copy of the method\ndef fit_model(x):\n    return x")
    assert found(repo, "01-basics/01-note.ipynb", "code cell", "defines 'fit_model'", "fakepkg", "import it instead")
    define_in_first_code_cell(repo, "# a class of the package\nclass Solver:\n    pass", lang="es")
    assert found(repo, "notebooks/es/01-basics/01-note.ipynb", "defines 'Solver'", "fakepkg")
    # a private name, a name of the tests folder and a helper of the notebook's own are fine
    define_in_first_code_cell(repo, "# helpers\ndef _hidden():\n    pass\n\n\ndef test_inside_tests():\n    pass\n\n\ndef read_artifact(x):\n    return x",
                              rel="01-basics/02-note.ipynb")
    assert not found(repo, "01-basics/02-note.ipynb", "fakepkg")


def test_adversarial_without_method_packages_the_check_is_unchanged(repo: Path) -> None:
    assert CHECK.findings_of(repo) == []
    for body in ('{"name": "x"}', '{"name": "x", "method_packages": []}'):
        (repo / "product.json").write_text(body, encoding="utf-8")
        infos: list[str] = []
        assert CHECK.findings_of(repo, infos) == [] and infos == []
    (repo / "product.json").write_text("not json", encoding="utf-8")
    assert CHECK.findings_of(repo) == []  # the file is the product's; the key is optional
    (repo / "product.json").write_text('{"method_packages": "fakepkg"}', encoding="utf-8")
    assert found(repo, "product.json", "method_packages", "list of strings")


def test_adversarial_a_method_package_that_is_not_installed_is_info_in_the_static_check(repo: Path) -> None:
    declare(repo, ["not-installed-anywhere"], pin="not-installed-anywhere==0.1.0")
    infos: list[str] = []
    assert CHECK.findings_of(repo, infos) == []
    assert infos == ["check_notebooks: not-installed-anywhere not installed here; its names are checked by run_notebooks.py"]
    result = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "check_notebooks.py"), str(repo)], capture_output=True, encoding="utf-8")
    assert result.returncode == 0, result.stdout
    assert "not-installed-anywhere not installed here; its names are checked by run_notebooks.py" in result.stdout


def test_adversarial_a_method_package_without_a_pin_is_found(repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_package(tmp_path, monkeypatch)
    declare(repo, ["fakepkg"], pin=None)
    assert found(repo, "notebooks/requirements.txt", "fakepkg", "no exact pin")
    declare(repo, ["fakepkg"], pin="fakepkg>=1.0")  # a range is no pin
    assert found(repo, "notebooks/requirements.txt", "fakepkg", "no exact pin")
    (repo / "notebooks" / "requirements.txt").write_text(f"{PIN}\nFakePkg[extra]==1.2.3\n", encoding="utf-8")  # an extra and another case are fine
    assert not found(repo, "no exact pin")
    assert CHECK.method_pin(repo, "fakepkg") == "1.2.3"


class FakeResponse:
    def __init__(self, status: int) -> None:
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> bool:
        return False


def test_adversarial_the_pypi_check_fails_on_anything_but_200(repo: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    import urllib.error
    declare(repo, ["fakepkg"], pin="fakepkg[extra]==1.2.3")
    seen: list[str] = []
    status = [200]

    def fake_open(req, timeout=None):
        url = req if isinstance(req, str) else req.full_url
        seen.append(url)
        if status[0] == 200:
            return FakeResponse(200)
        raise urllib.error.HTTPError(url, status[0], "Not Found", None, None)

    monkeypatch.setattr(CHECK.urllib.request, "urlopen", fake_open)
    assert CHECK.pypi_findings(repo) == [] and seen == ["https://pypi.org/pypi/fakepkg/1.2.3/json"]
    status[0] = 404
    out = CHECK.pypi_findings(repo)
    assert len(out) == 1 and "https://pypi.org/pypi/fakepkg/1.2.3/json" in out[0] and "404" in out[0], out
    # the command line: --pypi runs it, a plain run never touches the network
    seen.clear()
    monkeypatch.setattr(sys, "argv", ["check_notebooks.py", str(repo)])
    assert CHECK.main() == 0 and seen == []
    monkeypatch.setattr(sys, "argv", ["check_notebooks.py", str(repo), "--pypi"])
    assert CHECK.main() == 1 and seen and "404" in capsys.readouterr().out
    status[0] = 200
    assert CHECK.main() == 0


def test_adversarial_a_network_failure_is_a_pypi_finding(repo: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    declare(repo, ["fakepkg"])

    def refuse(req, timeout=None):
        raise OSError("no route")
    monkeypatch.setattr(CHECK.urllib.request, "urlopen", refuse)
    out = CHECK.pypi_findings(repo)
    assert len(out) == 1 and "https://pypi.org/pypi/fakepkg/1.2.3/json" in out[0] and "no route" in out[0]


def test_adversarial_ci_never_passes_pypi() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "check_notebooks.py --pypi" not in ci and "python scripts/check_notebooks.py" in ci
