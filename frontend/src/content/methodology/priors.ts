// The source column of the CrusherBayes priors table in the reader's language. The committed document (hp500/crusherbayes.json,
// `priors[].source`) writes each source in English with its numbers; the page shows it unchanged in English and, in Spanish, through
// the translation table below keyed by the prior's name. A template holds no number of its own: `{i}` is the i-th number of the
// document's text (URLs removed), formatted by the locale, and `{url}` the document's URL, kept verbatim. A source the table does not
// know, or whose numbers no longer match its template, is shown as the document writes it with its numbers localized, so a Spanish
// page never prints a decimal point.

/** A formatter of one number with a fixed count of decimals in the reader's language (the shell's `formatNumber`, no grouping). */
export type NumberFormatter = (value: number, decimals: number) => string;

const URL_RE = /https?:\/\/[^\s,;()]+/g;
// a number standing alone: not part of a word (K1, f80, t10, HP500_ORE) and not a piece of a longer dotted token
const NUMBER_RE = /(?<![\w.])\d+(?:\.\d+)?(?![\w.]?\d)/g;
const URL_MARK = '\u0000';

/** The URLs of a source and its numbers in reading order, the URLs removed first so a DOI gives no number. */
export function sourceNumbers(source: string): { urls: string[]; numbers: string[] } {
  const urls = source.match(URL_RE) ?? [];
  const numbers = source.replace(URL_RE, URL_MARK).match(NUMBER_RE) ?? [];
  return { urls, numbers };
}

const decimalsOf = (token: string) => (token.includes('.') ? token.split('.')[1].length : 0);
// an integer (a year, a table, a count) is written as the document writes it; a decimal goes through the locale
const localize = (token: string, fmt: NumberFormatter) => (token.includes('.') ? fmt(Number(token), decimalsOf(token)) : token);

/** The Spanish source of each prior of hp500-crusherbayes 1.0.0, keyed by `priors[].name`. */
export const PRIOR_SOURCE_ES: Record<string, string> = {
  q_ref_tph:
    'nominal: Rocha et al. {0}, {url}, Tabla {1} (QT de unas {2} t/h); ancho: débilmente informativo, una desviación estándar logarítmica de {3} (más o menos {4} por ciento); los muestreos van de {5} a {6} t/h',
  wi_kwh_t:
    'nominal: el Wi de la mezcla del motor; las bandas de itabirita compacta y supercompacta son {0} y {1} kWh/t (Rocha et al. {2}, {url}, Tabla {3}, como HP500_ORE); ancho: débilmente informativo, una desviación estándar logarítmica de {4} (más o menos {5} por ciento, {6} a {7} kWh/t)',
  zeta: 'nominal: la pendiente de Pc = zeta Pd + Pn, Rocha et al. {0}, {url}, Tabla {1}; ancho: débilmente informativo, una desviación estándar logarítmica de {2} (más o menos {3} por ciento)',
  pn_kw:
    'nominal: la potencia en vacío de Pc = zeta Pd + Pn, Rocha et al. {0}, {url}, Tabla {1}; ancho: débilmente informativo, desviación estándar de {2} kW; la potencia medida va de {3} a {4} kW',
  k1_scale: 'multiplicador de K1 = {0} CSS + {1} f80 (Rocha et al. {2}, {url}, Tabla {3}); ancho: una desviación estándar logarítmica de {4} (más o menos {5} por ciento)',
  k2_scale: 'multiplicador de K2 = {0} + {1} CSS + {2} f80 (Rocha et al. {3}, {url}, Tabla {4}); ancho: una desviación estándar logarítmica de {5}',
  k3: 'nominal: Rocha et al. {0}, {url}, Tabla {1}; el K3 típico de los modelos de cono del motor va de {2} a {3} (Napier-Munn et al. {4}, Mineral Comminution Circuits, JKMRC); ancho: desviación estándar de {5}',
  t10_shift_pct:
    'desplazamiento de la constante {0} de t10 (%) = {1} - {2} CSS - {3} f80 (Rocha et al. {4}, {url}, Tabla {5}); ancho: desviación estándar de {6} puntos de t10 (el motor limita t10 a {7} por ciento)',
};

const UNIT_ES: Record<string, string> = { 't10 percentage points': 'puntos porcentuales de t10' };

/** The unit of a prior in the reader's language: a unit with words is translated, a symbol stays. */
export function priorUnit(unit: string, lang: 'en' | 'es'): string {
  return lang === 'es' ? (UNIT_ES[unit] ?? unit) : unit;
}

/** The source of one prior in the reader's language, every number from the document's own text. */
export function priorSource(name: string, source: string, lang: 'en' | 'es', fmt: NumberFormatter): string {
  if (lang !== 'es') return source;
  const { urls, numbers } = sourceNumbers(source);
  const tpl = PRIOR_SOURCE_ES[name];
  const slots = tpl ? [...tpl.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])) : [];
  const urlSlots = tpl ? (tpl.match(/\{url\}/g) ?? []).length : 0;
  const fits = tpl && urlSlots === urls.length && new Set(slots).size === numbers.length && slots.every((i) => i < numbers.length);
  if (fits) {
    let u = 0;
    return tpl.replace(/\{(\d+|url)\}/g, (_, k: string) => (k === 'url' ? urls[u++] : localize(numbers[Number(k)], fmt)));
  }
  // the fallback: the document's own text, its decimals localized and its URLs untouched
  let u = 0;
  return source
    .replace(URL_RE, URL_MARK)
    .replace(NUMBER_RE, (tok) => localize(tok, fmt))
    .replace(new RegExp(URL_MARK, 'g'), () => urls[u++]);
}
