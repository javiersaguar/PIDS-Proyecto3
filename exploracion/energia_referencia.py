"""T16. Kilómetros y energía de referencia por viaje, patinete, día, flota y celda de destino.

Modelo del enunciado: energia_wh = consumo_wh_km × dis_m / 1000, con los valores del
patinete de config.yaml. El modelo físico es de la fase 2.

Uso: python exploracion/energia_referencia.py
"""

import h3
import numpy as np
import pandas as pd
from matplotlib import patheffects
from matplotlib.collections import PolyCollection
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.dates import DateFormatter
from matplotlib.patches import Patch
from matplotlib.ticker import FormatStrFormatter, MaxNLocator

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt

TEMA = "exploracion"
CFG = cargar_config()
CONSUMO_WH_KM = CFG["patinete"]["consumo_wh_km"]
BATERIA_WH = CFG["patinete"]["bateria_wh"]

PARAMETROS = {
    # Caso de control del plan: un viaje de 2 km da 27 Wh.
    "control_dis_m": 2000,
    "control_energia_wh": 27.0,
    "percentiles": [5, 25, 50, 75, 95, 99],
    # Umbrales de energía por patinete y día, en % de la batería.
    "umbrales_bateria_pct": [50, 80, 100],
    # Resolución H3 de las celdas de destino (punto de partida del plan).
    "res_celdas": 8,
    "top_celdas": 20,
    # Horas de sol de referencia para el reparto horario de la energía que llega [inicio, fin).
    "horas_sol": [10, 16],
    "horas_tarde": [16, 24],
    "tolerancia_cuadre_wh": 1e-6,
}

TITULO_AJUSTE = "viajes elegibles del periodo de ajuste (1–21/02/2021)"
AZUL, NARANJA, GRIS = "#2a78d6", "#eb6834", "#8a8984"
HALO = [patheffects.withStroke(linewidth=2.2, foreground="white")]
CMAP_SECUENCIAL = LinearSegmentedColormap.from_list(
    "azules", ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])


def guardar_tabla(df: pd.DataFrame, nombre: str) -> None:
    df.to_csv(carpeta_tablas(TEMA) / f"{nombre}.csv", index=False, lineterminator="\n")


def energia_wh(dis_m):
    """Energía de tracción del modelo de referencia (Wh)."""
    return CONSUMO_WH_KM * np.asarray(dis_m, dtype=float) / 1000


def dias_periodo(nombre: str) -> pd.Index:
    inicio, fin = CFG["datos"]["periodos"][nombre]
    return pd.Index(pd.date_range(inicio, fin, freq="D").strftime("%Y-%m-%d"), dtype="string")


def fin_periodo(nombre: str) -> pd.Timestamp:
    """Instante en que termina el periodo (medianoche del día siguiente al último)."""
    fin = CFG["datos"]["periodos"][nombre][1]
    return pd.Timestamp(fin).tz_localize(CFG["datos"]["zona_horaria"]) + pd.Timedelta(days=1)


def preparar(viajes: pd.DataFrame) -> pd.DataFrame:
    v = viajes[["trip_id", "idS", "tsO", "tsD", "latD", "lonD", "dis_m", "periodo"]].copy()
    v["km"] = v["dis_m"] / 1000
    v["energia_wh"] = energia_wh(v["dis_m"])
    v["pct_bateria"] = 100 * v["energia_wh"] / BATERIA_WH
    v["fecha"] = v["tsO"].dt.strftime("%Y-%m-%d").astype("string")
    v["hora_llegada"] = v["tsD"].dt.hour
    v["h3_d"] = pd.Series([h3.latlng_to_cell(a, b, PARAMETROS["res_celdas"]) for a, b in zip(v["latD"], v["lonD"])],
                          index=v.index, dtype="string")
    return v


def percentiles(x: pd.Series, prefijo: str) -> dict:
    fila = {f"{prefijo}_media": x.mean()}
    for p in PARAMETROS["percentiles"]:
        fila[f"{prefijo}_p{p}"] = x.quantile(p / 100)
    fila[f"{prefijo}_max"] = x.max()
    return fila


def tabla_resumen(resumen: dict) -> pd.DataFrame:
    """Tabla indicador–valor con los enteros como enteros y los reales redondeados."""
    valores = [round(float(x), 3) if isinstance(x, (float, np.floating)) else int(x) for x in resumen.values()]
    return pd.DataFrame({"indicador": list(resumen), "valor": pd.Series(valores, dtype=object)})


