"""Experimentos reproducibles del cierre de movilidad (T33 y T35–T39)."""

from dataclasses import dataclass
from math import ceil

import h3
import numpy as np
import pandas as pd

from alternativas import intercambiar
from bateria import Carga
from comun.config import cargar_config, ruta
from comun.datos import cargar_viajes
from comun.web import exportar
from inventario import (DIA_S, HORA_CORTE, Demanda, Red, dias, dimensionar, referencia,
                        repartir, repartir_flota, simular)
from redes import OBJETIVO_PCT, CoberturaOD, Problema, guardar, leer


@dataclass
class Escenario:
    red: Red
    demandas: dict
    stock: np.ndarray
    anclajes: np.ndarray
    referencia: dict

    def simular(self, periodo, limite, **opciones):
        return simular(self.demandas[periodo], self.red, self.stock, self.anclajes, limite, **opciones)


def resumen(filas, nombre):
    tabla = pd.DataFrame(filas)
    guardar(tabla, nombre)
    return tabla


def rebalanceo(esc, limites):
    # P(stock mínimo de la trayectoria diaria > stock actual), estimada en ajuste.
    perfiles = esc.referencia["necesidad"]
    valores = np.arange(esc.stock.max() + 1)
    prioridad = (perfiles[:, :, None] > valores).mean(axis=1)
    filas, detalle = [], []
    for periodo, dem in esc.demandas.items():
        dias_servicio = dias(dem.t_o, dem)
        for politica, peso in (("deficit", None), ("beneficio", prioridad)):
            for limite in limites:
                r = esc.simular(periodo, limite, prioridad=peso)
                claves = {"periodo": periodo, "politica": politica, "limite": limite}
                rechazos = r.viajes["resultado"].isin(["sin_patinete", "sin_anclaje"]).to_numpy()
                for n in r.noches.itertuples():
                    dia = n.corte // DIA_S
                    detalle.append({**claves, "fecha": pd.to_datetime(dia, unit="D").date().isoformat(),
                                    "movidos": n.patinetes_movidos, "km": n.km,
                                    "deficit": n.deficit_despues, "en_viaje": n.en_viaje,
                                    "rechazos_dia_servicio": int(rechazos[dias_servicio == dia].sum())})
                filas.append({**claves, **r.resumen, "noches": len(r.noches),
                              "deficit_medio": r.noches["deficit_despues"].mean()})
    tabla = resumen(filas, "T33_politicas")
    return tabla, resumen(detalle, "T33_noches")


def bateria(esc, energia, limite, cfg):
    filas = []
    for periodo in esc.demandas:
        for caso, reserva in (("inventario", None), ("carga", 0), ("reserva20", 20)):
            carga = Carga(energia[periodo], cfg["bateria_wh"], cfg["tiempo_recarga_h"], reserva) if reserva is not None else None
            r = esc.simular(periodo, limite, carga=carga)
            filas.append({"periodo": periodo, "caso": caso, "reserva_pct": reserva,
                          **r.resumen, "n_sin_bateria": r.resumen.get("n_sin_bateria", 0)})
    return resumen(filas, "T35_carga")


