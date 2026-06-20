import { Equation, InlineMath, Refs, SubTabs, useShellLang } from '@fasl-work/caos-app-shell';

// Methodology — the model chain, one sub-tab per stage, with the governing equations. SVG diagrams per sub-tab
// are added in the runtime stage; the equations + derivations are the substance and are complete here.
const sv = { maxWidth: 560, display: 'block', margin: '0.5rem auto', font: '11px var(--font-sans, sans-serif)' } as const;

export default function Methodology() {
  const es = useShellLang() === 'es';
  const tabs = [
    { id: 'chamber', label: es ? 'Cámara y cinemática' : 'Chamber & kinematics', content: <Chamber es={es} /> },
    { id: 'classify', label: es ? 'Clasificación C(d)' : 'Classification C(d)', content: <Classify es={es} /> },
    { id: 'breakage', label: es ? 'Fractura B / t10' : 'Breakage B / t10', content: <Breakage es={es} /> },
    { id: 'whiten', label: es ? 'Balance de Whiten' : 'Whiten balance', content: <Whiten es={es} /> },
    { id: 'capacity', label: es ? 'Capacidad y potencia' : 'Capacity & power', content: <Capacity es={es} /> },
    { id: 'learned', label: es ? 'Tier aprendido' : 'Learned tier', content: <Learned es={es} /> },
  ];
  return (
    <section className="tz-prose" style={{ maxWidth: '100%' }}>
      <h2>{es ? 'Metodología' : 'Methodology'}</h2>
      <p className="tz-lead">{es ? 'La cadena de modelos, citada de extremo a extremo: de la geometría de la cámara al producto, la capacidad y la potencia, y los dos modelos aprendidos.' : 'The model chain, cited end-to-end: from chamber geometry to product, capacity and power, plus the two learned models.'}</p>
      <SubTabs tabs={tabs} ariaLabel="methodology" />
      <Refs ids={['whiten1972', 'narayanan1988', 'andersen1988', 'austin1984', 'evertsson2000', 'bond1952', 'morrell2009', 'quist2016', 'napiermunn1996']} label="References" />
    </section>
  );
}

function Chamber({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'En un chancador de cono/giratorio el manto es un cuerpo de revolución inclinado un ángulo excéntrico γ que NUTA (gira como un péndulo cónico) alrededor de un pivote fijo a velocidad ω — no rota sobre su eje. El eje del manto es n̂(φ)=(sin γ cos φ, sin γ sin φ, cos γ) con φ=ωt. El CSS es la abertura mínima durante un giro, el OSS la máxima, y la carrera (throw) = OSS − CSS.' : 'In a cone/gyratory crusher the mantle is a body of revolution tilted by an eccentric angle γ that NUTATES (gyrates like a conical pendulum) about a fixed pivot at speed ω — it does not spin on its own axis. The mantle axis is n̂(φ)=(sin γ cos φ, sin γ sin φ, cos γ) with φ=ωt. The CSS is the minimum gap over one gyration, the OSS the maximum, and the throw = OSS − CSS.'}</p>
    <Equation tex={String.raw`\hat{n}(\phi)=\big(\sin\gamma\cos\phi,\ \sin\gamma\sin\phi,\ \cos\gamma\big),\qquad \text{CSS}=\min_\phi g(\phi),\quad \text{throw}=\text{OSS}-\text{CSS}`} />
    <svg viewBox="0 0 560 170" width="100%" style={sv} role="img" aria-label="mantle nutation">
      {/* concave walls */}
      <line x1="170" y1="20" x2="250" y2="150" stroke="var(--color-fg-subtle)" strokeWidth="2" />
      <line x1="390" y1="20" x2="310" y2="150" stroke="var(--color-fg-subtle)" strokeWidth="2" />
      {/* mantle closed side (solid) + open side (dashed) */}
      <polygon points="230,30 290,150 270,150 215,40" fill="color-mix(in oklab,#3fb950 30%,transparent)" stroke="#3fb950" strokeWidth="1.5" />
      <polygon points="330,30 270,150 290,150 345,40" fill="none" stroke="#3fb950" strokeWidth="1.2" strokeDasharray="4 3" />
      {/* pivot + nutation */}
      <circle cx="280" cy="22" r="4" fill="var(--color-fg)" />
      <text x="280" y="14" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'pivote fijo' : 'fixed pivot'}</text>
      <path d="M250,150 A30,8 0 0 0 310,150" fill="none" stroke="#f0883e" strokeWidth="1.4" />
      <text x="280" y="166" textAnchor="middle" fill="#f0883e" fontSize="10">{es ? 'el hueco oscila CSS↔OSS por giro' : 'gap oscillates CSS↔OSS per revolution'}</text>
      <text x="430" y="90" fill="var(--color-fg-subtle)" fontSize="10">γ = {es ? 'ángulo excéntrico' : 'eccentric angle'}</text>
    </svg>
    <p>{es ? 'Una partícula es atrapada (nipped) y no escupida hacia arriba sólo si el ángulo de nip no supera el límite de fricción:' : 'A particle is nipped (gripped, not spat upward) only if the nip angle does not exceed the friction limit:'} <InlineMath tex={String.raw`\alpha_{\text{nip}}\le 2\arctan\mu`} />. {es ? 'La mandíbula es un mecanismo de cuatro barras (biela-balancín) cuyos puntos trazan elipses.' : 'The jaw is a crank-rocker four-bar linkage whose points trace ellipses.'}</p>
  </>);
}

