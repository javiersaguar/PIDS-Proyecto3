"""Casos de control de T50. Ejecutar tras el notebook de demanda."""

import numpy as np
import pandas as pd

from demanda import (TABLAS, altura_solar, cargar_ajustes, cola, energia_por_intervalo, horas_con_cola,
                     simultaneas_max)
from comun.config import carpeta_tablas


def test_cola():
    llegada, duracion = np.array([0.0, 0.0, 0.0, 50.0]), np.array([10.0, 10.0, 10.0, 5.0])
    np.testing.assert_array_equal(cola(llegada, duracion, 1), [0, 10, 20, 50])
    np.testing.assert_array_equal(cola(llegada, duracion, 2), [0, 0, 10, 50])
    np.testing.assert_array_equal(cola(llegada, duracion, 5), llegada)


def test_solape():
    # 100 W durante 30 min en dos intervalos de 15 min; otra sesión de 600 s a 1500 s.
    inicio, fin = np.array([0.0, 600.0]), np.array([1800.0, 1500.0])
    wh = energia_por_intervalo(inicio, fin, 100.0, np.array([0, 1]), 2, 900)
    np.testing.assert_allclose(wh[0], [25, 25])
    np.testing.assert_allclose(wh[1], [100 * 300 / 3600, 100 * 600 / 3600])
    # Sesión que acaba justo en el borde: no crea un intervalo vacío.
    assert energia_por_intervalo(np.array([0.0]), np.array([900.0]), 100.0, np.array([0]), 1, 900).shape == (1, 1)


def test_simultaneas_y_cola():
    inicio, fin = np.array([0.0, 10.0, 10.0, 5.0]), np.array([10.0, 20.0, 30.0, 12.0])
    # En la estación 0 una sesión empieza cuando acaba la anterior: nunca hay dos a la vez.
    np.testing.assert_array_equal(simultaneas_max(inicio, fin, np.array([0, 0, 1, 1]), 2), [1, 2])
    h = horas_con_cola(np.array([0.0, 3000.0]), np.array([0.0, 7300.0]), np.array([0, 1]), 2)
    np.testing.assert_array_equal(h, [0, 3])


def test_altura_solar():
    # Roma (41,9 N; 12,5 E) el 1/2/2021: mediodía solar hacia las 11:25 UTC con unos 31°
    # (90 − 41,9 − 17,2 de declinación) y salida del sol hacia las 06:27 UTC.
    t = pd.DatetimeIndex(["2021-02-01 11:25", "2021-02-01 06:27"], tz="UTC")
    alt = altura_solar(t, 41.9, 12.5)
    assert abs(alt[0] - 30.9) < 0.5 and abs(alt[1]) < 1.2
    noche = altura_solar(pd.DatetimeIndex(["2021-02-01 23:00"], tz="UTC"), 41.9, 12.5)
    assert noche[0] < -40


def test_resultados():
    d = cargar_ajustes()["demanda"]
    e = pd.read_csv(TABLAS / "T50_estaciones.csv")
    base = e.loc[e["caso"].eq("ideal")]
    # El perfil ideal en batería coincide con la demanda por estación de T44.
    t44 = pd.read_csv(carpeta_tablas("consumo") / "T44_estaciones.csv").query("red == @d['red']")
    m = base.merge(t44, on=["station_id", "periodo", "modelo"], validate="one_to_one", suffixes=("", "_t44"))
    assert len(m) == len(base)
    np.testing.assert_allclose(m["pedida_kwh"] * d["eta_cargador"], m["energia_wh"] / 1000, rtol=1e-9, atol=1e-9)
    np.testing.assert_allclose(m["pico_w"] * d["eta_cargador"], m["pico_w_t44"], rtol=1e-9, atol=1e-9)
    # Mismo pedido en todos los casos; la cola solo mueve energía en el tiempo.
    pedida = e.pivot_table(index=["periodo", "modelo", "station_id"], columns="caso", values="pedida_kwh")
    assert np.allclose(pedida.min(axis=1), pedida.max(axis=1), rtol=1e-12)
    np.testing.assert_allclose(e["servida_kwh"] + e["pendiente_kwh"], e["pedida_kwh"], rtol=1e-9, atol=1e-12)
    assert (e["simultaneas_max"] <= e["cargadores"]).where(~e["caso"].eq("ideal"), True).all()
    assert e.loc[e["caso"].eq("ideal"), "horas_con_cola"].eq(0).all()
    c = pd.read_csv(TABLAS / "T50_candidatas.csv")
    assert c["station_id"].is_unique and c["papel"].iloc[0] == "elegida" and c["station_id"].isin(e["station_id"]).all()


if __name__ == "__main__":
    pruebas = [f for n, f in sorted(globals().items()) if n.startswith("test_")]
    for f in pruebas:
        f()
        print(f"[ok] {f.__name__}")
