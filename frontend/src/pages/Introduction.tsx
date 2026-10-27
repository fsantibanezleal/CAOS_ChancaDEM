import { DocPage, ExecutiveView, Tabs } from '@fasl-work/caos-app-shell';
import executive from '../../../content/executive.json';
import product from '../../../product.json';
import { useT } from '../content/bi';
import { Problem, Principles } from '../content/introduction/context';
import { Honesty } from '../content/introduction/honesty';
import { MathSection } from '../content/introduction/math';
import { Pipeline } from '../content/introduction/pipeline';

/** The Introduction has two views (problem-context-first): the executive view, first and the default, rendered by the shell
 *  from content/executive.json, and the technical view. The product writes the data file; it never designs the executive view. */
export function Introduction() {
  return <IntroductionPage data={executive} />;
}

export function IntroductionPage({ data }: { data: unknown }) {
  const t = useT();
  return (
    <DocPage
      title={{ en: 'Introduction', es: 'Introducción' }}
      lede={t(
        `${product.tagline.en} The executive view frames the problem space for a decision maker; the technical view gives the model, the pipeline and the limits of what the product proves.`,
        `${product.tagline.es} La vista ejecutiva enmarca el espacio del problema para quien decide; la vista técnica da el modelo, el pipeline y los límites de lo que el producto demuestra.`,
      )}
    >
      <Tabs
        ariaLabel={t('Introduction views', 'Vistas de la introducción')}
        tabs={[
          { id: 'executive', label: t('Executive', 'Ejecutiva'), content: <ExecutiveView data={data} base={import.meta.env.BASE_URL} /> },
          { id: 'technical', label: t('Technical', 'Técnica'), content: <TechnicalView /> },
        ]}
      />
    </DocPage>
  );
}

/** The technical view: the five areas of ADR-0017 section 2.1 in their order, each a text module in content/introduction/. */
export function TechnicalView() {
  return (
    <>
      <Problem />
      <Principles />
      <MathSection />
      <Pipeline />
      <Honesty />
    </>
  );
}