function Classify({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'La función de clasificación C(d) es la probabilidad de que una partícula de tamaño d que entra a la cámara sea atrapada y fracturada (en vez de pasar directo). Sigue la forma de Whiten con parámetros K1/K2/K3 (Andersen & Napier-Munn):' : 'The classification function C(d) is the probability that a size-d particle entering the chamber is captured and broken (rather than passing straight through). It follows Whiten’s form with K1/K2/K3 parameters (Andersen & Napier-Munn):'}</p>
    <Equation tex={String.raw`C(d)=\begin{cases}0 & d\le K_1\\[2pt] 1-\left(\dfrac{K_2-d}{K_2-K_1}\right)^{K_3} & K_1<d<K_2\\[6pt] 1 & d\ge K_2\end{cases}`} />
    <svg viewBox="0 0 560 170" width="100%" style={sv} role="img" aria-label="classification function">
      <line x1="50" y1="140" x2="540" y2="140" stroke="var(--color-fg-subtle)" /><line x1="50" y1="20" x2="50" y2="140" stroke="var(--color-fg-subtle)" />
      <text x="535" y="155" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'tamaño d' : 'size d'}</text>
      <text x="42" y="26" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">C=1</text><text x="42" y="140" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">0</text>
      {/* C(d): 0 until K1, S-rise to 1 at K2 */}
      <path d="M50,140 L180,140 C250,140 250,30 360,30 L540,30" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      <line x1="180" y1="140" x2="180" y2="150" stroke="#f0883e" strokeWidth="2" /><text x="180" y="164" textAnchor="middle" fill="#f0883e" fontSize="10">K1</text>
      <line x1="360" y1="30" x2="360" y2="150" stroke="#f0883e" strokeWidth="1" strokeDasharray="3 2" /><text x="360" y="164" textAnchor="middle" fill="#f0883e" fontSize="10">K2</text>
      <text x="110" y="132" fill="var(--color-fg-faint)" fontSize="10">{es ? 'pasa directo' : 'passes through'}</text>
      <text x="420" y="24" fill="var(--color-fg-faint)" fontSize="10">{es ? 'siempre roto' : 'always broken'}</text>
    </svg>
    <p>{es ? <>K1 y K2 son lineales en el CSS (un setting más cerrado atrapa partículas más pequeñas); K3 (~2.3–3.0) es la forma. Las pendientes exactas <InlineMath tex={String.raw`K=a_0+a_1\,\text{CSS}`} /> son específicas de cada máquina y requieren datos industriales — aquí se usan rangos típicos de literatura, rotulados como ilustrativos.</> : <>K1 and K2 are linear in CSS (a tighter setting captures smaller particles); K3 (~2.3–3.0) is the shape. The exact slopes <InlineMath tex={String.raw`K=a_0+a_1\,\text{CSS}`} /> are machine-specific and need industrial data — literature-typical ranges are used here, labelled illustrative.</>}</p>
  </>);
}

