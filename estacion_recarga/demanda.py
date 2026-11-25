"""Demanda de recarga por estación (T50): sesiones, cola de cargadores y curvas de potencia.

Cada llegada atendida abre una sesión que repone en batería la energía del viaje a la
potencia nominal del patinete (576 Wh / 7 h). La duración se calcula en el lado de la
batería y la energía y la potencia en el lado AC se dividen por el rendimiento del
cargador. El perfil ideal empieza cada sesión al llegar; el viable reparte las sesiones
entre los cargadores de la estación por orden de llegada y sin interrumpirlas.
"""

import heapq
from functools import cache
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from comun.config import cargar_config, carpeta_tablas, ruta

TABLAS = carpeta_tablas("estacion_recarga")
PROCESADOS = ruta("viajes_limpios").parent
TABLAS_MOV = carpeta_tablas("movilidad")


@cache
def cargar_ajustes():
    with Path(__file__).with_name("config.yaml").open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def guardar(tabla, nombre):
    destino = TABLAS / nombre
    compresion = {"method": "gzip", "mtime": 0} if destino.suffix == ".gz" else None
    tabla.to_csv(destino, index=False, lineterminator="\n", float_format="%.9f", compression=compresion)
    return tabla


def potencia_bateria_w():
    p = cargar_config()["patinete"]
    return p["bateria_wh"] / p["tiempo_recarga_h"]


def altura_solar(t_utc, lat, lon):
    """Altura del sol en grados (algoritmo de baja precisión del Astronomical Almanac, ±0,01°).

    `t_utc` es un DatetimeIndex en UTC; `lat` y `lon` en grados, escalares o con la forma
    que se pueda combinar por difusión con `t_utc`.
    """
    n = np.asarray(t_utc.to_julian_date()) - 2451545.0
    g = np.radians((357.528 + 0.9856003 * n) % 360)
    lam = np.radians((280.460 + 0.9856474 * n) % 360 + 1.915 * np.sin(g) + 0.020 * np.sin(2 * g))
    eps = np.radians(23.439 - 4e-7 * n)
    ascension = np.arctan2(np.cos(eps) * np.sin(lam), np.cos(lam))
    declinacion = np.arcsin(np.sin(eps) * np.sin(lam))
    sidereo_h = (18.697374558 + 24.06570982441908 * n) % 24
    horario = np.radians(sidereo_h * 15 + np.asarray(lon)) - ascension
    lat = np.radians(np.asarray(lat))
    return np.degrees(np.arcsin(np.sin(lat) * np.sin(declinacion)
                                + np.cos(lat) * np.cos(declinacion) * np.cos(horario)))


def cola(llegada_s, duracion_s, cargadores):
    """Inicio de cada sesión con `cargadores` en paralelo, por orden de llegada (FIFO).

    Las sesiones deben venir ordenadas por llegada. Una sesión no se interrumpe.
    """
    if cargadores < 1:
        raise ValueError("Cada estación necesita al menos un cargador.")
    libres = [0.0] * cargadores
    inicio = np.empty_like(llegada_s, dtype=float)
    for k, (t, d) in enumerate(zip(llegada_s, duracion_s)):
        inicio[k] = max(t, libres[0])
        heapq.heapreplace(libres, inicio[k] + d)
    return inicio


