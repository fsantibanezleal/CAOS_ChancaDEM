import type { Machine } from './types';

// Per-machine design (reference) eccentric throw [mm]. It matches each machine's nominal operating point
// (store MACHINE_REF / the reference cases) and is the throw the illustrative synthetic baselines are centered
// on: at the design throw the classification window and the per-event breakage energy are unchanged from the
// pre-throw-model baseline, so the reference cases and the calibrated lane are not shifted.
//
// Throw is the horizontal eccentric stroke, so the open-side gap is OSS = CSS + throw. A larger throw opens the
// chamber wider, so larger particles escape during the open phase: the Whiten capture threshold K2 (the size
// above which a particle is always broken) rises with throw, giving a coarser product at fixed CSS and a higher
// capacity, exactly the Evertsson / OEM direction. This is why throw enters through the classification window,
// not through the per-nip energy: routing throw into Ecs would wrongly make more throw = finer.
export const REF_THROW_MM: Record<Machine, number> = {
  'cone-sec': 30,
  'cone-tert': 16,
  'cone-short-head': 16,
  'gyratory': 30,
  'jaw': 38,
};
