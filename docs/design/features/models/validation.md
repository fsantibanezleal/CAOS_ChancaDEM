# Adversarial validation: The two model slots: the surrogate and the anomaly autoencoder

For each requirement of [`requirements.md`](requirements.md), the check that tries to break it: what was planted or refuted, and the adversarial test that plants it. A row is evidence that the requirement can fail, not only that it passes.

| requirement | adversarial check | gate |
|---|---|---|
| MD-001 | a graph whose bytes are altered makes its slot invalid, and the engine then answers, labelled baseline | `tests/contracts/test_models.py::test_adversarial_swap_engine_baseline_and_surrogate` |
| MD-002 | an altered surrogate graph, an altered int8 graph or contract, and an altered autoencoder graph each release the slot to its baseline | `tests/contracts/test_models.py::test_adversarial_swap_engine_baseline_and_surrogate`, `tests/contracts/test_models.py::test_adversarial_swap_int8_and_contract_also_release_the_slot`, `tests/contracts/test_models.py::test_adversarial_swap_envelope_baseline_and_autoencoder` |
| MD-003 | a bundle that is invalid, or one without its recorded export parity, is refused by the evaluate stage | `tests/contracts/test_models.py::test_adversarial_swap_engine_baseline_and_surrogate` |
| MD-004 | the surrogate input and the anomaly features of every reference point are compared to the bit; a graph output of the wrong length is refused | `frontend/src/lib/ort.test.ts::adversarial: a graph output of the wrong length is refused, not decoded` |
