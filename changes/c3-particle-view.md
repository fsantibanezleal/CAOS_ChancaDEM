- The App's Validation group gains the view "Particle simulation" (tab `particles`, deep link `/app?case=<case>&view=validation&sub=particles`):
  a replay of the particles of the laboratory jaw crusher of the published tests, in the jaw's section drawn to scale on a canvas (the fixed
  plate, the swing plate from its pivot to its bottom edge at the frame, the hopper, the discharge level and the closed and open settings in
  millimetres, spheres coloured by diameter against the feed class and drawn far to near, with a panel that is the legend and the size mix of
  the frame), three anchored callouts (throughput, net power and product P80 of the particle simulation against the measurement, each with its
  unit and its verdict's state), and a takeaway line built from the document. The view reads the document `dem-run` and the replay file of the
  chosen operating point, which is fetched only when it is shown and checked against the document's byte count before it is decoded
  (little-endian, whatever the machine's byte order). It does not depend on the case selected in the workbench and says so.
- One stroke cursor, the shell's linked-view store scoped to the view, moves the stage, the per-stroke plate power (with the steady window shaded
  and its mean) and the mass passed with the mass held, in both directions: the slider, play and pause, the speed, the keys (space, left and
  right) and a click on a chart all write it. Playback is the shell's paused-by-default loop: it never starts by itself, stops when the tab is
  hidden or the view unmounts, and under reduced motion it does not play and the frame at the cursor is shown.
- The three operating points are drawn on shared axes for throughput, net power and product P80, with the measurement and its band shaded, the
  particle simulation with its standard error, the population balance (no power: no work index of the ore is published; its P80 with the
  spread over the ranges King gives for cone crushers, named a sensitivity band and not a confidence interval), a side without a value as an open circle
  with its reason, and under each chart the sentence that says which side is nearer the measurement and by how many percent, with each side's
  verdict in words. Below: the product size distribution with the closed and open settings, the verdict table of the chosen point (the two
  values, the relative error, the band, the verdict in a word and a mark, whether it is resolved, the basis), and the sources, the package, the
  seed and the bands. A verdict that is not met or not compared is never worded, marked or coloured as agreement, and a null is never drawn as
  zero. A run that did not complete says at which stroke and why it stopped, with the spheres held and the mass passed, and shows no window
  statistic. The readiness reason of the row (partial, stale) is shown in both languages, and a document that is missing says why with nothing
  drawn.
- The particle simulation view, follow-up: the paper's own simulation (`paper_simulation` of `dem-run` 1.1.1) is drawn as its own mark with its own
  legend entry in the throughput and net power charts and stated in the sources with its two source strings and its two relative differences
  against the measurement, as context only; a note near the verdict table says the verdicts are about the particle simulation of the package
  `crushdem` and not about the published study. The product P80 of a run that did not complete is stated as the product of the mass passed
  before the stop, with a neutral state, and no callout or sentence prints a relative difference for that run. The stage gains a magnified
  inset of the crushing zone (the last 80 mm above the discharge level and a little below it, to its own scale bar, with the closed and open
  settings marked), and its labels stand outside the chamber with leaders. The spread of the population balance is named as the spread over
  the ranges King gives for cone crushers.
