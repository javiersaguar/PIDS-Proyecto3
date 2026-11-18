"""Lectura de config.yaml y rutas del proyecto."""

from functools import cache
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[1]


@cache
def cargar_config() -> dict:
    """Devuelve el contenido de config.yaml. No modificar el diccionario devuelto."""
    with open(RAIZ / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def ruta(clave: str) -> Path:
    """Ruta absoluta de una entrada de `rutas` en config.yaml."""
    return RAIZ / cargar_config()["rutas"][clave]


def carpeta_tablas(tema: str) -> Path:
    """Carpeta resultados/tablas/<tema>, creada si no existe."""
    carpeta = ruta("tablas") / tema
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


def carpeta_figuras(tema: str) -> Path:
    """Carpeta resultados/figuras/<tema>, creada si no existe."""
    carpeta = ruta("figuras") / tema
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta
