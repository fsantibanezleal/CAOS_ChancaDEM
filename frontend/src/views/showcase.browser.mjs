// The drawing checks of the showcase in a browser, on this build (ADR-0082 rules 2, 4, 5, 8 and 9; the 0.13.000 review's B3, B4, M2, M4,
// M8, M9, M12, m3, m7, m8 and m10), run by src/pages/story.browser.mjs (`npm run check:story`) after the story's own checks. Each check
// measures the rendered page, never the product's own record of what it meant to draw:
//   anchors   every chart callout's leader ends within 4 px of the point it names on the scales uPlot rendered (read from where uPlot
//             drew each axis's tick labels, never from any drawn pixel: a gridline under a 16 px miss passed the ink measure of F3b, N4),
//             a planted 16 px miss is caught (its self-test), and the nip angle's leader on the drawn nip wedge, at 390 and 1280, with
//             and without reduced motion, and at 390 again after a resize to the document's height (a full-page capture, N5);
//   frames    a step change is staged: right after Next the callouts are not all final, and they all are by the end, and no frame draws
//             a card of the new step before its entry (N8); with reduced motion every callout is final at once;
//   cut       no callout eyebrow or value is cut (scrollWidth over clientWidth) at 390 and 1280, in en and es;
//   axis      no two method labels of the comparison touch, and no method button is cut, at 390 and 1280;
//   primary   the population balance and the comparison open on one chart;
//   parts     the 3D chamber names its four parts, and a part selected in 3D is selected in the section with its callout, and the
//             reverse, at 1280 and 390 (M9);
//   blank     20 fresh loads at 390 of App V4 and the story's Compare, in en and es, each with a full-page capture: no load without
//             its chart's canvas (N5);
//   pills     no lane pill of a card covers the card's controls (N2); the story's Compare stage states how sure its ranking is (N3);
//   header    the chamber's table header is whole at 1280; a story panel that scrolls says so;
//   overlap   no two callout cards intersect, and no two leaders cross, at 390 and 1280 in en and es (M1, M3; shell 0.24.0).
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
  // the text uPlot draws on each canvas, with its position in canvas pixels: the axes' tick labels stand at valToPos of their values,
  // so they give the scales uPlot rendered (the anchor measure, pointDistance); reset when the canvas is cleared for a new draw
  await ctx.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      const m = this.getTransform();
      (this.canvas.__caosTexts ??= []).push({ t: String(text), x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, align: this.textAlign, base: this.textBaseline, turned: m.b !== 0 });
      return fill.apply(this, arguments);
    };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, w, h) {
      if (x <= 0 && y <= 0 && w >= this.canvas.width && h >= this.canvas.height) this.canvas.__caosTexts = [];
      return clear.apply(this, arguments);
    };
  });
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
        const host = layer.closest('[data-anchor-points]');
        out.push({ id: line.getAttribute('data-caos-callout-leader'), x, y, chart: Boolean(layer.parentElement?.querySelector('.uplot canvas')), host: host ? [...document.querySelectorAll('[data-anchor-points]')].indexOf(host) : -1 });
      }
    }
    return out;
  });
}

/**
 * The distance in CSS px from a leader's end to the point its callout names (the Definitions of the re-check: the marker's computed
 * centre, uPlot's valToPos of the point on the rendered scales, never a drawn pixel). The point is the host's data-anchor-points entry
 * of the callout, in data units; the scales are the ones uPlot rendered, read from where uPlot drew each axis's tick labels (each at
 * valToPos of its value, fitted linear or logarithmic within 1.5 px), the x axis of named ticks from data-view-x on the plot area.
 * Null when the point or a scale cannot be read, which the check counts as a miss.
 */