def energia_por_intervalo(inicio_s, fin_s, potencia_w, fila, n_filas, paso_s):
    """Wh de cada sesión repartidos por solape exacto en intervalos de `paso_s` segundos.

    Devuelve una matriz (filas × intervalos) que llega hasta el final de la última sesión.
    """
    i = (inicio_s // paso_s).astype(int)
    j = np.ceil(fin_s / paso_s).astype(int) - 1
    j = np.maximum(i, j)
    n_intervalos = int(j.max()) + 1
    tramos = j - i + 1
    sesion = np.repeat(np.arange(len(inicio_s)), tramos)
    k = np.repeat(i, tramos) + (np.arange(tramos.sum()) - np.repeat(np.cumsum(tramos) - tramos, tramos))
    solape = np.minimum(fin_s[sesion], (k + 1) * paso_s) - np.maximum(inicio_s[sesion], k * paso_s)
    wh = np.zeros((n_filas, n_intervalos))
    np.add.at(wh, (fila[sesion], k), potencia_w * np.clip(solape, 0, None) / 3600)
    return wh


def simultaneas_max(inicio_s, fin_s, fila, n_filas):
    """Máximo de sesiones cargando a la vez en cada fila (estación)."""
    t = np.concatenate([inicio_s, fin_s])
    paso = np.concatenate([np.ones_like(inicio_s), -np.ones_like(fin_s)])
    f = np.concatenate([fila, fila])
    # A igual instante, primero terminan las sesiones y después empiezan las nuevas.
    orden = np.lexsort((paso, t, f))
    acumulado = np.zeros(len(t))
    maximo = np.zeros(n_filas, dtype=int)
    for e in np.unique(f):
        sel = orden[f[orden] == e]
        acumulado = np.cumsum(paso[sel])
        maximo[e] = int(acumulado.max())
    return maximo


def horas_con_cola(llegada_s, inicio_s, fila, n_filas):
    """Horas de reloj en las que alguna sesión espera, por estación."""
    espera = inicio_s > llegada_s + 1e-9
    horas = np.zeros(n_filas, dtype=int)
    if not espera.any():
        return horas
    a = (llegada_s[espera] // 3600).astype(int)
    b = (np.ceil(inicio_s[espera] / 3600)).astype(int)
    pares = {(f, h) for f, x, y in zip(fila[espera], a, b) for h in range(x, y)}
    for f, _ in pares:
        horas[f] += 1
    return horas


def entradas():
    """Llegadas con energía de la red de diseño y catálogo de estaciones con anclajes."""
    d = cargar_ajustes()["demanda"]
    l = pd.read_parquet(PROCESADOS / "T44_entrada_recarga.parquet")
    l = l.loc[l["red"].eq(d["red"])].copy()
    est = pd.read_csv(TABLAS_MOV / "T39_estaciones.csv")
    est = est.loc[est["red"].eq(d["red"]), ["periodo", "station_id", "lon", "lat", "anclajes"]]
    if not est.groupby("station_id")[["lon", "lat", "anclajes"]].nunique().eq(1).all().all():
        raise ValueError("Una estación cambia de posición o de anclajes entre periodos.")
    est = est.drop_duplicates("station_id").drop(columns="periodo").sort_values("station_id").reset_index(drop=True)
    if not l["estacion_destino"].isin(est["station_id"]).all():
        raise ValueError("Hay llegadas a estaciones que no están en el catálogo de T39.")
    return l, est


def simular(l, est, periodo, modelo, cargadores_por_anclaje, eta):
    """Sesiones de un periodo y modelo con la fracción de cargadores indicada."""
    fechas = cargar_config()["datos"]["periodos"][periodo]
    origen = pd.Timestamp(fechas[0])
    cierre_s = (pd.Timestamp(fechas[1]) + pd.Timedelta(days=1) - origen).total_seconds()
    g = l.loc[l["periodo"].eq(periodo)].sort_values(["estacion_destino", "tsD", "trip_id"])
    ids = pd.Index(est["station_id"])
    fila = ids.get_indexer(g["estacion_destino"])
    llegada = (g["tsD"].dt.tz_convert(cargar_config()["datos"]["zona_horaria"]).dt.tz_localize(None)
               - origen).dt.total_seconds().to_numpy()
    wh_bat = g[f"energia_wh_{modelo}"].to_numpy()
    p_bat = potencia_bateria_w()
    duracion = wh_bat / p_bat * 3600
    cargadores = np.maximum(1, np.ceil(est["anclajes"].to_numpy() * cargadores_por_anclaje - 1e-9)).astype(int)
    inicio = np.empty_like(llegada)
    for e in np.unique(fila):
        sel = fila == e
        inicio[sel] = cola(llegada[sel], duracion[sel], int(cargadores[e]))
    return pd.DataFrame({
        "trip_id": g["trip_id"].to_numpy(), "fila": fila, "llegada_s": llegada, "inicio_s": inicio,
        "fin_s": inicio + duracion, "wh_bat": wh_bat, "wh_ac": wh_bat / eta,
    }), cargadores, origen, cierre_s, p_bat / eta


def indicadores(s, est, cargadores, origen, cierre_s, p_ac, *, ideal=False):
    """Curva de 15 minutos en W AC e indicadores por estación de una simulación."""
    d = cargar_ajustes()["demanda"]
    paso = d["paso_min"] * 60
    n = len(est)
    inicio = s["llegada_s"].to_numpy() if ideal else s["inicio_s"].to_numpy()
    fin = inicio + (s["fin_s"] - s["inicio_s"]).to_numpy()
    fila = s["fila"].to_numpy()
    wh = energia_por_intervalo(inicio, fin, p_ac, fila, n, paso)
    np.testing.assert_allclose(wh.sum(), s["wh_ac"].sum(), rtol=1e-12)
    dentro = int(cierre_s // paso)
    if wh.shape[1] < dentro:
        wh = np.pad(wh, ((0, 0), (0, dentro - wh.shape[1])))
    t = origen + pd.to_timedelta(np.arange(wh.shape[1]) * paso + paso / 2, unit="s")
    zona = cargar_config()["datos"]["zona_horaria"]
    t_utc = t.tz_localize(zona).tz_convert("UTC")
    sol = altura_solar(t_utc, est["lat"].to_numpy()[:, None], est["lon"].to_numpy()[:, None]) >= d["altura_solar_min_grados"]
    w = wh * 3600 / paso
    dias = int(round(cierre_s / 86400))
    diaria = wh[:, :dentro].reshape(n, dias, -1).sum(axis=2)
    pedida = np.bincount(fila, weights=s["wh_ac"], minlength=n)
    espera = (inicio - s["llegada_s"].to_numpy()) / 60
    aplazada = np.bincount(fila, weights=s["wh_ac"] * (espera > 1e-6), minlength=n)
    tabla = pd.DataFrame({
        "station_id": est["station_id"], "lon": est["lon"], "lat": est["lat"], "anclajes": est["anclajes"],
        "cargadores": cargadores, "llegadas": np.bincount(fila, minlength=n),
        "pedida_kwh": pedida / 1000, "servida_kwh": wh[:, :dentro].sum(axis=1) / 1000,
        "pendiente_kwh": wh[:, dentro:].sum(axis=1) / 1000, "aplazada_kwh": aplazada / 1000,
        "kwh_dia_media": diaria.mean(axis=1) / 1000, "kwh_dia_p95": np.quantile(diaria, d["cuantil"], axis=1) / 1000,
        "pico_w": w.max(axis=1), "p95_w": np.quantile(w[:, :dentro], d["cuantil"], axis=1),
        "simultaneas_max": simultaneas_max(inicio, fin, fila, n),
        "horas_con_cola": horas_con_cola(s["llegada_s"].to_numpy(), inicio, fila, n),
        "espera_media_min": np.bincount(fila, weights=espera, minlength=n) / np.maximum(np.bincount(fila, minlength=n), 1),
        "espera_max_min": pd.Series(espera).groupby(fila).max().reindex(range(n), fill_value=0).to_numpy(),
        "fuera_sol_kwh": (wh * ~sol).sum(axis=1) / 1000,
    })
    tabla["fuera_sol_pct"] = 100 * tabla["fuera_sol_kwh"] / tabla["pedida_kwh"].where(tabla["pedida_kwh"] > 0)
    np.testing.assert_allclose(tabla["servida_kwh"] + tabla["pendiente_kwh"], tabla["pedida_kwh"], rtol=1e-9, atol=1e-12)
    return tabla, w, sol, t
