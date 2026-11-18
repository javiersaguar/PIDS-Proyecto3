"""T13 y T14. Exploración espacial de la demanda en rejilla H3.

T13: densidad de orígenes y destinos, concentración, puntos aislados y estabilidad
entre periodos.
T14: saldo neto orígenes − destinos por celda, franja horaria y día, persistencia y
cota inferior del rebalanceo diario.

Uso: python exploracion/espacial.py
"""

import h3
import numpy as np
import pandas as pd
from matplotlib import patheffects
from matplotlib.collections import PolyCollection
from matplotlib.colors import LinearSegmentedColormap, LogNorm, Normalize
from matplotlib.dates import DateFormatter
from matplotlib.ticker import FormatStrFormatter, FuncFormatter, MaxNLocator
from scipy.stats import spearmanr

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt
from comun.geo import haversine_m

TEMA = "exploracion"
CFG = cargar_config()
RESOLUCIONES = CFG["exploracion"]["resoluciones_h3"]
FRANJAS = CFG["exploracion"]["franjas_horarias"]  # fijadas en T12
NOMBRES_FRANJA = {"madrugada": "Madrugada", "punta_manana": "Punta de mañana", "mediodia": "Mediodía",
                  "punta_tarde": "Punta de tarde", "noche": "Noche"}

PARAMETROS = {
    # Resolución de los mapas (punto de partida del plan).
    "res_mapas": 8,
    # Cuotas de extremos para las que se buscan las celdas necesarias (%).
    "cuotas_pct": [50, 80, 90, 95],
    # Porcentaje de celdas más usadas cuya demanda se mide (%).
    "celdas_top_pct": [10, 20],
    # Puntos aislados (T13.5): celda con pocos extremos en todo el mes y lejos de
    # cualquier celda con demanda apreciable. Distancia entre centros de celda.
    "aislado_max_extremos": 2,
    "aislado_min_extremos_densa": 10,
    "aislado_dist_min_m": 1000,
    # Puntos de referencia para orientar los mapas (lat, lon aproximadas).
    "referencias": {
        "Termini": (41.9009, 12.5019),
        "Coliseo": (41.8903, 12.4922),
        "San Pedro": (41.9022, 12.4536),
    },
    # Saldo (T14): mínimo de orígenes + destinos para que una celda cuente. Si una
    # celda estuviera equilibrada, cada extremo sería origen o destino con p = 0,5 y
    # la desviación típica de saldo_rel sería 1/sqrt(n): con n = 30, 0,18. Por debajo
    # de 30 extremos el ruido domina cualquier desequilibrio moderado.
    "saldo_min_extremos": 30,
    # Número de celdas con mayor saldo absoluto en la figura del saldo acumulado.
    "saldo_top_celdas": 10,
}

TITULO_AJUSTE = "periodo de ajuste (1–21/02/2021)"

# Rampa secuencial de un solo tono (azul) y color para celdas sin dato.
CMAP_SECUENCIAL = LinearSegmentedColormap.from_list(
    "azules", ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])
CMAP_SECUENCIAL.set_bad("#e4e3df")
COLOR_TEXTO = "#3d3c39"
# Escala divergente: receptoras (D > O) en azul, emisoras (O > D) en rojo, centro gris.
CMAP_DIVERGENTE = LinearSegmentedColormap.from_list(
    "saldo", ["#0d366b", "#2a78d6", "#9ec5f4", "#f0efec", "#f3b1a9", "#e34948", "#8f1d1d"])
CMAP_DIVERGENTE.set_bad("#d5d4cf")
COLOR_EMISORA, COLOR_RECEPTORA = "#e34948", "#2a78d6"
GRIS_REF = "#8a8984"
HALO = [patheffects.withStroke(linewidth=2.2, foreground="white")]


# ---------------------------------------------------------------- utilidades

def guardar_tabla(df: pd.DataFrame, nombre: str) -> None:
    df.to_csv(carpeta_tablas(TEMA) / f"{nombre}.csv", index=False, lineterminator="\n")


def celda(lat: pd.Series, lon: pd.Series, res: int) -> pd.Series:
    """Celda H3 de cada punto."""
    return pd.Series([h3.latlng_to_cell(a, b, res) for a, b in zip(lat, lon)], index=lat.index, dtype="string")


def centros(celdas) -> tuple[np.ndarray, np.ndarray]:
    """Latitud y longitud del centro de cada celda."""
    coords = np.array([h3.cell_to_latlng(c) for c in celdas], dtype=float).reshape(-1, 2)
    return coords[:, 0], coords[:, 1]


def conteo_celdas(viajes: pd.DataFrame, res: int) -> pd.DataFrame:
    """Orígenes, destinos y extremos por celda, ordenadas de más a menos extremos."""
    o = celda(viajes["latO"], viajes["lonO"], res).value_counts().rename("origenes")
    d = celda(viajes["latD"], viajes["lonD"], res).value_counts().rename("destinos")
    t = pd.concat([o, d], axis=1).fillna(0).astype("int64")
    t.index.name = "h3"
    t["extremos"] = t["origenes"] + t["destinos"]
    t = t.reset_index().sort_values(["extremos", "h3"], ascending=[False, True], ignore_index=True)
    t.insert(1, "res", res)
    t["lat"], t["lon"] = centros(t["h3"])
    return t


