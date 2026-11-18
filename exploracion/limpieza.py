"""T10. Limpieza de los viajes.

Genera viajes_limpios.parquet, la tabla de embudo, el recuento por motivo, la
sensibilidad de cada umbral, los histogramas con los umbrales y la comparación
con una limpieza menos restrictiva. Los umbrales se revisan con el periodo de
ajuste y se aplican igual a la semana reservada.

Uso: python exploracion/limpieza.py
"""

import h3
import numpy as np
import pandas as pd

from comun import limpieza
from comun.config import cargar_config, carpeta_tablas, ruta
from comun.datos import generar_viajes_limpios
from comun.figuras import guardar_figura, plt

TEMA = "exploracion"

# Barridos de cada umbral para la tabla de sensibilidad: (columna, sentido, valores).
# "menor" excluye los viajes por debajo del umbral y "mayor" los que lo superan.
BARRIDOS = {
    "tt_min_s": ("tt_s", "menor", list(range(0, 181, 10))),
    "dis_min_m": ("dis_m", "menor", list(range(0, 301, 25))),
    "vel_min_kmh": ("vel_kmh", "menor", [x / 2 for x in range(0, 11)]),
    "vel_max_kmh": ("vel_kmh", "mayor", list(range(20, 41, 2))),
    "tt_max_s": ("tt_s", "mayor", list(range(1800, 14401, 1800))),
}
ETIQUETAS = {
    "tt_min_s": "Duración mínima (s)",
    "dis_min_m": "Distancia mínima (m)",
    "vel_min_kmh": "Velocidad mínima (km/h)",
    "vel_max_kmh": "Velocidad máxima (km/h)",
    "tt_max_s": "Duración máxima (s)",
}


def sensibilidad(ajuste: pd.DataFrame) -> pd.DataFrame:
    """Viajes del periodo de ajuste que excluiría cada umbral por sí solo."""
    filas = []
    for parametro, (col, sentido, valores) in BARRIDOS.items():
        for v in valores:
            excluidos = (ajuste[col] < v) if sentido == "menor" else (ajuste[col] > v)
            filas.append({"parametro": parametro, "umbral": v, "excluidos": int(excluidos.sum()),
                          "porcentaje": round(100 * excluidos.mean(), 2)})
    return pd.DataFrame(filas)


def figura_umbrales(ajuste: pd.DataFrame) -> None:
    """Histogramas de duración, distancia y velocidad con los umbrales de limpieza."""
    c = limpieza.umbrales()
    paneles = [
        ("tt_s", "Duración (s)", [c["tt_min_s"], c["tt_max_s"]], True),
        ("dis_m", "Distancia recorrida (m)", [c["dis_min_m"]], True),
        ("vel_kmh", "Velocidad media (km/h)", [c["vel_min_kmh"], c["vel_max_kmh"]], False),
    ]
    fig, ejes = plt.subplots(1, 3, figsize=(6.5, 2.6))
    for eje, (col, etiqueta, lineas, log) in zip(ejes, paneles):
        valores = ajuste[col][ajuste[col] > 0]
        if log:
            bins = np.logspace(np.log10(valores.min()), np.log10(valores.max()), 60)
        else:
            bins = np.arange(0, valores.max() + 0.5, 0.5)
        eje.hist(valores, bins=bins, color="#4C72B0")
        if log:
            eje.set_xscale("log")
        for u in lineas:
            eje.axvline(u, color="#C44E52", lw=1, ls="--")
        eje.set_xlabel(etiqueta)
    ejes[0].set_ylabel("Viajes")
    fig.suptitle("Todos los viajes del periodo de ajuste (1–21/02/2021); umbrales en línea discontinua",
                 fontsize=9)
    guardar_figura(fig, TEMA, "T10_umbrales")


