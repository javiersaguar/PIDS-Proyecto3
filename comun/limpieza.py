"""Limpieza auditable de los viajes (T10).

Ningún viaje se borra. Cada regla que incumple un viaje se añade a `motivo`
(separadas por `;`) y `elegible` indica si el viaje entra en el análisis.
"""

import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

from comun.config import cargar_config

COLUMNAS = [
    "trip_id", "idS", "tsO", "tsD", "lonO", "latO", "lonD", "latD",
    "dis_m", "tt_s", "vel_kmh", "price_eur", "periodo", "motivo", "elegible",
]
RENOMBRAR = {"dis": "dis_m", "tt": "tt_s", "vel": "vel_kmh", "price": "price_eur"}


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def leer_bruto(ruta: Path) -> pd.DataFrame:
    """Lee el CSV original, comprueba su huella y normaliza nombres, tipos y fechas."""
    cfg = cargar_config()["datos"]
    huella = sha256(ruta)
    if huella != cfg["sha256_csv"]:
        raise ValueError(f"El CSV no coincide con el original (SHA-256 {huella}).")
    df = pd.read_csv(ruta, dtype={"idS": "string"}).rename(columns=RENOMBRAR)
    df.insert(0, "trip_id", np.arange(len(df), dtype="int64"))
    for col in ("tsO", "tsD"):
        df[col] = pd.to_datetime(df[col], format=cfg["formato_fecha"]).dt.tz_localize(cfg["zona_horaria"])
    return df


def reglas(df: pd.DataFrame) -> dict[str, tuple[str, pd.Series]]:
    """Reglas en el orden del embudo: nombre -> (descripción, máscara de incumplimiento)."""
    c = cargar_config()["limpieza"]
    duracion_fechas = (df["tsD"] - df["tsO"]).dt.total_seconds()
    precio_tarifa = c["tarifa"]["desbloqueo_eur"] + c["tarifa"]["minuto_eur"] * df["tt_s"] / 60
    vel_calculada = np.where(df["tt_s"] > 0, df["dis_m"] / df["tt_s"].clip(lower=1) * 3.6, np.nan)
    lon, lat = c["zona_servicio"]["lon"], c["zona_servicio"]["lat"]
    fuera = ~(
        df["lonO"].between(*lon) & df["lonD"].between(*lon)
        & df["latO"].between(*lat) & df["latD"].between(*lat)
    )
    orden = df.sort_values(["idS", "tsO"])
    fin_anterior = orden.groupby("idS")["tsD"].shift()
    solape = (orden["tsO"] < fin_anterior).reindex(df.index)

    return {
        "nulos": ("Algún campo vacío", df.isna().any(axis=1)),
        "duplicado": ("Mismo patinete y misma salida que otro viaje",
                      df.duplicated(["idS", "tsO"], keep="first")),
        "tiempos_incoherentes": (f"tsD - tsO distinto de tt (±{c["tolerancia_tt_s"]} s) o tt <= 0",
                                 ((duracion_fechas - df["tt_s"]).abs() > c["tolerancia_tt_s"]) | (df["tt_s"] <= 0)),
        "velocidad_incoherente": (f"vel distinta de 3,6·dis/tt (±{c['tolerancia_vel_kmh']} km/h)",
                                  ~(np.abs(df["vel_kmh"] - vel_calculada) <= c["tolerancia_vel_kmh"])),
        "precio_incoherente": (f"Precio distinto de la tarifa (±{c['tolerancia_precio_eur']} €)",
                               (df["price_eur"] - precio_tarifa).abs() > c["tolerancia_precio_eur"]),
        "fuera_de_zona": ("Algún extremo fuera del rectángulo de servicio", fuera),
        "solape": ("Empieza antes de que acabe el viaje anterior del mismo patinete", solape),
        "tt_largo": (f"Duración > {c['tt_max_s']} s", df["tt_s"] > c["tt_max_s"]),
        "vel_alta": (f"Velocidad > {c['vel_max_kmh']} km/h", df["vel_kmh"] > c["vel_max_kmh"]),
        "tt_corto": (f"Duración < {c['tt_min_s']} s", df["tt_s"] < c["tt_min_s"]),
        "dis_corta": (f"Distancia < {c['dis_min_m']} m", df["dis_m"] < c["dis_min_m"]),
    }


def asignar_periodo(ts: pd.Series) -> pd.Series:
    dia = ts.dt.strftime("%Y-%m-%d")
    periodo = pd.Series(pd.NA, index=ts.index, dtype="string")
    for nombre, (inicio, fin) in cargar_config()["datos"]["periodos"].items():
        periodo[(dia >= inicio) & (dia <= fin)] = nombre
    return periodo


def limpiar(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Marca los viajes. Devuelve (viajes, embudo secuencial, recuento por motivo)."""
    r = reglas(df)
    marcas = pd.DataFrame({nombre: mascara.fillna(False).astype(bool) for nombre, (_, mascara) in r.items()})

    df = df.copy()
    df["periodo"] = asignar_periodo(df["tsO"])
    motivo = pd.Series("", index=df.index, dtype="string")
    for nombre in marcas:
        motivo = motivo.mask(marcas[nombre], motivo + nombre + ";")
    df["motivo"] = motivo.str.rstrip(";")
    df["elegible"] = ~marcas.any(axis=1)

    filas, quedan = [], pd.Series(True, index=df.index)
    filas.append({"paso": 0, "regla": "inicial", "descripcion": "Viajes del CSV original",
                  "excluidos": 0, "quedan": int(quedan.sum())})
    for i, (nombre, (descripcion, _)) in enumerate(r.items(), start=1):
        excluidos = quedan & marcas[nombre]
        quedan &= ~marcas[nombre]
        filas.append({"paso": i, "regla": nombre, "descripcion": descripcion,
                      "excluidos": int(excluidos.sum()), "quedan": int(quedan.sum())})
    embudo = pd.DataFrame(filas)

    recuento = pd.DataFrame({
        "motivo": list(r),
        "viajes": [int(marcas[n].sum()) for n in r],
        "unico_motivo": [int((marcas[n] & (marcas.sum(axis=1) == 1)).sum()) for n in r],
    })
    recuento["porcentaje"] = (100 * recuento["viajes"] / len(df)).round(2)

    return df[COLUMNAS], embudo, recuento


def firma() -> str:
    """Identifica el CSV y los parámetros con los que se generó el parquet."""
    cfg = cargar_config()
    texto = repr((cfg["datos"], cfg["limpieza"]))
    return hashlib.sha256(texto.encode()).hexdigest()
