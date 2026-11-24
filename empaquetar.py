"""Prepara el ZIP de entrega a partir de una revisión confirmada del repositorio."""

import argparse
import re
import shutil
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

import yaml


RAIZ = Path(__file__).resolve().parent
EXCLUIDOS = {".github", ".gitignore", ".gitattributes", "AGENTS.md", "CLAUDE.md"}


def copiar(origen, destino, miembro, nombre):
    entrada = ZipInfo(nombre, miembro.date_time)
    entrada.compress_type = ZIP_DEFLATED
    entrada.external_attr = miembro.external_attr
    with origen.open(miembro) as lectura, destino.open(entrada, "w") as escritura:
        shutil.copyfileobj(lectura, escritura)


def empaquetar(destino):
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=RAIZ, text=True).strip()
    with TemporaryFile() as instantanea:
        subprocess.run(["git", "archive", "--format=zip", revision], cwd=RAIZ, stdout=instantanea, check=True)
        instantanea.seek(0)
        with ZipFile(instantanea) as fuente:
            cfg = yaml.safe_load(fuente.read("config.yaml"))
            grupo = str(cfg["entrega"]["grupo"])
            if not re.fullmatch(r"[0-9]{2}", grupo):
                raise ValueError("El número de grupo debe tener dos dígitos.")
            base = f"G{grupo}-P3"
            pdf = fuente.getinfo(f"memoria/{base}.pdf")
            prefijo = f"{base}_code/"
            destino.mkdir(parents=True, exist_ok=True)
            salida = destino / f"{base}.zip"
            with NamedTemporaryFile(dir=destino, suffix=".tmp", delete=False) as f:
                temporal = Path(f.name)
            try:
                with ZipFile(temporal, "w") as archivo:
                    copiar(fuente, archivo, pdf, f"{base}.pdf")
                    for miembro in fuente.infolist():
                        nombre = miembro.filename
                        if miembro.is_dir() or nombre == pdf.filename or nombre.split("/")[0] in EXCLUIDOS:
                            continue
                        copiar(fuente, archivo, miembro, prefijo + nombre)
                with ZipFile(temporal) as archivo:
                    defectuoso = archivo.testzip()
                    if defectuoso:
                        raise ValueError(f"Falló la verificación ZIP de {defectuoso}.")
                temporal.replace(salida)
            finally:
                temporal.unlink(missing_ok=True)
    return salida, revision


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destino", type=Path, default=RAIZ / "build" / "entrega",
                        help="directorio donde guardar el ZIP")
    args = parser.parse_args()
    salida, revision = empaquetar(args.destino.resolve())
    print(f"{salida} · revisión {revision[:12]}")


if __name__ == "__main__":
    main()
