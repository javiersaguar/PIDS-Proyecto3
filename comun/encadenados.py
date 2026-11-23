"""Viajes encadenados: el mismo patinete vuelve a salir casi en el mismo sitio y enseguida."""

import numpy as np
import pandas as pd

from .geo import haversine_m


def pares_consecutivos(viajes: pd.DataFrame) -> pd.DataFrame:
    """Una fila por par de viajes consecutivos del mismo patinete (a: el anterior, b: el siguiente).

    Incluye el salto entre el final de a y el inicio de b, la pausa entre los dos y los extremos
    de los dos viajes, con el mismo índice posicional que `viajes` ordenado por patinete y salida.
    """
    v = viajes.sort_values(["idS", "tsO", "trip_id"]).reset_index(drop=True)
    sig = v.groupby("idS").shift(-1)
    pares = pd.DataFrame({
        "idS": v["idS"], "trip_id_a": v["trip_id"], "trip_id_b": sig["trip_id"],
        "salto_m": haversine_m(v["latD"], v["lonD"], sig["latO"], sig["lonO"]),
        "pausa_s": (sig["tsO"] - v["tsD"]).dt.total_seconds(),
        "latO_a": v["latO"], "lonO_a": v["lonO"], "latD_a": v["latD"], "lonD_a": v["lonD"],
        "latO_b": sig["latO"], "lonO_b": sig["lonO"], "latD_b": sig["latD"], "lonD_b": sig["lonD"],
        "dis_m_a": v["dis_m"], "dis_m_b": sig["dis_m"], "tsO_b": sig["tsO"], "periodo_b": sig["periodo"],
    })
    pares = pares.dropna(subset=["trip_id_b"]).reset_index(drop=True)
    pares["trip_id_b"] = pares["trip_id_b"].astype("int64")
    return pares


def encadenado(pares: pd.DataFrame, salto_max_m: float, pausa_max_s: float) -> pd.Series:
    """True si el viaje b sale a menos de `salto_max_m` y `pausa_max_s` del final de a."""
    return (pares["salto_m"] <= salto_max_m) & (pares["pausa_s"] <= pausa_max_s)


def fusionar(viajes: pd.DataFrame, salto_max_m: float, pausa_max_s: float) -> pd.DataFrame:
    """Une cada cadena de viajes encadenados en un solo viaje.

    El viaje unido toma el origen y la salida del primero, el destino y la llegada del último,
    suma distancias y duraciones (con las pausas dentro) y guarda en `tramos` cuántos une.
    """
    v = viajes.sort_values(["idS", "tsO", "trip_id"]).reset_index(drop=True)
    ant = v.groupby("idS").shift(1)
    salto = haversine_m(ant["latD"], ant["lonD"], v["latO"], v["lonO"])
    pausa = (v["tsO"] - ant["tsD"]).dt.total_seconds().to_numpy()
    sigue = (np.nan_to_num(salto, nan=np.inf) <= salto_max_m) & (np.nan_to_num(pausa, nan=np.inf) <= pausa_max_s)
    cadena = pd.Series(np.cumsum(~sigue), index=v.index)
    unidos = v.groupby(cadena).agg(
        trip_id=("trip_id", "first"), idS=("idS", "first"), tsO=("tsO", "first"), tsD=("tsD", "last"),
        latO=("latO", "first"), lonO=("lonO", "first"), latD=("latD", "last"), lonD=("lonD", "last"),
        dis_m=("dis_m", "sum"), periodo=("periodo", "first"), tramos=("trip_id", "size"))
    unidos["tt_s"] = (unidos["tsD"] - unidos["tsO"]).dt.total_seconds()
    return unidos.reset_index(drop=True)
