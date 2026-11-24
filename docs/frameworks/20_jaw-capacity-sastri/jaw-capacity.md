# Method, the jaw capacity model of Sastri (1994) and the laboratory-jaw module (M15)

## What it is

The throughput of a jaw crusher from its geometry, its speed, the feed's size and the ore's density, in closed form. ChancaDEM
uses it for the laboratory jaw crusher of Barrios, Jimenez-Herrera and Tavares (2020), where the plant engine's capacity hump
([card 13](../13_capacity/capacity.md)) does not apply: that hump is a reduced form of a cone-crusher flow model with plant
reference capacities, and the plant jaw's classification constants are out of range for a jaw with a 90 mm gape. The model is
implemented in `data-pipeline/pipeline/model/crusher/labjaw.py` with the laboratory classification preset, the evaluation of a
narrow feed class through the engine's own breakage and Whiten solve, Bond's energy per unit of work index, and a sensitivity
band. It is offline only: no machine id joins the plant engine, the learned models' encodings and the TypeScript engine do not
change.

## Theory, the equations as the paper prints them

Source: S. R. S. Sastri, "Capacities and performance characteristics of jaw crushers", *Minerals and Metallurgical
Processing*, May 1994, pp. 80 to 85 (SME preprint 92-650), read on the copy at
[911metallurgist.com](https://www.911metallurgist.com/wp-content/uploads/2016/02/Capacities-and-Sizing-of-jaw-crushers.pdf).
The paper re-evaluates the constants of Hersam (1923) against Hersam's laboratory jaw and compares with Rose and English (1967)
on about 55 industrial jaws (Tables 1 to 4). Symbols: $G$ the gape, $w$ the jaw width, $D$ the vertical depth between the jaws,
$S$ the closed-side setting, $T$ the throw, $N$ the speed in strokes per minute, all lengths in metres.

The prism the material falls through per stroke has the height $a$ (equations 2 and 4), and the volumetric capacity follows
(equations 5 and 6):

$$a = \frac{D\,T}{G - (S + T)}\ \ (N < N_c), \qquad a = \frac{450\,g}{N^2}\ \ (N \ge N_c), \qquad V_h = 60\,N\,w\,\left(S + \frac{T}{2}\right) a\ [\mathrm{m^3/h}]$$

The critical speed separates the two forms (equation 8); the capacity rises with speed below it and falls above it:

$$N_c = 66.4\left[\frac{G - (S + T)}{D\,T}\right]^{1/2}\ [\mathrm{rpm}]$$

The capacity in t/h is (equations 9 to 11), with $d$ the true density in t/m$^3$:

$$W = V_h\,K_1\,K_2\,K_3\,d, \qquad K_1 = 0.85 - \left(\frac{F_{av}}{G}\right)^{2.5}, \qquad K_2 = 1.92 \times 10^{-6.5\,T/G}$$

$F_{av}$ is the average feed size (the arithmetic mean of the limits of a narrow class, as his Table 2 uses it), $K_3 = 1.0$ for
harder materials and 0.6 for softer ones such as coal and coke ("this needs to be confirmed", p. 82). The depth is
$D = 3.25\,G^{1.15}$ for $G \le 0.25$ m (equation 12) and $D = 0.21 + 1.8\,G$ for $G \ge 0.25$ m (equation 13). The $K_1$, $K_2$,
$K_3$ here are Sastri's capacity factors, not the classification parameters of the Whiten model.

At the critical speed the two forms meet within 0.13 percent: the printed 66.4 is a rounded constant ($450\,g / 66.4^2 = 1.0013$).

## The laboratory preset and the band

The classification of the laboratory jaw is the literature's first estimate, not a fit to any laboratory jaw (none is
published): $K_1 = \mathrm{CSS}$, $K_2 = \mathrm{OSS} = \mathrm{CSS} + T$, $K_3 = 2.3$ (Donovan 2003, section 2.1.3), with $K_2$ never
below $1.05\,K_1$. Its sensitivity band is the eight corners of the ranges that King (2000) gives for standard and short-head Symons cone
crushers, used for the laboratory jaw for want of published jaw values (Technical Notes 5, equations 5.8 to 5.10, pages 5-4
and 5-5): $K_1 = \alpha_1 \mathrm{CSS}$ with $\alpha_1$ 0.5 to 0.95, $K_2 = \alpha_2 \mathrm{CSS}$ with $\alpha_2$ 1.7 to 3.5, exponent $n$
1 to 3. The product is the engine's: the Whiten solve with the JKMRC t10 and the Austin appearance function
([cards 11 and 12](../11_breakage-function/breakage.md)), $t_{10}$ from the engine's specific energy at the jaw's throw.

