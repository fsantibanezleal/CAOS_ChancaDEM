// Materialize a real index.html per focus route.
//
// WHY. GitHub Pages serves `404.html` for an unknown path, so a deep link like /focus/gyratory LOADS via
// the SPA fallback but answers with HTTP 404. ADR-0070 requires the scenario focus route to be shareable
// and teachable from, and a shared link that reports 404 is a real gap against that: link checkers, chat
// unfurls and anything reading the status code sees a broken URL.
//
// The machine ids come from the physics types, so a new crusher gets a shareable focus URL for free.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, 'dist');
const shell = readFileSync(resolve(dist, 'index.html'), 'utf8');

const src = readFileSync(resolve(here, 'src/physics/types.ts'), 'utf8');
const m = src.match(/export type Machine\s*=\s*([^;]+);/);
if (!m) {
  console.error('[prerender] could not parse Machine ids from src/physics/types.ts; refusing to emit a partial route set');
  process.exit(1);
}
const ids = [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]);
if (ids.length === 0) {
  console.error('[prerender] no machine ids parsed; refusing to emit a partial route set');
  process.exit(1);
}

for (const id of ids) {
  const dir = resolve(dist, 'focus', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), shell);
}
console.log(`[prerender] materialized ${ids.length} focus routes -> HTTP 200 deep links (${ids.join(', ')})`);
