// A topic of the Methodology: the discrete element method with particle-replacement breakage, run by the published package crushdem on
// the laboratory jaw crusher of Barrios et al., and its comparison with the measurement and with the population balance (catalog row
// dem-run). The equations and the constants of the methods are written here (they are the methods); every number of the case and of the
// result, the machine, the settings, the ore, the bands, the measured, simulated and predicted values and the verdicts, is read from the
// committed document dem/jaw-lab.json when the topic opens, never typed. The numbers are held to the document by demdata.test.ts.
import { BarChart, Callout, Cite, DocSection, Equation, Figure, useFormat, useShellLang } from '@fasl-work/caos-app-shell';
import type { Tone } from '@fasl-work/caos-app-shell';
import { loadDemRun, loadIndex, useArtifact } from '../../api/artifacts';
import type { DemRun } from '../../lib/contract.types';
import { ReadinessNote } from '../../readiness/ReadinessNote';
import { Ready, TableWrap } from '../benchmark/shared';
import { P, L, useT } from '../bi';
import { BASIS_TEXT, QUANTITIES, completingLimit, energyShareOfMeasured, errorBars, incompletePoints, injectedShare, throughputRatio, verdictCounts, windowOverlapShare, type DemPoint, type DemQuantity } from './demdata';

const QUANTITY_LABEL: Record<DemQuantity, { en: string; es: string }> = {
  throughput: { en: 'Throughput', es: 'Capacidad' },
  net_power: { en: 'Net power', es: 'Potencia neta' },
  reduction_ratio: { en: 'Reduction ratio', es: 'Razón de reducción' },
};
const QUANTITY_UNIT: Record<DemQuantity, string> = { throughput: 'kg/h', net_power: 'kW', reduction_ratio: '' };
const QUANTITY_DECIMALS: Record<DemQuantity, number> = { throughput: 0, net_power: 3, reduction_ratio: 2 };
const VERDICT_LABEL = {
  met: { en: 'met', es: 'cumple' },
  'not met': { en: 'not met', es: 'no cumple' },
  'not compared': { en: 'not compared', es: 'no comparado' },
} as const;
const VERDICT_TONE: Record<string, Tone | undefined> = { met: 'good', 'not met': 'bad' };

/** The route of the particle tab of the Validation group, with the base path of the build. */
export const PARTICLES_ROUTE = `${import.meta.env.BASE_URL}app?view=validation&sub=particles`;

