import { Refs, useShellLang } from '@fasl-work/caos-app-shell';

// Introduction, what the studio is, the problem it addresses, and the honest scope boundary (didactic
// comminution sandbox, not a plant controller). Deepened with diagrams in the runtime stage.
export default function Introduction() {
  const es = useShellLang() === 'es';
  return (
    <section className="page-body prose">
      <h2>{es ? 'Introducción' : 'Introduction'}</h2>
      <p className="tz-lead">{es
        ? 'ChancaDEM es un estudio de física de chancado en el navegador. Defines la máquina (giratoria primaria, mandíbula, cono secundario/terciario o short-head), el setting de lado cerrado (CSS), la carrera y la velocidad excéntrica, y la granulometría de alimentación; el estudio calcula la gradación del producto, la capacidad y la potencia, y muestra por qué.'
        : 'ChancaDEM is an in-browser crusher-physics studio. You set the machine (primary gyratory, jaw, secondary/tertiary cone or short-head), the closed-side setting (CSS), the eccentric throw and speed, and the feed size distribution; it computes the product gradation, throughput and power, and shows why.'}</p>

      <svg viewBox="0 0 640 120" width="100%" style={{ maxWidth: 640, display: 'block', margin: '0.8rem auto', font: '11px var(--font-sans, sans-serif)' }} role="img" aria-label="model chain overview">
        <rect x="6" y="44" width="96" height="32" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="54" y="64" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'parámetros' : 'parameters'}</text>
        <line x1="102" y1="60" x2="132" y2="60" stroke="var(--color-fg-subtle)" />
        <rect x="132" y="22" width="120" height="34" rx="6" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="192" y="43" textAnchor="middle" fill="var(--color-fg)" fontSize="10">{es ? 'clasificación C' : 'classification C'}</text>
        <rect x="132" y="64" width="120" height="34" rx="6" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="192" y="85" textAnchor="middle" fill="var(--color-fg)" fontSize="10">{es ? 'fractura B (t10)' : 'breakage B (t10)'}</text>
        <line x1="252" y1="60" x2="282" y2="60" stroke="var(--color-fg-subtle)" />
        <rect x="282" y="40" width="130" height="40" rx="6" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="347" y="58" textAnchor="middle" fill="var(--color-fg)" fontSize="10">{es ? 'balance Whiten' : 'Whiten balance'}</text><text x="347" y="72" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="9">p=(I−C)(I−B·C)⁻¹f</text>
        <line x1="412" y1="60" x2="442" y2="60" stroke="var(--color-fg-subtle)" />
        <rect x="442" y="22" width="92" height="34" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="488" y="43" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'producto PSD' : 'product PSD'}</text>
        <rect x="442" y="64" width="92" height="34" rx="6" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="488" y="85" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'capacidad+pot.' : 'capacity+power'}</text>
        <line x1="534" y1="60" x2="560" y2="60" stroke="var(--color-fg-subtle)" />
        <rect x="560" y="40" width="74" height="40" rx="6" fill="var(--color-surface)" stroke="#3fb950" /><text x="597" y="58" textAnchor="middle" fill="var(--color-fg)" fontSize="9">ONNX</text><text x="597" y="71" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="8">{es ? 'surrogate+AE' : 'surrogate+AE'}</text>
      </svg>

      <h3>{es ? 'El problema' : 'The problem'}</h3>
      <p>{es
        ? 'La conminución (chancado y molienda) consume la mayor parte de la energía de una planta minera. En la etapa de chancado, el operador ajusta esencialmente tres palancas, CSS, carrera y velocidad, y el resultado (qué tan fino sale el producto, cuánto pasa y cuánta potencia cuesta) emerge de la interacción entre la geometría de la cámara y la mecánica de fractura de la roca. Esa relación no es intuitiva: cerrar el CSS afina el producto pero baja la capacidad; subir la velocidad sube la capacidad hasta un óptimo y luego la derrumba.'
        : 'Comminution (crushing and grinding) consumes most of a mine’s energy. At the crushing stage an operator essentially turns three levers, CSS, throw and speed, and the outcome (how fine the product is, how much passes, how much power it costs) emerges from the interaction of chamber geometry and rock breakage mechanics. That relationship is non-intuitive: closing the CSS makes the product finer but lowers capacity; raising the speed raises capacity up to an optimum and then collapses it.'}</p>

      <h3>{es ? 'Qué hace ChancaDEM' : 'What ChancaDEM does'}</h3>
      <p>{es
        ? 'ChancaDEM acopla tres modelos citados: el modelo de chancado de Whiten (clasificación + fractura, balance poblacional), la capacidad de flujo de Evertsson (la joroba de capacidad vs velocidad) y la potencia de Bond. Todo corre en vivo en TypeScript puro. Encima, dos modelos aprendidos en ONNX corren en el navegador: un surrogate (emulador) del balance poblacional para respuestas instantáneas, y un autoencoder de detección de anomalías de operación que además avisa cuándo el surrogate está extrapolando. La vista 3D es una animación cinemática de la cámara (geometría + movimiento + la gradación que calcula el motor), no una resolución DEM; el trazador DEM 2-D offline es el siguiente incremento documentado.'
        : 'ChancaDEM couples three cited models: the Whiten crusher model (classification + breakage, a population balance), the Evertsson flow capacity model (the capacity hump vs speed) and Bond power. All run live in pure TypeScript. On top, two learned ONNX models run in the browser: a population-balance surrogate (emulator) for instant what-ifs, and a denoising autoencoder operating-anomaly score that also warns when the surrogate is extrapolating. The 3D view is a kinematic chamber animation (geometry + motion + the gradation the engine computes), not a DEM solve; the offline 2-D DEM tracer is the documented next increment.'}</p>

      <h3>{es ? 'Alcance honesto' : 'Honest scope'}</h3>
      <p>{es
        ? 'Esto es un sandbox didáctico de conminución, no un sistema de control de planta. El DEM industrial (millones de partículas, ~4 h de cómputo por segundo de operación) es imposible en el navegador; la vista 3D actual es una animación cinemática, no resuelve partículas, y el replay de trazas DEM pre-horneadas offline es el siguiente incremento documentado. Las constantes son ilustrativas (reproducen tendencias) hasta calibrar con datos industriales abiertos; los números sintéticos se rotulan como tales.'
        : 'This is a didactic comminution sandbox, not a plant control system. Industrial DEM (millions of particles, ~4 h of compute per second of operation) is impossible in a browser; today\'s 3D view is a kinematic animation, it does not solve particles, and replaying offline pre-baked DEM traces is the documented next increment. Constants are illustrative (they reproduce trends) pending calibration to open industrial data; synthetic numbers are labelled as such.'}</p>

      <p className="tz-note">{es
        ? 'ChancaDEM es parte del hub de analítica minera Faena. Cada app cubre una etapa de la cadena de valor; ChancaDEM es la de chancado.'
        : 'ChancaDEM is part of the Faena mining-analytics hub. Each app covers one value-chain stage; ChancaDEM is the crushing one.'}</p>

      <Refs ids={['whiten1972', 'evertsson2000', 'bond1952', 'quist2016', 'napiermunn1996']} label="References" />
    </section>
  );
}