def poligonos(celdas) -> list[np.ndarray]:
    """Contorno (lon, lat) de cada celda."""
    return [np.array(h3.cell_to_boundary(c))[:, ::-1] for c in celdas]


def dibujar_celdas(ax, celdas, valores, cmap, norm, borde="white"):
    pc = PolyCollection(poligonos(celdas), array=np.asarray(valores, dtype=float), cmap=cmap,
                        norm=norm, edgecolors=borde, linewidths=0.3)
    ax.add_collection(pc)
    return pc


def extension(celdas, margen: float = 0.004) -> tuple[float, float, float, float]:
    puntos = np.vstack(poligonos(celdas))
    return (puntos[:, 0].min() - margen, puntos[:, 0].max() + margen,
            puntos[:, 1].min() - margen, puntos[:, 1].max() + margen)


def preparar_mapa(ax, ext, referencias: bool = True, ejes: bool = True, escala: bool = True) -> None:
    """Límites, proporción local, puntos de referencia y barra de escala de 1 km."""
    lon0, lon1, lat0, lat1 = ext
    ax.set_xlim(lon0, lon1)
    ax.set_ylim(lat0, lat1)
    ax.set_aspect(1 / np.cos(np.radians((lat0 + lat1) / 2)))
    ax.grid(False)
    ax.tick_params(labelsize=8)
    ax.xaxis.set_major_locator(MaxNLocator(3))
    ax.xaxis.set_major_formatter(FormatStrFormatter("%.2f"))
    ax.yaxis.set_major_formatter(FormatStrFormatter("%.2f"))
    if ejes:
        ax.set_xlabel("Longitud (°)")
        ax.set_ylabel("Latitud (°)")
    else:
        ax.set_xticks([])
        ax.set_yticks([])
        for lado in ("left", "bottom"):
            ax.spines[lado].set_visible(False)
    if referencias:
        for nombre, (lat, lon) in PARAMETROS["referencias"].items():
            if lon0 < lon < lon1 and lat0 < lat < lat1:
                ax.plot(lon, lat, marker="o", ms=3.5, mfc="white", mec="black", mew=0.8, zorder=5)
                ax.annotate(nombre, (lon, lat), xytext=(3, 3), textcoords="offset points",
                            fontsize=8, color="black", zorder=5, path_effects=HALO)
    if not escala:
        return
    # Barra de escala de 1 km en la esquina inferior izquierda.
    lat_b = lat0 + 0.05 * (lat1 - lat0)
    grados_km = 1000 / haversine_m(lat_b, 0.0, lat_b, 1.0)
    lon_b = lon0 + 0.06 * (lon1 - lon0)
    ax.plot([lon_b, lon_b + grados_km], [lat_b, lat_b], color="black", lw=2, solid_capstyle="butt")
    ax.annotate("1 km", (lon_b + grados_km / 2, lat_b), xytext=(0, 3), textcoords="offset points",
                ha="center", fontsize=8, path_effects=HALO)


def barra_log(fig, pc, ax, etiqueta: str):
    """Barra de color con números enteros en lugar de potencias de 10."""
    barra = fig.colorbar(pc, ax=ax, shrink=0.8, pad=0.02)
    barra.ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    barra.set_label(etiqueta)
    return barra


# ---------------------------------------------------------------------- T13

def t13_resoluciones(conteos: dict[int, pd.DataFrame], n_viajes: int) -> None:
    filas = []
    for res, t in conteos.items():
        assert t["origenes"].sum() == n_viajes and t["destinos"].sum() == n_viajes, res
        filas.append({
            "res": res,
            "area_media_km2": round(h3.average_hexagon_area(res, unit="km^2"), 4),
            "arista_media_m": round(h3.average_hexagon_edge_length(res, unit="m"), 1),
            "viajes": n_viajes,
            "origenes": int(t["origenes"].sum()),
            "destinos": int(t["destinos"].sum()),
            "celdas_con_demanda": len(t),
            "extremos_por_celda_mediana": float(t["extremos"].median()),
            "extremos_por_celda_max": int(t["extremos"].max()),
        })
    guardar_tabla(pd.DataFrame(filas), "T13_resoluciones_h3")


