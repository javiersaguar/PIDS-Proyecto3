"""Reutiliza la red y las reservas de T35 para seguir baterías durante febrero."""

import sys

import numpy as np
import pandas as pd

from ajustes import cargar_ajustes
from analisis_fisico import guardar
from agregados import TABLAS_MOV
from comun.config import RAIZ, cargar_config
from comun.datos import cargar_viajes

# El simulador de movilidad resuelve sus módulos locales desde esta carpeta.
sys.path.append(str(RAIZ / "movilidad"))
from bateria import Carga  # noqa: E402
from inventario import Demanda, Red, simular  # noqa: E402


def estado_diario(traza, fechas, periodos, capacidad, horas):
    filas = []
    inicios = (fechas - pd.Timestamp("1970-01-01")).total_seconds().to_numpy(dtype=np.int64)
    fines = inicios + 86400
    for unidad, s in traza.groupby("unidad"):
        tiempos, energia = s["t"].to_numpy(), s["energia_wh"].to_numpy()
        acoplada = s["evento"].ne("salida").to_numpy()
        assert np.all(tiempos[1:] >= tiempos[:-1])
        indices = np.searchsorted(tiempos, inicios, side="right") - 1
        inicial = np.minimum(capacidad, energia[indices] + acoplada[indices] * (inicios - tiempos[indices]) * capacidad / (horas * 3600))
        izq = np.searchsorted(tiempos, inicios)
        der = np.searchsorted(tiempos, fines)
        for d, p, a, b, inicial_wh in zip(fechas, periodos, izq, der, inicial):
            minimo = min(float(inicial_wh), energia[a:b].min(initial=np.inf))
            filas.append({"unidad": unidad, "fecha": d.date().isoformat(), "periodo": p, "min_pct": 100 * minimo / capacidad})
    return pd.DataFrame(filas)


def publicar_soc(viajes):
    cfg = cargar_config()
    p = cargar_ajustes()["analisis"]
    cap, h = (cfg["patinete"][x] for x in ("bateria_wh", "tiempo_recarga_h"))
    est = pd.read_csv(TABLAS_MOV / "T32_estaciones.csv").sort_values("station_id")
    finalistas = pd.read_csv(TABLAS_MOV / "T28_finalistas.csv")
    elegida = finalistas.loc[finalistas["rol"].eq("recomendada")].iloc[0]
    assert est["network_id"].eq(elegida["network_id"]).all()
    red = Red.de_tabla(est, elegida["radio_m"])
    stock, anclajes = (est[c].to_numpy() for c in ("stock_inicial", "anclajes"))
    limite = cfg["movilidad"]["rebalanceo_base_patinetes_dia"]
    referencia = pd.read_csv(TABLAS_MOV / "T35_carga.csv").query("caso == @p['reserva_t35']").set_index("periodo")
    reserva, = referencia["reserva_pct"].unique()
    assert referencia["recarga_en_anclaje"].all() and referencia["factor_consumo"].eq(1).all()
    v = cargar_viajes()
    energia = viajes.set_index("trip_id").loc[v["trip_id"]]
    periodos = cfg["datos"]["periodos"]
    calendario = [(dia, per) for per, (a, b) in periodos.items() for dia in pd.date_range(a, b)]
    fechas, claves_dia = zip(*calendario)
    filas, trazas, por_dia, controles = [], [], [], []
    dem = Demanda.de_viajes(v, red)
    for modelo in ("a", "b"):
        wh = energia[f"energia_wh_{modelo}"].to_numpy()
        res = simular(dem, red, stock, anclajes, limite, carga=Carga(wh, cap, h, reserva, registrar_traza=True))
        traza = res.traza_carga
        diaria = estado_diario(traza, pd.DatetimeIndex(fechas), claves_dia, cap, h)
        trazas.append(traza.assign(modelo=modelo, estacion_id=red.ids[traza["estacion"]]))
        por_dia.append(diaria.assign(modelo=modelo))
        at = res.viajes["resultado"].eq("atendido")
        np.testing.assert_allclose(res.resumen["traccion_kwh"] * 1000, wh[at].sum(), atol=1e-7)
        for periodo in periodos:
            m = v["periodo"].eq(periodo)
            valores = diaria.loc[diaria["periodo"].eq(periodo)].groupby("unidad")["min_pct"].min()
            n_bateria = int((m & res.viajes["resultado"].eq("sin_bateria")).sum())
            filas.append({"periodo": periodo, "modelo": modelo, "flota": int(stock.sum()), "reserva_pct": reserva,
                          "solicitudes": int(m.sum()), "atendidos": int((m & at).sum()), "rechazos_bateria": n_bateria,
                          "unidades_bajo_reserva": int((valores < reserva - 1e-8).sum()),
                          "min_soc_pct": valores.min(), "mediana_min_unidad_pct": valores.median(),
                          "traccion_kwh": wh[m & at].sum() / 1000})
            # El control por periodo reproduce los reinicios independientes de T35.
            solo = simular(Demanda.de_viajes(v.loc[m], red), red, stock, anclajes, limite,
                           carga=Carga(wh[m], cap, h, reserva))
            controles.append({"modelo": modelo, "periodo": periodo, "atendidos": solo.resumen["n_atendido"],
                              "rechazos_bateria": solo.resumen["n_sin_bateria"]})
            if modelo == "a":
                assert solo.resumen["n_atendido"] == referencia.loc[periodo, "n_atendido"]
                assert solo.resumen["n_sin_bateria"] == referencia.loc[periodo, "n_sin_bateria"]
    diaria = pd.concat(por_dia, ignore_index=True)
    por_unidad = diaria.groupby(["modelo", "unidad", "periodo"], as_index=False)["min_pct"].min()
    curva = diaria.groupby(["modelo", "fecha", "periodo"], as_index=False)["min_pct"].agg(
        minimo="min", p05=lambda x: x.quantile(.05), mediana="median")
    guardar(pd.concat(trazas, ignore_index=True), "T45_traza.csv.gz")
    guardar(diaria, "T45_soc_unidad_dia.csv.gz")
    guardar(por_unidad, "T45_minimo_unidad.csv")
    guardar(pd.DataFrame(controles), "T45_control_t35.csv")
    r = guardar(pd.DataFrame(filas), "T45_resultados.csv")
    return r, guardar(curva, "T45_soc_diario.csv")
