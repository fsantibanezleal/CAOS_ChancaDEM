// The layout checks of the particle-simulation view in a browser, on this build (DM-017; B1 to B3, M1 and M2 of the independent visual
// review), run by src/pages/story.browser.mjs (`npm run check:story`, the first half of `npm run gate`) after the showcase checks. Each check
// measures the rendered page and hands the measured boxes and strings to the pure rules of src/views/dem.rules.mjs, which vitest tests with
// planted inputs; nothing here holds a number of the product. For the three operating points, at 1280 by 800 and 390 by 844, in both themes and
// both languages:
//   verdict   every column of the verdict table stands inside its card, the summary sentence is whole, and on a phone the table is restacked
//             and does not scroll sideways (B1);
//   null      no mark of a side without a value lies inside any plotting range of the three comparison charts (B2);
//   ticks     no two tick labels of the comparison charts' x axes overlap (B3), read from where uPlot drew them on its canvas;
//   stage     the replay stage's own box is at least 60 percent of the App route's viewport at 1280 by 800 (M1);
//   decimals  on the Spanish page no number is written with a decimal point outside the blocks marked lang="en" (M2).
//   node src/views/dem.browser.mjs <origin>   checks a running build on its own
import { decimalProblems, labelOverlapProblems, nullMarkProblems, stageShare, stageShareProblems, verdictLayoutProblems } from './dem.rules.mjs';

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
      const marks = [...root.querySelectorAll('[data-no-value]')].map((m) => ({ id: m.getAttribute('data-no-value'), box: box(m.getBoundingClientRect()) }));
      // the tick labels of the x axis: the canvas texts below the plot that end in "mm" (the feed classes), as boxes in page pixels
      const labels = [];
      for (const canvas of root.querySelectorAll('canvas')) {
        const r = canvas.getBoundingClientRect();
        const k = canvas.width ? r.width / canvas.width : 1;
        for (const t of canvas.__demTexts ?? []) {
          if (t.turned || !/mm$/.test(t.t)) continue;
          const left = t.align === 'center' ? t.x - t.w / 2 : t.align === 'right' || t.align === 'end' ? t.x - t.w : t.x;
          labels.push({ text: t.t, left: r.left + left * k, right: r.left + (left + t.w) * k, top: r.top + (t.y - 10) * k, bottom: r.top + (t.y + 3) * k });
        }
      }
      return { q: root.getAttribute('data-comparison'), plot: plot ? box(plot.getBoundingClientRect()) : null, marks, labels };
    });
    const stageCard = document.querySelector('[data-frames]')?.closest('figure.caos-plot');
    const drawing = document.querySelector('[data-dem-stage]');
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
      stage: stageCard ? { width: stageCard.getBoundingClientRect().width, height: stageCard.getBoundingClientRect().height } : null,
      drawing: drawing ? { width: drawing.getBoundingClientRect().width, height: drawing.getBoundingClientRect().height } : null,
      texts,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
}

export async function demChecks({ browser, base, ok }) {
  const shares = [];
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
            for (const c of m.charts) {
              ok(c.plot !== null, `${where}: the ${c.q} chart has its plot`);
              if (c.plot) for (const p of nullMarkProblems(c.marks, c.plot)) ok(false, `${where}, ${c.q}: ${p}`);
              ok(c.labels.length >= 3, `${where}, ${c.q}: the three feed classes are labelled on the axis (${c.labels.length} labels read)`);
              for (const p of labelOverlapProblems(c.labels)) ok(false, `${where}, ${c.q}: ${p}`);
            }
            if (size.width === 1280) {
              ok(m.stage !== null, `${where}: the replay stage is on the page`);
              if (m.stage) {
                for (const p of stageShareProblems(m.stage, m.viewport)) ok(false, `${where}: ${p}`);
                shares.push({ point, theme, lang, share: stageShare(m.stage, m.viewport), drawing: m.drawing ? stageShare(m.drawing, m.viewport) : null });
              }
            }
            if (lang === 'es') for (const p of decimalProblems(m.texts)) ok(false, `${where}: ${p}`);
          }
        } finally {
          await ctx.close();
        }
      }
    }
  }
  return { combos, shares };
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
    const s = out.shares.map((x) => x.share);
    console.log(`dem.browser: ${checks} checks over ${out.combos} measured pages, ${failures.length} failed; stage share at 1280 by 800 from ${(Math.min(...s) * 100).toFixed(1)} to ${(Math.max(...s) * 100).toFixed(1)} percent of the viewport (${JSON.stringify(out.shares.map((x) => [x.point, x.theme, x.lang, Number((x.share * 100).toFixed(1)), x.drawing === null ? null : Number((x.drawing * 100).toFixed(1))]))})`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
