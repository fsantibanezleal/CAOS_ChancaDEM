"""Tests l and m of the brief (Spec 1): the exact-route runner is deterministic and independent of the worker count, its
replicate data are the verification sampler's, and the sampler runner's plumbing works on a tiny sampler size."""
from __future__ import annotations

import json

import numpy as np
import pytest

import run_exact
import run_sampler
from conftest import SMALL_POOL

CELL = "V0-real-n10"
TINY = ["--walkers", "20", "--steps", "30", "--burn", "10", "--thin", "1"]


def _exact(out, cache, workers, force=False):
    argv = ["--only", CELL, "V1_a2_k0-surveys-n10", "--reps", "20", "--n-test", "10", "--pool-size", str(SMALL_POOL),
            "--out", str(out), "--cache", str(cache), "--workers", str(workers)]
    assert run_exact.main(argv + (["--force"] if force else [])) == 0


# ---- l. byte-identical summaries for 1 and 2 workers and for two runs; the verify replicates are run_exact's ----
def test_l_exact_deterministic_and_shared_replicates(tmp_path, cache_dir):
    a, b, c = tmp_path / "a", tmp_path / "b", tmp_path / "c"
    _exact(a, cache_dir, 1)
    _exact(b, cache_dir, 2)
    _exact(c, cache_dir, 1, force=True)
    names = sorted(p.name for p in (a / "exact").glob("*.json"))
    assert names == sorted([f"{CELL}.json", "V1_a2_k0-surveys-n10.json"])
    for name in names:
        ba, bb, bc = ((d / "exact" / name).read_bytes() for d in (a, b, c))
        assert ba == bb == bc, name
        doc = json.loads(ba)
        assert doc["schema"] == "chancadem.cbt.exact/v1"
        assert set(doc["inputs_sha256"]) and doc["code_commit"]
        assert all(np.isfinite(v) for v in doc["theory_z"].values())
    # resumable: an existing summary is skipped without --force
    before = (a / "exact" / f"{CELL}.json").stat().st_mtime_ns
    _exact(a, cache_dir, 1)
    assert (a / "exact" / f"{CELL}.json").stat().st_mtime_ns == before
    # the verification sampler draws the same replicate data
    arrays = np.load(run_exact.replicate_cache_path(cache_dir, CELL, 20, 10, SMALL_POOL))
    ctx = run_sampler.verify_context([CELL], cache_dir, workers=1, pool_size=SMALL_POOL)
    for rep in (0, 7, 19):
        data = run_sampler.verify_replicate(ctx, CELL, rep, n_test=10, n_test_exact=10)
        assert np.array_equal(data["train_idx"], arrays["train_idx"][rep])
        assert np.array_equal(data["test_idx"], arrays["test_idx"][rep])
        assert np.array_equal(data["y_train"].astype(np.float32), arrays["y_train"][rep])
        assert np.array_equal(data["y_test"].astype(np.float32), arrays["y_test"][rep])


# ---- m. the sampler runner on one posterior per mode at a tiny sampler size ----
def test_m_sampler_plumbing(tmp_path, cache_dir):
    out, data = tmp_path / "sampler", tmp_path / "data"
    assert run_sampler.main(["sbc", "--n", "1", "--workers", "1", "--out", str(out), *TINY]) == 0
    sbc = json.loads((out / "sbc" / "sbc-0000.json").read_text(encoding="utf-8"))
    assert sbc["schema"] == "chancadem.cbt.sbc-posterior/v1"
    assert len(sbc["ranks"]) == 16 and all(0 <= r <= 99 for r in sbc["ranks"].values())
    assert 0 <= sbc["rank_loglik"] <= 99 and "tau_max" in sbc["convergence"] and sbc["wall_seconds"] > 0
    assert run_sampler.main(["verify", "--cells", CELL, "--reps", "1", "--n-test", "5", "--n-test-exact", "10", "--pred-draws", "20",
                             "--pool-size", str(SMALL_POOL), "--cache", str(cache_dir), "--workers", "1",
                             "--out", str(out), *TINY]) == 0
    ver = json.loads((out / "verify" / f"{CELL}-r0000.json").read_text(encoding="utf-8"))
    for t in ("tph", "kW"):
        row = ver["outputs"][t]
        assert len(row["sampler"]["mean"]) == 5
        assert {"cb_oracle", "cb_ko", "ls"} <= set(row["exact"])
    # a second call skips the existing posteriors
    assert run_sampler.main(["sbc", "--n", "1", "--workers", "1", "--out", str(out), *TINY]) == 0
    assert run_sampler.main(["summarize", "--out", str(out), "--data", str(data)]) == 0
    s = json.loads((data / "sbc.json").read_text(encoding="utf-8"))
    v = json.loads((data / "verify.json").read_text(encoding="utf-8"))
    assert s["schema"] == "chancadem.cbt.sbc/v1" and s["n_posteriors"] == 1
    assert v["schema"] == "chancadem.cbt.verify/v1" and CELL in v["cells"]
    # the band against the true-scalar band, per output and pooled over the posteriors (one posterior here)
    row = ver["outputs"]["kW"]
    gap = row["sampler"]["coverage80"] - row["exact"]["cb_oracle"]["coverage80"]
    o = v["cells"][CELL]["outputs"]["kW"]
    assert o["paired_coverage80"]["sampler_minus_cb_oracle"]["mean"] == pytest.approx(gap)
    assert o["width_ratio"]["sampler_over_cb_oracle"]["mean"] == pytest.approx(
        row["sampler"]["width"] / row["exact"]["cb_oracle"]["width"])
    outs = [t for t in ("tph", "kW") if ver["outputs"][t]["exact"]]
    pooled_gap = np.mean([ver["outputs"][t]["sampler"]["coverage80"] - ver["outputs"][t]["exact"]["cb_oracle"]["coverage80"]
                          for t in outs])
    assert v["pooled"]["coverage80_sampler_minus_cb_oracle"]["mean"] == pytest.approx(pooled_gap)
