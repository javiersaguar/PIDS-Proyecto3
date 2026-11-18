"""T15. Recorridos: distancia, duración, velocidad, rodeo, viajes circulares y radios de acceso.

Uso: python exploracion/recorridos.py
"""

import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap, LogNorm
from matplotlib.ticker import FuncFormatter

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt
from comun.geo import haversine_m

TEMA = "exploracion"
CFG = cargar_config()
FRANJAS = CFG["exploracion"]["franjas_horarias"]  # fijadas en T12
RADIOS_PLAN = CFG["movilidad"]["radios_acceso_m"]

PARAMETROS = {
    "percentiles": [5, 25, 50, 75, 95, 99],
    # Rodeo: solo viajes con distancia en línea recta suficiente para que el error
    # del GPS no domine el cociente.
    "rodeo_dist_recta_min_m": 200,
    # Viaje circular: vuelve casi al punto de partida tras recorrer una distancia apreciable.
    "circular_dist_recta_max_m": 100,
    "circular_dis_min_m": 500,
    # Radios de acceso a pie a explorar (m).
    "radios_m": [150, 200, 250, 300, 400, 500],
    # Velocidad a pie (hipótesis). Bohannon y Andrews (2011) recopilan velocidades
    # normales de marcha de 1,24 a 1,43 m/s en adultos de 20 a 69 años; se toma 1,3 m/s,
    # dentro de ese rango.
    "velocidad_pie_ms": 1.3,
}

TITULO_AJUSTE = "viajes elegibles del periodo de ajuste (1–21/02/2021)"
NOMBRES_FRANJA = {"madrugada": "Madrugada", "punta_manana": "Punta de mañana", "mediodia": "Mediodía",
                  "punta_tarde": "Punta de tarde", "noche": "Noche"}
AZUL, NARANJA, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
GRIS = "#8a8984"
CMAP_SECUENCIAL = LinearSegmentedColormap.from_list(
    "azules", ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])


def guardar_tabla(df: pd.DataFrame, nombre: str) -> None:
    df.to_csv(carpeta_tablas(TEMA) / f"{nombre}.csv", index=False, lineterminator="\n")


def franja(hora: pd.Series) -> pd.Series:
    etiqueta = pd.Series(pd.NA, index=hora.index, dtype="string")
    for nombre, (inicio, fin) in FRANJAS.items():
        etiqueta[(hora >= inicio) & (hora < fin)] = nombre
    assert etiqueta.notna().all()
    return etiqueta


def preparar(viajes: pd.DataFrame) -> pd.DataFrame:
    v = viajes.copy()
    v["dist_recta_m"] = haversine_m(v["latO"], v["lonO"], v["latD"], v["lonD"])
    v["rodeo"] = np.where(v["dist_recta_m"] >= PARAMETROS["rodeo_dist_recta_min_m"],
                          v["dis_m"] / v["dist_recta_m"].clip(lower=1e-9), np.nan)
    v["franja"] = franja(v["tsO"].dt.hour)
    v["tipo_dia"] = np.where(v["tsO"].dt.day_of_week >= 5, "fin_de_semana", "laborable")
    return v


def distribuciones(v: pd.DataFrame) -> None:
    variables = [("dis_m", "m"), ("tt_s", "s"), ("vel_kmh", "km/h"), ("dist_recta_m", "m"), ("rodeo", "-")]
    filas = []
    for col, unidad in variables:
        x = v[col].dropna()
        fila = {"variable": col, "unidad": unidad, "viajes": len(x), "media": x.mean(), "min": x.min()}
        for p in PARAMETROS["percentiles"]:
            fila[f"p{p}"] = x.quantile(p / 100)
        fila["max"] = x.max()
        filas.append(fila)
    tabla = pd.DataFrame(filas)
    numericas = tabla.columns.drop(["variable", "unidad", "viajes"])
    tabla[numericas] = tabla[numericas].astype(float).round(3)
    guardar_tabla(tabla, "T15_distribuciones")

    paneles = [("dis_m", "Distancia recorrida (m)", True), ("tt_s", "Duración (s)", True),
               ("vel_kmh", "Velocidad media (km/h)", False)]
    fig, ejes = plt.subplots(1, 3, figsize=(6.5, 2.9))
    fig.subplots_adjust(wspace=0.35)
    for ax, (col, etiqueta, log) in zip(ejes, paneles):
        x = v[col]
        bins = np.logspace(np.log10(x.min()), np.log10(x.max()), 50) if log else 50
        ax.hist(x, bins=bins, color=AZUL)
        if log:
            ax.set_xscale("log")
            ax.xaxis.set_major_formatter(FuncFormatter(lambda val, _: f"{val:g}"))
        mediana = x.median()
        ax.axvline(mediana, color=NARANJA, lw=1.2, ls="--")
        ax.set_title(f"Mediana {mediana:.0f}" if col != "vel_kmh" else f"Mediana {mediana:.1f}", fontsize=9)
        ax.set_xlabel(etiqueta)
    ejes[0].set_ylabel("Viajes")
    fig.suptitle(f"Distribución de los recorridos (escala log. en distancia y duración),\n{TITULO_AJUSTE}",
                 fontsize=9, y=1.06)
    guardar_figura(fig, TEMA, "T15_distribuciones")


