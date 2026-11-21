"""The replay file of an operating point: the particle frames of the final attempt, thinned to a byte budget and packed (DM-010).

One record per sphere of four little-endian unsigned 16-bit integers (x, y, z, radius), each on a linear range fixed from the
chamber's geometry and the feed class and never from the data's extremes; a sphere outside its range is an error, never clipped.
The frames file is the spheres of the frames one after another, in frame order; the document's replay block holds what a viewer
needs to read it (the frame times, strokes and counts, the swing plate's bottom edge, the ranges and the chamber in millimetres).

Thinning: the frames are recorded at ``FRAMES_PER_STROKE`` per stroke; the file keeps the largest of 12, 6, 4, 3, 2 or 1 frames per
stroke whose file is at most the budget, always keeping the frame at the end of each stroke. A run that stopped in a stroke keeps
the frames up to its stop. Numbers in the block are rounded with ``r6`` like every document of the pipeline.
"""
from __future__ import annotations

import hashlib

import numpy as np

from ..core.trace import r6
from .points import THINNING, Point

RECORD = "uint16le x, uint16le y, uint16le z, uint16le radius"   # the schema's constant for one sphere
RECORD_BYTES = 8                  # four 16-bit integers per sphere [bytes]
LEVELS = 65535                    # the largest 16-bit value: the number of steps of a linear range [steps]
MM_PER_M = 1000.0                 # [mm/m]
RADIUS_MARGIN = 1.05              # the radius range is the feed class's largest radius with this margin [dimensionless]
DECIMALS_MM = 3                   # the ranges are held to a micrometre [mm]


class RangeError(ValueError):
    """A sphere lies outside the range its 16-bit scale spans (the range is fixed from the geometry, so this is a defect to report)."""


class BudgetError(ValueError):
    """Not even one frame per stroke fits the byte budget."""


def file_name(point: Point) -> str:
    return f"dem/jaw-lab-{point.id}.frames.bin"


def ranges_mm(chamber: dict, point: Point) -> dict:
    """The linear ranges of the 16-bit scales [mm]: one gape on each side of the opening in x, the cheeks' width on each side of the
    centre plane in y, one gape below the discharge level and up to the hopper's top in z, and the feed class's largest radius."""
    gape = chamber["top_gap_m"] * MM_PER_M
    width = chamber["width_m"] * MM_PER_M
    x = (chamber["fixed_plate_x_m"] * MM_PER_M - gape, chamber["top_gap_m"] * MM_PER_M + gape)
    y = (-width, width)
    z = (chamber["discharge_z_m"] * MM_PER_M - gape, (chamber["fixed_plate_z_m"][1] + chamber["hopper_height_m"]) * MM_PER_M)
    return {"x_range_mm": [round(v, DECIMALS_MM) for v in x], "y_range_mm": [round(v, DECIMALS_MM) for v in y],
            "z_range_mm": [round(v, DECIMALS_MM) for v in z], "radius_max_mm": round(point.upper_mm / 2.0 * RADIUS_MARGIN, DECIMALS_MM)}


def geometry_mm(chamber: dict) -> dict:
    """The chamber in millimetres, so a viewer draws it without the package."""
    return {"fixed_plate_x_mm": r6(chamber["fixed_plate_x_m"] * MM_PER_M),
            "fixed_plate_z_mm": [r6(v * MM_PER_M) for v in chamber["fixed_plate_z_m"]],
            "swing_pivot_mm": [r6(chamber["pivot_m"][0] * MM_PER_M), r6(chamber["pivot_m"][2] * MM_PER_M)],
            "swing_closed_bottom_mm": [r6(chamber["swing_plate_closed_bottom_edge_m"][0] * MM_PER_M),
                                       r6(chamber["swing_plate_closed_bottom_edge_m"][2] * MM_PER_M)],
            "discharge_z_mm": r6(chamber["discharge_z_m"] * MM_PER_M), "hopper_height_mm": r6(chamber["hopper_height_m"] * MM_PER_M),
            "width_mm": r6(chamber["width_m"] * MM_PER_M)}


def _quantise(values_mm: np.ndarray, lo: float, hi: float, what: str) -> np.ndarray:
    if values_mm.size and (values_mm.min() < lo or values_mm.max() > hi):
        raise RangeError(f"{what}: spheres span {values_mm.min():.3f} to {values_mm.max():.3f} mm, outside the range {lo} to {hi} mm "
                         "fixed from the chamber's geometry; the frames are not clipped")
    return np.rint((values_mm - lo) / (hi - lo) * LEVELS).astype("<u2")


