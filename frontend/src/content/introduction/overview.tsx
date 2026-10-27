// The overview figure of the Introduction's technical view: the six steps from the data to the screen, drawn as two lanes (the
// offline work on a workstation, then the committed artifacts and the browser). It is a drawing of the product's own, so its
// boxes and arrows are right here; every colour is a shell token, every label is bilingual through `useT`, and the drawing is
// sized to its container by its viewBox (`fig-svg wide`).
import { useT } from '../bi';

const BOX_W = 164;
const BOX_H = 84;
const STEP = BOX_W + 28;
const X0 = 10;
const ROW1 = 30;
const ROW2 = 166;

type Tone = 'accent' | 'good';

/** One numbered box: a badge, a bold title and up to two lines of detail. */
function Box({ x, y, w = BOX_W, n, tone, title, lines }: { x: number; y: number; w?: number; n?: number; tone: Tone; title: string; lines: string[] }) {
  const strip = tone === 'good' ? 'var(--color-good)' : 'var(--color-accent)';
  return (
    <g>
      <rect x={x} y={y} width={w} height={BOX_H} rx="8" fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1.5" />
      <rect x={x} y={y} width="6" height={BOX_H} rx="3" fill={strip} />
      {n !== undefined && (
        <g>
          <circle cx={x + 24} cy={y + 18} r="10" fill={strip} />
          <text x={x + 24} y={y + 22} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-accent-fg)">
            {n}
          </text>
        </g>
      )}
      <text x={x + (n !== undefined ? 42 : 18)} y={y + 23} fontSize="13" fontWeight="700" fill="var(--color-fg)">
        {title}
      </text>
      {lines.map((line, k) => (
        <text key={k} x={x + 18} y={y + 48 + k * 17} fontSize="12" fill="var(--color-fg-subtle)">
          {line}
        </text>
      ))}
    </g>
  );
}

/** A straight arrow from (x1, y) to (x2, y). */
function Arrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return <path d={`M ${x1} ${y} L ${x2} ${y} M ${x2 - 7} ${y - 6} L ${x2} ${y} L ${x2 - 7} ${y + 6}`} fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
}

export function OverviewFigure() {
  const t = useT();
  const xs = [0, 1, 2, 3].map((i) => X0 + i * STEP);
  const chip = (x: number, label: string) => (
    <g key={label}>
      <rect x={x} y={ROW2 + 46} width="104" height="26" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" />
      <text x={x + 52} y={ROW2 + 63} textAnchor="middle" fontSize="12" fill="var(--color-fg)">
        {label}
      </text>
    </g>
  );
  const b6x = X0 + STEP;
  const b7x = b6x + 348 + 28;
  return (
    <svg className="fig-svg wide" viewBox="0 0 760 262" role="img" aria-label={t('The six steps from the data to the screen: four offline steps, then the committed artifacts and the browser', 'Los seis pasos desde los datos hasta la pantalla: cuatro pasos fuera de línea, luego los artefactos comprometidos y el navegador')}>
      <text x={X0} y="18" fontSize="12" fontWeight="600" fill="var(--color-fg-subtle)">
        {t('Offline, on a workstation (never in CI)', 'Fuera de línea, en una estación de trabajo (nunca en CI)')}
      </text>
      <Box x={xs[0]} y={ROW1} n={1} tone="accent" title={t('Contracts', 'Contratos')} lines={[t('operating point and survey', 'punto de operación y tabla'), t('table, validated', 'de muestreos, validados')]} />
      <Box x={xs[1]} y={ROW1} n={2} tone="accent" title={t('Python engine', 'Motor en Python')} lines={[t('27 cases baked, ranges', '27 casos, rangos y'), t('and units gate', 'compuerta de unidades')]} />
      <Box x={xs[2]} y={ROW1} n={3} tone="accent" title="CrusherCal" lines={[t('leave-one-survey-out', 'un muestreo fuera a la vez'), t('on the ten surveys', 'sobre los diez muestreos')]} />
      <Box x={xs[3]} y={ROW1} n={4} tone="accent" title={t('Models', 'Modelos')} lines={[t('LHS sweep of the engine,', 'barrido LHS del motor,'), t('held out, local only', 'retenido, solo local')]} />
      {[0, 1, 2].map((i) => (
        <Arrow key={i} x1={xs[i] + BOX_W + 3} x2={xs[i + 1] - 3} y={ROW1 + BOX_H / 2} />
      ))}
      <path
        d={`M ${xs[3] + BOX_W / 2} ${ROW1 + BOX_H + 3} L ${xs[3] + BOX_W / 2} 138 L ${X0 + BOX_W / 2} 138 L ${X0 + BOX_W / 2} ${ROW2 - 4} M ${X0 + BOX_W / 2 - 6} ${ROW2 - 11} L ${X0 + BOX_W / 2} ${ROW2 - 4} L ${X0 + BOX_W / 2 + 6} ${ROW2 - 11}`}
        fill="none"
        stroke="var(--color-fg-faint)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="750" y="156" textAnchor="end" fontSize="12" fontWeight="600" fill="var(--color-fg-subtle)">
        {t('Committed artifacts, then the static site and the browser', 'Artefactos comprometidos, luego el sitio estático y el navegador')}
      </text>
      <Box x={X0} y={ROW2} n={5} tone="good" title={t('Artifacts', 'Artefactos')} lines={[t('copied into the site,', 'copiados al sitio,'), t('no server', 'sin servidor')]} />
      <g>
        <rect x={b6x} y={ROW2} width="348" height={BOX_H} rx="8" fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1.5" />
        <rect x={b6x} y={ROW2} width="6" height={BOX_H} rx="3" fill="var(--color-good)" />
        <circle cx={b6x + 24} cy={ROW2 + 18} r="10" fill="var(--color-good)" />
        <text x={b6x + 24} y={ROW2 + 22} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-accent-fg)">
          6
        </text>
        <text x={b6x + 42} y={ROW2 + 23} fontSize="13" fontWeight="700" fill="var(--color-fg)">
          {t('Browser, three lanes', 'Navegador, tres carriles')}
        </text>
        {chip(b6x + 18, t('Live engine', 'Motor en vivo'))}
        {chip(b6x + 18 + 112, t('Replay', 'Reproducción'))}
        {chip(b6x + 18 + 224, t('ONNX models', 'Modelos ONNX'))}
      </g>
      <Box x={b7x} y={ROW2} tone="good" w={760 - 10 - b7x} title={t('The screen', 'La pantalla')} lines={[t('workbench views', 'vistas del banco de'), t('and readiness notes', 'trabajo y su estado')]} />
      <Arrow x1={X0 + BOX_W + 3} x2={b6x - 3} y={ROW2 + BOX_H / 2} />
      <Arrow x1={b6x + 348 + 3} x2={b7x - 3} y={ROW2 + BOX_H / 2} />
    </svg>
  );
}
