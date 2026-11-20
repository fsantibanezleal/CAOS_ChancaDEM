"""Shared fixtures of the harness tests: the import paths and one small exact-route context (a 60-point pool per window),
built once per session under the pytest base temporary directory, never under the system temp."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

SIM = Path(__file__).resolve().parents[1]
ROOT = SIM.parents[2]
for p in (str(SIM), str(ROOT / "data-pipeline")):
    if p not in sys.path:
        sys.path.insert(0, p)

SMALL_POOL = 40


@pytest.fixture(scope="session")
def cache_dir(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("cache")


@pytest.fixture(scope="session")
def small_ctx(cache_dir):
    import run_exact
    cells = [c for c in run_exact.cell_list() if c.name in ("V0-surveys-n10", "V1_a1_k0-surveys-n10", "V0-real-n10")]
    return run_exact.Context.build(cells, cache=cache_dir, workers=1, pool_size=SMALL_POOL)
