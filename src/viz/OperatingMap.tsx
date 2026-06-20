import { useEffect, useRef } from 'react';
import { useShellLang, useThemeStore } from '@fasl-work/caos-app-shell';
import { evaluate } from '../physics/engine';
import type { Operating } from '../physics/types';

// Operating map: P80 over the speed × CSS plane, computed LIVE from the exact engine (fast), rendered as a
// viridis heatmap with iso-P80 contours and the current operating point marked. Shows the whole operating
// envelope at a glance — where the product is fine vs coarse.
const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
function vir(t: number) { t = Math.max(0, Math.min(1, t)); const x = t * 4, i = Math.min(3, Math.floor(x)), f = x - i; const a = VIRIDIS[i], b = VIRIDIS[i + 1]; return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`; }

export function OperatingMap({ op, height = 300 }: { op: Operating; height?: number }) {
  const es = useShellLang() === 'es';
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const cssRange: [number, number] = op.machine === 'jaw' ? [50, 160] : op.machine === 'cone-tert' ? [4, 22] : [6, 90];
  const spdRange: [number, number] = [150, 600];

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const W = cv.clientWidth || 480, H = height; cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const nx = 64, ny = 48, cw = W / nx, ch = H / ny;
    const grid: number[][] = [];
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j++) {
      grid[j] = [];
      const css = cssRange[0] + (j / (ny - 1)) * (cssRange[1] - cssRange[0]);
      for (let i = 0; i < nx; i++) {
        const spd = spdRange[0] + (i / (nx - 1)) * (spdRange[1] - spdRange[0]);
        const r = evaluate({ ...op, cssMm: css, speedRpm: spd });
        const p = r.valid ? r.p80 : NaN;
        grid[j][i] = p; if (isFinite(p)) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = grid[j][i];
      ctx.fillStyle = isFinite(p) ? vir((p - lo) / Math.max(1e-6, hi - lo)) : (theme === 'dark' ? '#161b22' : '#eee');
      ctx.fillRect(i * cw, H - (j + 1) * ch, cw + 1, ch + 1);
    }
    // current operating point marker
    const mx = ((op.speedRpm - spdRange[0]) / (spdRange[1] - spdRange[0])) * W;
    const my = H - ((op.cssMm - cssRange[0]) / (cssRange[1] - cssRange[0])) * H;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    // axis ticks
    ctx.fillStyle = theme === 'dark' ? '#8b949e' : '#57606a'; ctx.font = '11px sans-serif';
    ctx.fillText(`${spdRange[0]}`, 4, H - 4); ctx.fillText(`${spdRange[1]} rpm`, W - 56, H - 4);
    ctx.fillText(`CSS ${cssRange[1]}mm`, 4, 14); ctx.fillText(`${cssRange[0]}`, 4, H - 16);
    cv.dataset.lo = lo.toFixed(1); cv.dataset.hi = hi.toFixed(1);
  }, [op, theme, height, cssRange, spdRange]);

  return (
    <div>
      <div className="tz-svg-wrap"><canvas ref={ref} style={{ width: '100%', height, display: 'block', borderRadius: 8 }} /></div>
      <div className="tz-panel-sub" style={{ marginTop: '0.3rem' }}>{es ? 'P80 del producto (mm) sobre velocidad × CSS — calculado en vivo por el motor. Oscuro/morado = fino, claro/amarillo = grueso. ○ = operación actual.' : 'Product P80 (mm) over speed × CSS — computed live by the engine. Dark/purple = fine, light/yellow = coarse. ○ = current operating point.'}</div>
    </div>
  );
}
