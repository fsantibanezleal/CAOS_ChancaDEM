// The Experiments page of ChancaDEM (ADR-0017 section 2.1): six experimental questions answered from the committed artifacts, each with its
// table and its chart, and the three areas that say how the answers are judged (the metrics, the held-out protocol and the datasets). The
// text modules, the data functions and the views are in `content/experiments/`; the cross-case content moved here from the App.
import { DocPage, TabGroups } from '@fasl-work/caos-app-shell';
import { useT } from '../content/bi';
import { ExperimentsData } from '../content/experiments/context';
import { Datasets, Metrics, Protocol } from '../content/experiments/method';
import { CapacityQuestion, EnvelopeQuestion, PowerQuestion, SettingQuestion, SpeedQuestion, ThrowQuestion } from '../content/experiments/questions';

export function Experiments() {
  const t = useT();
  return (
    <DocPage
      wide
      title={{ en: 'Experiments', es: 'Experimentos' }}
      lede={t(
        'Six experimental questions on the crusher, each answered from the committed artifacts with its table and its chart: how the product and the capacity move with the setting and with the speed, whether a wider throw coarsens the product, where the ten HP500 surveys sit, and whether the calibrated capacity and the power of the engine reproduce the measured ones out of sample. The metrics, the held-out protocol and the datasets follow.',
        'Seis preguntas experimentales sobre el chancador, cada una respondida desde los artefactos comprometidos con su tabla y su gráfico: cómo se mueven el producto y la capacidad con la abertura y con la velocidad, si una carrera más ancha engrosa el producto, dónde caen los diez muestreos HP500, y si la capacidad calibrada y la potencia del motor reproducen las medidas fuera de muestra. Siguen las métricas, el protocolo con datos reservados y los conjuntos de datos.',
      )}
    >
      <ExperimentsData>
        <TabGroups
          ariaLabel={t('Experiments topics', 'Temas de los experimentos')}
          groups={[
            {
              id: 'engine',
              label: t('How does the engine respond?', '¿Cómo responde el motor?'),
              tabs: [
                { id: 'setting', label: t('The setting', 'La abertura'), content: <SettingQuestion /> },
                { id: 'speed', label: t('The speed hump', 'La joroba de velocidad'), content: <SpeedQuestion /> },
                { id: 'throw', label: t('The throw', 'La carrera'), content: <ThrowQuestion /> },
              ],
            },
            {
              id: 'surveys',
              label: t('What do the ten surveys say?', '¿Qué dicen los diez muestreos?'),
              tabs: [
                { id: 'envelope', label: t('The envelope', 'La envolvente'), content: <EnvelopeQuestion /> },
                { id: 'capacity', label: t('The capacity', 'La capacidad'), content: <CapacityQuestion /> },
                { id: 'power', label: t('The power', 'La potencia'), content: <PowerQuestion /> },
              ],
            },
            {
              id: 'judged',
              label: t('How are the answers judged?', '¿Cómo se juzgan las respuestas?'),
              tabs: [
                { id: 'metrics', label: t('Metrics', 'Métricas'), content: <Metrics /> },
                { id: 'protocol', label: t('Protocol', 'Protocolo'), content: <Protocol /> },
                { id: 'datasets', label: t('Datasets', 'Datos'), content: <Datasets /> },
              ],
            },
          ]}
        />
      </ExperimentsData>
    </DocPage>
  );
}
