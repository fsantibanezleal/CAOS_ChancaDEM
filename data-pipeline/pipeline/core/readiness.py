"""The readiness document (catalog row readiness, ADR-0080 decisions 3 and 4): what is real in this build, computed
from docs/contracts/catalog.md and the repository state, never written by hand.

A pure function of its inputs: no clock, no randomness, rows in catalog order, ``missing`` sorted. The rules, their
order (first match wins) and their reasons are the catalog's ``## Missing-data states`` table; tests/contracts/
test_readiness.py parses that table and holds every reason here to it. The model slots are judged by
``pipeline.model.bundles.released_slots`` (the one place that decides whether a slot is released), which needs numpy and
jsonschema; everything else here is the standard library.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from ..hp500 import surveys as survey_contract
from ..io.contract import validate_rows
from ..io.formats import read_csv_rows, write_json
from ..model.bundles import released_slots   # numpy and jsonschema; imported here so a missing one fails at import

SCHEMA = "chancadem.readiness/v1"
CATALOG_REL = "docs/contracts/catalog.md"
INDEX_REL = "manifests/index.json"
PARAMS_REL = "data/examples/params.csv"
SURVEYS_REL = "data/examples/hp500-surveys.csv"
BACKBONE_REL = "hp500/backbone.json"
LOO_REL = "hp500/loo.json"
METRICS_REL = "model-metrics.json"
STATUSES = ("real", "active")  # the catalog's status vocabulary (its Contracts section), exactly, lower case
MODEL_SLOTS = ("surrogate-model", "anomaly-model")

# the catalog's reasons as (en, es) templates, in the order of its Missing-data table
T_PROVIDER = ("Served by its provider ({provider}); the real producer is not built yet.",
              "Lo sirve su proveedor ({provider}); el productor real aún no está construido.")
T_NOT_BAKED = ("The pipeline has not baked this build.", "El pipeline no ha generado esta versión.")
T_MANIFESTS = ("{n} of {total} manifests are absent.", "Faltan {n} de {total} manifiestos.")
T_ARTIFACTS = ("{n} of {total} artifacts are absent.", "Faltan {n} de {total} artefactos.")
T_STALE = ("Baked by {engine_version}; the product is {version}.",
           "Generado por {engine_version}; el producto es {version}.")
T_NO_PARAMS = ("No source table; the bake uses the registry's cases.",
               "No hay tabla de origen; la generación usa los casos del registro.")
T_REJECTED = ("{n} of {total} rows rejected by contract 1.", "{n} de {total} filas rechazadas por el contrato 1.")
T_NO_SURVEYS = ("No survey table; the real HP500 cases are not baked.",
                "No hay tabla de mediciones; los casos reales HP500 no se generan.")
T_SURVEYS_REJECTED = ("{n} of {total} surveys rejected by the survey contract.",
                      "{n} de {total} mediciones rechazadas por el contrato de mediciones.")
T_NO_HP500 = ("The HP500 validation was not baked in this build.", "La validación HP500 no se generó en esta versión.")
T_NO_SURROGATE = ("No released surrogate; the engine itself answers.",
                  "No hay un sustituto publicado; responde el propio motor.")
T_NO_ANOMALY = ("No released autoencoder; the envelope gate answers.",
                "No hay un autocodificador publicado; responde la compuerta de envolvente.")
T_NO_METRICS = ("The models were not evaluated in this build.", "Los modelos no se evaluaron en esta versión.")
T_API = ("The API lane is dormant; the site reads the committed documents.",
         "La API está inactiva; el sitio lee los documentos versionados.")


def parse_catalog(text: str) -> list[dict[str, str]]:
    """The rows of the ``## Contracts`` table, one dict per row keyed by the lower-cased header cells."""
    lines = text.replace("\r\n", "\n").split("\n")
    start = next(i for i, ln in enumerate(lines) if ln.strip() == "## Contracts")
    table: list[list[str]] = []
    for ln in lines[start + 1:]:
        if ln.startswith("## "):
            break
        if ln.startswith("|"):
            table.append([c.strip() for c in ln.strip().strip("|").split("|")])
    header = [c.lower() for c in table[0]]
    return [dict(zip(header, cells)) for cells in table[2:]]  # table[1] is the separator


def _fill(tpl: tuple[str, str], **vals: object) -> dict[str, str]:
    out = []
    for text in tpl:
        for k, v in vals.items():
            text = text.replace("{" + k + "}", str(v))
        out.append(text)
    return {"en": out[0], "es": out[1]}


