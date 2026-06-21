# 03 — GPU lane (DORMANT)

This solution does not require a GPU at the moment. ChancaDEM's training is tiny (a small MLP + a denoising AE over a
few thousand sweep points, seconds on CPU). `requirements-gpu.txt` is a dormant placeholder.

Activate only if a future heavy increment (e.g. a much larger sweep or a deep DEM-surrogate) makes training slow:
install the CUDA torch build, document the pin in `requirements-gpu.txt` + this guide, and keep the CPU path as the
default reproducible lane.
