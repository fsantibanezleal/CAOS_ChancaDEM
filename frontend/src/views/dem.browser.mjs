// The layout checks of the particle-simulation view in a browser, on this build (DM-017; B1 to B3, M1 and M2 of the independent visual
// review), run by src/pages/story.browser.mjs (`npm run check:story`) after the showcase checks. Each check
// measures the rendered page and hands the measured boxes and strings to the pure rules of src/views/dem.rules.mjs, which vitest tests with
// planted inputs; nothing here holds a number of the product. For the three operating points, at 1280 by 800 and 390 by 844, in both themes and
// both languages:
//   verdict   every column of the verdict table stands inside its card, the summary sentence is whole, and on a phone the table is restacked
//             and does not scroll sideways (B1);
//   null      no mark of a side without a value lies inside any plotting range of the three comparison charts, and the "no value" texts of the
//             strip under each chart overlap no tick label, no axis title and no other text (B2, F2);
//   ticks     no two tick labels of the comparison charts' x axes overlap (B3), read from where uPlot drew them on its canvas;
//   stage     at 1280 by 800 the stage card is at least 60 percent of the App route's viewport, its drawing region at least 40 percent, and the
//             section and the magnified zone at least 380 px high (M1, F4);
//   leaders   at 1280 by 800 the end of every callout's leader lies inside (or within 4 px of) its subject's drawn box, and no two ends are closer
//             than 20 px (R1); classes: the six size classes are at 3 to 1 or more against the stage's background in the theme (R2); note: the
//             sentence that says which sides state no value stands directly under the tick labels and overlaps none (R3); staged: a change of
//             operating point shows the stage, the series and the rest at three times, 200 ms apart at least (R5);
//   decimals  on the Spanish page no number is written with a decimal point outside the blocks marked lang="en" (M2).
//   node src/views/dem.browser.mjs <origin>   checks a running build on its own
import { axisNoteProblems, chartOverlapProblems, classContrastProblems, decimalProblems, labelOverlapProblems, leaderProblems, stageGeometryProblems, stageShare, stageTimesProblems, verdictLayoutProblems } from './dem.rules.mjs';

const SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];
const POINTS = ['63-52', '31.5-26.5', '16-13.2'];
const URL_PATH = '/app?case=S01&view=validation&sub=particles';

