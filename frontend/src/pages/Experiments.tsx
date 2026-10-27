// The Experiments page. Unit U7 rewrites it for the crusher. Until then the tabs that read the template example's SIR engine and its
// old contract shapes (the cases, the comparison with the theory, the immunity) are removed (unit U2b-1), so the build holds; the page
// keeps its frame and its metrics, protocol and datasets tabs.
import { Callout, Cite, DocPage, DocSection, Equation, Figure, Tabs } from '@fasl-work/caos-app-shell';
import { FlowFigure } from '../content/figures';
import { P, useT } from '../content/bi';

export function Experiments() {
  const t = useT();

  return (
    <DocPage wide title={{ en: 'Experiments', es: 'Experimentos' }} lede={t('The questions the example answers, one per tab: what each case shows, how a run compares with the final-size relation, how much immunity stops an outbreak, and the metrics, the held-out protocol and the data behind them.', 'Las preguntas que responde el ejemplo, una por pestaña: qué muestra cada caso, cómo se compara una corrida con la relación de tamaño final, cuánta inmunidad detiene un brote, y las métricas, el protocolo con datos reservados y los datos detrás de ellas.')}>
      <Tabs
        ariaLabel={t('Experiments', 'Experimentos')}
        tabs={[
          { id: 'metrics', label: t('Metrics', 'Métricas'), content: <>
              <DocSection title={{ en: 'The metrics', es: 'Las métricas' }} area="metrics" refs={['km1927']}>
                <P
                  en={<>Two numbers judge a run on this page. The attack rate is the share of the population ever infected, the recovered count at the end over N; it is compared with the final size that the relation of Kermack and McKendrick fixes <Cite id="km1927" />. The gap between them is what the Against the theory tab plots, and it is zero for a run that ended inside its horizon.</>}
                  es={<>Dos números juzgan una corrida en esta página. La tasa de ataque es la fracción de la población que llegó a contagiarse, la cuenta de recuperados al final sobre N; se compara con el tamaño final que fija la relación de Kermack y McKendrick <Cite id="km1927" />. La brecha entre ambos es lo que grafica la pestaña Contra la teoría, y es cero para una corrida que terminó dentro de su horizonte.</>}
                />
                <Equation tex="a = \frac{R(T)}{N}, \qquad \delta = a - z, \qquad z = 1 - e^{-R_0 z}" caption={t('The attack rate a at the horizon T, and its gap δ from the final size z.', 'La tasa de ataque a en el horizonte T, y su brecha δ respecto del tamaño final z.')} />
                <Equation tex="\mathrm{RMSE} = \sqrt{\frac{1}{n} \sum_{j=1}^{n} \left( \hat{y}_j - y_j \right)^2}, \qquad R^2 = 1 - \frac{\sum_j (\hat{y}_j - y_j)^2}{\sum_j (y_j - \bar{y})^2}" caption={t('The held-out error of the learned surrogate on the peak share: root-mean-square error and the coefficient of determination, over n sets.', 'El error reservado del sustituto aprendido sobre la fracción del pico: error cuadrático medio y coeficiente de determinación, sobre n conjuntos.')} />
                <P
                  en="No percentage error is used. The peak share of a sub-critical draw is close to zero, and an error divided by a number near zero grows without bound whatever the model does, so it would punish a good fit and reward a bad one. The metrics are those of the pipeline's evaluation stage, written into each manifest."
                  es="No se usa error porcentual. La fracción del pico de un sorteo subcrítico es cercana a cero, y un error dividido por un número cercano a cero crece sin límite haga lo que haga el modelo, de modo que castigaría un buen ajuste y premiaría uno malo. Las métricas son las de la etapa de evaluación del pipeline, escritas en cada manifiesto."
                />
              </DocSection>
          </> },
          { id: 'protocol', label: t('Protocol', 'Protocolo'), content: <>
              <DocSection title={{ en: 'The protocol', es: 'El protocolo' }} area="protocol" noRefsReason={{ en: 'Describes this build.', es: 'Describe esta compilación.' }}>
                <P
                  en="The learned surrogate is trained on the four cases of the registry that start with an infection and judged on twenty parameter sets drawn from a generator seeded with the bake seed plus a fixed offset. The held-out sets never enter the fit, and the same draw is used for the analytic baseline, so the comparison is leakage-safe and repeatable."
                  es="El sustituto aprendido se entrena con los cuatro casos del registro que parten con una infección y se juzga en veinte conjuntos de parámetros sorteados con un generador sembrado con la semilla del precálculo más un desplazamiento fijo. Los conjuntos reservados nunca entran al ajuste, y el mismo sorteo se usa para la línea base analítica, así que la comparación no tiene fuga y es repetible."
                />
                <Figure caption={t('The held-out protocol, and the anti-pattern it forbids: scoring the model on the cases it was fitted to.', 'El protocolo con datos reservados, y el antipatrón que prohíbe: puntuar el modelo en los casos con que se ajustó.')}>
                  <FlowFigure stages={[t('Four training cases', 'Cuatro casos de entrenamiento'), t('Fit the surrogate', 'Ajustar el sustituto'), t('Twenty new sets', 'Veinte conjuntos nuevos'), t('Score on those only', 'Puntuar sólo en esos')]} label={t('The held-out protocol', 'El protocolo con datos reservados')} tone="warn" />
                </Figure>
                <Callout variant="honest" title={t('The forbidden shortcut', 'El atajo prohibido')}>
                  {t('Scoring the four fitted cases would give a near-perfect error and mean nothing: four points fit four coefficients. Only the held-out draw is reported.', 'Puntuar los cuatro casos ajustados daría un error casi perfecto y no significaría nada: cuatro puntos ajustan cuatro coeficientes. Sólo se informa el sorteo reservado.')}
                </Callout>
              </DocSection>
          </> },
          { id: 'datasets', label: t('Datasets', 'Datos'), content: <>
              <DocSection title={{ en: 'The datasets', es: 'Los conjuntos de datos' }} area="datasets" noRefsReason={{ en: 'Describes the data of this build.', es: 'Describe los datos de esta compilación.' }}>
                <P
                  en="There is no external dataset. Every case is a set of parameters written in the registry, and every number on the site is computed from them, so there is nothing to redistribute and nothing to license beyond the repository itself. A product that reads real data states its source, its redistribution class and its status here, in the same table."
                  es="No hay conjunto de datos externo. Cada caso es un conjunto de parámetros escrito en el registro, y cada número del sitio se calcula a partir de ellos, de modo que no hay nada que redistribuir ni licenciar más allá del propio repositorio. Un producto que lee datos reales declara aquí su fuente, su clase de redistribución y su estado, en la misma tabla."
                />
                <table className="caos-table" data-state="ready">
                  <thead>
                    <tr>
                      <th>{t('Data', 'Datos')}</th>
                      <th className="caos-col-text">{t('Origin', 'Origen')}</th>
                      <th className="caos-col-text">{t('Redistribution', 'Redistribución')}</th>
                      <th>{t('Status', 'Estado')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{t('Five cases', 'Cinco casos')}</td>
                      <td className="caos-col-text">{t('Synthetic parameters in the registry', 'Parámetros sintéticos en el registro')}</td>
                      <td className="caos-col-text">{t('Free: part of this repository', 'Libre: parte de este repositorio')}</td>
                      <td>{t('live', 'en vivo')}</td>
                    </tr>
                    <tr>
                      <td>{t('Twenty held-out sets', 'Veinte conjuntos reservados')}</td>
                      <td className="caos-col-text">{t('Seeded synthetic draw', 'Sorteo sintético con semilla')}</td>
                      <td className="caos-col-text">{t('Free: regenerated by the bake', 'Libre: se regenera en el precálculo')}</td>
                      <td>{t('live', 'en vivo')}</td>
                    </tr>
                    <tr>
                      <td>{t('Real outbreak records', 'Registros de brotes reales')}</td>
                      <td className="caos-col-text">{t('None used', 'Ninguno usado')}</td>
                      <td className="caos-col-text">{t('Not applicable', 'No aplica')}</td>
                      <td>{t('roadmap', 'hoja de ruta')}</td>
                    </tr>
                  </tbody>
                </table>
              </DocSection>
          </> },
        ]}
      />
    </DocPage>
  );
}
