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
    paradas = leer("exploracion/T10_viajes_con_paradas.csv").set_index("grupo")
    lentos = paradas.loc["lentos con paradas (rescatados de vel_baja)"]
    largos = paradas.loc["largos con paradas (rescatados de tt_largo)"]
    fuera = paradas.loc["largos y lentos de al menos 1 km (siguen fuera)"]
    resto = paradas.loc["resto de viajes elegibles"]
    lim = cfg["limpieza"]
    c |= {
        "paradas_dis_min_m": num(lim["viaje_con_paradas"]["dis_min_m"]),
        "paradas_tt_max_h": num(lim["viaje_con_paradas"]["tt_max_s"] / 3600, 1),
        "paradas_viajes": num(lentos["viajes"] + largos["viajes"]),
        "paradas_lentos": num(lentos["viajes"]), "paradas_largos": num(largos["viajes"]),
        "paradas_lentos_dis": num(lentos["dis_m_mediana"]), "resto_dis": num(resto["dis_m_mediana"]),
        "paradas_lentos_recta": num(lentos["recta_m_mediana"]),
        "paradas_lentos_tt": num(lentos["tt_min_mediana"]), "resto_tt": num(resto["tt_min_mediana"], 1),
        "paradas_fuera": num(fuera["viajes"]), "paradas_fuera_tt_h": num(fuera["tt_min_mediana"] / 60, 1),
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

    # T21–T23. Divisiones administrativas, cortes temporales y líneas de deseo.
    t21 = leer("movilidad/T21_resumen.csv")
    municipio = fila(t21, nivel="municipio", periodo="mes")
    zona = fila(t21, nivel="zona_urbanistica", periodo="mes")
    t22 = leer("movilidad/T22_segmentos.csv")
    t23 = leer("movilidad/T23_indicadores.csv")
    flujo = fila(t23, nivel="h3", periodo="ajuste", tipo_dia="todos", franja="todas")
    c |= {
        "od_adm_asignados": num(municipio["asignados"]),
        "od_adm_sin_zona": num(municipio["sin_asignar"]),
        "od_municipio_intra_pct": num(municipio["pct_intrazonales"], 1),
        "od_urbanistica_intra_pct": num(zona["pct_intrazonales"], 1),
        "od_h3_intra_muestra_adm_pct": num(municipio["pct_intrazonales_h3"], 1),
        "od_matrices_temporales": num(t23["tipo_dia"].ne("todos").sum()),
        "od_manana_lab_dia": num(fila(t22, periodo="ajuste", tipo_dia="laborable",
                                    franja="punta_manana")["viajes_dia"], 1),
        "od_manana_fds_dia": num(fila(t22, periodo="ajuste", tipo_dia="fin_de_semana",
                                    franja="punta_manana")["viajes_dia"], 1),
        "od_interzonales_ajuste": num(flujo["interzonales"]),
        "od_top10_inter_pct": num(flujo["pct_top10_interzonales"], 1),
        "od_asimetria_obs_pct": num(100 * flujo["asimetria"], 1),
        "od_asimetria_azar_pct": num(100 * flujo["asimetria_azar"], 1),
    }

    t18 = fila(leer("exploracion/T18_resumen.csv"), periodo="mes")
    tarifa = cfg["limpieza"]["tarifa"]
    t24 = leer("movilidad/T24_resumen.csv").iloc[0]
    t25 = leer("movilidad/T25_barrido.csv")
    ref25 = leer("movilidad/T25_resumen.csv")
    medoids = fila(ref25, radio_m=300, metodo="kmedoids")
    means = fila(ref25, radio_m=300, metodo="kmeans")
    barrido300 = t25[t25["radio_m"].eq(300)]
    k_max = barrido300["k"].max()
    c |= {
        "tarifa_desbloqueo": num(tarifa["desbloqueo_eur"]),
        "tarifa_minuto": num(tarifa["minuto_eur"], 2),
        "tarifa_discrepancias": num(t18["precios_fuera_tolerancia"]),
        "tarifa_importe_elegible": num(t18["importe_elegible_eur"], 2),
        "tarifa_importe_excluido_pct": num(t18["pct_importe_excluido"], 1),
        "tarifa_importe_largos": num(t18["importe_viajes_largos_eur"], 2),
        "candidatos_n": num(t24["candidatos"]),
        "candidatos_desplazados": num(t24["desplazados"]),
        "candidatos_avisos": num(t24["candidatos_con_avisos"]),
        "redes_base_n": num(t25["network_id"].nunique()),
        "redes_base_eval_n": num(len(t25)),
        "redes_base_k_ref": num(medoids["k_referencia"]),
        "redes_base_medoids_ref_pct": num(medoids["pct_viajes_cubiertos_ref"], 1),
        "redes_base_means_ref_pct": num(means["pct_viajes_cubiertos_ref"], 1),
        "redes_base_k_max_300": num(k_max),
        "redes_base_mejor_max_pct": num(barrido300.loc[barrido300["k"].eq(k_max), "pct_viajes_cubiertos"].max(), 1),
    }

    finalistas = leer("movilidad/T28_finalistas.csv")
    red = fila(finalistas, rol="recomendada")
    alternativa = fila(finalistas, rol="menos_estaciones")
    radio_menor = fila(finalistas, rol="radio_menor")
    ajuste = {"network_id": red["network_id"], "periodo": "ajuste"}
    cota = fila(leer("movilidad/T26_certificados.csv"), radio_m=red["radio_m"])
    t27 = leer("movilidad/T27_resultados.csv")
    presupuesto = {"radio_m": cota["radio_m"], "k": cota["k_factible"]}
    mclp = fila(t27, **presupuesto, metodo="mclp")
    voraz = fila(t27, **presupuesto, metodo="voraz")
    cota_mclp = fila(leer("movilidad/T27_certificados.csv"), network_id=mclp["network_id"])
    t30_geo = leer("movilidad/T30_validacion_geometrica.csv")
    t30_pie = leer("movilidad/T30_validacion_peatonal.csv")
    t30_radios = leer("movilidad/T30_sensibilidad_peatonal.csv")
    radio_max = t30_radios["radio_m"].max()
    efectos = leer("movilidad/T30_efectos_temporales.csv").groupby("network_id")[["mezcla_pp", "dentro_pp"]].sum()
    efecto = efectos.loc[red["network_id"]]
    dias = leer("movilidad/T30_cobertura_diaria.csv")
    dias = dias.loc[dias["network_id"].eq(red["network_id"]) & dias["periodo"].eq("reservada") & dias["viajes"].gt(0)]
    peor = dias.loc[(dias["viajes_cubiertos"] / dias["viajes"]).idxmin()]
    pie_a = fila(t30_pie, **ajuste, sector="ambos")
    geo_a = fila(t30_geo, **ajuste)
    geo_r = fila(t30_geo, network_id=red["network_id"], periodo="reservada")
    c |= {
        "red_estaciones": num(red["k"]),
        "red_radio": num(red["radio_m"]),
        "red_alternativa_k": num(alternativa["k"]),
        "red_alternativa_pct": num(alternativa["pct_viajes_cubiertos"], 2),
        "red_radio_menor": num(radio_menor["radio_m"]),
        "red_radio_menor_k": num(radio_menor["k"]),
        "red_lscp_cota": num(cota["cota_inferior"]),
        "red_lscp_factible": num(cota["k_factible"]),
        "red_lscp_margen": num(cota["viajes_margen"]),
        "red_mclp_ganancia": num(mclp["viajes_cubiertos"] - voraz["viajes_cubiertos"]),
        "red_mclp_brecha": num(cota_mclp["brecha_viajes"]),
        "red_pierde_o": num(pie_a["pierde_origen"]),
        "red_pierde_d": num(pie_a["pierde_destino"]),
        "red_pierde_ambos": num(pie_a["pierde_ambos"]),
        "red_pie_umbral_max": num(radio_max),
        "red_pie_sensibilidad_pct": num(fila(t30_radios, **ajuste, sector="ambos", radio_m=radio_max)["pct_a_pie"], 1),
        "red_variacion_geo": num(geo_r["pct_viajes_cubiertos"] - geo_a["pct_viajes_cubiertos"], 2),
        "red_variacion_mezcla": num(efecto["mezcla_pp"], 2),
        "red_variacion_dentro": num(efecto["dentro_pp"], 2),
        "red_peor_dia": pd.Timestamp(peor["fecha"]).strftime("%d/%m"),
        "red_peor_pct": num(100 * peor["viajes_cubiertos"] / peor["viajes"], 2),
        "red_peor_viajes": num(peor["viajes"]),
    }
    for periodo in ("ajuste", "reservada"):
        geom = fila(t30_geo, network_id=red["network_id"], periodo=periodo)
        pie = fila(t30_pie, network_id=red["network_id"], periodo=periodo, sector="ambos")
        c |= {
            f"red_{periodo}_geo_pct": num(geom["pct_viajes_cubiertos"], 2),
            f"red_{periodo}_comparables": num(pie["viajes_comparables"]),
            f"red_{periodo}_linea_pct": num(pie["pct_linea"], 1),
            f"red_{periodo}_pie_pct": num(pie["pct_a_pie"], 1),
            f"red_{periodo}_pie_delta": num(pie["delta_pp"], 1),
            f"red_{periodo}_ruta_p90": num(pie["p90_a_pie_m"]),
        }

    # Comprobaciones de robustez (T11, T12, T13, T16, T17, T20 y T30).
    enc = leer("exploracion/T11_encadenados.csv").set_index("pausa_max_s")
    enc_p, enc_ref = enc.loc[300], enc.iloc[-1]
    conc = leer("exploracion/T11_concentracion_res9.csv").set_index("serie")
    noche = leer("exploracion/T12_noche.csv").set_index("hora")["viajes_mes"]
    oferta = leer("exploracion/T13_oferta_celdas.csv").head(30)
    activos = leer("exploracion/T12_simultaneos_diarios.csv")
    fisico = leer("exploracion/T16_modelo_fisico.csv")
    central = fila(fisico, rodadura=0.015, area_cd_m2=0.55)
    desfase = leer("exploracion/T17_desfase_lluvia.csv").set_index("desfase_h")
    estab = leer("movilidad/T20_estabilidad_pares.csv").set_index("comparacion")
    semanas = estab[estab.index.str.startswith("semana") & ~estab.index.str.contains("reservada")]
    rob = leer("movilidad/T30_robustez_encadenados.csv")
    entregas = leer("movilidad/T30_entregas_operador.csv").set_index("puntos")["pct_a_menos_del_radio"]
    c |= {
        "consumo_wh_km": num(cfg["patinete"]["consumo_wh_km"], 1),
        "enc_pares": num(enc_p["pares"]),
        "enc_pct": num(enc_p["pct_viajes_elegibles"], 2),
        "enc_sigue": num(enc_p["pct_sigue"], 1),
        "enc_vuelve": num(enc_p["pct_vuelve"], 1),
        "enc_ref_sigue": num(enc_ref["pct_sigue"], 1),
        "enc_ref_vuelve": num(enc_ref["pct_vuelve"], 1),
        "enc_cob_ajuste": num(fila(rob, periodo="ajuste", version="encadenados unidos")["pct_viajes_cubiertos"], 2),
        "entregas_top20": num(conc.loc["entregas", "pct_top20_celdas"], 1),
        "recogidas_top20": num(conc.loc["recogidas", "pct_top20_celdas"], 1),
        "entregas_red_pct": num(entregas["entregas del operador"], 1),
        "origenes_red_pct": num(entregas["orígenes del ajuste"], 1),
        "noche_pct": num(100 * noche[(noche.index >= 22) | (noche.index < 5)].sum() / noche.sum(), 1),
        "caida_22_pct": num(100 * (1 - noche[22] / noche[21]), 0),
        "caida_21_pct": num(100 * (1 - noche[21] / noche[20]), 0),
        "oferta_vacia_mediana": num(oferta["pct_tiempo_vacia"].median(), 1),
        "oferta_vacia_max": num(oferta["pct_tiempo_vacia"].max(), 1),
        "patinetes_activos_dia": num(activos.loc[activos["periodo"].eq("ajuste"), "patinetes_activos"].mean(), 1),
        "fisico_central": num(central["wh_km_velocidad_media"], 1),
        "fisico_crucero": num(central["wh_km_crucero"], 1),
        "fisico_max": num(fisico[["wh_km_velocidad_media", "wh_km_crucero"]].max().max(), 1),
        "desfase_0": num(desfase.loc[0, "deficit_pc"], 1),
        "desfase_mas1": num(desfase.loc[1, "deficit_pc"], 1),
        "pares_tvd": num(estab.loc["ajuste frente a reservada", "tvd_pc"], 1),
        "pares_azar": num(estab.loc["ajuste frente a reservada", "tvd_azar_pc"], 1),
        "pares_semanas_min": num(semanas["exceso_pp"].min(), 1),
        "pares_semanas_max": num(semanas["exceso_pp"].max(), 1),
    }
    # Inventario (T32).
    inv = indicadores("movilidad/T32_resumen.csv")
    dim = leer("movilidad/T32_dimensionado.csv")
    base_reb = int(cfg["movilidad"]["rebalanceo_base_patinetes_dia"])
    reb_max = int(dim["rebalanceo_max"].max())
    base = dim[dim["rebalanceo_max"].eq(base_reb)].reset_index(drop=True)
    q = float(inv["cuantil"])
    i_q = int(base.index[base["cuantil"].eq(q)][0])
    est = leer("movilidad/T32_estaciones.csv")
    noches = leer("movilidad/T32_noches.csv")
    ref = leer("movilidad/T32_referencia.csv")
    reservada = fila(leer("movilidad/T32_reservada.csv"), periodo="reservada", rebalanceo_max=base_reb)
    c |= {
        "inv_objetivo": num(95),
        "inv_cuantil": f"P{round(100 * q)}",
        "inv_flota": num(float(inv["flota"])),
        "inv_anclajes": num(float(inv["anclajes"])),
        "inv_anclajes_max": num(est["anclajes"].max()),
        "inv_anclajes_mediana": num(est["anclajes"].median()),
        "inv_pct": num(float(inv["pct_atendidos_cubiertos"]), 1),
        "inv_pct_anterior": num(base.loc[i_q - 1, "pct_atendidos_cubiertos"], 1),
        "inv_mes_flota": num(ref["stock_mes"].sum()),
        "inv_mes_anclajes": num(ref["anclajes_mes"].sum()),
        "inv_sin_reb_max_pct": num(fila(dim, rebalanceo_max=0, cuantil=1.0)["pct_atendidos_cubiertos"], 1),
        "inv_reb_max": num(reb_max),
        "inv_reb_max_pct": num(fila(dim, rebalanceo_max=reb_max, cuantil=q)["pct_atendidos_cubiertos"], 1),
        "inv_sin_patinete": num(float(inv["n_sin_patinete"])),
        "inv_sin_anclaje": num(float(inv["n_sin_anclaje"])),
        "inv_desvios": num(float(inv["viajes_con_desvio"])),
        "inv_desvio_m": num(float(inv["desvio_medio_m"])),
        "inv_sin_desvio_pct": num(float(inv["pct_atendidos_sin_desvio"]), 1),
        "inv_noches_agotadas": num(int(noches["patinetes_movidos"].eq(base_reb).sum())),
        "inv_noches": num(len(noches)),
        "inv_vpd": num(float(inv["viajes_por_patinete_dia"]), 2),
        "inv_reservada_pct": num(reservada["pct_atendidos_cubiertos"], 1),
        "inv_flota_diseno": num(base.loc[i_q, "flota"]),
        "inv_pct_diseno": num(base.loc[i_q, "pct_atendidos_cubiertos"], 1),
    }
    # Asignación y matriz estación → estación (T31).
    conc = leer("movilidad/T31_conciliacion.csv").set_index("resultado")
    acceso = leer("movilidad/T31_acceso.csv")
    org = fila(acceso, extremo="origen", medida="linea_recta")
    dst = fila(acceso, extremo="destino", medida="linea_recta")
    org_pie = fila(acceso, extremo="origen", medida="a_pie_estimada")
    ind31 = leer("movilidad/T31_indicadores.csv").set_index("indicador")
    est31 = leer("movilidad/T31_estaciones.csv")
    rech = est31["rechazos_sin_patinete"] + est31["rechazos_sin_anclaje"]
    c |= {
        "asig_atendidos": num(conc.loc["atendido", "viajes"]),
        "asig_pct_total": num(conc.loc["atendido", "pct_solicitudes"], 1),
        "asig_acceso_o": num(org["media_m"]),
        "asig_acceso_d": num(dst["media_m"]),
        "asig_acceso_p90": num(max(org["p90_m"], dst["p90_m"])),
        "asig_acceso_pie": num(org_pie["media_m"]),
        "asig_pares": num(ind31.loc["pares_con_viajes", "asignables"]),
        "asig_pares_pct": num(ind31.loc["pct_pares_posibles", "asignables"], 1),
        "asig_circular_pct": num(ind31.loc["pct_mismo_origen_destino", "asignables"], 1),
        "asig_top10_pct": num(ind31.loc["pct_top10_pares", "asignables"], 1),
        "asig_asimetria": num(ind31.loc["asimetria_pct", "asignables"], 1),
        "asig_asimetria_azar": num(ind31.loc["asimetria_aleatoria_pct", "asignables"], 1),
        "asig_spearman": num(est31["saldo_punta_manana"].corr(est31["saldo_punta_tarde"], method="spearman"), 2),
        "asig_rechazos": num(rech.sum()),
        "asig_rechazos_top10": num(100 * rech.nlargest(10).sum() / rech.sum(), 1),
    }
    # Curva de flota (T34).
    curva = leer("movilidad/T34_curva_flota.csv")
    cb = curva[curva["rebalanceo_max"].eq(base_reb)].reset_index(drop=True)
    flota_min = int(cb.loc[cb["pct_atendidos_cubiertos"].ge(95), "flota"].min())
    mejor = cb.loc[cb["pct_atendidos_cubiertos"].idxmax()]
    sin_reb = curva[curva["rebalanceo_max"].eq(0)]
    comp = leer("movilidad/T34_comparacion.csv")
    assert flota_min == int(inv["flota"]), "La flota de T32 no es la mínima de T34"
    c |= {
        "flota_min": num(flota_min),
        "flota_min_pct": num(fila(cb, flota=flota_min)["pct_atendidos_cubiertos"], 1),
        "flota_antes": num(flota_min - 25),
        "flota_antes_pct": num(fila(cb, flota=flota_min - 25)["pct_atendidos_cubiertos"], 1),
        "flota_max": num(mejor["flota"]),
        "flota_max_pct": num(mejor["pct_atendidos_cubiertos"], 1),
        "flota_700_pct": num(fila(cb, flota=700)["pct_atendidos_cubiertos"], 1),
        "flota_700_anclaje": num(fila(cb, flota=700)["n_sin_anclaje"]),
        "flota_min_anclaje": num(fila(cb, flota=flota_min)["n_sin_anclaje"]),
        "flota_sin_reb_pct": num(sin_reb["pct_atendidos_cubiertos"].max(), 1),
        "flota_vpd_min": num(fila(cb, flota=flota_min)["viajes_por_patinete_dia"], 2),
        "flota_vpd_max": num(mejor["viajes_por_patinete_dia"], 2),
        "flota_res_min": num(fila(comp, periodo="reservada", flota=flota_min)["pct_atendidos_cubiertos"], 1),
        "flota_res_diseno": num(fila(comp, periodo="reservada", caso="diseño T32")["pct_atendidos_cubiertos"], 1),
    }
    t33 = leer("movilidad/T33_politicas.csv")
    base = fila(t33, periodo="ajuste", politica="deficit", limite=base_reb)
    alterna = fila(t33, periodo="reservada", politica="beneficio", limite=base_reb)
    base_reserva = fila(t33, periodo="reservada", politica="deficit", limite=base_reb)
    factibles = t33.loc[t33["periodo"].eq("ajuste") & t33["pct_atendidos_cubiertos"].ge(95)]
    assert factibles.loc[factibles["km_rebalanceo"].idxmin(), "limite"] == base_reb
    assert factibles.loc[factibles["km_rebalanceo"].idxmin(), "politica"] == "deficit"
    t35_todo = leer("movilidad/T35_carga.csv")
    t35 = fila(t35_todo, periodo="reservada", caso="reserva20")
    doble_aj, doble_res = (fila(t35_todo, periodo=p, caso="consumo_doble") for p in ("ajuste", "reservada"))
    sin_rec = fila(t35_todo, periodo="ajuste", caso="sin_recarga")
    red_red_a = fila(leer("movilidad/T39_redes.csv"), red="redundante", periodo="ajuste")
    red_red_r = fila(leer("movilidad/T39_redes.csv"), red="redundante", periodo="reservada")
    intercambios = leer("movilidad/T37_T38_intercambios.csv").query("red == 'redundante'")
    t37 = leer("movilidad/T37_zonas.csv").query("prioritaria and periodo == 'reservada'")
    tasas = t37.groupby("red")["pct"].mean()
    cierres = leer("movilidad/T38_cierres.csv").query("periodo == 'reservada'").groupby("red")[["perdidos", "recuperados"]].sum()
    t39 = leer("movilidad/T39_redes.csv")
    red_a = fila(t39, red="habitual", periodo="ajuste")
    red_r = fila(t39, red="habitual", periodo="reservada")
    c |= {
        "cierre_km_ajuste": num(base["km_rebalanceo"], 1),
        "cierre_km_ahorro": num(base_reserva["km_rebalanceo"] - alterna["km_rebalanceo"], 1),
        "cierre_extra_reb": num(alterna["n_atendido"] - base_reserva["n_atendido"]),
        "cierre_bat_rechazos": num(t35["n_sin_bateria"]),
        "cierre_bat_pendiente": num(t35["pendiente_kwh"], 3),
        "cierre_bat_doble_aj": num(doble_aj["n_sin_bateria"]),
        "cierre_bat_doble_res": num(doble_res["n_sin_bateria"]),
        "cierre_sinrec_rechazos": num(sin_rec["n_sin_bateria"]),
        "cierre_sinrec_dias": num(sin_rec["dias_hasta_primer_rechazo"], 1),
        "cierre_sinrec_pct": num(sin_rec["pct_atendidos_cubiertos"], 1),
        "cierre_red_intercambios": num(len(intercambios)),
        "cierre_red_atendidos_aj": num(red_red_a["n_atendido"]),
        "cierre_red_atendidos_res": num(red_red_r["n_atendido"]),
        "cierre_zonas": num(t37["zona"].nunique()),
        "cierre_equidad_pp": num(tasas["equidad"] - tasas["habitual"], 2),
        "cierre_fallos_habitual": num(cierres.loc["habitual", "perdidos"] - cierres.loc["habitual", "recuperados"]),
        "cierre_fallos_redundante": num(cierres.loc["redundante", "perdidos"] - cierres.loc["redundante", "recuperados"]),
        "cierre_anc": num(red_a["anclajes"]),
        "cierre_atendidos_aj": num(red_a["n_atendido"]),
        "cierre_atendidos_res": num(red_r["n_atendido"]),
        "cierre_solicitudes_res": num(red_r["solicitudes"]),
        "cierre_pct_total_res": num(red_r["pct_atendidos_total"], 2),
        "cierre_pct_cub_res": num(red_r["pct_atendidos_cubiertos"], 2),
        "cierre_kwh_dia_aj": num(red_a["kwh_dia"], 2),
        "cierre_kwh_dia_res": num(red_r["kwh_dia"], 2),
        "cierre_kw_red": num(red_r["pico_red_kw"], 2),
        "cierre_kw_est": num(red_r["pico_estacion_kw"], 2),
        "cierre_top10": num(red_r["cuota_top10_pct"], 2),
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
