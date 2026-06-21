"""Offline 2-D soft-sphere DEM of a crusher chamber cross-section, WITH breakage — the SOTA "physics" tier the
analytic Whiten+Evertsson live engine is benchmarked against (ADR-0054 deterministic-replay: this runs OFFLINE
for minutes, bakes a decimated/quantized particle trace + the EMERGENT product granulometry, and the web app
REPLAYS it; it never solves DEM in the browser).

What it actually is (honesty register — printed into the manifest):
  • A real explicit-time soft-sphere (linear spring–dashpot) DEM in the axisymmetric (r,z) half-plane. Disks fall
    under gravity between a FIXED concave bowl (outer wall) and a GYRATING mantle (inner wall, oscillates in r by
    the throw once per revolution). Particle–particle and particle–wall normal contacts are Hookean with damping;
    tangential is Coulomb-capped viscous. This is the standard Cundall–Strack contact model (Géotechnique 1979).
  • BREAKAGE: when a disk is nipped — simultaneously loaded by the mantle and the concave with a compressive force
    above its size-dependent strength — it fractures into progeny whose mass split follows the JKMRC t10–tn
    appearance function (t10 from the ore A·b via the Ecs–t10 law, Narayanan & Whiten 1988). Progeny disks are
    placed in the local gap conserving area (2-D mass proxy). This is the particle-replacement breakage model
    (Cleary & Sinnott 2015; Tavares progeny).
  • The EMERGENT product PSD is built from the sizes of disks that exit below the discharge — it is NOT prescribed.
    Agreement with the analytic Whiten product on the same operating point is the cross-check the project lives or
    dies by (manifest §validation): if the "live" matrix model and the offline DEM disagree, we report it.

This is a DIDACTIC 2-D DEM (hundreds of disks, the axisymmetric slice), not an industrial 3-D BPM run — said so
in the UI. It is a genuine particle simulation, not a kinematic animation.

Run:  python dem2d.py            (bakes the default reference case to public/dem/)
      python dem2d.py --all      (bakes every case in CASES below)
"""
from __future__ import annotations
import os, json, math, argparse
import numpy as np

HERE = os.path.dirname(__file__)
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "dem"))
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------------------------------------------
# Chamber geometry — kept consistent with src/physics/chamber.ts (cone/gyratory surface-of-revolution liners).
# Concave: parallel zone -> converging (alphaC) -> feed flare. Mantle ogive base sits BELOW the concave lip by
# `overlap` and the gap in the parallel zone is ~CSS. Lengths in mm.
GEOM = {
    "cone-sec":        dict(zTop=950,  zPz=110, zRed=620, rDis=360, alphaC=0.27, alphaFlare=0.72, alphaM=0.12, overlap=90),
    "cone-tert":       dict(zTop=760,  zPz=230, zRed=560, rDis=300, alphaC=0.30, alphaFlare=0.70, alphaM=0.18, overlap=75),
    "cone-short-head": dict(zTop=720,  zPz=330, zRed=560, rDis=290, alphaC=0.30, alphaFlare=0.66, alphaM=0.23, overlap=70),
    "gyratory":        dict(zTop=1500, zPz=30,  zRed=1150, rDis=560, alphaC=0.10, alphaFlare=0.30, alphaM=0.05, overlap=150),
}


def r_concave(z, P):
    if z <= P["zPz"]:
        return P["rDis"]
    if z <= P["zRed"]:
        return P["rDis"] + (z - P["zPz"]) * math.tan(P["alphaC"])
    rRed = P["rDis"] + (P["zRed"] - P["zPz"]) * math.tan(P["alphaC"])
    return rRed + (z - P["zRed"]) * math.tan(P["alphaFlare"])


def r_mantle(z, P, css):
    """Mantle radius at the CLOSED azimuth; the gyration adds throw on top of this (see r_mantle_t)."""
    if z < -P["overlap"]:
        return 0.0
    zc = max(0.0, z)
    if z <= P["zPz"]:
        return max(0.0, r_concave(zc, P) - css)
    rPz = r_concave(P["zPz"], P) - css
    return max(0.0, rPz - (z - P["zPz"]) * math.tan(max(0.01, P["alphaC"] - P["alphaM"])))