def _kept(strokes: np.ndarray, recorded: int, rate: int) -> np.ndarray:
    """The frames kept at ``rate`` frames per stroke: the frame j of a stroke (counted from 1) when j is a multiple of recorded/rate."""
    step = recorded // rate
    index = np.zeros(len(strokes), dtype=np.int64)
    seen: dict[int, int] = {}
    for i, s in enumerate(strokes.tolist()):
        seen[s] = seen.get(s, 0) + 1
        index[i] = seen[s]
    return index % step == 0


def encode(frames: dict, point: Point, budget_bytes: int) -> tuple[bytes, dict]:
    """The replay file of ``frames`` (a raw run's frames: the arrays, the chamber, the frame spec) and the document's replay block."""
    a, chamber = frames["arrays"], frames["chamber"]
    recorded = int(frames["spec"][2])
    counts = np.diff(a["offsets"]).astype(np.int64)
    rates = [k for k in THINNING if k <= recorded and recorded % k == 0]
    chosen = None
    for k in rates:
        keep = _kept(a["stroke"], recorded, k)
        if RECORD_BYTES * int(counts[keep].sum()) <= budget_bytes:
            chosen = (k, keep)
            break
    if chosen is None:
        raise BudgetError(f"point {point.id}: not even {rates[-1]} frame per stroke fits {budget_bytes} bytes "
                          f"({RECORD_BYTES * int(counts[_kept(a['stroke'], recorded, rates[-1])].sum())} bytes)")
    rate, keep = chosen
    rng = ranges_mm(chamber, point)
    sphere_keep = np.repeat(keep, counts)
    mm = {n: a[f"{n}_m"][sphere_keep].astype(np.float64) * MM_PER_M for n in ("x", "y", "z", "radius")}
    cols = [_quantise(mm["x"], *rng["x_range_mm"], "x"), _quantise(mm["y"], *rng["y_range_mm"], "y"),
            _quantise(mm["z"], *rng["z_range_mm"], "z"), _quantise(mm["radius"], 0.0, rng["radius_max_mm"], "radius")]
    data = np.stack(cols, axis=1).astype("<u2").tobytes()
    px, pz = chamber["pivot_m"][0], chamber["pivot_m"][2]
    length = chamber["plate_length_m"]
    plate_x = a["plate"][keep][:, 1].astype(np.float64)                       # the swing plate's bottom edge x [m], from the package's motion law
    plate_z = pz - np.sqrt(np.maximum(length**2 - (plate_x - px) ** 2, 0.0))    # z from the pivot, the plate's length and x [m]
    strokes = a["stroke"][keep]
    block = {
        "file": file_name(point), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "first_stroke": int(strokes.min()), "last_stroke": int(strokes.max()), "frames_per_stroke": int(rate), "frames": int(keep.sum()),
        "spheres": int(counts[keep].sum()), "t_s": [r6(float(t)) for t in a["t_s"][keep]], "stroke": [int(s) for s in strokes],
        "plate_bottom_x_mm": [r6(float(v) * MM_PER_M) for v in plate_x], "plate_bottom_z_mm": [r6(float(v) * MM_PER_M) for v in plate_z],
        "count": [int(c) for c in counts[keep]],
        "encoding": {"record": RECORD, **rng}, "geometry": geometry_mm(chamber),
    }
    return data, block


def decode(data: bytes, block: dict) -> dict:
    """The spheres of a replay file back in millimetres, over all frames: ``x``, ``y``, ``z``, ``radius`` (within half a quantisation step)."""
    raw = np.frombuffer(data, dtype="<u2").reshape(-1, 4).astype(np.float64)
    e = block["encoding"]
    out = {}
    for i, (name, key) in enumerate((("x", "x_range_mm"), ("y", "y_range_mm"), ("z", "z_range_mm"))):
        lo, hi = e[key]
        out[name] = lo + raw[:, i] / LEVELS * (hi - lo)
    out["radius"] = raw[:, 3] / LEVELS * e["radius_max_mm"]
    return out


__all__ = ["BudgetError", "RangeError", "decode", "encode", "file_name", "geometry_mm", "ranges_mm"]
