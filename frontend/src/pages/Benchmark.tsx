// The Benchmark page. Unit U8 rewrites it for the crusher (the held-out evaluation of the two models, the CrusherCal validation, the
// engine timed in this browser). Until then the sections that read the template example's SIR engine and its old contract shapes
// are removed (unit U2b-1), so the build holds; the page keeps its frame and its caveat.
import { Callout, DocPage, DocSection } from '@fasl-work/caos-app-shell';
import { useT } from '../content/bi';

export function Benchmark() {
  const t = useT();
  return (
    <DocPage wide title={{ en: 'Benchmark', es: 'Benchmark' }} lede={t('What each case costs and how well the models do, baked and live: the budgets of the live lane, the held-out error of the learned surrogate, its comparison with the analytic baseline, where that baseline degrades, and a panel that runs the engine in your browser.', 'Lo que cuesta cada caso y cuán bien lo hacen los modelos, precalculado y en vivo: los presupuestos del carril en vivo, el error reservado del sustituto aprendido, su comparación con la línea base analítica, dónde se degrada esa línea base, y un panel que corre el motor en su navegador.')}>
      <DocSection title={{ en: 'What this benchmark does not show', es: 'Lo que este benchmark no muestra' }} area="caveat" noRefsReason={{ en: 'States the limits of this page.', es: 'Declara los límites de esta página.' }}>
        <Callout variant="honest" title={t('A comparison of two models of the same model', 'Una comparación de dos modelos del mismo modelo')}>
          {t('The truth on this page is the example engine, not an outbreak. The tables say how well a formula and a fitted curve imitate it, on synthetic cases; they say nothing about accuracy on a real epidemic, and the timings are those of this device only.', 'La verdad en esta página es el motor del ejemplo, no un brote. Las tablas dicen cuán bien lo imitan una fórmula y una curva ajustada, en casos sintéticos; no dicen nada sobre la exactitud en una epidemia real, y los tiempos son sólo los de este dispositivo.')}
        </Callout>
      </DocSection>
    </DocPage>
  );
}
