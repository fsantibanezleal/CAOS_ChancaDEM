// The write-up of the case (the workbench's Context tab): the problem, the variables that matter and how to read the views, all
// from the case's manifest; what a crushing engineer should see; the flags the bake raised, in words; the operating point; and,
// on a real survey, the publication it comes from, with its DOI link and licence. Nothing here is typed per case.
import { useShellLang } from '@fasl-work/caos-app-shell';
import { flagText } from '../engine/flags';
import { ReadinessNote } from '../readiness/ReadinessNote';
import { rowsFor } from '../workbench/model';
import { Pending, REGIME_TEXT, useNum, useT, useView } from './shared';

export function ContextView() {
  const { sel } = useView();
  const lang = useShellLang();
  const t = useT();
  const num = useNum();
  if (!sel) return <Pending />;
  const m = sel.data.manifest;
  const p = m.params;
  const stage = { primary: t('primary', 'primaria'), secondary: t('secondary', 'secundaria'), tertiary: t('tertiary', 'terciaria'), control: t('control', 'control') }[m.stage];
  const params: [string, string, string, string][] = [
    ['Machine', 'Máquina', p.machine, ''],
    ['Closed-side setting', 'Abertura de descarga', num(p.css_mm, { digits: 4 }), 'mm'],
    ['Throw', 'Carrera', num(p.throw_mm, { digits: 4 }), 'mm'],
    ['Eccentric speed', 'Velocidad excéntrica', num(p.speed_rpm, { digits: 4 }), 'rpm'],
    ['Feed x63', 'Alimentación x63', num(p.feed_x63_mm, { digits: 6 }), 'mm'],
    ['Feed uniformity m', 'Uniformidad de la alimentación m', num(p.feed_m, { digits: 4 }), ''],
    ['Ore A times b', 'Mineral A por b', num(p.ore_axb, { digits: 4 }), ''],
    ['Bond work index', 'Índice de trabajo de Bond', num(p.ore_wi, { digits: 4 }), 'kWh/t'],
  ];
  const machineName: Record<string, string> = {
    'cone-sec': t('Secondary cone', 'Cono secundario'),
    'cone-tert': t('Tertiary cone', 'Cono terciario'),
    'cone-short-head': t('Short-head cone', 'Cono de cabeza corta'),
    gyratory: t('Gyratory', 'Giratoria'),
    jaw: t('Jaw', 'Mandíbula'),
  };
  const source = m.source;
  return (
    <>
      <ReadinessNote ids={rowsFor('context', m.real_or_synthetic === 'real')} />
      <h2>{m.title[lang]}</h2>
      <p>
        {t('Category', 'Categoría')}: {m.category[lang]}. {t('Circuit stage', 'Etapa del circuito')}: {stage}.{' '}
        {m.real_or_synthetic === 'real' ? t('A measured survey of an industrial crusher.', 'Un muestreo medido de una chancadora industrial.') : t('A synthetic case of the engine.', 'Un caso sintético del motor.')}
      </p>
      <h3>{t('The problem', 'El problema')}</h3>
      <p>{m.context.problem[lang]}</p>
      <h3>{t('The variables that matter', 'Las variables que importan')}</h3>
      <p>{m.context.variables[lang]}</p>
      <h3>{t('How to read the views', 'Cómo leer las vistas')}</h3>
      <p>{m.context.reading[lang]}</p>
      <p>
        {t(
          'Chamber draws the crushing chamber and the nip angle. Product shows the feed and product gradations, the breakage and the mass balance. Performance gives the result, the capacity hump, the setting trade-off, the power and the three variants. Learned runs the surrogate and the autoencoder in the browser and finds the setting for a target P80. Validation holds the live engine against the committed replay and, on a real survey, the measured values against the model.',
          'Cámara dibuja la cámara de chancado y el ángulo de nip. Producto muestra las gradaciones de la alimentación y del producto, la fractura y el balance de masa. Desempeño entrega el resultado, la curva de capacidad, el efecto de la abertura, la potencia y las tres variantes. Aprendido ejecuta el sustituto y el autocodificador en el navegador y encuentra la abertura para un P80 objetivo. Validación contrasta el motor en vivo con el replay comprometido y, en un muestreo real, los valores medidos con el modelo.',
        )}
      </p>
      <h3>{t('What a crushing engineer should see', 'Lo que un ingeniero de chancado debería ver')}</h3>
      <p>{m.expected_band[lang]}</p>
      <h3>{t('The operating point', 'El punto de operación')}</h3>
      <table className="caos-table" data-state="ready">
        <thead>
          <tr>
            <th className="caos-col-text">{t('Input', 'Entrada')}</th>
            <th>{t('Value', 'Valor')}</th>
            <th>{t('Unit', 'Unidad')}</th>
          </tr>
        </thead>
        <tbody>
          {params.map(([en, es, value, unit], i) => (
            <tr key={en}>
              <td className="caos-col-text">{t(en, es)}</td>
              <td>{i === 0 ? machineName[p.machine] : value}</td>
              <td>{unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{t('Flags of the baked case', 'Marcas del caso precalculado')}</h3>
      {m.flags.length === 0 ? (
        <p>{t('None: the baked point is inside the validated envelope and raised no check.', 'Ninguna: el punto precalculado está dentro de la envolvente validada y no activó ninguna verificación.')}</p>
      ) : (
        <ul>
          {m.flags.map((code) => (
            <li key={code}>{flagText(code, lang)}</li>
          ))}
        </ul>
      )}
      <p>
        {t('Regime', 'Régimen')}: {REGIME_TEXT[sel.baked.result.regime]?.[lang] ?? sel.baked.result.regime}. {t('Engine', 'Motor')}: {m.engine.model} ({m.engine.package} {m.engine.version}).
      </p>
      <h3>{t('Source', 'Fuente')}</h3>
      {source.kind === 'publication' ? (
        <p>
          {source.citation}{' '}
          <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer">
            doi:{source.doi}
          </a>
          . {t('Licence', 'Licencia')}: {source.license}.
        </p>
      ) : (
        <p>{t('Authored: an operating point of the circuit matrix written for this product, run by the engine.', 'Autoral: un punto de operación de la matriz de circuitos escrita para este producto, ejecutado por el motor.')}</p>
      )}
    </>
  );
}
