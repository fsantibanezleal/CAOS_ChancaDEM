// The Methodology page's own references. The page cites only references of the shared core (citations/core.ts), each with a
// DOI or a URL. Two print-only society papers were listed here with no link: Narayanan and Whiten 1988 (Trans. IMM Section C)
// and Karra 1982 (14th IMPC). A search for a publisher or society landing page found none that could be opened (the one
// public record, on ResearchGate, answers 403), so both entries are removed and the page cites the linked references that
// reproduce the methods: napiermunn1996 and tavares2021 for the t10 appearance family, evertsson2000 for the capacity basis.
import type { Citation } from '@fasl-work/caos-app-shell';

export const METHODOLOGY: Citation[] = [
  {
    id: 'gmsg2016',
    label: 'GMSG, Morrell method guideline',
    citation:
      'Global Mining Standards and Guidelines Group. Morrell Method for Determining Comminution Circuit Specific Energy and Assessing Energy Utilization Efficiency of Existing Circuits. Annex B, section B.2.2 (conventional crushers), equations B4 and B5. The size-specific energy and the hardness parameter S_c as the guideline prints them (open PDF).',
    url: 'https://www.smctesting.com/documents/Morrell_method_for_determining_comminution_circuit_specific_energy_and_assessing_energy_utilization_efficiency_of_existing_circuits.pdf',
  },
  {
    id: 'kennedy2001',
    label: 'Kennedy & O’Hagan 2001',
    citation: 'Kennedy, M.C., O’Hagan, A. (2001). Bayesian calibration of computer models. Journal of the Royal Statistical Society: Series B 63(3), 425–464. The calibration of a simulator with a model-form discrepancy term.',
    doi: '10.1111/1467-9868.00294',
  },
  {
    id: 'terbraak2006',
    label: 'ter Braak 2006',
    citation: 'ter Braak, C.J.F. (2006). A Markov Chain Monte Carlo version of the genetic algorithm Differential Evolution: easy Bayesian computing for real parameter spaces. Statistics and Computing 16, 239-249.',
    doi: '10.1007/s11222-006-8769-1',
  },
  {
    id: 'terbraak2008',
    label: 'ter Braak & Vrugt 2008',
    citation: 'ter Braak, C.J.F., Vrugt, J.A. (2008). Differential Evolution Markov Chain with snooker updater and fewer chains. Statistics and Computing 18, 435-446.',
    doi: '10.1007/s11222-008-9104-9',
  },
  {
    id: 'foremanmackey2013',
    label: 'Foreman-Mackey et al. 2013',
    citation: 'Foreman-Mackey, D., Hogg, D.W., Lang, D., Goodman, J. (2013). emcee: The MCMC Hammer. Publications of the Astronomical Society of the Pacific 125, 306–312. The package that implements the ensemble sampler used by the calibration.',
    doi: '10.1086/670067',
  },
];
