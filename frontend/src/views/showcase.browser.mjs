// The drawing checks of the showcase in a browser, on this build (ADR-0082 rules 2, 4, 5, 8 and 9; the 0.13.000 review's B3, B4, M2, M4,
// M8, M9, M12, m3, m7, m8 and m10), run by src/pages/story.browser.mjs (`npm run check:story`) after the story's own checks. Each check
// measures the rendered page, never the product's own record of what it meant to draw:
//   anchors   every chart callout's leader ends within 4 px of drawn ink of its chart (the uPlot canvas, read pixel by pixel and
//             composited over the card), and the nip angle's leader on the drawn nip wedge, at 390 and 1280, with and without reduced motion;
//   frames    a step change is staged: right after Next the callouts are not all final, and they all are by the end; with reduced motion
//             every callout is final at once;
//   cut       no callout eyebrow or value is cut (scrollWidth over clientWidth) at 390 and 1280, in en and es;
//   axis      no two method labels of the comparison touch, and no method button is cut, at 390 and 1280;
//   primary   the population balance and the comparison open on one chart;
//   parts     the 3D chamber names its four parts, and a part selected in 3D is selected in the section and the reverse;
//   header    the chamber's table header is whole at 1280; a story panel that scrolls says so.
//   node src/views/showcase.browser.mjs <origin>   checks a running build on its own
import assert from 'node:assert/strict';

export const MAX_ANCHOR_PX = 4;
const SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

const APP = {
  V2: '/app?case=S01&view=system&sub=chamber',
  V3: '/app?case=S01&view=product&sub=gradation',
  V5: '/app?case=S01&view=product&sub=passes',
  V4: '/app?case=S01&view=performance&sub=campaign',
  V6: '/app?case=S01&view=validation&sub=compare',
};
const STORY = (step) => `/story/${step}?case=HP500-01`;

async function context(browser, { size, lang = 'en', theme = 'dark', reduced = true }) {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: theme });
  await ctx.addInitScript(
    ([l, t]) => {
      try {
        localStorage.setItem('caos.lang', l);
        localStorage.setItem('caos.theme', t);
      } catch {
        /* storage blocked: the defaults hold */
      }
    },
    [lang, theme],
  );
  return ctx;
}

async function openTarget(page, base, url, minCallouts = 3) {
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((n) => [...document.querySelectorAll('[data-caos-callout]')].filter((c) => c.getBoundingClientRect().width > 0).length >= n, minCallouts, { timeout: 25000 });
  // the charts are built once sized; the staged entry of a story step ends within 2.5 s
  await page.waitForTimeout(2600);
}

/** The callouts of the visible callout layers, with each leader's end in page pixels. */
async function leaderEnds(page) {
  return page.evaluate(() => {
    const out = [];
    for (const layer of document.querySelectorAll('[data-caos-callout-layer]')) {
      const r = layer.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const svg = layer.querySelector('svg.caos-callout-leaders');
      const vb = svg.viewBox.baseVal;
      for (const line of svg.querySelectorAll('line[data-caos-callout-leader]')) {
        const x = r.left + (line.x1.baseVal.value * r.width) / Math.max(1, vb.width);
        const y = r.top + (line.y1.baseVal.value * r.height) / Math.max(1, vb.height);
        out.push({ id: line.getAttribute('data-caos-callout-leader'), x, y, chart: Boolean(layer.parentElement?.querySelector('.uplot canvas')) });
      }
    }
    return out;
  });
}