async function pointDistance(page, e) {
  return page.evaluate((e) => {
    const host = document.querySelectorAll('[data-anchor-points]')[e.host];
    if (!host) return null;
    const point = JSON.parse(host.getAttribute('data-anchor-points') || '[]').find((p) => p.id === e.id);
    const canvas = host.querySelector('.uplot canvas');
    const over = host.querySelector('.u-over')?.getBoundingClientRect();
    if (!point || !canvas || !over) return null;
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width;
    const parse = (t) => {
      const s = t.replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '').trim();
      const pct = s.endsWith('%');
      const v = Number(pct ? s.slice(0, -1) : s);
      return s && Number.isFinite(v) ? (pct ? v / 100 : v) : null;
    };
    const fit = (pairs) => {
      const vs = new Set(pairs.map((p) => p.v));
      if (vs.size < 2) return null;
      let best = null;
      // a logarithmic axis only when every label is positive (a linear axis from 0 is never refitted on its positive labels alone)
      for (const log of pairs.every((p) => p.v > 0) ? [false, true] : [false]) {
        const use = pairs.map((p) => ({ u: log ? Math.log10(p.v) : p.v, px: p.px }));
        const n = use.length;
        const mu = use.reduce((a, p) => a + p.u, 0) / n;
        const mp = use.reduce((a, p) => a + p.px, 0) / n;
        const b = use.reduce((a, p) => a + (p.u - mu) * (p.px - mp), 0) / (use.reduce((a, p) => a + (p.u - mu) ** 2, 0) || 1);
        const a0 = mp - b * mu;
        const res = Math.max(...use.map((p) => Math.abs(a0 + b * p.u - p.px)));
        if (!best || res < best.res) best = { a: a0, b, log, res };
      }
      return best && best.res <= 1.5 * k ? (v) => best.a + best.b * (best.log ? Math.log10(Math.max(v, 1e-12)) : v) : null;
    };
    const texts = canvas.__caosTexts ?? [];
    const ys = texts.filter((q) => !q.turned && q.align === 'right' && q.base === 'middle').map((q) => ({ v: parse(q.t), px: q.y })).filter((p) => p.v !== null);
    const xs = texts.filter((q) => !q.turned && q.align === 'center' && q.base === 'top').map((q) => ({ v: parse(q.t), px: q.x })).filter((p) => p.v !== null);
    const fy = fit(ys);
    if (!fy) return null;
    const py = r.top + fy(point.y) / k;
    const fx = fit(xs);
    let px;
    if (fx) px = r.left + fx(point.x) / k;
    else {
      const view = (host.querySelector('[data-view-x]')?.getAttribute('data-view-x') ?? '').split(',').map(Number);
      if (view.length !== 2 || !view.every(Number.isFinite)) return null;
      const log = Boolean(host.querySelector('[data-log-x]'));
      const l = (v) => Math.log10(Math.max(v, 1e-12));
      const t = log ? (l(point.x) - l(view[0])) / (l(view[1]) - l(view[0])) : (point.x - view[0]) / (view[1] - view[0]);
      px = over.left + t * over.width;
    }
    return Math.hypot(e.x - px, e.y - py);
  }, e);
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

/** The leaders' ends of the visible layers moved `px` CSS pixels down (the reviewer's 16 px case, B3 and N4): a planted miss the anchor
 * measure must see. */
async function shiftLeaders(page, px) {
  await page.evaluate((px) => {
    for (const layer of document.querySelectorAll('[data-caos-callout-layer]')) {
      const r = layer.getBoundingClientRect();
      const svg = layer.querySelector('svg.caos-callout-leaders');
      if (!svg || r.height === 0) continue;
      const k = svg.viewBox.baseVal.height / r.height;
      for (const line of svg.querySelectorAll('line[data-caos-callout-leader]')) line.setAttribute('y1', String(line.y1.baseVal.value + px * k));
    }
  }, px);
}

/** The anchor measure's own test: on the story's Compare step at 390 px, every leader moved 16 px under its dot is measured as a miss. */
async function anchorSelfTest(browser, base, ok, measure) {
  for (const size of SIZES) {
    const ctx = await context(browser, { size, reduced: true });
    const page = await ctx.newPage();
    for (const [name, url] of [['compare', STORY('compare')], ['V6', APP.V6], ['operate', STORY('operate')]]) {
      await openTarget(page, base, url);
      await shiftLeaders(page, 16);
      for (const e of (await leaderEnds(page)).filter((l) => l.chart)) {
        const d = await measure(page, e);
        ok(d === null || d > MAX_ANCHOR_PX, `anchors self-test ${name}:${e.id} ${size.width}: a leader planted 16 px under its point is measured as a miss (${d === null ? 'no point' : `${d.toFixed(1)} px`})`);
      }
    }
    await ctx.close();
  }
}

