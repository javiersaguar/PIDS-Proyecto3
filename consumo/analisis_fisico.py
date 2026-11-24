"""Conciliación del Modelo A, física por viaje y calibración en ajuste."""

import numpy as np
import pandas as pd

from ajustes import cargar_ajustes, parametros_fisicos
from comun.config import cargar_config, carpeta_tablas, ruta
from comun.datos import cargar_viajes
from fuentes import leer_json, puntos_dem, validar_archivo
from modelo_a import energia_wh
from modelo_b import componentes_viento, densidad_aire, traccion_wh


TABLAS = carpeta_tablas("consumo")
PROCESADOS = ruta("viajes_limpios").parent


def guardar(tabla, nombre):
    ruta_csv = TABLAS / nombre
    compresion = {"method": "gzip", "mtime": 0} if ruta_csv.suffix == ".gz" else None
    tabla.to_csv(ruta_csv, index=False, lineterminator="\n", float_format="%.9f", compression=compresion)
    return tabla


def por_viaje():
    v = cargar_viajes()
    cfg = cargar_config()["patinete"]
    p = cargar_ajustes()
    f, fuentes = p["modelo_b"], p["fuentes"]
    a = pd.read_csv(TABLAS / "T40_energia_viaje.csv")
    assert set(a["trip_id"]) == set(v["trip_id"]) and a["trip_id"].is_unique
    a = a.set_index("trip_id").loc[v["trip_id"]]
    np.testing.assert_allclose(a["energia_wh"], energia_wh(v["dis_m"]), atol=5e-7)
    assert not a["excede_bateria"].any()
    v["energia_wh_a"] = a["energia_wh"].to_numpy()

    dem, ficha = validar_archivo(ruta("externos") / fuentes["elevacion_meta"])
    alturas = pd.read_csv(dem).set_index(["lon", "lat"])["elevacion_m"]
    assert alturas.index.is_unique and len(alturas) == ficha["puntos_unicos"]
    h = alturas.reindex(pd.MultiIndex.from_frame(puntos_dem(v))).to_numpy()
    if not np.isfinite(h).all():
        raise ValueError("Faltan puntos GLO-30. Archiva de nuevo las coordenadas de los viajes elegibles.")
    v["elevacion_o_m"], v["elevacion_d_m"] = np.split(h, 2)
    v["desnivel_m"] = v["elevacion_d_m"] - v["elevacion_o_m"]
    v["velocidad_m_s"] = v["dis_m"] / v["tt_s"]

    archivo, ficha_m = validar_archivo(ruta("externos") / fuentes["meteo_consumo_meta"])
    suplemento = pd.DataFrame(leer_json(archivo)["hourly"])
    original = pd.DataFrame(leer_json(ruta("externos") / fuentes["meteo_t17"])["hourly"])
    if all(ficha_m["coinciden_valores"].values()):
        meteo = original[["time", "temperature_2m", "wind_speed_10m"]].merge(
            suplemento[["time", "surface_pressure", "wind_direction_10m"]], on="time", validate="one_to_one")
    else:
        meteo = suplemento  # Usa la serie completa de una misma consulta si el proveedor revisó sus valores.
    horas = v["tsO"].dt.floor("h").dt.strftime("%Y-%m-%dT%H:%M")
    x = meteo.set_index("time").reindex(horas)
    if not np.isfinite(x.to_numpy(float)).all():
        raise ValueError("La meteorología no cubre todas las horas de salida.")
    v["densidad_kg_m3"] = densidad_aire(x["temperature_2m"], x["surface_pressure"], f["gas_aire_seco_j_kg_k"])
    geometria = [v[c].to_numpy() for c in ("lonO", "latO", "lonD", "latD")]
    viento_o, viento_l = componentes_viento(*geometria, x["wind_speed_10m"], x["wind_direction_10m"])
    for caso in f["escenarios"]:
        parametros = parametros_fisicos(caso)
        v[f"energia_{caso}_wh"] = traccion_wh(v["dis_m"], v["velocidad_m_s"], v["desnivel_m"],
                                             v["densidad_kg_m3"], **parametros)[-1]
    central = parametros_fisicos("central")
    v["llano_t16_wh"] = traccion_wh(v["dis_m"], v["velocidad_m_s"], 0,
                                    f["densidad_referencia_kg_m3"], **central)[-1]
    v["llano_horario_wh"] = traccion_wh(v["dis_m"], v["velocidad_m_s"], 0, v["densidad_kg_m3"], **central)[-1]
    v["viento_10m_wh"] = traccion_wh(v["dis_m"], v["velocidad_m_s"], v["desnivel_m"], v["densidad_kg_m3"],
                                     **central, viento_paralelo_m_s=viento_o, viento_lateral_m_s=viento_l)[-1]
    v["aporte_desnivel_wh"] = v["energia_central_wh"] - v["llano_horario_wh"]
    a = v.loc[v["periodo"].eq("ajuste")]
    intensidad = a["energia_central_wh"].sum() / (a["dis_m"].sum() / 1000)
    k = cfg["consumo_wh_km"] / intensidad
    v["energia_wh_b"] = v["energia_central_wh"] * k
    v["delta_b_a_wh"] = v["energia_wh_b"] - v["energia_wh_a"]
    for caso in ("bajo", "alto", "viento_10m"):
        base = f"energia_{caso}_wh" if caso != "viento_10m" else "viento_10m_wh"
        v[f"escenario_{caso}_wh"] = v[base] * k
    return v, k