def redondear(df: pd.DataFrame, decimales: int = 3) -> pd.DataFrame:
    df = df.copy()
    for c in df.columns:
        if pd.api.types.is_float_dtype(df[c]):
            df[c] = df[c].round(decimales)
    return df


# ------------------------------------------------------------------ por viaje

def por_viaje(v: pd.DataFrame) -> None:
    filas = []
    for periodo, g in v.groupby("periodo", sort=False):
        filas.append({"periodo": periodo, "viajes": len(g), **percentiles(g["energia_wh"], "energia_wh"),
                      **percentiles(g["pct_bateria"], "pct_bateria"),
                      "viajes_mayor_bateria": int((g["energia_wh"] > BATERIA_WH).sum())})
    guardar_tabla(redondear(pd.DataFrame(filas)), "T16_viaje_distribucion")
    mayores = v.loc[v["energia_wh"] > BATERIA_WH, ["trip_id", "idS", "periodo", "dis_m", "energia_wh"]]
    guardar_tabla(redondear(mayores.sort_values("trip_id")), "T16_viajes_mayor_bateria")


# ------------------------------------------------------- por patinete y día

def por_patinete_dia(v: pd.DataFrame) -> pd.DataFrame:
    pd_dia = (v.groupby(["periodo", "idS", "fecha"], sort=True)
              .agg(viajes=("trip_id", "size"), km=("km", "sum"), energia_wh=("energia_wh", "sum"))
              .reset_index())
    pd_dia["pct_bateria"] = 100 * pd_dia["energia_wh"] / BATERIA_WH
    filas = []
    for periodo, g in pd_dia.groupby("periodo", sort=False):
        fila = {"periodo": periodo, "patinete_dias": len(g), "viajes_media": g["viajes"].mean(),
                "viajes_max": int(g["viajes"].max()), "km_media": g["km"].mean(), "km_p95": g["km"].quantile(0.95),
                "km_max": g["km"].max(), **percentiles(g["energia_wh"], "energia_wh")}
        for u in PARAMETROS["umbrales_bateria_pct"]:
            fila[f"pct_patinete_dias_sobre_{u}pct_bateria"] = 100 * (g["pct_bateria"] > u).mean()
        filas.append(fila)
    guardar_tabla(redondear(pd.DataFrame(filas)), "T16_patinete_dia_resumen")
    return pd_dia


# ------------------------------------------------------------- por patinete

def por_patinete(v: pd.DataFrame) -> pd.DataFrame:
    """Energía por patinete en el periodo de ajuste y en el mes, y días hasta agotar la batería.

    Se supone que el patinete empieza su primer viaje del periodo con la batería llena,
    que toda la batería es utilizable y que nunca se recarga.
    """
    aj = v[v["periodo"] == "ajuste"].sort_values(["idS", "tsO", "trip_id"])
    aj = aj.assign(acumulado_wh=aj.groupby("idS")["energia_wh"].cumsum())
    primero = aj.groupby("idS")["tsO"].min()
    agota = aj[aj["acumulado_wh"] >= BATERIA_WH].groupby("idS")["tsO"].min()

    t = aj.groupby("idS").agg(viajes_ajuste=("trip_id", "size"), km_ajuste=("km", "sum"),
                              energia_wh_ajuste=("energia_wh", "sum"))
    t["ciclos_ajuste"] = t["energia_wh_ajuste"] / BATERIA_WH
    t["dias_en_servicio"] = (fin_periodo("ajuste") - primero).dt.total_seconds() / 86400
    t["agota_sin_recarga"] = t.index.isin(agota.index)
    t["dias_hasta_agotar"] = (agota - primero).dt.total_seconds() / 86400
    t["dias_autonomia_estimada"] = BATERIA_WH / (t["energia_wh_ajuste"] / t["dias_en_servicio"])

    mes = v.groupby("idS").agg(viajes_mes=("trip_id", "size"), km_mes=("km", "sum"),
                               energia_wh_mes=("energia_wh", "sum"))
    mes["ciclos_mes"] = mes["energia_wh_mes"] / BATERIA_WH
    t = mes.join(t, how="left").reset_index().sort_values("idS", ignore_index=True)
    t["viajes_ajuste"] = t["viajes_ajuste"].fillna(0).astype("int64")
    t["agota_sin_recarga"] = t["agota_sin_recarga"].astype("boolean").fillna(False)
    guardar_tabla(redondear(t), "T16_patinete")

    a = t[t["viajes_ajuste"] > 0]
    resumen = {
        "patinetes_mes": len(t),
        "patinetes_ajuste": len(a),
        **{k: v_ for k, v_ in percentiles(a["km_ajuste"], "km_ajuste").items()},
        "ciclos_ajuste_media": a["ciclos_ajuste"].mean(),
        "ciclos_ajuste_p95": a["ciclos_ajuste"].quantile(0.95),
        "ciclos_ajuste_max": a["ciclos_ajuste"].max(),
        "ciclos_mes_media": t["ciclos_mes"].mean(),
        "ciclos_mes_max": t["ciclos_mes"].max(),
        "pct_patinetes_agotan_en_ajuste": 100 * a["agota_sin_recarga"].mean(),
        "dias_hasta_agotar_p50_de_los_que_agotan": a["dias_hasta_agotar"].median(),
        "dias_autonomia_estimada_p10": a["dias_autonomia_estimada"].quantile(0.10),
        "dias_autonomia_estimada_p50": a["dias_autonomia_estimada"].quantile(0.50),
        "dias_autonomia_estimada_p90": a["dias_autonomia_estimada"].quantile(0.90),
        "pct_patinetes_autonomia_menor_1_dia": 100 * (a["dias_autonomia_estimada"] < 1).mean(),
        "pct_patinetes_autonomia_menor_7_dias": 100 * (a["dias_autonomia_estimada"] < 7).mean(),
    }
    guardar_tabla(tabla_resumen(resumen), "T16_patinete_resumen")
    return t