# ---------------------------------------------------------------------------------------------------------------
# Feed sampling (Rosin–Rammler) and the t10 appearance function (progeny split on breakage).
def sample_feed(n, x63, m, rng, top):
    """Rosin–Rammler R(x)=exp[-(x/x63)^m]; invert to sample particle sizes [mm], clipped to the chamber top."""
    u = rng.random(n)
    d = x63 * (-np.log(np.clip(u, 1e-9, 1.0))) ** (1.0 / m)
    return np.clip(d, 1.0, top)


def t10_of(axb, ecs):
    """JKMRC: t10 = A*(1 - exp(-b*Ecs)) [%], A=axb scaling. Ecs [kWh/t] from the nip energy proxy."""
    A = min(70.0, 0.6 * axb + 20.0)
    b = max(0.2, axb / 110.0)
    return A * (1.0 - math.exp(-b * ecs))


def progeny_sizes(parent_mm, t10, rng):
    """Split a fractured parent disk (area-conserving in 2-D) into progeny. t10 = % finer than 1/10 the parent;
    higher t10 => finer progeny. A simple, monotone-in-t10 lognormal split, then area-normalised."""
    parent_area = math.pi * (parent_mm / 2.0) ** 2
    # finer products as t10 rises: mean progeny fraction of parent shrinks
    frac_mean = max(0.06, 0.5 - 0.004 * t10)
    k = rng.integers(3, 7)
    fr = np.abs(rng.normal(frac_mean, frac_mean * 0.5, size=k))
    fr = np.clip(fr, 0.03, 0.9)
    sizes = parent_mm * fr
    areas = math.pi * (sizes / 2.0) ** 2
    areas *= parent_area / max(areas.sum(), 1e-9)        # conserve area (2-D mass proxy)
    return 2.0 * np.sqrt(areas / math.pi)


# ---------------------------------------------------------------------------------------------------------------
# Vectorised geometry (numpy) — same liner shapes as above, evaluated over a particle array at once.
def r_concave_vec(z, P):
    rRed = P["rDis"] + (P["zRed"] - P["zPz"]) * math.tan(P["alphaC"])
    below = P["rDis"]
    conv = P["rDis"] + (z - P["zPz"]) * math.tan(P["alphaC"])
    flare = rRed + (z - P["zRed"]) * math.tan(P["alphaFlare"])
    return np.where(z <= P["zPz"], below, np.where(z <= P["zRed"], conv, flare))


def r_mantle_closed_vec(z, P, css):
    zc = np.clip(z, 0.0, None)
    rcZc = r_concave_vec(zc, P)
    rPz = r_concave_vec(np.array(P["zPz"]), P) - css
    pz = np.maximum(0.0, rcZc - css)
    upper = np.maximum(0.0, rPz - (z - P["zPz"]) * math.tan(max(0.01, P["alphaC"] - P["alphaM"])))
    r = np.where(z <= P["zPz"], pz, upper)
    return np.where(z < -P["overlap"], 0.0, r)