function Breakage({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'La energía específica de conminución fija la finura de la progenie vía la curva maestra t10 del JKMRC (Narayanan & Whiten); t10 es el % que pasa 1/10 del tamaño madre:' : 'The specific comminution energy sets progeny fineness via the JKMRC t10 master curve (Narayanan & Whiten); t10 is the % passing 1/10 of the parent size:'}</p>
    <Equation tex={String.raw`t_{10}=A\big(1-e^{-b\,E_{cs}}\big)`} />
    <p>{es ? 'La forma completa de la distribución de progenie usa la función de fractura acumulada de Austin, normalizada para pasar por (u=1/10, t10), con u = x/x_madre:' : 'The full progeny shape uses the Austin cumulative breakage function, normalized to pass through (u=1/10, t10), with u = x/x_parent:'}</p>
    <Equation tex={String.raw`B(u)=\Phi\,u^{\gamma}+(1-\Phi)\,u^{\beta},\qquad \Phi=\frac{t_{10}-0.1^{\beta}}{0.1^{\gamma}-0.1^{\beta}}`} />
    <svg viewBox="0 0 560 160" width="100%" style={sv} role="img" aria-label="t10 energy curve">
      <line x1="50" y1="130" x2="540" y2="130" stroke="var(--color-fg-subtle)" /><line x1="50" y1="20" x2="50" y2="130" stroke="var(--color-fg-subtle)" />
      <text x="535" y="146" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">Ecs (kWh/t)</text>
      <text x="44" y="26" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">t10</text>
      {/* t10 = A(1-e^-b Ecs): saturating rise */}
      <path d="M50,130 C160,70 300,45 540,40" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      <line x1="50" y1="40" x2="540" y2="40" stroke="var(--color-fg-faint)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="56" y="36" fill="var(--color-fg-faint)" fontSize="10">A {es ? '(asíntota)' : '(asymptote)'}</text>
      <text x="300" y="110" fill="var(--color-fg-faint)" fontSize="10">{es ? 'más energía → progenie más fina' : 'more energy → finer progeny'}</text>
    </svg>
    <p>{es ? <>La matriz de fractura B se construye estrictamente triangular inferior (la progenie es estrictamente más fina que la madre), y cada columna se renormaliza a 1 — así la masa se conserva exactamente y <InlineMath tex={String.raw`(I-B\,C)`} /> tiene diagonal unitaria, garantizando que el sistema nunca es singular.</> : <>The breakage matrix B is built strictly lower-triangular (progeny is strictly finer than the parent), and each column renormalizes to 1 — so mass is conserved exactly and <InlineMath tex={String.raw`(I-B\,C)`} /> has a unit diagonal, guaranteeing the system is never singular.</>}</p>
  </>);
}

