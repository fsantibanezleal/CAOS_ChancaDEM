"""The named pipeline stages. Order: preprocess -> infer -> export for each case, then the HP500 documents and the
index; train and evaluate are the heavy precompute lane (``run.py models``). Each stage is deterministic, typed and
independently testable."""
