"""T10. Limpieza de los viajes: parquet, tabla de embudo, recuento por motivo e histogramas.

Uso: python exploracion/limpieza.py
"""

import numpy as np
import pandas as pd

from comun.config import cargar_config, carpeta_tablas
from comun.datos import generar_viajes_limpios
from comun.figuras import guardar_figura, plt

TEMA = "exploracion"


def figura_umbrales(viajes: pd.DataFrame) -> None:
    """Histogramas de duración, distancia y velocidad con los umbrales de limpieza."""
    c = cargar_config()["limpieza"]
    paneles = [
        ("tt_s", "Duración (s)", [c["tt_min_s"], c["tt_max_s"]], True),
        ("dis_m", "Distancia recorrida (m)", [c["dis_min_m"]], True),
        ("vel_kmh", "Velocidad media (km/h)", [c["vel_max_kmh"]], False),
    ]
    fig, ejes = plt.subplots(1, 3, figsize=(6.5, 2.6))
    for eje, (col, etiqueta, umbrales, log) in zip(ejes, paneles):
        valores = viajes[col][viajes[col] > 0]
        bins = np.logspace(np.log10(valores.min()), np.log10(valores.max()), 60) if log else 60
        eje.hist(valores, bins=bins, color="#4C72B0")
        if log:
            eje.set_xscale("log")
        for u in umbrales:
            eje.axvline(u, color="#C44E52", lw=1, ls="--")
        eje.set_xlabel(etiqueta)
    ejes[0].set_ylabel("Viajes")
    fig.suptitle("Viajes del CSV original (feb. 2021) y umbrales de limpieza (línea discontinua)", fontsize=9)
    guardar_figura(fig, TEMA, "T10_umbrales")


def main() -> None:
    viajes, embudo, recuento = generar_viajes_limpios()
    tablas = carpeta_tablas(TEMA)
    embudo.to_csv(tablas / "T10_embudo.csv", index=False)
    recuento.to_csv(tablas / "T10_recuento_motivos.csv", index=False)

    periodos = (
        viajes.groupby("periodo")
        .agg(viajes=("trip_id", "size"), elegibles=("elegible", "sum"))
        .reset_index()
    )
    periodos["porcentaje_elegibles"] = (100 * periodos["elegibles"] / periodos["viajes"]).round(2)
    periodos.to_csv(tablas / "T10_viajes_por_periodo.csv", index=False)

    figura_umbrales(viajes)

    print(embudo.to_string(index=False))
    print()
    print(periodos.to_string(index=False))


if __name__ == "__main__":
    main()
