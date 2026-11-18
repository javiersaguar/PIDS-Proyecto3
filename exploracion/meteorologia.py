"""T17. Meteorología frente a demanda, días anómalos y tendencia del mes.

Descarga de la API histórica de Open-Meteo la lluvia, la temperatura y el viento de
Roma centro en febrero de 2021 y la guarda tal cual en datos/externos/meteorologia/.
Solo descarga si no hay ninguna respuesta guardada o si se pasa --descargar; si no,
trabaja sin conexión con la más reciente.

Uso: python exploracion/meteorologia.py [--descargar]
"""

import argparse
import hashlib
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from matplotlib.dates import DateFormatter
from matplotlib.patches import Patch
from scipy.stats import spearmanr

from comun.config import cargar_config, carpeta_tablas, ruta
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt
from comun.geo import haversine_m

TEMA = "exploracion"
CFG = cargar_config()
ZONA = CFG["datos"]["zona_horaria"]
INICIO = CFG["datos"]["periodos"]["ajuste"][0]
FIN = CFG["datos"]["periodos"]["reservada"][1]

PARAMETROS = {
    "url": "https://archive-api.open-meteo.com/v1/archive",
    # Roma centro.
    "latitud": 41.8967,
    "longitud": 12.4822,
    "diarias": ["precipitation_sum", "rain_sum", "temperature_2m_mean", "temperature_2m_max",
                "temperature_2m_min", "wind_speed_10m_max"],
    "horarias": ["precipitation", "temperature_2m"],
    # Hora con lluvia: más de 0,1 mm en la hora.
    "umbral_lluvia_mm": 0.1,
    # Para el cociente horario, las horas sin lluvia de referencia son las de la misma
    # hora y tipo de día a menos de esta distancia en días (limita el efecto de la tendencia).
    "ventana_referencia_dias": 7,
    # Horas del día en las que se compara (fuera de ellas casi no hay viajes).
    "horas_comparacion": [7, 23],
    # Día anómalo: por debajo de esta fracción de la mediana de su tipo de día (mes completo).
    "fraccion_anomalo": 0.70,
    "dias_a_explicar": ["2021-02-07"],
}

METADATOS_FUENTE = {
    "fuente": "Open-Meteo, Historical Weather API (https://open-meteo.com/en/docs/historical-weather-api)",
    "modelo": ("models=best_match (valor por defecto). Según la documentación, combina ECMWF IFS HRES "
               "(9 km, desde 2017), ERA5 (0,25°) y ERA5-Land (0,1°)."),
    "licencia": "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
    "atribucion": "Weather data by Open-Meteo.com (https://open-meteo.com/)",
    "citas": [
        "Zippenfenig, P. (2023). Open-Meteo.com Weather API [Computer software]. Zenodo. "
        "https://doi.org/10.5281/ZENODO.7970649",
        "Hersbach, H. et al. (2023). ERA5 hourly data on single levels from 1940 to present. ECMWF. "
        "https://doi.org/10.24381/cds.adbb2d47",
    ],
    "nota_copernicus": "Generated using Copernicus Climate Change Service information.",
    "convencion_horaria": ("Horas locales Europe/Rome. 'precipitation' es la suma de la hora anterior a la "
                           "marca de tiempo."),
}

# Variables diarias de la API con la unidad en el nombre (mm, °C, km/h).
NOMBRES_DIARIAS = {"precipitation_sum": "precipitacion_mm", "rain_sum": "lluvia_mm",
                   "temperature_2m_mean": "temp_media_c", "temperature_2m_max": "temp_max_c",
                   "temperature_2m_min": "temp_min_c", "wind_speed_10m_max": "viento_max_kmh"}

DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
AZUL, NARANJA, GRIS = "#2a78d6", "#eb6834", "#8a8984"
COLORES_TIPO = {"laborable": AZUL, "fin_de_semana": NARANJA}
NOMBRES_TIPO = {"laborable": "Laborable", "fin_de_semana": "Fin de semana"}


