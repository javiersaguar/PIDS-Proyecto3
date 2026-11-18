"""T11. Solapes por patinete y recolocaciones del operador.

Se encadenan todos los viajes de cada patinete (también los no elegibles, porque
el patinete se movió o se desbloqueó igualmente) y se mide el salto entre el
final de un viaje y el inicio del siguiente. Un salto grande indica que el
patinete se movió sin un viaje registrado: recolocación, recogida para recargar
o mantenimiento, o un viaje fuera de la muestra. Son indicios, no registros del
operador.

Uso: python exploracion/recolocaciones.py
"""

import h3
import numpy as np
import pandas as pd

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt
from comun.geo import haversine_m

TEMA = "exploracion"
PARAMETROS = {
    "horas_intradia": 6,  # parada máxima para considerar la recolocación dentro del mismo día de servicio
    "noche": (0, 6),  # horas en las que se supone que trabaja el operador
    "res_puntos": 10,  # resolución H3 para contar puntos distintos de recogida y entrega
}


def encadenar(viajes: pd.DataFrame) -> pd.DataFrame:
    """Una fila por par de viajes consecutivos del mismo patinete."""
    v = viajes.sort_values(["idS", "tsO"]).reset_index(drop=True)
    g = v.groupby("idS")
    pares = pd.DataFrame({
        "idS": v["idS"],
        "trip_id_anterior": g["trip_id"].shift(),
        "trip_id": v["trip_id"],
        "fin_anterior": g["tsD"].shift(),
        "inicio": v["tsO"],
        "lat_recogida": g["latD"].shift(),
        "lon_recogida": g["lonD"].shift(),
        "lat_entrega": v["latO"],
        "lon_entrega": v["lonO"],
        "periodo": v["periodo"],
    }).dropna(subset=["trip_id_anterior"])
    pares["trip_id_anterior"] = pares["trip_id_anterior"].astype("int64")
    pares["salto_m"] = haversine_m(pares["lat_recogida"], pares["lon_recogida"],
                                   pares["lat_entrega"], pares["lon_entrega"])
    pares["parado_h"] = (pares["inicio"] - pares["fin_anterior"]).dt.total_seconds() / 3600
    return pares.reset_index(drop=True)


def incluye_noche(inicio: pd.Series, fin: pd.Series) -> pd.Series:
    """True si el intervalo [inicio, fin] se cruza con alguna franja nocturna."""
    h0, h1 = PARAMETROS["noche"]
    base = inicio.dt.normalize()
    dias = int(np.ceil((fin - base).dt.total_seconds().max() / 86400)) + 1
    resultado = pd.Series(False, index=inicio.index)
    for k in range(dias):
        noche_ini = base + pd.Timedelta(days=k, hours=h0)
        noche_fin = base + pd.Timedelta(days=k, hours=h1)
        resultado |= (noche_ini < fin) & (noche_fin > inicio)
    return resultado


