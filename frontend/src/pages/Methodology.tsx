import { Cite, Equation, InlineMath, Refs, SubTabs, useShellLang } from '@fasl-work/caos-app-shell';

// Methodology, the model chain, one sub-tab per stage, with the governing equations. SVG diagrams per sub-tab
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
    { id: 'dem', label: es ? 'DEM / SOTA' : 'DEM / SOTA', content: <DemSota es={es} /> },
    { id: 'calib', label: es ? 'Calibración y UQ' : 'Calibration & UQ', content: <CalibUq es={es} /> },
    { id: 'learned', label: es ? 'Tier aprendido' : 'Learned tier', content: <Learned es={es} /> },
  ];
  return (
    <section className="page-body prose">
      <h2>{es ? 'Metodología' : 'Methodology'}</h2>
      <p className="tz-lead">{es ? 'La cadena de modelos, citada de extremo a extremo: de la geometría de la cámara al producto, la capacidad y la potencia; el frente DEM/SOTA que no somos; la calibración a datos reales con validación held-out (LOO) e incertidumbre; y los dos modelos aprendidos.' : 'The model chain, cited end-to-end: from chamber geometry to product, capacity and power; the DEM/SOTA frontier we are not; the calibration to real data with held-out (LOO) validation and uncertainty; and the two learned models.'}</p>
      <SubTabs tabs={tabs} ariaLabel="methodology" />
      <Refs ids={['whiten1972', 'narayanan1988', 'andersen1988', 'austin1984', 'evertsson2000', 'evertsson1999', 'evertsson1997', 'bond1952', 'morrell2009', 'quist2016', 'delaney2015', 'johansson2017val', 'koh2021', 'rocha2024', 'duarte2021', 'napiermunn1996']} label="References" />
    </section>
  );
}

function DemSota({ es }: { es: boolean }) {
  return (<>
    <p>{es ? <>El frente de vanguardia para el mecanismo de un chancador de cono es el DEM (método de elementos discretos): partículas que fluyen y se fracturan resueltas por contacto. Dos familias: reemplazo de partículas (PRM, Cleary y Sinnott <Cite id="cleary2015" paren />; Delaney et al. <Cite id="delaney2015" paren />, super-cuádricas que se rompen en progenie dimensionada por el t10 del JKMRC) y roca de partículas ligadas (Quist y Evertsson <Cite id="quist2016" paren />), validadas contra laboratorio (Johansson et al. <Cite id="johansson2017val" paren />). El frente para la predicción rápida es un surrogate DNN de un modelo fenomenológico (Koh et al. <Cite id="koh2021" paren />).</> : <>The frontier for a cone crusher's mechanism is DEM (the discrete element method): flowing, breaking particles resolved by contact. Two families: particle replacement (PRM, Cleary and Sinnott <Cite id="cleary2015" paren />; Delaney et al. <Cite id="delaney2015" paren />, super-quadrics breaking into progeny sized by the JKMRC t10) and bonded-particle rock (Quist and Evertsson <Cite id="quist2016" paren />), validated against lab data (Johansson et al. <Cite id="johansson2017val" paren />). The frontier for fast prediction is a DNN surrogate of a phenomenological model (Koh et al. <Cite id="koh2021" paren />).</>}</p>
    <div className="tz-note">{es ? <><b>ChancaDEM no es un solver DEM.</b> Ejecuta un modelo de balance poblacional (PBM) / empírico (Whiten + Evertsson + Bond) en TypeScript puro, en vivo en el navegador. El DEM es el frente de referencia que citamos y contra el que nos posicionamos, no lo que se ejecuta en el navegador (un paso DEM industrial toma horas de GPU). Ese es exactamente el hueco que ocupamos: una recalibración validada held-out, con incertidumbre, sobre datos abiertos, entregada en vivo.</> : <><b>ChancaDEM is not a DEM solver.</b> It runs a population-balance (PBM) / empirical model (Whiten + Evertsson + Bond) in pure TypeScript, live in the browser. DEM is the reference frontier we cite and position against, not what runs in the browser (an industrial DEM step is GPU-hours). That gap is exactly what we occupy: a held-out-validated, uncertainty-aware recalibration on open data, delivered live.</>}</div>
    <svg viewBox="0 0 560 190" width="100%" style={sv} role="img" aria-label="PBM vs DEM positioning">
      <rect x="20" y="30" width="240" height="130" rx="8" fill="color-mix(in oklab,#3fb950 10%,transparent)" stroke="#3fb950" strokeWidth="1.2" />
      <rect x="300" y="30" width="240" height="130" rx="8" fill="color-mix(in oklab,#58a6ff 8%,transparent)" stroke="var(--color-fg-subtle)" strokeWidth="1.2" strokeDasharray="4 3" />
      <text x="140" y="52" textAnchor="middle" fill="#3fb950" fontSize="12" fontWeight="700">ChancaDEM (PBM)</text>
      <text x="420" y="52" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="12" fontWeight="700">DEM (SOTA frontier)</text>
      <text x="140" y="78" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">Whiten C + B, Evertsson Q</text>
      <text x="140" y="96" textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'sub-ms, en vivo (navegador)' : 'sub-ms, live (browser)'}</text>
      <text x="140" y="120" textAnchor="middle" fill="#3fb950" fontSize="10">{es ? 'LOO + UQ, datos abiertos' : 'LOO + UQ, open data'}</text>
      <text x="140" y="138" textAnchor="middle" fill="#3fb950" fontSize="10">{es ? 'entregado en vivo' : 'delivered live'}</text>
      <text x="420" y="78" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="10">PRM / bonded-particle</text>
      <text x="420" y="96" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="10">{es ? 'horas de GPU, offline' : 'GPU-hours, offline'}</text>
      <text x="420" y="120" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="10">{es ? 'ajuste en-muestra, sin UQ' : 'in-sample fit, no UQ'}</text>
      <text x="420" y="138" textAnchor="middle" fill="var(--color-fg-faint)" fontSize="10">{es ? 'progenie DWT (t10) ← puente' : 'DWT (t10) progeny ← bridge'}</text>
    </svg>
    <p>{es ? 'El puente entre ambos: el DEM SOTA dimensiona la progenie de fractura con la misma familia de aparición t10-tn del JKMRC que usa nuestro PBM (Delaney et al.), así que las tendencias de fractura son comparables aunque el mecanismo se resuelva distinto.' : 'The bridge between them: the SOTA DEM sizes breakage progeny with the same JKMRC t10-tn appearance family our PBM uses (Delaney et al.), so breakage trends are comparable even though the mechanism is resolved differently.'}</p>
  </>);
}

