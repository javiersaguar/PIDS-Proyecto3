"""T13 y T14. Exploración espacial de la demanda en rejilla H3.

T13: densidad de orígenes y destinos, concentración, puntos aislados y estabilidad
entre periodos.

Uso: python exploracion/espacial.py
"""

import h3
import numpy as np
import pandas as pd
from matplotlib import patheffects
from matplotlib.collections import PolyCollection
from matplotlib.colors import LinearSegmentedColormap, LogNorm
from matplotlib.ticker import FormatStrFormatter, FuncFormatter, MaxNLocator
from scipy.stats import spearmanr

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt
from comun.geo import haversine_m

TEMA = "exploracion"
CFG = cargar_config()
RESOLUCIONES = CFG["exploracion"]["resoluciones_h3"]

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
}

TITULO_AJUSTE = "periodo de ajuste (1–21/02/2021)"

# Rampa secuencial de un solo tono (azul) y color para celdas sin dato.
CMAP_SECUENCIAL = LinearSegmentedColormap.from_list(
    "azules", ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])
CMAP_SECUENCIAL.set_bad("#e4e3df")
COLOR_TEXTO = "#3d3c39"
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


def preparar_mapa(ax, ext, referencias: bool = True, ejes: bool = True) -> None:
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
                      "elegible": todos["elegible"], "periodo": todos["periodo"]}),
        pd.DataFrame({"trip_id": todos["trip_id"], "extremo": "destino", "lat": todos["latD"], "lon": todos["lonD"],
                      "elegible": todos["elegible"], "periodo": todos["periodo"]}),
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
                       "elegible", "periodo"]], "T13_puntos_aislados")

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
    t13_mapa_densidad(conteos[PARAMETROS["res_mapas"]])
    t13_puntos_aislados(todos)
    t13_estabilidad(ajuste, reservada)

    tablas = carpeta_tablas(TEMA)
    for nombre in ["T13_resoluciones_h3", "T13_concentracion", "T13_puntos_aislados_resumen", "T13_estabilidad"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").to_string(index=False))


if __name__ == "__main__":
    main()
