import { type Citation } from '@fasl-work/caos-app-shell';

// DOI-verified references. The adversarial research pass corrected several venues/DOIs and flagged a
// phantom-author citation ("Bhuiyan 2021" does not exist — the real industrial-calibration source is Duarte
// et al. 2021). Citations without a DOI are pre-DOI-era articles, theses or handbooks (text only, never a
// fabricated link).
export const CITATIONS: Citation[] = [
  // --- crusher modelling (population balance) ---
  { id: 'whiten1972', label: 'Whiten 1972', citation: 'Whiten, W.J. (1972). The simulation of crushing plants with models developed using multiple spline regression. Journal of the South African Institute of Mining and Metallurgy 72(10), 257–264. Origin of the classification–breakage crusher model p = (I − C)(I − B·C)⁻¹·f (no DOI; pre-DOI era).' },
  { id: 'narayanan1988', label: 'Narayanan & Whiten 1988', citation: 'Narayanan, S.S., Whiten, W.J. (1988). Determination of comminution characteristics from single-particle breakage tests and its application to ball-mill scale-up. Transactions of the Institution of Mining and Metallurgy, Section C 97, C115–C124. The t10–tn appearance-function family.' },
  { id: 'andersen1988', label: 'Andersen & Napier-Munn 1988', citation: 'Andersen, J.S., Napier-Munn, T.J. (1988). Power prediction for cone crushers. Proc. 3rd Mill Operators’ Conference, AusIMM, 103–109. The K1/K2/K3 classification parameterization.' },
  { id: 'napiermunn1996', label: 'Napier-Munn et al. 1996', citation: 'Napier-Munn, T.J., Morrell, S., Morrison, R.D., Kojovic, T. (1996). Mineral Comminution Circuits: Their Operation and Optimisation. JKMRC Monograph Series, Univ. of Queensland. ISBN 978-0646288611. The reference text for the crusher/appearance models implemented here.' },
  { id: 'austin1984', label: 'Austin, Klimpel & Luckie 1984', citation: 'Austin, L.G., Klimpel, R.R., Luckie, P.T. (1984). Process Engineering of Size Reduction: Ball Milling. SME-AIME. The cumulative breakage distribution function B(u)=Φ·u^γ+(1−Φ)·u^β used for progeny shape.' },
  { id: 'karra1982', label: 'Karra 1982', citation: 'Karra, V.K. (1982). Development of a model for predicting the screening performance of a vibrating screen, and a capacity model for cone crushers. Proc. 14th International Mineral Processing Congress (IMPC), Toronto. Empirical cone-crusher capacity basis.' },
  // --- crusher physics / capacity / energy ---
  { id: 'evertsson2000', label: 'Evertsson 2000', citation: 'Evertsson, C.M. (2000). Cone Crusher Performance. PhD thesis, Chalmers University of Technology, Göteborg. ISBN 91-7197-856-7. The flow + size-reduction model behind the capacity hump.' },
  { id: 'quist2016', label: 'Quist & Evertsson 2016', citation: 'Quist, J., Evertsson, C.M. (2016). Cone crusher modelling and simulation using DEM. Minerals Engineering 85, 92–105.', doi: '10.1016/j.mineng.2015.11.004' },
  { id: 'bengtsson2017', label: 'Bengtsson et al. 2017', citation: 'Bengtsson, M., Hulthén, E., Evertsson, C.M. (2017). Size and shape simulation in a tertiary crushing stage, a multi-objective perspective. Minerals Engineering 100, 36–43.', doi: '10.1016/j.mineng.2016.10.014' },
  { id: 'bond1952', label: 'Bond 1952', citation: 'Bond, F.C. (1952). The third theory of comminution. Transactions AIME 193, 484–494. W = 10·Wi·(1/√P80 − 1/√F80) (no DOI; pre-DOI era).' },
  { id: 'morrell2009', label: 'Morrell 2009', citation: 'Morrell, S. (2009). Predicting the overall specific energy requirement of crushing, high pressure grinding roll and tumbling mill circuits. Minerals Engineering 22(6), 544–549. The Mic size-specific-energy alternative to Bond.', doi: '10.1016/j.mineng.2009.01.005' },
  { id: 'rosin1933', label: 'Rosin & Rammler 1933', citation: 'Rosin, P., Rammler, E. (1933). The laws governing the fineness of powdered coal. Journal of the Institute of Fuel 7, 29–36. The R(x)=1−exp[−(x/x63)^m] feed model (no DOI; pre-DOI era).' },
  { id: 'duarte2021', label: 'Duarte et al. 2021', citation: 'Duarte, R.A., Yamashita, A.S., da Silva, M.T., Cota, L.P., Euzébio, T.A.M. (2021). Calibration and validation of a cone crusher model with industrial data. Minerals 11(11), 1256. Open-access industrial-calibration anchor (CC-BY).', doi: '10.3390/min11111256' },
  // --- DEM particle mechanics (the offline solver basis) ---
  { id: 'cundall1979', label: 'Cundall & Strack 1979', citation: 'Cundall, P.A., Strack, O.D.L. (1979). A discrete numerical model for granular assemblies. Géotechnique 29(1), 47–65. The linear spring-dashpot contact baseline.', doi: '10.1680/geot.1979.29.1.47' },
  { id: 'mindlin1949', label: 'Mindlin 1949', citation: 'Mindlin, R.D. (1949). Compliance of elastic bodies in contact. Journal of Applied Mechanics 16(3), 259–268. Tangential contact stiffness.', doi: '10.1115/1.4009973' },
  { id: 'tsuji1992', label: 'Tsuji et al. 1992', citation: 'Tsuji, Y., Tanaka, T., Ishida, T. (1992). Lagrangian numerical simulation of plug flow of cohesionless particles in a horizontal pipe. Powder Technology 71(3), 239–250. Restitution-based contact damping.', doi: '10.1016/0032-5910(92)88030-L' },
  { id: 'cleary2009', label: 'Cleary 2009', citation: 'Cleary, P.W. (2009). Industrial particle flow modelling using discrete element method. Engineering Computations 26(6), 698–743. DEM for comminution equipment.', doi: '10.1108/02644400910975487' },
  { id: 'tavares2021', label: 'Tavares 2022', citation: 'Tavares, L.M. (2022). Review and further validation of a practical single-particle breakage model. KONA Powder and Particle Journal 39, 62–83. Particle-replacement (PRM) progeny families.', doi: '10.14356/kona.2022012' },
];
