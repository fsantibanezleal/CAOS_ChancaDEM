"""The discrete element runs of the laboratory jaw crusher and the document of the catalog row dem-run (DM-001 to DM-011).

The particle engine is the published package ``crushdem`` (requirements-precompute.txt): this folder holds no contact model, no
breakage model and no stroke loop (DM-002). It fixes the operating points and the run settings (``points``), runs the package's
laboratory-jaw case in separate processes and keeps the raw run records (``runs``), encodes the particle frames of a run into the
replay file (``replay``), and builds the document from the raw records, the package's measured values and the laboratory-jaw
module of the canonical engine (``document``). Offline only: the simulation never runs in CI or in the browser (DM-018).
"""
