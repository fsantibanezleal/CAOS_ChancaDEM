# Deploy

One deploy place per product, written in `deploy/TARGET`: for ChancaDEM it is `pages`, GitHub Pages, a static site with
every artifact committed, no secret and no server at request time (ADR-0055). The custom domain is
`chancadem.fasl-work.com` (`frontend/public/CNAME`). `scripts/check_deploy_place.py` fails a product that carries the
files of two places. The one-time Pages setup (enable Actions as the source, set the domain, the DNS record, enforce
HTTPS) is in [`deploy/pages.md`](../../deploy/pages.md).

## Before a deploy

Locally: the pipeline tests, the canonical bake when the science changed (`data-pipeline/run.py`, and `run.py models`
when the engine changed), then in `frontend/` `npm run build`, `npm test` and `npm run gate`. The gate
(`caos-shell-gate`) serves `dist/` as Pages would, with no fallback, and walks every route, tab and case at five sizes, in
both themes and both languages, and requires Focus mode in the App (ADR-0070). A person reads its captures, written under
`frontend/` in `gate-output/shots`: the gate measures, it does not judge content.

The site's payload is `frontend/dist`, built by `npm run build`: it generates the contract types and checks they are current,
type-checks, bundles and materialises the routes. `frontend/scripts/copy-data.mjs` runs first (the `prebuild` step) and copies
exactly the files the index declares, so a file removed from the bake never lingers in the site.

## The deploy

`.github/workflows/deploy-pages.yml` runs after the CI workflow succeeds on `main`, on that same commit. It checks the
committed artifacts (`scripts/check_artifacts.py`) and the deploy place, picks the base path (`/` when
`frontend/public/CNAME` exists, `/<repository>/` otherwise), builds the site with `npm ci && npm run build`, uploads
`frontend/dist` and deploys it, then runs the live check. It never trains, rebakes or recomputes (ADR-0069, ADR-0074).

## The live check

`scripts/check_live.py --url <site> --sha <commit>` retries for a bounded time while the host's cache catches up and
requires: `build.json` names the pushed commit; every route (`""`, `introduction`, `app`, `methodology`,
`implementation`, `experiments`, `benchmark`) answers 200 with HTML, with and without its trailing slash; a file that does
not exist answers 404; and the artifact index answers JSON. After the deploy, the gate also runs against the deployed
origin: `npm run gate -- --url https://chancadem.fasl-work.com`.

## CI

`.github/workflows/ci.yml`, on `develop` and `main` (ADR-0074, cheap checks on committed files; no pipeline test suite, no
training stack, no bake). A `checks` job: lint, the workflow files parse, contract 2 (`check_artifacts.py`), the version, the
SDD, the notebooks (static), the README areas, animated SVGs, the deploy place, the technology table against the pinned
dependencies, the contract versions against the base, the planted-defect suite (`tests/adversarial`), the contract catalog,
the readiness document, every committed document against its schema, and the list of rows still served by a provider
(allowed on `develop`, an error on `main`). A `web` job: install, build, unit tests (the contract both ways, the engine
parity, the artifact layer), the web baseline. A `guards` job: base integrity, template residue, document paths, content
standards, the CI budget. Every step runs under `bash -eo pipefail`.

The measurement behind this choice is the lane gate (every case is live-eligible, [architecture 03](03_the-gate.md)) and the
committed artifacts' size: `data/derived` holds 65 files, 285678 bytes (2026-10-27).