def guardar_tabla(df: pd.DataFrame, nombre: str) -> None:
    df.to_csv(carpeta_tablas(TEMA) / f"{nombre}.csv", index=False, lineterminator="\n")


def tabla_resumen(resumen: dict) -> pd.DataFrame:
    valores = [round(float(x), 4) if isinstance(x, (float, np.floating)) else
               (int(x) if isinstance(x, (int, np.integer)) else x) for x in resumen.values()]
    return pd.DataFrame({"indicador": list(resumen), "valor": pd.Series(valores, dtype=object)})


# ------------------------------------------------------------------ descarga

def carpeta_meteo():
    carpeta = ruta("externos") / "meteorologia"
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def respuestas_guardadas() -> list:
    return sorted(f for f in carpeta_meteo().glob("open-meteo_roma_2021-02_*.json")
                  if not f.name.endswith(".meta.json"))


def descargar():
    import requests

    p = PARAMETROS
    consulta = {"latitude": p["latitud"], "longitude": p["longitud"], "start_date": INICIO, "end_date": FIN,
                "daily": ",".join(p["diarias"]), "hourly": ",".join(p["horarias"]), "timezone": ZONA}
    respuesta = requests.get(p["url"], params=consulta, timeout=60)
    respuesta.raise_for_status()
    datos = respuesta.json()
    if "error" in datos or "daily" not in datos or "hourly" not in datos:
        raise RuntimeError(f"Respuesta inesperada de Open-Meteo: {respuesta.text[:300]}")

    ahora = datetime.now(timezone.utc)
    destino = carpeta_meteo() / f"open-meteo_roma_2021-02_{ahora:%Y-%m-%d}.json"
    destino.write_bytes(respuesta.content)
    meta = {
        "url": p["url"],
        "url_completa": respuesta.url,
        "parametros": consulta,
        "fecha_descarga_utc": ahora.isoformat(timespec="seconds"),
        **METADATOS_FUENTE,
        "unidades_diarias": datos.get("daily_units"),
        "unidades_horarias": datos.get("hourly_units"),
        "coordenadas_celda": {"latitude": datos.get("latitude"), "longitude": datos.get("longitude"),
                              "elevation": datos.get("elevation")},
        "sha256": hashlib.sha256(respuesta.content).hexdigest(),
    }
    destino.with_name(destino.stem + ".meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Descargado {destino.relative_to(ruta('externos').parents[1])}")
    return destino


def leer_meteo(fichero) -> tuple[pd.DataFrame, pd.DataFrame]:
    datos = json.loads(fichero.read_text(encoding="utf-8"))
    diario = pd.DataFrame(datos["daily"]).rename(columns={"time": "fecha", **NOMBRES_DIARIAS})
    diario["fecha"] = diario["fecha"].astype("string")
    horario = pd.DataFrame(datos["hourly"])
    horario["inicio"] = pd.to_datetime(horario["time"]).dt.tz_localize(ZONA)
    # 'precipitation' se refiere a la hora anterior a la marca: la lluvia del intervalo
    # [h, h + 1) es la de la marca h + 1.
    horario["precipitacion_mm"] = horario["precipitation"].shift(-1)
    horario["temperatura_c"] = horario["temperature_2m"]
    horario = horario[["inicio", "precipitacion_mm", "temperatura_c"]]
    assert len(diario) == len(pd.date_range(INICIO, FIN)), len(diario)
    return diario, horario


# ------------------------------------------------------------------ análisis