def publicar_fisico():
    v, k = por_viaje()
    bateria = cargar_config()["patinete"]["bateria_wh"]
    filas, desnivel = [], []
    for periodo, g in v.groupby("periodo"):
        km = g["dis_m"].sum() / 1000
        diferencia = g["delta_b_a_wh"]
        filas.append({"periodo": periodo, "viajes": len(g), "distancia_km": km,
                      "a_wh_km": g["energia_wh_a"].sum() / km, "k": k,
                      "b_wh_km": g["energia_wh_b"].sum() / km,
                      "b_bruto_wh_km": g["energia_central_wh"].sum() / km,
                      "llano_t16_wh_km": g["llano_t16_wh"].sum() / km,
                      "llano_horario_wh_km": g["llano_horario_wh"].sum() / km,
                      "rango_bajo_wh_km": g["escenario_bajo_wh"].sum() / km,
                      "rango_alto_wh_km": g["escenario_alto_wh"].sum() / km,
                      "viento_wh_km": g["escenario_viento_10m_wh"].sum() / km,
                      "mae_wh": diferencia.abs().mean(), "p95_abs_wh": diferencia.abs().quantile(.95),
                      "max_a_wh": g["energia_wh_a"].max(), "max_b_wh": g["energia_wh_b"].max(),
                      "excede_bateria_b": int(g["energia_wh_b"].gt(bateria).sum()),
                      "cero_b": int(g["energia_wh_b"].eq(0).sum())})
        desnivel.append({"periodo": periodo, "viajes": len(g), "suben": int(g["desnivel_m"].gt(0).sum()),
                         "bajan": int(g["desnivel_m"].lt(0).sum()), "mediana_m": g["desnivel_m"].median(),
                         "p05_m": g["desnivel_m"].quantile(.05), "p95_m": g["desnivel_m"].quantile(.95),
                         "p95_abs_m": g["desnivel_m"].abs().quantile(.95),
                         "aporte_kwh": g["aporte_desnivel_wh"].sum() / 1000,
                         "aporte_medio_wh": g["aporte_desnivel_wh"].mean()})
    fi = guardar(pd.DataFrame(filas), "T43_calibracion.csv")
    de = guardar(pd.DataFrame(desnivel), "T42_desnivel.csv")
    cols = ["trip_id", "idS", "periodo", "tsO", "tsD", "dis_m", "velocidad_m_s", "elevacion_o_m", "elevacion_d_m",
            "desnivel_m", "densidad_kg_m3", "energia_wh_a", "energia_central_wh", "aporte_desnivel_wh", "energia_wh_b",
            "delta_b_a_wh", "escenario_bajo_wh", "escenario_alto_wh", "escenario_viento_10m_wh"]
    v[cols].to_parquet(PROCESADOS / "T43_energia_viaje.parquet", index=False)
    guardar(v[cols], "T43_viajes.csv.gz")
    principales = (v.assign(diferencia_absoluta_wh=v["delta_b_a_wh"].abs())
                   .sort_values(["periodo", "diferencia_absoluta_wh", "trip_id"], ascending=[True, False, True])
                   .groupby("periodo").head(cargar_ajustes()["analisis"]["top_concentracion"]))
    guardar(principales[cols + ["diferencia_absoluta_wh"]], "T43_mayores_diferencias.csv")
    return v, fi, de
