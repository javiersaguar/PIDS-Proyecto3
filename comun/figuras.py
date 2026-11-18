"""Estilo común y guardado de figuras (PDF para la memoria, PNG para las diapositivas)."""

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from comun.config import carpeta_figuras  # noqa: E402

TAMANO_MEDIA_PAGINA = (6.5, 4.0)

plt.rcParams.update({
    "figure.figsize": TAMANO_MEDIA_PAGINA,
    "font.size": 9,
    "axes.titlesize": 10,
    "axes.labelsize": 9,
    "legend.fontsize": 8,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.alpha": 0.3,
    "savefig.bbox": "tight",
    "pdf.fonttype": 42,
})


def guardar_figura(fig, tema: str, nombre: str) -> None:
    """Guarda resultados/figuras/<tema>/<nombre>.pdf y .png y cierra la figura."""
    carpeta = carpeta_figuras(tema)
    fig.savefig(carpeta / f"{nombre}.pdf", metadata={"CreationDate": None})
    fig.savefig(carpeta / f"{nombre}.png", dpi=200)
    plt.close(fig)
