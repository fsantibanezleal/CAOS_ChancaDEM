// The Methodology page's own references. The two print-only society papers below carry no link yet; the shell reports
// a reference without a DOI or URL, so unit U5 resolves each on a primary landing page or replaces it by the linked
// reference that reproduces the method (napiermunn1996, tavares2021).
import type { Citation } from '@fasl-work/caos-app-shell';

export const METHODOLOGY: Citation[] = [
  { id: 'narayanan1988', label: 'Narayanan & Whiten 1988', citation: 'Narayanan, S.S., Whiten, W.J. (1988). Determination of comminution characteristics from single-particle breakage tests and its application to ball-mill scale-up. Transactions of the Institution of Mining and Metallurgy, Section C 97, C115–C124. The t10–tn appearance-function family (pre-DOI; print-only society paper, no open landing page; the same family is reproduced with a link in napiermunn1996 and reviewed in tavares2021).' },
  { id: 'karra1982', label: 'Karra 1982', citation: 'Karra, V.K. (1982). A process performance model for cone crushers. Proceedings of the 14th International Mineral Processing Congress (IMPC), Toronto, paper III-6.1. The empirical cone-crusher capacity basis (pre-DOI; print-only conference paper, no open landing page). Note: the vibrating-screen model often cited alongside is a separate paper (Karra 1979, CIM Bulletin 72, 167–171) not used here.' },
];