def serie_diaria(viajes: pd.DataFrame, diario: pd.DataFrame, horario: pd.DataFrame) -> pd.DataFrame:
    fechas = pd.date_range(INICIO, FIN, freq="D")
    t = pd.DataFrame({"fecha": pd.Index(fechas.strftime("%Y-%m-%d"), dtype="string")})
    t["dia_semana"] = [DIAS_SEMANA[d] for d in fechas.day_of_week]
    t["tipo_dia"] = np.where(fechas.day_of_week >= 5, "fin_de_semana", "laborable")
    periodos = CFG["datos"]["periodos"]
    t["periodo"] = np.where(t["fecha"] <= periodos["ajuste"][1], "ajuste", "reservada")
    t["viajes"] = (viajes["tsO"].dt.strftime("%Y-%m-%d").value_counts().reindex(t["fecha"], fill_value=0)
                   .to_numpy())
    horas_lluvia = (horario.assign(fecha=horario["inicio"].dt.strftime("%Y-%m-%d"),
                                   lluvia=horario["precipitacion_mm"] > PARAMETROS["umbral_lluvia_mm"])
                    .groupby("fecha")["lluvia"].sum())
    t["horas_lluvia"] = horas_lluvia.reindex(t["fecha"], fill_value=0).to_numpy().astype(int)
    t = t.merge(diario, on="fecha", how="left")
    return t


def figura_serie(t: pd.DataFrame, ajuste_tendencia: tuple[float, float]) -> None:
    x = pd.to_datetime(t["fecha"])
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(6.5, 4.6), sharex=True, height_ratios=[2.2, 1])
    for ax in (ax1, ax2):
        reservada = x[t["periodo"] == "reservada"]
        ax.axvspan(reservada.min() - pd.Timedelta(hours=12), reservada.max() + pd.Timedelta(hours=12),
                   color="#efeee9", zorder=0, lw=0)
    ax1.bar(x, t["viajes"], color=[COLORES_TIPO[c] for c in t["tipo_dia"]], width=0.8)
    a, b = ajuste_tendencia
    aj = t["periodo"] == "ajuste"
    idx = np.arange(len(t))[aj]
    ax1.plot(x[aj], a + b * idx, color="#3d3c39", lw=1.2, ls="--")
    anomalos = t[t["anomalo"] | t["fecha"].isin(PARAMETROS["dias_a_explicar"])]
    for _, fila in anomalos.iterrows():
        ax1.annotate(pd.Timestamp(fila["fecha"]).strftime("%d/%m"), (pd.Timestamp(fila["fecha"]), fila["viajes"]),
                     xytext=(0, 3), textcoords="offset points", ha="center", fontsize=8, color="#3d3c39")
    ax1.legend(handles=[Patch(color=AZUL, label="Laborable"), Patch(color=NARANJA, label="Fin de semana"),
                        plt.Line2D([], [], color="#3d3c39", ls="--", label="Tendencia lineal (ajuste)"),
                        Patch(color="#efeee9", label="Semana reservada")],
               loc="upper left", ncol=2)
    ax1.set_ylim(0, t["viajes"].max() * 1.35)
    ax1.set_ylabel("Viajes elegibles/día")
    ax2.plot(x, t["precipitacion_mm"], color=AZUL, lw=1.6, marker="o", ms=3)
    ax2.set_ylabel("Lluvia (mm/día)")
    ax2.set_ylim(0, None)
    ax2.xaxis.set_major_formatter(DateFormatter("%d/%m"))
    ax2.set_xlabel("Día (salida del viaje)")
    ax1.set_title("Viajes diarios y precipitación en Roma, febrero de 2021 (Open-Meteo, Roma centro)", fontsize=9)
    guardar_figura(fig, TEMA, "T17_viajes_lluvia")


