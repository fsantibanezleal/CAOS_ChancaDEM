# Docs, the ChancaDEM wiki

The product wiki (ADR-0056), kept current with the code. ChancaDEM is a crusher-comminution studio: the canonical Python
engine, its validation on ten measured HP500 surveys and two learned models are the product, and the web workbench is its
companion. The design, with every requirement and its gate, is [design/SDD.md](design/SDD.md).

## Map

- **[architecture/](architecture.md)**, how the repository works: the lanes and the flow, determinism and the trace, the
  lane gate, the live lane (the TypeScript port held to the Python engine), the precompute pipeline, model evaluation,
  deploy, and the data contracts.
- **[frameworks/](frameworks.md)**, one card per method of the ladder (the feed and sieve grid, breakage,
  classification, the Whiten solve, capacity, regimes, power, the envelope gate, the HP500 calibration, CrusherCal, the
  surrogate and the autoencoder) and per engine (PyTorch, ONNX, NumPy), with the equations, the constants as the code has
  them, the tests and what each is not.
- **[guides/](guides.md)**, runnable how-tos: run the pipeline, bring your own operating points or surveys, the GPU lane
  (dormant), the API (dormant), and the template's rules for the architecture modal, the executive brief, the
  documentation pages and the notebooks.
- **[cases/](cases.md)**, the taxonomy and the coverage matrix of the 27 cases.
- **[contracts/](contracts/catalog.md)**, the contract catalog with its schemas, sample documents and provider tree.
- **[design/](design/SDD.md)**, the software design document and its features.

## Honesty and data policy

- Numbers come from the engine and the committed artifacts, never from a claim. The synthetic machines' constants are
  illustrative; only the HP500 cone lane is calibrated, to one machine on one ore, and the power estimate is a documented
  negative ([power card](frameworks/09_power_model/power-model.md)).
- The ten real cases are measurements by Rocha, Campos, Silva and Tavares (2024, CC BY 4.0, `ATTRIBUTION.md`).
- Public derived artifacts are committed (`data/derived/`); raw or private sources stay out of git (`data/raw/`) per
  ADR-0055. The contracts that govern raw to pipeline and pipeline to web are described in
  [architecture/08_data-contracts.md](architecture/08_data-contracts.md) and held in the catalog.