def main() -> None:
    cfg = cargar_config()["exploracion"]
    umbral = cfg["umbral_recolocacion_m"]
    res = cfg["resoluciones_h3"][0]
    tablas = carpeta_tablas(TEMA)

    viajes = cargar_viajes(solo_elegibles=False)
    pares = encadenar(viajes)
    solapes = int((pares["parado_h"] < 0).sum())
    pares["recolocacion"] = pares["salto_m"] > umbral

    # Sensibilidad al umbral
    sens = []
    for u in cfg["umbrales_recolocacion_m"]:
        m = pares["salto_m"] > u
        sens.append({
            "umbral_m": u,
            "saltos": int(m.sum()),
            "porcentaje_encadenamientos": round(100 * m.mean(), 2),
            "patinetes_con_salto": int(pares.loc[m, "idS"].nunique()),
            "parado_h_mediana_con_salto": round(pares.loc[m, "parado_h"].median(), 1),
            "parado_h_mediana_sin_salto": round(pares.loc[~m, "parado_h"].median(), 1),
        })
    pd.DataFrame(sens).to_csv(tablas / "T11_saltos_sensibilidad.csv", index=False)

    r = pares[pares["recolocacion"]].copy()
    r["intradia"] = r["parado_h"] <= PARAMETROS["horas_intradia"]
    r["incluye_noche"] = incluye_noche(r["fin_anterior"], r["inicio"])
    n_dias = viajes["tsO"].dt.date.nunique()
    rp = PARAMETROS["res_puntos"]
    celdas_recogida = {h3.latlng_to_cell(a, b, rp) for a, b in zip(r["lat_recogida"], r["lon_recogida"])}
    celdas_entrega = {h3.latlng_to_cell(a, b, rp) for a, b in zip(r["lat_entrega"], r["lon_entrega"])}

    resumen = pd.DataFrame([
        ("viajes", len(viajes)),
        ("patinetes", viajes["idS"].nunique()),
        ("encadenamientos", len(pares)),
        ("solapes", solapes),
        ("salto_m_mediana", round(pares["salto_m"].median(), 1)),
        ("salto_m_p75", round(pares["salto_m"].quantile(0.75), 1)),
        ("umbral_recolocacion_m", umbral),
        ("recolocaciones", len(r)),
        ("recolocaciones_pc_encadenamientos", round(100 * len(r) / len(pares), 2)),
        ("recolocaciones_por_dia_media", round(len(r) / n_dias, 1)),
        ("recolocacion_salto_km_mediana", round(r["salto_m"].median() / 1000, 2)),
        ("recolocacion_parado_h_mediana", round(r["parado_h"].median(), 1)),
        ("sin_salto_parado_h_mediana", round(pares.loc[~pares["recolocacion"], "parado_h"].median(), 1)),
        ("recolocaciones_intradia_pc", round(100 * r["intradia"].mean(), 2)),
        ("recolocaciones_con_noche_pc", round(100 * r["incluye_noche"].mean(), 2)),
        ("patinetes_recolocados", r["idS"].nunique()),
        (f"celdas_res{rp}_recogida", len(celdas_recogida)),
        (f"celdas_res{rp}_entrega", len(celdas_entrega)),
    ], columns=["indicador", "valor"])
    resumen.to_csv(tablas / "T11_resumen.csv", index=False)

    # Por día (día en que el patinete reaparece) y por hora de reaparición
    dia_viajes = viajes.groupby(viajes["tsO"].dt.date).agg(viajes=("trip_id", "size"),
                                                           patinetes_activos=("idS", "nunique"))
    dia_rec = r.groupby(r["inicio"].dt.date).size().rename("recolocaciones")
    por_dia = dia_viajes.join(dia_rec).fillna({"recolocaciones": 0}).astype("int64")
    por_dia.index.name = "fecha"
    por_dia.reset_index().to_csv(tablas / "T11_por_dia.csv", index=False)

    # Dónde recoge y dónde deja el operador (celdas H3)
    recogida = pd.Series([h3.latlng_to_cell(a, b, res) for a, b in zip(r["lat_recogida"], r["lon_recogida"])])
    entrega = pd.Series([h3.latlng_to_cell(a, b, res) for a, b in zip(r["lat_entrega"], r["lon_entrega"])])
    celdas = pd.DataFrame({"recogidas": recogida.value_counts(), "entregas": entrega.value_counts()}).fillna(0)
    celdas = celdas.astype("int64")
    celdas["neto_entregas"] = celdas["entregas"] - celdas["recogidas"]
    celdas.index.name = f"h3_res{res}"
    celdas.sort_values("neto_entregas", ascending=False).reset_index().to_csv(
        tablas / f"T11_celdas_res{res}.csv", index=False)

    # Figura 1: distribución de saltos y de tiempo parado
    fig, (a, b) = plt.subplots(1, 2, figsize=(6.5, 2.8))
    bins = np.logspace(0, np.log10(pares["salto_m"].max() + 1), 50)
    a.hist(pares["salto_m"].clip(lower=1), bins=bins, color="#4C72B0")
    a.axvline(umbral, color="#C44E52", ls="--", lw=1)
    a.set_xscale("log")
    a.set_xlabel("Salto entre viajes consecutivos (m)")
    a.set_ylabel("Pares de viajes")
    bins_h = np.logspace(-2, np.log10(pares["parado_h"].max() + 1), 50)
    b.hist(pares.loc[~pares["recolocacion"], "parado_h"].clip(lower=0.01), bins=bins_h,
           alpha=0.7, label=f"Salto ≤ {umbral} m", color="#4C72B0")
    b.hist(r["parado_h"].clip(lower=0.01), bins=bins_h, alpha=0.7, label=f"Salto > {umbral} m", color="#DD8452")
    b.set_xscale("log")
    b.set_xlabel("Tiempo parado entre viajes (h)")
    b.legend()
    fig.suptitle("Encadenamiento de viajes del mismo patinete, febrero de 2021", fontsize=9)
    guardar_figura(fig, TEMA, "T11_saltos")

    # Figura 2: puntos de recogida y de entrega
    fig, ejes = plt.subplots(1, 2, figsize=(6.5, 3.6), sharex=True, sharey=True)
    for eje, (lat, lon, titulo, color) in zip(ejes, [
        ("lat_recogida", "lon_recogida", "Dónde se recogen", "#4C72B0"),
        ("lat_entrega", "lon_entrega", "Dónde reaparecen", "#DD8452"),
    ]):
        eje.scatter(viajes["lonO"], viajes["latO"], s=0.2, color="0.85", rasterized=True)
        eje.scatter(r[lon], r[lat], s=0.6, color=color, alpha=0.5, rasterized=True)
        eje.set_title(titulo)
        eje.set_xlabel("Longitud")
        eje.set_aspect(1 / np.cos(np.radians(41.9)))
    ejes[0].set_ylabel("Latitud")
    fig.suptitle(f"Recolocaciones (salto > {umbral} m) sobre los orígenes de todos los viajes en gris",
                 fontsize=9)
    guardar_figura(fig, TEMA, "T11_mapa_recolocaciones")

    print(resumen.to_string(index=False))
    print()
    print(pd.DataFrame(sens).to_string(index=False))


if __name__ == "__main__":
    main()