def t13_concentracion(conteos: dict[int, pd.DataFrame]) -> None:
    filas = []
    fig, ax = plt.subplots(figsize=(6.5, 4.0))
    colores = {RESOLUCIONES[0]: "#2a78d6", RESOLUCIONES[1]: "#eb6834"}
    for res, t in conteos.items():
        ext = t["extremos"].to_numpy()  # ya ordenadas de más a menos
        total, n = int(ext.sum()), len(ext)
        acum = np.cumsum(ext)
        fila = {"res": res, "celdas_con_demanda": n, "extremos": total}
        for p in PARAMETROS["cuotas_pct"]:
            k = int(np.argmax(acum * 100 >= p * total)) + 1
            fila[f"celdas_{p}pct"] = k
            fila[f"area_{p}pct_km2"] = round(k * h3.average_hexagon_area(res, unit="km^2"), 2)
        for q in PARAMETROS["celdas_top_pct"]:
            k = int(np.ceil(n * q / 100))
            fila[f"pct_extremos_top{q}pct_celdas"] = round(100 * acum[k - 1] / total, 2)
        filas.append(fila)

        x = np.arange(1, n + 1)
        ax.plot(x, 100 * acum / total, color=colores[res], lw=2, label=f"Resolución {res} ({n} celdas)")
        for p in PARAMETROS["cuotas_pct"]:
            k = fila[f"celdas_{p}pct"]
            ax.plot(k, 100 * acum[k - 1] / total, "o", ms=4, color=colores[res])
            ax.annotate(str(k), (k, 100 * acum[k - 1] / total), xytext=(4, -10), textcoords="offset points",
                        fontsize=8, color=COLOR_TEXTO)
    for p in PARAMETROS["cuotas_pct"]:
        ax.axhline(p, color="#8a8984", lw=0.6, ls=":")
    ax.set_xscale("log")
    ax.set_xlabel("Número de celdas, de más a menos usadas (escala log.)")
    ax.set_ylabel("Extremos acumulados (%)")
    ax.set_ylim(0, 101)
    ax.set_title(f"Concentración de orígenes + destinos en celdas H3, {TITULO_AJUSTE}")
    ax.legend(loc="lower right")
    guardar_figura(fig, TEMA, "T13_concentracion")
    guardar_tabla(pd.DataFrame(filas), "T13_concentracion")


def t13_estaciones(t: pd.DataFrame) -> None:
    """Orden de magnitud del número de estaciones para cada radio del plan.

    Área de las celdas más usadas que reúnen cada cuota de extremos, dividida entre el
    área que cubre una estación sin huecos en una malla hexagonal de círculos de radio R
    (el hexágono inscrito, 3·√3/2·R²). No es una solución de localización: solo acota
    el barrido.
    """
    res = int(t["res"].iloc[0])
    ext = t["extremos"].to_numpy()
    acum = np.cumsum(ext)
    filas = []
    for radio in CFG["movilidad"]["radios_acceso_m"]:
        area_estacion = 3 * np.sqrt(3) / 2 * radio ** 2 / 1e6
        for p in PARAMETROS["cuotas_pct"]:
            k = int(np.argmax(acum * 100 >= p * acum[-1])) + 1
            area = k * h3.average_hexagon_area(res, unit="km^2")
            filas.append({"radio_m": radio, "cuota_pct": p, "res": res, "celdas": k,
                          "area_km2": round(area, 2), "area_por_estacion_km2": round(area_estacion, 4),
                          "estaciones_orden_magnitud": int(np.ceil(area / area_estacion))})
    guardar_tabla(pd.DataFrame(filas), "T13_estaciones_orden_magnitud")


def t13_mapa_densidad(t: pd.DataFrame) -> None:
    res = int(t["res"].iloc[0])
    ext = extension(t["h3"])
    positivos = pd.concat([t["origenes"], t["destinos"]])
    norm = LogNorm(vmin=1, vmax=positivos.max())
    fig, ejes = plt.subplots(1, 2, figsize=(6.5, 4.6), sharey=True)
    for ax, col, titulo in zip(ejes, ["origenes", "destinos"], ["Orígenes", "Destinos"]):
        valores = t[col].where(t[col] > 0, np.nan)
        pc = dibujar_celdas(ax, t["h3"], valores, CMAP_SECUENCIAL, norm)
        preparar_mapa(ax, ext)
        ax.set_title(f"{titulo} (total {t[col].sum():,})".replace(",", " "))
    ejes[1].set_ylabel("")
    barra_log(fig, pc, ejes, "Viajes por celda (escala log.)")
    fig.suptitle(f"Orígenes y destinos por celda H3 de resolución {res}, {TITULO_AJUSTE}\n"
                 "Gris: celda sin orígenes o sin destinos", fontsize=9)
    guardar_figura(fig, TEMA, f"T13_densidad_res{res}")