async function anchorChecks(browser, base, ok) {
  await anchorSelfTest(browser, base, ok, pointDistance);
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
          const d = await pointDistance(page, e);
          worst = Math.max(worst, d ?? Infinity);
          if (process.env.SHOWCASE_DEBUG === '1') console.log(name, e.id, size.width, reduced, Math.round(e.x), Math.round(e.y), d);
          ok(d !== null && d <= MAX_ANCHOR_PX, `anchors ${name}:${e.id} at ${size.width} ${reduced ? 'reduced' : 'motion'}: the leader ends ${d === null ? 'where no rendered scale places its point' : `${d.toFixed(1)} px`} from the point it names on the rendered scales (at most ${MAX_ANCHOR_PX})`);
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
  // N4 and N5: at 390 px a resize of the viewport to the document's height (what a full-page capture does) and back leaves every anchor
  // on its point once the page settles
  if (charts.some(([n]) => n === 'compare' || n === 'V4' || n === 'operate')) {
    const ctx = await context(browser, { size: SIZES[1], reduced: true });
    const page = await ctx.newPage();
    for (const [name, url] of charts.filter(([n]) => n === 'compare' || n === 'V4' || n === 'operate')) {
      await openTarget(page, base, url);
      await page.setViewportSize({ width: SIZES[1].width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
      await page.waitForTimeout(1200);
      await page.setViewportSize(SIZES[1]);
      await page.waitForTimeout(1200);
      for (const e of (await leaderEnds(page)).filter((l) => l.chart)) {
        const d = await pointDistance(page, e);
        worst = Math.max(worst, d ?? Infinity);
        ok(d !== null && d <= MAX_ANCHOR_PX, `anchors ${name}:${e.id} at 390 after a resize to the document height: ${d === null ? 'no point on the rendered scales' : `${d.toFixed(1)} px`} from its point (at most ${MAX_ANCHOR_PX})`);
      }
    }
    await ctx.close();
  }
  return worst;
}

/** N5: the callout charts at 390 px over fresh loads, each followed by a full-page capture (the viewport resized to the document's
 * height and back): every load keeps its chart's canvas, drawn, under a band that leaves it room. */
export const BLANK_LOADS = 20;
async function blankChecks(browser, base, ok) {
  const targets = [
    ['V4', APP.V4],
    ['compare', STORY('compare')],
  ];
  const counts = {};
  for (const lang of ['en', 'es'])
    for (const [name, url] of targets) {
      let blank = 0;
      for (let i = 0; i < BLANK_LOADS; i++) {
        const ctx = await context(browser, { size: SIZES[1], lang, reduced: false });
        const page = await ctx.newPage();
        await openTarget(page, base, url);
        await page.screenshot({ fullPage: true });
        await page.waitForTimeout(1500);
        const state = await page.evaluate(() => {
          const host = [...document.querySelectorAll('.cdem-callout-fill')].find((h) => h.getBoundingClientRect().width > 0);
          const canvas = host?.querySelector('.uplot canvas');
          const drawn = host?.querySelector('[data-drawn]')?.getAttribute('data-drawn');
          return { canvas: Boolean(canvas && canvas.getBoundingClientRect().height > 0), drawn, band: Number(host?.getAttribute('data-callout-band')), height: Math.round(host?.getBoundingClientRect().height ?? 0) };
        });
        const good = state.canvas && state.drawn === '1' && state.band < state.height;
        if (!good) blank += 1;
        ok(good, `blank ${name} 390 ${lang} load ${i + 1}: the chart keeps its canvas after a resize to the document height (${JSON.stringify(state)})`);
        await ctx.close();
      }
      counts[`${name} ${lang}`] = `${BLANK_LOADS - blank} of ${BLANK_LOADS} drawn`;
    }
  return counts;
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

/** Every animation frame from Next to `ms`: the new step's staged stage (Story.tsx data-staged-step), its entry state and its cards'
 * drawn opacity (N8). */
async function everyFrame(page, ms) {
  return page.evaluate(async (ms) => {
    const next = [...document.querySelectorAll('.caos-story-controls button')].find((b) => /^(Next|Siguiente)$/.test(b.textContent.trim()));
    const t0 = performance.now();
    next.click();
    const out = [];
    while (performance.now() - t0 < ms) {
      await new Promise((r) => requestAnimationFrame(() => r()));
      const staged = document.querySelector('.cdem-staged[data-staged-step]');
      const calls = staged
        ? [...staged.querySelectorAll('[data-caos-callout]')].map((c) => {
            let op = 1;
            for (let el = c; el && el !== document.body; el = el.parentElement) op *= Number(getComputedStyle(el).opacity);
            return Math.round(op * 100) / 100;
          })
        : [];
      out.push({ t: Math.round(performance.now() - t0), step: staged?.getAttribute('data-staged-step') ?? null, shown: staged?.getAttribute('data-callouts-shown') ?? null, calls });
    }
    return out;
  }, ms);
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
        // N8: from Next until the first callout enters, no frame draws a card of the new step (no flash of the final state)
        await openTarget(page, base, STORY(steps[i - 1]));
        const each = await everyFrame(page, 1100);
        const mine = each.filter((f) => f.step === steps[i]);
        const enteredAt = mine.findIndex((f) => f.shown !== null && f.shown !== '0');
        const before = enteredAt < 0 ? mine : mine.slice(0, enteredAt);
        const flash = before.filter((f) => f.calls.some((o) => o > 0.05));
        ok(mine.length > 0 && flash.length === 0, `frames ${steps[i]} motion: no frame shows a card of the new step before its entry (${flash.length} of ${before.length} frames did: ${JSON.stringify(flash.slice(0, 2))})`);
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
    // M1: no two cards of one layer intersect; M3: no two leaders of one layer cross (segments from anchor to card centre)
    const overlaps = [];
    const crossings = [];
    const crossesSeg = (a, b) => {
      const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      return o(a[0], a[1], b[0]) * o(a[0], a[1], b[1]) < 0 && o(b[0], b[1], a[0]) * o(b[0], b[1], a[1]) < 0;
    };
    for (const layer of document.querySelectorAll('[data-caos-callout-layer]')) {
      if (!visible(layer)) continue;
      const cards = [...layer.querySelectorAll('[data-caos-callout]')].filter(visible).map((c) => ({ id: c.getAttribute('data-caos-callout'), r: c.getBoundingClientRect() }));
      for (let i = 0; i < cards.length; i++)
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i].r;
          const b = cards[j].r;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 0.5 && h > 0.5) overlaps.push(`${cards[i].id}/${cards[j].id} ${Math.round(w)}x${Math.round(h)}`);
        }
      const lines = [...layer.querySelectorAll('line[data-caos-callout-leader]')].map((l) => ({ id: l.getAttribute('data-caos-callout-leader'), s: [[l.x1.baseVal.value, l.y1.baseVal.value], [l.x2.baseVal.value, l.y2.baseVal.value]] }));
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) if (crossesSeg(lines[i].s, lines[j].s)) crossings.push(`${lines[i].id}/${lines[j].id}`);
    }
    // N2: no lane or provenance pill of a card intersects a control of the same card (the P80 target's label and input)
    const pills = [];
    for (const card of document.querySelectorAll('figure.caos-plot')) {
      if (!visible(card)) continue;
      const controls = [...card.querySelectorAll('.caos-plot-body label, .caos-plot-body input, .caos-plot-body button')]
        .filter(visible)
        .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24), r: el.getBoundingClientRect() }));
      for (const b of card.querySelectorAll('.caos-plot-head .badge')) {
        if (!visible(b)) continue;
        const a = b.getBoundingClientRect();
        for (const c of controls) {
          const w = Math.min(a.right, c.r.right) - Math.max(a.left, c.r.left);
          const h = Math.min(a.bottom, c.r.bottom) - Math.max(a.top, c.r.top);
          if (w > 0.5 && h > 0.5) pills.push(`${b.textContent} over ${c.t}`);
        }
      }
    }
    // N3: the story's Compare stage states how sure its ranking is, inside the stage and on the screen at the opening state
    const stageNote = document.querySelector('[data-story] .caos-story-stage figure.caos-plot .caos-plot-note');
    const nr = stageNote?.getBoundingClientRect();
    const sr = stageNote?.closest('.caos-story-stage')?.getBoundingClientRect();
    const certainty = stageNote
      ? { text: stageNote.textContent, inStage: Boolean(nr && sr && nr.top >= sr.top - 0.5 && nr.bottom <= sr.bottom + 0.5), onScreen: Boolean(nr && nr.top >= 0 && nr.bottom <= innerHeight + 0.5) }
      : null;
    return { cut, touching, buttons, charts, heads, docks, overlaps, crossings, pills, certainty };
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
        ok(p.overlaps.length === 0, `overlap ${at}: no two callout cards intersect (${p.overlaps.join('; ')})`);
        ok(p.crossings.length === 0, `cross ${at}: no two leaders cross (${p.crossings.join('; ')})`);
        if (name === 'V6' || name === 'compare') {
          ok(p.touching.length === 0, `axis ${at}: no two method labels touch (${p.touching.join('; ')})`);
          ok(p.buttons.length === 0, `axis ${at}: no method button is cut (${p.buttons.join('; ')})`);
        }
        if (name === 'V5' || name === 'V6') ok(p.charts === 1, `primary ${at}: the view opens on one chart (${p.charts} charts drawn)`);
        if (name === 'V2' && size.width === 1280) ok(p.heads.length === 0, `header ${at}: the chamber table's header is whole (${p.heads.join('; ')})`);
        for (const d of p.docks) ok(!d.scrolls || d.cue, `scroll ${at}: a story panel that scrolls shows that it does`);
        ok(p.pills.length === 0, `pills ${at}: no lane pill of a card covers its controls (${p.pills.join('; ')})`);
        if (name === 'compare') {
          const sure = lang === 'es' ? /(muestreos no deciden la clasificación|se sostiene en estos)/ : /(surveys do not settle the ranking|ranking holds on these)/;
          ok(Boolean(p.certainty && sure.test(p.certainty.text) && p.certainty.inStage && p.certainty.onScreen), `certainty ${at}: the Compare stage states how sure its ranking is, inside the stage and on the screen (${JSON.stringify(p.certainty)})`);
        }
      }
      await ctx.close();
    }
}