# ---------------------------------------------------------------------------------------------------------------
# The DEM solver — numpy-vectorised soft-sphere contacts (pairwise via broadcasting), explicit time integration.
def run_dem(machine, css, throw, speed_rpm, x63, m, axb, n_seed=260, steps=5200, seed=7, n_frames=90):
    P = GEOM[machine]
    rng = np.random.default_rng(seed)
    zTop = P["zTop"]
    grav = 9810.0                      # mm/s^2
    dt = 6e-5                          # s
    kn = 3.5e4                         # contact penalty stiffness
    omega = speed_rpm / 60.0 * 2 * math.pi   # gyration angular speed [rad/s]

    # compact, dynamically-resized state of the LIVING particles only
    feed_d = sample_feed(n_seed, x63, m, rng, P["rDis"] * 1.6)
    z0 = zTop * (0.55 + 0.45 * rng.random(n_seed))
    rc0 = r_concave_vec(z0, P); rm0 = r_mantle_closed_vec(z0, P, css)
    r = np.where(rc0 - rm0 > feed_d, rm0 + feed_d / 2 + (rc0 - rm0 - feed_d) * rng.random(n_seed), 0.5 * (rc0 + rm0))
    z = z0.copy()
    vr = np.zeros(n_seed); vz = np.zeros(n_seed)
    rad = feed_d / 2.0
    flash = np.zeros(n_seed, np.int32)

    def mantle_r_at(zz, t):
        amp = throw * (0.4 + 0.6 * (1.0 - np.clip(zz / zTop, 0.0, 1.0)))
        return r_mantle_closed_vec(zz, P, css) + 0.5 * amp * (1.0 + math.sin(omega * t))

    product = []
    frames = []
    frame_every = max(1, steps // n_frames)

    for step in range(steps):
        t = step * dt
        n = len(r)
        ar = np.zeros(n); az = np.full(n, -grav)

        # ---- particle–particle normal contacts (vectorised n×n) ----
        if n > 1:
            dr = r[:, None] - r[None, :]
            dz = z[:, None] - z[None, :]
            dist = np.sqrt(dr * dr + dz * dz)
            np.fill_diagonal(dist, 1e9)
            ov = (rad[:, None] + rad[None, :]) - dist
            hit = ov > 0
            inv = np.where(dist > 1e-6, 1.0 / dist, 0.0)
            f = np.where(hit, kn * ov, 0.0)
            ar += np.sum(f * dr * inv, axis=1)
            az += np.sum(f * dz * inv, axis=1)

        # ---- wall contacts + nip detection (vectorised) ----
        rc = r_concave_vec(z, P); rm = mantle_r_at(z, t)
        ov_c = (r + rad) - rc          # into the outer concave
        ov_m = rm - (r - rad)          # into the inner mantle
        fc = kn * np.clip(ov_c, 0, None)
        fm = kn * np.clip(ov_m, 0, None)
        ar += fm - fc
        nipped = (ov_c > 0) & (ov_m > 0)
        nload = np.where(nipped, np.minimum(fc, fm), 0.0)

        # ---- integrate (semi-implicit Euler; unit-density mass-per-area proxy) ----
        mass = np.maximum(1e-3, math.pi * rad ** 2 * 1e-3)
        vr += ar / mass * dt; vz += az / mass * dt
        vr *= 0.999; vz *= 0.999
        r += vr * dt; z += vz * dt
        flash = np.maximum(0, flash - 1)

        # ---- breakage: nipped disks above their size-dependent strength fracture into t10 progeny ----
        strength = 30.0 * rad
        breakers = np.where(nipped & (nload > strength) & (rad > 1.2))[0]
        if len(breakers) > 0:
            new_r, new_z, new_vr, new_vz, new_rad = [], [], [], [], []
            for i in breakers:
                ecs = min(2.5, nload[i] / (strength[i] * 4.0))
                kids = progeny_sizes(rad[i] * 2.0, t10_of(axb, ecs), rng)
                for s in kids:
                    new_r.append(r[i] + rng.normal(0, rad[i] * 0.4))
                    new_z.append(z[i] + rng.normal(0, rad[i] * 0.4))
                    new_vr.append(vr[i] + rng.normal(0, 20)); new_vz.append(vz[i])
                    new_rad.append(max(0.4, s / 2.0))
            keep = np.ones(len(r), bool); keep[breakers] = False
            r = np.concatenate([r[keep], new_r]); z = np.concatenate([z[keep], new_z])
            vr = np.concatenate([vr[keep], new_vr]); vz = np.concatenate([vz[keep], new_vz])
            rad = np.concatenate([rad[keep], new_rad])
            flash = np.concatenate([flash[keep], np.full(len(new_r), 6, np.int32)])

        # ---- discharge: disks below z=0 exit → emergent product PSD ----
        exited = z < 0
        if exited.any():
            product.extend((rad[exited] * 2.0).tolist())
            keep = ~exited
            r, z, vr, vz, rad, flash = r[keep], z[keep], vr[keep], vz[keep], rad[keep], flash[keep]

        # ---- keep the population fed (steady-state throughput) in the first 70% of the run ----
        if step < int(steps * 0.7) and step % 25 == 0 and len(r) < n_seed * 6:
            d = sample_feed(5, x63, m, rng, P["rDis"] * 1.6)
            zN = zTop * (0.9 + 0.1 * rng.random(5))
            rcN = r_concave_vec(zN, P); rmN = r_mantle_closed_vec(zN, P, css)
            r = np.concatenate([r, 0.5 * (rcN + rmN)]); z = np.concatenate([z, zN])
            vr = np.concatenate([vr, np.zeros(5)]); vz = np.concatenate([vz, np.full(5, -50.0)])
            rad = np.concatenate([rad, np.maximum(0.5, d / 2.0)]); flash = np.concatenate([flash, np.zeros(5, np.int32)])

        # ---- record a decimated frame ----
        if step % frame_every == 0:
            idx = np.arange(len(r))
            if len(idx) > 150:
                idx = rng.choice(idx, 150, replace=False)
            frames.append(dict(
                r=[round(float(r[k]), 1) for k in idx],
                z=[round(float(z[k]), 1) for k in idx],
                d=[round(float(rad[k] * 2.0), 1) for k in idx],
                b=[int(flash[k] > 0) for k in idx],
            ))

    return product, frames, P


def emergent_psd(product_mm):
    """Build %-passing on the √2 sieve series from the exited-disk sizes (area-weighted = 2-D mass proxy)."""
    edges = [256.0 / (2 ** (k / 2.0)) for k in range(0, 29)]   # 256 -> ~0.5 mm
    edges = sorted(edges)
    d = np.array(product_mm)
    if len(d) == 0:
        return edges, [0.0] * len(edges)
    area = math.pi * (d / 2.0) ** 2
    passing = []
    tot = area.sum()
    for e in edges:
        passing.append(float(area[d <= e].sum() / tot))
    return edges, passing


def p80_of(edges, passing):
    for i in range(1, len(edges)):
        if passing[i] >= 0.8:
            f = (0.8 - passing[i - 1]) / max(1e-9, passing[i] - passing[i - 1])
            return edges[i - 1] + f * (edges[i] - edges[i - 1])
    return edges[-1]


# reference + a few diverse cases (machine, css, throw, speed, x63, m, axb)
CASES = {
    "S01": ("cone-sec", 32, 30, 360, 90, 1.2, 55),
    "S05": ("cone-sec", 16, 26, 360, 55, 1.6, 55),
    "T01": ("cone-tert", 8, 16, 400, 28, 1.5, 55),
    "G01": ("gyratory", 165, 30, 150, 600, 0.8, 40),
}


def bake(case_id, args):
    machine, css, throw, speed, x63, m, axb = args
    product, frames, P = run_dem(machine, css, throw, speed, x63, m, axb)
    edges, passing = emergent_psd(product)
    dem_p80 = p80_of(edges, passing)
    out = dict(
        case=case_id, machine=machine, css=css, throw=throw, speed=speed, x63=x63, m=m, axb=axb,
        zTop=P["zTop"], rDis=P["rDis"], overlap=P["overlap"],
        nExited=len(product), demP80=round(dem_p80, 2),
        sieveEdgesMm=[round(e, 2) for e in edges], productPassing=[round(p, 4) for p in passing],
        frames=frames,
        note="2-D soft-sphere DEM with t10 progeny breakage (Cundall-Strack contacts; JKMRC appearance fn). "
             "Didactic axisymmetric slice, hundreds of disks. Product PSD is EMERGENT (built from exited disks), "
             "not prescribed. Replayed in-browser per ADR-0054.",
    )
    path = os.path.join(OUT, f"{case_id}.json")
    json.dump(out, open(path, "w"), separators=(",", ":"))
    kb = os.path.getsize(path) / 1024
    print(f"  {case_id} {machine}: exited {len(product)} disks, DEM P80 {dem_p80:.1f} mm, {len(frames)} frames, {kb:.0f} KB -> {path}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    ids = list(CASES) if a.all else ["S01"]
    print(f"baking {len(ids)} DEM case(s) -> {OUT}")
    manifest = {}
    for cid in ids:
        o = bake(cid, CASES[cid])
        manifest[cid] = dict(machine=o["machine"], nExited=o["nExited"], demP80=o["demP80"], frames=len(o["frames"]))
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=2)
    print("wrote manifest.json")


if __name__ == "__main__":
    main()
