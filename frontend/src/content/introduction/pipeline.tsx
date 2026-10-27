// Area 4 of the Introduction's technical view: the pipeline from the data to the screen, six steps as the product runs, and
// the overview figure that draws them. Counts and budgets are those of the pipeline code and the committed reference.
import { DocSection, Figure } from '@fasl-work/caos-app-shell';
import { P, useT } from '../bi';
import { OverviewFigure } from './overview';

export function Pipeline() {
  const t = useT();
  return (
    <DocSection title={{ en: 'From the data to the screen', es: 'De los datos a la pantalla' }} area="pipeline" noRefsReason={{ en: 'Describes this build.', es: 'Describe esta compilación.' }}>
      <P
        en="Everything heavy runs offline on a workstation, never in continuous integration and never in the browser; the browser receives committed artifacts and one light engine. The six steps below follow the data in that order, and the figure draws them in two lanes."
        es="Todo lo pesado corre fuera de línea en una estación de trabajo, nunca en integración continua ni en el navegador; el navegador recibe artefactos comprometidos y un motor liviano. Los seis pasos siguientes siguen a los datos en ese orden, y la figura los dibuja en dos carriles."
      />
      <ol>
        <li>{t('Contracts. The operating point of each of the 17 synthetic cases (machine, closed-side setting, throw, speed, Rosin-Rammler feed, ore A b and work index) and the table of the ten HP500 surveys are validated before a run; a value the schema refuses is rejected with its reason and never coerced, and a physically unusual point is accepted and flagged.', 'Contratos. El punto de operación de cada uno de los 17 casos sintéticos (máquina, lado cerrado, carrera, velocidad, alimentación de Rosin-Rammler, A b del mineral e índice de trabajo) y la tabla de los diez muestreos HP500 se validan antes de una corrida; un valor que el esquema rechaza se descarta con su motivo y nunca se fuerza, y un punto físicamente inusual se acepta y se marca.')}</li>
        <li>{t('Canonical engine. The Python engine bakes the 27 cases into one manifest and one trace each on the 28-class grid, checks every case against its expected ranges and the units gate (sizes in mm, throughput in t/h, power in kW, specific energy in kWh/t), and the lane gate judges each case on its engine time against 1500 ms and its trace against 256 KiB.', 'Motor canónico. El motor en Python calcula los 27 casos en un manifiesto y una traza cada uno sobre la grilla de 28 clases, verifica cada caso contra sus rangos esperados y la compuerta de unidades (tamaños en mm, capacidad en t/h, potencia en kW, energía específica en kWh/t), y la compuerta de carriles juzga el tiempo de motor de cada caso contra 1500 ms y su traza contra 256 KiB.')}</li>
        <li>{t('CrusherCal. The engine calibrated to the HP500 is scored on each of the ten surveys held out in turn, with a constant-mean baseline and a label-shuffle control, so that the calibration cannot leak into the validation.', 'CrusherCal. El motor calibrado al HP500 se evalúa en cada uno de los diez muestreos retenido por turno, con una línea base de media constante y un control de barajado de etiquetas, de modo que la calibración no se filtre a la validación.')}</li>
        <li>{t('Learned models. A Latin-hypercube sweep of the engine labels the training of a surrogate network (11 inputs, 10 outputs) and a denoising autoencoder; both are evaluated on a second sweep held out from the training, trained locally on the CPU, and exported to ONNX.', 'Modelos aprendidos. Un barrido de hipercubo latino del motor etiqueta el entrenamiento de una red sustituta (11 entradas, 10 salidas) y de un autoencoder de eliminación de ruido; ambos se evalúan en un segundo barrido retenido del entrenamiento, se entrenan localmente en la CPU y se exportan a ONNX.')}</li>
        <li>{t('Artifacts. The committed manifests, traces and ONNX models are copied into the static site, exactly the files the index declares; there is no server and no secret.', 'Artefactos. Los manifiestos, trazas y modelos ONNX comprometidos se copian al sitio estático, exactamente los archivos que declara el índice; no hay servidor ni secreto.')}</li>
        <li>{t('Browser. The TypeScript engine re-runs the case with the values the reader sets, held to the Python engine by a shared reference of 121 operating points to 1e-9 relative; the committed replay is drawn beside it, and the two ONNX models run through onnxruntime-web.', 'Navegador. El motor en TypeScript vuelve a calcular el caso con los valores que fija el lector, sujeto al motor en Python por una referencia compartida de 121 puntos de operación a 1e-9 relativo; la reproducción comprometida se dibuja junto a él, y los dos modelos ONNX corren con onnxruntime-web.')}</li>
      </ol>
      <Figure caption={t('The six steps from the data to the screen: four offline steps on a workstation, then the committed artifacts copied into the static site and the browser, where the live engine, the replay and the ONNX models answer on one screen.', 'Los seis pasos desde los datos hasta la pantalla: cuatro pasos fuera de línea en una estación de trabajo, luego los artefactos comprometidos copiados al sitio estático y el navegador, donde el motor en vivo, la reproducción y los modelos ONNX responden en una sola pantalla.')}>
        <OverviewFigure />
      </Figure>
    </DocSection>
  );
}