/** The distance in CSS px from (x, y) to the nearest drawn pixel of the chart under it (the reviewer's measure, on the canvas itself). */
async function inkDistance(page, x, y, radius = 14) {
  return page.evaluate(
    ([x, y, radius]) => {
      const canvas = [...document.querySelectorAll('.uplot canvas')].find((c) => {
        const r = c.getBoundingClientRect();
        return x >= r.left - radius && x <= r.right + radius && y >= r.top - radius && y <= r.bottom + radius && r.width > 0;
      });
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / r.width;
      const card = canvas.closest('.caos-plot, .caos-story-stage') ?? document.body;
      const bg = getComputedStyle(card).backgroundColor.match(/[\d.]+/g).map(Number);
      const bgLum = (bg[0] + bg[1] + bg[2]) / 3;
      const cx = (x - r.left) * k;
      const cy = (y - r.top) * k;
      const R = Math.ceil(radius * k);
      const x0 = Math.max(0, Math.floor(cx - R));
      const y0 = Math.max(0, Math.floor(cy - R));
      const w = Math.min(canvas.width, Math.ceil(cx + R)) - x0;
      const h = Math.min(canvas.height, Math.ceil(cy + R)) - y0;
      if (w <= 0 || h <= 0) return null;
      const data = canvas.getContext('2d').getImageData(x0, y0, w, h).data;
      let best = Infinity;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const o = (j * w + i) * 4;
          const a = data[o + 3] / 255;
          if (a === 0) continue;
          const c = [0, 1, 2].map((q) => a * data[o + q] + (1 - a) * bg[q]);
          const chroma = Math.max(...c) - Math.min(...c);
          const lum = (c[0] + c[1] + c[2]) / 3;
          if (chroma < 60 && Math.abs(lum - bgLum) < 70) continue;
          const d = Math.hypot(x0 + i + 0.5 - cx, y0 + j + 0.5 - cy) / k;
          if (d < best) best = d;
        }
      return Number.isFinite(best) ? best : null;
    },
    [x, y, radius],
  );
}

/** The distance in CSS px from (x, y) to the drawn nip wedge (sampled with elementsFromPoint on rings of growing radius). */
async function wedgeDistance(page, x, y) {
  return page.evaluate(([x, y]) => {
    for (let r = 0; r <= 12; r += 1)
      for (let a = 0; a < 360; a += r === 0 ? 360 : 15) {
        const px = x + r * Math.cos((a * Math.PI) / 180);
        const py = y + r * Math.sin((a * Math.PI) / 180);
        if (document.elementsFromPoint(px, py).some((el) => el.closest('[data-nip-wedge]'))) return r;
      }
    return null;
  }, [x, y]);
}

async function anchorChecks(browser, base, ok) {
  const charts = [
    ['V3', APP.V3],
    ['V5', APP.V5],
    ['V4', APP.V4],
    ['V6', APP.V6],
    ['solve', STORY('solve')],
    ['compare', STORY('compare')],
    ['operate', STORY('operate')],
  ];
  const nip = [
    ['V2', APP.V2],
    ['inside', STORY('inside')],
  ];
  let worst = 0;
  // SHOWCASE_TARGETS=operate,V2 narrows a run by hand to the named targets (a debugging aid; the check runs them all)
  const pick = (process.env.SHOWCASE_TARGETS ?? '').split(',').filter(Boolean);
  if (pick.length) {
    for (const list of [charts, nip]) list.splice(0, list.length, ...list.filter(([name]) => pick.includes(name)));
  }
  for (const size of SIZES)
    for (const reduced of [true, false]) {
      const ctx = await context(browser, { size, reduced });
      const page = await ctx.newPage();
      for (const [name, url] of charts) {
        await openTarget(page, base, url);
        const ends = (await leaderEnds(page)).filter((e) => e.chart);
        ok(ends.length >= 3, `anchors ${name} ${size.width} ${reduced ? 'reduced' : 'motion'}: ${ends.length} chart leaders`);
        for (const e of ends) {
          const d = await inkDistance(page, e.x, e.y);
          worst = Math.max(worst, d ?? Infinity);
          if (process.env.SHOWCASE_DEBUG === '1') console.log(name, e.id, size.width, reduced, Math.round(e.x), Math.round(e.y), d);
          ok(d !== null && d <= MAX_ANCHOR_PX, `anchors ${name}:${e.id} at ${size.width} ${reduced ? 'reduced' : 'motion'}: the leader ends ${d === null ? 'on no drawn pixel' : `${d.toFixed(1)} px`} from its chart's ink (at most ${MAX_ANCHOR_PX})`);
        }
      }
      for (const [name, url] of nip) {
        await openTarget(page, base, url);
        // a point is hit-tested only inside the viewport: the section comes into view first (at 390 px it stacks below the 3D view)
        await page.locator('[data-chart="chamber-slice"]').first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const e = (await leaderEnds(page)).find((l) => l.id === 'nip');
        ok(Boolean(e), `anchors ${name}: the NIP ANGLE callout has a leader`);
        const d = await wedgeDistance(page, e.x, e.y);
        ok(d !== null && d <= MAX_ANCHOR_PX, `anchors ${name}:nip at ${size.width} ${reduced ? 'reduced' : 'motion'}: the leader ends ${d === null ? 'off the nip wedge' : `${d} px`} from the drawn nip angle (at most ${MAX_ANCHOR_PX})`);
      }
      await ctx.close();
    }
  return worst;
}