export function ParticleJaw() {
  const t = useT();
  const doc = useArtifact(async (s) => loadDemRun(await loadIndex(s), s), []);
  return (
    <DocSection
      title={{ en: 'Particle simulation on the laboratory jaw', es: 'Simulación de partículas en la mandíbula de laboratorio' }}
      area="method"
      kind="classical"
      refs={['barrios2020', 'crushdem', 'cundall1979', 'tsuji1992', 'mindlin1949', 'tavares2021', 'cleary2015', 'delaney2015', 'quist2016', 'napiermunn1996', 'sastri1994', 'donovan2003', 'king2000', 'johansson2017val']}
    >
      <P
        en={<>The discrete element method is no longer a frontier this product only cites: it is a method the product runs, offline, and compares. The particles are simulated by the published package crushdem <Cite id="crushdem" />, a soft-sphere engine in the family that starts with Cundall and Strack <Cite id="cundall1979" />, on the laboratory jaw crusher of Barrios et al. <Cite id="barrios2020" />, an open-access machine for which the paper reports the throughput, the net power and the product size distribution of three narrow feed classes. Breakage is by particle replacement, the family of Cleary and Sinnott <Cite id="cleary2015" />: a sphere that meets its breakage criterion is removed and replaced by smaller spheres. The criterion and the progeny come from the single-particle breakage model of Tavares <Cite id="tavares2021" />, whose progeny law is the same t10 family that sizes the progeny of the population balance of the engine <Cite id="napiermunn1996" />, which makes the two descriptions comparable on one ore.</>}
        es={<>El método de elementos discretos ya no es una frontera que este producto solo cita: es un método que el producto corre, fuera de línea, y compara. Las partículas las simula el paquete publicado crushdem <Cite id="crushdem" />, un motor de esferas blandas de la familia que comienza con Cundall y Strack <Cite id="cundall1979" />, en la mandíbula de laboratorio de Barrios et al. <Cite id="barrios2020" />, una máquina de acceso abierto para la cual el artículo informa la capacidad, la potencia neta y la distribución de tamaños del producto de tres clases estrechas de alimento. La fractura es por reemplazo de partículas, la familia de Cleary y Sinnott <Cite id="cleary2015" />: una esfera que cumple su criterio de fractura se retira y se reemplaza por esferas menores. El criterio y la progenie salen del modelo de fractura de partícula individual de Tavares <Cite id="tavares2021" />, cuya ley de progenie es la misma familia t10 que dimensiona la progenie del balance poblacional del motor <Cite id="napiermunn1996" />, lo que hace comparables las dos descripciones sobre un mismo mineral.</>}
      />
      <Ready a={doc} wait={{ en: 'Loading the particle-simulation document', es: 'Cargando el documento de la simulación de partículas' }}>
        {(d) => <Setup d={d} />}
      </Ready>
      <P
        en={<>The contact between two spheres is a Hertz normal spring with the restitution damping fitted by Tsuji, Tanaka and Ishida <Cite id="tsuji1992" />, and a tangential spring that keeps its history, after Mindlin <Cite id="mindlin1949" />, capped by Coulomb sliding. The effective quantities are the usual ones: E* and G* the effective Young and shear moduli of the pair, R* the effective radius, m* the effective mass, delta the overlap, v_n and v_t the normal and tangential relative velocities of the contact points. The normal force is not clamped at zero, as in the published model, so that the measured restitution matches the target.</>}
        es={<>El contacto entre dos esferas es un resorte normal de Hertz con el amortiguamiento de restitución ajustado por Tsuji, Tanaka e Ishida <Cite id="tsuji1992" />, y un resorte tangencial que guarda su historia, según Mindlin <Cite id="mindlin1949" />, limitado por el deslizamiento de Coulomb. Las cantidades efectivas son las usuales: E* y G* los módulos efectivos de Young y de corte del par, R* el radio efectivo, m* la masa efectiva, delta el solape, v_n y v_t las velocidades relativas normal y tangencial de los puntos de contacto. La fuerza normal no se trunca en cero, como en el modelo publicado, para que la restitución medida coincida con la objetivo.</>}
      />
      <Equation
        tex={String.raw`F_n = \tfrac{4}{3}\,E^{*}\sqrt{R^{*}}\;\delta^{3/2} + \eta_n v_n,\quad \eta_n = \alpha(e)\sqrt{m^{*}\,k_{nd}},\quad k_{nd} = \tfrac{4}{3}\,E^{*}\sqrt{R^{*}\delta}; \qquad k_t = 8\,G^{*}\sqrt{R^{*}\delta},\quad \mathbf F_t = -k_t\boldsymbol\xi - \eta_t \mathbf v_t,\quad |\mathbf F_t| \le \mu\,\max(F_n, 0)`}
        caption={t(
          'The contact law: the Hertz normal force with the Tsuji damping eta_n, where alpha(e) is the polynomial fit of the coefficient of restitution e, and the Mindlin tangential force with its history xi, damped by eta_t, capped by the Coulomb friction mu times the compressive normal force. A rolling-resistance torque opposes the relative spin. Units: m, kg, s, N, Pa.',
          'La ley de contacto: la fuerza normal de Hertz con el amortiguamiento de Tsuji eta_n, donde alpha(e) es el ajuste polinomial del coeficiente de restitución e, y la fuerza tangencial de Mindlin con su historia xi, amortiguada por eta_t, limitada por la fricción de Coulomb mu por la fuerza normal de compresión. Un par de resistencia a la rodadura se opone al giro relativo. Unidades: m, kg, s, N, Pa.',
        )}
      />
      <P
        en={<>Breakage follows the single-particle model of Tavares <Cite id="tavares2021" />. The specific fracture energy E of a particle of size d, in J/kg, is distributed as an upper-truncated lognormal with median E50(d), which falls with the size through the parameters E_inf, d0 and phi. Each sphere draws one uniform number when it appears, which fixes its fracture energy. In a bed the loading event of a sphere is the compressive work of its contacts, summed while it keeps loading, divided by its mass. A sphere that is loaded below its fracture energy is damaged, its energy falling to E(1 - D) with D from an implicit equation that has one coefficient, gamma, and a sphere that reaches it breaks.</>}
        es={<>La fractura sigue el modelo de partícula individual de Tavares <Cite id="tavares2021" />. La energía específica de fractura E de una partícula de tamaño d, en J/kg, se distribuye como una lognormal truncada por arriba con mediana E50(d), que baja con el tamaño mediante los parámetros E_inf, d0 y phi. Cada esfera sortea un número uniforme al aparecer, que fija su energía de fractura. En un lecho el evento de carga de una esfera es el trabajo de compresión de sus contactos, sumado mientras sigue cargándose, dividido por su masa. Una esfera cargada bajo su energía de fractura se daña, y su energía baja a E(1 - D) con D de una ecuación implícita que tiene un coeficiente, gamma, y una esfera que la alcanza se rompe.</>}
      />
      <Equation
        tex={String.raw`P(E) = \tfrac12\!\left[1 + \operatorname{erf}\!\frac{\ln E^{*} - \ln E_{50}}{\sqrt{2\sigma^{2}}}\right],\ \ E^{*} = \frac{E_{\max}E}{E_{\max} - E},\qquad E_{50}(d) = E_\infty\!\left[1 + \left(\frac{d_0}{d}\right)^{\varphi}\right],\qquad E_{\mathrm{event}} = \frac{1}{m}\sum_{\text{contacts}}\int e\,F_n\,v_n\,dt`}
        caption={t(
          'The single-particle model: P(E) is the probability that a particle breaks at the specific energy E (J/kg), sigma^2 the variance of the logarithm of the fracture energy and E_max its truncation (infinite for the plain lognormal); E50(d) is the median at size d (m); E_event is the specific energy of one loading event of a sphere of mass m, with e = k_j/(k_i + k_j) the share of the work that goes to the sphere, k = Y/(1 - nu^2), over the contacts that compress it (v_n > 0).',
          'El modelo de partícula individual: P(E) es la probabilidad de que una partícula se rompa con la energía específica E (J/kg), sigma^2 la varianza del logaritmo de la energía de fractura y E_max su truncamiento (infinito para la lognormal simple); E50(d) es la mediana al tamaño d (m); E_event es la energía específica de un evento de carga de una esfera de masa m, con e = k_j/(k_i + k_j) la parte del trabajo que recibe la esfera, k = Y/(1 - nu^2), sobre los contactos que la comprimen (v_n > 0).',
        )}
      />
      <P
        en={<>When a sphere breaks it is replaced. The progeny are sized by the t10 family: t10 follows the exponential law of the fragment model, in percent, and the other points of the cumulative curve, t_n, the mass passing 1/n of the parent size, follow from t10 through the regularised incomplete beta function with the tabulated exponents of Tavares <Cite id="tavares2021" />. The parent is removed and its progeny are written into free slots with its velocity and spin, so momentum is conserved and the kinetic energy can only fall. The mass below the smallest sphere that the run keeps is not a particle: it leaves as fines and is counted in the finest class of the product. The mass balance closes to round-off, and the Hertz energy that the placement of the progeny leaves in their overlaps, the energy the replacement injects, is bounded to a fraction of the energy the parent absorbed.</>}
        es={<>Cuando una esfera se rompe se reemplaza. La progenie se dimensiona con la familia t10: t10 sigue la ley exponencial del modelo de fragmentos, en porcentaje, y los demás puntos de la curva acumulada, t_n, la masa que pasa 1/n del tamaño del padre, salen de t10 mediante la función beta incompleta regularizada con los exponentes tabulados por Tavares <Cite id="tavares2021" />. El padre se retira y su progenie se escribe en espacios libres con su velocidad y su giro, de modo que se conserva el momento y la energía cinética solo puede bajar. La masa bajo la esfera más pequeña que la corrida conserva no es una partícula: sale como finos y se cuenta en la clase más fina del producto. El balance de masa cierra hasta el error de redondeo, y la energía de Hertz que la colocación de la progenie deja en sus solapes, la energía que inyecta el reemplazo, está acotada a una fracción de la energía que absorbió el padre.</>}
      />
      <Equation
        tex={String.raw`t_{10} = A\left[1 - \exp\!\left(-\,b'\,\frac{e\,E_k}{E_{50b}}\right)\right],\qquad t_n = 100\; I_{t_{10}/100}\!\left(\alpha_n,\ \beta_n\right),\qquad m_{\text{parent}} = \sum_k m_{\text{progeny},k} + m_{\text{fines}}`}
        caption={t(
          'The progeny law and the replacement: t10 in percent from the maximum A of one event, the dimensionless b-prime and the specific energy E_k available in the event, over the median fracture energy E_50b of the particles that broke (taken as E50 of the parent); t_n from the regularised incomplete beta function I with the exponents alpha_n and beta_n of Tavares; the replacement conserves the mass of the parent.',
          'La ley de progenie y el reemplazo: t10 en porcentaje a partir del máximo A de un evento, el b-prima sin dimensión y la energía específica E_k disponible en el evento, sobre la energía de fractura mediana E_50b de las partículas que se rompieron (tomada como E50 del padre); t_n a partir de la función beta incompleta regularizada I con los exponentes alpha_n y beta_n de Tavares; el reemplazo conserva la masa del padre.',
        )}
      />
      <Ready a={doc} wait={{ en: 'Loading the ore of the particle simulation', es: 'Cargando el mineral de la simulación de partículas' }}>
        {(d) => <OreAndProtocol d={d} />}
      </Ready>
      <P
        en={<>The population balance predicts the same three points with the engine of the product and a laboratory preset, with no parameter fitted to the throughput, the power or the product of this jaw. The throughput is the jaw capacity model of Sastri <Cite id="sastri1994" />, a closed form in the geometry, the speed, the size of the feed and the density, written below with the paper&apos;s equation numbers. The product is the engine&apos;s own: the classification, with the Whiten solve, applied to a narrow feed class, and the breakage matrix from the t10 law. The classification parameters are a first estimate of the literature, K1 equal to the closed side, K2 equal to the open side and K3 about 2.3 (section 2.1.3 of Donovan <Cite id="donovan2003" />). The only published ranges are those King gives for Symons cone crushers <Cite id="king2000" />, used here for a laboratory jaw for want of published jaw values: the eight corners of the intervals of the three parameters form a band around the first estimate, a sensitivity to cone-crusher ranges and never the published uncertainty of a jaw.</>}
        es={<>El balance poblacional predice los mismos tres puntos con el motor del producto y una configuración de laboratorio, sin ningún parámetro ajustado a la capacidad, la potencia ni el producto de esta mandíbula. La capacidad es el modelo de capacidad de mandíbulas de Sastri <Cite id="sastri1994" />, una forma cerrada en la geometría, la velocidad, el tamaño del alimento y la densidad, escrita abajo con los números de ecuación del artículo. El producto es el propio del motor: la clasificación, con la solución de Whiten, aplicada a una clase estrecha de alimento, y la matriz de fractura desde la ley t10. Los parámetros de clasificación son una primera estimación de la literatura, K1 igual al lado cerrado, K2 igual al lado abierto y K3 cerca de 2,3 (sección 2.1.3 de Donovan <Cite id="donovan2003" />). Los únicos rangos publicados son los que King da para chancadores de cono Symons <Cite id="king2000" />, usados aquí para una mandíbula de laboratorio a falta de valores publicados para mandíbulas: las ocho esquinas de los intervalos de los tres parámetros forman una banda alrededor de la primera estimación, una sensibilidad a rangos de chancadores de cono y nunca la incertidumbre publicada de una mandíbula.</>}
      />
      <Equation
        tex={String.raw`a = \frac{D\,T}{G - (S+T)}\ \ (N < N_c),\quad V_h = 60\,N\,w\left(S + \tfrac{T}{2}\right)a,\quad N_c = 66.4\left[\frac{G - (S+T)}{D\,T}\right]^{1/2},\quad W = V_h\,K_1 K_2 K_3\,d`}
        caption={t(
          'The jaw capacity model of Sastri (equations 2, 5, 8 and 9 of the paper): G the gape, w the width, S the closed-side setting, T the throw, D the depth between the jaws, all in metres; N the speed in strokes per minute and N_c the critical speed below which the capacity rises with the speed; V_h the volumetric capacity in m3/h; d the true density in t/m3; W the capacity in t/h.',
          'El modelo de capacidad de mandíbulas de Sastri (ecuaciones 2, 5, 8 y 9 del artículo): G la abertura de entrada, w el ancho, S el lado cerrado, T la carrera, D la profundidad entre las mandíbulas, todo en metros; N la velocidad en golpes por minuto y N_c la velocidad crítica bajo la cual la capacidad sube con la velocidad; V_h la capacidad volumétrica en m3/h; d la densidad verdadera en t/m3; W la capacidad en t/h.',
        )}
      />
      <Equation
        tex={String.raw`K_1 = 0.85 - \left(\frac{F_{av}}{G}\right)^{2.5},\qquad K_2 = 1.92\times 10^{-6.5\,T/G},\qquad D = 3.25\,G^{1.15}\ \ (G \le 0.25\ \mathrm{m}),\qquad \frac{E_{\mathrm{Bond}}}{W_i} = 10\left(\frac{1}{\sqrt{P_{80}}} - \frac{1}{\sqrt{F_{80}}}\right)`}
        caption={t(
          'The factors of the capacity (equations 10 to 12 of the paper): F_av the mean size of the feed class, K1 its feed factor and K2 its throw factor, here the capacity factors of Sastri and not the classification parameters of the Whiten model; K3 = 1.0 for a harder material. The last term is Bond’s energy per unit of work index, with P80 and F80 in micrometres, the form of the engine at a work index of one.',
          'Los factores de la capacidad (ecuaciones 10 a 12 del artículo): F_av el tamaño medio de la clase de alimento, K1 su factor de alimento y K2 su factor de carrera, aquí los factores de capacidad de Sastri y no los parámetros de clasificación del modelo de Whiten; K3 = 1,0 para un material más duro. El último término es la energía de Bond por unidad de índice de trabajo, con P80 y F80 en micrómetros, la forma del motor con un índice de trabajo igual a uno.',
        )}
      />
      <Ready a={doc} wait={{ en: 'Loading the population balance', es: 'Cargando el balance poblacional' }}>
        {(d) => <Preset d={d} />}
      </Ready>
      <Ready a={doc} wait={{ en: 'Loading the comparison', es: 'Cargando la comparación' }}>
        {(d) => <Result d={d} />}
      </Ready>
      <Callout variant="honest" title={t('What this topic does not claim', 'Lo que este tema no afirma')}>
        <P
          en={<>It does not claim that the particle simulation as crushdem implements it reproduces this jaw: it does not, and the numbers below are the document&apos;s, not a reading of ours. That is a result about this implementation and not a refutation of the published study: the paper&apos;s own simulation agreed with its measurements (0.32 kW simulated against 0.34 kW measured for the 63/52 mm feed, and the change of throughput with the feed size well described) <Cite id="barrios2020" />, but it breaks a particle at a threshold force and replaces it with a fixed progeny set, whereas crushdem 0.6.0 uses the energy-based model of Tavares with an ore derived from the paper&apos;s single-particle tests, and runs with the contact of the paper&apos;s tables. It does not claim a calibration: the ore is derived from the single-particle tests of the paper and nothing in the ore, the preset or the settings was adjusted to the throughput, the power or the product of the jaw. It claims no accuracy beyond one seed, one realisation of each run, and no uncertainty across seeds. It is not bonded particles, nor polyhedra, nor wear, and it is not a cone crusher or the industrial machine of the rest of the App: the HP500 calibration and the leave-one-survey-out validation of the other topics stay where they were. The comparison is a test of the method on a machine with a measurement, in the way that Johansson et al. validate a simulation against laboratory experiments <Cite id="johansson2017val" />, and an industrial step of the method <Cite id="delaney2015" /> <Cite id="quist2016" /> is not run.</>}
          es={<>No afirma que la simulación de partículas tal como la implementa crushdem reproduzca esta mandíbula: no lo hace, y las cifras siguientes son las del documento, no una lectura nuestra. Es un resultado sobre esta implementación y no una refutación del estudio publicado: la simulación del propio artículo coincidió con sus mediciones (0,32 kW simulados contra 0,34 kW medidos para el alimento 63/52 mm, y el cambio de la capacidad con el tamaño de alimento bien descrito) <Cite id="barrios2020" />, pero rompe una partícula en una fuerza umbral y la reemplaza por un conjunto fijo de progenie, mientras que crushdem 0.6.0 usa el modelo energético de Tavares con un mineral derivado de los ensayos de partícula individual del artículo, y corre con el contacto de las tablas del artículo. No afirma una calibración: el mineral se deriva de los ensayos de partícula individual del artículo y nada del mineral, de la configuración ni de los ajustes se adaptó a la capacidad, la potencia ni el producto de la mandíbula. No reclama precisión más allá de una semilla, una realización de cada corrida, y ninguna incertidumbre entre semillas. No son partículas ligadas, ni poliedros, ni desgaste, y no es un chancador de cono ni la máquina industrial del resto de la App: la calibración del HP500 y la validación dejando un muestreo afuera de los otros temas quedan donde estaban. La comparación es una prueba del método en una máquina con medición, como Johansson et al. validan una simulación contra experimentos de laboratorio <Cite id="johansson2017val" />, y un paso industrial del método <Cite id="delaney2015" /> <Cite id="quist2016" /> no se corre.</>}
        />
        <Ready a={doc} wait={{ en: 'Loading what the simulation does not reproduce', es: 'Cargando lo que la simulación no reproduce' }}>
          {(d) => <NotReproduced d={d} />}
        </Ready>
      </Callout>
    </DocSection>
  );
}

