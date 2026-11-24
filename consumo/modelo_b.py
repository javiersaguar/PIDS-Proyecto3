"""Trabajo de rodadura, aire y desnivel neto a velocidad media."""

import numpy as np


def densidad_aire(temperatura_c, presion_hpa, gas_j_kg_k):
    return np.asarray(presion_hpa) * 100 / (gas_j_kg_k * (np.asarray(temperatura_c) + 273.15))


def traccion_wh(distancia_m, velocidad_m_s, desnivel_m, densidad_kg_m3, *,
                masa_kg, gravedad_m_s2, crr, cda_m2, eta_traccion, eta_transmision,
                eta_descarga, regeneracion, viento_paralelo_m_s=0, viento_lateral_m_s=0):
    """Devuelve rodadura, aire, pendiente y descarga en Wh, por viaje.

    La pendiente media equivalente usa sin(ángulo) = desnivel / distancia.
    El viento paralelo es positivo si empuja en la dirección del movimiento.
    Se aplica una sola conversión a batería sobre el trabajo de rueda neto.
    """
    distancia, velocidad, desnivel, densidad = map(
        lambda x: np.asarray(x, dtype=float), (distancia_m, velocidad_m_s, desnivel_m, densidad_kg_m3))
    if (not all(np.isfinite(x).all() for x in (distancia, velocidad, desnivel, densidad))
            or (distancia <= 0).any() or (velocidad < 0).any() or (densidad <= 0).any()
            or (abs(desnivel) > distancia).any()):
        raise ValueError("Distancia, velocidad, densidad o desnivel fuera del dominio físico.")
    if not (0 < eta_traccion <= 1 and 0 < eta_transmision <= 1 and 0 < eta_descarga <= 1 and 0 <= regeneracion <= 1):
        raise ValueError("Rendimientos fuera del intervalo admisible.")
    peso = masa_kg * gravedad_m_s2
    rodadura = crr * peso * np.sqrt(distancia ** 2 - desnivel ** 2) / 3600
    relativo = velocidad - np.asarray(viento_paralelo_m_s)
    aire = 0.5 * densidad * cda_m2 * np.hypot(relativo, viento_lateral_m_s) * relativo * distancia / 3600
    pendiente = peso * desnivel / 3600
    trabajo = rodadura + aire + pendiente
    descarga = np.maximum(trabajo, 0) / (eta_traccion * eta_transmision * eta_descarga)
    descarga -= regeneracion * np.maximum(-trabajo, 0)
    return rodadura, aire, pendiente, np.maximum(descarga, 0)


def componentes_viento(lon_o, lat_o, lon_d, lat_d, km_h, desde_grados):
    """Proyección O–D de viento meteorológico. Un par coincidente usa aire en calma."""
    lo, la, ld, lb, desde = np.deg2rad([lon_o, lat_o, lon_d, lat_d, desde_grados])
    este = np.sin(ld - lo) * np.cos(lb)
    norte = np.cos(la) * np.sin(lb) - np.sin(la) * np.cos(lb) * np.cos(ld - lo)
    angulo = np.arctan2(este, norte)
    validos = np.hypot(este, norte) > np.finfo(float).eps
    magnitud = np.where(validos, np.asarray(km_h) / 3.6, 0.)
    return -magnitud * np.cos(desde - angulo), -magnitud * np.sin(desde - angulo)