/** One step change sampled in the page: Next pressed, then the new step's callouts read at the given times. */
async function stepFrames(page, times) {
  return page.evaluate(async (times) => {
    const next = [...document.querySelectorAll('.caos-story-controls button')].find((b) => /^(Next|Siguiente)$/.test(b.textContent.trim()));
    const before = document.querySelector('[data-story]')?.getAttribute('data-story-step');
    const t0 = performance.now();
    next.click();
    const sample = () => {
      const step = document.querySelector('[data-story]')?.getAttribute('data-story-step');
      const calls = [...document.querySelectorAll('[data-story] [data-stage] [data-caos-callout]')].map((c) => {
        let op = 1;
        for (let el = c; el && el !== document.body; el = el.parentElement) op *= Number(getComputedStyle(el).opacity);
        return Math.round(op * 100) / 100;
      });
      return { t: Math.round(performance.now() - t0), step, changed: step !== before, calls };
    };
    const out = [];
    for (const T of times) {
      const wait = T - (performance.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      await new Promise((r) => requestAnimationFrame(() => r()));
      out.push(sample());
    }
    return out;
  }, times);
}

async function frameChecks(browser, base, ok) {
  const steps = ['measure', 'inside', 'solve', 'compare', 'operate'];
  const report = [];
  for (const reduced of [false, true]) {
    const ctx = await context(browser, { size: SIZES[0], reduced });
    const page = await ctx.newPage();
    for (let i = 1; i < steps.length; i++) {
      await openTarget(page, base, STORY(steps[i - 1]));
      const frames = await stepFrames(page, [0, 150, 400, 900, 2600]);
      report.push({ reduced, step: steps[i], frames });
      const first = frames.find((f) => f.changed && f.calls.length >= 3);
      const last = frames[frames.length - 1];
      ok(last.changed && last.calls.length >= 3 && last.calls.every((o) => o >= 0.99), `frames ${steps[i]} ${reduced ? 'reduced' : 'motion'}: every callout reaches its final state (${JSON.stringify(last.calls)})`);
      if (reduced) ok(first && first.calls.every((o) => o >= 0.99), `frames ${steps[i]} reduced: the first frame of the new step shows every callout final at once (${JSON.stringify(first)})`);
      else ok(!first || !(first.t <= 200 && first.calls.every((o) => o >= 0.99)), `frames ${steps[i]} motion: the first frame after Next is not already the final state of every callout (${JSON.stringify(frames.slice(0, 3))})`);
      if (!reduced) {
        const at400 = frames[2];
        ok(at400.calls.some((o) => o < 0.99) || frames[1].calls.some((o) => o < 0.99), `frames ${steps[i]} motion: the callouts enter one by one (150 ms ${JSON.stringify(frames[1].calls)}, 400 ms ${JSON.stringify(at400.calls)})`);
      }
    }
    await ctx.close();
  }
  return report;
}

/** Per page: cut eyebrows and values, touching method labels, cut method buttons, charts on the opening stage, the table header. */
async function layoutProbe(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const cut = [];
    for (const c of document.querySelectorAll('[data-caos-callout]')) {
      if (!visible(c)) continue;
      for (const part of [c.querySelector('.caos-callout-eyebrow'), c.querySelector(':scope > strong')]) if (part && part.scrollWidth > part.clientWidth + 0.5) cut.push(`${c.getAttribute('data-caos-callout')}: "${part.textContent}"`);
    }
    const touching = [];
    for (const host of document.querySelectorAll('[data-x-tick-labels]')) {
      if (!visible(host) || !host.closest('[data-recommended]')) continue;
      const labels = host.getAttribute('data-x-tick-labels').split('|');
      const view = (host.getAttribute('data-view-x') ?? '').split(',').map(Number);
      const over = host.querySelector('.u-over')?.getBoundingClientRect();
      if (!over || view.length !== 2) continue;
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `11px ${getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif'}`;
      const px = (v) => ((v - view[0]) / (view[1] - view[0])) * over.width;
      for (let i = 0; i + 1 < labels.length; i++) {
        const gap = px(i + 2) - px(i + 1) - (ctx.measureText(labels[i]).width + ctx.measureText(labels[i + 1]).width) / 2;
        if (gap < 2) touching.push(`${labels[i]} | ${labels[i + 1]} (${gap.toFixed(1)} px)`);
      }
    }
    const buttons = [];
    for (const b of document.querySelectorAll('[data-linked-id^="method:"][data-linked-view="panel"]')) {
      if (!visible(b)) continue;
      const box = b.closest('.caos-plot, .cdem-story-dock, .caos-story-panel')?.getBoundingClientRect();
      const r = b.getBoundingClientRect();
      if ((box && r.right > box.right + 0.5) || r.right > document.documentElement.clientWidth + 0.5 || b.scrollWidth > b.clientWidth + 0.5) buttons.push(b.textContent);
    }
    const charts = [...document.querySelectorAll('[data-case-workbench] .uplot')].filter(visible).length;
    const heads = [];
    for (const th of document.querySelectorAll('[data-case-workbench] .caos-table th')) {
      if (!visible(th)) continue;
      const wrap = th.closest('.cdem-tablewrap')?.getBoundingClientRect();
      const r = th.getBoundingClientRect();
      if (th.scrollWidth > th.clientWidth + 0.5 || (wrap && r.right > wrap.right + 0.5)) heads.push(th.textContent);
    }
    const docks = [...document.querySelectorAll('.cdem-story-dock')].filter(visible).map((d) => ({
      scrolls: d.scrollHeight > d.clientHeight + 1 && getComputedStyle(d).overflowY !== 'visible',
      cue: d.getAttribute('data-overflow') === 'true' && [...d.parentElement.querySelectorAll('[data-scroll-cue]')].some(visible),
    }));
    return { cut, touching, buttons, charts, heads, docks };
  });
}

