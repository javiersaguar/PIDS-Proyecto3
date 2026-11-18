"""Distancias geográficas."""

import numpy as np

RADIO_TIERRA_M = 6_371_008.8  # radio medio (IUGG)


def haversine_m(lat1, lon1, lat2, lon2):
    """Distancia de círculo máximo en metros. Acepta escalares o vectores en grados."""
    lat1, lon1, lat2, lon2 = (np.radians(np.asarray(x, dtype=float)) for x in (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * RADIO_TIERRA_M * np.arcsin(np.sqrt(a))
