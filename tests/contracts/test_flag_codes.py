"""CONTRACT 2 (artifact), producer side of the flag codes: the manifest schema enum carries the two warning codes added in
case-manifest 1.1.0 (I1, BL-019), the engine writes only codes the enum holds, and the description names both."""
from __future__ import annotations

import json
from pathlib import Path

from pipeline.core.manifest import flag_codes
from pipeline.model.crusher import Operating, evaluate

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "docs" / "contracts" / "schemas" / "case-manifest.schema.json"
NEW = ("css_below_vendor_minimum", "reduction_ratio_above_typical")


def _flags() -> dict:
    return json.loads(SCHEMA.read_text(encoding="utf-8"))["properties"]["flags"]


def test_the_schema_enum_holds_the_two_warning_codes_after_the_envelope_codes() -> None:
    enum = _flags()["items"]["enum"]
    assert all(c in enum for c in NEW)
    assert enum[-2:] == list(NEW)
    assert len(enum) == len(set(enum))


def test_every_code_the_engine_writes_is_in_the_enum() -> None:
    enum = set(_flags()["items"]["enum"])
    for machine in ("cone-sec", "cone-tert", "cone-short-head", "gyratory", "jaw"):
        for css in (0.5, 5, 20, 60, 150, 400):
            codes = flag_codes(evaluate(Operating(machine, css, 30, 300, 90, 1.2, 55, 14)))
            assert set(codes) <= enum, (machine, css, codes)


def test_the_description_names_both_codes() -> None:
    assert all(c in _flags()["description"] for c in NEW)