# ------------------------------------------------------------- flota por día

def flota_diaria(v: pd.DataFrame) -> pd.DataFrame:
    t = (v.groupby("fecha", sort=True)
         .agg(periodo=("periodo", "first"), viajes=("trip_id", "size"), patinetes_activos=("idS", "nunique"),
              km=("km", "sum"), energia_wh=("energia_wh", "sum"))
         .reset_index())
    t["energia_kwh"] = t["energia_wh"] / 1000
    t["cargas_completas_equivalentes"] = t["energia_wh"] / BATERIA_WH
    t["wh_por_patinete_activo"] = t["energia_wh"] / t["patinetes_activos"]
    guardar_tabla(redondear(t), "T16_flota_diaria")

    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    x = pd.to_datetime(t["fecha"])
    colores = np.where(t["periodo"] == "ajuste", AZUL, GRIS)
    ax.bar(x, t["energia_kwh"], color=colores, width=0.8)
    for periodo, color in [("ajuste", AZUL), ("reservada", GRIS)]:
        media = t.loc[t["periodo"] == periodo, "energia_kwh"].mean()
        tramo = x[t["periodo"] == periodo]
        ax.hlines(media, tramo.min() - pd.Timedelta(hours=10), tramo.max() + pd.Timedelta(hours=10),
                  color=NARANJA, lw=1.4, ls="--")
        ax.annotate(f"media {media:.1f} kWh", (tramo.min(), media), xytext=(0, 4), textcoords="offset points",
                    fontsize=8, color="#3d3c39", path_effects=HALO)
    ax.legend(handles=[Patch(color=AZUL, label="Ajuste (1–21/02)"),
                       Patch(color=GRIS, label="Reservada (22–28/02), solo descriptiva")], loc="upper left")
    ax.set_ylim(0, t["energia_kwh"].max() * 1.25)
    ax.xaxis.set_major_formatter(DateFormatter("%d/%m"))
    ax.set_xlabel("Día de salida")
    ax.set_ylabel("Energía de tracción (kWh/día)")
    ax.set_title(f"Energía diaria de la flota con {CONSUMO_WH_KM} Wh/km, viajes elegibles de febrero de 2021\n"
                 f"1 kWh equivale a {1000 / BATERIA_WH:.2f} cargas completas de {BATERIA_WH} Wh", fontsize=9)
    guardar_figura(fig, TEMA, "T16_flota_diaria")
    return t


# ---------------------------------------------------- por celda de destino

