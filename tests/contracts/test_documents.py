"""Producer-side tests of the document contracts (catalog rows case-index, case-manifest, trace, api): every
document of the committed bake, of a fresh sandbox bake and of the provider tree validates against its schema file
(docs/contracts/schemas/) and obeys the rules a schema cannot state. The consumer and swap side is
frontend/src/lib/contract.test.ts, which runs the same assertions on the same roots."""
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest
from openapi_spec_validator import validate
from pipeline import pipeline

import contract_schemas as cs

BAKE = cs.DERIVED_ROOTS["bake"]
FIXTURE = cs.DERIVED_ROOTS["fixture"]


def cross_field_errors(root: Path) -> list[str]:
    """Every departure from the schemas and from the rules they cannot state, for the documents under ``root``
    (a data/derived layout): index, manifests, traces. A missing document is an error naming its path."""
    out: list[str] = []
    index_path = root / "manifests" / "index.json"
    if not index_path.is_file():
        return [f"missing {index_path}"]
    index = cs.load_json(index_path)
    out += [f"index {e}" for e in cs.errors("case-index", index)]
    ids = [c.get("case_id") for c in index.get("cases", [])]
    if index.get("n_cases") != len(ids):
        out.append(f"index: n_cases={index.get('n_cases')} but {len(ids)} entries")
    if index.get("default_case") not in ids:
        out.append(f"index: default_case {index.get('default_case')!r} is not an entry")
    if ids != sorted(ids):
        out.append("index: entries are not sorted by case_id")
    for entry in index.get("cases", []):
        mpath = root / entry["manifest_path"]
        if not mpath.is_file():
            out.append(f"missing manifest {mpath}")
            continue
        m = cs.load_json(mpath)
        out += [f"{entry['case_id']} manifest {e}" for e in cs.errors("case-manifest", m)]
        if m.get("case_id") != entry["case_id"]:
            out.append(f"{entry['case_id']}: manifest case_id is {m.get('case_id')!r}")
        if m.get("lane") != (m.get("gate") or {}).get("lane"):
            out.append(f"{entry['case_id']}: lane {m.get('lane')!r} differs from gate.lane")
        apath = root / m.get("artifact", {}).get("path", "")
        if not apath.is_file():
            out.append(f"missing artifact {apath}")
            continue
        if apath.stat().st_size != m["artifact"]["bytes"]:
            out.append(f"{entry['case_id']}: artifact.bytes {m['artifact']['bytes']} differs from the file size {apath.stat().st_size}")
        if hashlib.sha256(apath.read_bytes()).hexdigest() != m["artifact"]["sha256"]:
            out.append(f"{entry['case_id']}: artifact.sha256 differs from the file")
        t = cs.load_json(apath)
        out += [f"{entry['case_id']} trace {e}" for e in cs.errors("trace", t)]
        out += trace_rule_errors(entry["case_id"], t, m)
    return out


def trace_rule_errors(case_id: str, t: dict, m: dict) -> list[str]:
    """The rules the trace schema cannot state."""
    out: list[str] = []
    if t.get("case_id") != case_id:
        out.append(f"{case_id}: trace case_id is {t.get('case_id')!r}")
    sieve, mid = t.get("sieve_mm", []), t.get("mid_mm", [])
    if sieve != sorted(sieve, reverse=True) or len(set(sieve)) != len(sieve) or len(sieve) != len(mid) + 1:
        out.append(f"{case_id}: sieve_mm is not strictly descending or is not one longer than mid_mm")
    for k in ("feed_passing", "product_passing"):
        p = t.get(k, [])
        if len(p) != len(sieve) or any(b > a + 1e-9 for a, b in zip(p, p[1:])):
            out.append(f"{case_id}: {k} has the wrong length or increases along the grid")
    for k in ("feed_mass", "product_mass", "classification"):
        if len(t.get(k, [])) != len(mid):
            out.append(f"{case_id}: {k} lengths differ from mid_mm")
    for sweep in ("speed_sweep", "css_sweep"):
        lengths = {k: len(v) for k, v in t.get(sweep, {}).items()}
        if len(set(lengths.values())) != 1:
            out.append(f"{case_id}: {sweep} lengths differ: {lengths}")
    summary = t.get("summary", {})
    for k, v in m.get("metrics", {}).items():
        if k in summary and summary[k] != v:
            out.append(f"{case_id}: summary.{k}={summary[k]} differs from the manifest metric {v}")
    return out


def catalog_ids() -> list[str]:
    """The row ids of the ## Contracts table of the catalog, in order."""
    ids: list[str] = []
    in_table = False
    for line in (cs.CONTRACTS / "catalog.md").read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            in_table = line.strip() == "## Contracts"
            continue
        if in_table and line.startswith("|"):
            cell = line.split("|")[1].strip()
            if cell != "id" and not set(cell) <= {"-"}:
                ids.append(cell)
    return ids


