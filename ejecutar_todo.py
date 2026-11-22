"""Regenera todas las tablas, figuras y datos de la web desde el CSV original y los datos externos guardados.

Uso: python ejecutar_todo.py [--desde PASO]

Los pasos se ejecutan en orden. Los notebooks se ejecutan de principio a fin y se guardan
con sus salidas; los scripts se lanzan con el mismo Python. Los que todavía no existen se
indican como pendientes.
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

PASOS = [
    # Fase 0. Datos
    "exploracion/T10_limpieza.ipynb",
    "exploracion/T11_recolocaciones.ipynb",
    "exploracion/T12_temporal.ipynb",
    "exploracion/T13_densidad.ipynb",
    "exploracion/T14_saldo.ipynb",
    "exploracion/T15_recorridos.ipynb",
    "exploracion/T16_energia_referencia.ipynb",
    "exploracion/T17_meteorologia.ipynb",
    "exploracion/T18_tarifa_ingresos.ipynb",
    # Fase 1. Movilidad
    "movilidad/T20_matrices_od.ipynb",
    "movilidad/T21_matrices_od_administrativas.ipynb",
    "movilidad/T22_matrices_od_temporales.ipynb",
    "movilidad/T23_indicadores_lineas_deseo.ipynb",
    "movilidad/T24_candidatos_estacion.ipynb",
    "movilidad/T25_linea_base_localizacion.ipynb",
    "movilidad/T26_cobertura_parcial.ipynb",
    "movilidad/T27_pmediana_mclp.ipynb",
    "movilidad/T28_pareto_eleccion.ipynb",
    "movilidad/T29_rutas_peatonales.ipynb",
    "movilidad/T30_validacion_temporal.ipynb",
    "movilidad/T36_capas_mapa.ipynb",
]


def ejecutar_notebook(ruta: Path) -> int:
    """Ejecuta el notebook con el Python de este entorno y lo guarda con las salidas."""
    import nbformat
    from ipykernel.kernelspec import get_kernel_dict
    from jupyter_client.kernelspec import KernelSpec, KernelSpecManager
    from jupyter_client.manager import KernelManager
    from nbclient import NotebookClient
    from nbclient.exceptions import CellExecutionError

    class EsteEntorno(KernelSpecManager):
        # Evita que un kernel «python3» instalado fuera del proyecto ejecute los notebooks.
        def get_kernel_spec(self, kernel_name):
            return KernelSpec(resource_dir="", **get_kernel_dict())

    nb = nbformat.read(ruta, as_version=4)
    km = KernelManager(kernel_spec_manager=EsteEntorno())
    # Sin tiempos de ejecución en los metadatos, para que dos ejecuciones den el mismo fichero.
    cliente = NotebookClient(nb, km=km, timeout=1800, record_timing=False,
                             resources={"metadata": {"path": str(ruta.parent)}})
    try:
        cliente.execute()
    except CellExecutionError as error:
        print(error)
        return 1
    finally:
        nbformat.write(nb, ruta)
        if km.has_kernel:
            km.shutdown_kernel(now=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--desde", help="empezar en este paso, por ejemplo exploracion/T13_densidad.ipynb")
    args = parser.parse_args()

    if sys.platform == "win32":
        import asyncio

        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    pasos = PASOS[PASOS.index(args.desde):] if args.desde else PASOS
    inicio_total = time.perf_counter()
    for paso in pasos:
        ruta = RAIZ / paso
        if not ruta.exists():
            print(f"[pendiente] {paso}")
            continue
        print(f"[ejecutando] {paso}", flush=True)
        inicio = time.perf_counter()
        if ruta.suffix == ".ipynb":
            codigo = ejecutar_notebook(ruta)
        else:
            codigo = subprocess.run([sys.executable, paso], cwd=RAIZ).returncode
        if codigo != 0:
            print(f"[error] {paso} terminó con código {codigo}")
            return codigo
        print(f"[hecho] {paso} en {time.perf_counter() - inicio:.1f} s")
    print(f"Todo regenerado en {time.perf_counter() - inicio_total:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
