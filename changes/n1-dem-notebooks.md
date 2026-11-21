- The notebook set gains its ninth topic, `09-discrete-element`, three notebooks in English and in Spanish (26 per language), that teach the
  discrete element method with particle-replacement breakage on the laboratory jaw crusher of Barrios et al. 2020 through the published
  package `crushdem` 0.6.0: `01-particles-in-a-laboratory-jaw` (level 1: what following every particle adds to a population balance, the
  tests of the paper and their measurements read from the package, the two laws of the method, a first live batch and the cost of the
  full-size runs), `02-particle-replacement-breakage-step-by-step` (level 2: the contact, the strength of a sphere, the damage, t10,
  the progeny, the replacement and its bounds, the stroke loop and the steady window with its standard error, two checks against
  independent values, where the method stops working at the overlap limit, and your own ore and machine) and `03-three-answers-for-one-jaw`
  (level 3: the particle simulation, the population balance with the jaw capacity model of Sastri 1994 and the measurement at the three
  feeds, every verdict of the committed document `dem-run` read field by field, the table and figures that compare the three sides, why
  they differ, the sensitivity of the population balance to its classification parameters and the same module on another jaw). The
  live runs are small (at most 1 kg, a few strokes) and each notebook executes in under two minutes; the full-size runs are read from the
  committed document. `notebooks/coverage.json` maps the methods M15 and M16, the contract `dem-run`, the stage `dem` and the package
  `crushdem`; the three indexes carry the topic and its notebooks, and the row of topic 03 now says that the discrete element method is
  taught and compared in topic 09. The notebook tests count 26 notebooks per language in nine topics.