async function layoutChecks(browser, base, ok) {
  const targets = [
    ['V1', '/app?case=S01&view=system&sub=circuit'],
    ['V2', APP.V2],
    ['V3', APP.V3],
    ['V5', APP.V5],
    ['V4', APP.V4],
    ['V6', APP.V6],
    ...['measure', 'inside', 'solve', 'compare', 'operate'].map((s) => [s, STORY(s)]),
  ];
  for (const size of SIZES)
    for (const lang of ['en', 'es']) {
      const ctx = await context(browser, { size, lang, theme: lang === 'es' ? 'light' : 'dark' });
      const page = await ctx.newPage();
      for (const [name, url] of targets) {
        await openTarget(page, base, url);
        const p = await layoutProbe(page);
        const at = `${name} ${size.width} ${lang}`;
        ok(p.cut.length === 0, `cut ${at}: no callout eyebrow or value is cut (${p.cut.join('; ')})`);
        if (name === 'V6' || name === 'compare') {
          ok(p.touching.length === 0, `axis ${at}: no two method labels touch (${p.touching.join('; ')})`);
          ok(p.buttons.length === 0, `axis ${at}: no method button is cut (${p.buttons.join('; ')})`);
        }
        if (name === 'V5' || name === 'V6') ok(p.charts === 1, `primary ${at}: the view opens on one chart (${p.charts} charts drawn)`);
        if (name === 'V2' && size.width === 1280) ok(p.heads.length === 0, `header ${at}: the chamber table's header is whole (${p.heads.join('; ')})`);
        for (const d of p.docks) ok(!d.scrolls || d.cue, `scroll ${at}: a story panel that scrolls shows that it does`);
      }
      await ctx.close();
    }
}

