// The old route /focus/<machine> (release 0.09.003 had a Focus page of its own per machine) forwards to the App in Focus mode, on the
// first case of that machine in the index: /app?case=<id>&focus=1. Focus is now the workbench's (ADR-0070, shell 0.14.0), so the case,
// the group and the sub-view are the App's and the link keeps them. A machine the index has no case of, an unreadable index or an
// unknown machine land on the App in Focus mode at its default case.
import { Navigate, useParams } from 'react-router';
import { useShellLang } from '@fasl-work/caos-app-shell';
import { loadIndex, loadManifest, useArtifact } from '../api/artifacts';
import type { CaseIndex } from '../lib/contract.types';

/** The case ids of the index in its order, with the machine each manifest says; a manifest that cannot be read is skipped. */
async function firstCaseOf(index: CaseIndex, machine: string, signal: AbortSignal): Promise<string | null> {
  const machines = await Promise.all(
    index.cases.map((c) =>
      loadManifest(c.case_id, signal).then(
        (m) => m.params.machine as string,
        () => null,
      ),
    ),
  );
  const at = machines.findIndex((m) => m === machine);
  return at < 0 ? null : index.cases[at].case_id;
}

export function FocusForward() {
  const lang = useShellLang();
  const { machine = '' } = useParams();
  const target = useArtifact(async (signal) => {
    const index = await loadIndex(signal);
    return firstCaseOf(index, machine, signal);
  }, [machine]);
  if (target.state === 'loading') {
    return (
      <p className="caos-pending" data-state="loading" role="status">
        {lang === 'es' ? 'Abriendo el modo enfoque' : 'Opening focus mode'}
      </p>
    );
  }
  const id = target.state === 'ready' ? target.data : null;
  return <Navigate replace to={id ? `/app?case=${encodeURIComponent(id)}&focus=1` : '/app?focus=1'} />;
}