def por_celda_destino(v: pd.DataFrame) -> pd.DataFrame:
    """Energía que llega a cada celda: se supone que se recarga donde se deja el patinete."""
    aj = v[v["periodo"] == "ajuste"]
    n_dias = len(dias_periodo("ajuste"))
    sol0, sol1 = PARAMETROS["horas_sol"]
    tar0, tar1 = PARAMETROS["horas_tarde"]
    en_sol = aj["hora_llegada"].between(sol0, sol1 - 1)
    en_tarde = aj["hora_llegada"].between(tar0, tar1 - 1)
    t = aj.assign(wh_sol=aj["energia_wh"].where(en_sol, 0.0), wh_tarde=aj["energia_wh"].where(en_tarde, 0.0)) \
        .groupby("h3_d").agg(llegadas=("trip_id", "size"), energia_wh=("energia_wh", "sum"),
                             wh_sol=("wh_sol", "sum"), wh_tarde=("wh_tarde", "sum"))
    t["kwh_dia"] = t["energia_wh"] / 1000 / n_dias
    t["cargas_completas_dia"] = t["energia_wh"] / BATERIA_WH / n_dias
    t[f"pct_energia_{sol0}_{sol1}h"] = 100 * t["wh_sol"] / t["energia_wh"]
    t[f"pct_energia_{tar0}_{tar1}h"] = 100 * t["wh_tarde"] / t["energia_wh"]
    t["pct_energia_resto"] =100 - t[f"pct_energia_{sol0}_{sol1}h"] - t[f"pct_energia_{tar0}_{tar1}h"]
    t["pct_energia_total"] = 100 * t["energia_wh"] / t["energia_wh"].sum()
    t = t.drop(columns=["wh_sol", "wh_tarde"]).reset_index().rename(columns={"h3_d": "h3"})
    t = t.sort_values(["energia_wh", "h3"], ascending=[False, True], ignore_index=True)
    t.insert(0, "rango", np.arange(1, len(t) + 1))
    t["pct_energia_acumulada"] = t["pct_energia_total"].cumsum()
    centros = np.array([h3.cell_to_latlng(c) for c in t["h3"]])
    t["lat"], t["lon"] = centros[:, 0].round(6), centros[:, 1].round(6)
    guardar_tabla(redondear(t), "T16_energia_celdas")
    guardar_tabla(redondear(t.head(PARAMETROS["top_celdas"])), f"T16_energia_celdas_top{PARAMETROS['top_celdas']}")

    # Mapa de kWh por día.
    fig, ax = plt.subplots(figsize=(6.5, 4.6))
    polys = [np.array(h3.cell_to_boundary(c))[:, ::-1] for c in t["h3"]]
    pc = PolyCollection(polys, array=t["kwh_dia"].to_numpy(), cmap=CMAP_SECUENCIAL, edgecolors="white",
                        linewidths=0.3)
    ax.add_collection(pc)
    puntos = np.vstack(polys)
    lat0, lat1 = puntos[:, 1].min() - 0.004, puntos[:, 1].max() + 0.004
    ax.set_xlim(puntos[:, 0].min() - 0.004, puntos[:, 0].max() + 0.004)
    ax.set_ylim(lat0, lat1)
    ax.set_aspect(1 / np.cos(np.radians((lat0 + lat1) / 2)))
    ax.grid(False)
    ax.xaxis.set_major_locator(MaxNLocator(3))
    ax.xaxis.set_major_formatter(FormatStrFormatter("%.2f"))
    ax.yaxis.set_major_formatter(FormatStrFormatter("%.2f"))
    for _, fila in t.head(5).iterrows():
        ax.annotate(str(fila["rango"]), (fila["lon"], fila["lat"]), ha="center", va="center", fontsize=8,
                    color="white", fontweight="bold")
    ax.set_xlabel("Longitud (°)")
    ax.set_ylabel("Latitud (°)")
    fig.colorbar(pc, ax=ax, shrink=0.8, pad=0.02).set_label("Energía que llega (kWh/día)")
    ax.set_title(f"Energía de tracción por celda H3 de destino (res. {PARAMETROS['res_celdas']}),\n"
                 f"{TITULO_AJUSTE}. Número: rango de las 5 primeras", fontsize=9)
    guardar_figura(fig, TEMA, "T16_energia_celdas")
    return t


