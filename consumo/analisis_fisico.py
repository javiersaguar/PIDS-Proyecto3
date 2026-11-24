"""Conciliación del Modelo A, física por viaje y calibración en ajuste."""

import numpy as np
import pandas as pd

from ajustes import cargar_ajustes, parametros_fisicos
from comun.config import cargar_config, carpeta_tablas, ruta
from comun.datos import cargar_viajes
from fuentes import leer_json, puntos_dem, validar_archivo
from modelo_a import energia_wh
from modelo_b import calibrar, componentes_viento, densidad_aire, factor_viento, traccion_wh


TABLAS = carpeta_tablas("consumo")
PROCESADOS = ruta("viajes_limpios").parent


def guardar(tabla, nombre):
    ruta_csv = TABLAS / nombre
    compresion = {"method": "gzip", "mtime": 0} if ruta_csv.suffix == ".gz" else None
    tabla.to_csv(ruta_csv, index=False, lineterminator="\n", float_format="%.9f", compression=compresion)
    return tabla


def energia_b(v, parametros, k, *, modo="rodadura_aire", auxiliar_w=0.0, desnivel=True,
              viento=None, velocidad="velocidad_m_s"):
    """Wh de batería por viaje con la escala k aplicada según el modo de calibración.

    `viento` y `velocidad` nombran columnas de `v`, de modo que sirven para cualquier subconjunto.
    """
    escala = k if modo == "rodadura_aire" else 1.0
    par, lat = (v[viento[0]], v[viento[1]]) if viento else (0, 0)
    wh = traccion_wh(v["dis_m"], v[velocidad], v["desnivel_m"] if desnivel else 0, v["densidad_kg_m3"],
                     **parametros, viento_paralelo_m_s=par, viento_lateral_m_s=lat,
                     escala_resistencias=escala, potencia_auxiliar_w=auxiliar_w)[-1]
    if modo == "total":
        return wh * k
    if modo != "rodadura_aire":
        raise ValueError(f"Modo de calibración desconocido: {modo}")
    return wh


def escala_ajuste(v, objetivo_wh_km, **opciones):
    """k que lleva la intensidad del ajuste al objetivo con las opciones dadas."""
    a = v.loc[v["periodo"].eq("ajuste")]
    if opciones.get("modo") == "total":
        bruto = energia_b(a, **{**opciones, "k": 1.0})
        return objetivo_wh_km * (a["dis_m"].sum() / 1000) / bruto.sum()
    return calibrar(lambda k: energia_b(a, **{**opciones, "k": k}), a["dis_m"], objetivo_wh_km)


def viento_conductor(v, meteo, rugosidad_m=None):
    """Componentes O–D del viento horario a la altura del conductor."""
    w = cargar_ajustes()["modelo_b"]["viento"]
    factor = factor_viento(w["altura_conductor_m"], rugosidad_m or w["rugosidad_m"], w["altura_medida_m"])
    geometria = [v[c].to_numpy() for c in ("lonO", "latO", "lonD", "latD")]
    return componentes_viento(*geometria, meteo["wind_speed_10m"].to_numpy() * factor,
                              meteo["wind_direction_10m"].to_numpy())


def meteo_por_viaje(v):
    fuentes = cargar_ajustes()["fuentes"]
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
    return x


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

    x = meteo_por_viaje(v)
    v["densidad_kg_m3"] = densidad_aire(x["temperature_2m"], x["surface_pressure"], f["gas_aire_seco_j_kg_k"])
    v["viento_paralelo_m_s"], v["viento_lateral_m_s"] = viento_conductor(v, x)
    viento = ("viento_paralelo_m_s", "viento_lateral_m_s")
    central = parametros_fisicos("central")
    aux = f["potencia_auxiliar_w"]
    modo = f["calibracion"]
    objetivo = cfg["consumo_wh_km"]
    k = escala_ajuste(v, objetivo, parametros=central, modo=modo, auxiliar_w=aux)
    # Física sin escalar (k = 1) con la electrónica incluida: el «B físico».
    for caso in f["escenarios"]:
        v[f"energia_{caso}_wh"] = energia_b(v, parametros_fisicos(caso), 1.0, auxiliar_w=aux)
    v["llano_t16_wh"] = traccion_wh(v["dis_m"], v["velocidad_m_s"], 0,
                                    f["densidad_referencia_kg_m3"], **central)[-1]
    v["llano_horario_wh"] = energia_b(v, central, 1.0, desnivel=False)
    v["aporte_desnivel_wh"] = energia_b(v, central, 1.0) - v["llano_horario_wh"]
    v["traccion_nula_b"] = energia_b(v, central, k, modo=modo) == 0
    v["energia_wh_b"] = energia_b(v, central, k, modo=modo, auxiliar_w=aux)
    v["delta_b_a_wh"] = v["energia_wh_b"] - v["energia_wh_a"]
    # Los escenarios bajo, alto y con viento conservan la escala central para medir la variación física.
    for caso in ("bajo", "alto"):
        v[f"escenario_{caso}_wh"] = energia_b(v, parametros_fisicos(caso), k, modo=modo, auxiliar_w=aux)
    v["escenario_viento_wh"] = energia_b(v, central, k, modo=modo, auxiliar_w=aux, viento=viento)
    # Calibración anterior (escala sobre toda la energía), solo como contraste.
    v["energia_total_wh"] = energia_b(v, central, escala_ajuste(v, objetivo, parametros=central, modo="total"),
                                      modo="total")
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
                      "viento_wh_km": g["escenario_viento_wh"].sum() / km,
                      "mae_wh": diferencia.abs().mean(), "p95_abs_wh": diferencia.abs().quantile(.95),
                      "max_a_wh": g["energia_wh_a"].max(), "max_b_wh": g["energia_wh_b"].max(),
                      "excede_bateria_b": int(g["energia_wh_b"].gt(bateria).sum()),
                      "cero_b": int(g["energia_wh_b"].eq(0).sum()),
                      "traccion_nula_b": int(g["traccion_nula_b"].sum()),
                      "cero_calibracion_total": int(g["energia_total_wh"].eq(0).sum())})
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
            "delta_b_a_wh", "escenario_bajo_wh", "escenario_alto_wh", "escenario_viento_wh", "energia_total_wh"]
    v[cols].to_parquet(PROCESADOS / "T43_energia_viaje.parquet", index=False)
    guardar(v[cols], "T43_viajes.csv.gz")
    principales = (v.assign(diferencia_absoluta_wh=v["delta_b_a_wh"].abs())
                   .sort_values(["periodo", "diferencia_absoluta_wh", "trip_id"], ascending=[True, False, True])
                   .groupby("periodo").head(cargar_ajustes()["analisis"]["top_concentracion"]))
    guardar(principales[cols + ["diferencia_absoluta_wh"]], "T43_mayores_diferencias.csv")
    return v, fi, de
