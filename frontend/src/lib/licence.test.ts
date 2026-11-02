import { describe, expect, it } from 'vitest';
import { citationBody, licenceEs, licenceIn } from './licence';

describe('the licence name in the reader language', () => {
  it('writes CC BY 4.0 without a decimal point in Spanish and unchanged in English', () => {
    expect(licenceEs('CC BY 4.0')).toBe('CC BY, versión 4');
    expect(licenceIn('CC BY 4.0', 'es')).toBe('CC BY, versión 4');
    expect(licenceIn('CC BY 4.0', 'en')).toBe('CC BY 4.0');
  });
  it('adversarial: a version that is not an integer keeps its digits with a decimal comma, never a point', () => {
    expect(licenceEs('CC BY-SA 2.5')).toBe('CC BY-SA 2,5');
    expect(licenceEs('MIT')).toBe('MIT');
  });
});

describe('the citation body', () => {
  const c = 'Rocha, B.K.N.d.; Campos, T.M.; Silva, J.; Tavares, L.M. Fit-for-Purpose Model of HP500 Cone Crusher in Size Reduction of Itabirite Iron Ore. Minerals 2024, 14(9), 919. https://doi.org/10.3390/min14090919 (CC BY 4.0).';
  it('drops the DOI URL and the licence the page prints beside it', () => {
    expect(citationBody(c, '10.3390/min14090919', 'CC BY 4.0')).toBe(
      'Rocha, B.K.N.d.; Campos, T.M.; Silva, J.; Tavares, L.M. Fit-for-Purpose Model of HP500 Cone Crusher in Size Reduction of Itabirite Iron Ore. Minerals 2024, 14(9), 919.',
    );
  });
  it('adversarial: a citation that carries neither is unchanged', () => {
    expect(citationBody('A. Author. Title. 2020.', '10.1/x', 'CC BY 4.0')).toBe('A. Author. Title. 2020.');
  });
});
