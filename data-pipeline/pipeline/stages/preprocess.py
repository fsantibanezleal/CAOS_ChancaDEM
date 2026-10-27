"""Stage 1, preprocess: read the raw parameter table and apply CONTRACT 1 (schema + outlier policy).
Output = a ContractReport (accepted ParamsRecord + rejected rows + flags). The bring-your-own-data entry point."""
from __future__ import annotations

from pathlib import Path

from ..io.contract import ContractReport, read_params


def run(params_csv: str | Path) -> ContractReport:
    return read_params(Path(params_csv))
