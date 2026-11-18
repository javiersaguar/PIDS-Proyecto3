"""T20. Primera matriz origen-destino en rejilla H3.

Viajes elegibles del periodo de ajuste agregados por celda de origen y de destino:
tabla larga, mapa de calor de las celdas con más viajes, proporción intrazonal, pares
principales y asimetría M − Mᵀ.

Uso: python movilidad/matrices_od.py
"""

import h3
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap, LogNorm
from matplotlib.ticker import FuncFormatter
from scipy.stats import binom

from comun.config import carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt

TEMA = "movilidad"

PARAMETROS = {
    "res": 8,
    "celdas_mapa_calor": 30,
    "pares_top": 20,
    "pares_asimetria_top": 10,
}

TITULO_AJUSTE = "viajes elegibles del periodo de ajuste (1–21/02/2021)"
CMAP_SECUENCIAL = LinearSegmentedColormap.from_list(
    "azules", ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])
CMAP_SECUENCIAL.set_bad("#f0efec")


def guardar_tabla(df: pd.DataFrame, nombre: str) -> None:
    df.to_csv(carpeta_tablas(TEMA) / f"{nombre}.csv", index=False, lineterminator="\n")


def tabla_resumen(resumen: dict) -> pd.DataFrame:
    valores = [round(float(x), 4) if isinstance(x, (float, np.floating)) else int(x) for x in resumen.values()]
    return pd.DataFrame({"indicador": list(resumen), "valor": pd.Series(valores, dtype=object)})


def celda(lat: pd.Series, lon: pd.Series, res: int) -> pd.Series:
    return pd.Series([h3.latlng_to_cell(a, b, res) for a, b in zip(lat, lon)], index=lat.index, dtype="string")


def matriz_larga(viajes: pd.DataFrame, res: int) -> pd.DataFrame:
    od = pd.DataFrame({"h3_o": celda(viajes["latO"], viajes["lonO"], res),
                       "h3_d": celda(viajes["latD"], viajes["lonD"], res)})
    t = od.groupby(["h3_o", "h3_d"]).size().rename("viajes").reset_index()
    t = t.sort_values(["viajes", "h3_o", "h3_d"], ascending=[False, True, True], ignore_index=True)
    assert t["viajes"].sum() == len(viajes)
    return t


def orden_celdas(od: pd.DataFrame) -> pd.DataFrame:
    """Celdas ordenadas por orígenes + destinos, con su rango y su centro."""
    o = od.groupby("h3_o")["viajes"].sum().rename("origenes")
    d = od.groupby("h3_d")["viajes"].sum().rename("destinos")
    t = pd.concat([o, d], axis=1).fillna(0).astype("int64")
    t.index.name = "h3"
    t["extremos"] = t["origenes"] + t["destinos"]
    t = t.reset_index().sort_values(["extremos", "h3"], ascending=[False, True], ignore_index=True)
    t.insert(0, "rango", np.arange(1, len(t) + 1))
    centros = np.array([h3.cell_to_latlng(c) for c in t["h3"]])
    t["lat"], t["lon"] = centros[:, 0].round(6), centros[:, 1].round(6)
    return t


def mapa_calor(od: pd.DataFrame, celdas: pd.DataFrame) -> float:
    n = PARAMETROS["celdas_mapa_calor"]
    top = celdas.head(n)
    guardar_tabla(top, f"T20_celdas_top{n}")
    m = (od[od["h3_o"].isin(top["h3"]) & od["h3_d"].isin(top["h3"])]
         .pivot(index="h3_o", columns="h3_d", values="viajes")
         .reindex(index=top["h3"], columns=top["h3"]))
    valores = np.ma.masked_invalid(m.to_numpy(dtype=float))
    pct_cubierto = 100 * np.nansum(m.to_numpy(dtype=float)) / od["viajes"].sum()

    fig, ax = plt.subplots(figsize=(6.5, 5.4))
    im = ax.imshow(valores, cmap=CMAP_SECUENCIAL, norm=LogNorm(vmin=1, vmax=np.nanmax(m.to_numpy(dtype=float))),
                   interpolation="nearest")
    marcas = [0] + list(range(4, n, 5))
    ax.set_xticks(marcas)
    ax.set_yticks(marcas)
    ax.set_xticklabels([str(i + 1) for i in marcas])
    ax.set_yticklabels([str(i + 1) for i in marcas])
    ax.grid(False)
    ax.set_xlabel("Celda de destino (rango por orígenes + destinos)")
    ax.set_ylabel("Celda de origen (mismo orden)")
    barra = fig.colorbar(im, ax=ax, shrink=0.85, pad=0.02)
    barra.ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    barra.set_label("Viajes (escala log.; gris: ninguno)")
    ax.set_title(f"Matriz O-D entre las {n} celdas H3 de res. {PARAMETROS['res']} con más extremos "
                 f"({pct_cubierto:.0f} % de los viajes),\n{TITULO_AJUSTE}. Rangos en T20_celdas_top{n}",
                 fontsize=9)
    guardar_figura(fig, TEMA, f"T20_od_top{n}")
    return pct_cubierto