def perfil_horario(v: pd.DataFrame) -> dict:
    aj = v[v["periodo"] == "ajuste"]
    n_dias = len(dias_periodo("ajuste"))
    t = (aj.groupby("hora_llegada")["energia_wh"].agg(["size", "sum"])
         .reindex(range(24), fill_value=0).rename(columns={"size": "llegadas", "sum": "energia_wh"}))
    t.index.name = "hora"
    t["energia_wh_dia"] = t["energia_wh"] / n_dias
    t["pct_energia"] = 100 * t["energia_wh"] / t["energia_wh"].sum()
    t = t.reset_index()
    guardar_tabla(redondear(t), "T16_perfil_horario")

    sol0, sol1 = PARAMETROS["horas_sol"]
    tar0, tar1 = PARAMETROS["horas_tarde"]
    pct_sol = t.loc[t["hora"].between(sol0, sol1 - 1), "pct_energia"].sum()
    pct_tarde = t.loc[t["hora"].between(tar0, tar1 - 1), "pct_energia"].sum()

    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    ax.axvspan(sol0 - 0.5, sol1 - 0.5, color="#fde9b8", zorder=0, lw=0)
    ax.bar(t["hora"], t["energia_wh_dia"] / 1000, color=AZUL, width=0.8)
    ax.annotate(f"{sol0}–{sol1} h: {pct_sol:.1f} %", ((sol0 + sol1) / 2 - 0.5, 1), xycoords=("data", "axes fraction"),
                xytext=(0, -4), textcoords="offset points", ha="center", va="top", fontsize=8, color="#3d3c39")
    ax.annotate(f"{tar0}–{tar1} h: {pct_tarde:.1f} %", ((tar0 + tar1) / 2 - 0.5, 1),
                xycoords=("data", "axes fraction"), xytext=(0, -4), textcoords="offset points", ha="center",
                va="top", fontsize=8, color="#3d3c39")
    ax.set_xticks(range(0, 24, 2))
    ax.set_xlim(-0.6, 23.6)
    ax.set_ylim(0, t["energia_wh_dia"].max() / 1000 * 1.2)
    ax.set_xlabel("Hora de llegada (Europe/Rome)")
    ax.set_ylabel("Energía que llega (kWh/día)")
    ax.set_title(f"Perfil horario de la energía que llega a destino, {TITULO_AJUSTE}\n"
                 f"Banda amarilla: horas de sol de referencia ({sol0}–{sol1} h)", fontsize=9)
    guardar_figura(fig, TEMA, "T16_perfil_horario")
    return {f"pct_energia_llega_{sol0}_{sol1}h": pct_sol, f"pct_energia_llega_{tar0}_{tar1}h": pct_tarde,
            "pct_energia_llega_resto": 100 - pct_sol - pct_tarde}


def distribuciones_figura(v: pd.DataFrame, pd_dia: pd.DataFrame, patinete: pd.DataFrame) -> None:
    aj = v[v["periodo"] == "ajuste"]
    g = pd_dia[pd_dia["periodo"] == "ajuste"]
    a = patinete[patinete["viajes_ajuste"] > 0]
    fig, ejes = plt.subplots(1, 3, figsize=(6.5, 3.2))
    fig.subplots_adjust(wspace=0.6)

    ax = ejes[0]
    ax.hist(aj["energia_wh"], bins=60, color=AZUL)
    ax.set_xlabel("Wh por viaje")
    ax.set_ylabel("Frecuencia")
    ax.set_title(f"Viaje\nP95 {aj['energia_wh'].quantile(0.95):.0f} Wh", fontsize=9)

    ax = ejes[1]
    ax.hist(g["energia_wh"], bins=60, color=AZUL)
    for u in PARAMETROS["umbrales_bateria_pct"]:
        wh = BATERIA_WH * u / 100
        if wh <= g["energia_wh"].max() * 1.05:
            ax.axvline(wh, color=NARANJA, lw=1, ls="--")
    ax.set_xlabel("Wh por patinete y día")
    ax.set_title(f"Patinete-día\nmáx. {g['energia_wh'].max():.0f} Wh", fontsize=9)

    ax = ejes[2]
    dias = np.sort(a["dias_autonomia_estimada"].to_numpy())
    ax.plot(dias, 100 * np.arange(1, len(dias) + 1) / len(dias), color=AZUL, lw=2)
    ax.set_xscale("log")
    marcas = [1, 7, 30, 300]
    ax.set_xticks(marcas)
    ax.set_xticklabels([str(m) for m in marcas])
    ax.minorticks_off()
    for d in (1, 7, 30):
        ax.axvline(d, color=GRIS, lw=0.8, ls=":")
    ax.set_xlabel("Autonomía (días, log.)")
    ax.set_ylabel("Patinetes acumulados (%)")
    ax.set_title(f"Patinete\nmediana {np.median(dias):.0f} días", fontsize=9)

    fig.suptitle(f"Energía con {CONSUMO_WH_KM} Wh/km y batería de {BATERIA_WH} Wh, {TITULO_AJUSTE}.\n"
                 "Discontinua: 50 % de la batería. Autonomía = batería / energía media por día en servicio",
                 fontsize=9, y=1.1)
    guardar_figura(fig, TEMA, "T16_distribuciones")