def _json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _artifact_paths(manifest: dict) -> list[str]:
    single = manifest.get("artifact")
    return [single["path"]] if isinstance(single, dict) and "path" in single else []


def _survey_key(text: str) -> tuple[int, str]:
    """Natural order of survey numbers: numbers first by value, anything else after, by text."""
    return (0, f"{int(text):06d}") if text.isdigit() else (1, text)


def _engine_version(doc: Any) -> str | None:
    return str(doc["engine_version"]) if isinstance(doc, dict) and "engine_version" in doc else None


class _Facts:
    """What the repository says, read once: the index, the absent manifests and artifacts, the rejected rows."""

    def __init__(self, repo_root: Path, derived_root: Path, models_dir: Path, version: str,
                 params_csv: Path, surveys_csv: Path) -> None:
        self.version = version
        index = _json(derived_root / INDEX_REL)
        self.index: dict | None = index if isinstance(index, dict) else None
        self.engine_version = str(self.index.get("engine_version")) if self.index else ""
        self.manifests_total = 0
        self.manifests_missing: list[str] = []
        self.artifacts_total = 0
        self.artifacts_missing: list[str] = []
        if self.index:
            for entry in self.index.get("cases", []):
                rel = entry["manifest_path"]
                self.manifests_total += 1
                manifest = _json(derived_root / rel)
                if not isinstance(manifest, dict):
                    self.manifests_missing.append(rel)
                    continue
                for art in _artifact_paths(manifest):
                    self.artifacts_total += 1
                    if not (derived_root / art).is_file():
                        self.artifacts_missing.append(art)
        self.params_present = params_csv.is_file()
        self.params_total = 0
        self.params_rejected_rows = 0
        self.params_rejected: list[str] = []
        if self.params_present:
            rows = read_csv_rows(params_csv)
            report = validate_rows(rows)
            self.params_total = len(rows)
            self.params_rejected_rows = len(report.rejected)
            self.params_rejected = sorted({r["case_id"] for r in report.rejected})
        self.surveys_present = surveys_csv.is_file()
        self.surveys_total = 0
        self.surveys_rejected_rows = 0
        self.surveys_rejected: list[str] = []
        if self.surveys_present:
            rows = read_csv_rows(surveys_csv)
            report = survey_contract.validate_rows(rows)
            self.surveys_total = len(rows)
            self.surveys_rejected_rows = len(report.rejected)
            self.surveys_rejected = sorted({str(raw.get("survey", "")).strip() for raw, _ in report.rejected}, key=_survey_key)
        self.backbone = _json(derived_root / BACKBONE_REL)
        self.loo = _json(derived_root / LOO_REL)
        self.metrics = _json(derived_root / METRICS_REL)
        self.slots = released_slots(models_dir)


def _entry(row: dict[str, str], state: str, provenance: str | None, reason: dict | None,
           missing: list[str] | None = None) -> dict:
    return {"id": row["id"], "version": row["version"], "status": row["status"], "provenance": provenance,
            "state": state, "reason": reason, "missing": sorted(missing or [])}