def correlaciones(t: pd.DataFrame) -> pd.DataFrame:
    filas = []
    for variable in ["precipitacion_mm", "temp_media_c", "horas_lluvia", "viento_max_kmh"]:
        for grupo, sub in [("todos", t), ("laborable", t[t["tipo_dia"] == "laborable"]),
                           ("fin_de_semana", t[t["tipo_dia"] == "fin_de_semana"])]:
            r = spearmanr(sub[variable], sub["viajes"])
            filas.append({"variable": variable, "grupo": grupo, "n": len(sub),
                          "spearman_rho": round(float(r.statistic), 3), "p_valor": round(float(r.pvalue), 4)})
    tabla = pd.DataFrame(filas)
    guardar_tabla(tabla, "T17_correlaciones")

    fig, ejes = plt.subplots(1, 2, figsize=(6.5, 3.3), sharey=True)
    paneles = [("precipitacion_mm", "Lluvia diaria (mm)"), ("temp_media_c", "Temperatura media diaria (°C)")]
    for ax, (variable, etiqueta) in zip(ejes, paneles):
        for tipo, color in COLORES_TIPO.items():
            sub = t[t["tipo_dia"] == tipo]
            ax.scatter(sub[variable], sub["viajes"], s=22, color=color, edgecolor="white", lw=0.6,
                       label=NOMBRES_TIPO[tipo])
        r = tabla[(tabla["variable"] == variable)].set_index("grupo")
        ax.set_title(f"ρ = {r.loc['todos', 'spearman_rho']:.2f} (n = {r.loc['todos', 'n']}); "
                     f"lab. {r.loc['laborable', 'spearman_rho']:.2f}, f. s. {r.loc['fin_de_semana', 'spearman_rho']:.2f}",
                     fontsize=9)
        ax.set_xlabel(etiqueta)
    ejes[0].set_ylabel("Viajes elegibles/día")
    ejes[0].legend(loc="upper right")
    fig.suptitle("Viajes diarios frente al tiempo, febrero de 2021. Correlación de Spearman con muestra pequeña "
                 "(28 días):\norientativa, no prueba causalidad", fontsize=9, y=1.04)
    guardar_figura(fig, TEMA, "T17_dispersion")
    return tabla


def lluvia_horaria(viajes: pd.DataFrame, horario: pd.DataFrame) -> pd.DataFrame:
    p = PARAMETROS
    h = horario.dropna(subset=["precipitacion_mm"]).copy()
    h["viajes"] = (viajes["tsO"].dt.floor("h").value_counts().reindex(h["inicio"], fill_value=0).to_numpy())
    h["fecha"] = h["inicio"].dt.tz_localize(None).dt.normalize()
    h["hora"] = h["inicio"].dt.hour
    h["tipo_dia"] = np.where(h["inicio"].dt.day_of_week >= 5, "fin_de_semana", "laborable")
    h["lluvia"] = h["precipitacion_mm"] > p["umbral_lluvia_mm"]
    h0, h1 = p["horas_comparacion"]
    h = h[h["hora"].between(h0, h1 - 1)]

    secas = h[~h["lluvia"]]
    filas = []
    for _, fila in h[h["lluvia"]].iterrows():
        ref = secas[(secas["hora"] == fila["hora"]) & (secas["tipo_dia"] == fila["tipo_dia"])
                    & ((secas["fecha"] - fila["fecha"]).abs() <= pd.Timedelta(days=p["ventana_referencia_dias"]))]
        filas.append({"fecha": fila["fecha"].strftime("%Y-%m-%d"), "hora": int(fila["hora"]),
                      "tipo_dia": fila["tipo_dia"], "precipitacion_mm": round(float(fila["precipitacion_mm"]), 2),
                      "viajes": int(fila["viajes"]), "horas_referencia": len(ref),
                      "viajes_esperados": round(float(ref["viajes"].mean()), 3) if len(ref) else np.nan})
    tabla = pd.DataFrame(filas)
    tabla["cociente"] = (tabla["viajes"] / tabla["viajes_esperados"]).round(3)
    guardar_tabla(tabla, "T17_lluvia_horaria")

    validas = tabla.dropna(subset=["viajes_esperados"])
    resumen = []
    for grupo, sub in [("todos", validas), ("laborable", validas[validas["tipo_dia"] == "laborable"]),
                       ("fin_de_semana", validas[validas["tipo_dia"] == "fin_de_semana"])]:
        resumen.append({"grupo": grupo, "horas_lluvia": len(sub), "viajes": int(sub["viajes"].sum()),
                        "viajes_esperados": round(float(sub["viajes_esperados"].sum()), 1),
                        "cociente_agregado": round(float(sub["viajes"].sum() / sub["viajes_esperados"].sum()), 3)
                        if len(sub) else np.nan,
                        "cociente_mediana": round(float(sub["cociente"].median()), 3) if len(sub) else np.nan})
    resumen = pd.DataFrame(resumen)
    guardar_tabla(resumen, "T17_lluvia_horaria_resumen")
    return resumen


