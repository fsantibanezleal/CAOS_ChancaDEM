import { useLangStore } from '@fasl-work/caos-app-shell';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { Operating } from '../../engine/types';
import { ChamberView } from './index';

const OP: Operating = { machine: 'cone-sec', cssMm: 20, throwMm: 24, speedRpm: 240, feedX63Mm: 80, feedM: 1.4, oreAxb: 45, oreWi: 14 };
const html = () => renderToString(<ChamberView op={OP} p80Mm={12} f80Mm={80} provenance="synthetic" />);
// renderToString reads the store's initial state (zustand's server snapshot), so the language is set there
const setLang = (lang: 'en' | 'es') => {
  Object.assign(useLangStore.getInitialState(), { lang });
  useLangStore.setState({ lang });
};
afterEach(() => setLang('en'));

describe('ChamberView', () => {
  it('is one filling live card with the given provenance and the honesty note', () => {
    const h = html();
    expect(h).toContain('data-plot="3D crusher chamber"');
    expect(h).toContain('data-lane="live"');
    expect(h).toContain('data-provenance="synthetic"');
    expect(h).toContain('caos-plot fill');
    expect(h).toContain('not a particle simulation');
    expect(h).toContain('surface of revolution');
  });
  it('starts paused: the control offers Play', () => {
    const h = html();
    expect(h).toContain('>Play<');
    expect(h).not.toContain('>Pause<');
  });
  it('keeps every control of the shipped view, each with an accessible name and a tooltip with its unit', () => {
    const h = html();
    for (const name of ['Animation speed', 'Rock size', 'Fracture', 'Reset view']) expect(h).toContain(name);
    expect(h).toMatch(/title="Animation speed[^"]*times/);
    expect(h).toMatch(/title="Rock size[^"]*times/);
    expect(h).toContain('aria-pressed="true"');
    expect(h).toContain('type="range"');
  });
  it('registers none of them as an instrument control (they are view-local)', () => {
    expect(html()).not.toContain('data-control');
  });
  it('speaks Spanish with its accents', () => {
    setLang('es');
    const h = html();
    expect(h).toContain('Cámara de chancado en 3D');
    expect(h).toContain('Velocidad de animación');
    expect(h).toContain('Restablecer vista');
    expect(h).toContain('no es una simulación de partículas');
  });
  it('uses no viewport unit, hex colour, em-dash or arrow in its markup', () => {
    const h = html();
    expect(h).not.toMatch(/\dvh|#[0-9a-fA-F]{6}/);
    expect(h).not.toContain(String.fromCharCode(0x2014));
    expect(h).not.toContain(String.fromCharCode(0x2192));
  });
});
