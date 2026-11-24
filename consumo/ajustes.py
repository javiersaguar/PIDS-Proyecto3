"""Lectura de hipótesis del análisis y de las rutas de consumo."""

from functools import cache
from pathlib import Path

import yaml

from comun.config import cargar_config


@cache
def cargar_ajustes():
    with Path(__file__).with_name("config.yaml").open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def parametros_fisicos(escenario):
    f = cargar_ajustes()["modelo_b"]
    claves = ("gravedad_m_s2", "eta_traccion", "eta_transmision", "eta_descarga", "regeneracion")
    return {k: f[k] for k in claves} | f["escenarios"][escenario] | {
        "masa_kg": cargar_config()["patinete"]["masa_kg"] + f["masa_usuario_kg"],
    }
