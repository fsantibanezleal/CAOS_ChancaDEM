# Adversarial validation: the README by areas

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or
refuted, and the test that plants it, on a copy of the template's own README with the real guard run as a subprocess.
`scripts/check_sdd.py` fails when a requirement has no row here (or two), when a check is empty, and when a gate names a
test that does not exist.

| requirement | adversarial check | gate |
|---|---|---|
| RP-001 | the heading of the Areas section is renamed back to What is in it: the check fails | `tests/adversarial/test_notebooks_refuted.py::test_a_readme_without_areas_is_found` |
| RP-002 | the Notebooks row is deleted from the README: the check names the area | `tests/adversarial/test_notebooks_refuted.py::test_a_dropped_area_row_is_found` |
| RP-003 | the status of the Data row is replaced by a phrase that is neither active nor dormant, and the reason of the dormant API row is removed: both fail | `tests/adversarial/test_notebooks_refuted.py::test_a_row_with_no_status_is_found` |
| RP-004 | the deploy folder is removed while its row still links it: the check names the dead link | `tests/adversarial/test_notebooks_refuted.py::test_a_dead_folder_link_is_found` |
| RP-005 | the PyPI and repository links are removed from the Packages row: the check fails | `tests/adversarial/test_notebooks_refuted.py::test_a_packages_row_without_pypi_is_found` |
| RP-006 | the instantiate script is planted to omit the areas, and the README it writes is checked: the check fails | `tests/adversarial/test_notebooks_refuted.py::test_an_instantiate_that_drops_the_areas_writes_a_failing_readme` |
| RP-007 | the Areas heading of the template README is renamed in a copy and the check run on that copy: it fails, so a template without the section cannot pass | `tests/adversarial/test_notebooks_refuted.py::test_a_readme_without_areas_is_found` |
| RP-008 | the Areas section of the template README is moved to just under the title, before the purpose and the live URLs: the check fails | `tests/adversarial/test_notebooks_refuted.py::test_the_areas_section_before_the_purpose_is_found` |
| RP-009 | the What it holds cell of the Data row is replaced by a dash: the check names the area | `tests/adversarial/test_notebooks_refuted.py::test_a_row_that_holds_a_dash_is_found` |
| RP-010 | the guide link of the Notebooks row is pointed at a document that does not exist: the check names the link | `tests/adversarial/test_notebooks_refuted.py::test_a_dead_document_link_in_a_row_is_found` |