@pytest.fixture(scope="module")
def fresh_bake(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("fresh-bake")
    pipeline.run_all(output_root=root)
    return root


def _roots(fresh_bake: Path) -> dict[str, Path]:
    return {"committed bake": BAKE, "fresh bake": fresh_bake, "fixture tree": FIXTURE}


def test_index_validates(fresh_bake: Path) -> None:
    for label, root in _roots(fresh_bake).items():
        path = root / "manifests" / "index.json"
        assert path.is_file(), f"{label}: missing {path}"
        index = cs.load_json(path)
        assert cs.errors("case-index", index) == [], label
        ids = [c["case_id"] for c in index["cases"]]
        assert index["n_cases"] == len(ids) and index["default_case"] in ids and ids == sorted(ids), label


def test_manifests_validate(fresh_bake: Path) -> None:
    for label, root in _roots(fresh_bake).items():
        index = cs.load_json(root / "manifests" / "index.json")
        assert index["cases"], label
        for entry in index["cases"]:
            path = root / entry["manifest_path"]
            assert path.is_file(), f"{label}: missing {path}"
            m = cs.load_json(path)
            assert cs.errors("case-manifest", m) == [], f"{label} {entry['case_id']}"
            assert m["case_id"] == entry["case_id"] and m["lane"] == m["gate"]["lane"], f"{label} {entry['case_id']}"
            art = root / m["artifact"]["path"]
            assert art.is_file(), f"{label}: missing {art}"
            assert art.stat().st_size == m["artifact"]["bytes"], f"{label} {entry['case_id']}: artifact bytes"


def test_traces_validate(fresh_bake: Path) -> None:
    for label, root in _roots(fresh_bake).items():
        index = cs.load_json(root / "manifests" / "index.json")
        for entry in index["cases"]:
            m = cs.load_json(root / entry["manifest_path"])
            path = root / m["artifact"]["path"]
            assert path.is_file(), f"{label}: missing {path}"
            t = cs.load_json(path)
            assert cs.errors("trace", t) == [], f"{label} {entry['case_id']}"
            assert trace_rule_errors(entry["case_id"], t, m) == [], f"{label} {entry['case_id']}"


def test_every_root_passes_the_cross_field_rules(fresh_bake: Path) -> None:
    for label, root in _roots(fresh_bake).items():
        assert cross_field_errors(root) == [], label


def test_fresh_bake_is_not_the_committed_bake(fresh_bake: Path) -> None:
    assert fresh_bake.resolve() != BAKE.resolve() and not str(fresh_bake.resolve()).startswith(str(cs.ROOT / "data"))
    assert (fresh_bake / "manifests" / "index.json").is_file()


def test_fixture_tree_validates() -> None:
    assert cross_field_errors(FIXTURE) == []
    readiness_path = FIXTURE / "readiness.json"
    assert readiness_path.is_file(), f"missing {readiness_path}"
    readiness = cs.load_json(readiness_path)
    assert cs.errors("readiness", readiness) == []
    assert [e["id"] for e in readiness["contracts"]] == [r for r in catalog_ids() if r != "readiness"]
    # the provider tree is a stand-in for data/derived: the artifact checker accepts it as a repository root
    run = subprocess.run([sys.executable, str(cs.ROOT / "scripts" / "check_artifacts.py"), str(cs.FIXTURE_ROOT)],
                         capture_output=True, text=True, check=False)
    assert run.returncode == 0, run.stdout + run.stderr


def test_openapi_document_is_valid() -> None:
    validate(cs.load_json(cs.OPENAPI), base_uri=cs.OPENAPI.as_uri())


def test_adversarial_drifted_documents_are_rejected() -> None:
    index = cs.load_json(FIXTURE / "manifests" / "index.json")
    manifest = cs.load_json(FIXTURE / index["cases"][0]["manifest_path"])
    trace = cs.load_json(FIXTURE / manifest["artifact"]["path"])
    docs = {
        "case-index": index,
        "case-manifest": manifest,
        "trace": trace,
        "readiness": cs.load_json(FIXTURE / "readiness.json"),
        "params-record": cs.load_json(cs.CONTRACTS / "examples" / "params-record.json"),
        "surrogate-model": cs.load_json(cs.CONTRACTS / "examples" / "surrogate-model.json"),
    }
    for name, doc in docs.items():
        assert cs.errors(name, doc) == [], f"{name}: the base document must conform first"
        extra = copy.deepcopy(doc)
        extra["unexpected_key"] = 1
        assert cs.errors(name, extra), f"{name}: an extra key is accepted"
        missing = copy.deepcopy(doc)
        del missing[next(iter(missing))]
        assert cs.errors(name, missing), f"{name}: a missing key is accepted"
    # a boolean is not a number
    wrong = copy.deepcopy(trace)
    wrong["summary"]["p80_mm"] = True
    assert cs.errors("trace", wrong)
    wrong = copy.deepcopy(manifest)
    wrong["params"]["css_mm"] = True
    assert cs.errors("case-manifest", wrong)
    # a state that contradicts its reason
    wrong = copy.deepcopy(docs["readiness"])
    wrong["contracts"][0].update(state="available", reason={"en": "x", "es": "x"})
    assert cs.errors("readiness", wrong)


def test_adversarial_cross_field_rules_catch_what_the_schema_cannot(tmp_path: Path) -> None:
    root = tmp_path / "derived"
    for p in FIXTURE.rglob("*"):
        if p.is_file():
            dest = root / p.relative_to(FIXTURE)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(p.read_bytes())
    assert cross_field_errors(root) == []
    trace_path = next(root.glob("*/trace.json"))
    t = cs.load_json(trace_path)
    t["product_passing"] = t["product_passing"][:-1]
    trace_path.write_text(json.dumps(t), encoding="utf-8")
    problems = cross_field_errors(root)
    assert any("wrong length" in p for p in problems) and any("artifact.bytes" in p for p in problems)
    assert any("sha256" in p for p in problems)
