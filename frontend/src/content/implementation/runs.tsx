// The three topics of "what runs where, can it be reproduced, how does it ship": the lanes and what admits a case to the live
// one, the reproducibility of a result, and the deployment on GitHub Pages. Constants are those of the lane gate, the
// pipeline, the engine reference, the Pages workflow and the live check.
import { Callout, DocSection } from '@fasl-work/caos-app-shell';
import { L, P, useT } from '../bi';
import { Commands, THIS_REPO } from './parts';

export function Lanes() {
  return (
    <DocSection title={{ en: 'The lanes', es: 'Los carriles' }} area="lanes" noRefsReason={THIS_REPO}>
      <P
        en="The lane of a case is decided by a measured gate in the pipeline, not by hand. A case is eligible for the live lane when its engine is pure Python with only numpy among its wheels, which is the proxy for an engine small enough to port or to run on the client, when one run takes at most 1500 ms and when its committed trace is at most 256 KiB, 262,144 bytes. The verdict, the reasons and the budgets are written into the manifest; a case that fails any condition is labelled precompute and replayed only, and a check over the committed files fails a lane that differs from what the gate computes. At this release the design records every case as eligible."
        es="El carril de un caso lo decide una compuerta medida del pipeline, no una persona. Un caso es elegible para el carril en vivo cuando su motor es Python puro con solo numpy entre sus paquetes, que es el indicador de un motor lo bastante pequeño para portarse o correr en el cliente, cuando una corrida toma como máximo 1500 ms y cuando su traza comprometida pesa como máximo 256 KiB, 262.144 bytes. El veredicto, las razones y los presupuestos se escriben en el manifiesto; un caso que falla alguna condición se rotula precálculo y solo se reproduce, y una verificación sobre los archivos comprometidos hace fallar un carril que difiere de lo que calcula la compuerta. En esta versión el diseño registra todos los casos como elegibles."
      />
      <P
        en="The budget is judged on a measured cost, the median of several warmed runs of the engine and not the time of the whole bake, which once made the verdict depend on which case was baked first. The raw time decides the verdict but is deliberately not stored: the committed manifest must be a pure function of the parameters and the seed, and a wall-clock number would dirty git on every re-run, so the manifest keeps the verdict and the budgets, and the live runtime is measured in the reader's browser, where the claim that a case may run live is checked on the device that runs it."
        es="El presupuesto se juzga sobre un costo medido, la mediana de varias corridas calentadas del motor y no el tiempo de todo el precálculo, que una vez hizo depender el veredicto de qué caso se calculaba primero. El tiempo crudo decide el veredicto pero deliberadamente no se guarda: el manifiesto comprometido debe ser una función pura de los parámetros y la semilla, y un número de reloj ensuciaría git en cada nueva corrida, así que el manifiesto guarda el veredicto y los presupuestos, y el tiempo en vivo se mide en el navegador del lector, donde la afirmación de que un caso puede correr en vivo se verifica en el dispositivo que lo corre."
      />
      <L
        items={[
          {
            en: 'Offline: the Python pipeline, run on a workstation, bakes the cases, the HP500 documents and the readiness document, and trains the two learned models; its results are committed.',
            es: 'Fuera de línea: el pipeline en Python, corrido en una estación de trabajo, precalcula los casos, los documentos HP500 y el documento de disponibilidad, y entrena los dos modelos aprendidos; sus resultados se comprometen.',
          },
          {
            en: 'Replay: the web reads the committed documents as they are, the gradations, the classification curve, the result scalars and the two sweeps of the trace (31 points over 0.5 to 1.5 times the speed and the setting of the case), and recomputes nothing of what was baked.',
            es: 'Reproducción: la web lee los documentos comprometidos tal como están, las granulometrías, la curva de clasificación, los escalares del resultado y los dos barridos de la traza (31 puntos entre 0,5 y 1,5 veces la velocidad y el ajuste del caso), y no recalcula nada de lo precalculado.',
          },
          {
            en: 'Live: the TypeScript engine re-runs the case with the six values of the rail (setting, throw, speed, feed size, feed uniformity and ore A times b) and with a variant that scales the setting by 1, 0.85 or 1.15; the machine and the Bond index belong to the case, and the inputs of a measured survey are shown and not changed. The two ONNX models run live too, once the Learned group opens.',
            es: 'En vivo: el motor en TypeScript vuelve a correr el caso con los seis valores del panel (ajuste, carrera, velocidad, tamaño del alimento, uniformidad del alimento y A por b del mineral) y con una variante que escala el ajuste por 1, 0,85 o 1,15; la máquina y el índice de Bond pertenecen al caso, y las entradas de un muestreo medido se muestran y no se cambian. Los dos modelos ONNX también corren en vivo, cuando se abre el grupo Aprendido.',
          },
        ]}
      />
    </DocSection>
  );
}