def rodeo_y_circulares(v: pd.DataFrame) -> dict:
    p = PARAMETROS
    r = v["rodeo"].dropna()
    circular = (v["dist_recta_m"] < p["circular_dist_recta_max_m"]) & (v["dis_m"] >= p["circular_dis_min_m"])
    resumen = {
        "viajes": len(v),
        "viajes_con_rodeo": len(r),
        "rodeo_mediana": round(float(r.median()), 3),
        "rodeo_p25": round(float(r.quantile(0.25)), 3),
        "rodeo_p75": round(float(r.quantile(0.75)), 3),
        "rodeo_p95": round(float(r.quantile(0.95)), 3),
        "pct_rodeo_menor_1": round(float(100 * (r < 1).mean()), 2),
        "viajes_circulares": int(circular.sum()),
        "pct_viajes_circulares": round(float(100 * circular.mean()), 2),
        "viajes_dist_recta_menor_100_m": int((v["dist_recta_m"] < p["circular_dist_recta_max_m"]).sum()),
    }

    fig, ejes = plt.subplots(1, 2, figsize=(6.5, 3.2))
    ax = ejes[0]
    tope = 4
    ax.hist(r.clip(upper=tope), bins=np.linspace(1, tope, 46), color=AZUL)
    ax.axvline(resumen["rodeo_mediana"], color=NARANJA, lw=1.2, ls="--")
    ax.annotate(f"mediana {resumen['rodeo_mediana']:.2f}", (resumen["rodeo_mediana"], 1),
                xycoords=("data", "axes fraction"), xytext=(4, -3), textcoords="offset points", va="top",
                fontsize=8, color="#3d3c39")
    ax.set_xlabel(f"Rodeo dis_m / dist_recta_m\n(≥ {tope} agrupado en {tope})")
    ax.set_ylabel("Viajes")
    n_txt = f"{len(r):,}".replace(",", " ")
    ax.set_title(f"Recta ≥ {p['rodeo_dist_recta_min_m']} m, n = {n_txt}", fontsize=9)

    ax = ejes[1]
    hb = ax.hexbin(v["dist_recta_m"] / 1000, v["dis_m"] / 1000, gridsize=45, bins="log", cmap=CMAP_SECUENCIAL,
                   mincnt=1, extent=(0, 8, 0, 12), linewidths=0.1)
    x = np.array([0, 8])
    ax.plot(x, x, color=GRIS, lw=1, ls=":", label="dis = recta")
    ax.plot(x, resumen["rodeo_mediana"] * x, color=NARANJA, lw=1.2, ls="--",
            label=f"dis = {resumen['rodeo_mediana']:.2f} × recta")
    ax.set_xlim(0, 8)
    ax.set_ylim(0, 12)
    ax.set_xlabel("Distancia en línea recta (km)")
    ax.set_ylabel("Distancia recorrida (km)")
    ax.legend(loc="upper left")
    barra = fig.colorbar(hb, ax=ax, pad=0.02)
    barra.ax.yaxis.set_major_formatter(FuncFormatter(lambda val, _: f"{val:g}"))
    barra.set_label("Viajes (escala log.)")
    ax.set_title("Recorrida frente a línea recta", fontsize=9)
    fig.suptitle(f"Factor de rodeo, {TITULO_AJUSTE}", fontsize=9)
    guardar_figura(fig, TEMA, "T15_rodeo")
    return resumen


