"""The engine of the offline stages, and the reference of the live lane's TypeScript port (held by a parity test).
The package holds the crusher engine (``crusher/``: feed, breakage, classification, the Whiten solve, capacity, power and the HP500 calibration)
and the learned-model bundles (``bundles``, ``surrogate``, ``psd_ae``) that the offline stages release and the live lane ports."""
