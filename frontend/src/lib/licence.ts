// A licence name in the reader's language. Spanish writes no decimal point in a version number (the gate's G11), so
// `CC BY 4.0` reads `CC BY, versión 4`; English keeps the name as the source records it.

/** A licence name as Spanish writes it: `CC BY 4.0` reads `CC BY, versión 4`. */
export function licenceEs(name: string): string {
  const m = /^(.*?)\s*(\d+)\.0$/.exec(name);
  return m ? `${m[1]}, versión ${m[2]}` : name.replace('.', ',');
}

/** The licence name for a language: unchanged in English, without a decimal point in Spanish. */
export function licenceIn(name: string, lang: 'en' | 'es'): string {
  return lang === 'es' ? licenceEs(name) : name;
}

/** The citation of a source without the DOI URL and the licence it ends with, when the page prints both beside it. */
export function citationBody(citation: string, doi: string, license: string): string {
  let s = citation.trim();
  const tail = `(${license}).`;
  if (s.endsWith(tail)) s = s.slice(0, -tail.length).trim();
  const url = `https://doi.org/${doi}`;
  if (s.endsWith(url)) s = s.slice(0, -url.length).trim();
  return s;
}
