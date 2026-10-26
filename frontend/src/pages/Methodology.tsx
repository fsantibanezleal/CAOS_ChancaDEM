// The methods of ChancaDEM, one topic each (ADR-0017 section 2.1), grouped by the question a reader asks: what size goes in
// and out, how a particle breaks, which particles are broken, what the machine can do, what the learned models add, and
// whether the calibrated engine is right on measured data. Every topic is one `method` section with its paragraphs, its
// captioned equations, a figure, one honest callout and its references; the text modules are in `content/methodology/`.
import { DocPage, TabGroups } from '@fasl-work/caos-app-shell';
import { useT } from '../content/bi';
import { Breakage } from '../content/methodology/breakage';
import { Calibrated, Whiten } from '../content/methodology/classification';
import { Autoencoder, Surrogate } from '../content/methodology/learned';
import { Capacity, Power } from '../content/methodology/machine';
import { Size } from '../content/methodology/size';
import { CrusherCal } from '../content/methodology/validation';

export function Methodology() {
  const t = useT();
  return (
    <DocPage
      title={{ en: 'Methodology', es: 'Metodología' }}
      lede={t(
        'The nine methods behind the crusher studio, in six questions: which sizes go in and out, how a particle breaks, which particles the chamber breaks, what the machine can do, what the two learned models add beside the engine, and whether the calibrated engine holds on measured surveys. Each topic gives its equations with the constants of the code, one figure, and what is exact against what is illustrative.',
        'Los nueve métodos detrás del estudio de chancado, en seis preguntas: qué tamaños entran y salen, cómo se rompe una partícula, qué partículas rompe la cámara, qué puede hacer la máquina, qué agregan los dos modelos aprendidos junto al motor, y si el motor calibrado se sostiene con encuestas medidas. Cada tema entrega sus ecuaciones con las constantes del código, una figura, y qué es exacto frente a qué es ilustrativo.',
      )}
    >
      <TabGroups
        ariaLabel={t('Methodology topics', 'Temas de metodología')}
        groups={[
          { id: 'size', label: t('What size goes in and out?', '¿Qué tamaño entra y sale?'), tabs: [{ id: 'size', label: t('Size distributions', 'Distribuciones de tamaño'), content: <Size /> }] },
          { id: 'breakage', label: t('How does a particle break?', '¿Cómo se rompe una partícula?'), tabs: [{ id: 'breakage', label: t('Breakage and appearance', 'Fractura y aparición'), content: <Breakage /> }] },
          {
            id: 'classification',
            label: t('Which particles are broken?', '¿Qué partículas se rompen?'),
            tabs: [
              { id: 'whiten', label: t('Whiten and the balance', 'Whiten y el balance'), content: <Whiten /> },
              { id: 'calibrated', label: t('Calibrated HP500 fit', 'Ajuste HP500 calibrado'), content: <Calibrated /> },
            ],
          },
          {
            id: 'machine',
            label: t('What can the machine do?', '¿Qué puede hacer la máquina?'),
            tabs: [
              { id: 'capacity', label: t('Capacity and nip angle', 'Capacidad y ángulo de mordida'), content: <Capacity /> },
              { id: 'power', label: t('Power', 'Potencia'), content: <Power /> },
            ],
          },
          {
            id: 'learned',
            label: t('What do the learned models add?', '¿Qué agregan los modelos aprendidos?'),
            tabs: [
              { id: 'surrogate', label: t('Surrogate network', 'Red sustituta'), content: <Surrogate /> },
              { id: 'autoencoder', label: t('Autoencoder', 'Autoencoder'), content: <Autoencoder /> },
            ],
          },
          { id: 'validation', label: t('Is it right on measured data?', '¿Es correcto con datos medidos?'), tabs: [{ id: 'crushercal', label: t('CrusherCal', 'CrusherCal'), content: <CrusherCal /> }] },
        ]}
      />
    </DocPage>
  );
}
