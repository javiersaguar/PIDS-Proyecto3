"""T46: sensibilidad de un parámetro cada vez sobre la demanda de recarga por estación."""

import numpy as np
import pandas as pd

from agregados import potencia_por_intervalo
from ajustes import cargar_ajustes, parametros_fisicos
from analisis_fisico import (PROCESADOS, energia_b, escala_ajuste, guardar, meteo_por_viaje, por_viaje,
                             viento_conductor)
from comun.config import cargar_config


def escenarios(v, meteo):
    """(nombre, parámetro, valor, opciones de energia_b, factor de referencia) de cada caso."""
    f = cargar_ajustes()["modelo_b"]
    rangos = cargar_ajustes()["sensibilidad"]
    central = parametros_fisicos("central")
    base = {"parametros": central, "auxiliar_w": f["potencia_auxiliar_w"]}
    casos = [("Caso central", "central", "central", base, 1.0)]
    nombres = {"crr": "Coeficiente de rodadura", "cda_m2": "Área aerodinámica CdA (m²)",
               "eta_traccion": "Rendimiento de tracción"}
    for clave, nombre in nombres.items():
        for valor in rangos[clave]:
            casos.append((nombre, clave, valor, {**base, "parametros": central | {clave: valor}}, 1.0))
    for valor in rangos["masa_usuario_kg"]:
        masa = cargar_config()["patinete"]["masa_kg"] + valor
        casos.append(("Masa del usuario (kg)", "masa_usuario_kg", valor,
                      {**base, "parametros": central | {"masa_kg": masa}}, 1.0))
    for valor in rangos["potencia_auxiliar_w"]:
        casos.append(("Electrónica de a bordo (W)", "potencia_auxiliar_w", valor, {**base, "auxiliar_w": valor}, 1.0))
    for valor in rangos["rugosidad_viento_m"]:
        columnas = (f"viento_paralelo_{valor}", f"viento_lateral_{valor}")
        v[columnas[0]], v[columnas[1]] = viento_conductor(v, meteo, valor)
        casos.append(("Viento a la altura del conductor (rugosidad, m)", "rugosidad_viento_m", valor,
                      {**base, "viento": columnas}, 1.0))
    casos.append(("Desnivel de extremos", "desnivel", "sin desnivel", {**base, "desnivel": False}, 1.0))
    v["velocidad_crucero_m_s"] = f["velocidad_crucero_km_h"] / 3.6
    casos.append(("Velocidad", "velocidad", "crucero de T16", {**base, "velocidad": "velocidad_crucero_m_s"}, 1.0))
    casos.append(("Calibración", "calibracion", "escala sobre toda la energía",
                  {"parametros": central, "modo": "total"}, 1.0))
    for valor in rangos["referencia_relativa"]:
        casos.append(("Coeficiente de referencia (contraste ±20 %)", "referencia_relativa", valor, base, valor))
    return casos