async function partChecks(browser, base, ok) {
  for (const size of SIZES) await partChecksAt(browser, base, ok, size);
}

/** M9: a part selected in 3D selects it in the section with its callout, and a part selected in the section highlights it in 3D. */
async function partChecksAt(browser, base, ok, size) {
  const W = size.width;
  const ctx = await context(browser, { size });
  const page = await ctx.newPage();
  await openTarget(page, base, APP.V2);
  await page.locator('[data-part-label]').first().waitFor({ timeout: 20000 });
  const parts = await page.locator('[data-part-label]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part-label')));
  ok(['mantle', 'concave', 'gap', 'feed'].every((p) => parts.includes(p)), `parts ${W}: the 3D chamber names mantle, concave, gap and feed (${parts.join(', ')})`);
  // the section's callout of a part (gap: the setting, mantle: the throw, concave: the nip angle) is selected with it (SDD row V2)
  const CALLOUT = { gap: 'css', mantle: 'throw', concave: 'nip' };
  const calloutState = (id) => page.locator(`[data-caos-callout="${id}"]`).first().getAttribute('data-callout-state');
  for (const part of ['mantle', 'concave', 'gap', 'feed']) {
    await page.locator(`[data-part-label="${part}"]`).first().click();
    await page.waitForTimeout(200);
    const inSection = await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:${part}"]`).first().getAttribute('data-linked-selected');
    ok(inSection === 'true', `parts ${W}: ${part} selected in 3D is selected in the section (${inSection})`);
    if (CALLOUT[part]) {
      const state = await calloutState(CALLOUT[part]);
      ok(state === 'selected', `parts ${W}: ${part} selected in 3D selects its section callout ${CALLOUT[part]} (${state})`);
    }
  }
  for (const part of ['mantle', 'concave', 'gap']) {
    await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:${part}"]`).first().dispatchEvent('click');
    await page.waitForTimeout(200);
    const in3d = await page.locator(`[data-part-label="${part}"]`).first().getAttribute('data-linked-selected');
    ok(in3d === 'true', `parts ${W}: ${part} selected in the section is highlighted in 3D (${in3d})`);
    const state = await calloutState(CALLOUT[part]);
    ok(state === 'selected', `parts ${W}: ${part} selected in the section selects its callout ${CALLOUT[part]} (${state})`);
  }
  // a click on the canvas itself picks the part under the pointer (the scene's raycast)
  const at = await page.locator('[data-part-label="mantle"]').first().getAttribute('data-part-at');
  const [px, py] = (at ?? '').split(',').map(Number);
  await page.locator('.chamber3d-canvas canvas').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const canvas = await page.locator('.chamber3d-canvas canvas').first().boundingBox();
  await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:gap"]`).first().dispatchEvent('click');
  await page.mouse.click(canvas.x + px, canvas.y + py);
  await page.waitForTimeout(150);
  const picked = await page.locator(`[data-chart="chamber-slice"] [data-linked-id="part:mantle"]`).first().getAttribute('data-linked-selected');
  ok(picked === 'true', `parts ${W}: a click on the mantle in the canvas selects the mantle (${picked})`);
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
  if (run('blank')) out.blank = await guard('blank', () => blankChecks(browser, base, ok));
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
    if (out.blank) console.log(`showcase.browser: fresh loads with a full-page capture at 390: ${JSON.stringify(out.blank)}`);
    console.log(`showcase.browser: ${checks} checks, ${failures.length} failed; worst anchor ${out.worstAnchorPx?.toFixed?.(1) ?? 'n/a'} px`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
