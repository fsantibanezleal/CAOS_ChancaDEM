// The protocol figure of the Experiments page: the two held-out protocols of the product beside the anti-pattern each one forbids. Above, the
// strict leave-one-survey-out fold (fit on nine surveys, predict the tenth) beside the forbidden leaky fit (fit on ten, score on the same ten).
// Below, the independent second Latin-hypercube draw that scores the models beside the forbidden row split of one draw. Coloured only with the
// shell's theme tokens, so it follows the light and dark themes; an arrow is a drawn path, a cross is two strokes, never a character.
import { useT } from '../bi';

const FIT = 'var(--color-accent)';
const OUT = 'var(--color-good)';
const BAD = 'var(--color-bad)';
const TEXT = 'var(--color-fg)';
const SUB = 'var(--color-fg-subtle)';

function Cross({ x, y }: { x: number; y: number }) {
  return <path d={`M ${x - 6} ${y - 6} L ${x + 6} ${y + 6} M ${x + 6} ${y - 6} L ${x - 6} ${y + 6}`} stroke={BAD} strokeWidth="3" strokeLinecap="round" fill="none" />;
}

function Tick({ x, y }: { x: number; y: number }) {
  return <path d={`M ${x - 6} ${y} L ${x - 2} ${y + 5} L ${x + 7} ${y - 6}`} stroke={OUT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

export function ProtocolFigure() {
  const t = useT();
  const sq = (i: number) => 16 + i * 32;
  const held = 3;
  return (
    <svg className="fig-svg wide" viewBox="0 0 640 372" role="img" aria-label={t('The held-out protocols and the shortcuts they forbid', 'Los protocolos con datos reservados y los atajos que prohíben')}>
      {/* surveys, allowed */}
      <Tick x={22} y={14} />
      <text x={38} y={19} fontSize="13" fontWeight="700" fill={TEXT}>
        {t('Surveys, allowed: strict leave-one-survey-out fold', 'Muestreos, permitido: pliegue estricto dejando un muestreo fuera')}
      </text>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={sq(i)} y={30} width={26} height={26} rx={4} fill={i === held ? OUT : FIT} stroke="var(--color-border)" strokeWidth="1" />
      ))}
      <text x={sq(held) + 13} y={74} fontSize="12" textAnchor="middle" fill={SUB}>
        {t('held out', 'retenido')}
      </text>
      <text x={352} y={42} fontSize="12" fill={SUB}>
        {t('Fit on the other nine,', 'Se ajusta con los otros nueve,')}
      </text>
      <text x={352} y={58} fontSize="12" fill={SUB}>
        {t('predict this one, ten times.', 'se predice este, diez veces.')}
      </text>

      {/* surveys, forbidden */}
      <Cross x={22} y={104} />
      <text x={38} y={109} fontSize="13" fontWeight="700" fill={TEXT}>
        {t('Surveys, forbidden: fit on ten, score on the same ten', 'Muestreos, prohibido: ajustar con diez y evaluar en los mismos diez')}
      </text>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={sq(i)} y={120} width={26} height={26} rx={4} fill={FIT} stroke={BAD} strokeWidth="2" />
      ))}
      <path d={`M ${sq(0)} 158 L ${sq(0)} 164 L ${sq(9) + 26} 164 L ${sq(9) + 26} 158`} stroke={BAD} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x={sq(0)} y={182} fontSize="12" fill={SUB}>
        {t('scored on rows it was fitted on', 'evaluado en filas con las que se ajustó')}
      </text>
      <text x={352} y={132} fontSize="12" fill={SUB}>
        {t('A fitted scalar looks better', 'Un escalar ajustado se ve mejor')}
      </text>
      <text x={352} y={148} fontSize="12" fill={SUB}>
        {t('on its own rows: optimism.', 'en sus propias filas: optimismo.')}
      </text>

      {/* models, allowed */}
      <Tick x={22} y={214} />
      <text x={38} y={219} fontSize="13" fontWeight="700" fill={TEXT}>
        {t('Models, allowed: a second, independent draw', 'Modelos, permitido: un segundo sorteo independiente')}
      </text>
      <rect x={16} y={232} width={190} height={30} rx={6} fill={FIT} stroke="var(--color-border)" strokeWidth="1" />
      <text x={111} y={252} fontSize="12" fontWeight="600" textAnchor="middle" fill="var(--color-accent-fg)">
        {t('Draw one: fit', 'Sorteo uno: ajuste')}
      </text>
      <path d="M 214 247 L 262 247 M 255 241 L 262 247 L 255 253" stroke="var(--color-fg-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x={270} y={232} width={250} height={30} rx={6} fill={OUT} stroke="var(--color-border)" strokeWidth="1" />
      <text x={395} y={252} fontSize="12" fontWeight="600" textAnchor="middle" fill="var(--color-bg)">
        {t('Draw two: independent, scored', 'Sorteo dos: independiente, evaluado')}
      </text>

      {/* models, forbidden */}
      <Cross x={22} y={296} />
      <text x={38} y={301} fontSize="13" fontWeight="700" fill={TEXT}>
        {t('Models, forbidden: a row split of one draw', 'Modelos, prohibido: partir por filas un solo sorteo')}
      </text>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={16 + i * 51} y={312} width={46} height={26} rx={4} fill={i % 3 === 2 ? OUT : FIT} stroke={BAD} strokeWidth="1.5" />
      ))}
      <text x={16} y={360} fontSize="12" fill={SUB}>
        {t('test rows belong to the design of the training rows', 'las filas de prueba pertenecen al diseño de las de entrenamiento')}
      </text>
    </svg>
  );
}