A narrow feed class is spheres with diameters uniform in $[d_{min}, d_{max}]$, so its cumulative mass passing $d$ is
$(d^4 - d_{min}^4)/(d_{max}^4 - d_{min}^4)$, integrated over each sieve class; its F80 is analytic. Bond's energy per unit of
work index is $10\,(1/\sqrt{P_{80}} - 1/\sqrt{F_{80}})$ with sizes in micrometres, the engine's form at a work index of one.

## What it was built on

Hersam's laboratory jaw (width 0.159 m, depth 0.206 m, 304 rpm, closed-side setting 9.53 mm). The paper's own test is "deviations
of less than 20 percent in most cases" (p. 82), on granite, trap rock, quartz, coke, coal and ores of density 1.1 to 6.15 t/m$^3$.
Its industrial machines have gapes of 0.15 to 1.68 m.

## Where it stops being valid

- A feed whose mean size is near the gape: $K_1$ falls to 0 as $F_{av}/G$ reaches 0.937 and the module floors it there.
- A laboratory jaw outside Hersam's size and speed, or an ore whose density or hardness is outside the paper's: $K_3$ is a two-value
  material factor and its authors ask for it to be confirmed.
- The depth between the jaws is a correlation of the gape (equations 12 and 13), not a measured dimension.
- It predicts the throughput and nothing about the product; the product is the engine's, with a classification that is a
  literature estimate and a band.
- It predicts no power: the ore's work index is not published, so only Bond's energy per unit of work index is returned.

## The constants as the code has them

`labjaw.py`: every constant of the equations above is a named module constant with its unit in a comment (`G_M_S2`,
`HIGH_SPEED_COEF`, `CRITICAL_SPEED_COEF`, the depth coefficients, `K1_FEED_OFFSET`, `K1_FEED_EXP`, `K2_COEF`, `K2_EXP_PER_RATIO`).
`OTSUKA_BARRIOS_2020` holds the laboratory jaw of Barrios et al. 2020 (Tables 2 and 3: gape 90 mm, width 140 mm, throw 10 mm,
density 2.70 t/m$^3$, $K_3$ = 1.0). `KING_RANGES` holds the three ranges with their source.

The ore link `axb_from_fracture_energy` equates the exponents of two published t10 laws, $b = b'/E_{50}$ on one energy basis
($A\,b = 3600\,A\,b'/E_{50}$, with E50 in J/kg and 1 kWh/t = 3600 J/kg); no source states the conversion, and it makes $b$ depend on
the particle size through E50 while the engine holds it constant.

## Where it runs

Offline: the bake stage of a later unit calls it at the three operating points of the laboratory jaw and writes the result into a
document. It has no TypeScript counterpart.

## Tests

- `tests/test_labjaw.py::test_sastri_table_2_rows`: the nine rows of Table 2 (eight within 0.2 percent, the fifth, T 3.18 mm, within 3
  percent: the printed equations give 0.438 against the printed 0.427).
- `tests/test_labjaw.py::test_otsuka_values_to_four_significant_figures` and `test_capacity_is_continuous_at_the_critical_speed_and_peaks_there`.
- The evaluation, the band, the ore link and the refutations that nothing measured is read and the plant engine is untouched: see
  the requirements EN-007 to EN-013 of the [engine feature](../../design/features/engine/requirements.md) and their
  [validation rows](../../design/features/engine/validation.md).

## What it is not

- Not a fit: nothing in the module is adjusted to the measured throughput, power or product of the laboratory jaw.
- Not a plant machine: no `Machine` id, no surrogate encoding, no TypeScript engine.
- Not the Wills form of Broman (4.8 to 8.8 t/h for this jaw; its own source finds it out by more than 100 percent in a worked
  example) nor the Rose and English form as a vendor prints it (0.9 to 2.0 t/h; primary jaws, not laboratory scale): both were
  evaluated in the research and are not implemented.

## References

- Sastri, S. R. S. (1994), Minerals and Metallurgical Processing, May 1994, pp. 80 to 85
- King, R. P. (2000), Technical Notes 5, Crushers, equations 5.8 to 5.10 (the ranges are those of Symons cone crushers)
- Donovan, J. G. (2003), PhD thesis, Virginia Tech, section 2.1.3, [handle 10919/28544](https://vtechworks.lib.vt.edu/handle/10919/28544)
- Barrios, Jimenez-Herrera and Tavares (2020), Minerals 10(8):717, [doi:10.3390/min10080717](https://doi.org/10.3390/min10080717)
- Tavares (2022), KONA 39, [doi:10.14356/kona.2022012](https://doi.org/10.14356/kona.2022012), equation 20
