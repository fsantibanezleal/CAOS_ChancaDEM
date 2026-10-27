// The architecture modal of ChancaDEM (ADR-0058): five tabs, each an inline SVG (imported with ?raw, so it reads the page's
// theme tokens) that carries both languages, and a body in both languages. The shell validates this on mount: at least five
// tabs, inline SVG only, only defined tokens, no hex colours, both languages. A body is two to four sentences and states no
// count that changes with the data.
import type { ArchitectureConfig } from '@fasl-work/caos-app-shell';
import app from './01-the-app.svg?raw';
import lanes from './02-lanes.svg?raw';
import flow from './03-web-flow.svg?raw';
import science from './04-the-science.svg?raw';
import contracts from './05-data-contracts.svg?raw';

export const architecture: ArchitectureConfig = {
  tabs: [
    {
      id: 'app',
      en: 'The app',
      es: 'La app',
      svg: app,
      body_en:
        'One workbench. The rail on the left holds the case, either a circuit case or one of the measured HP500 surveys, the closed-side variant, the six knobs of the live engine and its live values. The instrument on the right groups the views of the case by question, Chamber, Product, Performance, Learned and Validation, with the write-up of the case as the Context tab; every view says whether it is live or replayed and whether its data is synthetic or real.',
      body_es:
        'Un banco de trabajo. El panel de la izquierda contiene el caso, ya sea un caso del circuito o uno de los muestreos HP500 medidos, la variante del lado cerrado, las seis perillas del motor en vivo y sus valores en vivo. El instrumento de la derecha agrupa las vistas del caso por pregunta, Cámara, Producto, Desempeño, Aprendido y Validación, con la descripción del caso como pestaña Contexto; cada vista dice si es en vivo o reproducida y si sus datos son sintéticos o reales.',
    },
    {
      id: 'lanes',
      en: 'Lanes',
      es: 'Carriles',
      svg: lanes,
      body_en:
        'Offline, on a workstation, the Python pipeline bakes the cases, validates the HP500 surveys and trains the two learned models; none of it runs in CI or in the browser. The committed documents are replayed by the web as they are. Live, a TypeScript port of the same engine re-runs the case with the reader\'s values, and a shared reference and a parity test hold it to the Python engine and to the baked traces.',
      body_es:
        'Fuera de línea, en una estación de trabajo, el pipeline en Python precalcula los casos, valida los muestreos HP500 y entrena los dos modelos aprendidos; nada de eso corre en CI ni en el navegador. Los documentos comprometidos los reproduce la web tal cual. En vivo, una versión en TypeScript del mismo motor vuelve a correr el caso con los valores del lector, y una referencia compartida y una prueba de paridad la sujetan al motor de Python y a las trazas precalculadas.',
    },
    {
      id: 'flow',
      en: 'Web flow',
      es: 'Flujo web',
      svg: flow,
      body_en:
        'The index names the cases and the one the App opens on, and the readiness document says what is real. A case loads its manifest and its trace as JSON, the live engine runs the selection of case, variant and knobs, and every view carries the key of the selection it draws. The learned models load only when their group opens, and each answer is labelled with the model that gave it. Before a deploy the measured gate walks the build.',
      body_es:
        'El índice nombra los casos y el caso en que abre la App, y el documento de disponibilidad dice qué es real. Un caso carga su manifiesto y su traza como JSON, el motor en vivo corre la selección de caso, variante y perillas, y cada vista lleva la clave de la selección que dibuja. Los modelos aprendidos se cargan solo cuando se abre su grupo, y cada respuesta lleva el rótulo del modelo que la dio. Antes de desplegar, la compuerta medida recorre la compilación.',
    },
    {
      id: 'science',
      en: 'The science',
      es: 'La ciencia',
      svg: science,
      body_en:
        'One operating point goes through the Whiten population balance: a Rosin-Rammler feed on a sieve grid, a classification that follows the open-side setting, a breakage matrix built from the energy, and an LU solve that gives the product. The capacity rises with the eccentric speed to an optimum and falls past it, and the power is the Bond energy times the capacity. The engine flags what is physically implausible or outside the calibrated support instead of answering it with a confident number.',
      body_es:
        'Un punto de operación pasa por el balance poblacional de Whiten: un alimento de Rosin-Rammler en una malla de tamices, una clasificación que sigue el ajuste del lado abierto, una matriz de fractura construida desde la energía, y una solución LU que da el producto. La capacidad sube con la velocidad excéntrica hasta un óptimo y cae después, y la potencia es la energía de Bond por la capacidad. El motor marca lo que es físicamente inverosímil o está fuera del soporte calibrado en vez de responderlo con un número confiado.',
    },
    {
      id: 'contracts',
      en: 'Data contracts',
      es: 'Contratos de datos',
      svg: contracts,
      body_en:
        'Contract 1 validates what enters the pipeline and contract 2 is what the pipeline commits for the web, one schema file per document. The types of the web are generated from those files, and a test reads every committed document against them in both directions. The readiness document declares, row by row, whether a document is available, partial, stale, provided, in training or missing, and every view shows that state.',
      body_es:
        'El contrato 1 valida lo que entra al pipeline y el contrato 2 es lo que el pipeline compromete para la web, un archivo de esquema por documento. Los tipos de la web se generan a partir de esos archivos, y una prueba lee cada documento comprometido contra ellos en ambas direcciones. El documento de disponibilidad declara, fila por fila, si un documento está disponible, parcial, desactualizado, provisto, en entrenamiento o ausente, y cada vista muestra ese estado.',
    },
  ],
};
