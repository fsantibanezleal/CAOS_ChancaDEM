import { useEffect, useRef } from 'react';
import { useShellLang, useThemeStore } from '@fasl-work/caos-app-shell';
import { evaluate } from '../physics/engine';
import type { Operating } from '../physics/types';
import type { RealSurvey } from '../data/real/hp500-minasrio';

// Operating map. Synthetic lane: P80 over the speed × CSS plane, computed live from the exact engine, rendered as
// a viridis heatmap with the current operating point marked. Real lane: the 10 industrial HP500 surveys plotted
// as the measured operating envelope (feed rate t/h × CSS, point colour = feed f80), with the selected survey
// ringed. The real overlay is genuinely new value: it is the actual plant envelope, not a modeled surface.
const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
function vir(t: number) { t = Math.max(0, Math.min(1, t)); const x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i; const a = VIRIDIS[i], b = VIRIDIS[i + 1]; return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`; }

export function OperatingMap({ op, height = 300, surveys, selectedN }: { op: Operating; height?: number; surveys?: RealSurvey[]; selectedN?: number }) {
  const es = useShellLang() === 'es';
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const real = !!surveys && surveys.length > 0;
  const cssRange: [number, number] = op.machine === 'jaw' ? [50, 160] : op.machine === 'cone-tert' ? [4, 22] : [6, 90];
  const spdRange: [number, number] = [150, 600];

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const W = cv.clientWidth || 480, H = height; cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const dim = theme === 'dark' ? '#8b949e' : '#57606a';
    const grid = theme === 'dark' ? '#30363d' : '#d0d7de';
    ctx.clearRect(0, 0, W, H);

    if (real) {
      // ---- Real: measured feed-rate (x, t/h) × CSS (y, mm) scatter, colour = f80, selected ringed ----
      const pad = { l: 46, r: 14, t: 16, b: 34 };
      const tphs = surveys!.map((s) => s.measured.feedRateTph), csss = surveys!.map((s) => s.measured.cssMm), f80s = surveys!.map((s) => s.measured.f80Mm);
      const xLo = Math.min(...tphs) * 0.92, xHi = Math.max(...tphs) * 1.06;
      const yLo = Math.min(...csss) - 3, yHi = Math.max(...csss) + 3;
      const fLo = Math.min(...f80s), fHi = Math.max(...f80s);
      const px = (t: number) => pad.l + ((t - xLo) / (xHi - xLo)) * (W - pad.l - pad.r);
      const py = (c: number) => H - pad.b - ((c - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
      // grid + axes
      ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = dim; ctx.font = '11px sans-serif';
      for (let k = 0; k <= 4; k++) {
        const gx = pad.l + (k / 4) * (W - pad.l - pad.r); ctx.beginPath(); ctx.moveTo(gx, pad.t); ctx.lineTo(gx, H - pad.b); ctx.stroke();
        const tv = xLo + (k / 4) * (xHi - xLo); ctx.fillText(tv.toFixed(0), gx - 12, H - pad.b + 16);
        const gy = pad.t + (k / 4) * (H - pad.t - pad.b); ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
        const cv2 = yHi - (k / 4) * (yHi - yLo); ctx.fillText(cv2.toFixed(0), 8, gy + 4);
      }
      ctx.fillText(es ? 'capacidad (t/h)' : 'feed rate (t/h)', W - 118, H - 4);
      ctx.save(); ctx.translate(12, pad.t + 34); ctx.rotate(-Math.PI / 2); ctx.fillText('CSS (mm)', 0, 0); ctx.restore();
      // points
      surveys!.forEach((s) => {
        const x = px(s.measured.feedRateTph), y = py(s.measured.cssMm);
        const t = (s.measured.f80Mm - fLo) / Math.max(1e-6, fHi - fLo);
        ctx.fillStyle = vir(t); ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = theme === 'dark' ? '#0d1117' : '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        if (s.n === selectedN) { ctx.strokeStyle = theme === 'dark' ? '#fff' : '#24292f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = dim; ctx.font = '9px sans-serif'; ctx.fillText(`#${s.n}`, x + 9, y - 8);
      });
      return;
    }

    // ---- Synthetic: live P80 heatmap over speed × CSS ----
    const nx = 64, ny = 48, cw = W / nx, ch = H / ny;
    const g: number[][] = [];
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j++) {
      g[j] = [];
      const css = cssRange[0] + (j / (ny - 1)) * (cssRange[1] - cssRange[0]);
      for (let i = 0; i < nx; i++) {
        const spd = spdRange[0] + (i / (nx - 1)) * (spdRange[1] - spdRange[0]);
        const r = evaluate({ ...op, cssMm: css, speedRpm: spd });
        const p = r.valid ? r.p80 : NaN;
        g[j][i] = p; if (isFinite(p)) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = g[j][i];
      ctx.fillStyle = isFinite(p) ? vir((p - lo) / Math.max(1e-6, hi - lo)) : (theme === 'dark' ? '#161b22' : '#eee');
      ctx.fillRect(i * cw, H - (j + 1) * ch, cw + 1, ch + 1);
    }
    const mx = ((op.speedRpm - spdRange[0]) / (spdRange[1] - spdRange[0])) * W;
    const my = H - ((op.cssMm - cssRange[0]) / (cssRange[1] - cssRange[0])) * H;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = dim; ctx.font = '11px sans-serif';
    ctx.fillText(`${spdRange[0]}`, 4, H - 4); ctx.fillText(`${spdRange[1]} rpm`, W - 56, H - 4);
    ctx.fillText(`CSS ${cssRange[1]}mm`, 4, 14); ctx.fillText(`${cssRange[0]}`, 4, H - 16);
    cv.dataset.lo = lo.toFixed(1); cv.dataset.hi = hi.toFixed(1);
  }, [op, theme, height, cssRange, spdRange, real, surveys, selectedN, es]);

  return (
    <div>
      <div className="tz-svg-wrap"><canvas ref={ref} style={{ width: '100%', height, display: 'block', borderRadius: 8 }} /></div>
      <div className="tz-panel-sub" style={{ marginTop: '0.3rem' }}>{real
        ? (es ? 'Las 10 encuestas industriales del HP500 (envolvente medida): capacidad × CSS, color = f80 del alimento, morado→amarillo = fino→grueso. ○ resaltado = encuesta seleccionada. La envolvente es real, no una superficie modelada.' : 'The 10 industrial HP500 surveys (measured envelope): feed rate × CSS, colour = feed f80, purple→yellow = fine→coarse. Ringed ○ = selected survey. This is the real plant envelope, not a modeled surface.')
        : (es ? 'P80 del producto (mm) sobre velocidad × CSS, calculado en vivo por el motor. Oscuro/morado = fino, claro/amarillo = grueso. ○ = operación actual.' : 'Product P80 (mm) over speed × CSS, computed live by the engine. Dark/purple = fine, light/yellow = coarse. ○ = current operating point.')}</div>
    </div>
  );
}