function Whiten({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'La cámara es una zona de fractura única con clasificación C y fractura B. El balance interno x = f + B·C·x da el producto:' : 'The chamber is a single breakage zone with classification C and breakage B. The internal balance x = f + B·C·x gives the product:'}</p>
    <Equation tex={String.raw`p=(I-C)\,(I-B\,C)^{-1}\,f`} />
    <svg viewBox="0 0 560 90" width="100%" style={sv} role="img" aria-label="whiten dataflow">
      <rect x="8" y="32" width="70" height="28" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="43" y="50" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="11">{es ? 'feed f' : 'feed f'}</text>
      <line x1="78" y1="46" x2="120" y2="46" stroke="var(--color-fg-subtle)" />
      <rect x="120" y="20" width="140" height="52" rx="5" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="190" y="42" textAnchor="middle" fill="var(--color-fg)" fontSize="11">(I − B·C)⁻¹</text><text x="190" y="58" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="9">{es ? 'recirculación interna' : 'internal recycle'}</text>
      <line x1="260" y1="46" x2="300" y2="46" stroke="var(--color-fg-subtle)" />
      <rect x="300" y="20" width="120" height="52" rx="5" fill="var(--color-surface)" stroke="var(--color-accent)" /><text x="360" y="42" textAnchor="middle" fill="var(--color-fg)" fontSize="11">(I − C)</text><text x="360" y="58" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="9">{es ? 'lo no roto sale' : 'unbroken leaves'}</text>
      <line x1="420" y1="46" x2="462" y2="46" stroke="var(--color-fg-subtle)" />
      <rect x="462" y="32" width="86" height="28" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" /><text x="505" y="50" textAnchor="middle" fill="var(--color-fg)" fontSize="11">{es ? 'producto p' : 'product p'}</text>
    </svg>
    <p>{es ? <>Nótese que <InlineMath tex={String.raw`(I-C)`} /> va a la IZQUIERDA del inverso (Whiten 1972; Napier-Munn et al. 1996) — el orden importa porque las matrices no conmutan. No formamos el inverso: resolvemos <InlineMath tex={String.raw`(I-B\,C)\,x=f`} /> por LU sobre Float64Array y aplicamos <InlineMath tex={String.raw`(I-C)`} />. Un guard de condicionamiento marca (no produce NaN) los puntos casi-choke donde C→1.</> : <>Note <InlineMath tex={String.raw`(I-C)`} /> sits on the LEFT of the inverse (Whiten 1972; Napier-Munn et al. 1996) — order matters because matrices don’t commute. We never form the inverse: we LU-solve <InlineMath tex={String.raw`(I-B\,C)\,x=f`} /> on a Float64Array and apply <InlineMath tex={String.raw`(I-C)`} />. A conditioning guard flags (never NaNs) the near-choke points where C→1.</>}</p>
  </>);
}

function Capacity({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'La capacidad es unimodal en la velocidad (modelo de flujo de Evertsson, forma reducida): a baja velocidad la cámara descarga lento; pasado un óptimo, el manto obstruye la caída libre más rápido de lo que la gravedad limpia el material y la capacidad CAE — la joroba de capacidad.' : 'Capacity is unimodal in speed (Evertsson flow model, reduced form): at low speed the chamber discharges slowly; past an optimum the mantle obstructs free-fall faster than gravity clears material and capacity FALLS — the capacity hump.'}</p>
    <Equation tex={String.raw`Q=Q_{\text{ref}}\cdot\frac{\text{CSS}+\text{throw}/2}{g_{\text{ref}}}\cdot s\,e^{1-s},\qquad s=\frac{\omega}{\omega_{\text{opt}}}`} />
    <svg viewBox="0 0 560 150" width="100%" style={sv} role="img" aria-label="capacity hump">
      <line x1="50" y1="120" x2="540" y2="120" stroke="var(--color-fg-subtle)" /><line x1="50" y1="20" x2="50" y2="120" stroke="var(--color-fg-subtle)" />
      <text x="535" y="136" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'velocidad ω' : 'speed ω'}</text>
      <text x="44" y="26" textAnchor="end" fill="var(--color-fg-subtle)" fontSize="10">Q</text>
      {/* unimodal hump s·e^(1-s) */}
      <path d="M50,118 C140,60 230,32 300,32 C380,32 470,70 540,108" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      <line x1="300" y1="32" x2="300" y2="120" stroke="#f0883e" strokeWidth="1" strokeDasharray="3 2" /><circle cx="300" cy="32" r="4" fill="#f0883e" />
      <text x="300" y="134" textAnchor="middle" fill="#f0883e" fontSize="10">ω_opt</text>
      <text x="120" y="60" fill="var(--color-fg-faint)" fontSize="10">{es ? 'sube' : 'rises'}</text>
      <text x="430" y="64" fill="var(--color-fg-faint)" fontSize="10">{es ? 'el manto obstruye → cae' : 'mantle obstructs → falls'}</text>
    </svg>
    <p>{es ? 'La potencia es la ley de Bond (P80, F80 en micrones; W en kWh/t; potencia [kW] = W·Q):' : 'Power is Bond’s law (P80, F80 in microns; W in kWh/t; power [kW] = W·Q):'}</p>
    <Equation tex={String.raw`W=10\,W_i\left(\frac{1}{\sqrt{P_{80}}}-\frac{1}{\sqrt{F_{80}}}\right)`} />
    <p className="tz-note">{es ? 'La energía específica de tamaño de Morrell (Mic) es la alternativa SOTA a Bond; se documenta aquí y puede sustituirse.' : 'Morrell’s size-specific energy (Mic) is the SOTA alternative to Bond; documented here and can be swapped in.'}</p>
  </>);
}

