"""Regenera todas las tablas y figuras desde el CSV original y los datos externos guardados.

Uso: python ejecutar_todo.py [--desde SCRIPT]

Los pasos se ejecutan en orden. Los que todavía no existen se indican como pendientes.
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

PASOS = [
    # Fase 0. Datos
    "exploracion/limpieza.py",
    "exploracion/recolocaciones.py",
    "exploracion/temporal.py",
    "exploracion/espacial.py",
    "exploracion/recorridos.py",
    "exploracion/energia_referencia.py",
    "exploracion/meteorologia.py",
    # Fase 1. Movilidad
    "movilidad/matrices_od.py",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--desde", help="empezar en este script, por ejemplo exploracion/espacial.py")
    args = parser.parse_args()

    pasos = PASOS[PASOS.index(args.desde):] if args.desde else PASOS
    inicio_total = time.perf_counter()
    for paso in pasos:
        if not (RAIZ / paso).exists():
            print(f"[pendiente] {paso}")
            continue
        print(f"[ejecutando] {paso}", flush=True)
        inicio = time.perf_counter()
        resultado = subprocess.run([sys.executable, paso], cwd=RAIZ)
        if resultado.returncode != 0:
            print(f"[error] {paso} terminó con código {resultado.returncode}")
            return resultado.returncode
        print(f"[hecho] {paso} en {time.perf_counter() - inicio:.1f} s")
    print(f"Todo regenerado en {time.perf_counter() - inicio_total:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
