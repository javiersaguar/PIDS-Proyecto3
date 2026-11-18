"""T12. Patrones temporales y viajes simultáneos.

Serie diaria, perfil horario por tipo de día, mapa de calor hora × día de la
semana, cuotas por franja horaria y viajes en curso minuto a minuto. Las cifras
que fijan parámetros (franjas, tipos de día, cota de flota) salen del periodo de
ajuste; la semana reservada se describe para compararla.

Uso: python exploracion/temporal.py
"""

import numpy as np
import pandas as pd

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.figuras import guardar_figura, plt

TEMA = "exploracion"
NOMBRES_FRANJA = {"madrugada": "madrugada", "punta_manana": "punta de mañana", "mediodia": "mediodía",
                  "punta_tarde": "punta de tarde", "noche": "noche"}
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
PARAMETROS = {"ventana_media_movil_dias": 7}


def anotar(viajes: pd.DataFrame) -> pd.DataFrame:
    v = viajes.copy()
    v["fecha"] = v["tsO"].dt.date
    v["hora"] = v["tsO"].dt.hour
    v["dia_semana"] = v["tsO"].dt.day_of_week
    v["tipo_dia"] = np.where(v["dia_semana"] >= 5, "fin_de_semana", "laborable")
    return v


def franja_de_hora(horas: pd.Series) -> pd.Series:
    franjas = cargar_config()["exploracion"]["franjas_horarias"]
    resultado = pd.Series(pd.NA, index=horas.index, dtype="string")
    for nombre, (h0, h1) in franjas.items():
        resultado[(horas >= h0) & (horas < h1)] = nombre
    return resultado


def viajes_en_curso(viajes: pd.DataFrame) -> pd.Series:
    """Viajes en curso al principio de cada minuto del mes."""
    inicio = viajes["tsO"].min().floor("D")
    fin = viajes["tsD"].max().ceil("D")
    minutos = pd.date_range(inicio, fin, freq="1min", inclusive="left")
    t = minutos.asi8
    salidas = np.sort(viajes["tsO"].astype("int64").to_numpy())
    llegadas = np.sort(viajes["tsD"].astype("int64").to_numpy())
    # En curso en t: ha salido en o antes de t y todavía no ha llegado.
    en_curso = np.searchsorted(salidas, t, side="right") - np.searchsorted(llegadas, t, side="right")
    return pd.Series(en_curso, index=minutos)