/** The case and the package: what is simulated, read from the document. */
function Setup({ d }: { d: DemRun }) {
  const f = useFormat();
  const i0 = { decimals: 0 } as const;
  const i1 = { decimals: 1 } as const;
  const classes = d.points.map((p) => p.feed_class).join(', ');
  const s = d.settings;
  return (
    <>
      <P
        en={<>The document is baked offline by <code>data-pipeline/run.py dem</code> with {d.package.name} {d.package.version} on its {d.package.backend} CPU backend and the seed {d.seed}. The machine is the {d.machine.name}: a feed opening of {f(d.machine.width_mm, i0)} by {f(d.machine.gape_mm, i0)} mm, a closed side of {f(s.css_mm, i1)} mm, an open side of {f(s.oss_mm, i1)} mm (the closed side plus the throw of {f(d.machine.throw_mm, i0)} mm), a swing jaw at {f(s.frequency_hz, i1)} Hz ({f(s.speed_rpm, i0)} strokes per minute). Each run crushes a batch of {f(s.batch_kg, i1)} kg of one narrow feed class, {classes} mm, the three classes of the paper that carry a measured throughput, net power and product. The case is written to <a href={PARTICLES_ROUTE}>the Particle simulation tab</a> of the Validation group of the App, which replays the particles of each point in the section of the jaw with the swing plate moving, and draws the three sides on shared axes.</>}
        es={<>El documento se genera fuera de línea con <code>data-pipeline/run.py dem</code> con {d.package.name} {d.package.version} en su motor de CPU {d.package.backend} y la semilla {d.seed}. La máquina es la {d.machine.name}: una abertura de entrada de {f(d.machine.width_mm, i0)} por {f(d.machine.gape_mm, i0)} mm, un lado cerrado de {f(s.css_mm, i1)} mm, un lado abierto de {f(s.oss_mm, i1)} mm (el lado cerrado más la carrera de {f(d.machine.throw_mm, i0)} mm), una mandíbula móvil a {f(s.frequency_hz, i1)} Hz ({f(s.speed_rpm, i0)} golpes por minuto). Cada corrida chanca un lote de {f(s.batch_kg, i1)} kg de una clase estrecha de alimento, {classes} mm, las tres clases del artículo que tienen capacidad, potencia neta y producto medidos. El caso se muestra en <a href={PARTICLES_ROUTE}>la pestaña Simulación de partículas</a> del grupo Validación de la App, que reproduce las partículas de cada punto en el corte de la mandíbula con la placa móvil en movimiento, y dibuja los tres lados en ejes compartidos.</>}
      />
      <ReadinessNote ids={['dem-run']} />
    </>
  );
}

