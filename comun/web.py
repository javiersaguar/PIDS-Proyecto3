"""Exportación de los datos que dibuja la web de resultados (frontend/public/datos).

Cada gráfica de la web lee un JSON escrito aquí desde el notebook que hace el
análisis, así que la web enseña exactamente los mismos números que las tablas.
"""

import json
import math

import numpy as np
import pandas as pd

from comun.config import ruta


def _a_json(x):
    if isinstance(x, dict):
        return {str(k): _a_json(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_a_json(v) for v in x]
    if isinstance(x, np.ndarray):
        return [_a_json(v) for v in x.tolist()]
    if isinstance(x, pd.Series):
        return [_a_json(v) for v in x.tolist()]
    if isinstance(x, pd.DataFrame):
        return [_a_json(fila) for fila in x.to_dict(orient="records")]
    if x is None or x is pd.NA or x is pd.NaT:
        return None
    if isinstance(x, (bool, np.bool_)):
        return bool(x)
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        return None if math.isnan(x) or math.isinf(x) else float(x)
    if hasattr(x, "isoformat"):
        return x.isoformat()
    return x


def exportar(fase: str, nombre: str, datos) -> None:
    """Escribe frontend/public/datos/<fase>/<nombre>.json."""
    destino = ruta("web_datos") / fase / f"{nombre}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(_a_json(datos), ensure_ascii=False, separators=(",", ":")),
                       encoding="utf-8", newline="\n")
