"""Run the laboratory-jaw case of the package ``crushdem`` at the operating points and keep the raw run records (DM-001, DM-002,
DM-008, DM-010).

``run_point`` calls the package's ``run_case`` with frames and returns the raw record: what ``run_case`` returned, with the wall
times and dates removed, and the frames of the final attempt. ``run_points`` runs the points in separate processes (spawn: below
4,000 spheres the package's kernels run serially, so the points run side by side) and, with a folder, loads a point's record
instead of running it when one exists under the same key, and saves what it ran the moment its run ends, before anything is
encoded. The key is the sha256 digest of the point, the settings, the package version and the bytes of every file of the installed
package, so a different build never matches. A record that fails to load is run again and replaced.

A run that does not complete is a result to record, never to repair (DM-003): nothing here changes a setting to make one finish.
"""
from __future__ import annotations

import concurrent.futures
import dataclasses
import hashlib
import importlib.util
import json
import multiprocessing
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import numpy as np

from .points import DEFAULT_SETTINGS, POINTS, ROLE, Point, RunSettings, by_id

MISSING_PACKAGE = ("the package crushdem is not installed: the discrete element runs need it. Install the precompute environment, "
                   "`uv pip install --python .venv-pipeline/Scripts/python.exe -r requirements-precompute.txt` "
                   "(the pins are in requirements-precompute.txt)")
FRAME_ARRAYS = ("x_m", "y_m", "z_m", "radius_m", "offsets", "t_s", "stroke", "plate")   # the arrays of a Frames object kept in the npz
WALL_KEYS = ("wall_time_s", "wall_s", "started_utc", "finished_utc", "invocation")      # what the raw record drops: wall times and dates


class PackageMissing(RuntimeError):
    """crushdem is not installed (the message names requirements-precompute.txt)."""


@dataclass
class RawRun:
    """One point's run: the JSON record (no wall time), the final attempt's frames, and where it came from."""

    point: Point
    record: dict
    frames: dict | None            # {"arrays": {name: ndarray}, "chamber": dict, "spec": [first, last, per_stroke], "reason": str | None}
    key: str
    wall_s: float | None = None    # not part of the record: the wall time of the run that made it, kept for the report only
    origin: str = "ran"            # "ran" or "loaded"


@dataclass
class Outcome:
    runs: dict[str, RawRun] = field(default_factory=dict)
    ran: list[str] = field(default_factory=list)
    loaded: list[str] = field(default_factory=list)


def require_package() -> None:
    """Refuse, naming requirements-precompute.txt, when crushdem cannot be imported (the command never skips silently)."""
    try:
        import crushdem  # noqa: F401
    except ImportError as exc:
        raise PackageMissing(MISSING_PACKAGE) from exc


def package_version() -> str:
    try:
        from importlib.metadata import version

        return version("crushdem")
    except Exception as exc:  # not installed
        raise PackageMissing(MISSING_PACKAGE) from exc


_FILES_DIGEST: dict[str, str] = {}


