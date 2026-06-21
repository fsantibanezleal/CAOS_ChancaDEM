// In-app Architecture / "How it works" modal config (ADR-0058) for ChancaDEM.
// Passed to <AppShell config={{ ...config, architecture }}>. The ⓘ header button
// (provided by @fasl-work/caos-app-shell >= 0.1.2) opens the modal. Each tab pairs
// one hand-authored THEMED SVG (frontend/public/svg/tech/, shell CSS-var tokens →
// repaints with the active theme, fetched + inlined) with a bilingual ES/EN body.
import type { ArchitectureConfig } from '@fasl-work/caos-app-shell';

export const architecture: ArchitectureConfig = {
  tabs: [
    {
      id: 'app',
      en: 'The app',
      es: 'La app',
      svg: 'svg/tech/01-the-app.svg',
      body_en:
        'ChancaDEM is a comminution product: pick a crusher (cone / jaw / gyratory) and set the closed-side setting, ' +
        'throw, eccentric speed and feed PSD, and watch the product gradation (P80/P50), the throughput (tph) and the ' +
        'Bond power (kW) form — live, in a 3-D chamber view. It answers "how do the chamber settings shape the product ' +
        'size, the capacity and the power?".\n\n' +
        'It is a real system, not a demo. The population-balance crusher model (frontend/src/physics/) recomputes live ' +
        'in the browser on every control. A learned surrogate (ONNX) emulates the physics instantly and a denoising ' +
        'autoencoder flags out-of-distribution operating points — both run client-side; the inverse "target P80 → ' +
        'recommended CSS" is solved by bisection on the monotone surrogate. Contract 1 accepts your own operating point.',
      body_es:
        'ChancaDEM es un producto de conminución: elige un chancador (cono / mandíbula / giratorio) y fija el ' +
        'closed-side-setting, el throw, la velocidad del excéntrico y la PSD de alimentación, y observa formarse la ' +
        'gradación del producto (P80/P50), el throughput (tph) y la potencia de Bond (kW) — en vivo, en una cámara 3-D. ' +
        'Responde "¿cómo moldean los ajustes de cámara el tamaño del producto, la capacidad y la potencia?".\n\n' +
        'Es un sistema real, no un demo. El modelo de balance poblacional (frontend/src/physics/) recalcula en vivo en ' +
        'el navegador con cada control. Un surrogate aprendido (ONNX) emula la física al instante y un autoencoder ' +
        'denoising marca puntos de operación fuera de distribución — ambos en el cliente; el inverso "P80 objetivo → ' +
        'CSS recomendado" se resuelve por bisección sobre el surrogate monótono. El Contrato 1 acepta tu punto de operación.',
    },
    {
      id: 'lanes',
      en: 'Lanes — web / offline / compute',
      es: 'Carriles — web / offline / cómputo',
      svg: 'svg/tech/02-lanes.svg',
      body_en:
        'Three lanes, and the split is the point. WEB (live, in the browser): the TypeScript physics engine ' +
        '(frontend/src/physics/) re-runs on every control and onnxruntime-web runs surrogate.onnx + psd-ae.onnx — no ' +
        'server. OFFLINE / COMPUTE (your machine, isolated .venv): the Python pipeline bakes the canonical case ' +
        'artifacts and the heavy lane (--retrain, .venv-precompute, torch) trains the surrogate + the autoencoder and ' +
        'exports them to ONNX. REPLAY: the small, committed artifacts in data/derived are overlaid into the SPA by ' +
        'copy-data.mjs and loaded live; the typed mirror (contract.types.ts) fails the build if the web and the ' +
        'pipeline shapes ever diverge.',
      body_es:
        'Tres carriles, y la división es lo central. WEB (en vivo, en el navegador): el motor de física en TypeScript ' +
        '(frontend/src/physics/) re-corre con cada control y onnxruntime-web ejecuta surrogate.onnx + psd-ae.onnx — sin ' +
        'servidor. OFFLINE / CÓMPUTO (tu máquina, .venv aislado): el pipeline Python hornea los artefactos canónicos por ' +
        'caso y el carril pesado (--retrain, .venv-precompute, torch) entrena el surrogate + el autoencoder y los ' +
        'exporta a ONNX. REPLAY: los artefactos pequeños y versionados en data/derived se superponen al SPA con ' +
        'copy-data.mjs y se cargan en vivo; el espejo tipado (contract.types.ts) rompe el build si la web y el pipeline divergen.',
    },
    {
      id: 'web-flow',
      en: 'Web-app flow',
      es: 'Flujo de la web',
      svg: 'svg/tech/03-web-flow.svg',
      body_en:
        'The App page recomputes live: inputs (the case selector or your own operating point, plus the machine, CSS, ' +
        'throw, speed and feed controls) feed the TypeScript physics engine and the onnxruntime-web inference, which ' +
        'feed the interactive viz — the 3-D chamber, the product PSD curve and the capacity/power readouts, each ' +
        'reading values back on hover. The six sibling pages (App · Introduction · Methodology · Implementation · ' +
        'Experiments · Benchmark) are identical across every CAOS product. The build is gated by the contract-type ' +
        'mirror, the artifacts are overlaid by copy-data, vite builds the static output, and GitHub Pages serves it at ' +
        'chancadem.fasl-work.com.',
      body_es:
        'La página App recalcula en vivo: las entradas (el selector de casos o tu propio punto de operación, más los ' +
        'controles de máquina, CSS, throw, velocidad y alimentación) alimentan el motor de física en TypeScript y la ' +
        'inferencia onnxruntime-web, que alimentan la visualización interactiva — la cámara 3-D, la curva PSD del ' +
        'producto y los readouts de capacidad/potencia, cada uno devolviendo valores al pasar el cursor. Las seis ' +
        'páginas hermanas (App · Introducción · Metodología · Implementación · Experimentos · Benchmark) son idénticas ' +
        'en todos los productos CAOS. El build lo controla el espejo de tipos del contrato, los artefactos los superpone ' +
        'copy-data, vite construye el estático y GitHub Pages lo sirve en chancadem.fasl-work.com.',
    },
    {
      id: 'science',
      en: 'The science',
      es: 'La ciencia',
      svg: 'svg/tech/04-the-science.svg',
      body_en:
        'The model is a population balance of the crusher: ① the feed PSD enters as size-class masses; ② Whiten ' +
        'breakage turns the specific comminution energy into a t10 (t10 = A·(1−e^(−b·Ecs))) and an appearance / ' +
        'breakage matrix B; ③ classification C(d) by the closed-side setting selects which fragments recycle vs pass, ' +
        'and the product balance p = (I − C·B)⁻¹·(I − C)·f is solved; ④ Evertsson capacity gives the throughput from ' +
        'the open area + choke speed + nip angle; and the Bond law gives the specific power W = 10·Wi·(1/√P80 − 1/√F80). ' +
        'Outputs: the product PSD, tph and kW.\n\n' +
        'The physics engine is always on and transparent — the reference every result is measured against. The learned ' +
        'lane refines the experience: a surrogate (11→10) emulates the engine instantly for snappy sliders + the inverse ' +
        'P80→CSS by bisection, and a denoising autoencoder flags operating points outside the training envelope. Both ' +
        'run client-side as ONNX, reported next to the physics, never as a black box.',
      body_es:
        'El modelo es un balance poblacional del chancador: ① la PSD de alimentación entra como masas por clase de ' +
        'tamaño; ② la rotura de Whiten convierte la energía específica de conminución en un t10 (t10 = A·(1−e^(−b·Ecs))) ' +
        'y una matriz de apariencia / rotura B; ③ la clasificación C(d) por el closed-side-setting selecciona qué ' +
        'fragmentos recirculan vs pasan, y se resuelve el balance del producto p = (I − C·B)⁻¹·(I − C)·f; ④ la capacidad ' +
        'de Evertsson da el throughput desde el área abierta + velocidad de choke + ángulo de mordida; y la ley de Bond ' +
        'da la potencia específica W = 10·Wi·(1/√P80 − 1/√F80). Salidas: la PSD del producto, tph y kW.\n\n' +
        'El motor de física está siempre activo y es transparente — la referencia contra la que se mide todo. El carril ' +
        'aprendido mejora la experiencia: un surrogate (11→10) emula el motor al instante para sliders ágiles + el inverso ' +
        'P80→CSS por bisección, y un autoencoder denoising marca puntos de operación fuera del envolvente de entrenamiento. ' +
        'Ambos corren en el cliente como ONNX, reportados junto a la física, nunca como caja negra.',
    },
    {
      id: 'design',
      en: 'Data contracts / design',
      es: 'Contratos de datos / diseño',
      svg: 'svg/tech/05-data-contracts.svg',
      body_en:
        'Two validated data contracts bracket the pipeline. Contract 1 (ingestion) defines a valid operating point — ' +
        'the machine, CSS, throw, speed and feed descriptors, with range/NaN guards — so the app accepts your data, not ' +
        'just the built-in cases. Contract 2 (artifact) defines the output the web reads (per-case operating points, the ' +
        'surrogate-vs-physics accuracy, the model index), mirrored exactly by contract.types.ts. Between them the ' +
        'staged, deterministic pipeline runs the lane gate (numpy-light by default, --retrain for the heavy torch lane) ' +
        'and writes a provenance manifest, so every result is reproducible and the web can never silently drift.',
      body_es:
        'Dos contratos de datos validados encierran el pipeline. El Contrato 1 (ingesta) define un punto de operación ' +
        'válido — la máquina, CSS, throw, velocidad y descriptores de alimentación, con guardas de rango/NaN — para que ' +
        'la app acepte tus datos, no sólo los casos incluidos. El Contrato 2 (artefacto) define la salida que lee la web ' +
        '(puntos de operación por caso, la precisión surrogate-vs-física, el índice de modelos), espejada exactamente por ' +
        'contract.types.ts. Entre ambos, el pipeline por etapas y determinista corre el lane gate (numpy-light por ' +
        'defecto, --retrain para el carril pesado de torch) y escribe un manifest de procedencia, de modo que cada ' +
        'resultado es reproducible y la web nunca diverge en silencio.',
    },
  ],
};