async function openContext(browser, { size, lang, theme }) {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: 'reduce', colorScheme: theme });
  // the text uPlot draws on each canvas, with its position and width in canvas pixels (the tick labels of an axis)
  await ctx.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      const m = this.getTransform();
      (this.canvas.__demTexts ??= []).push({ t: String(text), x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, w: this.measureText(String(text)).width * m.a, align: this.textAlign, turned: m.b !== 0 });
      return fill.apply(this, arguments);
    };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, w, h) {
      if (x <= 0 && y <= 0 && w >= this.canvas.width && h >= this.canvas.height) this.canvas.__demTexts = [];
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

/** Everything the rules need, measured on the open page, in CSS pixels. */
async function measure(page) {
  return page.evaluate(() => {
    const box = (r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    const table = document.querySelector('[data-verdict-table]');
    const card = table?.closest('figure.caos-plot');
    const wrapper = table?.querySelector('.cdem-tablewrap');
    const summary = table?.querySelector('[data-verdict-summary]');
    const stacked = window.innerWidth < 900;
    const cells = stacked ? [...(table?.querySelectorAll('tbody td') ?? [])] : [...(table?.querySelectorAll('thead th') ?? [])];
    const verdict = table && card && wrapper && summary
      ? {
          card: box(card.getBoundingClientRect()),
          columns: cells.map((c, i) => ({ name: (stacked ? c.getAttribute('data-label') : c.textContent) ?? String(i), left: c.getBoundingClientRect().left, right: c.getBoundingClientRect().right })),
          wrapper: { scrollWidth: wrapper.scrollWidth, clientWidth: wrapper.clientWidth },
          summary: { ...box(summary.getBoundingClientRect()), scrollWidth: summary.scrollWidth, clientWidth: summary.clientWidth, text: summary.textContent ?? '' },
          stacked,
        }
      : null;
    const charts = [...document.querySelectorAll('[data-comparison]')].map((root) => {
      const plot = root.querySelector('.u-over');
      // a side with no value has no mark at all: no element of the chart's overlay stands for one
      const nullMarks = root.querySelectorAll('[data-no-value], [data-comparison-overlay] circle').length;
      // the tick labels of the x axis: the canvas texts below the plot that end in "mm" (the feed classes), as boxes in page pixels
      const labels = [];
      for (const canvas of root.querySelectorAll('canvas')) {
        const r = canvas.getBoundingClientRect();
        const k = canvas.width ? r.width / canvas.width : 1;
        for (const t of canvas.__demTexts ?? []) {
          if (t.turned || !/mm$/.test(t.t) || /^(No value|Sin valor)/.test(t.t)) continue;
          const left = t.align === 'center' ? t.x - t.w / 2 : t.align === 'right' || t.align === 'end' ? t.x - t.w : t.x;
          labels.push({ text: t.t, left: r.left + left * k, right: r.left + (left + t.w) * k, top: r.top + (t.y - 10) * k, bottom: r.top + (t.y + 3) * k });
        }
      }
      // every other text the chart's canvas draws below its plot (the tick labels and the axis title), as boxes in page pixels
      const below = [];
      const plotBottom = plot ? plot.getBoundingClientRect().bottom : 0;
      for (const canvas of root.querySelectorAll('canvas')) {
        const r = canvas.getBoundingClientRect();
        const k = canvas.width ? r.width / canvas.width : 1;
        for (const t of canvas.__demTexts ?? []) {
          if (t.turned || r.top + t.y * k < plotBottom) continue;
          const left = t.align === 'center' ? t.x - t.w / 2 : t.align === 'right' || t.align === 'end' ? t.x - t.w : t.x;
          below.push({ text: t.t, box: { left: r.left + left * k, right: r.left + (left + t.w) * k, top: r.top + (t.y - 10) * k, bottom: r.top + (t.y + 3) * k } });
        }
      }
      // the note of the missing sides: the chart's own axis title, drawn on its canvas or written under it
      let note = null;
      for (const el of root.querySelectorAll('[data-axis-title="x"]')) if (/^(No value|Sin valor)/.test(el.textContent ?? '')) note = box(el.getBoundingClientRect());
      if (!note) {
        for (const canvas of root.querySelectorAll('canvas')) {
          const r = canvas.getBoundingClientRect();
          const k = canvas.width ? r.width / canvas.width : 1;
          for (const t of canvas.__demTexts ?? []) if (!t.turned && /^(No value|Sin valor)/.test(t.t)) {
            const left = t.align === 'center' ? t.x - t.w / 2 : t.x;
            note = { left: r.left + left * k, right: r.left + (left + t.w) * k, top: r.top + (t.y - 10) * k, bottom: r.top + (t.y + 3) * k };
          }
        }
      }
      return { q: root.getAttribute('data-comparison'), plot: plot ? box(plot.getBoundingClientRect()) : null, nullMarks, labels, below, note };
    });
    // every chart root of the view, each with its plot, tick labels, axis title, key and hint
    const roots = [...document.querySelectorAll('.cdem-dem .uplot')].map((el, i) => ({ id: `${el.closest('[data-stroke-series]') ? 'series' : el.closest('[data-comparison]') ? 'comparison' : el.closest('[data-distribution]') ? 'distribution' : 'chart'}#${i}`, box: box(el.getBoundingClientRect()) }));
    // the leaders of the callouts and the subjects they name (page pixels); the six size classes and the stage's background
    const leaderSvg = document.querySelector('[data-chart="dem-callout-leaders"]');
    const sv = leaderSvg ? leaderSvg.getBoundingClientRect() : null;
    const leaders = sv
      ? [...leaderSvg.querySelectorAll('[data-callout-leader]')].map((l) => {
          const id = l.getAttribute('data-callout-leader');
          const sub = leaderSvg.querySelector(`[data-subject="${id}"]`);
          return { id, end: { x: sv.left + Number(l.getAttribute('data-end-x')), y: sv.top + Number(l.getAttribute('data-end-y')) }, box: sub ? box(sub.getBoundingClientRect()) : null };
        })
      : [];
    const css = getComputedStyle(document.documentElement);
    const hex = (v) => {
      const t = v.trim();
      if (t.startsWith('#')) return t;
      const m = t.match(/\d+/g);
      return m ? `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : t;
    };
    const classes = [0, 1, 2, 3, 4, 5].map((i) => hex(css.getPropertyValue(`--cdem-size-${i}`)));
    const surface = hex(css.getPropertyValue('--color-surface'));
    const stageCard = document.querySelector('[data-frames]')?.closest('figure.caos-plot');
    const drawing = document.querySelector('[data-dem-stage]');
    const heightOf = (sel) => document.querySelector(sel)?.getBoundingClientRect().height ?? 0;
    const root = document.querySelector('.cdem-dem');
    const texts = [];
    if (root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest('script, style, [aria-hidden="true"], [data-version]')) continue;
        if (!/\d\.\d/.test(n.nodeValue ?? '')) continue;
        texts.push({ text: n.nodeValue ?? '', quoted: Boolean(el.closest('[lang="en"], [translate="no"]')) });
      }
    }
    return {
      verdict,
      charts,
      roots,
      leaders,
      classes,
      surface,
      stage: stageCard ? { width: stageCard.getBoundingClientRect().width, height: stageCard.getBoundingClientRect().height } : null,
      drawing: drawing ? { width: drawing.getBoundingClientRect().width, height: drawing.getBoundingClientRect().height } : null,
      section: { height: heightOf('[data-chart="dem-replay"]') },
      zone: { height: heightOf('[data-chart="dem-inset"]') },
      texts,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
}

/** R5: the time, from the click, at which the stage, the series and the rest are shown after a change of operating point (motion allowed). */
async function stagedTimes(browser, base, ok) {
  const ctx = await browser.newContext({ viewport: SIZES[0], reducedMotion: 'no-preference', colorScheme: 'dark' });
  try {
    const page = await ctx.newPage();
    await page.goto(base + URL_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-point-choice]', { timeout: 20000 });
    await page.waitForSelector('[data-comparison] .u-over', { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__demFlips = [];
      const t0 = { v: 0 };
      window.__demClick = () => {
        t0.v = performance.now();
        const seen = new Set();
        const obs = new MutationObserver(() => {
          document.querySelectorAll('.cdem-reveal').forEach((el, i) => {
            if (el.getAttribute('data-on') === 'true' && !seen.has(i)) {
              seen.add(i);
              window.__demFlips.push({ i, t: performance.now() - t0.v });
            }
          });
        });
        obs.observe(document.body, { attributes: true, attributeFilter: ['data-on'], subtree: true });
      };
    });
    await page.evaluate(() => window.__demClick());
    await page.click('button[data-point="31.5-26.5"]');
    await page.waitForTimeout(1500);
    const flips = await page.evaluate(() => window.__demFlips);
    const times = [0, 1, 2].map((i) => flips.find((f) => f.i === i)?.t).filter((t) => t !== undefined);
    for (const p of stageTimesProblems(times)) ok(false, `staged change of point: ${p}`);
    return times.map((t) => Math.round(t));
  } finally {
    await ctx.close();
  }
}

export async function demChecks({ browser, base, ok }) {
  const shares = [];
  const boxes = [];
  const gaps = [];
  const reach = [];
  const contrasts = [];
  let combos = 0;
  for (const size of SIZES) {
    for (const theme of ['dark', 'light']) {
      for (const lang of ['en', 'es']) {
        const ctx = await openContext(browser, { size, lang, theme });
        try {
          const page = await ctx.newPage();
          await page.goto(base + URL_PATH, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-point-choice]', { timeout: 20000 });
          for (const point of POINTS) {
            const where = `${point} at ${size.width} by ${size.height}, ${theme}, ${lang}`;
            await page.click(`button[data-point="${point}"]`);
            await page.waitForSelector(`.cdem-dem[data-point="${point}"] [data-dem-stage]`, { timeout: 20000 });
            await page.waitForSelector('[data-comparison] .u-over', { timeout: 20000 });
            await page.waitForTimeout(900);
            const m = await measure(page);
            combos += 1;
            ok(m.verdict !== null, `${where}: the verdict table is on the page`);
            if (m.verdict) for (const p of verdictLayoutProblems(m.verdict)) ok(false, `${where}: ${p}`);
            ok(m.charts.length === 3, `${where}: three comparison charts`);
            ok(m.roots.length >= 6, `${where}: the charts of the view are on the page (${m.roots.length})`);
            for (const p of chartOverlapProblems(m.roots)) ok(false, `${where}: ${p}`);
            boxes.push({ point, size: `${size.width}x${size.height}`, lang, roots: m.roots.filter((r) => r.id.startsWith('series')).map((r) => [Math.round(r.box.top), Math.round(r.box.bottom)]) });
            for (const c of m.charts) {
              ok(c.plot !== null, `${where}: the ${c.q} chart has its plot`);
              ok(c.nullMarks === 0, `${where}, ${c.q}: a side with no value has no mark (${c.nullMarks} found)`);
              const missing = c.q !== 'p80';
              ok(!missing || c.note !== null || c.q === 'throughput' || c.q === 'net_power', `${where}, ${c.q}: the note of the missing sides is on the chart`);
              if (c.note) {
                for (const p of axisNoteProblems(c.note, c.labels.map((l) => ({ text: l.text, box: l }))))  ok(false, `${where}, ${c.q}: ${p}`);
                gaps.push(Math.round(c.note.top - Math.max(...c.labels.map((l) => l.bottom))));
              }
              ok(c.labels.length >= 3, `${where}, ${c.q}: the three feed classes are labelled on the axis (${c.labels.length} labels read)`);
              for (const p of labelOverlapProblems(c.labels)) ok(false, `${where}, ${c.q}: ${p}`);
            }
            if (size.width === 1280) {
              ok(m.stage !== null && m.drawing !== null, `${where}: the replay stage is on the page`);
              if (m.stage && m.drawing) {
                for (const p of stageGeometryProblems({ card: m.stage, drawing: m.drawing, section: m.section, zone: m.zone }, m.viewport)) ok(false, `${where}: ${p}`);
                shares.push({ point, theme, lang, card: stageShare(m.stage, m.viewport), drawing: stageShare(m.drawing, m.viewport), section: m.section.height, zone: m.zone.height });
              }
            }
            for (const p of classContrastProblems(m.classes, m.surface)) ok(false, `${where}: ${p}`);
            if (size.width === 1280) {
              ok(m.leaders.length === 3 && m.leaders.every((l) => l.box), `${where}: three callout leaders with their subjects`);
              for (const p of leaderProblems(m.leaders.filter((l) => l.box))) ok(false, `${where}: ${p}`);
              reach.push(m.leaders.map((l) => ({ id: l.id, inside: l.box ? l.end.x >= l.box.left - 4 && l.end.x <= l.box.right + 4 && l.end.y >= l.box.top - 4 && l.end.y <= l.box.bottom + 4 : false, ends: [Math.round(l.end.x), Math.round(l.end.y)] })));
            }
            if (theme === 'dark' || theme === 'light') contrasts.push({ theme, ratios: m.classes.map((c) => c) });
            if (lang === 'es') for (const p of decimalProblems(m.texts)) ok(false, `${where}: ${p}`);
          }
        } finally {
          await ctx.close();
        }
      }
    }
  }
  const times = await stagedTimes(browser, base, ok);
  return { combos, shares, boxes, gaps, reach, contrasts, times };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\//, '')}`) {
  const base = (process.argv[2] ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('usage: node src/views/dem.browser.mjs <origin>');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  let checks = 0;
  const failures = [];
  const ok = (cond, msg) => {
    checks += 1;
    if (!cond) failures.push(msg);
  };
  try {
    const out = await demChecks({ browser, base, ok });
    for (const f of failures) console.log(`FAIL ${f}`);
    if (process.env.DEM_BOXES === '1') console.log(JSON.stringify({ boxes: out.boxes, gaps: out.gaps, reach: out.reach.slice(0, 4), contrasts: out.contrasts.slice(0, 2), times: out.times }));
    const range = (key) => `${Math.min(...out.shares.map((x) => x[key])).toFixed(key === 'card' || key === 'drawing' ? 3 : 0)} to ${Math.max(...out.shares.map((x) => x[key])).toFixed(key === 'card' || key === 'drawing' ? 3 : 0)}`;
    console.log(`dem.browser: ${checks} checks over ${out.combos} measured pages, ${failures.length} failed; at 1280 by 800 the stage card is ${range('card')}, the drawing region ${range('drawing')} of the viewport, the section ${range('section')} px and the magnified zone ${range('zone')} px high`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