def exposicion(dem):
    """Cinco casos elegidos por exposición de viajes, en la punta del ajuste."""
    horas = cargar_config()["exploracion"]["franjas_horarias"]["punta_tarde"]
    local = dem.t_o % DIA_S
    punta = (local >= horas[0] * 3600) & (local < horas[1] * 3600) & dem.cubierto
    dias_punta, volumen = np.unique(dem.t_o[punta] // DIA_S, return_counts=True)
    dia = int(dias_punta[volumen.argmax()])
    ini, fin = (dia * DIA_S + hora * 3600 for hora in horas)
    expuestas = {}
    for i in np.flatnonzero(punta & (dem.t_o // DIA_S == dia)):
        obligatorias = {int(opc[0]) for opc in (dem.opc_o[i], dem.opc_d[i]) if len(opc) == 1}
        for s in obligatorias:
            expuestas[s] = expuestas.get(s, 0) + 1
    criticas = sorted(expuestas, key=lambda s: (-expuestas[s], s))[:5]
    return ini, fin, [(s, expuestas[s]) for s in criticas]


def agrupar_zonas(viajes, archivo):
    zonas = pd.read_parquet(archivo, columns=["trip_id", "zona_urbanistica_o"])
    cruce = viajes[["trip_id"]].merge(zonas, on="trip_id", how="left", validate="one_to_one")
    if cruce["zona_urbanistica_o"].isna().any():
        raise ValueError("Regenera T21 con la limpieza vigente antes de cerrar movilidad.")
    return cruce["zona_urbanistica_o"]


def zonas(viajes, escenarios):
    archivo = ruta("viajes_limpios").with_name("T21_viajes_zonificados.parquet")
    zona = {p: agrupar_zonas(v, archivo) for p, v in viajes.items()}
    a = escenarios["habitual"].demandas["ajuste"]
    origen = pd.DataFrame({"zona": zona["ajuste"], "cubierto": a.cubierto})
    t = origen.groupby("zona")["cubierto"].agg(viajes="size", tasa="mean").reset_index()
    # 100 salidas limitan a 5 pp el error estándar binomial máximo de la tasa descriptiva.
    t = t.loc[t["viajes"].ge(100) & t["zona"].ne("SIN_ASIGNAR")].sort_values(["tasa", "zona"])
    cuartil = t.head(ceil(len(t) / 4))
    pesos = zona["ajuste"].map(1 / cuartil.set_index("zona")["viajes"]).fillna(0).to_numpy()
    return zona, cuartil["zona"].tolist(), pesos


def grado_acceso(dem, asignadas, prioritarias):
    marco = pd.DataFrame({"zona": asignadas, "cubierto": dem.cubierto})
    t = marco.groupby("zona", sort=True)["cubierto"].agg(viajes="size", cubiertos="sum").reset_index()
    return t.assign(pct=100 * t["cubiertos"] / t["viajes"], prioritaria=t["zona"].isin(prioritarias))


def comparar_cierres(escenarios, normales, caso, limite):
    ini, fin, criticas = caso
    base = escenarios["habitual"]
    filas = []
    for periodo in base.demandas:
        # El mismo día de la semana, tres semanas después, ya dentro de la reserva.
        salto = 0 if periodo == "ajuste" else 21 * DIA_S
        a, b = ini + salto, fin + salto
        controles = {red: escenarios[red].simular(periodo, limite, observacion=(a, b)).estaciones
                     .set_index("station_id")["pct_llena_ventana"] for red in ("habitual", "redundante")}
        for lugar, expuestas in criticas:
            station_id = base.red.ids[lugar]
            for red in ("habitual", "redundante"):
                esc = escenarios[red]
                i, = np.flatnonzero(esc.red.ids == station_id)
                simulacion = esc.simular(periodo, limite, cierre=(i, a, b))
                con = simulacion.viajes
                sin = normales[red, periodo].viajes
                dentro = (esc.demandas[periodo].t_o >= a) & (esc.demandas[periodo].t_o < b)
                s = sin["resultado"].eq("atendido")
                c = con["resultado"].eq("atendido")
                o = con["estacion_origen"].ne(sin["estacion_origen"])
                d = con["estacion_destino"].ne(sin["estacion_destino"])
                desviadas = dentro & c & s & (o | d)
                extras = con["desvio_origen_m"] + con["desvio_destino_m"] - sin["desvio_origen_m"] - sin["desvio_destino_m"]
                vecinas = con.loc[desviadas & d, "estacion_destino"].value_counts().rename("llegadas").reset_index()
                vecinas = vecinas.sort_values(["llegadas", "estacion_destino"], ascending=[False, True])
                vec = vecinas.iloc[0]["estacion_destino"] if len(vecinas) else ""
                saturacion = simulacion.estaciones.set_index("station_id")["pct_llena_ventana"]
                filas.append({"periodo": periodo, "red": red, "station_id": station_id,
                              "inicio": pd.to_datetime(a, unit="s").isoformat(), "fin": pd.to_datetime(b, unit="s").isoformat(),
                              "exposicion_ajuste": expuestas, "solicitudes": int(dentro.sum()),
                              "atendidos_normal": int((s & dentro).sum()), "atendidos_cierre": int((c & dentro).sum()),
                              "perdidos": int((s & ~c & dentro).sum()), "recuperados": int((~s & c & dentro).sum()),
                              "sin_cobertura": int((dentro & con["resultado"].eq("sin_cobertura")).sum()),
                              "sin_estacion": int((dentro & con["resultado"].eq("sin_estacion")).sum()),
                              "sin_patinete": int((dentro & con["resultado"].eq("sin_patinete")).sum()),
                              "sin_anclaje": int((dentro & con["resultado"].eq("sin_anclaje")).sum()),
                              "desviados": int(desviadas.sum()), "recogidas_desviadas": int((desviadas & o).sum()),
                              "devoluciones_desviadas": int((desviadas & d).sum()),
                              "metros_adicionales": extras[desviadas].sum(),
                              "perdida_periodo": int(s.sum() - c.sum()),
                              "destino_mas_desviado": vec, "llegadas_desviadas_destino": int(vecinas.iloc[0]["llegadas"]) if vec else 0,
                              "llena_normal_pct": controles[red][vec] if vec else None,
                              "llena_cierre_pct": saturacion[vec] if vec else None})
    return resumen(filas, "T38_cierres")


def recarga(t_llegada, destino, wh, n, cfg):
    """Demanda equivalente en W medios por cuarto de hora, con cola de carga."""
    paso = 900
    p_w = cfg["bateria_wh"] / cfg["tiempo_recarga_h"]
    desde = t_llegada - (t_llegada.min() // paso) * paso
    hasta = desde + 3600 * wh / p_w
    primero, ultimo = desde // paso, (hasta // paso).astype(int)
    carga_wh = np.zeros((n, ultimo.max() + 1))
    for d, a, b, i, j in zip(destino, desde, hasta, primero, ultimo):
        carga_wh[d, i] += p_w * (min(b, (i + 1) * paso) - a) / 3600
        if j > i:
            carga_wh[d, i + 1:j] += p_w / 4
            carga_wh[d, j] += p_w * (b - j * paso) / 3600
    assert np.isclose(carga_wh.sum(), wh.sum())
    return carga_wh * 4 / 1000


def operar(escenarios, viajes, energia, limite, cfg):
    filas, estaciones, flujos, llegadas, normales = [], [], [], [], {}
    for nombre, esc in escenarios.items():
        for periodo, dem in esc.demandas.items():
            sim = esc.simular(periodo, limite)
            normales[nombre, periodo] = sim
            mov = sim.viajes.loc[sim.viajes["resultado"].eq("atendido")]
            i = mov.index.to_numpy()
            id_dest = pd.Index(esc.red.ids).get_indexer(mov["estacion_destino"])
            assert (id_dest >= 0).all()
            wh = energia[periodo][i]
            pot = recarga(dem.t_d[i], id_dest, wh, esc.red.n, cfg)
            carga = np.bincount(id_dest, weights=wh / 1000, minlength=esc.red.n)
            assert (sim.estaciones["llegadas"].to_numpy() == np.bincount(id_dest, minlength=esc.red.n)).all()
            claves = {"red": nombre, "periodo": periodo}
            filas.append({**claves, "estaciones": esc.red.n, "radio_m": esc.red.radio, **sim.resumen,
                          "redundantes": sum(len(o) >= 2 and len(d) >= 2 for o, d in zip(dem.opc_o, dem.opc_d)),
                          "energia_kwh": carga.sum(), "kwh_dia": carga.sum() / sim.resumen["dias"],
                          "pico_red_kw": pot.sum(axis=0).max(), "pico_estacion_kw": pot.max(),
                          "cuota_top10_pct": 100 * np.sort(carga)[-10:].sum() / carga.sum()})
            estaciones.append(sim.estaciones.assign(**claves, energia_kwh=carga, pico_kw=pot.max(axis=1)))
            flujos.append(mov.groupby(["estacion_origen", "estacion_destino"]).size()
                          .rename("viajes").reset_index().assign(**claves))
            llegadas.append(mov[["trip_id", "estacion_destino"]].assign(
                **claves, tsD=viajes[periodo].loc[i, "tsD"], energia_wh=wh))
    guardar(pd.concat(estaciones, ignore_index=True), "T39_estaciones")
    pd.concat(llegadas, ignore_index=True).to_parquet(
        ruta("viajes_limpios").with_name("T39_llegadas_atendidas.parquet"), index=False)
    return normales, resumen(filas, "T39_redes"), pd.concat(flujos, ignore_index=True)


def publicar():
    cfg = cargar_config()
    parametros = cfg["movilidad"]
    limite = parametros["rebalanceo_base_patinetes_dia"]
    limites = parametros["rebalanceo_sensibilidad_patinetes_dia"]
    viajes = {p: cargar_viajes(periodo=p) for p in cfg["datos"]["periodos"]}
    t40 = pd.read_csv(ruta("tablas") / "consumo" / "T40_energia_viaje.csv").set_index("trip_id")
    energia = {p: t40.loc[v["trip_id"], "energia_wh"].to_numpy() for p, v in viajes.items()}
    finalistas, sitios = leer("T28_finalistas"), leer("T28_estaciones")
    designada = finalistas.loc[finalistas["rol"].eq("recomendada")].iloc[0]
    tabla = leer("T32_estaciones").sort_values("station_id")
    tot_stock, tot_cap = int(tabla["stock_inicial"].sum()), int(tabla["anclajes"].sum())
    cuantil, = leer("T32_resumen").query("indicador == 'cuantil'")["valor"].astype(float)

    def crear(pos, radio, *, habitual=False):
        red = Red.de_tabla(pos.sort_values("station_id"), radio)
        demandas = {p: Demanda.de_viajes(v, red) for p, v in viajes.items()}
        ref = referencia(demandas["ajuste"], red.n)
        if habitual:
            stock, cap = tabla["stock_inicial"].to_numpy(), tabla["anclajes"].to_numpy()
        else:
            stock_diseno, cap_diseno = dimensionar(ref, cuantil)
            # Dos plazas de mínimo. Se reparte el resto según el excedente de capacidad de diseño.
            cap = 2 + repartir(cap_diseno - 2, tot_cap - 2 * red.n)
            stock = repartir_flota(stock_diseno, cap, tot_stock)
        assert stock.sum() == tot_stock and cap.sum() == tot_cap and (stock <= cap).all()
        return Escenario(red, demandas, stock, cap, ref)

    escenarios = {"habitual": crear(tabla, designada["radio_m"], habitual=True)}
    base = escenarios["habitual"]
    reb, noches = rebalanceo(base, limites)
    soc = bateria(base, energia, limite, cfg["patinete"])
    print("T33 y T35 calculadas", flush=True)
    zona, prioritarias, pesos = zonas(viajes, escenarios)
    caso = exposicion(base.demandas["ajuste"])
    problema = Problema.del_ajuste()
    assert np.array_equal(problema.viajes["trip_id"], viajes["ajuste"]["trip_id"])
    modelo = CoberturaOD(problema, base.red.radio)
    indices = problema.indices(base.red.ids)
    protegidas = problema.indices([base.red.ids[s] for s, _ in caso[2]])
    cambios = []
    for nombre, w, objetivo, fijas in (
        ("equidad", pesos, 1, ()), ("redundante", np.ones(len(pesos)), 2, protegidas),
    ):
        minimo = ceil(len(pesos) * OBJETIVO_PCT / 100) if nombre == "redundante" else None
        nuevos, pasos = intercambiar(modelo, indices, w, objetivo, 5, fijas, minimo)
        posiciones = problema.estaciones(nuevos, nombre)
        guardar(posiciones, "T37_equidad" if nombre == "equidad" else "T38_redundante")
        escenarios[nombre] = crear(posiciones, base.red.radio)
        ids = problema.candidatos["candidate_id"]
        cambios.extend({**p, "red": nombre, "sale": ids.iloc[p["sale"]], "entra": ids.iloc[p["entra"]]} for p in pasos)
        print(nombre, len(pasos), "intercambios", flush=True)
    cambios = resumen(cambios, "T37_T38_intercambios")

    equidad = pd.concat([grado_acceso(escenarios[r].demandas[p], z, prioritarias).assign(red=r, periodo=p)
                        for r in ("habitual", "equidad") for p, z in zona.items()], ignore_index=True)
    catalogo = leer("T21_zonas").query("nivel == 'zona_urbanistica'").set_index("codigo")["nombre"]
    equidad["nombre"] = equidad["zona"].map(catalogo).fillna("Sin zona asignada")
    guardar(equidad, "T37_zonas")
    for r in finalistas.loc[finalistas["rol"].ne("recomendada")].itertuples():
        escenarios[r.rol] = crear(sitios.loc[sitios["network_id"].eq(r.network_id)], r.radio_m)

    normales, redes, flujos = operar(escenarios, viajes, energia, limite, cfg["patinete"])
    cierres = comparar_cierres(escenarios, normales, caso, limite)
    guardar(flujos, "T36_flujos_operativos")
    celdas = []
    for periodo, v in viajes.items():
        dem = base.demandas[periodo]
        celda = [h3.latlng_to_cell(a, b, parametros["resolucion_mapas"]) for a, b in zip(v["latO"], v["lonO"])]
        estado = normales["habitual", periodo].viajes["resultado"].eq("atendido")
        medido = pd.DataFrame({"h3": celda, "cubiertos": dem.cubierto, "atendidos": estado})
        t = medido.groupby("h3").agg(viajes=("cubiertos", "size"), cubiertos=("cubiertos", "sum"),
                                    atendidos=("atendidos", "sum")).reset_index()
        celdas.append(t.assign(periodo=periodo))
    celdas = pd.concat(celdas, ignore_index=True)
    guardar(celdas, "T36_cobertura_operativa")
    exportar("fase1", "t36_operacion", {
        "network_id": designada["network_id"],
        "celdas": celdas.assign(contorno=celdas["h3"].map(lambda c: [(lon, lat) for lat, lon in h3.cell_to_boundary(c)])),
        "flujos": flujos.loc[flujos["red"].eq("habitual")],
    })
    exportar("fase1", "cierre_movilidad", {
        "rebalanceo": reb, "noches": noches, "bateria": soc, "zonas": equidad, "cierres": cierres,
        "redes": redes, "cambios": cambios, "flota": tot_stock, "anclajes": tot_cap, "limite": limite,
        "network_id": designada["network_id"],
    })
    print("T36–T39 calculadas", flush=True)


if __name__ == "__main__":
    publicar()
