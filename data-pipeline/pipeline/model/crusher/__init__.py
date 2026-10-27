"""The canonical Python crusher engine of ChancaDEM: a port of the TypeScript engine in ``frontend/src/engine/``,
held to it by the reference fixture ``tests/fixtures/engine-reference.json``. A module folder of the pipeline run by
path (ADR-0057), not a package with a distribution name. Import with ``data-pipeline`` on ``sys.path``:

    from pipeline.model.crusher import evaluate, Operating
"""
from .campaign import css_at_p80_target, hours_to_target
from .engine import evaluate, grid_edges, grid_mid
from .hp500 import operating_from_survey
from .types import CrusherResult, Operating, PSD

__all__ = ["evaluate", "Operating", "CrusherResult", "PSD", "grid_edges", "grid_mid", "operating_from_survey", "css_at_p80_target", "hours_to_target"]
