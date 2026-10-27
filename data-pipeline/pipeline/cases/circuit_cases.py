"""The 17 authored circuit cases of ChancaDEM, spanning the comminution circuit: primary gyratory and jaw, the secondary
cone, the tertiary cone and short-head, and three controls. Each case is a complete operating point (the same as the
row of data/examples/params.csv); the workbench loads ONE and every view reacts, and Experiments and Benchmark show
cross-case summaries by category. CP1 and CI1 are deliberate negative and invalid CONTROLS (the engine must show about
zero reduction or flag invalidity, not a pretty plot); CK1 is a synthetic control for absolute numbers (the
product's absolute anchor is the calibrated HP500 lane, not this point).

Every case states its expectation twice: in words (``expected_band``, with the numbers) and as the checked ranges
(``expect``), which fail the bake. The ranges are NOT the engine's own value padded by a percentage: each rests on a
stated engineering relation, namely that a crusher in choke-fed operation delivers a P80 of about 0.7 to 1.1 times its
closed-side setting (Napier-Munn et al. 1996, chapter 5; Metso 2016 Basics in Mineral Processing, crushing), that the
capacity of a machine scales with its discharge opening and peaks at its optimum speed (Evertsson 2000), and that a
setting at or above the feed's F80 leaves the feed nearly untouched. All results are outputs of the calibrated physics
model (the engine), not of a real plant, and the cases say so.
"""
from __future__ import annotations

from . import Case, Text, num, text
from ..model.crusher import Operating

PRIMARY = text("Primary crushing", "Chancado primario")
SECONDARY = text("Secondary cone", "Cono secundario")
TERTIARY = text("Tertiary crushing", "Chancado terciario")
CONTROLS = text("Controls", "Controles")

DEFAULT_CASE = "S01"

_MACHINE = {
    "gyratory": ("primary gyratory crusher", "chancador giratorio primario"),
    "jaw": ("primary jaw crusher", "chancador de mandíbulas primario"),
    "cone-sec": ("secondary cone crusher", "chancador de cono secundario"),
    "cone-tert": ("tertiary cone crusher", "chancador de cono terciario"),
    "cone-short-head": ("short-head tertiary cone crusher", "chancador de cono de cabeza corta terciario"),
}


def variables(op: Operating, lever_en: str, lever_es: str) -> Text:
    """The operating point in words, then the lever that matters in this case."""
    en_m, es_m = _MACHINE[op.machine]
    en = (f"A {en_m} with a closed-side setting of {num(op.css_mm, 'en')} mm, a throw of {num(op.throw_mm, 'en')} mm and "
          f"{num(op.speed_rpm, 'en')} rpm, on a Rosin-Rammler feed with x63 of {num(op.feed_x63_mm, 'en')} mm and m of "
          f"{num(op.feed_m, 'en')}, in an ore with A times b of {num(op.ore_axb, 'en')} and a Bond work index of "
          f"{num(op.ore_wi, 'en')} kWh/t. {lever_en}")
    es = (f"Un {es_m} con abertura de lado cerrado de {num(op.css_mm, 'es')} mm, carrera de {num(op.throw_mm, 'es')} mm y "
          f"{num(op.speed_rpm, 'es')} rpm, sobre una alimentación Rosin-Rammler con x63 de {num(op.feed_x63_mm, 'es')} mm y m de "
          f"{num(op.feed_m, 'es')}, en un mineral con A por b de {num(op.ore_axb, 'es')} e índice de trabajo de Bond de "
          f"{num(op.ore_wi, 'es')} kWh/t. {lever_es}")
    return text(en, es)


def _case(cid: str, title: Text, category: Text, stage: str, op: Operating, band: Text, problem: Text, lever: Text,
          reading: Text, expect: dict[str, tuple[float, float]], control: str | None = None) -> Case:
    return Case(id=cid, title=title, category=category, stage=stage, op=op, expected_band=band,
                context={"problem": problem, "variables": variables(op, lever["en"], lever["es"]), "reading": reading},
                expect=expect, control=control)


