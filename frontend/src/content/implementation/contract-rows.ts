// The rows of the contracts table on the Implementation page, transcribed from the contract catalog (docs/contracts/catalog.md):
// the identifier, the version, the schema identifier, what the contract governs and what a view does when its document is missing,
// in both languages. A pure module, so contract.test.ts holds it to the catalog without loading the page.

export const ROWS: { id: string; version: string; schema: string; governs: [string, string]; missing: [string, string] }[] = [
  {
    id: 'params-record',
    version: '1.0.0',
    schema: 'JSON Schema',
    governs: ['The operating point of each synthetic case: machine, closed-side setting, throw, speed, feed law, ore A times b and work index (contract 1).', 'El punto de operación de cada caso sintético: máquina, ajuste de lado cerrado, carrera, velocidad, ley del alimento, A por b del mineral e índice de trabajo (contrato 1).'],
    missing: ['No source table: the bake uses the registry cases. A rejected row is dropped with its reason and the others are baked.', 'Sin tabla de origen: el precálculo usa los casos del registro. Una fila rechazada se descarta con su razón y las demás se precalculan.'],
  },
  {
    id: 'hp500-survey',
    version: '1.0.0',
    schema: 'JSON Schema',
    governs: ['One measured survey of the HP500 secondary cone: F80, closed-side setting, feed rate and power (contract 1).', 'Un muestreo medido del cono secundario HP500: F80, ajuste de lado cerrado, tasa de alimentación y potencia (contrato 1).'],
    missing: ['No table: the real cases and both HP500 documents are skipped and the survey views say not available yet. A rejected row drops its case.', 'Sin tabla: los casos reales y los dos documentos HP500 se omiten y las vistas de muestreos dicen aún no disponible. Una fila rechazada descarta su caso.'],
  },
  {
    id: 'case-index',
    version: '1.0.0',
    schema: 'chancadem.index/v1',
    governs: ['The inventory of cases, the case the App opens on and the further files the site serves.', 'El inventario de casos, el caso en que abre la App y los demás archivos que sirve el sitio.'],
    missing: ['The site build stops, since there is no site without an inventory. Older than the product: stale, shown with both versions.', 'La compilación del sitio se detiene, pues no hay sitio sin inventario. Más antiguo que el producto: desactualizado, con ambas versiones.'],
  },
  {
    id: 'case-manifest',
    version: '1.0.0',
    schema: 'chancadem.manifest/v1',
    governs: ['One baked case: operating point, measured survey, lane verdict, metrics, expected ranges, context and source.', 'Un caso precalculado: punto de operación, muestreo medido, veredicto de carril, métricas, rangos esperados, contexto y fuente.'],
    missing: ['Partial: the selector marks the case not available yet and the other cases work.', 'Parcial: el selector marca el caso como aún no disponible y los demás casos funcionan.'],
  },
  {
    id: 'trace',
    version: '1.0.0',
    schema: 'chancadem.trace/v1',
    governs: ['The replay of one case: gradations on the sieve grid, classification curve, result scalars and two sweeps.', 'La reproducción de un caso: granulometrías en la malla, curva de clasificación, escalares del resultado y dos barridos.'],
    missing: ['Partial: the replay views say not available yet with the reason, and the live lane still runs from the manifest.', 'Parcial: las vistas de reproducción dicen aún no disponible con la razón, y el carril en vivo sigue corriendo desde el manifiesto.'],
  },
  {
    id: 'hp500-backbone',
    version: '1.0.0',
    schema: 'chancadem.hp500.backbone/v1',
    governs: ['The calibrated engine run on each of the ten surveys.', 'El motor calibrado corrido en cada uno de los diez muestreos.'],
    missing: ['Missing: the survey views of Experiments and Benchmark say not available yet; the real cases still replay.', 'Ausente: las vistas de muestreos de Experimentos y Benchmark dicen aún no disponible; los casos reales aún se reproducen.'],
  },
  {
    id: 'hp500-loo',
    version: '1.1.0',
    schema: 'chancadem.hp500.loo/v1',
    governs: ['CrusherCal: the leave-one-survey-out validation with its controls and predictive bands.', 'CrusherCal: la validación dejando un muestreo fuera, con sus controles y bandas predictivas.'],
    missing: ['Missing: the real-survey gauges show the measured values without a band and say why.', 'Ausente: los indicadores de muestreos reales muestran los valores medidos sin banda y dicen por qué.'],
  },
  {
    id: 'surrogate-model',
    version: '1.0.0',
    schema: 'chancadem.surrogate/v1',
    governs: ['The surrogate slot: its inference contract and its ONNX graphs.', 'La ranura del sustituto: su contrato de inferencia y sus grafos ONNX.'],
    missing: ['Training: the engine itself answers, labelled as the baseline.', 'Entrenando: responde el propio motor, rotulado como línea base.'],
  },
  {
    id: 'anomaly-model',
    version: '1.0.0',
    schema: 'chancadem.anomaly/v1',
    governs: ['The autoencoder slot: its inference contract and its ONNX graph.', 'La ranura del autocodificador: su contrato de inferencia y su grafo ONNX.'],
    missing: ['Training: the envelope gate answers, labelled as the baseline.', 'Entrenando: responde la compuerta de envolvente, rotulada como línea base.'],
  },
  {
    id: 'model-metrics',
    version: '1.0.0',
    schema: 'chancadem.model-metrics/v1',
    governs: ['The held-out evaluation of the two model slots.', 'La evaluación con datos retenidos de las dos ranuras de modelos.'],
    missing: ['Missing: the Benchmark model views say not available yet, never a number from an older bake.', 'Ausente: las vistas de modelos del Benchmark dicen aún no disponible, nunca un número de un precálculo anterior.'],
  },
  {
    id: 'readiness',
    version: '1.0.0',
    schema: 'chancadem.readiness/v1',
    governs: ['What is real in a build, row by row, in one of six declared states.', 'Qué es real en una compilación, fila por fila, en uno de seis estados declarados.'],
    missing: ['The site build stops; if it cannot be loaded at run time the views keep working and each says readiness unknown.', 'La compilación del sitio se detiene; si no se puede cargar en ejecución las vistas siguen funcionando y cada una dice disponibilidad desconocida.'],
  },
  {
    id: 'api',
    version: '1.0.1',
    schema: 'OpenAPI',
    governs: ['The dormant read-only API, GET only.', 'La API inactiva de solo lectura, solo GET.'],
    missing: ['The API answers 503 with the declared state and never an empty body; the static readiness says missing while it is dormant.', 'La API responde 503 con el estado declarado y nunca un cuerpo vacío; la disponibilidad estática dice ausente mientras está inactiva.'],
  },
];

/** The ids and versions of the table, for the test that holds it to the catalog. */
export const CONTRACT_ROWS = ROWS.map((r) => ({ id: r.id, version: r.version }));
