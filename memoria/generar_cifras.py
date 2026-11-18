"""Genera memoria/generado/: las cifras y tablas que cita la memoria, leídas de resultados/tablas.

La memoria no escribe ningún número a mano: usa \\cifra{clave} y \\input de las tablas de
este script. Así, después de `python ejecutar_todo.py`, basta con volver a compilar para que
la memoria cuente lo mismo que los notebooks.

Uso: python memoria/generar_cifras.py (lo llama memoria/compilar.py).
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import pandas as pd

from comun.config import cargar_config, ruta

RAIZ = Path(__file__).resolve().parent
SALIDA = RAIZ / "generado"
TABLAS = ruta("tablas")


# --- Formato español: coma decimal y espacio fino de millares ---------------------------

def num(x: float, decimales: int = 0) -> str:
    """Número con coma decimal y espacio fino (\\,) cada tres cifras a partir de 1 000."""
    # Redondeo a la mitad hacia arriba sobre el valor escrito en la tabla (0,745 -> 0,75),
    # igual que se lee en los CSV y en docs/conclusiones_eda.md.
    x = float(Decimal(repr(float(x))).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP))
    texto = f"{abs(x):,.{decimales}f}".replace(",", " ").replace(".", ",").replace(" ", "\\,")
    return ("\\textminus{}" if x < 0 and float(texto.replace("\\,", "").replace(",", ".")) != 0 else "") + texto


def leer(nombre: str) -> pd.DataFrame:
    return pd.read_csv(TABLAS / nombre)


def indicadores(nombre: str) -> dict[str, float | str]:
    t = leer(nombre)
    salida = {}
    for k, v in zip(t["indicador"], t["valor"]):
        try:
            salida[k] = float(v)
        except ValueError:
            salida[k] = v
    return salida


def fila(t: pd.DataFrame, **filtro) -> pd.Series:
    m = pd.Series(True, index=t.index)
    for k, v in filtro.items():
        m &= t[k] == v
    assert m.sum() == 1, filtro
    return t[m].iloc[0]


# --- Cifras ------------------------------------------------------------------------------

def cifras() -> dict[str, str]:
    c: dict[str, str] = {}
    cfg = cargar_config()
    c["grupo"] = str(cfg["entrega"]["grupo"])
    mov = cfg["movilidad"]
    sens = [num(x) for x in mov["rebalanceo_sensibilidad_patinetes_dia"] if x != mov["rebalanceo_base_patinetes_dia"]]
    c |= {"rebalanceo_base": num(mov["rebalanceo_base_patinetes_dia"]), "rebalanceo_sensibilidad": " y ".join(sens)}

    # T10. Limpieza.
    embudo = leer("exploracion/T10_embudo.csv")
    brutos, elegibles = int(embudo["quedan"].iloc[0]), int(embudo["quedan"].iloc[-1])
    comp = leer("exploracion/T10_comparacion_limpiezas.csv")
    p_aj, p_res = fila(comp, limpieza="principal", periodo="ajuste"), fila(comp, limpieza="principal", periodo="reservada")
    perm = comp[comp["limpieza"] == "permisiva"]["viajes_elegibles"].sum()
    c |= {
        "viajes_brutos": num(brutos), "viajes_elegibles": num(elegibles),
        "pct_elegibles": num(100 * elegibles / brutos, 1),
        "viajes_ajuste": num(p_aj["viajes_elegibles"]), "viajes_reservada": num(p_res["viajes_elegibles"]),
        "excluidos_umbral": num(brutos - elegibles),
        "permisiva_mas_pct": num(100 * (perm / elegibles - 1), 1),
        "concentracion_20pc_res8": num(p_aj["extremos_en_20pc_celdas_pc"], 1),
        "km_ajuste": num(p_aj["km_totales"]),
    }

    # T11. Recolocaciones.
    t11 = indicadores("exploracion/T11_resumen.csv")
    c |= {
        "patinetes": num(t11["patinetes"]), "encadenamientos": num(t11["encadenamientos"]),
        "salto_mediana_m": num(t11["salto_m_mediana"], 1), "recolocaciones": num(t11["recolocaciones"]),
        "recolocaciones_dia": num(t11["recolocaciones_por_dia_media"], 1),
        "recolocacion_km": num(t11["recolocacion_salto_km_mediana"], 2),
        "parado_recolocado_h": num(t11["recolocacion_parado_h_mediana"], 1),
        "parado_sin_salto_h": num(t11["sin_salto_parado_h_mediana"], 1),
        "recolocaciones_noche_pct": num(t11["recolocaciones_con_noche_pc"], 1),
        "recolocaciones_intradia_pct": num(t11["recolocaciones_intradia_pc"], 1),
        "patinetes_recolocados": num(t11["patinetes_recolocados"]),
    }

    # T12. Patrones temporales.
    t12 = indicadores("exploracion/T12_resumen.csv")
    franjas = leer("exploracion/T12_franjas.csv").set_index("franja")
    c |= {
        "viajes_dia_ajuste": num(t12["viajes_dia_media_ajuste"], 1),
        "viajes_dia_reservada": num(t12["viajes_dia_media_reservada"], 1),
        "viajes_dia_laborable": num(t12["viajes_dia_laborable_ajuste"], 1),
        "viajes_dia_finde": num(t12["viajes_dia_fin_de_semana_ajuste"], 1),
        "punta_manana_lab_pct": num(franjas.loc["punta_manana", "laborable_cuota_pc"], 1),
        "punta_manana_finde_pct": num(franjas.loc["punta_manana", "fin_de_semana_cuota_pc"], 1),
        "punta_tarde_lab_pct": num(franjas.loc["punta_tarde", "laborable_cuota_pc"], 1),
        "punta_tarde_finde_pct": num(franjas.loc["punta_tarde", "fin_de_semana_cuota_pc"], 1),
        "diferencia_perfiles_pct": num(t12["diferencia_perfiles_laborable_finde_pc"], 1),
        "simultaneos_max": num(t12["simultaneos_max_ajuste"]),
        "patinetes_activos_dia": num(t12["patinetes_activos_dia_media_ajuste"], 1),
        "patinetes_elegibles": num(t12["patinetes_mes"]),
    }

    # T13. Densidad.
    res = leer("exploracion/T13_resoluciones_h3.csv").set_index("res")
    conc = leer("exploracion/T13_concentracion.csv").set_index("res")
    est = leer("exploracion/T13_estabilidad.csv").set_index("res")
    c |= {
        "arista_res8_m": num(res.loc[8, "arista_media_m"]), "arista_res9_m": num(res.loc[9, "arista_media_m"]),
        "celdas_res8": num(res.loc[8, "celdas_con_demanda"]), "celdas_res9": num(res.loc[9, "celdas_con_demanda"]),
        "celdas_res9_80": num(conc.loc[9, "celdas_80pct"]), "celdas_res9_95": num(conc.loc[9, "celdas_95pct"]),
        "concentracion_20pc_res9": num(conc.loc[9, "pct_extremos_top20pct_celdas"], 1),
        "estabilidad_res8": num(est.loc[8, "spearman_cuotas"], 2),
        "estabilidad_res9": num(est.loc[9, "spearman_cuotas"], 2),
    }

    # T14. Saldo.
    t14 = indicadores("exploracion/T14_resumen.csv")
    c |= {
        "celdas_saldo": num(t14["celdas_incluidas"]), "celdas_emisoras": num(t14["celdas_emisoras"]),
        "celdas_receptoras": num(t14["celdas_receptoras"]),
        "rebalanceo_res8": num(t14["cota_rebalanceo_res8_media_patinetes_dia"], 1),
        "rebalanceo_res8_max": num(t14["cota_rebalanceo_res8_max_patinetes_dia"]),
        "rebalanceo_res9": num(t14["cota_rebalanceo_res9_media_patinetes_dia"], 1),
        "rebalanceo_estructural_res8": num(t14["desplazamiento_estructural_res8_patinetes_dia"], 1),
        "operador_spearman": num(t14["operador_spearman_saldo_neto_entregas"], 2),
        "operador_pendiente": num(t14["operador_pendiente_neto_entregas_sobre_saldo"], 2),
        "operador_compensado_pct": num(t14["operador_pct_saldo_compensado"], 1),
    }

    # T15. Recorridos.
    t15 = indicadores("exploracion/T15_resumen.csv")
    dist = leer("exploracion/T15_distribuciones.csv").set_index("variable")
    c |= {
        "rodeo": num(t15["rodeo_mediana"], 3), "circulares_pct": num(t15["pct_viajes_circulares"], 2),
        "velocidad_pie": num(t15["velocidad_pie_ms"], 1),
        "dis_mediana_m": num(dist.loc["dis_m", "p50"]), "tt_mediana_min": num(dist.loc["tt_s", "p50"] / 60, 1),
        "vel_mediana": num(dist.loc["vel_kmh", "p50"], 1),
    }

    # T16. Energía de referencia.
    t16 = indicadores("exploracion/T16_resumen.csv")
    t16p = indicadores("exploracion/T16_patinete_resumen.csv")
    c |= {
        "flota_kwh_dia": num(t16["flota_kwh_dia_media_ajuste"], 1),
        "flota_kwh_dia_max": num(t16["flota_kwh_dia_max_ajuste"], 1),
        "flota_kwh_dia_reservada": num(t16["flota_kwh_dia_media_reservada"], 1),
        "flota_cargas_dia": num(t16["flota_cargas_dia_media_ajuste"], 1),
        "celda_kwh_max": num(t16["celda_kwh_dia_max"], 2), "celda_kwh_p50": num(t16["celda_kwh_dia_p50"], 2),
        "energia_sol_pct": num(t16["pct_energia_llega_10_16h"], 1),
        "energia_tarde_pct": num(t16["pct_energia_llega_16_24h"], 1),
        "autonomia_mediana_dias": num(t16p["dias_autonomia_estimada_p50"], 1),
    }

    # T17. Meteorología.
    t17 = indicadores("exploracion/T17_resumen.csv")
    corr = leer("exploracion/T17_correlaciones.csv")
    lluvia = leer("exploracion/T17_lluvia_horaria_resumen.csv").set_index("grupo")
    tend = leer("exploracion/T17_tendencia.csv")
    vd = leer("exploracion/T17_viento_diario.csv")
    vh = leer("exploracion/T17_viento_horario.csv")
    vs = leer("exploracion/T17_viento_horas_secas.csv").set_index("tipo_dia")
    serie = leer("exploracion/T17_serie_diaria.csv").set_index("fecha")
    fds_v = fila(vd, variable="viento_max_kmh", grupo="fin_de_semana")
    viento = lambda tipo, modelo: fila(vh, tipo_dia=tipo, modelo=modelo, efecto="+10 km/h de viento")
    c |= {
        "lluvia_ajuste_mm": num(t17["lluvia_total_ajuste_mm"], 1),
        "dias_lluvia": num(t17["dias_lluvia_mayor_1mm_ajuste"]),
        "temp_ajuste": num(t17["temperatura_media_ajuste_c"], 1),
        "temp_reservada": num(t17["temperatura_media_reservada_c"], 1),
        "reservada_mas_pct": num(100 * (t17["viajes_dia_media_reservada"] / t17["viajes_dia_media_ajuste"] - 1), 1),
        "rho_lluvia": num(fila(corr, variable="precipitacion_mm", grupo="todos")["spearman_rho"], 2),
        "rho_lluvia_finde": num(fila(corr, variable="precipitacion_mm", grupo="fin_de_semana")["spearman_rho"], 2),
        "cociente_lluvia": num(100 * lluvia.loc["todos", "cociente_agregado"]),
        "cociente_lluvia_lab": num(100 * lluvia.loc["laborable", "cociente_agregado"]),
        "cociente_lluvia_finde": num(100 * lluvia.loc["fin_de_semana", "cociente_agregado"]),
        "viajes_0702": num(serie.loc["2021-02-07", "viajes"]),
        "pct_mediana_0702": num(serie.loc["2021-02-07", "pct_mediana_tipo_dia"], 1),
        "lluvia_0702": num(serie.loc["2021-02-07", "precipitacion_mm"], 1),
        "viajes_1402": num(serie.loc["2021-02-14", "viajes"]),
        "pendiente_ajuste": num(fila(tend, modelo="tendencia", periodo="ajuste")["pendiente_viajes_dia_por_dia"], 1),
        "pendiente_mes": num(fila(tend, modelo="tendencia + fin_de_semana", periodo="mes")["pendiente_viajes_dia_por_dia"], 1),
        "pendiente_mes_tiempo": num(fila(tend, modelo="tendencia + fin_de_semana + lluvia + temperatura",
                                         periodo="mes")["pendiente_viajes_dia_por_dia"], 1),
        "viento_max_ajuste": num(t17["viento_max_medio_ajuste_kmh"], 1),
        "viento_max_reservada": num(t17["viento_max_medio_reservada_kmh"], 1),
        "rho_viento_finde": num(fds_v["rho_viajes"], 2), "rho_viento_lluvia_finde": num(fds_v["rho_con_lluvia"], 2),
        "rho_viento_parcial_finde": num(fds_v["rho_parcial_sin_lluvia"], 2),
        "rho_lluvia_parcial_finde": num(fds_v["rho_lluvia_parcial_sin_viento"], 2),
        "viento_finde_pct": num(-viento("fin_de_semana", "entre_dias")["pct"]),
        "viento_finde_inf": num(viento("fin_de_semana", "entre_dias")["pct_inf"]),
        "viento_finde_sup": num(viento("fin_de_semana", "entre_dias")["pct_sup"]),
        "viento_lab_pct": num(-viento("laborable", "entre_dias")["pct"]),
        "viento_secas_finde": num(100 * vs.loc["fin_de_semana", "cociente"]),
    }

    # T20. Matriz OD.
    t20 = indicadores("movilidad/T20_resumen.csv")
    c |= {
        "od_pares": num(t20["pares_con_viajes"]), "od_intrazonales_pct": num(t20["pct_viajes_intrazonales"], 1),
        "od_top20_pct": num(t20["pct_viajes_top20_pares"], 1), "od_top30_pct": num(t20["pct_viajes_entre_top30_celdas"], 1),
        "od_asimetria": num(t20["cociente_asimetria_observada_esperada"], 2),
    }
    return c


# --- Tablas ------------------------------------------------------------------------------

REGLAS = {"tt_largo": "Duración mayor de 2 h", "vel_alta": "Velocidad mayor de 25 km/h",
          "tt_corto": "Duración menor de 60 s", "dis_corta": "Distancia menor de 100 m",
          "vel_baja": "Velocidad menor de 2 km/h"}


def tabla_embudo() -> str:
    t = leer("exploracion/T10_embudo.csv")
    filas = [r"Viajes del fichero original & & " + num(t["quedan"].iloc[0]) + r" \\",
             r"Nulos, duplicados, incoherencias, fuera de zona y solapes & 0 & " + num(t["quedan"].iloc[0]) + r" \\"]
    for _, f in t[t["regla"].isin(REGLAS)].iterrows():
        filas.append(f"{REGLAS[f['regla']]} (\\texttt{{{f['regla'].replace('_', chr(92) + '_')}}}) & "
                     f"{num(f['excluidos'])} & {num(f['quedan'])} \\\\")
    return "\n".join(filas) + FIN_TABLA


# Las tablas generadas terminan en \bottomrule: un \input seguido de una regla dentro de un
# tabular da el error «Misplaced \noalign».
FIN_TABLA = "\n\\bottomrule\n"


def tabla_estaciones() -> str:
    t = leer("exploracion/T13_estaciones_orden_magnitud.csv")
    radios = leer("exploracion/T15_radios_acceso.csv").set_index("radio_m")
    filas = []
    for r, g in t.groupby("radio_m"):
        g = g.set_index("cuota_pct")
        rango = f"{num(g.loc[80, 'estaciones_orden_magnitud'])}--{num(g.loc[95, 'estaciones_orden_magnitud'])}"
        lo = math.floor(0.8 * g.loc[80, "estaciones_orden_magnitud"])
        hi = math.ceil(1.2 * g.loc[95, "estaciones_orden_magnitud"])
        papel = "sensibilidad" if r == 400 else "barrido"
        filas.append(f"{r} & {papel} & {num(radios.loc[r, 'pct_t_pie_supera_viaje_medio'], 1)} & "
                     f"{num(radios.loc[r, 'pct_dis_le_2R'], 1)} & {rango} & {num(lo)}--{num(hi)} \\\\")
    return "\n".join(filas) + FIN_TABLA


def main() -> None:
    SALIDA.mkdir(exist_ok=True)
    lineas = ["% Generado por memoria/generar_cifras.py a partir de resultados/tablas. No editar a mano."]
    lineas += [f"\\defcifra{{{k}}}{{{v}}}" for k, v in sorted(cifras().items())]
    (SALIDA / "cifras.tex").write_text("\n".join(lineas) + "\n", encoding="utf-8", newline="\n")
    cabecera = "% Generado por memoria/generar_cifras.py. No editar a mano.\n"
    (SALIDA / "tabla_embudo.tex").write_text(cabecera + tabla_embudo(), encoding="utf-8", newline="\n")
    (SALIDA / "tabla_estaciones.tex").write_text(cabecera + tabla_estaciones(), encoding="utf-8", newline="\n")
    print(f"Cifras y tablas escritas en {SALIDA}")


if __name__ == "__main__":
    main()
