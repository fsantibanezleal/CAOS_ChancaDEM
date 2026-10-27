"""pipeline, the offline engine of ChancaDEM (ADR-0057): the two data contracts, the staged pipeline, the lane gate, the
manifest and trace, the units gate and the cases-by-category registry, on the canonical crusher engine in
``pipeline/model/crusher``. A module folder run by path (``python data-pipeline/run.py``), not a distribution."""

from pathlib import Path

# VERSION at the repository root is the only place the version is written (T4); every manifest records it.
__version__ = (Path(__file__).resolve().parents[2] / "VERSION").read_text(encoding="utf-8").strip()
