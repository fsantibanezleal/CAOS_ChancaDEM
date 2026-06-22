import { Refs, useShellLang } from '@fasl-work/caos-app-shell';

// Implementation — the two-tier architecture: heavy DEM offline → seeded replay traces + a learned surrogate;
// the pure-TS physics + ONNX inference live. Architecture SVG is deepened in the runtime stage.
const sv = { maxWidth: 620, display: 'block', margin: '0.8rem auto', font: '11px var(--font-sans, sans-serif)' } as const;

export default function Implementation() {
  const es = useShellLang() === 'es';
  return (
    <section className="page-body prose">
      <h2>{es ? 'Implementación' : 'Implementation'}</h2>
      <p className="tz-lead">{es ? 'Dos capas: lo pesado (DEM) se precalcula offline y se versiona como trazas reproducibles + modelos ONNX; lo liviano (balance poblacional + inferencia aprendida) corre en vivo en el navegador.' : 'Two tiers: the heavy work (DEM) is precomputed offline and versioned as reproducible traces + ONNX models; the light work (population balance + learned inference) runs live in the browser.'}</p>

      <svg viewBox="0 0 640 220" width="100%" style={sv} role="img" aria-label="architecture">
        <rect x="10" y="14" width="300" height="92" rx="8" fill="none" stroke="var(--color-border)" strokeDasharray="4 3" />
        <text x="20" y="30" fill="var(--color-fg-subtle)" fontSize="11" fontWeight="600">{es ? 'OFFLINE · .venv (Python)' : 'OFFLINE · .venv (Python)'}</text>
        <rect x="22" y="40" width="130" height="26" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="87" y="57" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">DEM {es ? 'grueso (sección)' : 'coarse (section)'}</text>
        <rect x="22" y="74" width="130" height="26" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="87" y="91" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">LHS → {es ? 'entrena' : 'train'} ONNX</text>
        <rect x="166" y="40" width="130" height="60" rx="5" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="231" y="66" textAnchor="middle" fontSize="10" fill="var(--color-fg)">{es ? 'artefactos:' : 'artifacts:'}</text><text x="231" y="82" textAnchor="middle" fontSize="9" fill="var(--color-fg-subtle)">cz-*.bin · *.onnx · json</text>

        <line x1="320" y1="60" x2="360" y2="60" stroke="var(--color-fg-subtle)" />
        <text x="340" y="52" textAnchor="middle" fontSize="9" fill="var(--color-fg-faint)">git</text>

        <rect x="360" y="14" width="270" height="180" rx="8" fill="none" stroke="var(--color-border)" strokeDasharray="4 3" />
        <text x="370" y="30" fill="var(--color-fg-subtle)" fontSize="11" fontWeight="600">{es ? 'EN VIVO · navegador (TS)' : 'LIVE · browser (TS)'}</text>
        <rect x="372" y="40" width="240" height="26" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="492" y="57" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">{es ? 'motor Whiten + Evertsson + Bond' : 'Whiten + Evertsson + Bond engine'}</text>
        <rect x="372" y="74" width="240" height="26" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="492" y="91" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">onnxruntime-web (surrogate + AE)</text>
        <rect x="372" y="108" width="240" height="26" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="492" y="125" textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">three.js {es ? 'replay de traza DEM' : 'DEM trace replay'}</text>
        <rect x="372" y="142" width="240" height="38" rx="5" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="492" y="165" textAnchor="middle" fontSize="10" fill="var(--color-fg)">{es ? '~12 vistas reactivas (zustand)' : '~12 reactive views (zustand)'}</text>
      </svg>

      <h3>{es ? 'Decisiones clave' : 'Key decisions'}</h3>
      <ul>
        <li>{es ? <><b>TypeScript puro, no Pyodide.</b> El cálculo en vivo es álgebra lineal densa pequeña (un solve de Whiten de ~28×28, sub-milisegundo); un solveLU escrito a mano sobre Float64Array evita un arranque en frío de ~6–10 MB de Pyodide+numpy.</> : <><b>Pure TypeScript, not Pyodide.</b> The live compute is small dense linear algebra (a ~28×28 Whiten solve, sub-millisecond); a hand-written solveLU on Float64Array avoids a ~6–10 MB Pyodide+numpy cold start.</>}</li>
        <li>{es ? <><b>DEM sólo offline.</b> El DEM industrial es ~10⁶ partículas/litro y ~4 h de cómputo por segundo de operación — imposible en el navegador. La vista 3D reproduce una traza pre-horneada y decimada (&lt;1 MB), nunca resuelve.</> : <><b>DEM offline only.</b> Industrial DEM is ~10⁶ particles/litre and ~4 h compute per second of operation — impossible in-browser. The 3D view replays a pre-baked, decimated trace (&lt;1 MB), never solves.</>}</li>
        <li>{es ? <><b>ONNX sólo para lo aprendido.</b> onnxruntime-web (WASM, 1 hilo: Pages no tiene COOP/COEP) corre el surrogate y el autoencoder; el paquete npm y los .wasm se fijan a la misma versión.</> : <><b>ONNX only for the learned models.</b> onnxruntime-web (WASM, 1 thread: Pages has no COOP/COEP) runs the surrogate and the autoencoder; the npm package and the .wasm are pinned to the same version.</>}</li>
        <li>{es ? <><b>Contrato de preprocesamiento congelado.</b> Un <code>scaler.json</code> aplica el z-scoring idéntico en entrenamiento e inferencia, con un test de paridad PyTorch↔onnxruntime-web.</> : <><b>Frozen preprocessing contract.</b> A <code>scaler.json</code> applies identical z-scoring at train and inference time, with a PyTorch↔onnxruntime-web parity test.</>}</li>
      </ul>
      <Refs ids={['quist2016', 'cleary2009', 'tavares2021', 'napiermunn1996']} label="References" />
    </section>
  );
}