/** The ore derived from the paper's single-particle tests, with the run protocol, read from the document. */
function OreAndProtocol({ d }: { d: DemRun }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const o = d.ore;
  const s = d.settings;
  const rows: { key: string; en: string; es: string; value: string; unit: string; basis: { en: string; es: string } }[] = [
    { key: 'rho', en: 'Density', es: 'Densidad', value: f(o.density_kg_m3, { decimals: 0 }), unit: 'kg/m3', basis: { en: 'Table 3 of the paper', es: 'Tabla 3 del artículo' } },
    { key: 'einf', en: 'E_inf', es: 'E_inf', value: f(o.e_inf_j_kg, { decimals: 2 }), unit: 'J/kg', basis: { en: 'fitted to the two coarse single-particle classes of the paper', es: 'ajustado a las dos clases gruesas de partícula individual del artículo' } },
    { key: 'd0', en: 'd0', es: 'd0', value: f(o.d0_mm, { decimals: 1 }), unit: 'mm', basis: { en: 'same fit', es: 'el mismo ajuste' } },
    { key: 'phi', en: 'phi', es: 'phi', value: f(o.phi, { decimals: 2 }), unit: '', basis: { en: 'assumed: the value of a gneiss in Tavares', es: 'supuesto: el valor de un gneis en Tavares' } },
    { key: 'var', en: 'sigma^2', es: 'sigma^2', value: f(o.variance, { decimals: 1 }), unit: '', basis: { en: 'assumed: the data give a larger value, limited to the top of the range of Tavares', es: 'supuesto: los datos dan un valor mayor, limitado al extremo superior del rango de Tavares' } },
    { key: 'gamma', en: 'gamma', es: 'gamma', value: f(o.gamma, { decimals: 1 }), unit: '', basis: { en: 'assumed: the paper has no damage law', es: 'supuesto: el artículo no tiene ley de daño' } },
    { key: 'a', en: 'A', es: 'A', value: f(o.a_max_percent, { decimals: 1 }), unit: '%', basis: { en: 'assumed: the gneiss row of Tavares', es: 'supuesto: la fila del gneis de Tavares' } },
    { key: 'b', en: "b'", es: "b'", value: f(o.b_prime, { decimals: 3 }), unit: '', basis: { en: 'assumed: the same row', es: 'supuesto: la misma fila' } },
  ];
  return (
    <>
      <P
        en={<>The ore is derived, not calibrated to the jaw. The paper gives no breakage parameter of its ore: it breaks spheres by a force threshold calibrated on single-particle compression, with a fixed progeny set. The sample median of the breakage force of each of the 30 particles of a size class, digitised from the paper&apos;s figure, is mapped to the energy that a sphere holds between two steel plates in the contact of the paper&apos;s tables, and E_inf and d0 are fitted to the two coarse classes. The parameters that the paper does not give are the values of one rock of the literature <Cite id="tavares2021" />, written as assumptions. Nothing in the table below was read from the jaw&apos;s throughput, power or product, and no ore property was tuned to reach a band. Two choices of the derivation were made by the package&apos;s authors after jaw results of the package were known, and its validation record says so: the exponent of the size effect was fixed and the finest class left out after a first trial run, and the sample median replaced the median of a lognormal fit after an earlier set of jaw runs. The run with the other statistic does not exist, so whether the net power verdicts survive it is not known.</>}
        es={<>El mineral se deriva, no se calibra a la mandíbula. El artículo no da ningún parámetro de fractura de su mineral: rompe esferas con un umbral de fuerza calibrado en compresión de partícula individual, con un conjunto fijo de progenie. La mediana muestral de la fuerza de fractura de cada una de las 30 partículas de una clase de tamaño, digitalizada de la figura del artículo, se transforma en la energía que una esfera retiene entre dos placas de acero en el contacto de las tablas del artículo, y E_inf y d0 se ajustan a las dos clases gruesas. Los parámetros que el artículo no da son los valores de una roca de la literatura <Cite id="tavares2021" />, escritos como supuestos. Nada de la tabla siguiente se leyó de la capacidad, la potencia ni el producto de la mandíbula, y ninguna propiedad del mineral se ajustó para alcanzar una banda. Los autores del paquete tomaron dos decisiones de la derivación después de conocer resultados del paquete en la mandíbula, y su registro de validación lo dice: el exponente del efecto de tamaño se fijó y la clase más fina se dejó fuera tras una primera corrida de prueba, y la mediana muestral reemplazó a la mediana de un ajuste lognormal tras un conjunto anterior de corridas en la mandíbula. La corrida con el otro estadístico no existe, así que no se sabe si los veredictos de potencia neta se mantienen con él.</>}
      />
      <TableWrap>
        <table className="caos-table" data-state="ready" data-dem="ore">
          <caption>{t('The ore of the particle simulation, as the document records it, with the basis of each value.', 'El mineral de la simulación de partículas, como lo registra el documento, con el fundamento de cada valor.')}</caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Parameter', 'Parámetro')}</th>
              <th>{t('Value', 'Valor')}</th>
              <th className="caos-col-text">{t('Unit', 'Unidad')}</th>
              <th className="caos-col-text">{t('Basis', 'Fundamento')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="caos-col-text">{lang === 'es' ? r.es : r.en}</td>
                <td>{r.value}</td>
                <td className="caos-col-text">{r.unit}</td>
                <td className="caos-col-text">{r.basis[lang]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <P
        en={<>The run is a batch. The spheres are fed whole in the feed class, the time step is a fraction of the Rayleigh limit of the smallest sphere, and the smallest sphere kept is {f(s.minimum_sphere_mm, { decimals: 1 })} mm. A run is stopped when an overlap exceeds a fraction of the smaller radius of the pair, the stop rule of the package, which is tried at the limits {s.overlap_ladder.map((v) => f(v, { decimals: 1 })).join(' and ')} in order; a run that does not complete is recorded as it stopped, never repaired. The steady window runs from the stroke at which a quarter of the product mass has passed to the one at which three quarters have; the throughput is the mass passed over the window&apos;s time, the net power the mean over the window of the power that the swing plate delivers to the bed (the force of the contacts on the plate times its velocity), and a standard error that takes the lag-1 autocorrelation of the strokes into account is recorded with each. The product is the mass passing the sieves of the document, with the breakage fines in the finest class.</>}
        es={<>La corrida es un lote. Las esferas se alimentan enteras en la clase de alimento, el paso de tiempo es una fracción del límite de Rayleigh de la esfera más pequeña, y la esfera más pequeña que se conserva es de {f(s.minimum_sphere_mm, { decimals: 1 })} mm. Una corrida se detiene cuando un solape supera una fracción del radio menor del par, la regla de parada del paquete, que se prueba en los límites {s.overlap_ladder.map((v) => f(v, { decimals: 1 })).join(' y ')} en orden; una corrida que no se completa se registra tal como se detuvo, nunca se repara. La ventana estacionaria va desde el golpe en que ha pasado un cuarto de la masa del producto hasta aquel en que han pasado tres cuartos; la capacidad es la masa que pasó sobre el tiempo de la ventana, la potencia neta el promedio en la ventana de la potencia que la placa móvil entrega al lecho (la fuerza de los contactos sobre la placa por su velocidad), y con cada una se registra un error estándar que considera la autocorrelación de rezago 1 de los golpes. El producto es la masa que pasa por los tamices del documento, con los finos de fractura en la clase más fina.</>}
      />
    </>
  );
}

/** The laboratory preset and the measured side, read from the document. */
function Preset({ d }: { d: DemRun }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const pr = d.preset;
  const r1 = (v: number[]) => `${f(v[0], { decimals: 2 })} ${lang === 'es' ? 'a' : 'to'} ${f(v[1], { decimals: 2 })}`;
  return (
    <>
      <P
        en={<>The preset is K1 = {f(pr.k1_over_css, { decimals: 1 })} times the closed side, K2 the open side and K3 = {f(pr.k3, { decimals: 1 })}, with the material factor of the capacity {f(pr.material_factor, { decimals: 1 })}. The ranges of King for Symons cone crushers that make the band are {r1(pr.k1_over_css_range)} for K1 over the closed side, {r1(pr.k2_over_css_range)} for K2 over the closed side and {r1(pr.k3_range)} for K3. The ore enters the population balance through one relation, the exponents of the two published t10 laws set equal: A times b is 3600 A b&apos; over E50 (A b in percent per kWh/t, E50 in J/kg), the algebra of the product and not a published conversion, and with it b depends on the size through E50, where the engine holds it constant. The energy per breakage event of the population balance is the engine&apos;s own rule, E_cs = 0.033 times the throw in mm times the speed in rpm over 350, in kWh/t, written for the plant machines and applied unchanged here (it gives {f(d.points[0].population_balance.specific_energy_kwh_t, { decimals: 3 })} kWh/t at this throw and speed). The population balance predicts no power: no work index, A, b or fracture energy of the ore is published, so only Bond&apos;s energy per unit of work index is returned, and the work index that the measured energy implies is in the table below as a number to read, not as a prediction.</>}
        es={<>La configuración es K1 = {f(pr.k1_over_css, { decimals: 1 })} veces el lado cerrado, K2 el lado abierto y K3 = {f(pr.k3, { decimals: 1 })}, con el factor de material de la capacidad {f(pr.material_factor, { decimals: 1 })}. Los rangos de King para chancadores de cono Symons que forman la banda son {r1(pr.k1_over_css_range)} para K1 sobre el lado cerrado, {r1(pr.k2_over_css_range)} para K2 sobre el lado cerrado y {r1(pr.k3_range)} para K3. El mineral entra al balance poblacional por una sola relación, los exponentes de las dos leyes t10 publicadas igualados: A por b es 3600 A b&apos; sobre E50 (A b en porcentaje por kWh/t, E50 en J/kg), el álgebra del producto y no una conversión publicada, y con ella b depende del tamaño a través de E50, donde el motor lo mantiene constante. La energía por evento de fractura del balance poblacional es la regla propia del motor, E_cs = 0,033 por la carrera en mm por la velocidad en rpm sobre 350, en kWh/t, escrita para las máquinas de planta y aplicada sin cambios aquí (da {f(d.points[0].population_balance.specific_energy_kwh_t, { decimals: 3 })} kWh/t con esta carrera y velocidad). El balance poblacional no predice potencia: no se publica un índice de trabajo, A, b ni energía de fractura del mineral, así que solo se devuelve la energía de Bond por unidad de índice de trabajo, y el índice de trabajo que implica la energía medida está en la tabla siguiente como un número para leer, no como una predicción.</>}
      />
      <TableWrap>
        <table className="caos-table" data-state="ready" data-dem="points">
          <caption>
            {t(
              'The three operating points: the feed class, its mean size and its analytic F80, the measurement with its source, and the population balance’s capacity with its factors. The paper tabulates only one power; the other values are digitised from its figures.',
              'Los tres puntos de operación: la clase de alimento, su tamaño medio y su F80 analítico, la medición con su fuente, y la capacidad del balance poblacional con sus factores. El artículo tabula una sola potencia; los demás valores se digitalizan de sus figuras.',
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Feed class (mm)', 'Clase de alimento (mm)')}</th>
              <th>{t('Mean size (mm)', 'Tamaño medio (mm)')}</th>
              <th>F80 (mm)</th>
              <th>{t('Measured throughput (kg/h)', 'Capacidad medida (kg/h)')}</th>
              <th>{t('Measured net power (kW)', 'Potencia neta medida (kW)')}</th>
              <th>{t('Measured P80 (mm)', 'P80 medido (mm)')}</th>
              <th>{t('Implied work index (kWh/t)', 'Índice de trabajo implícito (kWh/t)')}</th>
              <th>V_h (m3/h)</th>
              <th>K1 / K2</th>
            </tr>
          </thead>
          <tbody>
            {d.points.map((p) => {
              const c = p.population_balance.capacity;
              return (
                <tr key={p.id}>
                  <td className="caos-col-text">{p.feed_class}</td>
                  <td>{f(p.feed_mean_mm, { decimals: 1 })}</td>
                  <td>{f(p.feed_f80_mm, { decimals: 1 })}</td>
                  <td>{f(p.measured.throughput_kg_h.value, { decimals: 0 })}</td>
                  <td>{f(p.measured.net_power_kw.value, { decimals: 3 })}</td>
                  <td>{f(p.measured.p80_mm, { decimals: 2 })}</td>
                  <td>{f(p.measured.implied_work_index_kwh_t, { decimals: 1 })}</td>
                  <td>{f(c.volumetric_m3_h, { decimals: 3 })}</td>
                  <td>{`${f(c.feed_factor, { decimals: 3 })} / ${f(c.throw_factor, { decimals: 3 })}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <P
        en={<>The bands were set before any run of the product, in the plan of the particle simulation: throughput within {f(d.bands.throughput_relative, { percent: true, decimals: 0 })}, net power within {f(d.bands.net_power_relative, { percent: true, decimals: 0 })} and the reduction ratio, F80 over P80, within {f(d.bands.reduction_ratio_relative, { percent: true, decimals: 0 })}, the relative error being the difference over the second value. The operating points, the bands, the machine, the ore and the settings are fixed without reading any measured throughput, power or product, and a test of the pipeline replaces the measured values and checks that only the verdicts move. A verdict is <em>met</em> inside the band, <em>not met</em> outside it and <em>not compared</em> when a value is absent; a verdict that rests on a window also says whether it is resolved, that is, whether the nearer edge of the band is more than two standard errors from the window mean.</>}
        es={<>Las bandas se fijaron antes de cualquier corrida del producto, en el plan de la simulación de partículas: capacidad dentro de {f(d.bands.throughput_relative, { percent: true, decimals: 0 })}, potencia neta dentro de {f(d.bands.net_power_relative, { percent: true, decimals: 0 })} y la razón de reducción, F80 sobre P80, dentro de {f(d.bands.reduction_ratio_relative, { percent: true, decimals: 0 })}, siendo el error relativo la diferencia sobre el segundo valor. Los puntos de operación, las bandas, la máquina, el mineral y los ajustes se fijan sin leer ninguna capacidad, potencia ni producto medidos, y una prueba del pipeline reemplaza los valores medidos y verifica que solo se mueven los veredictos. Un veredicto es <em>cumple</em> dentro de la banda, <em>no cumple</em> fuera de ella y <em>no comparado</em> cuando falta un valor; un veredicto que descansa en una ventana dice además si está resuelto, es decir, si el borde más cercano de la banda queda a más de dos errores estándar de la media de la ventana.</>}
      />
    </>
  );
}

const cell = (v: number | null, q: DemQuantity, f: ReturnType<typeof useFormat>, na: string) => (v === null ? na : f(v, { decimals: QUANTITY_DECIMALS[q] }));

/** The result: one table of the three sides and their verdicts, one figure of the errors, read from the document. */
function Result({ d }: { d: DemRun }) {
  const t = useT();
  const f = useFormat();
  const lang = useShellLang();
  const na = t('not available', 'no disponible');
  const all = verdictCounts(d);
  const bars = errorBars(d);
  const bases = [...new Set(bars.filter((b) => b.basis).map((b) => b.basis as string))];
  const data = bars.map((b) => ({
    id: b.id,
    group: { id: b.pointId, label: { en: `Feed ${b.feedClass} mm`, es: `Alimento ${b.feedClass} mm` } },
    label: { en: `${QUANTITY_LABEL[b.quantity].en}, ${b.side === 'simulation' ? 'particle simulation' : 'population balance'}`, es: `${QUANTITY_LABEL[b.quantity].es}, ${b.side === 'simulation' ? 'simulación de partículas' : 'balance poblacional'}` },
    value: b.errorPct,
    tone: VERDICT_TONE[b.verdict],
    hint: { en: `${VERDICT_LABEL[b.verdict].en}, band ${f(b.band, { percent: true, decimals: 0 })}`, es: `${VERDICT_LABEL[b.verdict].es}, banda ${f(b.band, { percent: true, decimals: 0 })}` },
  }));
  return (
    <>
      <P
        en={<>The document states {f(all.total, { decimals: 0 })} verdicts, one per quantity for each pair of sides at each point, and {f(all.met, { decimals: 0 })} are met, {f(all.notMet, { decimals: 0 })} are not met and {f(all.notCompared, { decimals: 0 })} are not compared. The table gives the two comparisons with the measurement; the third pair, the population balance against the particle simulation, is in the document and in the Particle simulation tab. A value is not compared when a side is absent, because a run did not complete or because the population balance predicts no power.</>}
        es={<>El documento declara {f(all.total, { decimals: 0 })} veredictos, uno por magnitud para cada par de lados en cada punto, y {f(all.met, { decimals: 0 })} cumplen, {f(all.notMet, { decimals: 0 })} no cumplen y {f(all.notCompared, { decimals: 0 })} no se comparan. La tabla da las dos comparaciones con la medición; el tercer par, el balance poblacional contra la simulación de partículas, está en el documento y en la pestaña Simulación de partículas. Un valor no se compara cuando falta un lado, porque una corrida no se completó o porque el balance poblacional no predice potencia.</>}
      />
      <TableWrap>
        <table className="caos-table" data-state="ready" data-dem="result">
          <caption>
            {t(
              'The measurement, the particle simulation and the population balance at the three points, with the relative error of each side against the measurement and its verdict; the particle simulation carries its standard error over the steady window and whether its verdict is resolved.',
              'La medición, la simulación de partículas y el balance poblacional en los tres puntos, con el error relativo de cada lado contra la medición y su veredicto; la simulación de partículas lleva su error estándar sobre la ventana estacionaria y si su veredicto está resuelto.',
            )}
          </caption>
          <thead>
            <tr>
              <th className="caos-col-text">{t('Feed (mm)', 'Alimento (mm)')}</th>
              <th className="caos-col-text">{t('Quantity', 'Magnitud')}</th>
              <th>{t('Measured', 'Medido')}</th>
              <th>{t('Particle simulation', 'Simulación de partículas')}</th>
              <th>{t('Error', 'Error')}</th>
              <th className="caos-col-text">{t('Verdict', 'Veredicto')}</th>
              <th>{t('Population balance', 'Balance poblacional')}</th>
              <th>{t('Error', 'Error')}</th>
              <th className="caos-col-text">{t('Verdict', 'Veredicto')}</th>
            </tr>
          </thead>
          <tbody>
            {d.points.flatMap((p) =>
              QUANTITIES.map((q) => {
                const sm = p.verdicts.simulation_vs_measured[q];
                const pm = p.verdicts.population_balance_vs_measured[q];
                const se = q === 'throughput' ? p.simulation.throughput_se_kg_h : q === 'net_power' ? p.simulation.net_power_se_kw : null;
                const resolved = sm.resolved === null ? '' : sm.resolved ? t(', resolved', ', resuelto') : t(', not resolved', ', no resuelto');
                const verdict = (v: typeof sm, extra: string) => `${VERDICT_LABEL[v.verdict][lang]}${v.verdict === 'not compared' && v.basis ? ` (${BASIS_TEXT[v.basis]?.[lang] ?? v.basis})` : ''}${extra}`;
                return (
                  <tr key={`${p.id}-${q}`} data-verdict-simulation={sm.verdict} data-verdict-balance={pm.verdict}>
                    <td className="caos-col-text">{p.feed_class}</td>
                    <td className="caos-col-text">{`${QUANTITY_LABEL[q][lang]}${QUANTITY_UNIT[q] ? ` (${QUANTITY_UNIT[q]})` : ''}`}</td>
                    <td>{cell(sm.second, q, f, na)}</td>
                    <td>{sm.first === null ? na : `${cell(sm.first, q, f, na)}${se !== null ? ` ± ${f(se, { decimals: QUANTITY_DECIMALS[q] })}` : ''}`}</td>
                    <td>{sm.relative_error === null ? na : f(sm.relative_error, { percent: true, decimals: 0 })}</td>
                    <td className="caos-col-text">{verdict(sm, resolved)}</td>
                    <td>{pm.first === null ? na : cell(pm.first, q, f, na)}</td>
                    <td>{pm.relative_error === null ? na : f(pm.relative_error, { percent: true, decimals: 0 })}</td>
                    <td className="caos-col-text">{verdict(pm, '')}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </TableWrap>
      <Figure
        caption={t(
          `The relative error against the measurement of the particle simulation and of the population balance, for the throughput, the net power and the reduction ratio at the three feed classes, in percent, read from the committed document. A bar in the colour of a met verdict is inside its band; a bar of a not met verdict is outside it; a value that is not compared has no bar and is listed as not available. The bands are ${f(d.bands.throughput_relative, { percent: true, decimals: 0 })} for the throughput, ${f(d.bands.net_power_relative, { percent: true, decimals: 0 })} for the net power and ${f(d.bands.reduction_ratio_relative, { percent: true, decimals: 0 })} for the reduction ratio.`,
          `El error relativo contra la medición de la simulación de partículas y del balance poblacional, para la capacidad, la potencia neta y la razón de reducción en las tres clases de alimento, en porcentaje, leído del documento versionado. Una barra del color de un veredicto que cumple está dentro de su banda; una barra de un veredicto que no cumple está fuera; un valor que no se compara no tiene barra y se lista como no disponible. Las bandas son ${f(d.bands.throughput_relative, { percent: true, decimals: 0 })} para la capacidad, ${f(d.bands.net_power_relative, { percent: true, decimals: 0 })} para la potencia neta y ${f(d.bands.reduction_ratio_relative, { percent: true, decimals: 0 })} para la razón de reducción.`,
        )}
      >
        <BarChart
          title={{ en: 'Relative error against the measurement per point, side and quantity', es: 'Error relativo contra la medición por punto, lado y magnitud' }}
          orientation="horizontal"
          axis={{ label: { en: 'Relative error', es: 'Error relativo' }, unit: '%', format: { decimals: 0 } }}
          data={data}
          values={false}
          legend={[
            { tone: 'good', label: { en: 'Inside the band (met)', es: 'Dentro de la banda (cumple)' } },
            { tone: 'bad', label: { en: 'Outside the band (not met)', es: 'Fuera de la banda (no cumple)' } },
          ]}
        />
      </Figure>
      <L
        items={bases.map((b) => ({
          en: <>Not compared because {BASIS_TEXT[b]?.en ?? b}.</>,
          es: <>No comparado porque {BASIS_TEXT[b]?.es ?? b}.</>,
        }))}
      />
    </>
  );
}

/** What the simulation as built does not reproduce, in the document's terms. */
function NotReproduced({ d }: { d: DemRun }) {
  const f = useFormat();
  const lang = useShellLang();
  const i0 = { decimals: 0 } as const;
  const i1 = { decimals: 1 } as const;
  const i2 = { decimals: 2 } as const;
  const stopped = incompletePoints(d);
  const done = d.points.filter((p): p is DemPoint => p.simulation.status === 'complete');
  const lim = (p: DemPoint) => completingLimit(p);
  const items: { en: React.ReactNode; es: React.ReactNode }[] = [];
  stopped.forEach((p) =>
    items.push({
      en: <>The run of the {p.feed_class} mm feed did not complete: it stopped with an overlap error at every limit of the ladder, in stroke {f(p.simulation.strokes + 1, i0)}, after {f(p.simulation.mass_passed_kg, { decimals: 3 })} kg had passed, so the document states no window statistic for it and the verdicts that need one are not compared. The state of the document is {d.state}.</>,
      es: <>La corrida del alimento {p.feed_class} mm no se completó: se detuvo con un error de solape en cada límite de la escala, en el golpe {f(p.simulation.strokes + 1, i0)}, después de pasar {f(p.simulation.mass_passed_kg, { decimals: 3 })} kg, así que el documento no declara estadístico de ventana para ella y los veredictos que lo necesitan no se comparan. El estado del documento es {d.state === 'partial' ? 'parcial' : d.state}.</>,
    }),
  );
  done.forEach((p) => {
    const tr = throughputRatio(p);
    const en = energyShareOfMeasured(p);
    const w = windowOverlapShare(p);
    items.push({
      en: (
        <>
          {p.feed_class} mm: the run completes at the overlap limit {lim(p) === null ? '' : f(lim(p) as number, i1)} in {f(p.simulation.strokes, i0)} strokes and passes the batch {tr === null ? '' : f(tr, i1)} times faster than the measurement, {f(p.simulation.throughput_kg_h ?? 0, i0)} against {f(p.measured.throughput_kg_h.value, i0)} kg/h. The energy the swing plate delivers is {p.simulation.specific_energy_j_kg === null ? '' : f(p.simulation.specific_energy_j_kg, i0)} J/kg against {f(p.measured.specific_energy_j_kg, i0)} J/kg derived from the measured power over the measured throughput ({en === null ? '' : f(en, { percent: true, decimals: 0 })} of it), so a net power inside its band is the product of a fast machine that does little work per kilogram, not of a right energy balance. The product is coarser: P80 {p.simulation.p80_mm === null ? '' : f(p.simulation.p80_mm, i1)} mm against {f(p.measured.p80_mm, i1)} mm measured, a reduction ratio of {p.simulation.reduction_ratio === null ? '' : f(p.simulation.reduction_ratio, i2)} against {f(p.measured.reduction_ratio, i2)}.
          {w ? <> {f(w.above, i0)} of the {f(w.strokes, i0)} strokes of the window ran above the reference overlap of {f(d.settings.overlap_reference, i1)} of the smaller radius.</> : null}
          {p.simulation.spheres_above_open_side ? <> {f(p.simulation.spheres_above_open_side, i0)} spheres larger than the open side passed, the largest of {f(p.simulation.largest_product_mm ?? 0, i1)} mm against the open side of {f(d.settings.oss_mm, i1)} mm.</> : null}
        </>
      ),
      es: (
        <>
          {p.feed_class} mm: la corrida se completa en el límite de solape {lim(p) === null ? '' : f(lim(p) as number, i1)} en {f(p.simulation.strokes, i0)} golpes y pasa el lote {tr === null ? '' : f(tr, i1)} veces más rápido que la medición, {f(p.simulation.throughput_kg_h ?? 0, i0)} contra {f(p.measured.throughput_kg_h.value, i0)} kg/h. La energía que entrega la placa móvil es {p.simulation.specific_energy_j_kg === null ? '' : f(p.simulation.specific_energy_j_kg, i0)} J/kg contra {f(p.measured.specific_energy_j_kg, i0)} J/kg derivados de la potencia medida sobre la capacidad medida ({en === null ? '' : f(en, { percent: true, decimals: 0 })} de ella), de modo que una potencia neta dentro de su banda es el producto de una máquina rápida que hace poco trabajo por kilogramo, no de un balance de energía correcto. El producto es más grueso: P80 {p.simulation.p80_mm === null ? '' : f(p.simulation.p80_mm, i1)} mm contra {f(p.measured.p80_mm, i1)} mm medido, una razón de reducción de {p.simulation.reduction_ratio === null ? '' : f(p.simulation.reduction_ratio, i2)} contra {f(p.measured.reduction_ratio, i2)}.
          {w ? <> {f(w.above, i0)} de los {f(w.strokes, i0)} golpes de la ventana corrieron sobre el solape de referencia de {f(d.settings.overlap_reference, i1)} del radio menor.</> : null}
          {p.simulation.spheres_above_open_side ? <> Pasaron {f(p.simulation.spheres_above_open_side, i0)} esferas mayores que el lado abierto, la mayor de {f(p.simulation.largest_product_mm ?? 0, i1)} mm contra el lado abierto de {f(d.settings.oss_mm, i1)} mm.</> : null}
        </>
      ),
    });
  });
  const inj = done.map((p) => injectedShare(p)).filter((v): v is number => v !== null);
  if (inj.length) {
    items.push({
      en: <>The replacement is bounded: the energy it injects is at most {f(Math.max(...inj), { percent: true, decimals: 1 })} of the energy the particles absorbed, so the result does not come from the placement of the progeny.</>,
      es: <>El reemplazo está acotado: la energía que inyecta es como máximo {f(Math.max(...inj), { percent: true, decimals: 1 })} de la energía que absorbieron las partículas, así que el resultado no viene de la colocación de la progenie.</>,
    });
  }
  items.push({
    en: <>The population balance is below the measured throughput at every point, and its reduction ratio is inside its band at the {d.points.filter((p) => p.verdicts.population_balance_vs_measured.reduction_ratio.verdict === 'met').map((p) => p.feed_class).join(', ')} mm feed only; it states no power. The causes of the particle simulation&apos;s departure are not isolated by this document: the contact stiffness of the paper&apos;s table, the harmonic swing law, the nip angle and the flat smooth plates are assumptions of the machine, and the run does not say which of them, if any, matters.</>,
    es: <>El balance poblacional queda bajo la capacidad medida en todos los puntos, y su razón de reducción está dentro de su banda solo en el alimento {d.points.filter((p) => p.verdicts.population_balance_vs_measured.reduction_ratio.verdict === 'met').map((p) => p.feed_class).join(', ')} mm; no declara potencia. Las causas de la desviación de la simulación de partículas no las aísla este documento: la rigidez de contacto de la tabla del artículo, la ley de oscilación armónica, el ángulo de mordida y las placas lisas y planas son supuestos de la máquina, y la corrida no dice cuál de ellos, si alguno, importa.</>,
  });
  return (
    <>
      <p>{lang === 'es' ? 'Lo que la simulación tal como la implementa crushdem no reproduce, en los términos del documento:' : 'What the simulation as crushdem implements it does not reproduce, in the document’s terms:'}</p>
      <L items={items} />
    </>
  );
}
