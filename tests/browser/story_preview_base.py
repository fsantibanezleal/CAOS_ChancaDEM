"""Local Chromium release checks, explicitly invoked after installing Playwright.

Run pytest on this file with an external --basetemp. Hosted unit CI does not
collect this browser entry point. The Node suite drives the actual shared checker.
"""
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def run_browser_check(name, tmp_path):
    result = subprocess.run(
        ["node", "--test", "--test-name-pattern", name, "tests/browser/story_preview_base.mjs"],
        cwd=ROOT,
        env={**os.environ, "CAOS_TEMP_ROOT": str(tmp_path)},
        capture_output=True,
        text=True,
        timeout=100,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_adversarial_pages_subpaths_and_nested_mounts(tmp_path):
    run_browser_check("Pages subpaths", tmp_path)


def test_adversarial_supplied_origin_overrides_local_mount(tmp_path):
    run_browser_check("supplied origin", tmp_path)


def test_adversarial_failed_browser_launch_closes_preview(tmp_path):
    run_browser_check("failed Chromium launch", tmp_path)
