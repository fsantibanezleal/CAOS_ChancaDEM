// Area 5 of the Introduction's technical view: what is exact, what is calibrated, what is illustrative, what the learned models
// emulate, what the 3D view is, and what the product is not. It carries no model metric: the learned models are retrained in
// each release and their held-out figures are stated on the Benchmark page, read from the committed metrics.
import { Callout, DocSection } from '@fasl-work/caos-app-shell';
import product from '../../../../product.json';
import { P, useT } from '../bi';

const REPORT = product.manuscripts[0];

export function Honesty() {
  const t = useT();
  return (
    <DocSection title={{ en: 'What is exact and what is not', es: 'Qué es exacto y qué no' }} area="honesty" noRefsReason={{ en: 'States the limits of this product.', es: 'Declara los límites de este producto.' }}>
      <P
        en="The exact part is arithmetic: the TypeScript engine reproduces the Python engine at 121 reference operating points to 1e-9 relative, and the engine meets closed forms that do not depend on its numerics (the Rosin-Rammler passing at x63 equals 1 - 1/e, the Bond energy of a reduction from F80 to P80, and the mass of every baked product equal to the feed within the solver closure). What is calibrated is one lane: the HP500 secondary cone on one ore, itabirite at Minas Rio, fitted inside a closed-side setting of 38 to 55 mm and a feed f80 of 47 to 140 mm; outside that support the engine flags the reading as extrapolation instead of answering with a confident number."
        es="La parte exacta es aritmética: el motor en TypeScript reproduce al motor en Python en 121 puntos de operación de referencia a 1e-9 relativo, y el motor cumple formas cerradas que no dependen de su numérica (el pasante de Rosin-Rammler en x63 es igual a 1 - 1/e, la energía de Bond de una reducción de F80 a P80, y la masa de cada producto calculado igual a la de la alimentación dentro del cierre del solucionador). Lo calibrado es un solo carril: el cono secundario HP500 con un solo mineral, la itabirita de Minas Rio, ajustado dentro de un lado cerrado de 38 a 55 mm y un f80 de alimentación de 47 a 140 mm; fuera de ese soporte el motor marca la lectura como extrapolación en vez de responder con un número confiado."
      />
      <P
        en="What is illustrative is everything else: the constants of the synthetic machines (the classification windows, the reference capacities and speeds, the nip geometry and the energy per nip) reproduce the direction of each effect, a tighter setting giving a finer product and a wider throw a coarser one, and not the absolute numbers of a plant. The two learned models, a surrogate network and a denoising autoencoder, emulate the engine and not a plant, and every learned view says which model answered. The 3D chamber is a kinematic view of the geometry, the motion and the gradation the engine computes, and it is not a discrete-element simulation, which needs hours of computing per second of operation and runs offline."
        es="Lo ilustrativo es todo lo demás: las constantes de las máquinas sintéticas (las ventanas de clasificación, las capacidades y velocidades de referencia, la geometría de mordida y la energía por mordida) reproducen el sentido de cada efecto, un ajuste más cerrado que da un producto más fino y una carrera mayor que da uno más grueso, y no los números absolutos de una planta. Los dos modelos aprendidos, una red sustituta y un autoencoder de eliminación de ruido, emulan al motor y no a una planta, y cada vista aprendida dice qué modelo respondió. La cámara 3D es una vista cinemática de la geometría, el movimiento y la gradación que calcula el motor, y no es una simulación de elementos discretos, que necesita horas de cómputo por segundo de operación y corre fuera de línea."
      />
      <p>
        {t('The technical report of this product, with the methods and the numbers of each release: ', 'El informe técnico de este producto, con los métodos y las cifras de cada versión: ')}
        <a href={`https://doi.org/${REPORT.concept_doi}`} rel="noopener noreferrer" data-report-doi={REPORT.concept_doi}>
          doi:{REPORT.concept_doi}
        </a>
        {t(' (the concept DOI, which always resolves to the latest version).', ' (el DOI de concepto, que siempre lleva a la última versión).')}
      </p>
      <Callout variant="honest" title={t('Not a sizing tool, a digital twin or a grinding model', 'No es una herramienta de dimensionamiento, un gemelo digital ni un modelo de molienda')}>
        {t(
          'ChancaDEM does not select or size a crusher, does not mirror a measured plant, and stops at the crusher product: grinding and SAG milling are another product. A reading is a model output for the case shown, labelled with its lane and its data, and the measured value is shown beside it wherever one exists.',
          'ChancaDEM no selecciona ni dimensiona un chancador, no replica una planta medida, y se detiene en el producto del chancador: la molienda y la molienda SAG son otro producto. Una lectura es una salida del modelo para el caso mostrado, rotulada con su carril y sus datos, y el valor medido se muestra a su lado donde existe.',
        )}
      </Callout>
    </DocSection>
  );
}
