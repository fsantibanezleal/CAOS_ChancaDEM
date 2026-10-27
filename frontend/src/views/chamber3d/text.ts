import type { BiText } from '@fasl-work/caos-app-shell';

export const TITLE: BiText = { en: '3D crusher chamber', es: 'Cámara de chancado en 3D' };

// Neutral Spanish. The 3D is justified by the geometry: the chamber is a surface of revolution whose nip and gap
// change around the mantle (conventions/interactive-visualization-rubric.md).
export const NOTE: BiText = {
  en: "A kinematic view of the chamber's geometry and motion, with rocks sized and coloured from the engine's gradation; it is not a particle simulation. It is drawn in 3D because the chamber is a surface of revolution whose nip and gap change around the mantle (the jaw is drawn as its two plates).",
  es: 'Vista cinemática de la geometría y el movimiento de la cámara, con rocas dimensionadas y coloreadas según la granulometría del motor; no es una simulación de partículas. Se dibuja en 3D porque la cámara es una superficie de revolución cuyo ángulo de mordida y cuya abertura cambian alrededor del manto (la mandíbula se dibuja como sus dos placas).',
};

export const UNAVAILABLE: BiText = {
  en: 'WebGL is not available in this browser, so the chamber cannot be drawn.',
  es: 'WebGL no está disponible en este navegador, por lo que no se puede dibujar la cámara.',
};

export const STAGE_LABEL: BiText = { en: '3D crusher chamber drawing', es: 'Dibujo 3D de la cámara de chancado' };
export const CANVAS_LABEL: BiText = {
  en: 'Three-dimensional view of the crusher chamber. Drag to orbit, arrow keys to pan, scroll to zoom.',
  es: 'Vista tridimensional de la cámara de chancado. Arrastre para orbitar, flechas para desplazar, rueda para acercar.',
};
export const CONTROLS_LABEL: BiText = { en: 'Chamber view controls', es: 'Controles de la vista de la cámara' };

export const PLAY: BiText = { en: 'Play', es: 'Reproducir' };
export const PAUSE: BiText = { en: 'Pause', es: 'Pausar' };
export const PLAY_HINT: BiText = { en: 'Start or stop the motion of the chamber and the rocks', es: 'Inicia o detiene el movimiento de la cámara y las rocas' };
export const REDUCED: BiText = {
  en: 'Motion is off because your system asks for reduced motion; the chamber is shown still.',
  es: 'El movimiento está desactivado porque su sistema pide reducir el movimiento; la cámara se muestra quieta.',
};

export const SPEED: BiText = { en: 'Animation speed', es: 'Velocidad de animación' };
export const SPEED_HINT: BiText = {
  en: 'Animation speed, 0.25 to 4 times the natural rate of the drawing',
  es: 'Velocidad de animación, de 0,25 a 4 veces el ritmo natural del dibujo',
};
export const ROCK: BiText = { en: 'Rock size', es: 'Tamaño de roca' };
export const ROCK_HINT: BiText = {
  en: 'Rock size, 0.5 to 2.5 times the drawn size (display only, the engine is unchanged)',
  es: 'Tamaño de roca, de 0,5 a 2,5 veces el tamaño dibujado (solo visual, el motor no cambia)',
};
export const FRACTURE: BiText = { en: 'Fracture', es: 'Fractura' };
export const FRACTURE_HINT: BiText = {
  en: 'Fracture on or off: a crushed rock shatters into shards or only shrinks',
  es: 'Fractura activada o desactivada: la roca chancada se rompe en fragmentos o solo se reduce',
};
export const RESET: BiText = { en: 'Reset view', es: 'Restablecer vista' };
export const RESET_HINT: BiText = {
  en: 'Fit the whole chamber in the view again',
  es: 'Vuelve a encuadrar la cámara completa en la vista',
};
export const TIMES: BiText = { en: 'times', es: 'veces' };
