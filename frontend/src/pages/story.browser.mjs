// ChancaDEM's own story checks in a browser, on this build (SH-005 to SH-008, SH-010), run by `npm run gate` after the base's
// scripts/check_story_mode.mjs (which checks what every story owes, whatever its steps) and before the shell gate (G21). What only this
// product's story can be asked: every step's headline and three callouts with a value, a unit and a source; a planted key press that
// stops autoplay for good; the exit landing on the step's case, group and view, with the Operate target kept (M5 of the 0.13.000 review);
// the Solve stage opening at the pass its headline names; the Measure stage drawing the ten surveys' feed rates; the scene and the panel
// selecting each other both ways; the
// survey scrubber opening that survey; reduced motion stopping the circuit's flow; then the drawing checks of src/views/showcase.browser.mjs. Nothing here holds a number of the product: the
// numbers are proven in src/pages/Story.test.tsx against the committed documents.
//   node src/pages/story.browser.mjs            serves dist/ on a free loopback port
//   node src/pages/story.browser.mjs <origin>   checks a running build
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, '..', '..');
const product = JSON.parse(readFileSync(join(frontend, '..', 'product.json'), 'utf8'));
const steps = product.showcase.story_routes.map((r) => r.replace('/story/', ''));
const GROUP = { measure: 'system', inside: 'system', solve: 'product', compare: 'validation', operate: 'performance' };
const SUB = { measure: 'circuit', inside: 'chamber', solve: 'passes', compare: 'compare', operate: 'campaign' };
assert.deepEqual(Object.keys(GROUP), steps, 'the steps declared in product.json are the five this check knows');
const { chromium } = await import('playwright');

let server;
let base = process.argv[2] ? process.argv[2].replace(/\/+$/, '') : null;
if (!base) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(frontend, 'scripts', 'serve.mjs'), '--host', '127.0.0.1', '--port', String(port)], { cwd: frontend, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 60 && !ready; i += 1) {
    try {
      ready = (await fetch(base)).ok;
    } catch {
      /* starting */
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) {
    server.kill();
    throw new Error('story.browser: the build server did not start');
  }
}

