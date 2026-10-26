# Requirements: the README states the repository by areas

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.
The README has a section `## Areas` with one row per area of the convention (CAOS_MANAGE
`conventions/product-notebooks.md`, section 8): Web, API, Core pipelines, Packages, Notebooks, Data, Contracts,
Documentation, Tests and gates, Deploy. Each row links its folder, says whether the area is active or dormant (with the
reason) and says what the area holds. The check is `scripts/check_readme_areas.py`, run by CI and locally.

| ID | Requirement | Gate |
|---|---|---|
| RP-001 | THE README SHALL have a section Areas. | `tests/test_check_readme_areas.py::test_a_readme_without_the_areas_section_is_found` |
| RP-002 | THE Areas section SHALL have one row for each area of the convention. | `tests/test_check_readme_areas.py::test_an_area_without_its_row_is_found` |
| RP-003 | EACH area row SHALL state its status, active or dormant, and a dormant one SHALL give its reason. | `tests/test_check_readme_areas.py::test_a_row_without_a_status_is_found` |
| RP-004 | EACH area row SHALL link its folder, and the folder SHALL exist. | `tests/test_check_readme_areas.py::test_a_folder_link_that_does_not_exist_is_found` |
| RP-005 | THE Packages row SHALL link each package on PyPI. | `tests/test_check_readme_areas.py::test_the_packages_row_must_link_pypi` |
| RP-006 | THE README that the instantiate step writes for a product SHALL pass the check. | `tests/test_check_readme_areas.py::test_the_readme_instantiate_writes_states_every_area` |
| RP-007 | THE template's own README SHALL state every area. | `tests/test_check_readme_areas.py::test_the_template_readme_states_every_area` |
| RP-008 | THE Areas section SHALL come after the one-paragraph purpose and the live URLs. | `tests/test_check_readme_areas.py::test_the_areas_section_follows_the_purpose_and_the_live_urls` |
| RP-009 | EACH area row SHALL say what the area holds in three words or more. | `tests/test_check_readme_areas.py::test_what_it_holds_is_more_than_a_dash` |
| RP-010 | EVERY relative link of an area row, the area's own README or doc included, SHALL resolve to a path of the repository. | `tests/test_check_readme_areas.py::test_a_dead_link_in_what_it_holds_is_found` |