def main() -> None:
    tablas = carpeta_tablas(TEMA)
    franjas = cargar_config()["exploracion"]["franjas_horarias"]
    v = anotar(cargar_viajes())
    ajuste = v[v["periodo"] == "ajuste"]

    # Serie diaria
    diaria = v.groupby("fecha").agg(viajes=("trip_id", "size"), patinetes_activos=("idS", "nunique"),
                                    dia_semana=("dia_semana", "first"), tipo_dia=("tipo_dia", "first"),
                                    periodo=("periodo", "first"))
    diaria["dia_semana"] = diaria["dia_semana"].map(dict(enumerate(DIAS)))
    diaria["media_movil"] = diaria["viajes"].rolling(PARAMETROS["ventana_media_movil_dias"], center=True).mean().round(1)
    diaria.reset_index().to_csv(tablas / "T12_viajes_diarios.csv", index=False)

    # Perfil horario por tipo de día (viajes por hora y día, periodo de ajuste)
    dias_por_tipo = ajuste.groupby("tipo_dia")["fecha"].nunique()
    perfil = ajuste.groupby(["hora", "tipo_dia"]).size().unstack(fill_value=0).reindex(range(24), fill_value=0)
    perfil = perfil / dias_por_tipo
    cuotas = perfil / perfil.sum()
    tabla_perfil = pd.DataFrame({
        "hora": perfil.index,
        "franja": franja_de_hora(pd.Series(perfil.index)).to_numpy(),
        "laborable_viajes_dia": perfil["laborable"].round(2).to_numpy(),
        "fin_de_semana_viajes_dia": perfil["fin_de_semana"].round(2).to_numpy(),
        "laborable_cuota_pc": (100 * cuotas["laborable"]).round(2).to_numpy(),
        "fin_de_semana_cuota_pc": (100 * cuotas["fin_de_semana"]).round(2).to_numpy(),
    })
    tabla_perfil.to_csv(tablas / "T12_perfil_horario.csv", index=False)

    # Cuotas por franja
    por_franja = tabla_perfil.groupby("franja", sort=False)[
        ["laborable_viajes_dia", "fin_de_semana_viajes_dia", "laborable_cuota_pc", "fin_de_semana_cuota_pc"]
    ].sum().round(2)
    por_franja.insert(0, "horas", [f"{h0}-{h1}" for h0, h1 in franjas.values()])
    por_franja.reset_index().to_csv(tablas / "T12_franjas.csv", index=False)

    # Mapa de calor día de la semana × hora (viajes medios por hora)
    dias_por_semana = ajuste.groupby("dia_semana")["fecha"].nunique()
    calor = ajuste.groupby(["dia_semana", "hora"]).size().unstack(fill_value=0).reindex(columns=range(24), fill_value=0)
    calor = calor.div(dias_por_semana, axis=0)
    calor.index = [DIAS[d] for d in calor.index]
    calor.round(2).to_csv(tablas / "T12_calor_dia_hora.csv", index_label="dia_semana")

    # Viajes simultáneos
    en_curso = viajes_en_curso(v)
    serie = pd.DataFrame({"en_curso": en_curso})
    serie["fecha"] = serie.index.date
    simult = serie.groupby("fecha")["en_curso"].agg(maximo="max", media="mean")
    simult["hora_maximo"] = serie.groupby("fecha")["en_curso"].idxmax().dt.strftime("%H:%M")
    simult["media"] = simult["media"].round(2)
    simult = simult.join(diaria[["periodo", "patinetes_activos"]])
    simult.reset_index().to_csv(tablas / "T12_simultaneos_diarios.csv", index=False)

    en_ajuste = simult["periodo"] == "ajuste"
    dia_max = simult.loc[en_ajuste, "maximo"].idxmax()
    tipo = diaria.loc[en_ajuste.index[en_ajuste], "tipo_dia"]
    media_tipo = diaria[diaria["periodo"] == "ajuste"].groupby("tipo_dia")["viajes"].mean()
    dias_ajuste = np.arange(en_ajuste.sum())
    pendiente = np.polyfit(dias_ajuste, diaria.loc[diaria["periodo"] == "ajuste", "viajes"].to_numpy(), 1)[0]
    variacion_total = 0.5 * (cuotas["laborable"] - cuotas["fin_de_semana"]).abs().sum()

    resumen = pd.DataFrame([
        ("viajes_elegibles", len(v)),
        ("viajes_dia_media_ajuste", round(diaria.loc[diaria["periodo"] == "ajuste", "viajes"].mean(), 1)),
        ("viajes_dia_media_reservada", round(diaria.loc[diaria["periodo"] == "reservada", "viajes"].mean(), 1)),
        ("viajes_dia_laborable_ajuste", round(media_tipo["laborable"], 1)),
        ("viajes_dia_fin_de_semana_ajuste", round(media_tipo["fin_de_semana"], 1)),
        ("tendencia_ajuste_viajes_por_dia", round(pendiente, 2)),
        ("dia_minimo", str(diaria["viajes"].idxmin())),
        ("viajes_dia_minimo", int(diaria["viajes"].min())),
        ("hora_punta_laborable", int(perfil["laborable"].idxmax())),
        ("hora_punta_fin_de_semana", int(perfil["fin_de_semana"].idxmax())),
        ("diferencia_perfiles_laborable_finde_pc", round(100 * variacion_total, 1)),
        ("simultaneos_max_ajuste", int(simult.loc[en_ajuste, "maximo"].max())),
        ("simultaneos_max_ajuste_dia", str(dia_max)),
        ("simultaneos_max_ajuste_hora", simult.loc[dia_max, "hora_maximo"]),
        ("simultaneos_max_reservada", int(simult.loc[~en_ajuste, "maximo"].max())),
        ("simultaneos_p99_minutos_ajuste", float(np.percentile(serie.loc[serie["fecha"].map(en_ajuste), "en_curso"], 99))),
        ("patinetes_activos_dia_media_ajuste", round(simult.loc[en_ajuste, "patinetes_activos"].mean(), 1)),
        ("patinetes_activos_dia_max_ajuste", int(simult.loc[en_ajuste, "patinetes_activos"].max())),
        ("patinetes_mes", int(v["idS"].nunique())),
    ], columns=["indicador", "valor"])
    resumen.to_csv(tablas / "T12_resumen.csv", index=False)

    colores = {"laborable": "#4C72B0", "fin_de_semana": "#DD8452"}

    # Figura: serie diaria
    fig, eje = plt.subplots(figsize=(6.5, 3.0))
    x = pd.to_datetime(diaria.index)
    eje.bar(x, diaria["viajes"], color=[colores[t] for t in diaria["tipo_dia"]], width=0.8)
    eje.plot(x, diaria["media_movil"], color="0.2", lw=1.2, label="Media móvil de 7 días")
    corte = pd.Timestamp(cargar_config()["datos"]["periodos"]["reservada"][0]) - pd.Timedelta(hours=12)
    eje.axvline(corte, color="0.3", ls=":", lw=1)
    eje.text(corte, eje.get_ylim()[1] * 0.97, " semana reservada", fontsize=8, va="top")
    eje.set_ylabel("Viajes elegibles por día")
    asas = [plt.matplotlib.patches.Patch(color=colores["laborable"], label="Laborable"),
            plt.matplotlib.patches.Patch(color=colores["fin_de_semana"], label="Fin de semana"),
            *eje.get_legend_handles_labels()[0]]
    eje.legend(handles=asas, loc="lower right", ncols=3)
    eje.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter("%d/%m"))
    eje.set_title("Viajes diarios, febrero de 2021")
    guardar_figura(fig, TEMA, "T12_serie_diaria")

    # Figura: perfil horario con franjas
    fig, eje = plt.subplots(figsize=(6.5, 3.0))
    for i, (nombre, (h0, h1)) in enumerate(franjas.items()):
        eje.axvspan(h0, h1, color="0.92" if i % 2 else "white", zorder=0)
        eje.text((h0 + h1) / 2, 1.0, NOMBRES_FRANJA.get(nombre, nombre), transform=eje.get_xaxis_transform(),
                 ha="center", va="bottom", fontsize=7)
    for t in ("laborable", "fin_de_semana"):
        eje.step(range(25), list(perfil[t]) + [perfil[t].iloc[-1]], where="post", color=colores[t],
                 label=t.replace("_", " ").capitalize())
    eje.set_xlim(0, 24)
    eje.set_xticks(range(0, 25, 2))
    eje.set_xlabel("Hora de salida")
    eje.set_ylabel("Viajes por hora y día")
    eje.legend(loc="upper left")
    eje.set_title("Perfil horario medio, periodo de ajuste (1–21/02)", pad=14)
    guardar_figura(fig, TEMA, "T12_perfil_horario")

    # Figura: mapa de calor
    fig, eje = plt.subplots(figsize=(6.5, 2.6))
    im = eje.imshow(calor.to_numpy(), aspect="auto", cmap="viridis")
    eje.set_yticks(range(len(calor.index)), calor.index)
    eje.set_xticks(range(0, 24, 2))
    eje.set_xlabel("Hora de salida")
    eje.grid(False)
    fig.colorbar(im, ax=eje, label="Viajes por hora")
    eje.set_title("Viajes medios por hora y día de la semana, periodo de ajuste")
    guardar_figura(fig, TEMA, "T12_calor_dia_hora")

    # Figura: simultáneos
    fig, (a, b) = plt.subplots(1, 2, figsize=(6.5, 2.8), gridspec_kw={"width_ratios": [1.2, 1]})
    dia = serie[serie["fecha"] == dia_max]["en_curso"]
    a.plot(dia.index.hour + dia.index.minute / 60, dia.to_numpy(), color="#4C72B0", lw=0.8)
    a.set_xlim(0, 24)
    a.set_xticks(range(0, 25, 4))
    a.set_xlabel("Hora")
    a.set_ylabel("Viajes en curso")
    a.set_title(f"Día con el máximo del ajuste ({pd.Timestamp(dia_max):%d/%m})", fontsize=9)
    b.bar(pd.to_datetime(simult.index), simult["maximo"],
          color=[colores[t] for t in diaria.loc[simult.index, "tipo_dia"]])
    b.axvline(corte, color="0.3", ls=":", lw=1)
    b.xaxis.set_major_locator(plt.matplotlib.dates.DayLocator(bymonthday=[1, 8, 15, 22]))
    b.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter("%d/%m"))
    b.set_ylabel("Máximo diario")
    b.set_title("Máximo diario de viajes en curso", fontsize=9)
    fig.tight_layout()
    guardar_figura(fig, TEMA, "T12_simultaneos")

    print(resumen.to_string(index=False))
    print()
    print(por_franja.to_string())


if __name__ == "__main__":
    main()
