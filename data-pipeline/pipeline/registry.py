"""The case registry, cases grouped by CATEGORY. The App shows ONE selected case; Experiments and Benchmark show
cross-case summaries by category.

The registry holds the 17 authored circuit cases with their operating points (the fallback when data/examples/params.csv
is absent) and builds the 10 real cases from the accepted HP500 surveys it is given."""
from __future__ import annotations

from collections.abc import Sequence

from .cases import Case
from .cases import hp500_cases
from .cases.circuit_cases import CASES, DEFAULT_CASE
from .hp500.surveys import Survey


def circuit_cases() -> list[Case]:
    return list(CASES)


def list_cases(surveys: Sequence[Survey] = ()) -> list[Case]:
    """The authored circuit cases, then the real case of each accepted survey."""
    return circuit_cases() + hp500_cases.build(list(surveys))


def get_case(case_id: str, surveys: Sequence[Survey] = ()) -> Case:
    for c in list_cases(surveys):
        if c.id == case_id:
            return c
    raise KeyError(f"unknown case: {case_id!r}. known: {sorted(c.id for c in list_cases(surveys))}")


def default_case() -> str:
    return DEFAULT_CASE


def list_categories(surveys: Sequence[Survey] = ()) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for c in list_cases(surveys):
        out.setdefault(c.category["en"], []).append(c.id)
    return out
