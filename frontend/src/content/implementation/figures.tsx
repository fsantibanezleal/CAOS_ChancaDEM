// The figures of the Implementation page: the architecture of the build, and a row of steps for an engine topic. Both are
// inline SVG coloured only with the shell's theme tokens, so they follow the light and dark themes, and both write their
// words in the displayed language (useT). An arrow is a drawn path, never a character.
import { useT } from '../bi';

const TONE = { off: 'var(--color-magenta)', rep: 'var(--color-good)', live: 'var(--color-accent)' } as const;
type Tone = keyof typeof TONE;

interface Cell {
  title: string;
  lines: string[];
}

/** A box with a coloured edge strip, a bold title and up to two detail lines. */
function Box({ x, y, w, h, cell, tone }: { x: number; y: number; w: number; h: number; cell: Cell; tone: Tone }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1.5" />
      <rect x={x} y={y} width={6} height={h} rx={3} fill={TONE[tone]} />
      <text x={x + 18} y={y + 28} fontSize="14" fontWeight="700" fill="var(--color-fg)">
        {cell.title}
      </text>
      {cell.lines.map((ln, k) => (
        <text key={k} x={x + 18} y={y + 50 + k * 17} fontSize="12" fill="var(--color-fg-subtle)">
          {ln}
        </text>
      ))}
    </g>
  );
}

/** A straight arrow from (x1, y) to (x2, y), drawn as a path with an open head. */
function Arrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return <path d={`M ${x1} ${y} L ${x2} ${y} M ${x2 - 7} ${y - 6} L ${x2} ${y} L ${x2 - 7} ${y + 6}`} fill="none" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
}

/** The architecture of the build: three columns (offline, committed, browser) and the gate and deploy band below them. */
export function ArchitectureFigure() {
  const t = useT();
  const col = (x: number, w: number, label: string, tone: Tone, cells: Cell[]) => (
    <g>
      <text x={x} y={22} fontSize="12" fontWeight="700" letterSpacing="1" fill={TONE[tone]}>
        {label}
      </text>
      {cells.map((c, i) => (
        <Box key={i} x={x} y={34 + i * 92} w={w} h={78} cell={c} tone={tone} />
      ))}
    </g>
  );
  const off: Cell[] = [
    { title: t('Canonical engine', 'Motor canónico'), lines: [t('Python, 28 size classes', 'Python, 28 clases de tamaño'), t('one function per point', 'una función por punto')] },
    { title: t('The bake', 'El precálculo'), lines: [t('cases, HP500 documents,', 'casos, documentos HP500,'), t('readiness, expected ranges', 'disponibilidad, rangos esperados')] },
    { title: t('Training and export', 'Entrenar y exportar'), lines: [t('torch on the CPU, ONNX,', 'torch en CPU, ONNX,'), t('held-out metrics', 'métricas con datos retenidos')] },
  ];
  const rep: Cell[] = [
    { title: t('Case documents', 'Documentos de caso'), lines: [t('index, manifests, traces', 'índice, manifiestos, trazas'), t('small JSON, in git', 'JSON pequeño, en git')] },
    { title: t('HP500 validation', 'Validación HP500'), lines: [t('calibrated backbone and', 'esqueleto calibrado y'), t('CrusherCal documents', 'documentos de CrusherCal')] },
    { title: t('Models and readiness', 'Modelos y disponibilidad'), lines: [t('contracts, ONNX graphs,', 'contratos, grafos ONNX,'), t('metrics, declared states', 'métricas, estados declarados')] },
  ];
  const live: Cell[] = [
    { title: t('TypeScript engine', 'Motor en TypeScript'), lines: [t('the same function, live', 'la misma función, en vivo'), t('held to the Python one', 'sujeto al de Python')] },
    { title: t('Views', 'Vistas'), lines: [t('replay of the trace and', 'reproducción de la traza y'), t('live values, one selection key', 'valores en vivo, una clave')] },
    { title: t('onnxruntime-web', 'onnxruntime-web'), lines: [t('WASM served by the site,', 'WASM servido por el sitio,'), t('opened with the Learned group', 'abierto con el grupo Aprendido')] },
  ];
  return (
    <svg
      className="fig-svg wide"
      viewBox="0 0 760 400"
      role="img"
      aria-label={t('The architecture of the build: offline pipeline, committed artifacts and the browser, with the gate before the deploy', 'La arquitectura de la compilación: pipeline fuera de línea, artefactos comprometidos y el navegador, con la compuerta antes del despliegue')}
      data-chart="implementation-figure"
    >
      {col(10, 220, t('OFFLINE', 'FUERA DE LÍNEA'), 'off', off)}
      {col(270, 220, t('COMMITTED', 'COMPROMETIDO'), 'rep', rep)}
      {col(530, 220, t('IN THE BROWSER', 'EN EL NAVEGADOR'), 'live', live)}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Arrow x1={234} x2={266} y={73 + i * 92} />
          <Arrow x1={494} x2={526} y={73 + i * 92} />
        </g>
      ))}
      <rect x={10} y={318} width={740} height={64} rx={8} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={28} y={344} fontSize="14" fontWeight="700" fill="var(--color-fg)">
        {t('Before a deploy: the measured gate and the checks of the committed files', 'Antes de desplegar: la compuerta medida y las verificaciones de lo comprometido')}
      </text>
      <text x={28} y={366} fontSize="12" fill="var(--color-fg-subtle)">
        {t('GitHub Pages serves the build with no server; the live site is checked after it is published.', 'GitHub Pages sirve la compilación sin servidor; el sitio publicado se verifica después.')}
      </text>
    </svg>
  );
}

/** A row of labelled steps joined by arrows (an engine topic's steps), up to five boxes. */
export function StepsFigure({ label, boxes, arrows }: { label: string; boxes: { title: string; line?: string }[]; arrows?: string[] }) {
  const n = boxes.length;
  const gap = 56;
  const bw = (740 - (n - 1) * gap) / n;
  return (
    <svg className="fig-svg wide" viewBox="0 0 760 150" role="img" aria-label={label} data-chart="implementation-figure">
      {boxes.map((b, i) => {
        const x = 10 + i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={30} width={bw} height={84} rx={8} fill="var(--color-surface-2)" stroke="var(--color-border)" strokeWidth="1.5" />
            <rect x={x} y={30} width={6} height={84} rx={3} fill={i === n - 1 ? 'var(--color-magenta)' : i === 0 ? 'var(--color-accent-2)' : 'var(--color-accent)'} />
            <text x={x + bw / 2 + 3} y={64} fontSize="15" fontWeight="700" textAnchor="middle" fill="var(--color-fg)">
              {b.title}
            </text>
            {b.line && (
              <text x={x + bw / 2 + 3} y={88} fontSize="12" textAnchor="middle" fill="var(--color-fg-subtle)">
                {b.line}
              </text>
            )}
            {i < n - 1 && <Arrow x1={x + bw + 6} x2={x + bw + gap - 6} y={72} />}
            {i < n - 1 && arrows?.[i] && (
              <text x={x + bw + gap / 2} y={58} fontSize="11" textAnchor="middle" fill="var(--color-fg-subtle)">
                {arrows[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
