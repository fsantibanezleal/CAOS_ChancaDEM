// Small pieces shared by the topics of the Implementation page: the reason a section cites nothing, an ordered list of
// bilingual steps, and a block of commands. The prose helpers (P, L, useT) are the product's own, in ../bi.
import { useShellLang } from '@fasl-work/caos-app-shell';
import type { ReactNode } from 'react';

/** The stated reason of a section that cites no reference: it describes this repository, not a published method. */
export const THIS_REPO = { en: 'Describes this repository.', es: 'Describe este repositorio.' };

/** An ordered list, step by step in the current language. */
export function Steps({ items }: { items: { en: ReactNode; es: ReactNode }[] }) {
  const lang = useShellLang();
  return (
    <ol>
      {items.map((it, i) => (
        <li key={i}>{lang === 'es' ? it.es : it.en}</li>
      ))}
    </ol>
  );
}

/** Commands a reader runs, one per line, in a code block. */
export function Commands({ lines }: { lines: string[] }) {
  return (
    <pre>
      <code>{lines.join('\n')}</code>
    </pre>
  );
}