def figura_sensibilidad(tabla: pd.DataFrame) -> None:
    c = limpieza.umbrales()
    fig, ejes = plt.subplots(2, 3, figsize=(6.5, 4.0), sharey=True)
    ejes = ejes.ravel()
    for eje, parametro in zip(ejes, BARRIDOS):
        t = tabla[tabla["parametro"] == parametro]
        eje.plot(t["umbral"], t["porcentaje"], marker="o", ms=2.5, color="#4C72B0")
        eje.axvline(c[parametro], color="#C44E52", lw=1, ls="--")
        eje.set_xlabel(ETIQUETAS[parametro])
    ejes[-1].set_visible(False)
    for eje in ejes[::3]:
        eje.set_ylabel("Viajes excluidos (%)")
    fig.suptitle("Viajes del periodo de ajuste que excluye cada umbral por sí solo (elegido en línea discontinua)",
                 fontsize=9)
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    guardar_figura(fig, TEMA, "T10_sensibilidad_umbrales")


def indicadores(viajes: pd.DataFrame, nombre: str) -> list[dict]:
    """Indicadores de una limpieza para el periodo de ajuste y la semana reservada."""
    consumo = cargar_config()["patinete"]["consumo_wh_km"]
    res = cargar_config()["exploracion"]["resoluciones_h3"][0]
    filas = []
    for periodo, grupo in viajes.groupby("periodo"):
        e = grupo[grupo["elegible"]]
        celdas = pd.Series(
            [h3.latlng_to_cell(la, lo, res) for la, lo in zip(e["latO"], e["lonO"])]
            + [h3.latlng_to_cell(la, lo, res) for la, lo in zip(e["latD"], e["lonD"])]
        ).value_counts()
        n_top = max(1, round(0.2 * len(celdas)))
        filas.append({
            "limpieza": nombre,
            "periodo": periodo,
            "viajes_elegibles": len(e),
            "porcentaje_elegibles": round(100 * len(e) / len(grupo), 2),
            "dis_m_mediana": round(e["dis_m"].median(), 1),
            "tt_s_mediana": round(e["tt_s"].median(), 1),
            "vel_kmh_mediana": round(e["vel_kmh"].median(), 2),
            "km_totales": round(e["dis_m"].sum() / 1000, 1),
            "energia_kwh_13_5": round(e["dis_m"].sum() / 1000 * consumo / 1000, 1),
            f"celdas_h3_res{res}": len(celdas),
            "extremos_en_20pc_celdas_pc": round(100 * celdas.iloc[:n_top].sum() / celdas.sum(), 2),
        })
    return filas


def main() -> None:
    tablas = carpeta_tablas(TEMA)
    viajes, embudo, recuento = generar_viajes_limpios()
    embudo.to_csv(tablas / "T10_embudo.csv", index=False)
    recuento.to_csv(tablas / "T10_recuento_motivos.csv", index=False)

    periodos = (
        viajes.groupby("periodo")
        .agg(viajes=("trip_id", "size"), elegibles=("elegible", "sum"))
        .reset_index()
    )
    periodos["porcentaje_elegibles"] = (100 * periodos["elegibles"] / periodos["viajes"]).round(2)
    periodos.to_csv(tablas / "T10_viajes_por_periodo.csv", index=False)

    ajuste = viajes[viajes["periodo"] == "ajuste"]
    sens = sensibilidad(ajuste)
    sens.to_csv(tablas / "T10_sensibilidad_umbrales.csv", index=False)
    figura_umbrales(ajuste)
    figura_sensibilidad(sens)

    # Comparación con la limpieza permisiva sobre el mismo CSV.
    permisiva, embudo_permisivo, _ = limpieza.limpiar(limpieza.leer_bruto(ruta("csv_bruto")), "permisiva")
    embudo_permisivo.to_csv(tablas / "T10_embudo_permisiva.csv", index=False)
    comparacion = pd.DataFrame(indicadores(viajes, "principal") + indicadores(permisiva, "permisiva"))
    comparacion.to_csv(tablas / "T10_comparacion_limpiezas.csv", index=False)

    print(embudo[["regla", "excluidos", "quedan"]].to_string(index=False))
    print()
    print(comparacion.to_string(index=False))


if __name__ == "__main__":
    main()
