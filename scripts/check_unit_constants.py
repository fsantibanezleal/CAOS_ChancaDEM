"""CONTRACT 3b: no unreviewed constant in the engine's method code (CAOS_MANAGE conventions/units-gate.md).

Walks the AST of every module of the canonical crusher engine (data-pipeline/pipeline/model/crusher/) and collects every
float literal. Each must appear in scripts/.unit_constants_allow.json with a written justification that names the quantity
it is measured in (a size in millimetres, a power in kilowatts, a dimensionless ratio, a fit coefficient and its unit). A
NEW unreviewed constant fails the gate, which forces the author to answer one question when writing it: what unit does
this number assume? The reference implementation is CAOS_RES_Fragua scripts/check_unit_constants.py.

Run:  python scripts/check_unit_constants.py
      python scripts/check_unit_constants.py --update   (adds new constants marked TODO, drops removed ones; review the diff)

Standard library only.
"""
from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ALLOW = REPO / "scripts" / ".unit_constants_allow.json"
ROOTS = (REPO / "data-pipeline" / "pipeline" / "model" / "crusher",)
TODO = "TODO"


def collect() -> dict[str, list[dict]]:
    found: dict[str, list[dict]] = {}
    for root in ROOTS:
        for path in sorted(root.rglob("*.py")):
            rel = path.relative_to(REPO).as_posix()
            source = path.read_text(encoding="utf-8")
            lines = source.split("\n")
            hits = []
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.Constant) and isinstance(node.value, float):
                    hits.append({"value": float(node.value), "line": node.lineno, "source": lines[node.lineno - 1].strip()[:120]})
            if hits:
                found[rel] = sorted(hits, key=lambda h: h["line"])
    return found


def key(rel: str, hit: dict) -> str:
    return f"{rel}::{hit['value']!r}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true", help="re-baseline; review the diff")
    args = ap.parse_args()

    found = collect()
    allow = json.loads(ALLOW.read_text(encoding="utf-8")) if ALLOW.exists() else {}

    if args.update:
        merged: dict[str, dict] = {}
        added = 0
        for rel, hits in found.items():
            for h in hits:
                k = key(rel, h)
                if k in merged:
                    continue
                if k in allow:
                    merged[k] = {**allow[k], "source": h["source"]}
                else:
                    merged[k] = {"reason": f"{TODO}: state what unit this number assumes", "source": h["source"]}
                    added += 1
        ALLOW.write_text(json.dumps(dict(sorted(merged.items())), indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        print(f"baseline written: {len(merged)} constants ({added} new, marked {TODO})")
        return 0

    problems: list[str] = []
    for rel, hits in found.items():
        for h in hits:
            entry = allow.get(key(rel, h))
            if entry is None:
                problems.append(
                    f"{rel}:{h['line']}: unreviewed constant {h['value']!r}\n      {h['source']}\n"
                    "      What unit does this number assume? Add it to scripts/.unit_constants_allow.json with a "
                    "justification, or derive it from the data.")
            elif str(entry.get("reason", "")).startswith(TODO):
                problems.append(f"{rel}:{h['line']}: constant {h['value']!r} is baselined but not justified\n      {h['source']}")
    live = {key(rel, h) for rel, hits in found.items() for h in hits}
    for k in sorted(set(allow) - live):
        problems.append(f"{k}: allowed but no longer in the code; remove it (python scripts/check_unit_constants.py --update)")

    if problems:
        print(f"UNIT-CONSTANT GATE FAILED: {len(problems)} problem(s)\n")
        for p in problems:
            print(f"  - {p}")
        return 1
    total = sum(len(v) for v in found.values())
    print(f"UNIT-CONSTANT GATE OK: {total} constants across {len(found)} modules, {len(live)} distinct, all justified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
