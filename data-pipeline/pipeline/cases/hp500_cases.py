"""The 10 real cases: the measured surveys of a Metso HP500 secondary cone crusher at the Minas Rio operation (Table A1 of
Rocha, Campos, Silva and Tavares 2024, CC BY 4.0), each run through the calibrated lane of the canonical engine at its
measured closed-side setting and feed f80 (``operating_from_survey``).

The expectation of a real case rests on the measurement and on the crushing relation, never on the engine's own value:
- throughput: the measured feed rate widened by the strict leave-one-survey-out maximum deviation of CrusherCal (28.84
  percent for t/h, data/derived/hp500/loo.json), rounded up to 29 percent;
- P80: 0.35 to 1.1 times the closed-side setting, the choke-fed crusher relation of Napier-Munn et al. 1996; the paper's
  size distributions are figures only, so the P80 is a model output and is judged by this relation alone;
- reduction ratio: 1.8 to 4, the range of a secondary cone (Metso 2016, Basics in Mineral Processing).
The measured power is shown in the case and compared on the Benchmark page, not asserted here.
"""
from __future__ import annotations

from . import Case, num, text
from ..hp500.surveys import CITATION, SOURCE, Survey
from ..model.crusher import operating_from_survey

CATEGORY = text("Real surveys: Metso HP500 at Minas Rio", "Muestreos reales: Metso HP500 en Minas Rio")
DEVIATION = 0.29                       # fraction: the CrusherCal strict LOO maximum deviation of t/h (28.84 percent) rounded up
P80_OF_CSS = (0.35, 1.1)               # ratio of the product P80 to the closed-side setting [-]
REDUCTION_RATIO = (1.8, 4.0)           # F80 over P80 of a secondary cone [-]


def _expect(s: Survey) -> dict[str, tuple[float, float]]:
    return {
        "throughput_tph": (float(round(s.feed_tph * (1 - DEVIATION))), float(round(s.feed_tph * (1 + DEVIATION)))),
        "p80_mm": (round(P80_OF_CSS[0] * s.css_mm, 2), round(P80_OF_CSS[1] * s.css_mm, 2)),
        "reduction_ratio": REDUCTION_RATIO,
    }


def _case(s: Survey) -> Case:
    ex = _expect(s)
    t_lo, t_hi = ex["throughput_tph"]
    p_lo, p_hi = ex["p80_mm"]
    r_lo, r_hi = ex["reduction_ratio"]
    at_limit = s.f80_mm <= s.css_mm + 1
    n = lambda v, lang: num(v, lang)  # noqa: E731
    band = text(
        f"Survey {s.survey} measured {n(s.feed_tph, 'en')} t/h and {n(s.power_kw, 'en')} kW at a setting of {n(s.css_mm, 'en')} mm and a feed f80 of "
        f"{n(s.f80_mm, 'en')} mm. The calibrated engine should land within 29 percent of the measured throughput, between {n(t_lo, 'en')} and "
        f"{n(t_hi, 'en')} t/h, with a P80 between {n(p_lo, 'en')} and {n(p_hi, 'en')} mm (0.35 to 1.1 times the setting) and a reduction ratio "
        f"between {n(r_lo, 'en')} and {n(r_hi, 'en')}.",
        f"El muestreo {s.survey} midió {n(s.feed_tph, 'es')} t/h y {n(s.power_kw, 'es')} kW con una abertura de {n(s.css_mm, 'es')} mm y un f80 de "
        f"alimentación de {n(s.f80_mm, 'es')} mm. El motor calibrado debe quedar dentro de 29 por ciento del tonelaje medido, entre {n(t_lo, 'es')} y "
        f"{n(t_hi, 'es')} t/h, con un P80 entre {n(p_lo, 'es')} y {n(p_hi, 'es')} mm (0,35 a 1,1 veces la abertura) y una razón de reducción "
        f"entre {n(r_lo, 'es')} y {n(r_hi, 'es')}.")
    problem = text(
        f"Survey {s.survey} of the industrial HP500 secondary cone at Minas Rio is a measurement, not a simulation. The question is how close the "
        "calibrated engine gets to the tonnage the plant actually fed at this setting and this feed size.",
        f"El muestreo {s.survey} del cono secundario industrial HP500 de Minas Rio es una medición, no una simulación. La pregunta es qué tan cerca "
        "llega el motor calibrado al tonelaje que la planta realmente alimentó con esta abertura y este tamaño de alimentación.")
    variables = text(
        f"Measured closed-side setting {n(s.css_mm, 'en')} mm and feed f80 {n(s.f80_mm, 'en')} mm; measured feed rate {n(s.feed_tph, 'en')} t/h and "
        f"power {n(s.power_kw, 'en')} kW. The throw and the speed are the HP500 nominal values and the feed shape is reconstructed from the f80.",
        f"Abertura de lado cerrado medida {n(s.css_mm, 'es')} mm y f80 de alimentación {n(s.f80_mm, 'es')} mm; flujo de alimentación medido "
        f"{n(s.feed_tph, 'es')} t/h y potencia {n(s.power_kw, 'es')} kW. La carrera y la velocidad son los valores nominales del HP500 y la forma "
        "de la alimentación se reconstruye a partir del f80.")
    reading = text(
        "The measured throughput and power are the reference of the gauges; the product size is a model output, since the paper reports it only "
        "in figures. The Benchmark page holds the leave-one-survey-out validation of this survey."
        + (" The feed f80 is at or below the setting here, so the engine flags the point; read it as a limit of the calibrated lane."
           if at_limit else ""),
        "El tonelaje y la potencia medidos son la referencia de los indicadores; el tamaño del producto es una salida del modelo, porque el artículo "
        "lo entrega solo en figuras. La página de Benchmark contiene la validación dejando un muestreo fuera de este muestreo."
        + (" Aquí el f80 de alimentación está en o bajo la abertura, así que el motor marca el punto; léalo como un límite de la vía calibrada."
           if at_limit else ""))
    return Case(
        id=f"HP500-{s.survey:02d}",
        title=text(f"HP500 survey {s.survey}: setting {n(s.css_mm, 'en')} mm, feed f80 {n(s.f80_mm, 'en')} mm",
                   f"Muestreo HP500 {s.survey}: abertura {n(s.css_mm, 'es')} mm, f80 de alimentación {n(s.f80_mm, 'es')} mm"),
        category=CATEGORY, stage="secondary", op=operating_from_survey(s.css_mm, s.f80_mm),
        expected_band=band, context={"problem": problem, "variables": variables, "reading": reading}, expect=ex,
        real_or_synthetic="real",
        source={"kind": "publication", "citation": CITATION, "doi": SOURCE["doi"], "license": SOURCE["license"]},
        measured={"survey": s.survey, "f80_mm": s.f80_mm, "css_mm": s.css_mm, "feed_tph": s.feed_tph, "power_kw": s.power_kw})


def build(surveys: list[Survey]) -> list[Case]:
    """The real cases of the accepted surveys, in survey order."""
    return [_case(s) for s in sorted(surveys, key=lambda s: s.survey)]
