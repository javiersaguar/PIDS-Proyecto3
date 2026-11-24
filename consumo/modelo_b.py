"""Trabajo de rodadura, aire y desnivel neto a velocidad media."""

import numpy as np
from scipy.optimize import brentq


def densidad_aire(temperatura_c, presion_hpa, gas_j_kg_k):
    return np.asarray(presion_hpa) * 100 / (gas_j_kg_k * (np.asarray(temperatura_c) + 273.15))


def factor_viento(altura_m, rugosidad_m, altura_medida_m):
    """Perfil logarítmico neutro: velocidad a la altura del conductor / velocidad medida."""
    if not 0 < rugosidad_m < altura_m <= altura_medida_m:
        raise ValueError("El perfil logarítmico necesita rugosidad < altura del conductor <= altura medida.")
    return np.log(altura_m / rugosidad_m) / np.log(altura_medida_m / rugosidad_m)


def traccion_wh(distancia_m, velocidad_m_s, desnivel_m, densidad_kg_m3, *,
                masa_kg, gravedad_m_s2, crr, cda_m2, eta_traccion, eta_transmision,
                eta_descarga, regeneracion, viento_paralelo_m_s=0, viento_lateral_m_s=0,
                escala_resistencias=1.0, potencia_auxiliar_w=0.0):
    """Devuelve rodadura, aire, pendiente y descarga en Wh, por viaje.

    La pendiente media equivalente usa sin(ángulo) = desnivel / distancia.
    El viento paralelo es positivo si empuja en la dirección del movimiento.
    `escala_resistencias` multiplica solo rodadura y aire: resume pérdidas que crecen con la
    distancia (arranques, frenadas, rodeos) y deja el trabajo gravitatorio en su valor físico.
    La electrónica consume `potencia_auxiliar_w` durante el viaje, también con la batería en
    bajada. Se aplica una sola conversión a batería sobre el trabajo de rueda neto.
    """
    distancia, velocidad, desnivel, densidad = map(
        lambda x: np.asarray(x, dtype=float), (distancia_m, velocidad_m_s, desnivel_m, densidad_kg_m3))
    if (not all(np.isfinite(x).all() for x in (distancia, velocidad, desnivel, densidad))
            or (distancia <= 0).any() or (velocidad < 0).any() or (densidad <= 0).any()
            or (abs(desnivel) > distancia).any()):
        raise ValueError("Distancia, velocidad, densidad o desnivel fuera del dominio físico.")
    if not (0 < eta_traccion <= 1 and 0 < eta_transmision <= 1 and 0 < eta_descarga <= 1 and 0 <= regeneracion <= 1):
        raise ValueError("Rendimientos fuera del intervalo admisible.")
    if escala_resistencias <= 0 or potencia_auxiliar_w < 0:
        raise ValueError("La escala debe ser positiva y la potencia auxiliar no negativa.")
    if potencia_auxiliar_w > 0 and (velocidad <= 0).any():
        raise ValueError("El consumo auxiliar necesita una duración finita (velocidad positiva).")
    peso = masa_kg * gravedad_m_s2
    rodadura = escala_resistencias * crr * peso * np.sqrt(distancia ** 2 - desnivel ** 2) / 3600
    relativo = velocidad - np.asarray(viento_paralelo_m_s)
    aire = escala_resistencias * 0.5 * densidad * cda_m2 * np.hypot(relativo, viento_lateral_m_s) * relativo * distancia / 3600
    pendiente = peso * desnivel / 3600
    trabajo = rodadura + aire + pendiente
    descarga = np.maximum(trabajo, 0) / (eta_traccion * eta_transmision * eta_descarga)
    descarga -= regeneracion * np.maximum(-trabajo, 0)
    if potencia_auxiliar_w:
        descarga = np.maximum(descarga, 0) + potencia_auxiliar_w * distancia / velocidad / 3600 / eta_descarga
    return rodadura, aire, pendiente, np.maximum(descarga, 0)


def calibrar(energia_de_escala, distancia_m, objetivo_wh_km, limites=(0.2, 20.0)):
    """Escala de resistencias con la que la intensidad agregada iguala el objetivo.

    `energia_de_escala(k)` devuelve los Wh por viaje con la escala k. La intensidad crece con
    k, así que la raíz es única dentro de los límites.
    """
    km = np.asarray(distancia_m, dtype=float).sum() / 1000
    return brentq(lambda k: energia_de_escala(k).sum() / km - objetivo_wh_km, *limites, xtol=1e-12)


def componentes_viento(lon_o, lat_o, lon_d, lat_d, km_h, desde_grados):
    """Proyección O–D de viento meteorológico. Un par coincidente usa aire en calma."""
    lo, la, ld, lb, desde = np.deg2rad([lon_o, lat_o, lon_d, lat_d, desde_grados])
    este = np.sin(ld - lo) * np.cos(lb)
    norte = np.cos(la) * np.sin(lb) - np.sin(la) * np.cos(lb) * np.cos(ld - lo)
    angulo = np.arctan2(este, norte)
    validos = np.hypot(este, norte) > np.finfo(float).eps
    magnitud = np.where(validos, np.asarray(km_h) / 3.6, 0.)
    return -magnitud * np.cos(desde - angulo), -magnitud * np.sin(desde - angulo)