const CASE = 'HP500-04';
const errors = [];
const browser = await chromium.launch({ headless: true });
let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  const open = async (step, extra = '') => {
    await page.goto(`${base}/story/${step}?case=${CASE}${extra}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-story]').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('[data-story] [data-stage] [data-caos-callout]').length >= 3, null, { timeout: 20000 });
  };

  // SH-005, SH-007: each step, its headline and its three callouts; SH-006: its exit
  for (const step of steps) {
    await open(step);
    const facts = await page.evaluate(() => ({
      step: document.querySelector('[data-story]')?.getAttribute('data-story-step'),
      headline: document.querySelector('[data-story-headline]')?.textContent?.trim() ?? '',
      calls: [...document.querySelectorAll('[data-story] [data-stage] [data-caos-callout]')].map((c) => ({
        value: c.getAttribute('data-callout-value'),
        unit: c.getAttribute('data-callout-unit'),
        source: c.getAttribute('data-callout-source'),
      })),
    }));
    ok(facts.step === step, `${step}: the deep link opens its own step (got ${facts.step})`);
    ok(/\d/.test(facts.headline) && facts.headline.split(/\s+/).length <= 12, `${step}: the headline states a number in at most 12 words ("${facts.headline}")`);
    ok(!/\b(NaN|undefined|null)\b/.test(facts.headline), `${step}: the headline holds no placeholder`);
    ok(facts.calls.length >= 3, `${step}: ${facts.calls.length} callouts on the stage`);
    for (const c of facts.calls) ok(c.value?.trim() && c.unit?.trim() && c.source?.trim(), `${step}: a callout without its value, unit or source (${JSON.stringify(c)})`);
    if (step === 'operate') ok(!/\bh\b|hour/i.test(facts.headline), `operate: the headline states no hours ("${facts.headline}")`);
    if (step === 'solve') {
      const k = Number((facts.headline.match(/(\d+) pass/) ?? [])[1]);
      const at = await page.locator('[data-story] [data-stage-panel] [data-pass-count]').first().getAttribute('data-pass-count');
      ok(Number(at) === k, `solve: the step opens at the pass its headline names (${k}), not at ${at}`);
    }
    if (step === 'measure') {
      const marks = await page.locator('[data-story] [data-stage] [data-feed-mark]').count();
      const strip = await page.locator('[data-story] [data-stage] [data-feed-strip]').first();
      ok(marks === 10, `measure: the stage draws the ten surveys' feed rates (${marks} marks)`);
      ok(facts.headline.includes(Number(await strip.getAttribute('data-feed-min')).toLocaleString('en-US')), 'measure: the lowest feed rate of the headline is drawn on the stage');
    }
    const storyTarget = step === 'operate' ? await page.locator('[data-story] [data-stage] [data-caos-callout="target"]').first().getAttribute('data-callout-value') : null;
    await page.locator('.caos-story-exit').click();
    await page.waitForURL((u) => u.pathname.replace(/\/+$/, '') === '/app', { timeout: 15000 });
    const landed = new URL(page.url());
    ok(landed.searchParams.get('case') === CASE, `${step}: the exit lands on the story's case (${landed.search})`);
    ok(landed.searchParams.get('view') === GROUP[step], `${step}: the exit opens the step's group ${GROUP[step]} (${landed.search})`);
    await page.locator(`[data-case-workbench] [role="tab"][data-tab="${GROUP[step]}"][aria-selected="true"]`).first().waitFor({ timeout: 15000 });
    ok(landed.searchParams.get('sub') === SUB[step], `${step}: the exit names the step's view ${SUB[step]} (${landed.search})`);
    await page.locator(`[data-case-workbench] .subtab.active[id$="-subtab-${SUB[step]}"]`).first().waitFor({ timeout: 15000 });
    ok(true, `${step}: the App opens the step's view ${SUB[step]}`);
    if (step === 'operate') {
      await page.locator('[data-case-workbench] [data-caos-callout="target"]').first().waitFor({ timeout: 15000 });
      const appTarget = await page.locator('[data-case-workbench] [data-caos-callout="target"]').first().getAttribute('data-callout-value');
      ok(appTarget === storyTarget, `operate: the App keeps the story's target (${storyTarget} mm), got ${appTarget}`);
    }
  }

  // SH-006: a planted key press stops autoplay, and it stays stopped past the autoplay interval
  await open('measure');
  const play = page.locator('.caos-story-controls button[aria-pressed]').first();
  await play.click();
  ok((await play.getAttribute('aria-pressed')) === 'true', 'play starts the story');
  await page.locator('[data-story] [data-stage-panel] input[type="range"]').first().focus();
  await page.keyboard.press('Shift');
  ok((await play.getAttribute('aria-pressed')) === 'false', 'a key press in the panel pauses autoplay');
  await page.waitForTimeout(5600);
  ok((await page.locator('[data-story]').getAttribute('data-story-step')) === 'measure', 'autoplay does not continue after the key press');
  // the keyboard: Space plays and pauses at the frame, the arrows move one step
  await page.locator('[data-story]').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-story]')?.getAttribute('data-story-step') === 'inside', null, { timeout: 5000 });
  ok(true, 'ArrowRight moves to the next step');

  // SH-008: the scene and the panel select each other, both ways
  await open('measure');
  const sceneFeed = page.locator('[data-story] [data-stage] [data-linked-view="scene"][data-linked-id="stream:feed"]').first();
  const panelFeed = page.locator('[data-story] [data-stage-panel] [data-linked-view="panel"][data-linked-id="stream:feed"]').first();
  await sceneFeed.dispatchEvent('click');
  await page.waitForTimeout(100);
  ok((await panelFeed.getAttribute('data-linked-selected')) === 'true', 'the feed stream selected on the flowsheet is selected in the table');
  const panelStage = page.locator('[data-story] [data-stage-panel] [data-linked-view="panel"][data-linked-id="stage:secondary"]').first();
  await panelStage.click();
  await page.waitForTimeout(100);
  ok(
    (await page.locator('[data-story] [data-stage] [data-linked-view="scene"][data-linked-id="stage:secondary"]').first().getAttribute('data-linked-selected')) === 'true',
    'the stage selected in the panel is selected on the flowsheet',
  );
  ok((await sceneFeed.getAttribute('data-linked-selected')) === 'false', 'a new selection replaces the old one on the flowsheet');

  // the survey scrubber opens that survey: the URL, the marker on the stage and the measured values follow it
  const scrubber = page.locator('[data-story] [data-linked-cursor]').first();
  await scrubber.evaluate((el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '7');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForURL((u) => u.searchParams.get('case') === 'HP500-07', { timeout: 10000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-story] [data-linked-cursor-marker]')].every((m) => m.getAttribute('data-linked-cursor-position') === '7'), null, {
    timeout: 5000,
  });
  await page.waitForFunction(() => /Survey 7 of Rocha/.test(document.querySelector('[data-story] [data-streams]')?.textContent ?? ''), null, { timeout: 10000 });
  ok(true, 'the survey scrubber opens survey 7 on the stage and in the panel');

  // SH-003: reduced motion stops the circuit's flow
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open('measure');
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.classList?.contains('cdem-stream-flow') && a.playState === 'running').length);
  const moving = await page.locator('[data-story] [data-flow="moving"]').count();
  ok(running === 0 && moving === 0, `reduced motion: ${running} flow animations running, ${moving} streams moving`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open('measure');
  ok((await page.locator('[data-story] [data-flow="moving"]').count()) === 2, 'with motion allowed the two streams of the active stage move');

  assert.deepEqual(errors, [], 'no uncaught page errors');
  const storyChecks = checks;
  // the drawings of the App and the story (src/views/showcase.browser.mjs): anchors within 4 px, staged step changes, nothing cut, the
  // comparison readable on a phone, one chart per view, the 3D parts selected both ways
  const { showcaseChecks } = await import('../views/showcase.browser.mjs');
  const drawn = await showcaseChecks({ browser, base, ok });
  console.log(
    `story.browser: ${storyChecks} checks on ${steps.length} steps (${steps.join(', ')}): headlines, callouts, exits with their view and target, the opening states, the pause on a key press, the two-way selection, the survey scrubber and reduced motion; ${checks - storyChecks} drawing checks (worst anchor ${drawn.worstAnchorPx?.toFixed(1)} px): anchors, staged step changes, cut eyebrows and values, method labels, one chart per view, the table header, the panel's scroll cue and the 3D parts.`,
  );
} finally {
  await browser.close();
  server?.kill();
}
