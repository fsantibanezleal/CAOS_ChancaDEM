// Prebuild overlay: copy the committed CONTRACT-2 artifacts (../data/derived) into the SPA's public/ so the static
// site serves them. Canonical copies live in ../data/derived — public/ is a build-time overlay (git-ignored). The
// served paths match what frontend/src/lib/ort.ts + physics/surrogate.ts fetch (root: /surrogate.onnx, /psd-ae.onnx,
// /scaler.json, /ae_scaler.json, /ae_threshold.json, /surrogate_metrics.json); manifests + per-case traces +
// case-results go under /data/ for the CONTRACT-2 index loader.
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DERIVED = join(ROOT, 'data', 'derived');
const PUB = join(HERE, 'public');

if (!existsSync(DERIVED)) {
  console.warn('[copy-data] no data/derived — run scripts/precompute first');
  process.exit(0);
}
mkdirSync(PUB, { recursive: true });

// 1) the live-lane artifacts the SPA fetches from the site root (paths frozen in ort.ts + physics/surrogate.ts)
const rootArtifacts = [
  ['models/surrogate.onnx', 'surrogate.onnx'],
  ['models/surrogate.int8.onnx', 'surrogate.int8.onnx'],
  ['models/psd-ae.onnx', 'psd-ae.onnx'],
  ['scaler.json', 'scaler.json'],
  ['ae_scaler.json', 'ae_scaler.json'],
  ['ae_threshold.json', 'ae_threshold.json'],
  ['surrogate_metrics.json', 'surrogate_metrics.json'],
];
for (const [src, dst] of rootArtifacts) {
  const from = join(DERIVED, src);
  if (existsSync(from)) copyFileSync(from, join(PUB, dst));
  else console.warn(`[copy-data] missing ${src} — run scripts/precompute (or --retrain)`);
}

// 2) the CONTRACT-2 manifests + per-case traces + case-results -> public/data (the index loader reads /data/manifests/index.json)
mkdirSync(join(PUB, 'data'), { recursive: true });
cpSync(DERIVED, join(PUB, 'data'), {
  recursive: true,
  filter: (s) => !s.includes(join('derived', 'models')), // models already overlaid at root; skip the dup
});
console.log('[copy-data] data/derived -> public/ (root artifacts + /data manifests+traces+case-results) OK');