# --------------------------------------------------------------- comprobación

def comprobaciones(v, pd_dia, patinete, flota, celdas) -> pd.DataFrame:
    p = PARAMETROS
    control = float(energia_wh(p["control_dis_m"]))
    assert abs(control - p["control_energia_wh"]) < 1e-9, control
    aj = v[v["periodo"] == "ajuste"]
    base_aj, base_mes = aj["energia_wh"].sum(), v["energia_wh"].sum()
    filas = [
        ("control_2km", control, p["control_energia_wh"]),
        ("ajuste_patinete", patinete["energia_wh_ajuste"].sum(), base_aj),
        ("ajuste_patinete_dia", pd_dia.loc[pd_dia["periodo"] == "ajuste", "energia_wh"].sum(), base_aj),
        ("ajuste_flota_dia", flota.loc[flota["periodo"] == "ajuste", "energia_wh"].sum(), base_aj),
        ("ajuste_celda_destino", celdas["energia_wh"].sum(), base_aj),
        ("mes_patinete", patinete["energia_wh_mes"].sum(), base_mes),
        ("mes_patinete_dia", pd_dia["energia_wh"].sum(), base_mes),
        ("mes_flota_dia", flota["energia_wh"].sum(), base_mes),
    ]
    t = pd.DataFrame(filas, columns=["agregado", "energia_wh", "referencia_wh"])
    t["diferencia_wh"] = (t["energia_wh"] - t["referencia_wh"]).abs()
    t["cuadra"] = t["diferencia_wh"] < p["tolerancia_cuadre_wh"]
    assert t["cuadra"].all(), t
    t[["energia_wh", "referencia_wh"]] = t[["energia_wh", "referencia_wh"]].round(3)
    t["diferencia_wh"] = t["diferencia_wh"].round(6)
    guardar_tabla(t, "T16_comprobacion")
    return t


def main() -> None:
    v = preparar(cargar_viajes())
    por_viaje(v)
    pd_dia = por_patinete_dia(v)
    patinete = por_patinete(v)
    flota = flota_diaria(v)
    celdas = por_celda_destino(v)
    reparto = perfil_horario(v)
    distribuciones_figura(v, pd_dia, patinete)
    comprobacion = comprobaciones(v, pd_dia, patinete, flota, celdas)

    aj = flota[flota["periodo"] == "ajuste"]
    rs = flota[flota["periodo"] == "reservada"]
    resumen = {
        "consumo_wh_km": CONSUMO_WH_KM,
        "bateria_wh": BATERIA_WH,
        "flota_km_dia_media_ajuste": aj["km"].mean(),
        "flota_kwh_dia_media_ajuste": aj["energia_kwh"].mean(),
        "flota_kwh_dia_max_ajuste": aj["energia_kwh"].max(),
        "flota_cargas_dia_media_ajuste": aj["cargas_completas_equivalentes"].mean(),
        "flota_cargas_dia_max_ajuste": aj["cargas_completas_equivalentes"].max(),
        "flota_kwh_dia_media_reservada": rs["energia_kwh"].mean(),
        "flota_kwh_total_ajuste": aj["energia_kwh"].sum(),
        "celdas_destino_ajuste": len(celdas),
        "celda_kwh_dia_max": celdas["kwh_dia"].max(),
        "celda_kwh_dia_p50": celdas["kwh_dia"].median(),
        "celdas_80pct_energia":int((celdas["pct_energia_acumulada"] < 80).sum() + 1),
        **reparto,
    }
    guardar_tabla(tabla_resumen(resumen), "T16_resumen")

    tablas = carpeta_tablas(TEMA)
    for nombre in ["T16_patinete_resumen", "T16_resumen"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").to_string(index=False))
    for nombre in ["T16_viaje_distribucion", "T16_patinete_dia_resumen"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").T.to_string(header=False))
    print("\nT16_comprobacion\n" + comprobacion.to_string(index=False))


if __name__ == "__main__":
    main()