async function partChecks(browser, base, ok) {
  const ctx = await context(browser, { size: SIZES[0] });
  const page = await ctx.newPage();
  await openTarget(page, base, APP.V2);
  await page.locator('[data-part-label]').first().waitFor({ timeout: 20000 });
  const parts = await page.locator('[data-part-label]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part-label')));
  ok(['mantle', 'concave', 'gap', 'feed'].every((p) => parts.includes(p)), `parts: the 3D chamber names mantle, concave, gap and feed (${parts.join(', ')})`);
  for (const part of ['mantle', 'concave', 'gap', 'feed']) {
    await page.locator(`[data-part-label="${part}"]`).first().click();
    await page.waitForTimeout(150);
    const inSection = await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:${part}"]`).first().getAttribute('data-linked-selected');
    ok(inSection === 'true', `parts: ${part} selected in 3D is selected in the section (${inSection})`);
  }
  for (const part of ['concave', 'gap']) {
    await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:${part}"]`).first().dispatchEvent('click');
    await page.waitForTimeout(150);
    const in3d = await page.locator(`[data-part-label="${part}"]`).first().getAttribute('data-linked-selected');
    ok(in3d === 'true', `parts: ${part} selected in the section is selected in 3D (${in3d})`);
  }
  // a click on the canvas itself picks the part under the pointer (the scene's raycast)
  const at = await page.locator('[data-part-label="mantle"]').first().getAttribute('data-part-at');
  const [px, py] = (at ?? '').split(',').map(Number);
  const canvas = await page.locator('.chamber3d-canvas canvas').first().boundingBox();
  await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:gap"]`).first().dispatchEvent('click');
  await page.mouse.click(canvas.x + px, canvas.y + py);
  await page.waitForTimeout(150);
  const picked = await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:mantle"]`).first().getAttribute('data-linked-selected');
  ok(picked === 'true', `parts: a click on the mantle in the canvas selects the mantle (${picked})`);
  await ctx.close();
}

/** Every drawing check; `ok(cond, msg)` counts and asserts. Returns what the report quotes. */
export async function showcaseChecks({ browser, base, ok, only = null }) {
  const run = (name) => !only || only.includes(name);
  const out = {};
  // a group that cannot run to its end (an element that never appears) is one failed check with its reason
  const guard = async (name, fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e;
      ok(false, `${name}: ${String(e.message ?? e).split(/\r?\n/)[0]}`);
      return undefined;
    }
  };
  if (run('anchors')) out.worstAnchorPx = await guard('anchors', () => anchorChecks(browser, base, ok));
  if (run('frames')) out.frames = await guard('frames', () => frameChecks(browser, base, ok));
  if (run('layout')) await guard('layout', () => layoutChecks(browser, base, ok));
  if (run('parts')) await guard('parts', () => partChecks(browser, base, ok));
  return out;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\//, '')}`) {
  const base = (process.argv[2] ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('usage: node src/views/showcase.browser.mjs <origin> [anchors,frames,layout,parts]');
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  let checks = 0;
  const failures = [];
  const soft = process.env.SHOWCASE_SOFT === '1';
  const ok = (cond, msg) => {
    checks += 1;
    if (soft) {
      if (!cond) failures.push(msg);
    } else assert.ok(cond, msg);
  };
  try {
    const out = await showcaseChecks({ browser, base, ok, only });
    if (process.env.SHOWCASE_FRAMES === '1') console.log(JSON.stringify(out.frames));
    for (const f of failures) console.log(`FAIL ${f}`);
    console.log(`showcase.browser: ${checks} checks, ${failures.length} failed; worst anchor ${out.worstAnchorPx?.toFixed?.(1) ?? 'n/a'} px`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
