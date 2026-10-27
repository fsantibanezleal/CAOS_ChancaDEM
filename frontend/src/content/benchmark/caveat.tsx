// Caveat: the honest limits of the comparison, in the page's one honest callout. The figures in it are read from the documents when
// they are there; the statement of each limit does not wait for them.
import { Callout, DocSection, useFormat } from '@fasl-work/caos-app-shell';
import { useT } from '../bi';
import { scoresOf } from './data';
import { useBench } from './shared';

export function Caveat() {
  const t = useT();
  const f = useFormat();
  const { loo } = useBench();
  const l = loo.state === 'ready' ? loo.data : null;
  const n = l ? f(l.n, { decimals: 0 }) : t('ten', 'diez');
  const m0 = l ? scoresOf(l, 'tph', 'strict', 'M0_backbone').mape_pct : null;
  const m1 = l ? scoresOf(l, 'tph', 'strict', 'M1_residual').mape_pct : null;
  const nullResult =
    m0 !== null && m1 !== null
      ? t(
          `The bounded residual M1 does not beat the backbone out of sample: on throughput its strict MAPE is ${f(m1, { decimals: 1 })} percent against ${f(m0, { decimals: 1 })} percent for M0. That was the pre-registered expectation and it is reported as a null, not as a failure to be tuned away.`,
          `El residuo acotado M1 no supera al esqueleto fuera de muestra: en capacidad su MAPE estricto es ${f(m1, { decimals: 1 })} por ciento contra ${f(m0, { decimals: 1 })} por ciento de M0. Esa era la expectativa preregistrada y se informa como un nulo, no como un fallo que haya que ajustar hasta hacerlo desaparecer.`,
        )
      : t('The bounded residual M1 does not beat the backbone out of sample; that was the pre-registered expectation and it is reported as a null.', 'El residuo acotado M1 no supera al esqueleto fuera de muestra; esa era la expectativa preregistrada y se informa como un nulo.');
  return (
    <DocSection title={{ en: 'What this benchmark does not show', es: 'Lo que este benchmark no muestra' }} area="caveat" noRefsReason={{ en: 'States the limits of this page.', es: 'Declara los límites de esta página.' }}>
      <Callout variant="honest" title={t('Ten surveys, one machine, one ore, and a surrogate of the engine', 'Diez muestreos, una máquina, un mineral, y un sustituto del motor')}>
        <ul>
          <li>
            {t(
              `The evidence on real data is n = ${n}: ${n} surveys of one HP500 secondary cone on one itabirite ore. Coverage, rank correlations and every percentage are coarse, and nothing here transfers to another machine or another ore without a new calibration.`,
              `La evidencia con datos reales es n = ${n}: ${n} muestreos de un cono secundario HP500 sobre un mineral itabirita. La cobertura, las correlaciones de rangos y cada porcentaje son gruesos, y nada de esto se traslada a otra máquina u otro mineral sin una nueva calibración.`,
            )}
          </li>
          <li>{t('The power is the source paper’s estimate from the measured current, not a metered reading, and the backbone does not explain its spread better than the survey mean does.', 'La potencia es la estimación del artículo fuente a partir de la corriente medida, no una lectura de un medidor, y el esqueleto no explica su dispersión mejor que la media de los muestreos.')}</li>
          <li>{nullResult}</li>
          <li>{t('The surrogate emulates the engine, not the plant: its held-out error says how well it imitates the engine, and says nothing about how well the engine, or the surrogate, predicts a crusher it was never calibrated on.', 'El sustituto emula el motor, no la planta: su error reservado dice cuán bien imita al motor, y nada de cuán bien predice el motor, o el sustituto, un chancador para el que nunca fue calibrado.')}</li>
        </ul>
      </Callout>
    </DocSection>
  );
}
