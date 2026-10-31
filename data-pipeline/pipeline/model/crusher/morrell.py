"""Morrell's size-specific energy of a conventional crusher, beside Bond (``capacity.bond_power``).

Source: the GMSG guideline "Morrell Method for Determining Comminution Circuit Specific Energy and Assessing Energy
Utilization Efficiency of Existing Circuits", Annex B (Morrell equations), section B.2.2 Conventional Crushers,
equations B4 and B5, printed pages 6 and 7 (pages 11 and 12 of the PDF), read on 2026-10-30:
https://www.smctesting.com/documents/Morrell_method_for_determining_comminution_circuit_specific_energy_and_assessing_energy_utilization_efficiency_of_existing_circuits.pdf
The primary paper is Morrell (2009), Minerals Engineering 22(6), https://doi.org/10.1016/j.mineng.2009.01.005 (not opened;
the guideline is the source of the equations here).

    W_c = S_c K2 M_ic 4 (x2^f(x2) - x1^f(x1))            [kWh/t]                                   (B4)
    f(x) = -(0.295 + x / 1,000,000)
    S_c  = K_s (x1 x2)^-0.2 with K_s = 55, applied when S_c < 1 and taken as 1 when S_c > 1       (B5)

x1 and x2 are the P80 of the feed and of the product in micrometres, K2 = 1.0 for a crusher in closed circuit with a
classifying screen and 1.19 in open circuit, M_ic [kWh/t] the crusher ore work index of the SMC Test. Units: x^f(x) is
dimensionless (a micrometre size to a small negative power), so W_c carries the unit of M_ic, kWh/t; the power is
W_c [kWh/t] times the throughput [t/h] = kW. The guideline defines the net power as the motor power less the no-load
power, so a measured motor power is the net power plus the no-load term.

M_ic of the Minas Rio itabirite is not published: callers fit it (pipeline.hp500.morrell_fit) and say so. Pure typed
functions, no I/O.
"""
from __future__ import annotations

K_S_CRUSHER = 55.0     # K_s of a conventional crushing circuit (guideline B.2.2)
K2_CLOSED = 1.0        # crusher in closed circuit with a classifying screen
K2_OPEN = 1.19         # crusher in open circuit


def f_exponent(x_um: float) -> float:
    """f(x) = -(0.295 + x / 1,000,000), x in micrometres [-]."""
    return -(0.295 + x_um / 1_000_000.0)


def size_term(x1_um: float, x2_um: float) -> float:
    """4 (x2^f(x2) - x1^f(x1)) [-]: the size-reduction term of equations B2 to B4. Positive when x2 < x1."""
    if x1_um <= 0 or x2_um <= 0:
        raise ValueError("P80 sizes must be positive (micrometres)")
    return 4.0 * (x2_um ** f_exponent(x2_um) - x1_um ** f_exponent(x1_um))


def hardness_parameter(x1_um: float, x2_um: float, k_s: float = K_S_CRUSHER) -> float:
    """S_c of equation B5 with the guideline's rule: S_c = K_s (x1 x2)^-0.2 when that is below 1, and 1 when it is above 1."""
    if x1_um <= 0 or x2_um <= 0:
        raise ValueError("P80 sizes must be positive (micrometres)")
    return min(1.0, k_s * (x1_um * x2_um) ** -0.2)


def crusher_specific_energy_kwh_t(x1_um: float, x2_um: float, m_ic_kwh_t: float, closed_circuit: bool = True) -> float:
    """W_c [kWh/t] of equation B4 for feed P80 ``x1_um`` and product P80 ``x2_um`` [micrometres] and the work index
    ``m_ic_kwh_t`` [kWh/t]."""
    k2 = K2_CLOSED if closed_circuit else K2_OPEN
    return hardness_parameter(x1_um, x2_um) * k2 * m_ic_kwh_t * size_term(x1_um, x2_um)


def crusher_power_kw(x1_um: float, x2_um: float, m_ic_kwh_t: float, throughput_tph: float, no_load_kw: float = 0.0,
                     closed_circuit: bool = True) -> float:
    """Motor power [kW] = W_c [kWh/t] x throughput [t/h] + the no-load power [kW]."""
    return crusher_specific_energy_kwh_t(x1_um, x2_um, m_ic_kwh_t, closed_circuit) * throughput_tph + no_load_kw
