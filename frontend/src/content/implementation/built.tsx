// The two topics of "How is it built?": the architecture of the build, and the contracts between its parts. Everything is
// transcribed from the code, the contract catalog and the SDD of this repository; the catalog rows of the table are held
// to docs/contracts/catalog.md by contract.test.ts in this folder.
import { DocSection, Figure } from '@fasl-work/caos-app-shell';
import { L, P, useT } from '../bi';
import { ReadinessTable } from '../../readiness/ReadinessTable';
import { ArchitectureFigure } from './figures';
import { ROWS } from './contract-rows';
import { Commands, THIS_REPO } from './parts';

export function Architecture() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The architecture', es: 'La arquitectura' }} area="architecture" noRefsReason={THIS_REPO}>
      <P
        en="The product has one direction of flow. Offline, on a workstation, the canonical Python engine evaluates every case at its operating point, the bake checks each result against the numeric range its case declares and writes the case documents, the HP500 survey table feeds the calibrated backbone and the CrusherCal validation, and a training stage fits the two learned models on a Latin-hypercube sweep of the same engine and exports them to ONNX. Everything written is a small JSON or ONNX file committed to git, so the evidence behind any number can be read, compared and reviewed."
        es="El producto tiene un solo sentido de flujo. Fuera de línea, en una estación de trabajo, el motor canónico en Python evalúa cada caso en su punto de operación, el precálculo verifica cada resultado contra el rango numérico que declara su caso y escribe los documentos de caso, la tabla de muestreos HP500 alimenta el esqueleto calibrado y la validación CrusherCal, y una etapa de entrenamiento ajusta los dos modelos aprendidos sobre un barrido de hipercubo latino del mismo motor y los exporta a ONNX. Todo lo que se escribe es un archivo JSON u ONNX pequeño comprometido en git, de modo que la evidencia detrás de cualquier número se puede leer, comparar y revisar."
      />
      <Figure caption={t('The three places of the build and the direction of flow between them; the measured gate and the Pages deploy stand after the committed files.', 'Los tres lugares de la compilación y el sentido del flujo entre ellos; la compuerta medida y el despliegue en Pages van después de los archivos comprometidos.')}>
        <ArchitectureFigure />
      </Figure>
      <P
        en="The site is static. A build copies into it exactly the files the case index declares and stops when one is missing, except a file the readiness document lists as absent in a declared partial bake, which is left out with a warning; the browser fetches each file with the product version in the address, so a new release never reads an old cached copy, and a reply that is not JSON is an error and not data. The live engine is the TypeScript port of the Python one and re-runs the selected case with the reader's values, synchronously, and the two ONNX models run in the browser through onnxruntime-web. Nothing the reader sees is computed on a machine the reader does not hold: there is no application server, and the read-only API kept in the repository is dormant."
        es="El sitio es estático. Una compilación copia a él exactamente los archivos que declara el índice de casos y se detiene cuando falta uno, salvo un archivo que el documento de disponibilidad declara ausente en un precálculo parcial, que se deja fuera con una advertencia; el navegador pide cada archivo con la versión del producto en la dirección, de modo que una versión nueva nunca lee una copia antigua en caché, y una respuesta que no es JSON es un error y no un dato. El motor en vivo es el port a TypeScript del de Python y vuelve a correr el caso seleccionado con los valores del lector, de forma síncrona, y los dos modelos ONNX corren en el navegador mediante onnxruntime-web. Nada de lo que ve el lector se calcula en una máquina que el lector no tenga: no hay servidor de aplicación, y la API de solo lectura que guarda el repositorio está inactiva."
      />
      <L
        items={[
          {
            en: 'The product declares no package of its own. The pipeline is a set of module folders run by path, with python data-pipeline/run.py, and the web is one application.',
            es: 'El producto no declara ningún paquete propio. El pipeline es un conjunto de carpetas de módulos que se corren por ruta, con python data-pipeline/run.py, y la web es una sola aplicación.',
          },
          {
            en: 'The bake and the training are release operations of a workstation. Continuous integration checks the committed files, builds the site and runs its unit tests; it never trains and never bakes.',
            es: 'El precálculo y el entrenamiento son operaciones de publicación de una estación de trabajo. La integración continua verifica los archivos comprometidos, compila el sitio y corre sus pruebas unitarias; nunca entrena ni precalcula.',
          },
          {
            en: 'The shape of every document between the parts is a schema file, and the web reads the same shape from types generated from it. The contracts topic gives the rows.',
            es: 'La forma de cada documento entre las partes es un archivo de esquema, y la web lee esa misma forma desde tipos generados a partir de él. El tema de contratos da las filas.',
          },
        ]}
      />
      <Commands lines={['python data-pipeline/run.py all        # the release bake (a workstation)', 'cd frontend && npm run build          # the site, from the committed files', 'cd frontend && npm run gate           # the measured gate on that build']} />
    </DocSection>
  );
}

