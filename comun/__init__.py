"""Código compartido por todas las fases: configuración, carga de datos y geometría."""

import sys

# Salida en UTF-8 aunque la consola o la tubería usen otra codificación, para que
# los textos con tildes o símbolos no hagan fallar los scripts en Windows.
for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")
