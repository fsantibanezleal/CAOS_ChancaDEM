// The scene's colours, read from the shell's tokens (a WebGL renderer cannot read CSS variables). Read at mount and
// again on a theme change; there is no colour literal here.
import { Color } from 'three';
import { resolveToken } from '@fasl-work/caos-app-shell';

export interface ScenePalette {
  /** Rock ramp, coarse to fine. */
  ramp: Color[];
  concave: Color;
  mantle: Color;
  plateFixed: Color;
  plateSwing: Color;
  eccentric: Color;
  ambient: number;
}

type Resolve = (token: string) => string;

function token(resolve: Resolve, name: string): Color {
  const v = resolve(name);
  // a token that is not there (a non-browser run) reads as a neutral grey, never as black on a dark card
  if (!v) return new Color(0.5, 0.5, 0.5);
  try {
    return new Color(v);
  } catch {
    return new Color(0.5, 0.5, 0.5);
  }
}

export function readPalette(theme: 'light' | 'dark', resolve: Resolve = (t) => resolveToken(t)): ScenePalette {
  return {
    ramp: [token(resolve, '--color-warn'), token(resolve, '--color-accent-2'), token(resolve, '--color-accent')],
    concave: token(resolve, '--color-fg-faint'),
    mantle: token(resolve, '--color-good'),
    plateFixed: token(resolve, '--color-fg-subtle'),
    plateSwing: token(resolve, '--color-good'),
    eccentric: token(resolve, '--color-warn'),
    ambient: theme === 'dark' ? 0.7 : 0.9,
  };
}
