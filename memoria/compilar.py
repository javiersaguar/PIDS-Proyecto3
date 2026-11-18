"""Compila la memoria: genera las cifras desde resultados/tablas y llama a latexmk.

Uso, desde la raíz del repositorio y con el .venv activado:

    python memoria/compilar.py

Deja el PDF en memoria/G<grupo>-P3.pdf (el grupo está en config.yaml, `entrega.grupo`) y los
ficheros intermedios en memoria/build/, que no se versiona. Necesita una distribución de
LaTeX con latexmk, pdflatex y biber (MiKTeX o TeX Live).
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from comun.config import cargar_config

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))
import generar_cifras  # noqa: E402


def main() -> None:
    generar_cifras.main()
    if shutil.which("latexmk") is None:
        sys.exit("No se encuentra latexmk: instala MiKTeX o TeX Live y añade su carpeta bin al PATH.")
    subprocess.run(["latexmk", "-pdf", "-interaction=nonstopmode", "-halt-on-error", "-outdir=build",
                    "memoria.tex"], cwd=RAIZ, check=True)
    destino = RAIZ / f"G{cargar_config()['entrega']['grupo']}-P3.pdf"
    shutil.copyfile(RAIZ / "build" / "memoria.pdf", destino)
    print(f"Memoria en {destino}")


if __name__ == "__main__":
    main()