CASES: list[Case] = [
    # ---- PRIMARY: gyratory and jaw (coarse run-of-mine feed, wide settings, slow) ----
    _case(
        "G01", text("Gyratory primary, hard ore, run-of-mine feed", "Giratorio primario, mineral duro, alimentación a granel"),
        PRIMARY, "primary", Operating("gyratory", 165, 30, 150, 600, 0.8, 40, 16),
        text("Very high tonnage and a modest reduction: P80 between 115 and 182 mm, between 3500 and 5500 t/h and a reduction ratio between 1.05 and 1.5.",
             "Tonelaje muy alto y reducción modesta: P80 entre 115 y 182 mm, entre 3500 y 5500 t/h y razón de reducción entre 1,05 y 1,5."),
        text("A primary gyratory takes the whole run-of-mine stream of a hard orebody and must deliver a product the secondary stage can handle. The question is how much size it removes at the tonnage it is bought for.",
             "Un giratorio primario recibe toda la corriente de mina de un cuerpo mineralizado duro y debe entregar un producto que la etapa secundaria pueda manejar. La pregunta es cuánto tamaño reduce al tonelaje para el que se compra."),
        text("The setting sets the product and the discharge opening; the slow gyration of the primary keeps the capacity near its optimum.",
             "La abertura fija el producto y la abertura de descarga; la gyración lenta del primario mantiene la capacidad cerca de su óptimo."),
        text("Read the product curve against the feed curve: the two are close, because a primary reduces by a factor of one to two, not by the factor of four a cone gives. The capacity is the point of this machine.",
             "Lea la curva del producto frente a la de alimentación: son cercanas, porque un primario reduce por un factor de uno a dos y no por el factor de cuatro de un cono. La capacidad es el sentido de esta máquina."),
        {"p80_mm": (115, 182), "throughput_tph": (3500, 5500), "reduction_ratio": (1.05, 1.5)}),
    _case(
        "G02", text("Gyratory primary, soft ore, high tonnage", "Giratorio primario, mineral blando, alto tonelaje"),
        PRIMARY, "primary", Operating("gyratory", 195, 32, 160, 700, 0.85, 78, 12),
        text("The widest setting of the primary cases sits at the feed's F80, so the feed is barely touched: P80 between 140 and 200 mm, a reduction ratio between 1 and 1.3 and the highest tonnage of the matrix, between 4500 and 6500 t/h. The engine flags the point as pass-through.",
             "La abertura más ancha de los casos primarios queda en el F80 de la alimentación, así que el material casi no se toca: P80 entre 140 y 200 mm, razón de reducción entre 1 y 1,3 y el mayor tonelaje de la matriz, entre 4500 y 6500 t/h. El motor marca el punto como paso directo."),
        text("Soft ore lets the plant open the primary to the limit and chase tonnage. The question is where that stops being crushing and starts being a chute.",
             "El mineral blando permite abrir el primario al máximo y buscar tonelaje. La pregunta es dónde eso deja de ser chancado y pasa a ser una canaleta."),
        text("The setting is the lever: once it reaches the F80 of the feed the pass-through flag appears and the reduction ratio falls toward one.",
             "La abertura es la palanca: cuando alcanza el F80 de la alimentación aparece la marca de paso directo y la razón de reducción cae hacia uno."),
        text("Compare it with G01: the same machine at a setting 30 mm wider gives more tonnage and almost no size reduction. The flag is the engine telling the truth, not an error.",
             "Compárelo con G01: la misma máquina con una abertura 30 mm mayor da más tonelaje y casi ninguna reducción de tamaño. La marca es el motor diciendo la verdad, no un error."),
        {"p80_mm": (140, 200), "throughput_tph": (4500, 6500), "reduction_ratio": (1, 1.3)}),
    _case(
        "J01", text("Jaw primary, hard ore, run-of-mine feed", "Mandíbulas primario, mineral duro, alimentación a granel"),
        PRIMARY, "primary", Operating("jaw", 125, 40, 300, 400, 0.9, 42, 16),
        text("A near-setting product at a wide opening: P80 between 90 and 140 mm, between 700 and 1100 t/h and a reduction ratio between 1.2 and 1.8.",
             "Un producto cercano a la abertura con una abertura ancha: P80 entre 90 y 140 mm, entre 700 y 1100 t/h y razón de reducción entre 1,2 y 1,8."),
        text("A single-toggle jaw is the classic primary for hard, blocky run-of-mine ore at moderate tonnage. The question is what product it hands to the next stage.",
             "Un chancador de mandíbulas de una sola articulación es el primario clásico para mineral duro y en bloques a tonelaje moderado. La pregunta es qué producto entrega a la etapa siguiente."),
        text("The closed-side setting sets the product almost one to one; the throw adds capacity and a coarser tail.",
             "La abertura de lado cerrado fija el producto casi uno a uno; la carrera agrega capacidad y una cola más gruesa."),
        text("Read how close the product P80 is to the setting: that is the jaw signature, and the reason a secondary stage follows. The cone stages that come next do the fine work.",
             "Lea qué tan cerca está el P80 del producto de la abertura: esa es la firma del chancador de mandíbulas y la razón de que siga una etapa secundaria. Las etapas de cono que vienen después hacen el trabajo fino."),
        {"p80_mm": (90, 140), "throughput_tph": (700, 1100), "reduction_ratio": (1.2, 1.8)}),
    _case(
        "J02", text("Jaw primary, medium ore, trickle feed", "Mandíbulas primario, mineral medio, alimentación a goteo"),
        PRIMARY, "primary", Operating("jaw", 80, 36, 280, 300, 1.0, 55, 14),
        text("A tighter jaw gives a finer product at lower tonnage: P80 between 56 and 90 mm, between 450 and 800 t/h and a reduction ratio between 1.8 and 2.8.",
             "Un chancador de mandíbulas más cerrado da un producto más fino con menor tonelaje: P80 entre 56 y 90 mm, entre 450 y 800 t/h y razón de reducción entre 1,8 y 2,8."),
        text("When the feed trickles in below choke the jaw works with low fill. The question is how much finer the product is than in the wide, hard case J01.",
             "Cuando la alimentación llega a goteo bajo el atoramiento, el chancador trabaja con poco llenado. La pregunta es cuánto más fino es el producto que en el caso ancho y duro J01."),
        text("The setting is the lever for both the product and the capacity: closing it from 125 to 80 mm cuts the tonnage and the product size together.",
             "La abertura es la palanca del producto y de la capacidad: cerrarla de 125 a 80 mm reduce a la vez el tonelaje y el tamaño del producto."),
        text("Put J01 and J02 side by side: the reduction ratio rises by half while the tonnage drops. That is the trade a primary operator manages every day.",
             "Ponga J01 y J02 lado a lado: la razón de reducción sube en la mitad mientras baja el tonelaje. Ese es el compromiso que un operador de primario maneja cada día."),
        {"p80_mm": (56, 90), "throughput_tph": (450, 800), "reduction_ratio": (1.8, 2.8)}),
    # ---- SECONDARY: cone (the workhorse; S01 is the reference operating point shown on first load) ----
    _case(
        "S01", text("Cone secondary, medium ore, choke feed", "Cono secundario, mineral medio, alimentación atorada"),
        SECONDARY, "secondary", Operating("cone-sec", 32, 30, 360, 90, 1.2, 55, 14),
        text("The reference point: a well-graded choke feed at the capacity optimum gives a P80 between 22 and 35 mm, between 520 and 780 t/h and a reduction ratio between 3.5 and 5.5.",
             "El punto de referencia: una alimentación bien graduada y atorada en el óptimo de capacidad da un P80 entre 22 y 35 mm, entre 520 y 780 t/h y razón de reducción entre 3,5 y 5,5."),
        text("The secondary cone is the workhorse of the circuit, and S01 is the operating point every other case is read against. The question is what a well-run secondary delivers.",
             "El cono secundario es el caballo de batalla del circuito, y S01 es el punto de operación frente al cual se lee cada otro caso. La pregunta es qué entrega un secundario bien operado."),
        text("Setting and speed move the product and the capacity most; the speed at which capacity peaks is 360 rpm for this machine.",
             "La abertura y la velocidad son las que más mueven el producto y la capacidad; la velocidad a la que la capacidad alcanza su máximo es 360 rpm para esta máquina."),
        text("Read the speed sweep: the capacity hump peaks right at the operating speed. Every other secondary case is a departure from this point.",
             "Lea el barrido de velocidad: la joroba de capacidad alcanza su máximo justo en la velocidad de operación. Cada otro caso secundario es una desviación de este punto."),
        {"p80_mm": (22, 35), "throughput_tph": (520, 780), "reduction_ratio": (3.5, 5.5)}),
    _case(
        "S02", text("Cone secondary, soft ore, coarse feed", "Cono secundario, mineral blando, alimentación gruesa"),
        SECONDARY, "secondary", Operating("cone-sec", 40, 32, 300, 120, 1.0, 80, 11),
        text("A wider setting and a soft ore lift the capacity above S01 even below the optimum speed: P80 between 28 and 44 mm, between 660 and 900 t/h and a reduction ratio between 3.3 and 5.",
             "Una abertura mayor y un mineral blando elevan la capacidad sobre S01 aun bajo la velocidad óptima: P80 entre 28 y 44 mm, entre 660 y 900 t/h y razón de reducción entre 3,3 y 5."),
        text("Soft ore with a coarse feed tempts the operator to open the setting and slow the machine. The question is what that costs in product size and what it gains in tonnage.",
             "El mineral blando con alimentación gruesa tienta al operador a abrir la abertura y bajar la velocidad. La pregunta es qué cuesta eso en tamaño de producto y qué gana en tonelaje."),
        text("The opening raises the capacity while the speed below the optimum takes some of it back.",
             "La abertura eleva la capacidad mientras la velocidad bajo el óptimo se lleva parte de ella."),
        text("Compare with S01: the product is coarser by about the extra setting, the tonnage is higher, and the power draw is lower. The wider opening is the reason, and the lower speed keeps the capacity from rising further.",
             "Compare con S01: el producto es más grueso en proporción a la abertura adicional, el tonelaje es mayor y la potencia es menor. La abertura mayor es la razón, y la menor velocidad impide que la capacidad suba aún más."),
        {"p80_mm": (28, 44), "throughput_tph": (660, 900), "reduction_ratio": (3.3, 5)}),
    _case(
        "S03", text("Cone secondary, hard ore, over-speed", "Cono secundario, mineral duro, sobrevelocidad"),
        SECONDARY, "secondary", Operating("cone-sec", 50, 30, 470, 130, 1.0, 38, 17),
        text("Past the capacity hump the tonnage falls as the speed rises: between 650 and 1100 t/h, below what the same machine gives at its optimum speed, with P80 between 35 and 55 mm and a reduction ratio between 3 and 4.5.",
             "Pasada la joroba de capacidad el tonelaje cae al subir la velocidad: entre 650 y 1100 t/h, menos de lo que la misma máquina da en su velocidad óptima, con P80 entre 35 y 55 mm y razón de reducción entre 3 y 4,5."),
        text("More speed looks like more crushing, but the gyrating head starts to obstruct the fall of material. The question is where the extra revolutions stop paying.",
             "Más velocidad parece más chancado, pero la cabeza en gyración empieza a obstruir la caída del material. La pregunta es dónde dejan de rendir las revoluciones adicionales."),
        text("The speed is the lever; the speed sweep shows the hump and this case sits on its falling side.",
             "La velocidad es la palanca; el barrido de velocidad muestra la joroba y este caso queda en su lado descendente."),
        text("The marker of the operating speed sits to the right of the peak in the speed sweep. Read the tonnage lost against the same setting at the optimum speed.",
             "El marcador de la velocidad de operación queda a la derecha del máximo en el barrido de velocidad. Lea el tonelaje perdido frente a la misma abertura en la velocidad óptima."),
        {"p80_mm": (35, 55), "throughput_tph": (650, 1100), "reduction_ratio": (3, 4.5)}),
    _case(
        "S04", text("Cone secondary, hard ore, run-of-mine feed", "Cono secundario, mineral duro, alimentación a granel"),
        SECONDARY, "secondary", Operating("cone-sec", 80, 36, 360, 180, 0.9, 40, 16),
        text("A heavy-duty secondary on a coarse feed at the optimum: P80 between 56 and 88 mm, between 1000 and 1700 t/h and a reduction ratio between 1.8 and 3.",
             "Un secundario de servicio pesado sobre alimentación gruesa en el óptimo: P80 entre 56 y 88 mm, entre 1000 y 1700 t/h y razón de reducción entre 1,8 y 3."),
        text("Some plants run the secondary directly on run-of-mine fragments. The question is how coarse the product becomes and how much tonnage the wide opening buys.",
             "Algunas plantas operan el secundario directamente sobre fragmentos de mina. La pregunta es cuán grueso queda el producto y cuánto tonelaje compra la abertura ancha."),
        text("The setting dominates: at 80 mm the product is the coarsest of the secondary cases and the capacity the highest.",
             "La abertura domina: con 80 mm el producto es el más grueso de los casos secundarios y la capacidad la mayor."),
        text("Compare with S01: a setting 2.5 times larger gives a product about 2.5 times coarser. The reduction ratio shows how little work the machine does here.",
             "Compare con S01: una abertura 2,5 veces mayor da un producto cerca de 2,5 veces más grueso. La razón de reducción muestra cuán poco trabajo hace la máquina aquí."),
        {"p80_mm": (56, 88), "throughput_tph": (1000, 1700), "reduction_ratio": (1.8, 3)}),
    _case(
        "S05", text("Cone secondary, fines-heavy feed", "Cono secundario, alimentación con muchos finos"),
        SECONDARY, "secondary", Operating("cone-sec", 16, 26, 360, 55, 1.6, 55, 14),
        text("A tight setting on a fine feed gives a high reduction and a fine product, finer than S01: P80 between 11 and 18 mm, between 300 and 500 t/h and a reduction ratio between 4.5 and 7.",
             "Una abertura cerrada sobre alimentación fina da una reducción alta y un producto fino, más fino que S01: P80 entre 11 y 18 mm, entre 300 y 500 t/h y razón de reducción entre 4,5 y 7."),
        text("A fines-heavy feed packs the chamber and cuts the capacity, yet it is what many plants deliver after screening. The question is what a tight setting makes of it.",
             "Una alimentación con muchos finos empaqueta la cámara y reduce la capacidad, pero es lo que muchas plantas entregan después de cribar. La pregunta es qué hace de ella una abertura cerrada."),
        text("The setting and the feed uniformity are the levers: a high m means few oversize particles, so the cone works on material already near its setting.",
             "La abertura y la uniformidad de la alimentación son las palancas: una m alta significa pocas partículas sobretamaño, así que el cono trabaja material ya cercano a su abertura."),
        text("Read the product curve against S01: it is shifted to the fine side by about half. Watch the capacity, which falls with the opening.",
             "Lea la curva del producto frente a S01: queda desplazada hacia lo fino en cerca de la mitad. Observe la capacidad, que cae con la abertura."),
        {"p80_mm": (11, 18), "throughput_tph": (300, 500), "reduction_ratio": (4.5, 7)}),
    _case(
        "S06", text("Cone secondary, trickle feed", "Cono secundario, alimentación a goteo"),
        SECONDARY, "secondary", Operating("cone-sec", 12, 22, 360, 60, 1.2, 55, 14),
        text("The tightest secondary setting gives a product near the setting and a very high reduction, far finer than the reference case: P80 between 7 and 13 mm, between 230 and 420 t/h and a reduction ratio between 7 and 12.",
             "La abertura secundaria más cerrada da un producto cercano a la abertura y una reducción muy alta, mucho más fino que el caso de referencia: P80 entre 7 y 13 mm, entre 230 y 420 t/h y razón de reducción entre 7 y 12."),
        text("Feeding a cone one particle at a time, at low fill, makes it behave like a sizing device. The question is how close to the setting the product comes.",
             "Alimentar un cono una partícula a la vez, con poco llenado, lo hace comportarse como un dispositivo de calibración. La pregunta es qué tan cerca de la abertura queda el producto."),
        text("The setting is the only lever that matters here; the speed and the feed change little once the chamber is not full.",
             "La abertura es la única palanca que importa aquí; la velocidad y la alimentación cambian poco cuando la cámara no está llena."),
        text("The product P80 is within a third of the setting. The price is energy: the power draw is among the highest of the secondary cases.",
             "El P80 del producto está a un tercio de la abertura. El precio es la energía: la potencia está entre las más altas de los casos secundarios."),
        {"p80_mm": (7, 13), "throughput_tph": (230, 420), "reduction_ratio": (7, 12)}),
    # ---- TERTIARY: cone-tertiary and short-head (fine feed, tight settings, fast) ----
    _case(
        "T01", text("Cone tertiary, fine feed", "Cono terciario, alimentación fina"),
        TERTIARY, "tertiary", Operating("cone-tert", 8, 16, 400, 28, 1.5, 55, 14),
        text("A fine feed and a tight setting at the tertiary optimum speed: P80 between 5.5 and 9 mm, between 180 and 320 t/h and a reduction ratio between 4.2 and 7.",
             "Una alimentación fina y una abertura cerrada en la velocidad óptima terciaria: P80 entre 5,5 y 9 mm, entre 180 y 320 t/h y razón de reducción entre 4,2 y 7."),
        text("The tertiary stage prepares the feed of the mills or the screens. The question is what product a tertiary cone makes at an 8 mm setting.",
             "La etapa terciaria prepara la alimentación de los molinos o de las cribas. La pregunta es qué producto hace un cono terciario con una abertura de 8 mm."),
        text("The setting and the faster optimum speed of the tertiary machine are the levers.",
             "La abertura y la velocidad óptima más alta de la máquina terciaria son las palancas."),
        text("Compare with the secondary cases: the tonnage is a third of S01 and the product is a quarter of its size. A tertiary stage trades tonnage for fineness.",
             "Compare con los casos secundarios: el tonelaje es un tercio del de S01 y el producto tiene un cuarto de su tamaño. Una etapa terciaria cambia tonelaje por finura."),
        {"p80_mm": (5.5, 9), "throughput_tph": (180, 320), "reduction_ratio": (4.2, 7)}),
    _case(
        "T02", text("Cone tertiary, hard ore, closed setting", "Cono terciario, mineral duro, abertura cerrada"),
        TERTIARY, "tertiary", Operating("cone-tert", 10, 18, 410, 32, 1.4, 38, 18),
        text("Hard ore at a closed setting reaches the fine end with a high energy: P80 between 7 and 11 mm, between 220 and 360 t/h and a reduction ratio between 3.8 and 6.",
             "Mineral duro con abertura cerrada llega al extremo fino con alta energía: P80 entre 7 y 11 mm, entre 220 y 360 t/h y razón de reducción entre 3,8 y 6."),
        text("Hard ore makes the tertiary stage the energy sink of the crushing circuit. The question is the product and the power at a 10 mm setting.",
             "El mineral duro hace de la etapa terciaria el sumidero de energía del circuito de chancado. La pregunta es el producto y la potencia con una abertura de 10 mm."),
        text("The ore competence and the setting set the specific energy and the product.",
             "La competencia del mineral y la abertura fijan la energía específica y el producto."),
        text("Compare with T01: a slightly wider setting and a harder ore give a slightly coarser product and a higher power draw at similar tonnage. Hard ore raises the power draw rather than the tonnage.",
             "Compare con T01: una abertura algo mayor y un mineral más duro dan un producto algo más grueso y mayor potencia con tonelaje similar. El mineral duro eleva la potencia más que el tonelaje."),
        {"p80_mm": (7, 11), "throughput_tph": (220, 360), "reduction_ratio": (3.8, 6)}),
    _case(
        "H01", text("Short-head tertiary, fine product", "Cabeza corta terciario, producto fino"),
        TERTIARY, "tertiary", Operating("cone-short-head", 6, 14, 500, 22, 1.6, 55, 14),
        text("The finest product of the matrix at the fastest speed: P80 between 3.5 and 6.6 mm, between 160 and 280 t/h and a reduction ratio between 5 and 8.5.",
             "El producto más fino de la matriz con la velocidad más alta: P80 entre 3,5 y 6,6 mm, entre 160 y 280 t/h y razón de reducción entre 5 y 8,5."),
        text("A short-head cone has a long parallel zone and a steep head, built for fine, well-shaped product. The question is how fine it goes and at what tonnage.",
             "Un cono de cabeza corta tiene una zona paralela larga y una cabeza empinada, hecho para producto fino y de buena forma. La pregunta es cuán fino llega y con qué tonelaje."),
        text("The 6 mm setting and the 500 rpm speed define the duty.",
             "La abertura de 6 mm y la velocidad de 500 rpm definen el servicio."),
        text("Read it as the fine end of the matrix: the lowest tonnage, the finest P80 and the highest reduction ratio of the tertiary cases. Nothing else in the matrix reaches this fineness.",
             "Léalo como el extremo fino de la matriz: el menor tonelaje, el P80 más fino y la mayor razón de reducción de los casos terciarios. Nada más en la matriz alcanza esta finura."),
        {"p80_mm": (3.5, 6.6), "throughput_tph": (160, 280), "reduction_ratio": (5, 8.5)}),
    _case(
        "H02", text("Short-head tertiary, hard ore, choke feed", "Cabeza corta terciario, mineral duro, alimentación atorada"),
        TERTIARY, "tertiary", Operating("cone-short-head", 10, 16, 470, 30, 1.5, 36, 18),
        text("Choke feed on hard ore gives the tightest classification and a high specific energy: P80 between 6.5 and 11 mm, between 230 and 370 t/h and a reduction ratio between 4 and 6.2.",
             "La alimentación atorada sobre mineral duro da la clasificación más estricta y una energía específica alta: P80 entre 6,5 y 11 mm, entre 230 y 370 t/h y razón de reducción entre 4 y 6,2."),
        text("Choke feeding keeps the chamber full, which is how a short-head is meant to run. The question is what the hard ore does to the power.",
             "La alimentación atorada mantiene la cámara llena, que es como debe operar una cabeza corta. La pregunta es qué hace el mineral duro a la potencia."),
        text("Ore hardness and feed fullness are the levers here.",
             "La dureza del mineral y el llenado de la alimentación son las palancas aquí."),
        text("Compare with H01: a wider setting and a harder ore give a coarser product and a higher power draw at higher tonnage. The hardness shows in the power more than in the product size.",
             "Compare con H01: una abertura mayor y un mineral más duro dan un producto más grueso y mayor potencia con mayor tonelaje. La dureza se nota más en la potencia que en el tamaño del producto."),
        {"p80_mm": (6.5, 11), "throughput_tph": (230, 370), "reduction_ratio": (4, 6.2)}),
    # ---- CONTROLS (must not render silent garbage) ----
    _case(
        "CP1", text("Pass-through, negative control", "Paso directo, control negativo"),
        CONTROLS, "control", Operating("cone-sec", 160, 30, 360, 90, 1.2, 55, 14),
        text("A setting wider than the F80: the material passes mostly ungripped, with P80 between 100 and 126 mm, a reduction ratio between 1 and 1.3 and between 1900 and 2900 t/h. The engine flags the pass-through regime.",
             "Una abertura mayor que el F80: el material pasa casi sin agarrarse, con P80 entre 100 y 126 mm, razón de reducción entre 1 y 1,3 y entre 1900 y 2900 t/h. El motor marca el régimen de paso directo."),
        text("A model that shows a pretty product curve for a crusher that is not crushing is worse than no model. This control asks the engine to show nothing happening.",
             "Un modelo que muestra una curva de producto vistosa para un chancador que no chanca es peor que ningún modelo. Este control le pide al motor que muestre que no ocurre nada."),
        text("The setting is 160 mm against a feed F80 of 126 mm, everything else as in S01.",
             "La abertura es 160 mm frente a un F80 de alimentación de 126 mm, todo lo demás como en S01."),
        text("The product curve lies on the feed curve and the power is a fraction of S01. If a view shows a clear reduction here, the view is wrong.",
             "La curva del producto queda sobre la de alimentación y la potencia es una fracción de la de S01. Si una vista muestra aquí una reducción clara, la vista está mal."),
        {"p80_mm": (100, 126), "throughput_tph": (1900, 2900), "reduction_ratio": (1, 1.3)}, control="negative"),
    _case(
        "CI1", text("Setting above the feed top size, invalid control", "Abertura sobre el tamaño máximo, control inválido"),
        CONTROLS, "control", Operating("cone-sec", 280, 30, 360, 90, 1.2, 55, 14),
        text("A setting wider than the 256 mm top size of the feed is physically meaningless: P80 between 120 and 130 mm and a reduction ratio between 0.95 and 1.05. The engine must flag the point invalid with the code css_ge_feed_top.",
             "Una abertura mayor que el tamaño máximo de 256 mm de la alimentación no tiene sentido físico: P80 entre 120 y 130 mm y razón de reducción entre 0,95 y 1,05. El motor debe marcar el punto como inválido con el código css_ge_feed_top."),
        text("A tool that accepts any slider position must say when a position is not a crusher. This control puts the setting beyond every particle of the feed.",
             "Una herramienta que acepta cualquier posición de un control deslizante debe decir cuándo una posición no es un chancador. Este control pone la abertura más allá de cada partícula de la alimentación."),
        text("The setting is 280 mm, above the feed top size; the rest is as in S01.",
             "La abertura es 280 mm, sobre el tamaño máximo de la alimentación; el resto es como en S01."),
        text("The product equals the feed and the case is flagged invalid. A view that renders it without the flag is silently wrong.",
             "El producto es igual a la alimentación y el caso queda marcado como inválido. Una vista que lo muestre sin la marca está en silencio equivocada."),
        {"p80_mm": (120, 130), "reduction_ratio": (0.95, 1.05)}, control="invalid"),
    _case(
        "CK1", text("Absolute-number control, HP-class cone", "Control de números absolutos, cono de clase HP"),
        CONTROLS, "control", Operating("cone-sec", 25, 30, 350, 80, 1.15, 52, 15),
        text("A synthetic control at a typical operating point of an HP-class secondary cone, kept to check absolute numbers: P80 between 17 and 28 mm, between 450 and 650 t/h and a reduction ratio between 4 and 6.5.",
             "Un control sintético en un punto de operación típico de un cono secundario de clase HP, para verificar números absolutos: P80 entre 17 y 28 mm, entre 450 y 650 t/h y razón de reducción entre 4 y 6,5."),
        text("The shape of the curves is not enough: a decision needs the absolute numbers right. The absolute anchor of this product is the calibrated HP500 lane (Rocha et al. 2024, CrusherCal), the ten measured surveys of a Metso HP500; this point is not fitted to it. Duarte et al. 2021 cannot serve as the anchor: the paper gives the setting, throughput and feed F80 of seven points of an HP400 and a CH660, but no throw, speed, ore properties or power (Table 1, p. 9), and its size distributions are plots only (Figures 4 to 9).",
             "La forma de las curvas no basta: una decisión necesita los números absolutos correctos. El ancla absoluta de este producto es el carril HP500 calibrado (Rocha et al. 2024, CrusherCal), los diez muestreos medidos de un Metso HP500; este punto no está ajustado a él. Duarte et al. 2021 no puede ser el ancla: el artículo da la abertura, el flujo y el F80 de alimentación de siete puntos de un HP400 y un CH660, pero no el recorrido, la velocidad, las propiedades del mineral ni la potencia (Tabla 1, p. 9), y sus distribuciones de tamaño son solo gráficos (Figuras 4 a 9)."),
        text("The setting of 25 mm and the 350 rpm speed place it between S01 and S05.",
             "La abertura de 25 mm y la velocidad de 350 rpm lo ubican entre S01 y S05."),
        text("CK1 stays a synthetic control, so these ranges come from the crushing relation of the setting and not from measured data. Its reduction ratio sits above the typical ceiling of 5 for one secondary-cone stage, so the engine also raises the warning reduction_ratio_above_typical; the point stays valid. The measured HP500 surveys are the real check of the absolute numbers.",
             "CK1 sigue siendo un control sintético, así que estos rangos vienen de la relación de chancado con la abertura y no de datos medidos. Su razón de reducción supera el techo típico de 5 para una etapa de cono secundario, así que el motor también emite la advertencia reduction_ratio_above_typical; el punto sigue siendo válido. Los muestreos HP500 medidos son la verificación real de los números absolutos."),
        {"p80_mm": (17, 28), "throughput_tph": (450, 650), "reduction_ratio": (4, 6.5)}, control="calibration"),
]
