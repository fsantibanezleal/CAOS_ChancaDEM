// The Experiments page's own references: the two flow-model papers of Evertsson and of Lindqvist and Evertsson that the throw topic cites
// beside the one already in the shared core (evertsson1999). Both DOIs were resolved against doi.org and Crossref when they were added.
import type { Citation } from '@fasl-work/caos-app-shell';

export const EXPERIMENTS: Citation[] = [
  {
    id: 'evertsson1998',
    label: 'Evertsson 1998',
    citation: 'Evertsson, C.M. (1998). Output prediction of cone crushers. Minerals Engineering 11(3), 215-231. Cited with the two flow-model papers for the direction of the effect of the eccentric throw on the product at a fixed setting.',
    doi: '10.1016/S0892-6875(98)00001-6',
  },
  {
    id: 'lindqvist2004',
    label: 'Lindqvist & Evertsson 2004',
    citation: 'Lindqvist, M., Evertsson, C.M. (2004). Improved flow- and pressure model for cone crushers. Minerals Engineering 17(11-12), 1217-1225. Cited with the flow-model papers for the direction of the effect of the eccentric throw on the product at a fixed setting.',
    doi: '10.1016/j.mineng.2004.06.028',
  },
];
