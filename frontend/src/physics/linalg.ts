// Tiny dense linear algebra on Float64Array — no external matrix library (manifest §liveTier: the live crusher
// math is small dense linear algebra; a hand-written LU keeps the bundle lean and the maths auditable). All
// matrices are row-major flat Float64Array of length n·n.

/** Solve A·x = b by LU decomposition with partial pivoting. A is row-major n·n; b length n. Returns x (length n).
 *  Used for the Whiten crusher solve (I − B·C)·y = f. Throws on a singular pivot (caller guards beforehand). */
export function solveLU(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const a = Float64Array.from(A);      // working copy (LU overwrites)
  const piv = new Int32Array(n);
  for (let i = 0; i < n; i++) piv[i] = i;

  for (let k = 0; k < n; k++) {
    // partial pivot: largest |a[i][k]| in column k at or below the diagonal
    let p = k, max = Math.abs(a[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(a[i * n + k]);
      if (v > max) { max = v; p = i; }
    }
    if (max === 0) throw new Error('solveLU: singular matrix (zero pivot)');
    if (p !== k) {
      for (let j = 0; j < n; j++) { const t = a[k * n + j]; a[k * n + j] = a[p * n + j]; a[p * n + j] = t; }
      const tp = piv[k]; piv[k] = piv[p]; piv[p] = tp;
    }
    const akk = a[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = a[i * n + k] / akk;
      a[i * n + k] = f;
      for (let j = k + 1; j < n; j++) a[i * n + j] -= f * a[k * n + j];
    }
  }

  // forward solve L·z = P·b
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[piv[i]];
    for (let j = 0; j < i; j++) s -= a[i * n + j] * z[j];
    z[i] = s;
  }
  // back solve U·x = z
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    for (let j = i + 1; j < n; j++) s -= a[i * n + j] * x[j];
    x[i] = s / a[i * n + i];
  }
  return x;
}

/** Cheap 1-norm condition proxy of M = I − B·C: ‖M‖₁ · ‖M⁻¹·e‖∞ surrogate. We do NOT form M⁻¹; instead we
 *  return the ratio of the largest to smallest absolute row-sum, a fast monotone proxy that rises as C→1 across
 *  many classes near choke (manifest: flag, don't NaN). Purely an internal health flag, not a reported metric. */
export function condProxy(M: Float64Array, n: number): number {
  let lo = Infinity, hi = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += Math.abs(M[i * n + j]);
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  return lo > 0 ? hi / lo : Infinity;
}
