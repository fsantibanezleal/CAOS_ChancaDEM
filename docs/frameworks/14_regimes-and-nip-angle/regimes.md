# Method, the regimes and the nip angle (M6)

## What it is

Two outputs that qualify a result rather than compute a product: the regime the point is in (choke, pass-through,
invalid) and the nip angle against its grip limit.

## Rules, as `engine.py` applies them

Let $F_{80}$ be the engine's feed 80 percent passing size and $e_0 = 256$ mm the top edge of the grid.

- If $\mathrm{CSS} \ge F_{80}$: regime `pass-through`, flag `CSS ≥ F80, little size reduction (pass-through regime)`
  (stable code `pass_through`). If also $\mathrm{CSS} \ge e_0$: the point is marked invalid, flag `css_ge_feed_top`.
- If the reduction ratio $F_{80}/P_{80}$ is below 1.05 and the point is still valid: regime `pass-through` (when it was
  `choke`) and flag `negligible_reduction`.
- If the conditioning proxy is not finite or exceeds $10^6$: invalid, flag `ill_conditioned`.
- If $\mathrm{CSS} \ge e_0$: regime `invalid`.

The nip angle (`nip_angle`) is $\alpha = \alpha_0 + 6\,(\mathrm{CSS}/g_{ref} - 1)/2$ degrees with $\alpha_0 = 22$ (19 for
the jaw), rising modestly with the setting. The grip limit is $2\arctan\mu$ with $\mu = 0.35$, that is 38.2 degrees
(`nip_limit`); a particle is nipped when the nip angle is at or below it. The code reports both and draws them in the
chamber geometry view (the chamber view, `frontend/src/views/`); the nip angle does not set the regime.

The regime type also lists `trickle`; the engine never assigns it (the cases named trickle-fed are about the feed, not a
regime). Among the 27 committed traces, 23 are `choke`, 3 `pass-through` (CP1, G02, HP500-03) and 1 `invalid` (CI1)
(`data/derived/*/trace.json`, field `summary.regime`).

## Where it runs

Both lanes: `engine.py` and `capacity.py` offline, `frontend/src/engine/engine.ts` and `capacity.ts` live. The manifest
carries the flags as stable codes (`core/manifest.py`, `FLAG_CODES`); the web maps each to bilingual text
(`frontend/src/engine/flags.ts`) and refuses a sentence it does not know.

## Tests

- `tests/test_crusher_engine.py::test_pass_through_and_invalid_guard_fires_when_css_ge_feed_top_size` (the gate of M6).
- Cases CP1 (pass-through) and CI1 (invalid) in the matrix are the controls that carry these flags; see
  [cases](../../cases/README.md).

## What it is not

- Not a choke-feed model: "choke" is the default regime label when no guard fires.
- Not a safety check of a real machine. The constants (22 degrees, $\mu$ = 0.35) are typical values, not a vendor's.

## References

- Whiten 1972 and Napier-Munn et al. 1996 for the choke-fed chamber assumption; see the [engine card](../01_whiten-engine/whiten.md).
