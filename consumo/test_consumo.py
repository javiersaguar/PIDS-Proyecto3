"""Casos de control de T40–T45. Ejecutar tras los notebooks de consumo."""

import numpy as np
import pandas as pd

from agregados import potencia_por_intervalo
from ajustes import parametros_fisicos
from analisis_fisico import PROCESADOS, TABLAS
from comun.config import cargar_config
from modelo_a import energia_wh
from modelo_b import calibrar, factor_viento, traccion_wh


def test_modelo_a():
    assert energia_wh(2000) == 27
    a = pd.read_csv(TABLAS / "T40_energia_viaje.csv")
    assert a["trip_id"].is_unique and not a["excede_bateria"].any()
    assert a["energia_wh"].max() < cargar_config()["patinete"]["bateria_wh"]
    # El CSV redondea a seis decimales tanto los metros como los Wh.
    margen_wh = 0.5e-6 + float(energia_wh(0.5e-6))
    np.testing.assert_allclose(a["energia_wh"], energia_wh(a["dis_m"]), rtol=0, atol=margen_wh + 1e-12)


def test_llano_y_descenso():
    f = parametros_fisicos("central")
    masa = f["masa_kg"]
    eta = f["eta_traccion"] * f["eta_transmision"] * f["eta_descarga"]
    rodadura_n = masa * f["gravedad_m_s2"] * f["crr"]
    aero_n = 1.2 * f["cda_m2"] * 5 ** 2 / 2
    r = traccion_wh(2000, 5, 0, 1.2, **f)
    np.testing.assert_allclose(r[-1], (rodadura_n + aero_n) * 2000 / (3600 * eta))
    r = traccion_wh([1000, 1000], 5, [-100, 100], 1.2, **f)
    assert r[-1][0] == 0 and r[-1][1] > 0


def test_escala_solo_en_resistencias_y_electronica():
    f = parametros_fisicos("central")
    uno = traccion_wh(1000, 5, 50, 1.2, **f)
    dos = traccion_wh(1000, 5, 50, 1.2, **f, escala_resistencias=2)
    np.testing.assert_allclose([dos[0], dos[1], dos[2]], [2 * uno[0], 2 * uno[1], uno[2]])
    # Una bajada sin tracción sigue gastando la electrónica: 3 W durante 200 s.
    bajada = traccion_wh(1000, 5, -100, 1.2, **f, potencia_auxiliar_w=3)
    np.testing.assert_allclose(bajada[-1], 3 * 200 / 3600 / f["eta_descarga"])
    k = calibrar(lambda k: traccion_wh([1000, 2000], 5, [0, -20], 1.2, **f, escala_resistencias=k)[-1],
                 [1000, 2000], 13.5)
    e = traccion_wh([1000, 2000], 5, [0, -20], 1.2, **f, escala_resistencias=k)[-1]
    np.testing.assert_allclose(e.sum() / 3, 13.5)
    assert 0 < factor_viento(1.2, 0.5, 10) < 1


def test_calibracion_y_reserva():
    t = pd.read_csv(TABLAS / "T43_calibracion.csv").set_index("periodo")
    assert t["k"].nunique() == 1
    assert np.isclose(t.loc["ajuste", "b_wh_km"], cargar_config()["patinete"]["consumo_wh_km"])
    assert (t["cero_b"] == 0).all() and (t["excede_bateria_b"] == 0).all()


def test_sensibilidad():
    t = pd.read_csv(TABLAS / "T46_tornado.csv")
    k = pd.read_csv(TABLAS / "T43_calibracion.csv")["k"].iloc[0]
    centro = t.loc[t["factor"].eq("Caso central")]
    assert np.allclose(centro["k"], k) and centro["misma_estacion_max"].all()
    resumen = pd.read_csv(TABLAS / "T44_resumen.csv").query("red == 'habitual' and modelo == 'b'")
    for r in centro.itertuples():
        np.testing.assert_allclose(r.kwh_dia, resumen.loc[resumen["periodo"].eq(r.periodo), "kwh_dia"].iloc[0])


def test_solape_exactamente_conservado():
    p = potencia_por_intervalo(np.array([0, 450]), np.array([0, 0]), np.array([20, 20]), 1, 2, 900, 80)
    np.testing.assert_allclose(p, [[120, 40]])


def test_conciliacion():
    c = pd.read_csv(TABLAS / "T44_conciliacion.csv")
    l = pd.read_parquet(PROCESADOS / "T44_entrada_recarga.parquet")
    assert (c["diferencia_wh"] == 0).all()
    assert (c["observados"] == c["atendidos"] + c["sin_destino_en_red"]).all()
    np.testing.assert_allclose(c["observados_wh"], c["sin_destino_wh"] + c["atendidos_wh"],
                               rtol=1e-13, atol=1e-6)
    assert not l.duplicated(["red", "trip_id"]).any() and l.notna().all().all()
    for r in c.itertuples():
        viajes = l.loc[l["red"].eq(r.red) & l["periodo"].eq(r.periodo)]
        wh = viajes[f"energia_wh_{r.modelo}"]
        assert len(viajes) == r.atendidos
        np.testing.assert_allclose([r.patinetes_wh, r.estaciones_wh, r.atendidos_wh], wh.sum(),
                                   rtol=1e-13, atol=1e-6)
    s = pd.read_csv(TABLAS / "T44_sensibilidad_red.csv")
    assert s.groupby(["modelo", "periodo"])[["kwh", "viajes"]].nunique().eq(1).all().all()


if __name__ == "__main__":
    pruebas = [f for n, f in sorted(globals().items()) if n.startswith("test_")]
    for f in pruebas:
        f()
        print(f"[ok] {f.__name__}")