def asimetria(od: pd.DataFrame, celdas: pd.DataFrame) -> dict:
    """Asimetría de los pares entre celdas distintas, comparada con la esperable por azar.

    Para un par {i, j} con n viajes en total, si ambos sentidos fueran igual de
    probables |M_ij − M_ji| tendría la media de |2X − n| con X ~ Bin(n, 1/2).
    """
    inter = od[od["h3_o"] != od["h3_d"]]
    a = inter.rename(columns={"viajes": "ij"})
    b = inter.rename(columns={"h3_o": "h3_d", "h3_d": "h3_o", "viajes": "ji"})
    pares = a.merge(b, on=["h3_o", "h3_d"], how="outer").fillna({"ij": 0, "ji": 0})
    pares = pares[pares["h3_o"] < pares["h3_d"]].copy()
    pares[["ij", "ji"]] = pares[["ij", "ji"]].astype("int64")
    pares["total"] = pares["ij"] + pares["ji"]
    pares["neto_ij_menos_ji"] = pares["ij"] - pares["ji"]
    pares["abs_neto"] = pares["neto_ij_menos_ji"].abs()

    esperado = 0.0
    for n_par, veces in pares["total"].value_counts().items():
        k = np.arange(n_par + 1)
        esperado += veces * float(np.sum(np.abs(2 * k - n_par) * binom.pmf(k, n_par, 0.5)))

    top = (pares.sort_values(["abs_neto", "total", "h3_o", "h3_d"], ascending=[False, False, True, True])
           .head(PARAMETROS["pares_asimetria_top"]))
    rango = celdas.set_index("h3")["rango"]
    top = top.assign(rango_o=top["h3_o"].map(rango), rango_d=top["h3_d"].map(rango))
    guardar_tabla(top[["h3_o", "h3_d", "rango_o", "rango_d", "ij", "ji", "total", "neto_ij_menos_ji"]],
                  f"T20_asimetria_pares_top{PARAMETROS['pares_asimetria_top']}")

    # Comprobación: la suma por filas de M − Mᵀ es el saldo orígenes − destinos de cada celda.
    neto = (od.groupby("h3_o")["viajes"].sum().sub(od.groupby("h3_d")["viajes"].sum(), fill_value=0))
    saldo = celdas.set_index("h3")["origenes"] - celdas.set_index("h3")["destinos"]
    assert (neto.reindex(saldo.index) == saldo).all()

    viajes_inter = int(pares["total"].sum())
    return {
        "pares_entre_celdas_con_viajes": len(pares),
        "suma_abs_asimetria_pares": int(pares["abs_neto"].sum()),
        "indice_asimetria": pares["abs_neto"].sum() / viajes_inter,
        "indice_asimetria_esperado_azar": esperado / viajes_inter,
        "cociente_asimetria_observada_esperada": pares["abs_neto"].sum() / esperado,
        "max_abs_asimetria_par": int(pares["abs_neto"].max()),
    }


def main() -> None:
    viajes = cargar_viajes(periodo="ajuste")
    res = PARAMETROS["res"]
    od = matriz_larga(viajes, res)
    guardar_tabla(od, f"T20_od_res{res}")
    celdas = orden_celdas(od)
    pct_top = mapa_calor(od, celdas)

    intra = od["h3_o"] == od["h3_d"]
    rango = celdas.set_index("h3")["rango"]
    for nombre, sub in [("", od), ("_entre_celdas", od[~intra])]:
        top = sub.head(PARAMETROS["pares_top"]).copy()
        top["intrazonal"] = top["h3_o"] == top["h3_d"]
        top["rango_o"] = top["h3_o"].map(rango)
        top["rango_d"] = top["h3_d"].map(rango)
        top["pct_viajes"] = (100 * top["viajes"] / len(viajes)).round(2)
        guardar_tabla(top, f"T20_pares_top{PARAMETROS['pares_top']}{nombre}")

    resumen = {
        "res": res,
        "viajes": len(viajes),
        "celdas_origen": int(od["h3_o"].nunique()),
        "celdas_destino": int(od["h3_d"].nunique()),
        "pares_con_viajes": len(od),
        "pares_posibles": int(od["h3_o"].nunique() * od["h3_d"].nunique()),
        "viajes_intrazonales": int(od.loc[intra, "viajes"].sum()),
        "pct_viajes_intrazonales": 100 * od.loc[intra, "viajes"].sum() / len(viajes),
        "pct_viajes_top20_pares": 100 * od.head(PARAMETROS["pares_top"])["viajes"].sum() / len(viajes),
        f"pct_viajes_entre_top{PARAMETROS['celdas_mapa_calor']}_celdas": pct_top,
        **asimetria(od, celdas),
    }
    guardar_tabla(tabla_resumen(resumen), "T20_resumen")

    tablas = carpeta_tablas(TEMA)
    for nombre in ["T20_resumen", f"T20_pares_top{PARAMETROS['pares_top']}_entre_celdas",
                   f"T20_asimetria_pares_top{PARAMETROS['pares_asimetria_top']}"]:
        print(f"\n{nombre}\n" + pd.read_csv(tablas / f"{nombre}.csv").to_string(index=False))


if __name__ == "__main__":
    main()
