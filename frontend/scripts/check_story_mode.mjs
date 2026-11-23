// The guided story in a browser, on this build (ADR-0082, 0.15.001): what every story owes its reader, whatever its steps. The steps
// are the routes the product declares in product.json, key "showcase": { "story_routes": ["/story/<step>", ...] } (the gate runner
// walks the same list). For each declared route it checks that the route renders the shell's story frame with that step active and
// its numbered marker, and that the stepper links directly to every declared step and to nothing else; then that playback pauses on
// reader input and that the exit lands on the App with its state in the URL. What a product's story shows (its views, its numbers,
// its linked selections) is the product's to test in its own tests; this file holds nothing of one product.
// A product that declares no story is told so here and passes: scripts/check_sdd.py and the shell's G21 fail the missing story.
//   node scripts/check_story_mode.mjs            serves dist/ on a free loopback port
//   node scripts/check_story_mode.mjs <origin>   checks a running build (a preview or a deployed origin)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const product = JSON.parse(readFileSync(join(here, '..', '..', 'product.json'), 'utf8'));
const STORY_ROUTE = /^\/story\/[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const APP_ROUTE = '/app';

const declared = product.showcase?.story_routes;
if (declared === undefined) {
  console.log('check_story_mode: no story is declared in product.json (showcase.story_routes); nothing to check here (scripts/check_sdd.py and G21 fail the missing story, ADR-0082)');
  process.exit(0);
}
if (!Array.isArray(declared) || declared.length === 0 || declared.some((r, i) => typeof r !== 'string' || !STORY_ROUTE.test(r) || declared.indexOf(r) !== i)) {
  console.error(`check_story_mode: product.json showcase.story_routes must be a list of distinct "/story/<step>" routes; it is ${JSON.stringify(declared)}`);
  process.exit(1);
}
const { chromium } = await import('playwright');

let server;
let browser;
try {
  let base = process.argv[2] ? process.argv[2].replace(/\/+$/, '') : null;
  if (!base) {
    const { servePages } = await import('@fasl-work/caos-app-shell/serve');
    server = await servePages(join(here, '..', 'dist'), process.env.VITE_BASE || '/', 0);
    base = server.url.replace(/\/+$/, '');
  }
  const basePath = new URL(base).pathname.replace(/\/+$/, '');
  /** The route a link or a URL addresses, without the origin, the base path and the query. */
  const routeOf = (href) => {
    const path = new URL(href, `${base}/`).pathname.replace(/\/+$/, '') || '/';
    return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  };

  const errors = [];
  // the check talks only to a loopback server: no proxy resolution, which on a machine that auto-detects its proxy stalls the first
  // request of every new browser context about 21 s (CAOS_ChancaDEM 0.13.000, CAOS_MANAGE shell known defect 69)
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of declared) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    const frame = page.locator('[data-story]');
    await frame.waitFor({ state: 'visible', timeout: 15000 });
    const active = page.locator('[data-story-link][aria-current="step"]');
    assert.equal(await active.count(), 1, `${route}: the story frame marks exactly one active step`);
    assert.equal(routeOf(await active.getAttribute('href')), route, `${route}: the active step is the step this route addresses`);
    assert.match(await active.locator('.caos-story-step-number').innerText(), /\d/, `${route}: the active step carries its number`);
    const links = await page.locator('[data-story-link]').evaluateAll((items) => items.map((a) => a.getAttribute('href')));
    assert.deepEqual(links.map(routeOf).sort(), [...declared].sort(), `${route}: the stepper links directly to every declared step and to nothing else`);
  }

  await page.goto(`${base}${declared[0]}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-story]').waitFor({ state: 'visible', timeout: 15000 });
  const play = page.locator('.caos-story-controls button[aria-pressed]').first();
  await play.click();
  assert.equal(await play.getAttribute('aria-pressed'), 'true', 'play starts the story');
  await page.locator(`[data-story-link]`).nth(declared.length > 1 ? 1 : 0).click();
  assert.equal(await page.locator('.caos-story-controls button[aria-pressed]').first().getAttribute('aria-pressed'), 'false', 'reader input pauses playback');

  await page.locator('.caos-story-exit').click();
  await page.waitForURL((url) => routeOf(url.href) === APP_ROUTE, { timeout: 15000 });
  const landed = new URL(page.url());
  assert.ok(landed.search.length > 1 || landed.hash.length > 1, `the exit lands on the App with its state in the URL (landed on ${landed.pathname}${landed.search}${landed.hash})`);
  assert.deepEqual(errors, [], 'no uncaught page errors');
  console.log(`check_story_mode: ${declared.length} declared story steps (${declared.join(', ')}): each renders its numbered step and links every step directly; reader input pauses playback; the exit returns to the App with its state.`);
} finally {
  try {
    await browser?.close();
} finally {
    await server?.close();
  }
}