export function Reproducibility() {
  const t = useT();
  return (
    <DocSection title={{ en: 'Reproducibility', es: 'Reproducibilidad' }} area="reproducibility" noRefsReason={THIS_REPO}>
      <P
        en="A result is reproduced from three things written next to it: the seed, the engine version and the case parameters, all in the manifest, which is a pure function of the parameters and the seed. Every random generator is made from a seed. The pipeline builds its numpy generator from the bake seed, 42 by default; the Latin-hypercube sweep of the learned models draws with the mulberry32 generator from the seed 12345 for training and 67890 for the held-out draw; torch is seeded and runs on one thread; and the label-shuffle control of CrusherCal uses the seed 42 and the two that follow. A second bake on the same code and inputs therefore writes the same bytes."
        es="Un resultado se reproduce con tres cosas escritas junto a él: la semilla, la versión del motor y los parámetros del caso, todo en el manifiesto, que es una función pura de los parámetros y la semilla. Todo generador aleatorio se construye con una semilla. El pipeline arma su generador de numpy con la semilla del precálculo, 42 por defecto; el barrido de hipercubo latino de los modelos aprendidos sortea con el generador mulberry32 desde la semilla 12345 para el entrenamiento y 67890 para la muestra retenida; torch tiene semilla y corre en un solo hilo; y el control de etiquetas barajadas de CrusherCal usa la semilla 42 y las dos siguientes. Un segundo precálculo con el mismo código y las mismas entradas escribe, por lo tanto, los mismos bytes."
      />
      <P
        en="The two engines are one implementation in two languages, and a shared reference holds them equal. The reference is a fixture of 121 operating points with the full result of each and the feature vectors of the two learned models; numbers must agree within 1e-9 times the larger of one and the expected value, and text and booleans exactly. The TypeScript test produces the fixture when asked and checks it otherwise, and the Python test reproduces it point by point, so neither engine can change alone. The largest relative difference between them is more than two orders of magnitude below that tolerance. A second tie holds the live engine to the six significant digits of every committed trace, so the replay and the live lane cannot drift apart unnoticed."
        es="Los dos motores son una implementación en dos lenguajes, y una referencia compartida los mantiene iguales. La referencia es un archivo de 121 puntos de operación con el resultado completo de cada uno y los vectores de características de los dos modelos aprendidos; los números deben coincidir dentro de 1e-9 veces el mayor entre uno y el valor esperado, y el texto y los booleanos de forma exacta. La prueba de TypeScript produce el archivo cuando se le pide y lo verifica en los demás casos, y la prueba de Python lo reproduce punto por punto, así que ningún motor puede cambiar solo. La mayor diferencia relativa entre ellos está más de dos órdenes de magnitud bajo esa tolerancia. Un segundo vínculo sujeta el motor en vivo a las seis cifras significativas de cada traza comprometida, de modo que la reproducción y el carril en vivo no pueden separarse sin que se note."
      />
      <P
        en="The version is written once, in the VERSION file, and the pipeline, the web and the changelog read it; a document baked by an older version is shown as stale and never as current, the contracts keep their own versions with a digest lock, and the dependencies are pinned exactly, among them numpy, torch, onnx and onnxruntime for the offline lane and onnxruntime-web and the shell for the web. The bake also runs a units gate: per case and observable, a prediction must be finite and inside the physical range of that observable widened by a full range on each side, and the same check runs again over the shipped artifacts, so a power given in the wrong unit fails the bake and does not reach the reader."
        es="La versión se escribe una sola vez, en el archivo VERSION, y el pipeline, la web y el registro de cambios la leen; un documento generado por una versión anterior se muestra como desactualizado y nunca como vigente, los contratos llevan sus propias versiones con un candado de huellas, y las dependencias están fijadas exactamente, entre ellas numpy, torch, onnx y onnxruntime para el carril fuera de línea y onnxruntime-web y el shell para la web. El precálculo también corre una compuerta de unidades: por caso y observable, una predicción debe ser finita y quedar dentro del rango físico de ese observable ensanchado en un rango completo a cada lado, y la misma verificación corre otra vez sobre los artefactos publicados, de modo que una potencia dada en la unidad equivocada hace fallar el precálculo y no llega al lector."
      />
      <Commands
        lines={[
          './scripts/setup.sh                              # the pipeline environment (scripts/setup.ps1 on Windows)',
          './scripts/precompute.sh all --output <folder>   # a bake into a sandbox, never into the committed tree',
          'python -m pytest                                # the pipeline and contract tests, on a workstation',
          'cd frontend && npm test                         # the engine reference, the parity and the contract tests',
        ]}
      />
      <Callout variant="note" title={t('A bake is a release operation', 'Un precálculo es una operación de publicación')}>
        {t(
          'The committed artifacts are the evidence, so nothing rewrites them by accident. A test or a continuous-integration run passes an output folder, every test runs with the pipeline roots pointed at a temporary folder, and the test session fails if any file under the data or models folders changed during the run. Only an intentional bake, with no output folder, writes the committed tree.',
          'Los artefactos comprometidos son la evidencia, así que nada los reescribe por accidente. Una prueba o una corrida de integración continua pasa una carpeta de salida, cada prueba corre con las raíces del pipeline apuntando a una carpeta temporal, y la sesión de pruebas falla si algún archivo de las carpetas de datos o modelos cambió durante la corrida. Solo un precálculo intencional, sin carpeta de salida, escribe el árbol comprometido.',
        )}
      </Callout>
    </DocSection>
  );
}