def dias_anomalos(t: pd.DataFrame) -> pd.DataFrame:
    medianas = t.groupby("tipo_dia")["viajes"].median()
    t["mediana_tipo_dia"] = t["tipo_dia"].map(medianas)
    t["pct_mediana_tipo_dia"] = (100 * t["viajes"] / t["mediana_tipo_dia"]).round(1)
    t["anomalo"] = t["viajes"] < PARAMETROS["fraccion_anomalo"] * t["mediana_tipo_dia"]
    tabla = t[t["anomalo"] | t["fecha"].isin(PARAMETROS["dias_a_explicar"])]
    columnas = ["fecha", "dia_semana", "tipo_dia", "periodo", "viajes", "mediana_tipo_dia", "pct_mediana_tipo_dia",
                "anomalo", "precipitacion_mm", "lluvia_mm", "horas_lluvia", "temp_media_c",
                "temp_max_c", "viento_max_kmh"]
    guardar_tabla(tabla[columnas], "T17_dias_anomalos")
    return t


def ols(y: np.ndarray, columnas: dict[str, np.ndarray]) -> dict:
    """Mínimos cuadrados con constante: coeficientes, errores típicos y R²."""
    X = np.column_stack([np.ones(len(y))] + list(columnas.values()))
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    residuos = y - X @ beta
    gl = len(y) - X.shape[1]
    sigma2 = residuos @ residuos / gl
    ee = np.sqrt(np.diag(sigma2 * np.linalg.inv(X.T @ X)))
    r2 = 1 - residuos @ residuos / ((y - y.mean()) @ (y - y.mean()))
    salida = {"r2": r2}
    for i, nombre in enumerate(["constante"] + list(columnas)):
        salida[f"coef_{nombre}"] = beta[i]
        salida[f"ee_{nombre}"] = ee[i]
    return salida


def tendencia(t: pd.DataFrame) -> tuple[pd.DataFrame, tuple[float, float]]:
    t = t.copy()
    t["indice_dia"] = np.arange(len(t), dtype=float)
    t["fin_de_semana"] = (t["tipo_dia"] == "fin_de_semana").astype(float)
    aj = t[t["periodo"] == "ajuste"]
    modelos = [
        ("tendencia", "ajuste", aj, ["indice_dia"]),
        ("tendencia + fin_de_semana", "ajuste", aj, ["indice_dia", "fin_de_semana"]),
        ("tendencia + fin_de_semana", "mes", t, ["indice_dia", "fin_de_semana"]),
        ("tendencia + fin_de_semana + lluvia + temperatura", "mes", t,
         ["indice_dia", "fin_de_semana", "precipitacion_mm", "temp_media_c"]),
    ]
    filas = []
    for nombre, periodo, sub, columnas in modelos:
        r = ols(sub["viajes"].to_numpy(dtype=float), {c: sub[c].to_numpy(dtype=float) for c in columnas})
        fila = {"modelo": nombre, "periodo": periodo, "n": len(sub),
                "pendiente_viajes_dia_por_dia": r["coef_indice_dia"], "pendiente_ee": r["ee_indice_dia"],
                "pendiente_pct_media_por_semana": 100 * 7 * r["coef_indice_dia"] / sub["viajes"].mean(),
                "coef_fin_de_semana": r.get("coef_fin_de_semana", np.nan),
                "coef_lluvia_viajes_por_mm": r.get("coef_precipitacion_mm", np.nan),
                "ee_lluvia": r.get("ee_precipitacion_mm", np.nan),
                "coef_temperatura_viajes_por_c": r.get("coef_temp_media_c", np.nan),
                "ee_temperatura": r.get("ee_temp_media_c", np.nan),
                "r2": r["r2"]}
        filas.append(fila)
    tabla = pd.DataFrame(filas)
    numericas = tabla.columns.drop(["modelo", "periodo", "n"])
    tabla[numericas] = tabla[numericas].astype(float).round(3)
    guardar_tabla(tabla, "T17_tendencia")
    r1 = ols(aj["viajes"].to_numpy(dtype=float), {"indice_dia": aj["indice_dia"].to_numpy()})
    return tabla, (r1["coef_constante"], r1["coef_indice_dia"])