def t13_puntos_aislados(todos: pd.DataFrame) -> None:
    """Extremos en celdas casi vacías y alejadas de la demanda (todos los viajes del mes)."""
    p = PARAMETROS
    res = p["res_mapas"]
    extremos = pd.concat([
        pd.DataFrame({"trip_id": todos["trip_id"], "extremo": "origen", "lat": todos["latO"], "lon": todos["lonO"],
                      "elegible": todos["elegible"], "periodo": todos["periodo"], "motivo": todos["motivo"]}),
        pd.DataFrame({"trip_id": todos["trip_id"], "extremo": "destino", "lat": todos["latD"], "lon": todos["lonD"],
                      "elegible": todos["elegible"], "periodo": todos["periodo"], "motivo": todos["motivo"]}),
    ], ignore_index=True)
    extremos["h3"] = celda(extremos["lat"], extremos["lon"], res)
    por_celda = extremos["h3"].value_counts().rename("extremos_celda_mes")
    densas = por_celda[por_celda >= p["aislado_min_extremos_densa"]].index
    pocas = por_celda[por_celda <= p["aislado_max_extremos"]].index
    lat_d, lon_d = centros(densas)
    lat_p, lon_p = centros(pocas)
    dist = haversine_m(lat_p[:, None], lon_p[:, None], lat_d[None, :], lon_d[None, :]).min(axis=1)
    dist = pd.Series(dist, index=pocas, name="dist_celda_densa_m")
    aisladas = dist[dist > p["aislado_dist_min_m"]].index

    sel = extremos[extremos["h3"].isin(aisladas)].copy()
    sel = sel.join(por_celda, on="h3").join(dist.round(0), on="h3")
    sel = sel.sort_values(["trip_id", "extremo"], ignore_index=True)
    sel[["lat", "lon"]] = sel[["lat", "lon"]].round(6)
    guardar_tabla(sel[["trip_id", "extremo", "h3", "lat", "lon", "extremos_celda_mes", "dist_celda_densa_m",
                       "elegible", "periodo", "motivo"]], "T13_puntos_aislados")

    viajes = sel.drop_duplicates("trip_id")
    resumen = pd.DataFrame([{
        "res": res,
        "viajes_mes": len(todos),
        "celdas_con_extremos": len(por_celda),
        "celdas_densas": len(densas),
        "celdas_poco_usadas": len(pocas),
        "celdas_aisladas": len(aisladas),
        "extremos_aislados": len(sel),
        "viajes_afectados": len(viajes),
        "viajes_afectados_elegibles": int(viajes["elegible"].sum()),
        "viajes_afectados_elegibles_ajuste": int((viajes["elegible"] & (viajes["periodo"] == "ajuste")).sum()),
    }])
    guardar_tabla(resumen, "T13_puntos_aislados_resumen")

    # Mapa: celdas del mes en gris según su uso y extremos aislados en rojo.
    t = por_celda.reset_index()
    fig, ax = plt.subplots(figsize=(6.5, 4.6))
    pc = dibujar_celdas(ax, t["h3"], t["extremos_celda_mes"], CMAP_SECUENCIAL,
                        LogNorm(vmin=1, vmax=t["extremos_celda_mes"].max()))
    preparar_mapa(ax, extension(t["h3"]))
    if len(sel):
        ax.scatter(sel["lon"], sel["lat"], s=18, facecolor="#e34948", edgecolor="white", lw=0.6, zorder=6,
                   label=f"Extremo aislado ({len(sel)})")
        ax.legend(loc="lower right")
    barra_log(fig, pc, ax, "Extremos por celda en el mes (escala log.)")
    ax.set_title(f"Extremos aislados: celda de res. {res} con ≤ {p['aislado_max_extremos']} extremos y a más de "
                 f"{p['aislado_dist_min_m'] / 1000:.0f} km\nde una celda con ≥ {p['aislado_min_extremos_densa']}. "
                 "Todos los viajes del CSV, febrero de 2021")
    guardar_figura(fig, TEMA, "T13_puntos_aislados")


def t13_estabilidad(ajuste: pd.DataFrame, reservada: pd.DataFrame) -> None:
    filas = []
    for res in RESOLUCIONES:
        a = conteo_celdas(ajuste, res).set_index("h3")["extremos"]
        r = conteo_celdas(reservada, res).set_index("h3")["extremos"]
        union = a.index.union(r.index)
        cuota_a = a.reindex(union, fill_value=0) / a.sum()
        cuota_r = r.reindex(union, fill_value=0) / r.sum()
        rho = spearmanr(cuota_a, cuota_r).statistic
        filas.append({
            "res": res,
            "celdas_ajuste": len(a),
            "celdas_reservada": len(r),
            "celdas_union": len(union),
            "celdas_solo_reservada": int((~r.index.isin(a.index)).sum()),
            "spearman_cuotas": round(float(rho), 4),
            "pct_extremos_reservada_en_celdas_ajuste": round(100 * r[r.index.isin(a.index)].sum() / r.sum(), 2),
        })
    guardar_tabla(pd.DataFrame(filas), "T13_estabilidad")


# ---------------------------------------------------------------------- T14

def franja(hora: pd.Series) -> pd.Series:
    """Nombre de la franja horaria de cada hora."""
    etiqueta = pd.Series(pd.NA, index=hora.index, dtype="string")
    for nombre, (inicio, fin) in FRANJAS.items():
        etiqueta[(hora >= inicio) & (hora < fin)] = nombre
    assert etiqueta.notna().all()
    return etiqueta


def dias_periodo(nombre: str) -> pd.Index:
    inicio, fin = CFG["datos"]["periodos"][nombre]
    return pd.Index(pd.date_range(inicio, fin, freq="D").strftime("%Y-%m-%d"), dtype="string")


