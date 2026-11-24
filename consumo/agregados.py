"""Consumo observado y demanda de reposición de las llegadas atendidas."""

import numpy as np
import pandas as pd

from ajustes import cargar_ajustes
from analisis_fisico import PROCESADOS, guardar
from comun.config import cargar_config, carpeta_tablas


ENERGIA = ["energia_wh_a", "energia_wh_b"]
TABLAS_MOV = carpeta_tablas("movilidad")


def potencia_por_intervalo(segundos, estaciones, energias_wh, n_estaciones, n_intervalos, paso_s, potencia_w):
    """W medios en cada intervalo. Suma el solape exacto de cargas equivalentes."""
    fin = segundos + energias_wh * 3600 / potencia_w
    i, j = (segundos // paso_s).astype(int), (fin // paso_s).astype(int)
    if i.min() < 0 or j.max() >= n_intervalos:
        raise ValueError("La ventana de potencia debe incluir el final de la última sesión.")
    cruce = j > i
    potencia = np.zeros((n_estaciones, n_intervalos))
    np.add.at(potencia, (estaciones, i), potencia_w * (np.minimum(fin, (i + 1) * paso_s) - segundos) / paso_s)
    np.add.at(potencia, (estaciones[cruce], j[cruce]), potencia_w * (fin[cruce] - j[cruce] * paso_s) / paso_s)
    continuas = np.zeros_like(potencia)
    np.add.at(continuas, (estaciones[cruce], i[cruce] + 1), potencia_w)
    np.add.at(continuas, (estaciones[cruce], j[cruce]), -potencia_w)
    potencia += np.cumsum(continuas, axis=1)
    assert np.isclose(potencia.sum() * paso_s / 3600, energias_wh.sum(), atol=1e-7)
    return potencia


def observado(v, bateria_wh):
    v = v.assign(fecha=v["tsO"].dt.strftime("%Y-%m-%d"), viajes=1)
    grupos = {
        "patinete": ["periodo", "idS"], "patinete_dia": ["periodo", "idS", "fecha"],
        "flota_dia": ["periodo", "fecha"], "flota": ["periodo"],
    }
    totales = v.groupby("periodo")[ENERGIA].sum()
    for nombre, claves in grupos.items():
        t = v.groupby(claves, as_index=False)[ENERGIA + ["viajes"]].sum()
        np.testing.assert_allclose(t.groupby("periodo")[ENERGIA].sum(), totales, rtol=1e-13, atol=1e-7)
        for modelo in ("a", "b"):
            t[f"ciclos_{modelo}"] = t[f"energia_wh_{modelo}"] / bateria_wh
        guardar(t, f"T44_observado_{nombre}.csv")
    return totales


def llegadas_con_energia(v, redes, red_habitual):
    llegadas = pd.read_parquet(PROCESADOS / "T39_llegadas_atendidas.parquet")
    l = llegadas.loc[llegadas["red"].isin(redes)].merge(
        v[["trip_id", "idS", "periodo", "tsD", *ENERGIA]], on=["trip_id", "periodo", "tsD"],
        how="left", validate="many_to_one")
    if l[["idS", "estacion_destino", *ENERGIA]].isna().any().any() or l["estacion_destino"].eq("").any():
        raise ValueError("Las llegadas de T39 no concuerdan con los viajes elegibles y el Modelo A.")
    np.testing.assert_allclose(l["energia_wh"], l["energia_wh_a"], rtol=1e-12, atol=1e-8)
    # T31 comprueba el enlace por viaje y la devolución del ajuste de la red habitual.
    t31 = pd.read_parquet(PROCESADOS / "T31_asignacion.parquet", columns=["trip_id", "resultado", "estacion_destino"])
    t31 = t31.loc[t31["resultado"].eq("atendido")].set_index("trip_id")["estacion_destino"].sort_index()
    control = l.loc[l["red"].eq(red_habitual) & l["periodo"].eq("ajuste")].set_index("trip_id")["estacion_destino"].sort_index()
    if not t31.equals(control):
        raise ValueError("La asignación atendida de T31 y T39 no coincide. Regenera movilidad.")
    entrada = l[["trip_id", "idS", "red", "periodo", "tsD", "estacion_destino", *ENERGIA]]
    assert not entrada.duplicated(["red", "trip_id"]).any()
    entrada.to_parquet(PROCESADOS / "T44_entrada_recarga.parquet", index=False)
    return entrada


def perfiles(v, ids, fechas, paso, potencia_w):
    inicio = pd.Timestamp(fechas[0])
    ultimo = pd.Timestamp(fechas[1]) + pd.Timedelta(days=1)
    segundos = (v["tsD"].dt.tz_localize(None) - inicio).dt.total_seconds().to_numpy()
    estacion = ids.get_indexer(v["estacion_destino"])
    assert (estacion >= 0).all()
    dias = (ultimo - inicio).days
    duracion = max((ultimo - inicio).total_seconds(),
                   float((segundos + 3600 * v[ENERGIA].max(axis=1).to_numpy() / potencia_w).max()) + 1)
    por_hora = 3600 // paso
    n = int(np.ceil(duracion / 3600)) * por_hora
    for modelo in ("a", "b"):
        wh = v[f"energia_wh_{modelo}"].to_numpy()
        vatios = potencia_por_intervalo(segundos, estacion, wh, len(ids), n, paso, potencia_w)
        horas = vatios.reshape(len(ids), -1, por_hora).mean(axis=2)
        media = vatios[:, :dias * 24 * por_hora].reshape(len(ids), dias, 24 * por_hora).mean(axis=1)
        total = np.bincount(estacion, weights=wh, minlength=len(ids))
        assert np.isclose(total.sum(), vatios.sum() * paso / 3600)
        dia_llegada = (segundos // 86400).astype(int)
        fechas_d = pd.date_range(inicio, periods=max(dias, int(dia_llegada.max()) + 1))
        dias_wh = np.zeros((len(ids), len(fechas_d)))
        np.add.at(dias_wh, (estacion, dia_llegada), wh)
        resumen = pd.DataFrame({
            "station_id": ids, "modelo": modelo, "energia_wh": total, "media_wh_dia": dias_wh.mean(axis=1),
            "p95_wh_dia": np.quantile(dias_wh, cargar_ajustes()["analisis"]["cuantil_demanda"], axis=1),
            "p95_w_15min": np.quantile(vatios, cargar_ajustes()["analisis"]["cuantil_demanda"], axis=1),
            "pico_w": vatios.max(axis=1),
        })
        tablas = []
        for matriz, paso_t in ((vatios, paso), (horas, 3600), (media, paso)):
            filas, columnas = np.nonzero(matriz > 0)
            tablas.append(pd.DataFrame({"station_id": ids[filas], "modelo": modelo, "intervalo": columnas,
                                        "t": inicio + pd.to_timedelta(columnas * paso_t, unit="s"),
                                        "potencia_w": matriz[filas, columnas]}))
        yield modelo, resumen, *tablas, vatios.sum(axis=0).max(), n


def comparables(l, nombres, q):
    filas = []
    for periodo, g in l.groupby("periodo"):
        ids = g.groupby("trip_id")["red"].nunique()
        comunes = g.loc[g["trip_id"].isin(ids.index[ids.eq(len(nombres))])]
        if comunes.empty:
            raise ValueError("Las redes no tienen viajes en común.")
        for (red, modelo), s in comunes.melt(
                id_vars=["red", "trip_id", "estacion_destino"], value_vars=ENERGIA,
                var_name="modelo", value_name="wh").groupby(["red", "modelo"]):
            estaciones = s.groupby("estacion_destino")["wh"].sum().sort_index()
            filas.append({"periodo": periodo, "red": red, "modelo": modelo[-1], "viajes": len(s),
                          "kwh": s["wh"].sum() / 1000, "top_pct": 100 * estaciones.nlargest(q).sum() / estaciones.sum(),
                          "estacion_max": estaciones.idxmax(), "estacion_max_kwh": estaciones.max() / 1000})
    t = pd.DataFrame(filas)
    assert t.groupby(["periodo", "modelo"])["kwh"].agg(lambda v: np.isclose(v.min(), v.max())).all()
    return guardar(t, "T44_sensibilidad_red.csv")


def publicar_agregados():
    cfg, a = cargar_config(), cargar_ajustes()["analisis"]
    v = pd.read_parquet(PROCESADOS / "T43_energia_viaje.parquet")
    bateria_wh = cfg["patinete"]["bateria_wh"]
    totales = observado(v, bateria_wh)
    red_habitual = a["red_diseno"]
    redes = [red_habitual, *a["redes_sensibilidad"]]
    l = llegadas_con_energia(v, redes, red_habitual)
    sensibilidad = comparables(l, redes, a["top_concentracion"])
    estaciones = pd.read_csv(TABLAS_MOV / "T39_estaciones.csv")
    qs = a["top_concentracion"]
    paso = a["paso_perfil_min"] * 60
    pot = bateria_wh / cfg["patinete"]["tiempo_recarga_h"]
    datos, por_estacion, p15, p60, med, conciliacion, e_diaria = [], [], [], [], [], [], []
    for (red, periodo), g in l.groupby(["red", "periodo"]):
        ids = pd.Index(estaciones.loc[estaciones["red"].eq(red) & estaciones["periodo"].eq(periodo), "station_id"]).sort_values()
        assert ids.is_unique
        fechas = cfg["datos"]["periodos"][periodo]
        n_dias = (pd.Timestamp(fechas[1]) - pd.Timestamp(fechas[0])).days + 1
        for modelo, r, a15, a60, m, pico, n in perfiles(g, ids, fechas, paso, pot):
            claves = {"red": red, "periodo": periodo, "modelo": modelo}
            campo = f"energia_wh_{modelo}"
            viajes_wh = g[campo].sum()
            por_pat = g.groupby("idS")[campo].sum().sum()
            estacion_wh = r["energia_wh"].sum()
            total = totales.loc[periodo, campo]
            fuera = v.loc[v["periodo"].eq(periodo) & ~v["trip_id"].isin(g["trip_id"]), campo]
            np.testing.assert_allclose([por_pat, estacion_wh, a15["potencia_w"].sum() * paso / 3600,
                                        a60["potencia_w"].sum(), total - fuera.sum()],
                                       viajes_wh, rtol=1e-13, atol=1e-7)
            conciliacion.append({**claves, "observados": int(v["periodo"].eq(periodo).sum()),
                                 "atendidos": len(g), "sin_destino_en_red": len(fuera), "observados_wh": total,
                                 "atendidos_wh": viajes_wh, "sin_destino_wh": fuera.sum(),
                                 "patinetes_wh": por_pat, "estaciones_wh": estacion_wh, "diferencia_wh": 0})
            max_e = r.loc[r["energia_wh"].idxmax()]
            max_p = r.loc[r["pico_w"].idxmax()]
            datos.append({**claves, "viajes": len(g), "estaciones": len(ids), "kwh": viajes_wh / 1000,
                          "kwh_dia": viajes_wh / (1000 * n_dias), "pico_red_w": pico,
                          "estacion_energia_max": max_e["station_id"], "energia_max_kwh": max_e["energia_wh"] / 1000,
                          "estacion_pico_max": max_p["station_id"], "pico_estacion_w": max_p["pico_w"],
                          "top_pct": 100 * r["energia_wh"].nlargest(qs).sum() / viajes_wh,
                          "periodo_desde": fechas[0], "intervalos_15min": n})
            por_estacion.append(r.assign(**claves))
            diario = g.assign(fecha=g["tsD"].dt.strftime("%Y-%m-%d")).groupby(["estacion_destino", "fecha"])[campo].sum()
            dias = pd.date_range(fechas[0], max(fechas[1], str(diario.index.get_level_values("fecha").max())))
            rejilla = pd.MultiIndex.from_product([ids, dias.strftime("%Y-%m-%d")], names=["estacion_destino", "fecha"])
            e_diaria.append(diario.reindex(rejilla, fill_value=0).rename("energia_wh").reset_index().assign(**claves))
            p15.append(a15.assign(**claves))
            p60.append(a60.assign(**claves))
            med.append(m.drop(columns="t").assign(**claves))
    datos = guardar(pd.DataFrame(datos), "T44_resumen.csv")
    est = guardar(pd.concat(por_estacion, ignore_index=True), "T44_estaciones.csv")
    guardar(pd.concat(e_diaria, ignore_index=True), "T44_estacion_dia.csv.gz")
    guardar(pd.concat(p15, ignore_index=True), "T44_perfil_15min.csv.gz")
    guardar(pd.concat(p60, ignore_index=True), "T44_perfil_hora.csv.gz")
    perfil_medio = pd.concat(med, ignore_index=True)
    conc = guardar(pd.DataFrame(conciliacion), "T44_conciliacion.csv")
    ranking = []
    for (red, periodo), grupos in est.groupby(["red", "periodo"]):
        ordenadas = grupos.pivot(index="station_id", columns="modelo", values=["energia_wh", "pico_w"])
        mismo = ordenadas["energia_wh"]
        a_rank = mismo["a"].rank(method="average")
        b_rank = mismo["b"].rank(method="average")
        diferencia_pico = ordenadas["pico_w"]["b"] - ordenadas["pico_w"]["a"]
        ranking.append({"red": red, "periodo": periodo, "spearman": a_rank.corr(b_rank),
                        "estaciones_pico_b_mayor": int(diferencia_pico.gt(1e-8).sum()),
                        "mayor_aumento_pico_b_w": diferencia_pico.max(),
                        "comunes_top": len(set(mismo["a"].nlargest(qs).index) & set(mismo["b"].nlargest(qs).index))})
    rank = guardar(pd.DataFrame(ranking), "T44_ranking.csv")
    rango_modelo_b(v, l.loc[l["red"].eq(red_habitual)], est.loc[est["red"].eq(red_habitual)], qs)
    return v, datos, est, perfil_medio, sensibilidad, conc, rank


def rango_modelo_b(v, l, est, n_top):
    campos = ["escenario_bajo_wh", "escenario_alto_wh", "escenario_viento_wh"]
    llegadas = l.merge(v[["trip_id", *campos]], on="trip_id", validate="one_to_one")
    filas = []
    for periodo, g in llegadas.groupby("periodo"):
        estaciones = est.loc[est["periodo"].eq(periodo), "station_id"].unique()
        for c in campos:
            dist = g.groupby("estacion_destino")[c].sum().reindex(estaciones, fill_value=0)
            filas.append({"periodo": periodo, "caso": c, "total_kwh": dist.sum() / 1000,
                          "estacion_max": dist.idxmax(), "max_kwh": dist.max() / 1000,
                          "top_pct": 100 * dist.nlargest(n_top).sum() / dist.sum()})
    guardar(pd.DataFrame(filas), "T41_rango_por_estacion.csv")
