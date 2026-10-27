# Guide, run the API (dormant)

The `app/` FastAPI backend is **dormant**. ChancaDEM is a static deterministic-replay site: the frontend reads the committed
artifacts in `data/derived/` directly, and the deploy place is GitHub Pages. Activate the API only on an ADR-0002 trigger
(server-side processing of uploaded data, auth-gated private data, paid heavy compute); none applies today.

## What it is

A thin read-only layer over `data/derived`, GET only, never a re-implementation of the engine
(`docs/contracts/api.openapi.json`, catalog row `api`):

| Endpoint | Serves |
|---|---|
| `GET /api/cases` | the index of the 27 cases |
| `GET /api/cases/{case_id}/manifest` | one manifest (404 for an unknown case) |
| `GET /api/artifacts/{path}` | any artifact under `data/derived`, for instance a case's trace or `hp500/loo.json` (404 if absent) |
| `GET /api/readiness` | the committed readiness document with the `api` row set to available |
| `GET /health`, `GET /healthz` | liveness |

A document the route needs that is absent or not JSON answers **503** with `{"detail": {"state": "missing", "reason": {...}}}`,
never an empty body and never a 500 (`app/routers/content.py`). Nothing outside `data/derived` is read
(`tests/test_dormant_api.py`).

## To activate

1. Uncomment and keep exact the pins in `requirements-api.txt` (`fastapi==0.143.0`, `uvicorn[standard]==0.54.0`, verified by
   the contract tests); `scripts/setup.sh` or `setup.ps1` then also builds `.venv`, because any uncommented line there means
   the API lane is active.
2. `uvicorn app.main:app --reload`, or `scripts/dev.sh` / `scripts/dev.ps1`, which start it automatically when it is
   active. Environment: `DATA_DIR` (default `data/derived`; point it at `docs/contracts/fixtures/data/derived` to serve the
   provider tree), `APP_ENV`, `APP_HOST`, `APP_PORT`, `DEV_ORIGINS`, `PROD_ORIGINS` (`app/config.py`).
3. Move the deploy place to a host with a backend only deliberately: `deploy/TARGET` and `scripts/check_deploy_place.py`
   allow one place, and the VPS templates are not part of this product's files.

The contract tests (`tests/contracts/test_api.py`) run it with `fastapi` and `httpx` from `requirements-dev.txt` without
activating the lane: every response is validated against the OpenAPI document, and a swap test runs the same assertions on
the provider tree and on the bake.
