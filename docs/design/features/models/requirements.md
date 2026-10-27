# Requirements: The two model slots: the surrogate and the anomaly autoencoder

EARS (Mavin et al., RE'09, https://doi.org/10.1109/RE.2009.9). Every requirement names the gate that fails when it is violated.

| ID | Requirement | Gate |
|---|---|---|
| MD-001 | THE released model contracts SHALL be valid against their schemas and name ONNX graphs that exist with the bytes and sha256 hash they state and the input and output the contract declares. | `tests/contracts/test_models.py::test_surrogate_bundle_validates`, `tests/contracts/test_models.py::test_anomaly_bundle_validates`, `tests/contracts/test_models.py::test_onnx_graphs_match_their_contract` |
| MD-002 | IF a model slot's bundle is invalid, THEN the slot's baseline SHALL answer (the engine for the surrogate, the envelope gate for the autoencoder), labelled, and the bake SHALL record it. | `tests/test_manifest.py::test_an_invalid_slot_is_recorded_as_baseline` |
| MD-003 | THE held-out metrics SHALL be computed through the shipped graphs on a draw independent of the training draw, and the evaluate stage SHALL reproduce the committed metrics byte for byte. | `tests/contracts/test_models.py::test_metrics_validate`, `tests/contracts/test_models.py::test_train_and_test_draws_do_not_overlap`, `tests/contracts/test_models.py::test_evaluate_reproduces_the_committed_metrics_byte_for_byte` |
| MD-004 | THE web SHALL encode the inputs and decode the outputs of the two graphs from their contracts, bit for bit with the Python encoding of the shared reference. | `frontend/src/lib/ort.test.ts` |
