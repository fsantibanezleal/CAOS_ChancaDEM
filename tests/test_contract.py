"""CONTRACT 1 (ingestion) tests: good operating points validate; physically-invalid rows are rejected with a
reason; out-of-envelope / pass-through rows are flagged."""
from chancalab.io.contract import validate_psd, validate_records


def test_good_record_accepted():
    rep = validate_records([
        {"case_id": "s01", "machine": "cone-sec", "cssMm": 32, "throwMm": 30, "speedRpm": 360,
         "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55},
    ])
    assert rep.ok and len(rep.accepted) == 1 and not rep.rejected
    assert rep.accepted[0].machine == "cone-sec"


def test_bad_records_rejected_not_coerced():
    rows = [
        {"case_id": "m", "machine": "ballmill", "cssMm": 32, "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55},  # bad machine
        {"case_id": "n", "machine": "cone-sec", "cssMm": "wide", "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55},  # non-numeric
        {"case_id": "ci", "machine": "cone-sec", "cssMm": 280, "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55},   # CSS > 2.5x feed (invalid)
        {"case_id": "z", "machine": "cone-sec", "cssMm": -1, "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55},      # non-positive
        {"case_id": "miss", "machine": "cone-sec", "cssMm": 32, "throwMm": 30, "speedRpm": 360, "feedX63Mm": 90, "feedM": 1.2},                # missing oreAxb
    ]
    rep = validate_records(rows)
    assert len(rep.accepted) == 0
    assert len(rep.rejected) == len(rows)
    assert all("reason" in r for r in rep.rejected)


def test_passthrough_flagged_but_accepted():
    # CP1-like: CSS (160) >= feed F63 (90) but < 2.5x => accepted + flagged pass-through
    rep = validate_records([
        {"case_id": "cp1", "machine": "cone-sec", "cssMm": 160, "throwMm": 30, "speedRpm": 360,
         "feedX63Mm": 90, "feedM": 1.2, "oreAxb": 55},
    ])
    assert rep.ok and rep.flagged
    assert any("pass-through" in f for f in rep.flagged[0]["flags"])


def test_psd_guard():
    ok, _ = validate_psd([32, 16, 8, 4, 1], [1.0, 0.8, 0.5, 0.3, 0.1])
    assert ok
    bad, reason = validate_psd([8, 16, 32], [0.1, 0.5, 1.0])   # not descending
    assert not bad and "descending" in reason


def test_committed_example_passes_contract():
    from pathlib import Path

    from chancalab.io.formats import read_csv_rows

    csv = Path(__file__).resolve().parents[1] / "data" / "examples" / "operating.csv"
    rep = validate_records(read_csv_rows(csv))
    assert rep.ok and not rep.rejected, f"example operating.csv should pass Contract 1: {rep.summary()}"
