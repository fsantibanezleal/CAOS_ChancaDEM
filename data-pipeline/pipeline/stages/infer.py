"""Stage 2, infer: run the canonical crusher engine (``pipeline.model.crusher``) at an operating point."""
from __future__ import annotations

from ..model.crusher import CrusherResult, Operating, evaluate


def run(op: Operating) -> CrusherResult:
    return evaluate(op)
