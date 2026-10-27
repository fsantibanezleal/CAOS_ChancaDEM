"""The case definitions: the 17 authored circuit cases (circuit_cases) and the 10 measured HP500 surveys (hp500_cases),
both as ``Case`` records. Every reader-facing string is bilingual at the source (ADR-0011)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..model.crusher import Operating

Text = dict  # {"en": str, "es": str}


def text(en: str, es: str) -> Text:
    return {"en": en, "es": es}


def num(value: float, lang: str) -> str:
    """A number as the reader of ``lang`` writes it: shortest form, decimal comma in Spanish."""
    s = str(int(value)) if float(value).is_integer() else repr(round(float(value), 2))
    return s if lang == "en" else s.replace(".", ",")


@dataclass(frozen=True)
class Case:
    id: str
    title: Text
    category: Text
    stage: str                      # primary | secondary | tertiary | control
    op: Operating
    expected_band: Text             # what a crushing engineer should see, in words and in the numbers of ``expect``
    context: dict[str, Text]        # problem, variables, reading
    expect: dict[str, tuple[float, float]]   # the checked form of expected_band: [low, high] per result metric
    real_or_synthetic: str = "synthetic"
    control: str | None = None      # negative | invalid | calibration
    source: dict[str, str] | None = None
    measured: dict[str, Any] | None = None   # a real case: the survey row exactly as the survey contract accepted it

    def __post_init__(self) -> None:
        if self.source is None:
            object.__setattr__(self, "source", {"kind": "authored"})