def medianas_franja(v: pd.DataFrame) -> None:
    columnas = ["dis_m", "tt_s", "vel_kmh", "dist_recta_m"]
    orden = {nombre: i for i, nombre in enumerate(FRANJAS)}
    filas = []
    for tipo in ["laborable", "fin_de_semana"]:
        sub = v[v["tipo_dia"] == tipo]
        grupos = [(f, g) for f, g in sub.groupby("franja")] + [("todas", sub)]
        for nombre, g in sorted(grupos, key=lambda x: orden.get(x[0], len(orden))):
            fila = {"tipo_dia": tipo, "franja": nombre, "viajes": len(g)}
            for c in columnas:
                fila[f"{c}_mediana"] = round(float(g[c].median()), 2)
            filas.append(fila)
    guardar_tabla(pd.DataFrame(filas), "T15_medianas_franja_tipo_dia")


def radios_acceso(v: pd.DataFrame, rodeo: float) -> pd.DataFrame:
    """Coste de andar hasta y desde la estación para cada radio R.

    Caso peor: R en cada extremo. Caso medio: 2R/3 en cada extremo (distancia media al
    centro de un círculo de radio R con puntos repartidos uniformemente). Ambas se
    multiplican por el factor de rodeo y se pasan a tiempo con la velocidad a pie.
    """
    vel = PARAMETROS["velocidad_pie_ms"]
    t_directo = rodeo * v["dist_recta_m"] / vel  # andar todo el trayecto
    filas = []
    for radio in PARAMETROS["radios_m"]:
        fila = {"radio_m": radio, "radio_del_plan": radio in RADIOS_PLAN}
        for caso, dist in [("peor", 2 * radio), ("medio", 2 * 2 * radio / 3)]:
            d_pie = rodeo * dist
            t_pie = d_pie / vel
            fila[f"dist_pie_{caso}_m"] = round(d_pie, 1)
            fila[f"t_pie_{caso}_s"] = round(t_pie, 1)
            fila[f"pct_t_pie_supera_viaje_{caso}"] = round(float(100 * (t_pie > v["tt_s"]).mean()), 2)
            fila[f"pct_andar_directo_mas_rapido_{caso}"] = round(float(100 * (t_directo <= t_pie + v["tt_s"]).mean()), 2)
        fila["pct_dis_le_2R"] = round(float(100 * (v["dis_m"] <= 2 * radio).mean()), 2)
        filas.append(fila)
    tabla = pd.DataFrame(filas)
    guardar_tabla(tabla, "T15_radios_acceso")

    fig, ax = plt.subplots(figsize=(6.5, 4.0))
    for r in RADIOS_PLAN:
        ax.axvline(r, color="#d5d4cf", lw=6, zorder=0)
    series = [("pct_t_pie_supera_viaje_peor", AZUL, "-", "Tiempo a pie > tiempo en patinete, caso peor (R + R)"),
              ("pct_t_pie_supera_viaje_medio", AZUL, "--", "Tiempo a pie > tiempo en patinete, caso medio (2R/3 + 2R/3)"),
              ("pct_dis_le_2R", NARANJA, "-", "Distancia recorrida ≤ 2R")]
    for col, color, estilo, etiqueta in series:
        ax.plot(tabla["radio_m"], tabla[col], color=color, ls=estilo, lw=2, marker="o", ms=4, label=etiqueta)
    ax.set_xlabel("Radio de acceso R (m)")
    ax.set_ylabel("Viajes (%)")
    ax.set_xticks(tabla["radio_m"])
    ax.set_ylim(0, 105)
    ax.legend(loc="upper left")
    ax.set_title(f"Viajes en los que andar a la estación no compensa, {TITULO_AJUSTE}\n"
                 f"Rodeo {rodeo:.2f} y {PARAMETROS['velocidad_pie_ms']} m/s a pie (hipótesis). "
                 "Bandas grises: radios del barrido del plan", fontsize=9)
    guardar_figura(fig, TEMA, "T15_radios_acceso")
    return tabla


def main() -> None:
    v = preparar(cargar_viajes(periodo="ajuste"))
    distribuciones(v)
    resumen = rodeo_y_circulares(v)
    medianas_franja(v)
    tabla = radios_acceso(v, resumen["rodeo_mediana"])
    resumen["velocidad_pie_ms"] = PARAMETROS["velocidad_pie_ms"]
    guardar_tabla(pd.DataFrame({"indicador": list(resumen),
                                "valor": pd.Series(list(resumen.values()), dtype=object)}), "T15_resumen")

    tablas = carpeta_tablas(TEMA)
    for nombre in ["T15_distribuciones", "T15_resumen", "T15_medianas_franja_tipo_dia"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").to_string(index=False))
    print("\nT15_radios_acceso\n" + tabla.T.to_string(header=False))


if __name__ == "__main__":
    main()
