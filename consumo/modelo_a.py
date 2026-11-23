"""Energía de tracción por viaje con el coeficiente del enunciado (T40)."""

import numpy as np

from comun.config import cargar_config, ruta
from comun.datos import cargar_viajes


def energia_wh(distancias_m):
    metros = np.asarray(distancias_m, dtype=float)
    if not np.isfinite(metros).all() or (metros < 0).any():
        raise ValueError("La distancia observada debe ser finita y no negativa.")
    return metros * cargar_config()["patinete"]["consumo_wh_km"] / 1000


def publicar():
    viajes = cargar_viajes()[["trip_id", "idS", "periodo", "dis_m"]]
    cfg = cargar_config()["patinete"]
    wh = energia_wh(viajes["dis_m"])
    assert viajes["trip_id"].is_unique
    viajes.assign(energia_wh=wh,
                  bateria_pct=100 * wh / cfg["bateria_wh"],
                  excede_bateria=wh > cfg["bateria_wh"]).to_csv(
        ruta("tablas") / "consumo" / "T40_energia_viaje.csv", index=False, lineterminator="\n", float_format="%.6f")


if __name__ == "__main__":
    (ruta("tablas") / "consumo").mkdir(parents=True, exist_ok=True)
    publicar()