function CalibUq({ es }: { es: boolean }) {
  return (<>
    <p>{es ? <>El motor está calibrado a 10 encuestas industriales reales de un cono secundario Metso HP500 (mina Minas Rio, itabirita) mediante el ajuste Andersen-Whiten publicado (Rocha et al. <Cite id="rocha2024" paren />, Tabla 5), lineal en CSS y f80:</> : <>The engine is calibrated to 10 real industrial surveys of a Metso HP500 secondary cone (Minas Rio, itabirite iron ore) via the published Andersen-Whiten fit (Rocha et al. <Cite id="rocha2024" paren />, Table 5), linear in CSS and f80:</>}</p>
    <Equation tex={String.raw`K_1=0.23\,\text{CSS}+0.30\,f_{80},\quad K_2=12+0.55\,\text{CSS}+0.40\,f_{80},\quad K_3=2.3,\quad t_{10}[\%]=64-0.12\,\text{CSS}-0.23\,f_{80}`} />
    <p>{es ? 'La potencia del paper tiene la forma lineal Pc = ζ·Pd + Pn con ζ=1.30 y Pn=110 kW (sin carga), donde Pd es una potencia neta específica de tamaño del propio modelo del paper:' : "The paper's power has the linear form Pc = ζ·Pd + Pn with ζ=1.30 and Pn=110 kW (no-load), where Pd is a size-specific net power from the paper's own model:"}</p>
    <Equation tex={String.raw`P_c=\zeta\,P_d+P_n,\qquad \zeta=1.30,\quad P_n=110\ \text{kW}`} />
    <div className="tz-note">{es ? <><b>Hallazgo honesto sobre la potencia.</b> El tiro de Bond que calcula nuestro motor no es el Pd del paper (es el draw clásico de Bond, casi plano en estas encuestas), así que aplicar ζ=1.30, Pn=110 sobre nuestro Pd sobreestima. La premisa de "eliminar una sobrepredicción 2x de Bond" no se sostiene con los números del motor: se reporta como corrección en Benchmark. La potencia medida es la referencia que muestra la app. El resultado real at-bar es la paridad de t/h, no la potencia.</> : <><b>Honest finding on power.</b> The Bond draw our engine computes is not the paper's Pd (it is the classical Bond draw, nearly flat over these surveys), so applying ζ=1.30, Pn=110 on our Pd overshoots. The "removes a Bond 2x overprediction" premise does not hold against the engine's numbers: it is reported as a correction in Benchmark. The measured power is the reference the app shows. The real at-bar result is the t/h parity, not the power.</>}</div>
    <p>{es ? 'La validación es leave-one-survey-out (LOO): para cada encuesta i se predice con las otras 9 (escalares del backbone reajustados por fold), y se comparan tres modelos en los mismos folds:' : 'Validation is leave-one-survey-out (LOO): for each survey i predict from the other 9 (backbone scalars refit per fold), comparing three models on identical folds:'}</p>
    <Equation tex={String.raw`\hat{y}^{(-i)}_{\,M0}=\text{backbone},\quad \hat{y}^{(-i)}_{\,M1}=\text{backbone}+\underbrace{\text{clip}\big(g_\theta(\text{CSS},f_{80})\big)}_{|\Delta|\le 0.20\,\text{backbone}},\quad \hat{y}^{(-i)}_{\,M2}=\text{OLS libre}`} />
    <svg viewBox="0 0 560 150" width="100%" style={sv} role="img" aria-label="leave-one-out folds">
      {Array.from({ length: 10 }).map((_, i) => (
        <g key={i}>
          <rect x={20 + i * 52} y={40} width={44} height={22} rx={4}
            fill={i === 3 ? 'color-mix(in oklab,#f0883e 30%,transparent)' : 'color-mix(in oklab,#3fb950 22%,transparent)'}
            stroke={i === 3 ? '#f0883e' : '#3fb950'} strokeWidth="1.1" />
          <text x={42 + i * 52} y={55} textAnchor="middle" fill="var(--color-fg-subtle)" fontSize="9">#{i + 1}</text>
        </g>
      ))}
      <text x="20" y="30" fill="var(--color-fg-subtle)" fontSize="10">{es ? 'fold: se deja fuera #4 (naranja), se entrena con las 9 verdes, se predice #4' : 'fold: hold out #4 (orange), train on the 9 green, predict #4'}</text>
      <text x="20" y="95" fill="#3fb950" fontSize="10">{es ? 'entrenamiento (9)' : 'train (9)'}</text>
      <text x="200" y="95" fill="#f0883e" fontSize="10">{es ? 'validación held-out (1)' : 'held-out validation (1)'}</text>
      <text x="20" y="120" fill="var(--color-fg-faint)" fontSize="10">{es ? 'controles: media constante · etiqueta-barajada · fold con fuga vs estricto' : 'controls: constant-mean · label-shuffle · leaky vs strict fold'}</text>
      <text x="20" y="138" fill="var(--color-fg-faint)" fontSize="10">{es ? 'UQ: intervalo predictivo 80% = M0 ± 1.28·σ(residuo held-out); se chequea la cobertura' : 'UQ: 80% predictive interval = M0 ± 1.28·σ(held-out residual); coverage is checked'}</text>
    </svg>
    <p>{es ? <>Resultado (ver Benchmark): en t/h el backbone calibrado alcanza ~12% MAPE held-out (dentro de la banda ~15% del paper), supera a la media constante y pasa la etiqueta-barajada; el residuo M1 no lo supera fuera de muestra (nulo pre-registrado), así que se envía el backbone + banda empírica. La novedad es metodológica (LOO + UQ + datos abiertos + navegador en vivo), no un error menor que el DEM/paper. Segundo ancla de cono: Duarte et al. <Cite id="duarte2021" paren />.</> : <>Result (see Benchmark): for t/h the calibrated backbone reaches ~12% held-out MAPE (inside the paper's ~15% band), beats the constant-mean baseline and passes label-shuffle; the M1 residual does not beat it out-of-sample (a pre-registered null), so the backbone + empirical band is shipped. The novelty is methodological (LOO + UQ + open data + live browser), not a lower error than the DEM/paper. Second cone anchor: Duarte et al. <Cite id="duarte2021" paren />.</>}</p>
  </>);
}

function Chamber({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'En un chancador de cono/giratorio el manto es un cuerpo de revolución inclinado un ángulo excéntrico γ que nuta (gira como un péndulo cónico) alrededor de un pivote fijo a velocidad ω, no rota sobre su eje. El eje del manto es n̂(φ)=(sin γ cos φ, sin γ sin φ, cos γ) con φ=ωt. El CSS es la abertura mínima durante un giro, el OSS la máxima, y la carrera (throw) = OSS − CSS.' : 'In a cone/gyratory crusher the mantle is a body of revolution tilted by an eccentric angle γ that nutates (gyrates like a conical pendulum) about a fixed pivot at speed ω, it does not spin on its own axis. The mantle axis is n̂(φ)=(sin γ cos φ, sin γ sin φ, cos γ) with φ=ωt. The CSS is the minimum gap over one gyration, the OSS the maximum, and the throw = OSS − CSS.'}</p>
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
    <p>{es ? <>K1 es lineal en el CSS (el hueco cerrado: un setting más cerrado atrapa partículas más pequeñas). K2 es el umbral de captura del lado abierto, así que sigue al <InlineMath tex={String.raw`\text{OSS}=\text{CSS}+\text{carrera}`} />: una carrera mayor abre más la cámara y deja escapar partículas más grandes en la fase abierta, produciendo un producto más grueso a igual CSS (Evertsson <Cite id="evertsson1999" paren />; Andersen y Napier-Munn <Cite id="andersen1988" paren />). K3 (~2.3–3.0) es la forma. Las pendientes exactas <InlineMath tex={String.raw`K=a_0+a_1\,\text{CSS}`} /> son específicas de cada máquina y requieren datos industriales, aquí se usan rangos típicos de literatura, rotulados como ilustrativos.</> : <>K1 is linear in CSS (the closed-side gap: a tighter setting captures smaller particles). K2 is the open-side capture threshold, so it tracks <InlineMath tex={String.raw`\text{OSS}=\text{CSS}+\text{throw}`} />: a larger throw opens the chamber wider and lets larger particles escape in the open phase, yielding a coarser product at fixed CSS (Evertsson <Cite id="evertsson1999" paren />; Andersen and Napier-Munn <Cite id="andersen1988" paren />). K3 (~2.3–3.0) is the shape. The exact slopes <InlineMath tex={String.raw`K=a_0+a_1\,\text{CSS}`} /> are machine-specific and need industrial data, literature-typical ranges are used here, labelled illustrative.</>}</p>
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
    <p>{es ? <>La matriz de fractura B se construye estrictamente triangular inferior (la progenie es estrictamente más fina que la madre), y cada columna se renormaliza a 1, así la masa se conserva exactamente y <InlineMath tex={String.raw`(I-B\,C)`} /> tiene diagonal unitaria, garantizando que el sistema nunca es singular.</> : <>The breakage matrix B is built strictly lower-triangular (progeny is strictly finer than the parent), and each column renormalizes to 1, so mass is conserved exactly and <InlineMath tex={String.raw`(I-B\,C)`} /> has a unit diagonal, guaranteeing the system is never singular.</>}</p>
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
    <p>{es ? <>Nótese que <InlineMath tex={String.raw`(I-C)`} /> va a la izquierda del inverso (Whiten 1972; Napier-Munn et al. 1996), el orden importa porque las matrices no conmutan. No formamos el inverso: resolvemos <InlineMath tex={String.raw`(I-B\,C)\,x=f`} /> por LU sobre Float64Array y aplicamos <InlineMath tex={String.raw`(I-C)`} />. Un guard de condicionamiento marca (no produce NaN) los puntos casi-choke donde C→1.</> : <>Note <InlineMath tex={String.raw`(I-C)`} /> sits on the left of the inverse (Whiten 1972; Napier-Munn et al. 1996), order matters because matrices don’t commute. We never form the inverse: we LU-solve <InlineMath tex={String.raw`(I-B\,C)\,x=f`} /> on a Float64Array and apply <InlineMath tex={String.raw`(I-C)`} />. A conditioning guard flags (never NaNs) the near-choke points where C→1.</>}</p>
  </>);
}

function Capacity({ es }: { es: boolean }) {
  return (<>
    <p>{es ? 'La capacidad es unimodal en la velocidad (modelo de flujo de Evertsson, forma reducida): a baja velocidad la cámara descarga lento; pasado un óptimo, el manto obstruye la caída libre más rápido de lo que la gravedad limpia el material y la capacidad cae, la joroba de capacidad.' : 'Capacity is unimodal in speed (Evertsson flow model, reduced form): at low speed the chamber discharges slowly; past an optimum the mantle obstructs free-fall faster than gravity clears material and capacity falls, the capacity hump.'}</p>
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
    <p>{es ? 'Dos modelos aprendidos se ejecutan en ONNX en el navegador (entrenados offline sobre el motor de balance poblacional). 1) Un surrogate MLP que mapea los parámetros de operación al producto (P80/P50/P20, % pasantes, capacidad, potencia) en un solo paso, para respuestas instantáneas y un what-if diferenciable. Honesto: emula el motor físico barato, no una planta real.' : 'Two learned models run in ONNX in the browser (trained offline on the population-balance engine). 1) A surrogate MLP mapping operating parameters to the product (P80/P50/P20, %-passing, throughput, power) in a single pass, for instant responses and a differentiable what-if. Honest: it emulates the cheap physics engine, not a real plant.'}</p>
    <Equation tex={es
      ? String.raw`\hat{y}=\mathrm{MLP}_\theta(x),\quad x\in\mathbb{R}^{11}\ \text{(5 one-hot máquina + 6 continuos)},\ \ \hat{y}\in\mathbb{R}^{10}`
      : String.raw`\hat{y}=\mathrm{MLP}_\theta(x),\quad x\in\mathbb{R}^{11}\ \text{(5 one-hot machine + 6 continuous)},\ \ \hat{y}\in\mathbb{R}^{10}`} />
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
