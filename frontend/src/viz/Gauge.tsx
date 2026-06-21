// Value-banded gauge — a needle over coloured zones, never a bare number. Ported from the validated visual
// language. Shows the value, its band, and (optionally) an uncertainty span so a reading is honest about spread.
export function Gauge({ title, value, min, max, unit, zones, band, fmt = (v: number) => v.toFixed(0) }: {
  title: string; value: number; min: number; max: number; unit?: string;
  zones?: { from: number; to: number; color: string }[];
  band?: [number, number];   // optional [lo,hi] uncertainty span
  fmt?: (v: number) => string;
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="gauge">
      <div className="gauge-title"><span>{title}</span>{unit && <span>{unit}</span>}</div>
      <div className="gauge-track">
        {zones?.map((z, i) => <div key={i} className="gauge-zone" style={{ left: `${pct(z.from)}%`, width: `${pct(z.to) - pct(z.from)}%`, background: z.color }} />)}
        {band && <div className="gauge-zone" style={{ left: `${pct(band[0])}%`, width: `${pct(band[1]) - pct(band[0])}%`, background: 'var(--color-fg)', opacity: 0.25 }} />}
        <div className="gauge-needle" style={{ left: `${pct(value)}%` }} />
      </div>
      <div className="gauge-scale"><span>{fmt(min)}</span><span className="gauge-val">{fmt(value)}{unit ? ` ${unit}` : ''}</span><span>{fmt(max)}</span></div>
    </div>
  );
}