def package_digest() -> str:
    """The sha256 digest of every file of the installed ``crushdem`` package (relative path and bytes, sorted), cached per process."""
    spec = importlib.util.find_spec("crushdem")
    if spec is None or not spec.submodule_search_locations:
        raise PackageMissing(MISSING_PACKAGE)
    root = Path(next(iter(spec.submodule_search_locations)))
    if str(root) not in _FILES_DIGEST:
        h = hashlib.sha256()
        for f in sorted(p for p in root.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"):
            h.update(f.relative_to(root).as_posix().encode("utf-8") + b"\0")
            h.update(f.read_bytes())
            h.update(b"\0")
        _FILES_DIGEST[str(root)] = h.hexdigest()
    return _FILES_DIGEST[str(root)]


def run_key(point: Point, settings: RunSettings) -> str:
    """The key of a raw record: the point, the settings, the package version and the bytes of the installed package."""
    require_package()
    payload = {"point": dataclasses.asdict(point), "settings": dataclasses.asdict(settings), "package": package_version(),
               "files": package_digest()}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _jsonable(x: Any) -> Any:
    """The JSON form of what the package returns: numpy scalars and arrays become numbers and lists, a tuple a list."""
    if isinstance(x, dict):
        return {str(k): _jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_jsonable(v) for v in x]
    if isinstance(x, np.ndarray):
        return [_jsonable(v) for v in x.tolist()]
    if isinstance(x, np.generic):
        return x.item()
    return x


def _drop_wall(x: Any) -> Any:
    if isinstance(x, dict):
        return {k: _drop_wall(v) for k, v in x.items() if k not in WALL_KEYS}
    if isinstance(x, list):
        return [_drop_wall(v) for v in x]
    return x


def _spec(settings: RunSettings) -> dict:
    return {"ore": settings.ore, "mass_kg": settings.mass_kg, "frequency_hz": settings.frequency_hz, "role": ROLE}


def run_point(point: Point, settings: RunSettings = DEFAULT_SETTINGS) -> RawRun:
    """Run one point through the package's ``run_case`` and return its raw record and the final attempt's frames."""
    try:
        from crushdem.cases import barrios2020 as case
    except ImportError as exc:
        raise PackageMissing(MISSING_PACKAGE) from exc
    frame_spec = case.FrameSpec(*settings.frames) if settings.frames is not None else None
    t0 = time.perf_counter()
    result = case.run_case(point.id, _spec(settings), settings.seed, settings.backend, list(settings.overlaps), point.capacity,
                           settings.max_strokes, settings.max_wall_s, settings.stall_strokes, case.load_digitised(), True,
                           feed_class=point.feed_class, closed_side_setting=settings.closed_side_setting_m, frames=frame_spec)
    wall = time.perf_counter() - t0
    final = result["attempts"][result["final_attempt"]]
    frames = None
    if final.get("frames") is not None:
        fr = final["frames"]
        frames = {"arrays": {n: np.asarray(getattr(fr, n)) for n in FRAME_ARRAYS}, "chamber": _jsonable(dataclasses.asdict(fr.chamber)),
                  "spec": [fr.spec.first_stroke, fr.spec.last_stroke, fr.spec.per_stroke], "reason": fr.reason}
    for att in result["attempts"]:
        att.pop("frames", None)
    record = _drop_wall(_jsonable(result))
    return RawRun(point=point, record=record, frames=frames, key=run_key(point, settings), wall_s=wall)


# --- the raw-record folder ---------------------------------------------------------------------------------------------------

def _paths(runs_dir: Path, point: Point, key: str) -> tuple[Path, Path, Path]:
    stem = f"{point.id}-{key[:16]}"
    return runs_dir / f"{stem}.json", runs_dir / f"{stem}.frames.npz", runs_dir / f"{stem}.wall.json"


def save_raw(runs_dir: Path, raw: RawRun) -> None:
    """Write a raw record: the JSON (record, frames metadata, key), the frames' npz and a wall-time sidecar (never part of the record)."""
    runs_dir.mkdir(parents=True, exist_ok=True)
    js, npz, wall = _paths(runs_dir, raw.point, raw.key)
    meta = None if raw.frames is None else {k: raw.frames[k] for k in ("chamber", "spec", "reason")}
    if raw.frames is not None:
        np.savez_compressed(npz, **raw.frames["arrays"])
    else:
        npz.unlink(missing_ok=True)
    js.write_text(json.dumps({"key": raw.key, "point": raw.point.id, "record": raw.record, "frames_meta": meta}, separators=(",", ":")),
                  encoding="utf-8")
    wall.write_text(json.dumps({"wall_s": raw.wall_s}), encoding="utf-8")


def load_raw(runs_dir: Path, point: Point, key: str) -> RawRun | None:
    """The raw record saved under ``key``, or None when there is none or it fails to load (it is then run again and replaced)."""
    js, npz, wall = _paths(runs_dir, point, key)
    try:
        doc = json.loads(js.read_text(encoding="utf-8"))
        if doc["key"] != key or doc["point"] != point.id:
            return None
        meta = doc["frames_meta"]
        frames = None
        if meta is not None:
            with np.load(npz) as z:
                arrays = {n: z[n] for n in FRAME_ARRAYS}
            if int(arrays["offsets"][-1]) != len(arrays["x_m"]):
                return None
            frames = {"arrays": arrays, **meta}
        try:
            wall_s = json.loads(wall.read_text(encoding="utf-8")).get("wall_s")
        except (OSError, ValueError):
            wall_s = None
        return RawRun(point=point, record=doc["record"], frames=frames, key=key, wall_s=wall_s, origin="loaded")
    except (OSError, ValueError, KeyError, TypeError):
        return None


def _worker(point_id: str, settings: dict, runs_dir: str | None) -> RawRun:
    """The process of one run: the run, then its record saved at once, before anything is encoded."""
    st = RunSettings(**{**settings, "overlaps": tuple(settings["overlaps"]),
                        "frames": None if settings["frames"] is None else tuple(settings["frames"])})
    raw = run_point(by_id(point_id), st)
    if runs_dir:
        save_raw(Path(runs_dir), raw)
    return raw


def run_points(points=POINTS, settings: RunSettings = DEFAULT_SETTINGS, runs_dir: str | Path | None = None, jobs: int = 3,
               log: Callable[[str], None] = print) -> Outcome:
    """Every point's raw run: loaded from ``runs_dir`` when a record exists under the same key, run otherwise (in at most ``jobs``
    spawned processes, each saved as soon as it ends). The log says which points ran and which were loaded."""
    folder = Path(runs_dir) if runs_dir else None
    out = Outcome()
    todo: list[Point] = []
    for p in points:
        raw = load_raw(folder, p, run_key(p, settings)) if folder is not None else None
        if raw is None:
            todo.append(p)
        else:
            out.runs[p.id] = raw
            out.loaded.append(p.id)
    if todo:
        ctx = multiprocessing.get_context("spawn")
        sdict = dataclasses.asdict(settings)
        with concurrent.futures.ProcessPoolExecutor(max_workers=max(1, min(jobs, len(todo))), mp_context=ctx) as pool:
            futures = {pool.submit(_worker, p.id, sdict, str(folder) if folder else None): p for p in todo}
            for fut in concurrent.futures.as_completed(futures):
                p = futures[fut]
                out.runs[p.id] = fut.result()
                out.ran.append(p.id)
                log(f"dem: point {p.id} ran in {out.runs[p.id].wall_s:.0f} s of wall time, "
                    f"status {out.runs[p.id].record['attempts'][-1]['status']}")
    out.runs = {p.id: out.runs[p.id] for p in points}
    log(f"dem: ran {', '.join(out.ran) or 'nothing'}; loaded from the raw records {', '.join(out.loaded) or 'nothing'}")
    return out
