# 07 — Deploy (GitHub Pages, static deterministic-replay)

ChancaDEM is static-first (no backend at request time). `.github/workflows/deploy-pages.yml` on push to `main`:

1. installs the **light** Python lane (`requirements.txt` + editable pkg, numpy-only — **no torch/Node**) and runs
   `python -m chancalab.pipeline all` to regenerate the per-case traces + manifests from the committed artifacts;
2. builds the SPA (`cd frontend && npm ci && npm run build`; `copy-data.mjs` overlays `data/derived/` into
   `public/`);
3. uploads `frontend/dist` and deploys to Pages.

CI does **not** retrain (the committed ONNX/metrics/case-results are the heavy lane's real outputs; `--retrain`
needs torch + the Node sweep and is local-only).

## Custom domain

Live at **chancadem.fasl-work.com** (custom domain → Vite `base: '/'`; `frontend/public/CNAME` carries it, copied
into `dist/`). The domain is set once on the Pages API via
`gh api PUT repos/fsantibanezleal/CAOS_ChancaDEM/pages -f cname=chancadem.fasl-work.com` (the CNAME file alone does
not set the domain on Actions deploys). A SPA 404-fallback (`vite.config.ts` copies `index.html` → `404.html`) makes
deep links resolve through the router on Pages.

## The dormant VPS path

`deploy/{fasl-slug.service, domain.nginx}` are dormant systemd/nginx templates, used only if `app/` is ever
activated (an ADR-0002 trigger). This solution does not require them at the moment.