export function Contract() {
  const t = useT();
  return (
    <DocSection title={{ en: 'The contracts', es: 'Los contratos' }} area="contract" noRefsReason={THIS_REPO}>
      <P
        en="Every boundary of the product is a row of the contract catalog: an identifier, a version, one schema file that is the single source of the shape, an example, a producer test and a consumer test on its two sides, the behavior when the document is missing, and a swap test that runs the same assertions on a provider tree and on the real bake. A contract moves its version by semantic versioning, so a removed or renamed field, a narrowed type or a new required field is a major step and a new optional field a minor one, and both sides change in the same pull request; a digest lock and a comparison with the base commit fail a schema that changed under the same version."
        es="Cada frontera del producto es una fila del catálogo de contratos: un identificador, una versión, un archivo de esquema que es la única fuente de la forma, un ejemplo, una prueba del productor y una del consumidor en sus dos lados, el comportamiento cuando falta el documento, y una prueba de intercambio que corre las mismas aserciones sobre un árbol de proveedor y sobre el precálculo real. Un contrato mueve su versión por versionado semántico, de modo que un campo quitado o renombrado, un tipo más estrecho o un campo obligatorio nuevo es un paso mayor y un campo opcional nuevo uno menor, y ambos lados cambian en el mismo pull request; un candado de huellas y una comparación con el commit base hacen fallar un esquema que cambió bajo la misma versión."
      />
      <table className="caos-table" data-state="ready">
        <caption>{t('The twelve rows of the catalog: what each governs and what a view does when its document is missing.', 'Las doce filas del catálogo: qué gobierna cada una y qué hace una vista cuando falta su documento.')}</caption>
        <thead>
          <tr>
            <th>{t('Contract', 'Contrato')}</th>
            <th>{t('Version', 'Versión')}</th>
            <th className="caos-col-text">{t('Schema', 'Esquema')}</th>
            <th className="caos-col-text">{t('Governs', 'Gobierna')}</th>
            <th className="caos-col-text">{t('When it is missing', 'Cuando falta')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.version}</td>
              <td className="caos-col-text">{r.schema}</td>
              <td className="caos-col-text">{t(r.governs[0], r.governs[1])}</td>
              <td className="caos-col-text">{t(r.missing[0], r.missing[1])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <P
        en="The readiness document is computed by the pipeline from the catalog and the repository, never typed. For each row but itself it declares one state, available, partial, stale, provider, training or missing, with its provenance and a reason in both languages, by rules applied in a fixed order in which the first match wins. A view shows the result with a note for the states that still hold one (partial for the cases that exist, stale with the version that baked it, provider, or training with the model that answered) and an explicit not available yet with the reason for the state that does not, missing, never an empty chart. Editing the catalog makes the document stale until it is computed again with python data-pipeline/run.py readiness, and a guard fails meanwhile."
        es="El documento de disponibilidad lo calcula el pipeline a partir del catálogo y del repositorio, nunca se escribe a mano. Para cada fila menos él mismo declara un estado, disponible, parcial, desactualizado, proveedor, entrenando o ausente, con su procedencia y una razón en ambos idiomas, con reglas aplicadas en un orden fijo en que gana la primera que coincide. Una vista muestra el resultado con una nota para los estados que aún lo permiten (parcial para los casos que existen, desactualizado con la versión que lo generó, proveedor, o entrenando con el modelo que respondió) y un aún no disponible explícito con la razón para el estado que no, ausente, nunca un gráfico vacío. Editar el catálogo deja el documento desactualizado hasta que se calcula de nuevo con python data-pipeline/run.py readiness, y una guarda falla mientras tanto."
      />
      <P
        en="The web declares the same contract and is held to it from both sides. The types of the case documents and of readiness are generated from the schema files through the OpenAPI document, and the build fails when the generated file is out of date; the other documents are typed from a run-time description of their keys. A test reads the committed bake and the provider tree against that declaration in both directions, so a key the pipeline writes and the web does not read fails, a key the web reads and the pipeline does not write fails, and a boolean where a number is expected fails. The table that follows is read from the readiness document of this build."
        es="La web declara el mismo contrato y se sujeta a él desde ambos lados. Los tipos de los documentos de caso y de la disponibilidad se generan a partir de los archivos de esquema mediante el documento OpenAPI, y la compilación falla cuando el archivo generado está desactualizado; los demás documentos se tipan desde una descripción en ejecución de sus claves. Una prueba lee el precálculo comprometido y el árbol de proveedor contra esa declaración en ambas direcciones, así que falla una clave que el pipeline escribe y la web no lee, falla una clave que la web lee y el pipeline no escribe, y falla un booleano donde se espera un número. La tabla que sigue se lee del documento de disponibilidad de esta compilación."
      />
      <ReadinessTable />
    </DocSection>
  );
}
