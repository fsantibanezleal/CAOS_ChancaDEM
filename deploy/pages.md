# Deploy — GitHub Pages (default, static deterministic-replay)

The default deploy for this archetype (ADR-0055 Pages-first): the SPA + the committed artifacts are served
statically; there is **no backend** at request time. The workflow `.github/workflows/deploy-pages.yml`:

1. regenerates the replay layer deterministically (`python -m chancalab.pipeline all`, numpy-only — the committed
   ONNX/metrics/case-results are the heavy lane's real outputs; CI does NOT retrain) so the site replays fresh,
   audited per-case traces + manifests;
2. builds the frontend (`cd frontend && npm ci && npm run build` — `copy-data.mjs` overlays `data/derived` into
   `public/`);
3. uploads `frontend/dist` and deploys to Pages.

ChancaDEM is live at **chancadem.fasl-work.com** (`frontend/public/CNAME`). Enable once: repo **Settings → Pages →
Source = GitHub Actions**. The domain is set via
`gh api PUT repos/fsantibanezleal/CAOS_ChancaDEM/pages -f cname=chancadem.fasl-work.com` (the CNAME file alone does
not set the domain on Actions deploys — see the CAOS_MANAGE reference note).

The VPS path (`setup.sh`/`update.sh` + the systemd/nginx templates here) stays **dormant** unless the `app/`
backend is activated (ADR-0002).
