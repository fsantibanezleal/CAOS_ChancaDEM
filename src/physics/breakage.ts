// The breakage (appearance) function B: how a particle that IS broken distributes its mass over finer sizes.
// Two cited models are composed:
//
//  1. ENERGY → FINENESS (JKMRC drop-weight, Narayanan & Whiten 1988): t10 = A·(1 − exp(−b·Ecs)), where t10 is
//     the % of progeny passing 1/10 of the parent size, Ecs the specific comminution energy [kWh/t], and A,b
//     the ore-competence parameters (their product A·b is the standard single-number hardness index).
//
//  2. PROGENY SHAPE (Austin, Klimpel & Luckie 1984, "Process Engineering of Size Reduction"): the cumulative
//     breakage distribution B(u) = Φ·u^γ + (1−Φ)·u^β for relative size u = x/y ∈ (0,1], normalized B(1)=1.
//     Φ is fixed by t10 (more energy → finer progeny → higher Φ), γ,β set the fines/coarse slopes.
//
// The matrix B[i][j] (mass fraction of broken class-j material reporting to finer class i) is built STRICTLY
// lower-triangular (progeny is strictly finer than the parent), so B·C has a zero diagonal ⇒ (I − B·C) has a
// unit diagonal ⇒ det = 1 ⇒ the Whiten solve is always non-singular (manifest §topRisks: factor-order +
// conditioning). Each column is renormalized to exactly 1 so broken mass is conserved.

// Austin slopes. γ is chosen so the appearance function can REPRESENT the full t10 range it is asked to pass
// through: at the t10 anchor u=1/10, the maximum reachable value (φ=1) is 0.1^γ, so γ=0.35 ⇒ max t10 ≈ 0.447,
// comfortably above the realistic crusher t10 band (10–40%). With γ=0.62 the cap was ~0.24, which silently
// clamped φ and made the displayed t10 disagree with the matrix. β is the coarse-end slope.
const GAMMA = 0.35;   // Austin fines-end slope (max representable t10 = 0.1^γ ≈ 0.447)
const BETA = 4.2;     // Austin coarse-end slope (illustrative, within 3–6)

/** Specific comminution energy Ecs [kWh/t] applied, as a didactic function of stroke (throw) and speed.
 *  Larger throw = more energy per nip; faster gyration = more nips. Scaled to the realistic ~0.3–2.5 kWh/t band
 *  for crushers. Labelled illustrative in the UI — it reproduces the trend (more stroke/speed ⇒ finer), not a
 *  measured plant energy. */
export function specificEnergy(throwMm: number, speedRpm: number, speedRef = 350): number {
  return 0.033 * throwMm * (speedRpm / speedRef);
}

/** JKMRC t10 [fraction 0..1] from specific energy and ore competence A·b (A≈60 assumed; b = A·b / A). */
export function t10Of(ecsKwhT: number, oreAxb: number, A = 60): number {
  const b = oreAxb / A;
  // cap at 0.44 so the value stays representable by the Austin appearance function (max 0.1^γ ≈ 0.447) — keeps
  // the displayed t10 consistent with the breakage matrix B actually built from it.
  return Math.max(0, Math.min(0.44, (A * (1 - Math.exp(-b * ecsKwhT))) / 100));
}

/** Austin cumulative breakage: fraction of progeny from a parent finer than relative size u = x/y. */
export function appearanceCum(u: number, phi: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return phi * Math.pow(u, GAMMA) + (1 - phi) * Math.pow(u, BETA);
}

/** Solve Φ so the appearance function passes through (u=1/10, B=t10). Clamped to a valid (0,1) shape. */
export function phiFromT10(t10: number): number {
  const ug = Math.pow(0.1, GAMMA), ub = Math.pow(0.1, BETA);
  const phi = (t10 - ub) / (ug - ub);
  return Math.max(0.02, Math.min(0.98, phi));
}

/** The standard JKMRC t-family (tn = % passing 1/n of parent) for a given t10 — used by the methodology view to
 *  show B is derived from the cited A,b, never hand-tuned. Returns cumulative passing at parent/n. */
export function tFamily(t10: number): { n: number; tn: number }[] {
  const phi = phiFromT10(t10);
  return [2, 4, 10, 25, 50, 75].map((n) => ({ n, tn: appearanceCum(1 / n, phi) }));
}

/** Build the strictly-lower-triangular breakage matrix B (column-major access b(i,j)) on a sieve grid.
 *  edges descending; mid[j] is the parent mid-size of class j; progeny reports only to strictly finer classes
 *  i>j. Returns a row-major Float64Array (n·n). */
export function breakageMatrix(edges: number[], mid: number[], phi: number): Float64Array {
  const n = mid.length;
  const B = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const y = mid[j];
    let colSum = 0;
    const col = new Float64Array(n);
    for (let i = j + 1; i < n; i++) {        // strictly finer classes only (i>j ⇒ smaller size, descending grid)
      const upper = Math.min(edges[i], y);   // upper edge of class i (capped at parent size)
      const lower = edges[i + 1];            // lower edge of class i
      const frac = appearanceCum(upper / y, phi) - appearanceCum(lower / y, phi);
      const v = Math.max(0, frac);
      col[i] = v; colSum += v;
    }
    if (colSum > 0) for (let i = j + 1; i < n; i++) B[i * n + j] = col[i] / colSum;   // conserve broken mass
  }
  return B;
}
