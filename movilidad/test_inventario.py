"""Casos pequeños del simulador de inventario (T32). Se ejecuta desde la raíz:

    python movilidad/test_inventario.py
"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from inventario import Demanda, Red, dimensionar, referencia, repartir, repartir_flota, simular  # noqa: E402
from bateria import Carga  # noqa: E402

DIA = 86_400
T0 = 10 * DIA + 8 * 3600   # un día cualquiera a las 8 h


def red(n, entre=None):
    entre = np.ones((n, n)) * 100 - np.eye(n) * 100 if entre is None else np.asarray(entre, float)
    return Red(np.array([f"E{i}" for i in range(n)]), np.zeros(n), np.zeros(n), 300.0, entre)


def demanda(viajes):
    """viajes: (t_o, t_d, opciones de origen, opciones de destino); distancias 0, 10, 20…"""
    t_o = np.array([v[0] for v in viajes], np.int64)
    t_d = np.array([v[1] for v in viajes], np.int64)
    opc_o = [np.array(v[2], int) for v in viajes]
    opc_d = [np.array(v[3], int) for v in viajes]
    return Demanda(np.arange(len(viajes)), t_o, t_d, opc_o, [10.0 * np.arange(len(x)) for x in opc_o],
                   opc_d, [10.0 * np.arange(len(x)) for x in opc_d])


def sim(dem, r, stock, anclajes, rebalanceo=0, **kw):
    return simular(dem, r, stock, anclajes, rebalanceo, factor_rodeo=1.0, **kw)


def test_llegada_antes_que_salida():
    # E0 empieza vacía; un patinete llega a E0 en el mismo segundo en que otro viaje sale de allí.
    dem = demanda([(T0, T0 + 600, [1], [0]), (T0 + 600, T0 + 900, [0], [1])])
    r = sim(dem, red(2), [0, 1], [2, 2])
    assert list(r.viajes["resultado"]) == ["atendido", "atendido"]


def test_reserva_de_anclaje():
    # E1 tiene un solo anclaje. El primer viaje lo reserva; el segundo, que sale antes de que
    # llegue el primero, no encuentra hueco.
    dem = demanda([(T0, T0 + 600, [0], [1]), (T0 + 60, T0 + 300, [2], [1])])
    r = sim(dem, red(3), [1, 0, 1], [2, 1, 2])
    assert list(r.viajes["resultado"]) == ["atendido", "sin_anclaje"]
    # El patinete del viaje rechazado no se ha movido.
    assert list(r.estaciones["stock_final"]) == [0, 1, 1]


def test_viaje_circular_usa_su_hueco():
    # Estación llena (1 de 1): el viaje que vuelve a ella cabe en el hueco que deja al salir.
    dem = demanda([(T0, T0 + 600, [0], [0])])
    r = sim(dem, red(1), [1], [1])
    assert r.viajes.loc[0, "resultado"] == "atendido"


def test_desvio_dentro_del_radio():
    # La más cercana del origen está vacía: con desvío se toma la segunda.
    dem = demanda([(T0, T0 + 600, [0, 1], [2])])
    con = sim(dem, red(3), [0, 1, 0], [2, 2, 2])
    sin = sim(dem, red(3), [0, 1, 0], [2, 2, 2], desvio=False)
    assert con.viajes.loc[0, "resultado"] == "atendido"
    assert con.viajes.loc[0, "estacion_origen"] == "E1" and con.viajes.loc[0, "desvio_origen_m"] == 10
    assert sin.viajes.loc[0, "resultado"] == "sin_patinete"


def test_sin_cobertura_no_toca_el_inventario():
    dem = demanda([(T0, T0 + 600, [], [0]), (T0, T0 + 600, [0], [])])
    r = sim(dem, red(1), [1], [2])
    assert list(r.viajes["resultado"]) == ["sin_cobertura", "sin_cobertura"]
    assert r.estaciones.loc[0, "stock_final"] == 1


def test_carga_fraccionaria_y_recuperacion_en_anclaje():
    dem = demanda([(T0, T0 + 60, [0], [0]), (T0 + 60, T0 + 120, [0], [0]),
                   (T0 + 420, T0 + 480, [0], [0])])
    r = sim(dem, red(1), [1], [1], carga=Carga(np.array([70.25, 30.5, 30.5]), 100, 1))
    assert r.viajes["resultado"].tolist() == ["atendido", "sin_bateria", "atendido"]
    assert np.isclose(r.resumen["traccion_kwh"], 0.10075)
    assert np.isclose(r.resumen["traccion_kwh"], r.resumen["recargada_kwh"] + r.resumen["pendiente_kwh"])


def test_sin_recarga_en_anclaje_agota_la_bateria():
    # Sin recarga, la segunda salida ya no tiene energía aunque pasen horas en el anclaje.
    dem = demanda([(T0, T0 + 60, [0], [0]), (T0 + 7200, T0 + 7260, [0], [0])])
    r = sim(dem, red(1), [1], [1], carga=Carga(np.array([70., 40.]), 100, 1, recarga_en_anclaje=False))
    assert r.viajes["resultado"].tolist() == ["atendido", "sin_bateria"]
    assert r.resumen["n_sin_bateria"] == 1
    assert np.isclose(r.resumen["recargada_kwh"], 0)
    assert np.isclose(r.resumen["pendiente_kwh"], 0.07)


def test_cierre_conserva_reserva_y_desvia_nuevas_asignaciones():
    dem = demanda([(T0, T0 + 600, [0], [1]), (T0 + 100, T0 + 200, [0], [1, 2]),
                   (T0 + 100, T0 + 200, [1], [0])])
    r = sim(dem, red(3), [2, 0, 0], [2, 1, 2], cierre=(1, T0 + 60, T0 + 700))
    assert r.viajes["resultado"].tolist() == ["atendido", "atendido", "sin_estacion"]
    assert r.resumen["n_sin_estacion"] == 1
    assert r.viajes["estacion_destino"].tolist() == ["E1", "E2", ""]
    assert r.estaciones["stock_final"].tolist() == [0, 1, 1]
    assert r.estaciones.loc[1, "pct_llena_ventana"] == 100


def test_rebalanceo_limitado_y_conservacion():
    # Tres viajes de E0 a E1 el día 1. A las 4 h se devuelven como mucho 2.
    viajes = [(T0 + k * 60, T0 + k * 60 + 300, [0], [1]) for k in range(3)]
    viajes.append((T0 + DIA, T0 + DIA + 300, [0], [1]))     # al día siguiente
    dem = demanda(viajes)
    r = sim(dem, red(2), [3, 0], [3, 3], rebalanceo=2)
    assert r.noches["patinetes_movidos"].tolist() == [2]
    assert r.noches["km"].tolist() == [0.2]
    assert r.noches["deficit_despues"].tolist() == [1]
    assert list(r.viajes["resultado"]) == ["atendido"] * 4
    assert r.estaciones["stock_final"].sum() == 3


def test_cada_solicitud_un_resultado_y_capacidad():
    rng = np.random.default_rng(1)
    viajes = []
    for _ in range(300):
        t = T0 + int(rng.integers(0, 3 * DIA))
        viajes.append((t, t + int(rng.integers(60, 1800)),
                       list(rng.permutation(4)[: rng.integers(0, 3)]), list(rng.permutation(4)[: rng.integers(0, 3)])))
    dem = demanda(viajes)
    r = sim(dem, red(4), [2, 1, 0, 3], [3, 2, 2, 4], rebalanceo=3)
    assert r.viajes["resultado"].ne("").all()
    assert sum(r.resumen[f"n_{c}"] for c in ("atendido", "sin_cobertura", "sin_patinete", "sin_anclaje")) == 300
    assert r.estaciones["stock_final"].sum() == 6
    assert (r.estaciones["ocupacion_media_pct"] <= 100).all()


def test_referencia_y_dimensionado():
    # E0: salen 2 y luego llega 1 → stock 2, pico 2. E1: llegan 2 y sale 1 → stock 0, pico 2.
    dem = demanda([(T0, T0 + 100, [0], [1]), (T0 + 10, T0 + 200, [0], [1]), (T0 + 300, T0 + 400, [1], [0])])
    ref = referencia(dem, 2)
    assert ref["stock_mes"].tolist() == [2, 0]
    assert ref["anclajes_mes"].tolist() == [2, 2]
    stock, anclajes = dimensionar(ref, 1.0)
    assert stock.tolist() == [2, 1] and anclajes.tolist() == [2, 3]
    r = sim(dem, red(2), stock, anclajes)
    assert r.resumen["n_atendido"] == 3


def test_repartir():
    assert repartir([1, 1, 2], 7).tolist() == [2, 2, 3]
    assert repartir([5, 0, 5], 3).sum() == 3


def test_repartir_flota():
    # Con la flota de diseño devuelve el diseño; si una estación se llena, el resto va a las demás.
    assert repartir_flota([2, 4, 2], [3, 5, 3], 8).tolist() == [2, 4, 2]
    assert repartir_flota([2, 4, 2], [3, 5, 3], 4).tolist() == [1, 2, 1]
    assert repartir_flota([1, 6, 1], [3, 6, 3], 10).tolist() == [2, 6, 2]
    assert repartir_flota([2, 4, 2], [3, 5, 3], 11).tolist() == [3, 5, 3]


if __name__ == "__main__":
    pruebas = [f for nombre, f in sorted(globals().items()) if nombre.startswith("test_")]
    for f in pruebas:
        f()
        print(f"[ok] {f.__name__}")
    print(f"{len(pruebas)} pruebas del simulador correctas")
