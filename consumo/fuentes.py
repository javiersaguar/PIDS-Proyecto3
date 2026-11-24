"""Archiva el muestreo GLO-30 y las variables horarias que complementan a T17."""

from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import json

import numpy as np
import pandas as pd
from PIL import Image
import requests

from ajustes import cargar_ajustes
from comun.config import ruta
from comun.datos import cargar_viajes


FUENTES = cargar_ajustes()["fuentes"]
EXTERNOS = ruta("externos")


def leer_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def archivar(path, ficha):
    path.write_text(json.dumps({"fecha_descarga_utc": datetime.now(timezone.utc).isoformat(), **ficha},
                               ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def validar_archivo(meta):
    ficha = leer_json(meta)
    archivo = meta.with_name(ficha["fichero"])
    if sha256(archivo.read_bytes()).hexdigest() != ficha["sha256"]:
        raise ValueError(f"La huella de {archivo.name} no coincide.")
    return archivo, ficha


def puntos_dem(viajes):
    return pd.concat([viajes[[f"lon{x}", f"lat{x}"]].set_axis(["lon", "lat"], axis=1)
                      for x in ("O", "D")], ignore_index=True).round(FUENTES["coordenadas_decimales"])


def capa_dem(contenido, lon, lat):
    # GeoTIFF RasterPixelIsPoint: los tie points son centros de píxel.
    with Image.open(BytesIO(contenido)) as imagen:
        keys = imagen.tag_v2[34735]
        propiedades = {k: v for k, loc, n, v in zip(*(iter(keys[4:]),) * 4) if loc == 0 and n == 1}
        if propiedades.get(1025) != 2 or propiedades.get(2048) != 4326:
            raise ValueError("El GeoTIFF debe estar en WGS84 con centros de píxel.")
        dx, dy, _ = imagen.tag_v2[33550]
        u, v, _, x, y, _ = imagen.tag_v2[33922]
        i = np.floor(u + (lon - x) / dx + .5).astype(int)
        j = np.floor(v + (y - lat) / dy + .5).astype(int)
        if ((i < 0) | (j < 0) | (i >= imagen.width) | (j >= imagen.height)).any():
            raise ValueError("Hay puntos fuera de la tesela descargada.")
        return np.asarray(imagen)[j, i].astype(float)


def elevacion():
    meta = EXTERNOS / FUENTES["elevacion_meta"]
    meta.parent.mkdir(parents=True, exist_ok=True)
    archivo = meta.with_name("copernicus_glo30_roma.csv.gz")
    puntos = puntos_dem(cargar_viajes()).drop_duplicates().sort_values(["lon", "lat"], ignore_index=True)
    baldosas = puntos[["lon", "lat"]].apply(np.floor).astype(int)
    fichas = []
    for (lon, lat), indices in baldosas.groupby(["lon", "lat"]).groups.items():
        letra_ns, letra_ew = ("N" if lat >= 0 else "S"), ("E" if lon >= 0 else "W")
        tile = f"Copernicus_DSM_COG_10_{letra_ns}{abs(lat):02d}_00_{letra_ew}{abs(lon):03d}_00_DEM"
        url = f'{FUENTES["dem"]}/{tile}/{tile}.tif'
        respuesta = requests.get(url, timeout=(15, 90))
        respuesta.raise_for_status()
        muestras = puntos.loc[indices]
        puntos.loc[indices, "elevacion_m"] = capa_dem(respuesta.content, muestras["lon"], muestras["lat"])
        fichas.append({"url": url, "sha256_geotiff": sha256(respuesta.content).hexdigest()})
    if not np.isfinite(puntos["elevacion_m"]).all():
        raise ValueError("Hay elevaciones no finitas.")
    puntos.to_csv(archivo, index=False, lineterminator="\n",
                  compression={"method": "gzip", "mtime": 0}, float_format="%.7f")
    archivar(meta, {"fichero": archivo.name, "sha256": sha256(archivo.read_bytes()).hexdigest(),
                   "fuente": "Copernicus DEM GLO-30 Public (DSM)",
                   "documentacion": "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
                   "licencia": "https://copernicus-dem-30m.s3.amazonaws.com/readme.html#license",
                   "atribucion": "Copernicus WorldDEM-30 © DLR e.V. 2010–2014 y © Airbus Defence and Space GmbH 2014–2018, distribuido por la UE y ESA.",
                   "datum_vertical": "EGM2008", "resolucion_arcsec": 1,
                   "exactitud_vertical_absoluta_le90_m_menor_que": 4,
                   "exactitud_vertical_relativa_le90_m_pendiente_hasta_20_pct_menor_que": 2,
                   "puntos_unicos": len(puntos), "interpolacion": "centro de píxel más cercano",
                   "teselas": fichas})
    print(f"GLO-30: {len(puntos)} coordenadas únicas en {len(fichas)} tesela(s).")


def meteorologia():
    referencia = EXTERNOS / FUENTES["meteo_t17"]
    original = leer_json(referencia)
    consulta = leer_json(referencia.with_suffix(".meta.json"))
    parametros = {k: v for k, v in consulta["parametros"].items() if k not in ("daily", "hourly")}
    parametros["hourly"] = "temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m"
    respuesta = requests.get(consulta["url"], params=parametros, timeout=45)
    respuesta.raise_for_status()
    datos = respuesta.json()
    if datos["hourly"]["time"] != original["hourly"]["time"]:
        raise ValueError("Desalineación horaria con T17.")
    coincide = {k: datos["hourly"][k] == original["hourly"][k] for k in ("temperature_2m", "wind_speed_10m")}
    meta = EXTERNOS / FUENTES["meteo_consumo_meta"]
    archivo = meta.with_name("open-meteo_roma_presion_viento.json")
    saneado = {k: datos[k] for k in ("latitude", "longitude", "elevation", "timezone", "hourly", "hourly_units")}
    archivo.write_text(json.dumps(saneado, ensure_ascii=False, separators=(",", ":")) + "\n",
                       encoding="utf-8", newline="\n")
    archivar(meta, {"fichero": archivo.name, "sha256": sha256(archivo.read_bytes()).hexdigest(),
                   "url": respuesta.url, "documentacion": "https://open-meteo.com/en/docs/historical-weather-api",
                   "fuente": "Open-Meteo Historical Weather API, best_match como en T17",
                   "licencia": "CC BY 4.0", "referencia_t17": referencia.name,
                   "coinciden_valores": coincide, "atribucion": "Open-Meteo y Copernicus Climate Change Service"})
    print(f"Meteorología: {len(datos['hourly']['time'])} horas; coincidencia con T17: {coincide}.")


if __name__ == "__main__":
    elevacion()
    meteorologia()