def demanda_estaciones(l, wh, ids, fechas, paso_s, potencia_w):
    """kWh por estación, P95 diario, pico por estación y pico de la red con las sesiones de T44."""
    inicio = pd.Timestamp(fechas[0])
    dias = (pd.Timestamp(fechas[1]) - inicio).days + 1
    segundos = (l["tsD"].dt.tz_localize(None) - inicio).dt.total_seconds().to_numpy()
    estacion = ids.get_indexer(l["estacion_destino"])
    assert (estacion >= 0).all()
    n = int(np.ceil((max(dias * 86400, (segundos + wh * 3600 / potencia_w).max()) + 1) / paso_s))
    vatios = potencia_por_intervalo(segundos, estacion, wh, len(ids), n, paso_s, potencia_w)
    diario = np.zeros((len(ids), dias))
    np.add.at(diario, (estacion, np.minimum((segundos // 86400).astype(int), dias - 1)), wh)
    return pd.DataFrame({"station_id": ids, "kwh": np.bincount(estacion, wh, len(ids)) / 1000,
                         "p95_dia_kwh": np.quantile(diario, .95, axis=1) / 1000,
                         "pico_w": vatios.max(axis=1)}), vatios.sum(axis=0).max()


def publicar_sensibilidad():
    cfg, ajustes = cargar_config(), cargar_ajustes()
    a = ajustes["analisis"]
    v, _ = por_viaje()
    meteo = meteo_por_viaje(v)
    objetivo = cfg["patinete"]["consumo_wh_km"]
    potencia = cfg["patinete"]["bateria_wh"] / cfg["patinete"]["tiempo_recarga_h"]
    paso = a["paso_perfil_min"] * 60
    l = pd.read_parquet(PROCESADOS / "T44_entrada_recarga.parquet")
    l = l.loc[l["red"].eq(a["red_diseno"])]
    pos = pd.Series(np.arange(len(v)), index=v["trip_id"])
    ajuste = v["periodo"].eq("ajuste").to_numpy()
    km_ajuste = v.loc[ajuste, "dis_m"].sum() / 1000
    filas, por_estacion = [], []
    for nombre, parametro, valor, opciones, factor in escenarios(v, meteo):
        k = escala_ajuste(v, objetivo * factor, **opciones)
        wh = energia_b(v, k=k, **opciones)
        fisico = energia_b(v.loc[ajuste], k=1.0, **{**opciones, "modo": "rodadura_aire"})
        for periodo, g in l.groupby("periodo"):
            ids = pd.Index(sorted(g["estacion_destino"].unique()))
            e, pico_red = demanda_estaciones(g, wh[pos.loc[g["trip_id"]].to_numpy()], ids,
                                             cfg["datos"]["periodos"][periodo], paso, potencia)
            dias = len(pd.date_range(*cfg["datos"]["periodos"][periodo]))
            maxima = e.loc[e["kwh"].idxmax()]
            filas.append({"factor": nombre, "parametro": parametro, "valor": str(valor), "periodo": periodo,
                          "k": k, "fisico_wh_km": fisico.sum() / km_ajuste, "kwh_dia": e["kwh"].sum() / dias,
                          "estacion_max": maxima["station_id"], "estacion_max_kwh_dia": maxima["kwh"] / dias,
                          "estacion_max_p95_kwh": maxima["p95_dia_kwh"], "pico_red_kw": pico_red / 1000,
                          "pico_estacion_w": e["pico_w"].max(),
                          "top10_pct": 100 * e["kwh"].nlargest(a["top_concentracion"]).sum() / e["kwh"].sum()})
            por_estacion.append(e.assign(factor=nombre, valor=str(valor), periodo=periodo))
    t = pd.DataFrame(filas)
    est = pd.concat(por_estacion, ignore_index=True)
    centro = est.loc[est["factor"].eq("Caso central")].set_index(["periodo", "station_id"])["kwh"]
    referencia = t.loc[t["factor"].eq("Caso central")].set_index("periodo")
    extra = []
    for (factor, valor, periodo), g in est.groupby(["factor", "valor", "periodo"], sort=False):
        c = centro.loc[periodo].reindex(g["station_id"]).to_numpy()
        top_c = set(centro.loc[periodo].nlargest(a["top_concentracion"]).index)
        extra.append({"factor": factor, "valor": valor, "periodo": periodo,
                      "spearman_central": pd.Series(g["kwh"].to_numpy()).rank().corr(pd.Series(c).rank()),
                      "comunes_top10": len(set(g.nlargest(a["top_concentracion"], "kwh")["station_id"]) & top_c)})
    t = t.merge(pd.DataFrame(extra), on=["factor", "valor", "periodo"], validate="one_to_one")
    t["misma_estacion_max"] = t["estacion_max"].eq(t["periodo"].map(referencia["estacion_max"]))
    for col in ("estacion_max_kwh_dia", "pico_red_kw", "estacion_max_p95_kwh"):
        t[f"cambio_{col}_pct"] = 100 * (t[col] / t["periodo"].map(referencia[col]) - 1)
    guardar(est, "T46_estaciones.csv.gz")
    return guardar(t, "T46_tornado.csv")
