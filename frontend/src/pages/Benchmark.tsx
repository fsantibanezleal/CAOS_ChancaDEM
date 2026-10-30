// The Benchmark page of ChancaDEM: the six areas of guide 07 section 6, every number read at run time from a committed artifact.
// Results (CrusherCal's strict folds and the surrogate's held-out error), comparison (the calibrated backbone against the learned
// bounded residual, and the surrogate against the engine, computed in this browser), robustness (the backbone's error against the
// distance from the calibrated envelope), live (a measured survey run in the browser), provenance and the one honest caveat.
// The sections and their views are in `content/benchmark/`; the documents are loaded once, here.
import { DocPage } from '@fasl-work/caos-app-shell';
import { useT } from '../content/bi';
import { Caveat } from '../content/benchmark/caveat';
import { Comparison } from '../content/benchmark/comparison';
import { Live } from '../content/benchmark/live';
import { Provenance } from '../content/benchmark/provenance';
import { Results } from '../content/benchmark/results';
import { Robustness } from '../content/benchmark/robustness';
import { BenchProvider } from '../content/benchmark/shared';

export function Benchmark() {
  const t = useT();
  return (
    <DocPage
      wide
      title={{ en: 'Benchmark', es: 'Benchmark' }}
      lede={t(
        'How well the crusher studio does on measured data, and where it does not: the held-out error of the calibrated engine on ten industrial surveys against the controls that would expose a fluke, the learned residual and the learned surrogate set beside the engine they start from, how the error behaves toward the edge of the calibrated range, a panel that runs a survey through the engine and the surrogate in your browser, where every row comes from, and the limits of all of it. Every number is read from a committed artifact when the page loads.',
        'Cuán bien lo hace el estudio de chancado con datos medidos, y dónde no: el error reservado del motor calibrado en diez muestreos industriales frente a los controles que delatarían una casualidad, el residuo aprendido y el sustituto aprendido junto al motor del que parten, cómo se comporta el error hacia el borde del rango calibrado, un panel que corre un muestreo por el motor y por el sustituto en su navegador, de dónde viene cada fila, y los límites de todo ello. Cada número se lee de un artefacto versionado cuando la página carga.',
      )}
    >
      <BenchProvider>
        <Results />
        <Comparison />
        <Robustness />
        <Live />
        <Provenance />
        <Caveat />
      </BenchProvider>
    </DocPage>
  );
}