def extremos_t14(viajes: pd.DataFrame, res: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Salidas (por tsO) y llegadas (por tsD) con su celda, día y franja."""
    o = pd.DataFrame({"h3": celda(viajes["latO"], viajes["lonO"], res),
                      "fecha": viajes["tsO"].dt.strftime("%Y-%m-%d").astype("string"),
                      "franja": franja(viajes["tsO"].dt.hour)})
    d = pd.DataFrame({"h3": celda(viajes["latD"], viajes["lonD"], res),
                      "fecha": viajes["tsD"].dt.strftime("%Y-%m-%d").astype("string"),
                      "franja": franja(viajes["tsD"].dt.hour)})
    return o, d


def saldo(o: pd.DataFrame, d: pd.DataFrame, claves: list[str]) -> pd.DataFrame:
    """Orígenes, destinos, saldo O − D y saldo relativo agrupados por `claves`."""
    t = pd.concat([o.groupby(claves).size().rename("origenes"),
                   d.groupby(claves).size().rename("destinos")], axis=1).fillna(0).astype("int64")
    t["extremos"] = t["origenes"] + t["destinos"]
    t["saldo"] = t["origenes"] - t["destinos"]
    t["saldo_rel"] = (t["saldo"] / t["extremos"]).round(4)
    t["incluida"] = t["extremos"] >= PARAMETROS["saldo_min_extremos"]
    return t.reset_index()


def mapa_saldo(ax, t: pd.DataFrame, columna: str, norm, ext, **kw):
    """Celdas incluidas con escala divergente y el resto en gris."""
    valores = t[columna].where(t["incluida"], np.nan)
    pc = dibujar_celdas(ax, t["h3"], valores, CMAP_DIVERGENTE, norm)
    preparar_mapa(ax, ext, **kw)
    return pc


def t14_saldo_total(o, d, n_dias: int) -> pd.DataFrame:
    t = saldo(o, d, ["h3"])
    t["saldo_dia"] = (t["saldo"] / n_dias).round(3)
    # Desequilibrio mayor que dos desviaciones típicas del caso equilibrado.
    t["signif_2sigma"] = t["saldo_rel"].abs() > 2 / np.sqrt(t["extremos"])
    t["tipo"] = np.select([~t["incluida"], t["saldo"] > 0, t["saldo"] < 0],
                          ["poco_uso", "emisora", "receptora"], "equilibrada")
    t["lat"], t["lon"] = centros(t["h3"])
    t[["lat", "lon"]] = t[["lat", "lon"]].round(6)
    t = t.sort_values(["saldo", "h3"], ascending=[False, True], ignore_index=True)
    guardar_tabla(t, "T14_saldo_celdas")

    ext = extension(t["h3"])
    fig, ejes = plt.subplots(1, 2, figsize=(6.5, 4.8), sharey=True)
    lim = t.loc[t["incluida"], "saldo_dia"].abs().max()
    pc = mapa_saldo(ejes[0], t, "saldo_dia", Normalize(-lim, lim), ext)
    fig.colorbar(pc, ax=ejes[0], shrink=0.8, pad=0.12, location="bottom").set_label("Saldo O − D (patinetes/día)")
    ejes[0].set_title("Saldo medio diario")
    pc = mapa_saldo(ejes[1], t, "saldo_rel", Normalize(-1, 1), ext)
    fig.colorbar(pc, ax=ejes[1], shrink=0.8, pad=0.12, location="bottom").set_label("Saldo relativo (O − D)/(O + D)")
    ejes[1].set_title("Saldo relativo")
    ejes[1].set_ylabel("")
    fig.suptitle(f"Saldo neto por celda H3 de res. {PARAMETROS['res_mapas']}, {TITULO_AJUSTE}\n"
                 "Rojo: emisora (más salidas). Azul: receptora (más llegadas). "
                 f"Gris: menos de {PARAMETROS['saldo_min_extremos']} extremos", fontsize=9)
    guardar_figura(fig, TEMA, "T14_saldo")
    return t


def t14_saldo_franjas(o, d, n_dias: int, ext) -> None:
    t = saldo(o, d, ["h3", "franja"])
    t["saldo_dia"] = (t["saldo"] / n_dias).round(3)
    orden = {nombre: i for i, nombre in enumerate(FRANJAS)}
    t["_orden"] = t["franja"].map(orden)
    t = t.sort_values(["_orden", "saldo", "h3"], ascending=[True, False, True], ignore_index=True)
    t = t.drop(columns="_orden")
    guardar_tabla(t, "T14_saldo_franjas")

    lim = t.loc[t["incluida"], "saldo_dia"].abs().max()
    norm = Normalize(-lim, lim)
    fig, ejes = plt.subplots(1, len(FRANJAS), figsize=(6.5, 3.4))
    for i, (ax, (nombre, (inicio, fin))) in enumerate(zip(ejes, FRANJAS.items())):
        sub = t[t["franja"] == nombre]
        pc = mapa_saldo(ax, sub, "saldo_dia", norm, ext, ejes=False, referencias=False, escala=(i == 0))
        ax.set_title(f"{NOMBRES_FRANJA.get(nombre, nombre)}\n{inicio}–{fin} h\n"
                     f"{int(sub['incluida'].sum())} celdas", fontsize=9)
    barra = fig.colorbar(pc, ax=ejes, orientation="horizontal", shrink=0.6, pad=0.04, aspect=40)
    barra.set_label("Saldo O − D en la franja (patinetes/día). Rojo: emisora; azul: receptora")
    fig.suptitle(f"Saldo neto por franja horaria, res.{PARAMETROS['res_mapas']}, {TITULO_AJUSTE}\n"
                 f"Gris: menos de {PARAMETROS['saldo_min_extremos']} extremos en la franja", fontsize=9)
    guardar_figura(fig, TEMA, "T14_saldo_franjas")

    # Desequilibrio por franja: patinetes que el flujo neto desplaza entre celdas.
    dias = saldo(o, d, ["h3", "franja", "fecha"])
    filas = []
    for nombre, (inicio, fin) in FRANJAS.items():
        estructural = t.loc[t["franja"] == nombre, "saldo"].abs().sum() / 2 / n_dias
        diario = (dias[dias["franja"] == nombre].groupby("fecha")["saldo"].apply(lambda s: s.abs().sum() / 2)
                  .reindex(dias_periodo("ajuste"), fill_value=0).mean())
        salidas = int(t.loc[t["franja"] == nombre, "origenes"].sum())
        filas.append({"franja": nombre, "inicio_h": inicio, "fin_h": fin,
                      "salidas_dia": round(salidas / n_dias, 1),
                      "desplazamiento_estructural_patinetes_dia": round(estructural, 1),
                      "desplazamiento_diario_medio_patinetes_dia": round(diario, 1),
                      "desplazamiento_estructural_patinetes_hora": round(estructural / (fin - inicio), 1),
                      "pct_salidas_desplazadas_estructural": round(100 * estructural * n_dias / salidas, 1)})
    guardar_tabla(pd.DataFrame(filas), "T14_desequilibrio_franjas")


def t14_persistencia(o, d, total: pd.DataFrame) -> None:
    dias = dias_periodo("ajuste")
    incluidas = total.loc[total["incluida"], "h3"]
    diario = saldo(o[o["h3"].isin(incluidas)], d[d["h3"].isin(incluidas)], ["h3", "fecha"])
    rejilla = pd.MultiIndex.from_product([incluidas.sort_values(), dias], names=["h3", "fecha"])
    diario = (diario.set_index(["h3", "fecha"])[["origenes", "destinos", "saldo"]]
              .reindex(rejilla, fill_value=0).reset_index())
    diario["saldo_acumulado"] = diario.groupby("h3")["saldo"].cumsum()
    guardar_tabla(diario, "T14_saldo_diario")

    signo_total = np.sign(total.set_index("h3")["saldo"])
    s = diario.assign(signo=np.sign(diario["saldo"]), signo_acum=np.sign(diario["saldo_acumulado"]),
                      signo_total=diario["h3"].map(signo_total))
    s["mismo"] = s["signo"] == s["signo_total"]
    s["contrario"] = s["signo"] == -s["signo_total"]
    s["cero"] = s["signo"] == 0
    s["acum_mismo"] = s["signo_acum"] == s["signo_total"]
    pers = s.groupby("h3")[["mismo", "contrario", "cero", "acum_mismo"]].sum().astype("int64")
    pers.columns = ["dias_mismo_signo", "dias_signo_contrario", "dias_saldo_cero", "dias_acumulado_mismo_signo"]
    pers["pct_dias_mismo_signo"] = (100 * pers["dias_mismo_signo"] / len(dias)).round(1)
    pers["pct_dias_acumulado_mismo_signo"] = (100 * pers["dias_acumulado_mismo_signo"] / len(dias)).round(1)
    pers = total.set_index("h3")[["origenes", "destinos", "saldo", "saldo_dia", "tipo", "signif_2sigma",
                                  "lat", "lon"]].join(pers, how="inner").reset_index()
    pers["_abs"] = pers["saldo"].abs()
    pers = pers.sort_values(["_abs", "h3"], ascending=[False, True], ignore_index=True).drop(columns="_abs")
    pers.insert(0, "rango_abs_saldo", np.arange(1, len(pers) + 1))
    guardar_tabla(pers, "T14_persistencia")

    # Saldo acumulado de las celdas con mayor saldo absoluto.
    top = pers.head(PARAMETROS["saldo_top_celdas"])
    fig, ax = plt.subplots(figsize=(6.5, 4.0))
    x = pd.to_datetime(pd.Series(dias)).to_numpy()
    finales = []
    for _, fila in top.iterrows():
        serie = diario.loc[diario["h3"] == fila["h3"], "saldo_acumulado"].to_numpy()
        color = COLOR_EMISORA if fila["saldo"] > 0 else COLOR_RECEPTORA
        ax.plot(x, serie, color=color, lw=1.6, alpha=0.9)
        finales.append((int(serie[-1]), int(fila["rango_abs_saldo"])))
    # Etiquetas al final de cada línea, separadas para que no se pisen.
    finales.sort()
    separacion = 0.05 * (finales[-1][0] - finales[0][0])
    posiciones = []
    for valor, _ in finales:
        posiciones.append(max(valor, posiciones[-1] + separacion) if posiciones else valor)
    fin = pd.Timestamp(x[-1])
    for (valor, rango), y in zip(finales, posiciones):
        ax.annotate(f"{rango}", (fin, valor), xytext=(fin + pd.Timedelta(hours=14), y),
                    fontsize=8, color=COLOR_TEXTO, va="center",
                    arrowprops={"arrowstyle": "-", "color": "#b5b4ae", "lw": 0.5})
    ax.axhline(0, color="#52514e", lw=0.8)
    ax.plot([], [], color=COLOR_EMISORA, lw=1.6, label="Emisora (O > D): pierde patinetes")
    ax.plot([], [], color=COLOR_RECEPTORA, lw=1.6, label="Receptora (D > O): acumula patinetes")
    ax.legend(loc="upper left")
    ax.set_xlim(pd.Timestamp(x[0]) - pd.Timedelta(hours=12), fin + pd.Timedelta(days=1.8))
    ax.xaxis.set_major_formatter(DateFormatter("%d/%m"))
    ax.set_xlabel("Día")
    ax.set_ylabel("Saldo O − D acumulado (patinetes)")
    ax.set_title(f"Saldo acumulado de las {len(top)} celdas de res. {PARAMETROS['res_mapas']} con mayor saldo "
                 f"absoluto,\n{TITULO_AJUSTE}. El número es el rango en T14_persistencia")
    guardar_figura(fig, TEMA, "T14_saldo_acumulado")


def t14_rebalanceo(ajuste: pd.DataFrame, n_dias: int) -> dict:
    """Cota inferior diaria: suma de |saldo| de las celdas entre 2, con todas las celdas."""
    dias = dias_periodo("ajuste")
    tabla = pd.DataFrame({"fecha": dias})
    tabla["viajes"] = (ajuste["tsO"].dt.strftime("%Y-%m-%d").value_counts()
                       .reindex(dias, fill_value=0).to_numpy())
    resumen = {}
    for res in RESOLUCIONES:
        o, d = extremos_t14(ajuste, res)
        diario = saldo(o, d, ["h3", "fecha"])
        cota = (diario.groupby("fecha")["saldo"].apply(lambda s: s.abs().sum() / 2)
                .reindex(dias, fill_value=0))
        tabla[f"cota_res{res}_patinetes"] = cota.to_numpy()
        tabla[f"pct_viajes_res{res}"] = (100 * tabla[f"cota_res{res}_patinetes"] / tabla["viajes"]).round(1)
        estructural = saldo(o, d, ["h3"])["saldo"].abs().sum() / 2 / n_dias
        resumen.update({
            f"cota_rebalanceo_res{res}_media_patinetes_dia": round(float(cota.mean()), 1),
            f"cota_rebalanceo_res{res}_max_patinetes_dia": float(cota.max()),
            f"cota_rebalanceo_res{res}_media_pct_viajes": round(float(tabla[f"pct_viajes_res{res}"].mean()), 1),
            f"desplazamiento_estructural_res{res}_patinetes_dia": round(float(estructural), 1),
        })
    guardar_tabla(tabla, "T14_rebalanceo_diario")
    return resumen


def t14_operador(todos: pd.DataFrame) -> dict:
    """Saldo de los viajes frente a las entregas netas del operador de T11, por celda.

    Mismo universo que T11: todos los viajes del CSV en el mes completo. Si el número de
    patinetes de cada celda no crece ni decrece en el mes, las entregas netas del
    operador (entregas − recogidas) igualan el saldo O − D de los viajes.
    """
    ruta_t11 = carpeta_tablas(TEMA) / "T11_celdas_res8.csv"
    if not ruta_t11.exists():
        print("Falta T11_celdas_res8.csv (exploracion/recolocaciones.py): se omite la comparación con T11.")
        return {}
    operador = pd.read_csv(ruta_t11).rename(columns={"h3_res8": "h3"})
    o, d = extremos_t14(todos, PARAMETROS["res_mapas"])
    t = saldo(o, d, ["h3"])[["h3", "origenes", "destinos", "saldo"]].merge(
        operador[["h3", "recogidas", "entregas", "neto_entregas"]], on="h3", how="outer")
    t = t.fillna(0)
    t[["origenes", "destinos", "saldo", "recogidas", "entregas", "neto_entregas"]] = \
        t[["origenes", "destinos", "saldo", "recogidas", "entregas", "neto_entregas"]].astype("int64")
    t["diferencia"] = t["neto_entregas"] - t["saldo"]
    t = t.sort_values(["saldo", "h3"], ascending=[False, True], ignore_index=True)
    guardar_tabla(t, "T14_saldo_frente_operador")

    rho = spearmanr(t["saldo"], t["neto_entregas"]).statistic
    pendiente, ordenada = np.polyfit(t["saldo"], t["neto_entregas"], 1)
    compensado = 100 * (1 - t["diferencia"].abs().sum() / t["saldo"].abs().sum())

    fig, ax = plt.subplots(figsize=(6.5, 4.0))
    lim = 1.1 * max(t["saldo"].abs().max(), t["neto_entregas"].abs().max())
    ax.plot([-lim, lim], [-lim, lim], color=GRIS_REF, lw=1, ls=":", label="Entregas netas = saldo")
    ax.scatter(t["saldo"], t["neto_entregas"], s=16, color=COLOR_RECEPTORA, edgecolor="white", lw=0.5,
               label=f"Celda de res. {PARAMETROS['res_mapas']} ({len(t)})")
    ax.axhline(0, color="#52514e", lw=0.6)
    ax.axvline(0, color="#52514e", lw=0.6)
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect("equal")
    ax.set_xlabel("Saldo O − D de los viajes en el mes (patinetes)")
    ax.set_ylabel("Entregas − recogidas del operador (T11)")
    ax.legend(loc="upper left")
    ax.set_title(f"Saldo de los viajes frente a las recolocaciones del operador por celda\n"
                 f"Todos los viajes del CSV, febrero de 2021. Spearman {rho:.2f}, pendiente {pendiente:.2f}",
                 fontsize=9)
    guardar_figura(fig, TEMA, "T14_saldo_frente_operador")
    return {"operador_spearman_saldo_neto_entregas": round(float(rho), 3),
            "operador_pendiente_neto_entregas_sobre_saldo": round(float(pendiente), 3),
            "operador_ordenada": round(float(ordenada), 2),
            "operador_pct_saldo_compensado": round(float(compensado), 1)}


def t14(ajuste: pd.DataFrame, todos: pd.DataFrame) -> None:
    res = PARAMETROS["res_mapas"]
    n_dias = len(dias_periodo("ajuste"))
    o, d = extremos_t14(ajuste, res)
    total = t14_saldo_total(o, d, n_dias)
    t14_saldo_franjas(o, d, n_dias, extension(total["h3"]))
    t14_persistencia(o, d, total)
    rebalanceo = t14_rebalanceo(ajuste, n_dias)
    operador = t14_operador(todos)

    inc = total[total["incluida"]]
    pers = pd.read_csv(carpeta_tablas(TEMA) / "T14_persistencia.csv")
    resumen = {
        "viajes": len(ajuste),
        "dias": n_dias,
        "llegadas_fuera_del_periodo": int((~d["fecha"].isin(dias_periodo("ajuste"))).sum()),
        "celdas_res8": len(total),
        "celdas_incluidas": len(inc),
        "pct_extremos_en_celdas_incluidas": round(100 * inc["extremos"].sum() / total["extremos"].sum(), 2),
        "celdas_emisoras": int((inc["saldo"] > 0).sum()),
        "celdas_receptoras": int((inc["saldo"] < 0).sum()),
        "celdas_equilibradas": int((inc["saldo"] == 0).sum()),
        "celdas_desequilibrio_signif_2sigma": int(inc["signif_2sigma"].sum()),
        "celdas_pct_dias_mismo_signo_ge_70": int((pers["pct_dias_mismo_signo"] >= 70).sum()),
        "pct_dias_mismo_signo_mediana": float(pers["pct_dias_mismo_signo"].median()),
        **rebalanceo,
        **operador,
    }
    guardar_tabla(pd.DataFrame({"indicador": list(resumen),
                                "valor": pd.Series(list(resumen.values()), dtype=object)}), "T14_resumen")


def main() -> None:
    ajuste = cargar_viajes(periodo="ajuste")
    reservada = cargar_viajes(periodo="reservada")
    todos = cargar_viajes(solo_elegibles=False)

    conteos = {res: conteo_celdas(ajuste, res) for res in RESOLUCIONES}
    densidad = pd.concat(conteos.values(), ignore_index=True)
    densidad[["lat", "lon"]] = densidad[["lat", "lon"]].round(6)
    guardar_tabla(densidad, "T13_densidad_celdas")
    t13_resoluciones(conteos, len(ajuste))
    t13_concentracion(conteos)
    t13_estaciones(conteos[max(RESOLUCIONES)])
    t13_mapa_densidad(conteos[PARAMETROS["res_mapas"]])
    t13_puntos_aislados(todos)
    t13_estabilidad(ajuste, reservada)
    t14(ajuste, todos)

    tablas = carpeta_tablas(TEMA)
    for nombre in ["T13_resoluciones_h3", "T13_concentracion", "T13_puntos_aislados_resumen", "T13_estabilidad",
                   "T14_resumen", "T14_desequilibrio_franjas"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").to_string(index=False))


if __name__ == "__main__":
    main()