export function Deployment() {
  return (
    <DocSection title={{ en: 'Deployment', es: 'Despliegue' }} area="deployment" noRefsReason={THIS_REPO}>
      <P
        en="The product is a static site on GitHub Pages at chancadem.fasl-work.com: every artifact is committed, there is no secret and no server, and the repository is public. The deploy place is decided once, recorded in the repository and checked by a guard that fails when the files of another place remain. The custom domain is a CNAME file in the site's public folder; with it the build uses the root as its base path, and without it the base path is the repository name."
        es="El producto es un sitio estático en GitHub Pages en chancadem.fasl-work.com: cada artefacto está comprometido, no hay secretos ni servidor, y el repositorio es público. El lugar de despliegue se decide una vez, queda registrado en el repositorio y lo verifica una guarda que falla cuando quedan archivos de otro lugar. El dominio propio es un archivo CNAME en la carpeta pública del sitio; con él la compilación usa la raíz como ruta base, y sin él la ruta base es el nombre del repositorio."
      />
      <P
        en="The deploy workflow runs only after the checks workflow succeeded on the main branch, on that same commit. It checks that the committed artifacts are consistent and that Pages is the one deploy place, installs the web dependencies from the lock file, builds the site from the committed artifacts, uploads the build and publishes it. It never trains, bakes or recomputes anything. A last job then checks the live site, retrying up to 20 times at 15-second intervals while the host's cache catches up: build.json must name the commit that was pushed, every route must answer with HTML both with and without its trailing slash, a file that does not exist must answer 404, and the artifact index must answer JSON."
        es="El flujo de despliegue corre solo después de que el flujo de verificaciones tuvo éxito en la rama main, sobre ese mismo commit. Verifica que los artefactos comprometidos sean consistentes y que Pages sea el único lugar de despliegue, instala las dependencias de la web desde el archivo de bloqueo, compila el sitio desde los artefactos comprometidos, sube la compilación y la publica. Nunca entrena, precalcula ni recalcula nada. Un último trabajo verifica luego el sitio publicado, con hasta 20 reintentos a intervalos de 15 segundos mientras la caché del anfitrión se actualiza: build.json debe nombrar el commit que se empujó, cada ruta debe responder con HTML con y sin su barra final, un archivo que no existe debe responder 404, y el índice de artefactos debe responder JSON."
      />
      <P
        en="Before a release the measured gate runs on that build, on a workstation because it needs a browser: it serves the build as GitHub Pages does, with no fallback to the application, and walks every route, tab and case at five screen sizes from 390 by 844 to 2560 by 1440, in both themes and both languages, and it requires the Focus mode of the App. It fails on what a reader would meet: an error in the console, a broken link, a control that cannot be reached or changes nothing, a blank or undersized drawing, a view that never settles, text under the contrast floor, or a documentation page that lacks an area its floor requires. After the deploy the same gate runs against the deployed origin."
        es="Antes de una publicación la compuerta medida corre sobre esa compilación, en una estación de trabajo porque necesita un navegador: sirve la compilación como lo hace GitHub Pages, sin respaldo hacia la aplicación, y recorre cada ruta, pestaña y caso en cinco tamaños de pantalla, de 390 por 844 a 2560 por 1440, con ambos temas y ambos idiomas, y exige el modo Foco de la App. Falla ante lo que encontraría un lector: un error en la consola, un enlace roto, un control al que no se puede llegar o que no cambia nada, un dibujo en blanco o demasiado pequeño, una vista que nunca se estabiliza, texto bajo el piso de contraste, o una página de documentación que carece de un área que su piso exige. Después del despliegue la misma compuerta corre contra el origen publicado."
      />
      <Commands
        lines={[
          'cd frontend && npm run build                          # copy the declared artifacts, type-check, bundle, write every route',
          'cd frontend && npm run gate                           # the measured gate on that build',
          'cd frontend && npm run gate -- --url https://chancadem.fasl-work.com   # the same gate on the deployed origin',
        ]}
      />
    </DocSection>
  );
}
