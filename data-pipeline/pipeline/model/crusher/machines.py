"""Per-machine design (reference) eccentric throw [mm]. Counterpart of ``frontend/src/engine/machines.ts``.

It matches each machine's nominal operating point and is the throw the illustrative synthetic baselines are
centered on: at the design throw the classification window and the per-event breakage energy are unchanged from the
pre-throw-model baseline. Throw is the horizontal eccentric stroke, so OSS = CSS + throw; a larger throw opens the
chamber, larger particles escape during the open phase, and the Whiten capture threshold K2 rises (a coarser
product at fixed CSS, higher capacity: the Evertsson and OEM direction).
"""
from __future__ import annotations

REF_THROW_MM: dict[str, float] = {
    "cone-sec": 30,
    "cone-tert": 16,
    "cone-short-head": 16,
    "gyratory": 30,
    "jaw": 38,
}