def cociente_semana(t: pd.DataFrame) -> pd.DataFrame:
    medias = t.groupby(["dia_semana", "periodo"])["viajes"].mean().unstack("periodo")
    medias = medias.reindex(DIAS_SEMANA)
    tabla = pd.DataFrame({"dia_semana": medias.index,
                          "viajes_media_ajuste": medias["ajuste"].round(2).to_numpy(),
                          "viajes_reservada": medias["reservada"].round(2).to_numpy()})
    tabla["cociente_reservada_ajuste"] = (tabla["viajes_reservada"] / tabla["viajes_media_ajuste"]).round(3)
    total = pd.DataFrame([{"dia_semana": "semana", "viajes_media_ajuste": round(medias["ajuste"].mean(), 2),
                           "viajes_reservada": round(medias["reservada"].mean(), 2)}])
    total["cociente_reservada_ajuste"] = (total["viajes_reservada"] / total["viajes_media_ajuste"]).round(3)
    tabla = pd.concat([tabla, total], ignore_index=True)
    guardar_tabla(tabla, "T17_cociente_semana")
    return tabla


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--descargar", action="store_true", help="vuelve a descargar los datos de Open-Meteo")
    args = parser.parse_args()

    guardadas = respuestas_guardadas()
    fichero = descargar() if (args.descargar or not guardadas) else guardadas[-1]
    print(f"Meteorología: {fichero.name}")
    diario, horario = leer_meteo(fichero)
    celda = json.loads(fichero.read_text(encoding="utf-8"))

    viajes = cargar_viajes()
    t = serie_diaria(viajes, diario, horario)
    t = dias_anomalos(t)
    tabla_tendencia, recta = tendencia(t)
    figura_serie(t, recta)
    corr = correlaciones(t)
    lluvia = lluvia_horaria(viajes, horario)
    semana = cociente_semana(t)
    guardar_tabla(t, "T17_serie_diaria")

    resumen = {
        "fichero_meteorologia": fichero.name,
        "dias": len(t),
        "dias_con_lluvia_mayor_1mm": int((t["precipitacion_mm"] > 1).sum()),
        "lluvia_total_ajuste_mm": t.loc[t["periodo"] == "ajuste", "precipitacion_mm"].sum(),
        "lluvia_total_reservada_mm": t.loc[t["periodo"] == "reservada", "precipitacion_mm"].sum(),
        "dias_lluvia_mayor_1mm_ajuste": int(((t["periodo"] == "ajuste") & (t["precipitacion_mm"] > 1)).sum()),
        "dias_lluvia_mayor_1mm_reservada": int(((t["periodo"] == "reservada") & (t["precipitacion_mm"] > 1)).sum()),
        "temperatura_media_ajuste_c": t.loc[t["periodo"] == "ajuste", "temp_media_c"].mean(),
        "temperatura_media_reservada_c": t.loc[t["periodo"] == "reservada", "temp_media_c"].mean(),
        "viajes_dia_media_ajuste": t.loc[t["periodo"] == "ajuste", "viajes"].mean(),
        "viajes_dia_media_reservada": t.loc[t["periodo"] == "reservada", "viajes"].mean(),
        "dias_anomalos": int(t["anomalo"].sum()),
        "celda_meteo_lat": celda["latitude"],
        "celda_meteo_lon": celda["longitude"],
        "distancia_celda_meteo_km": haversine_m(PARAMETROS["latitud"], PARAMETROS["longitud"],
                                                celda["latitude"], celda["longitude"]) / 1000,
    }
    guardar_tabla(tabla_resumen(resumen), "T17_resumen")

    tablas = carpeta_tablas(TEMA)
    for nombre in ["T17_resumen", "T17_dias_anomalos", "T17_correlaciones", "T17_lluvia_horaria_resumen",
                   "T17_tendencia", "T17_cociente_semana"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").to_string(index=False))


if __name__ == "__main__":
    main()
