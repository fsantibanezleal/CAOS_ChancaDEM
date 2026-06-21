"""Stage 1 — preprocess (heavy lane): read the Latin-hypercube sweep (produced by sweep/gen_sweep.mjs, the SAME TS
engine the browser runs) and apply CONTRACT 1 over the operating points. Returns the valid train/test rows. The
sweep itself already discards physically-invalid draws (they become the AE's negative set). NumPy/stdlib only."""
from __future__ import annotations

import json
from pathlib import Path

from ..io.contract import validate_records


def _load(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [r for r in rows if r.get("valid")]


def run(sweep_dir: str, train_name: str = "cz-sweep.jsonl", test_name: str = "cz-sweep-test.jsonl") -> dict:
    sweep = Path(sweep_dir)
    tr = _load(sweep / train_name)
    te = _load(sweep / test_name)
    # prove the ingestion gate over a representative slice of the operating points
    sample_rows = [{"case_id": f"sweep{i}", **{k: r[k] for k in
                    ("machine", "cssMm", "throwMm", "speedRpm", "feedX63Mm", "feedM", "oreAxb")}}
                   for i, r in enumerate(tr[:200])]
    report = validate_records(sample_rows)
    return {"train": tr, "test": te, "report": report}
