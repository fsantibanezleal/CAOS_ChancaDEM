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
  {
    id: 'barrios2020',
    label: 'Barrios et al. 2020',
    citation:
      'Barrios, G.K., Jimenez-Herrera, N., Fuentes-Torres, S.N., Tavares, L.M. (2020). DEM Simulation of Laboratory-Scale Jaw Crushing of a Gold-Bearing Ore Using a Particle Replacement Model. Minerals 10(8), 717. Open access (CC BY 4.0): the laboratory jaw crusher (Table 2), its materials and contacts (Tables 3 and 4), the single-particle tests (Fig. 6) and the measured throughput, net power and product of three narrow feed classes (Figs. 7, 12 to 14).',
    doi: '10.3390/min10080717',
  },
  {
    id: 'crushdem',
    label: 'crushdem 0.6.0',
    citation:
      'crushdem 0.6.0: a soft-sphere discrete element method for crushers, with Hertz-Mindlin contacts, the Tavares breakage model with t10 progeny and replacement, and a numba CPU reference. Python Package Index (the particle engine of the particle simulation; a separate repository).',
    url: 'https://pypi.org/project/crushdem/0.6.0/',
  },
  {
    id: 'sastri1994',
    label: 'Sastri 1994',
    citation:
      'Sastri, S.R.S. (1994). Capacities and performance characteristics of jaw crushers. Minerals and Metallurgical Processing, May 1994, 80-85 (SME preprint 92-650). The jaw capacity model, equations 2 to 13 (pre-DOI; open PDF).',
    url: 'https://www.911metallurgist.com/wp-content/uploads/2016/02/Capacities-and-Sizing-of-jaw-crushers.pdf',
  },
  {
    id: 'king2000',
    label: 'King 2000',
    citation:
      'King, R.P. (2000). Technical Notes 5, Crushers. Equations 5.8 to 5.10, pages 5-4 and 5-5: the classification parameters proportional to the closed-side setting, with the ranges the notes give for Symons cone crushers (open PDF).',
    url: 'https://www.911metallurgist.com/wp-content/uploads/2017/04/Crushers.pdf',
  },
  {
    id: 'donovan2003',
    label: 'Donovan 2003',
    citation:
      'Donovan, J.G. (2003). Fracture Toughness Based Models for the Prediction of Power Consumption, Product Size, and Capacity of Jaw Crushers. PhD thesis, Virginia Tech. Section 2.1.3: the first estimate of the classification parameters (open access).',
    url: 'https://vtechworks.lib.vt.edu/handle/10919/28544',
  },
];