function Learned({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'Dos modelos aprendidos corren en ONNX en el navegador (entrenados offline sobre el motor de balance poblacional). 1) Un surrogate MLP que mapea los parámetros de operación al producto (P80/P50/P20, % pasantes, capacidad, potencia) en un solo paso, para respuestas instantáneas y un what-if diferenciable. Honesto: emula el motor físico barato, no una planta real.' : 'Two learned models run in ONNX in the browser (trained offline on the population-balance engine). 1) A surrogate MLP mapping operating parameters to the product (P80/P50/P20, %-passing, throughput, power) in a single pass, for instant responses and a differentiable what-if. Honest: it emulates the cheap physics engine, not a real plant.'}</p>
    <Equation tex={String.raw`\hat{y}=\mathrm{MLP}_\theta(x),\quad x\in\mathbb{R}^{9}\ \text{(3 one-hot máquina + 6 continuos)},\ \ \hat{y}\in\mathbb{R}^{10}`} />
    <p>{es ? '2) Un autoencoder denoising sobre la firma de gradación del producto; el error de reconstrucción es un score de anomalía de operación que además avisa cuándo una consulta está fuera del manifold de entrenamiento (el surrogate extrapola → desconfiar). El inverso "P80 objetivo → CSS recomendado" no es una red: es bisección sobre el surrogate monótono (consistente y barato).' : '2) A denoising autoencoder over the product-gradation signature; the reconstruction error is an operating-anomaly score that also warns when a query is off the training manifold (the surrogate is extrapolating → distrust it). The inverse "target P80 → recommended CSS" is not a net: it is bisection on the monotone surrogate (consistent and cheap).'}</p>
    <svg viewBox="0 0 560 90" width="100%" style={sv} role="img" aria-label="learned tier dataflow">
      <rect x="10" y="30" width="120" height="30" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" />
      <text x="70" y="49" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'parámetros' : 'parameters'}</text>
      <line x1="130" y1="45" x2="200" y2="45" stroke="var(--color-fg-subtle)" />
      <rect x="200" y="30" width="120" height="30" rx="5" fill="var(--color-surface)" stroke="var(--color-accent)" />
      <text x="260" y="49" textAnchor="middle" fill="var(--color-fg)" fontSize="10">surrogate MLP</text>
      <line x1="320" y1="45" x2="390" y2="45" stroke="var(--color-fg-subtle)" />
      <rect x="390" y="30" width="160" height="30" rx="5" fill="var(--color-surface)" stroke="var(--color-border)" />
      <text x="470" y="49" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">P80 · t/h · kW {es ? '(instantáneo)' : '(instant)'}</text>
    </svg>
  </>);
}
