// The Implementation page of ChancaDEM (ADR-0017 section 2.1): how the product is built, in six questions. Ten topics, each one
// `DocSection` of its area, transcribed from the code, the contract catalog and the SDD; the text modules are in
// `content/implementation/`. The areas are architecture, contract, engine (five topics), lanes, reproducibility and deployment.
import { DocPage, TabGroups } from '@fasl-work/caos-app-shell';
import { useT } from '../content/bi';
import { Architecture, Contract } from '../content/implementation/built';
import { CapacityPower, EnvelopeGate, WhitenSolve } from '../content/implementation/engine';
import { CrusherCalProtocol, LearnedModels } from '../content/implementation/learned';
import { Deployment, Lanes, Reproducibility } from '../content/implementation/runs';

export function Implementation() {
  const t = useT();
  return (
    <DocPage
      title={{ en: 'Implementation', es: 'Implementación' }}
      lede={t(
        'How the crusher studio is built, in six questions: how the offline pipeline, the contracts and the site fit together, how the engine computes a product, a capacity and a power, what the learned models and the leave-one-survey-out validation add, what runs where, whether a result can be reproduced, and how the site is deployed and checked. Each topic gives the steps, constants and guards of the code and the equation of its step.',
        'Cómo está construido el estudio de chancado, en seis preguntas: cómo encajan el pipeline fuera de línea, los contratos y el sitio, cómo el motor calcula un producto, una capacidad y una potencia, qué agregan los modelos aprendidos y la validación dejando un muestreo fuera, qué corre dónde, si un resultado puede reproducirse, y cómo se despliega y se verifica el sitio. Cada tema entrega los pasos, las constantes y las guardas del código y la ecuación de su paso.',
      )}
    >
      <TabGroups
        ariaLabel={t('Implementation topics', 'Temas de implementación')}
        groups={[
          {
            id: 'built',
            label: t('How is it built?', '¿Cómo está construido?'),
            tabs: [
              { id: 'architecture', label: t('Architecture', 'Arquitectura'), content: <Architecture /> },
              { id: 'contract', label: t('Contracts', 'Contratos'), content: <Contract /> },
            ],
          },
          {
            id: 'engine',
            label: t('How does the engine compute?', '¿Cómo calcula el motor?'),
            tabs: [
              { id: 'whiten', label: t('Whiten solve', 'Solución de Whiten'), content: <WhitenSolve /> },
              { id: 'capacity', label: t('Capacity and power', 'Capacidad y potencia'), content: <CapacityPower /> },
              { id: 'envelope', label: t('Envelope gate', 'Compuerta de envolvente'), content: <EnvelopeGate /> },
            ],
          },
          {
            id: 'beyond',
            label: t('What do the models and the validation add?', '¿Qué agregan los modelos y la validación?'),
            tabs: [
              { id: 'learned', label: t('Learned models', 'Modelos aprendidos'), content: <LearnedModels /> },
              { id: 'crushercal', label: t('CrusherCal', 'CrusherCal'), content: <CrusherCalProtocol /> },
            ],
          },
          { id: 'runs', label: t('What runs where?', '¿Qué corre dónde?'), tabs: [{ id: 'lanes', label: t('Lanes', 'Carriles'), content: <Lanes /> }] },
          { id: 'trust', label: t('Can it be reproduced?', '¿Se puede reproducir?'), tabs: [{ id: 'reproducibility', label: t('Reproducibility', 'Reproducibilidad'), content: <Reproducibility /> }] },
          { id: 'ships', label: t('How does it ship?', '¿Cómo se entrega?'), tabs: [{ id: 'deployment', label: t('Deployment', 'Despliegue'), content: <Deployment /> }] },
        ]}
      />
    </DocPage>
  );
}