def _rule(row: dict[str, str], f: _Facts) -> dict:
    """The first rule of the catalog's Missing-data table that matches ``row``."""
    rid = row["id"]
    provider = row.get("provider", "").replace("`", "")
    if row["status"] not in STATUSES:
        raise ValueError(f"catalog row {rid!r}: status {row['status']!r} is not one of "
                         f"{' or '.join(repr(s) for s in STATUSES)} (lower case, no other value)")
    if row["status"] == "active":
        return _entry(row, "provider", provider.split(":", 1)[0] or "stub", _fill(T_PROVIDER, provider=provider))
    derived = rid in ("case-index", "case-manifest", "trace")
    if derived and f.index is None:
        return _entry(row, "missing", None, _fill(T_NOT_BAKED))
    if rid == "case-manifest" and f.manifests_missing:
        return _entry(row, "partial", "real", _fill(T_MANIFESTS, n=len(f.manifests_missing), total=f.manifests_total),
                      f.manifests_missing)
    if rid == "trace" and f.artifacts_missing:
        return _entry(row, "partial", "real", _fill(T_ARTIFACTS, n=len(f.artifacts_missing), total=f.artifacts_total),
                      f.artifacts_missing)
    if derived and f.engine_version != f.version:
        return _entry(row, "stale", "real", _fill(T_STALE, engine_version=f.engine_version, version=f.version))
    if rid == "params-record" and not f.params_present:
        return _entry(row, "missing", None, _fill(T_NO_PARAMS))
    if rid == "params-record" and f.params_rejected_rows:
        return _entry(row, "partial", "real", _fill(T_REJECTED, n=f.params_rejected_rows, total=f.params_total),
                      f.params_rejected)
    if rid == "hp500-survey" and not f.surveys_present:
        return _entry(row, "missing", None, _fill(T_NO_SURVEYS))
    if rid == "hp500-survey" and f.surveys_rejected_rows:
        return _entry(row, "partial", "real", _fill(T_SURVEYS_REJECTED, n=f.surveys_rejected_rows, total=f.surveys_total),
                      f.surveys_rejected)
    hp500 = {"hp500-backbone": f.backbone, "hp500-loo": f.loo}
    if rid in hp500 and not isinstance(hp500[rid], dict):
        return _entry(row, "missing", None, _fill(T_NO_HP500))
    doc = {**hp500, "model-metrics": f.metrics}.get(rid)
    if rid in ("hp500-backbone", "hp500-loo", "model-metrics") and isinstance(doc, dict) and _engine_version(doc) != f.version:
        return _entry(row, "stale", "real", _fill(T_STALE, engine_version=_engine_version(doc), version=f.version))
    if rid == "surrogate-model" and not f.slots["surrogate-model"]:
        return _entry(row, "training", "baseline", _fill(T_NO_SURROGATE))
    if rid == "anomaly-model" and not f.slots["anomaly-model"]:
        return _entry(row, "training", "baseline", _fill(T_NO_ANOMALY))
    if rid == "model-metrics" and not isinstance(f.metrics, dict):
        return _entry(row, "missing", None, _fill(T_NO_METRICS))
    if rid == "api":
        return _entry(row, "missing", None, _fill(T_API))
    return _entry(row, "available", "real", None)


def compute(*, repo_root: str | Path, derived_root: str | Path, models_dir: str | Path,
            catalog_path: str | Path | None = None, version: str | None = None,
            params_csv: str | Path | None = None, surveys_csv: str | Path | None = None) -> dict:
    """The readiness document of the repository at ``repo_root``, whose baked documents are under ``derived_root``
    and whose released models are in ``models_dir``. ``catalog_path``, ``version`` and the two source tables default to
    the repository's."""
    root = Path(repo_root)
    catalog = Path(catalog_path) if catalog_path else root / CATALOG_REL
    raw = catalog.read_bytes().replace(b"\r\n", b"\n")
    ver = version if version is not None else (root / "VERSION").read_text(encoding="utf-8").strip()
    facts = _Facts(root, Path(derived_root), Path(models_dir), ver,
                   Path(params_csv) if params_csv else root / PARAMS_REL,
                   Path(surveys_csv) if surveys_csv else root / SURVEYS_REL)
    rows = [r for r in parse_catalog(raw.decode("utf-8")) if r["id"] != "readiness"]
    return {"schema": SCHEMA, "product_version": ver, "catalog_sha256": hashlib.sha256(raw).hexdigest(),
            "contracts": [_rule(r, facts) for r in rows]}


def write(derived_root: str | Path, doc: dict) -> int:
    """Write ``<derived_root>/readiness.json`` as compact JSON; return its byte size."""
    return write_json(Path(derived_root) / "readiness.json", doc)


def provider_document(*, repo_root: str | Path, version: str | None = None, catalog_path: str | Path | None = None) -> dict:
    """The readiness document of the provider tree (docs/contracts/fixtures): every catalog row except readiness is served
    by its provider, and the dormant API is missing, whatever the rows' design status."""
    root = Path(repo_root)
    catalog = Path(catalog_path) if catalog_path else root / CATALOG_REL
    raw = catalog.read_bytes().replace(b"\r\n", b"\n")
    ver = version if version is not None else (root / "VERSION").read_text(encoding="utf-8").strip()
    entries = []
    for row in parse_catalog(raw.decode("utf-8")):
        if row["id"] == "readiness":
            continue
        if row["id"] == "api":
            entries.append(_entry(row, "missing", None, _fill(T_API)))
            continue
        provider = row.get("provider", "").replace("`", "")
        entries.append(_entry(row, "provider", provider.split(":", 1)[0], _fill(T_PROVIDER, provider=provider)))
    return {"schema": SCHEMA, "product_version": ver, "catalog_sha256": hashlib.sha256(raw).hexdigest(), "contracts": entries}
