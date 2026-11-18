"""Carga de los viajes limpios para todas las fases."""

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from comun import limpieza
from comun.config import ruta

CLAVE_FIRMA = b"pids_firma_limpieza"


def generar_viajes_limpios() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Limpia el CSV original y escribe datos/procesados/viajes_limpios.parquet."""
    viajes, embudo, recuento = limpieza.limpiar(limpieza.leer_bruto(ruta("csv_bruto")))
    destino = ruta("viajes_limpios")
    destino.parent.mkdir(parents=True, exist_ok=True)
    tabla = pa.Table.from_pandas(viajes, preserve_index=False)
    metadatos = {**(tabla.schema.metadata or {}), CLAVE_FIRMA: limpieza.firma().encode()}
    pq.write_table(tabla.replace_schema_metadata(metadatos), destino)
    return viajes, embudo, recuento


def _parquet_al_dia() -> bool:
    destino = ruta("viajes_limpios")
    if not destino.exists():
        return False
    metadatos = pq.read_schema(destino).metadata or {}
    return metadatos.get(CLAVE_FIRMA) == limpieza.firma().encode()


def cargar_viajes(solo_elegibles: bool = True, periodo: str | None = None) -> pd.DataFrame:
    """Viajes con el esquema de viajes_limpios.parquet (ver docs/PLAN.md).

    Si el parquet no existe o se generó con otros parámetros de config.yaml, se
    regenera antes de leerlo.

    solo_elegibles: devuelve solo los viajes con `elegible = True`.
    periodo: "ajuste", "reservada" o None para todo el mes.
    """
    if not _parquet_al_dia():
        generar_viajes_limpios()
    viajes = pd.read_parquet(ruta("viajes_limpios"))
    if solo_elegibles:
        viajes = viajes[viajes["elegible"]]
    if periodo is not None:
        viajes = viajes[viajes["periodo"] == periodo]
    return viajes.reset_index(drop=True)
