"""The bake stage of the discrete element runs: ``run.py dem`` (catalog row dem-run, DM-001 to DM-010).

The runs through the published package ``crushdem`` (``pipeline.dem.runs``, raw records kept outside the repository so a later bake
of the same inputs does not run the simulation again), the replay files, the document (``pipeline.dem.document``), the laboratory
units gate (``core.unit_gate.enforce_lab``), then the files: ``<root>/dem/jaw-lab.json`` through ``write_json`` and one
``<root>/dem/jaw-lab-<point id>.frames.bin`` per replay. Nothing is written after a refusal. The simulation never runs in CI or in
the browser (ADR-0074, DM-018); a bake takes hours and is an explicit release operation.

The folder of the raw records is the option ``--runs``, or ``<CAOS_DATA_ROOT>/chancadem/dem-runs``; with neither, no record is kept.
"""
from __future__ import annotations

import dataclasses
import os
from collections.abc import Callable
from pathlib import Path

from .. import __version__
from ..core import unit_gate
from ..dem import document, replay, runs
from ..dem.points import DEFAULT_SETTINGS, POINTS, REPLAY_BUDGET_BYTES, SEED, RunSettings
from ..dem.runs import PackageMissing
from ..io.formats import write_json

DOCUMENT = "dem/jaw-lab.json"          # the document, relative to the derived root
DATA_ROOT_ENV = "CAOS_DATA_ROOT"       # the data root of the device (the raw records live under it)
RUNS_UNDER_DATA_ROOT = Path("chancadem") / "dem-runs"

__all__ = ["DOCUMENT", "PackageMissing", "run", "runs_folder"]


def runs_folder(option: str | Path | None, environ: dict | None = None) -> Path | None:
    """The folder of the raw run records: the option, else ``<CAOS_DATA_ROOT>/chancadem/dem-runs``, else None (no record is kept)."""
    if option:
        return Path(option)
    root = (environ if environ is not None else os.environ).get(DATA_ROOT_ENV, "").strip()
    return Path(root) / RUNS_UNDER_DATA_ROOT if root else None


def run(paths, seed: int = SEED, runs_dir: str | Path | None = None, jobs: int = 3, settings: RunSettings | None = None,
        log: Callable[[str], None] = print) -> dict:
    """Run (or load) the three points, build and gate the document, and write it with its replay files under ``paths.root``."""
    runs.require_package()
    settings = dataclasses.replace(settings or DEFAULT_SETTINGS, seed=seed)
    outcome = runs.run_points(POINTS, settings, runs_dir, jobs, log)
    blocks: dict[str, dict] = {}
    files: dict[str, bytes] = {}
    for p in POINTS:
        frames = outcome.runs[p.id].frames
        if frames is not None and len(frames["arrays"]["offsets"]) > 1:       # an attempt that recorded no frame gives replay: null
            data, block = replay.encode(frames, p, REPLAY_BUDGET_BYTES)
            blocks[p.id], files[block["file"]] = block, data
    doc = document.build(outcome.runs, __version__, blocks, settings)
    unit_gate.enforce_lab(doc)                                                  # CONTRACT 3: the laboratory units, before anything is written
    out = paths.root / "dem"
    out.mkdir(parents=True, exist_ok=True)
    for stale in out.glob("jaw-lab-*.frames.bin"):
        stale.unlink()
    write_json(paths.root / DOCUMENT, doc)
    for rel, data in files.items():
        (paths.root / rel).write_bytes(data)
    log(f"dem: {doc['state']} ({len(doc['incomplete'])} of {len(doc['points'])} runs incomplete: {', '.join(doc['incomplete']) or 'none'}) "
        f"-> {paths.root / DOCUMENT}; replay files {', '.join(Path(r).name for r in files) or 'none'}")
    return doc
