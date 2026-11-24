"""Experimentos de capacidad con flota y anclajes fijos (T80) y despliegue por etapas (T81).

Las reglas se fijan con el ajuste (1–21/02) y la semana reservada solo las comprueba.
"""

import numpy as np
import pandas as pd

from comun.config import cargar_config
from comun.datos import cargar_viajes
from comun.web import exportar
from inventario import Demanda, Red, simular
from redes import guardar as _guardar, leer

# T80. Anclajes que se trasladan y candidatos que se prueban en cada paso de la búsqueda marginal.
TRASLADOS = 10
CANDIDATOS = 20
# Una estación cede un anclaje solo si conserva hueco para su stock inicial y al menos dos plazas.
MINIMO_ANCLAJES = 2
# T81. Módulo de ampliación (hipótesis de diseño: un bastidor de cuatro anclajes) y regla de
# saturación: una estación está saturada si en la semana rechaza al menos dos devoluciones por
# falta de hueco o pasa llena al menos el 10 % del tiempo. Al final de cada semana se amplían las
# más saturadas sin pasar del total de anclajes del despliegue completo de T32.
MODULO = 4
UMBRAL_RECHAZOS = 2
UMBRAL_LLENA_PCT = 10


def guardar(df, nombre):
    _guardar(df, nombre)
    return df


class Base:
    """Red elegida con su stock y anclajes de T32 y la demanda de cada periodo."""

    def __init__(self):
        cfg = cargar_config()
        self.cfg = cfg
        self.limite = cfg["movilidad"]["rebalanceo_base_patinetes_dia"]
        tabla = leer("T32_estaciones").sort_values("station_id")
        finalistas = leer("T28_finalistas")
        elegida = finalistas.loc[finalistas["rol"].eq("recomendada")].iloc[0]
        self.red = Red.de_tabla(tabla, elegida["radio_m"])
        self.stock = tabla["stock_inicial"].to_numpy()
        self.anclajes = tabla["anclajes"].to_numpy()
        self.viajes = {p: cargar_viajes(periodo=p) for p in cfg["datos"]["periodos"]}
        self.demandas = {p: Demanda.de_viajes(v, self.red) for p, v in self.viajes.items()}

    def simular(self, periodo, anclajes, demanda=None):
        assert anclajes.sum() >= self.stock.sum() and (anclajes >= self.stock).all()
        return simular(demanda or self.demandas[periodo], self.red, self.stock, anclajes, self.limite)


def rechazos_por_estacion(dem, r, n):
    """Devoluciones rechazadas por falta de hueco, atribuidas a la estación más cercana al destino."""
    _, destino = dem.mas_cercana()
    sin = r.viajes["resultado"].eq("sin_anclaje").to_numpy() & (destino >= 0)
    return np.bincount(destino[sin], minlength=n)


def puede_ceder(base, anclajes):
    return anclajes - 1 >= np.maximum(base.stock, MINIMO_ANCLAJES)


def por_uso(base):
    """Diez anclajes de las estaciones menos llenas a las más usadas del ajuste."""
    r = base.simular("ajuste", base.anclajes)
    e = r.estaciones
    uso = (e["salidas"] + e["llegadas"]).to_numpy()
    reciben = np.lexsort((np.arange(len(uso)), -uso))[:TRASLADOS]
    libres = np.flatnonzero(puede_ceder(base, base.anclajes) & ~np.isin(np.arange(len(uso)), reciben))
    ceden = libres[np.lexsort((libres, e["pct_tiempo_llena"].to_numpy()[libres]))][:TRASLADOS]
    anclajes = base.anclajes.copy()
    anclajes[ceden] -= 1
    anclajes[reciben] += 1
    pasos = [{"paso": i + 1, "sale": base.red.ids[s], "entra": base.red.ids[t]} for i, (s, t) in enumerate(zip(ceden, reciben))]
    return anclajes, pasos


def por_beneficio(base):
    """Búsqueda voraz: en cada paso, el traslado que más viajes atiende en el ajuste."""
    dem = base.demandas["ajuste"]
    anclajes = base.anclajes.copy()
    actual = base.simular("ajuste", anclajes)
    pasos = []
    for paso in range(TRASLADOS):
        e = actual.estaciones
        llena = e["pct_tiempo_llena"].to_numpy()
        rechazos = rechazos_por_estacion(dem, actual, base.red.n)
        # Cede la estación con hueco que menos tiempo pasa llena; recibe una de las que más rechazan.
        libres = np.flatnonzero(puede_ceder(base, anclajes) & (rechazos == 0))
        cede = libres[np.lexsort((libres, llena[libres]))[0]]
        candidatas = np.flatnonzero(rechazos > 0)
        candidatas = candidatas[np.lexsort((candidatas, -rechazos[candidatas]))][:CANDIDATOS]
        mejor = None
        for c in candidatas:
            prueba = anclajes.copy()
            prueba[cede] -= 1
            prueba[c] += 1
            r = base.simular("ajuste", prueba)
            if mejor is None or r.resumen["n_atendido"] > mejor[1].resumen["n_atendido"]:
                mejor = (c, r)
        if mejor is None or mejor[1].resumen["n_atendido"] <= actual.resumen["n_atendido"]:
            break
        anclajes[cede] -= 1
        anclajes[mejor[0]] += 1
        pasos.append({"paso": paso + 1, "sale": base.red.ids[cede], "entra": base.red.ids[mejor[0]],
                      "ganancia_ajuste": mejor[1].resumen["n_atendido"] - actual.resumen["n_atendido"]})
        actual = mejor[1]
    return anclajes, pasos


def anclajes_t80(base):
    actual = base.anclajes
    uso, pasos_uso = por_uso(base)
    beneficio, pasos_beneficio = por_beneficio(base)
    for a in (uso, beneficio):
        assert a.sum() == actual.sum() and (a >= base.stock).all()
    filas, estaciones = [], []
    for periodo in base.demandas:
        ref = base.simular(periodo, actual)
        ref_e = ref.estaciones.set_index("station_id")
        for nombre, a in (("actual", actual), ("uso", uso), ("beneficio", beneficio)):
            r = ref if nombre == "actual" else base.simular(periodo, a)
            movidos = int(np.abs(a - actual).sum() // 2)
            ceden = base.red.ids[a < actual]
            e = r.estaciones.set_index("station_id")
            # Pérdida en las estaciones que ceden: viajes que dejan de salir o llegar allí.
            perdida = int(((ref_e.loc[ceden, "salidas"] + ref_e.loc[ceden, "llegadas"]) -
                           (e.loc[ceden, "salidas"] + e.loc[ceden, "llegadas"])).clip(lower=0).sum())
            filas.append({"periodo": periodo, "estrategia": nombre, "anclajes_movidos": movidos,
                          "atendidos": r.resumen["n_atendido"], "sin_anclaje": r.resumen["n_sin_anclaje"],
                          "sin_patinete": r.resumen["n_sin_patinete"],
                          "pct_atendidos_cubiertos": r.resumen["pct_atendidos_cubiertos"],
                          "recuperados": r.resumen["n_atendido"] - ref.resumen["n_atendido"],
                          "por_anclaje": (r.resumen["n_atendido"] - ref.resumen["n_atendido"]) / movidos if movidos else None,
                          "perdida_en_las_que_ceden": perdida})
            estaciones.append(pd.DataFrame({"station_id": base.red.ids, "periodo": periodo, "estrategia": nombre,
                                            "anclajes": a, "cambio": a - actual}))
    traslados = pd.concat([pd.DataFrame(pasos_uso).assign(estrategia="uso"),
                           pd.DataFrame(pasos_beneficio).assign(estrategia="beneficio")], ignore_index=True)
    return (guardar(pd.DataFrame(filas), "T80_anclajes"), guardar(traslados, "T80_traslados"),
            pd.concat(estaciones, ignore_index=True))


def semanas(base):
    """Semanas del ajuste: 1–7, 8–14 y 15–21 de febrero."""
    v = base.viajes["ajuste"]
    dia = v["tsO"].dt.day
    return [(k + 1, v.loc[dia.between(7 * k + 1, 7 * k + 7)].reset_index(drop=True)) for k in range(3)]


def despliegue_t81(base):
    """Primera etapa ajustada al stock y ampliaciones semanales con el mismo total que T32."""
    # Cada estación empieza con los módulos justos para su stock inicial más un hueco libre.
    inicial = MODULO * np.ceil(np.maximum(base.stock + 1, MINIMO_ANCLAJES) / MODULO).astype(int)
    presupuesto = (int(base.anclajes.sum()) - int(inicial.sum())) // MODULO
    anclajes = inicial.copy()
    filas, ampliaciones = [], []
    lista = semanas(base)
    for semana, v in lista:
        dem = Demanda.de_viajes(v, base.red)
        r = base.simular("ajuste", anclajes, dem)
        completo = base.simular("ajuste", base.anclajes, dem)
        rechazos = rechazos_por_estacion(dem, r, base.red.n)
        llena = r.estaciones["pct_tiempo_llena"].to_numpy()
        saturadas = np.flatnonzero((rechazos >= UMBRAL_RECHAZOS) | (llena >= UMBRAL_LLENA_PCT))
        saturadas = saturadas[np.lexsort((saturadas, -llena[saturadas], -rechazos[saturadas]))]
        # El presupuesto que queda se reparte por igual entre las semanas que faltan.
        usados = int((anclajes - inicial).sum()) // MODULO
        cupo = int(np.ceil((presupuesto - usados) / (len(lista) - semana + 1)))
        n_saturadas = len(saturadas)
        saturadas = saturadas[:cupo]
        filas.append({"etapa": f"semana {semana}", "periodo": "ajuste", "anclajes": int(anclajes.sum()),
                      "atendidos": r.resumen["n_atendido"], "sin_anclaje": r.resumen["n_sin_anclaje"],
                      "atendidos_completo": completo.resumen["n_atendido"], "anclajes_completo": int(base.anclajes.sum()),
                      "solicitudes": r.resumen["solicitudes"], "saturadas": n_saturadas, "modulos_nuevos": len(saturadas)})
        ampliaciones.extend({"semana": semana, "station_id": base.red.ids[s], "rechazos": int(rechazos[s]),
                             "pct_llena": llena[s], "anclajes_antes": int(anclajes[s])} for s in saturadas)
        anclajes = anclajes.copy()
        anclajes[saturadas] += MODULO
    for nombre, a in (("primera etapa", inicial), ("tras las ampliaciones", anclajes), ("despliegue completo", base.anclajes)):
        r = base.simular("reservada", a)
        filas.append({"etapa": nombre, "periodo": "reservada", "anclajes": int(a.sum()), "atendidos": r.resumen["n_atendido"],
                      "sin_anclaje": r.resumen["n_sin_anclaje"], "solicitudes": r.resumen["solicitudes"]})
    t = pd.DataFrame(filas)
    res = t.loc[t["periodo"].eq("reservada")].set_index("etapa")
    modulos = int((anclajes - inicial).sum() // MODULO)
    t.attrs["modulos"] = modulos
    t.attrs["recuperados_por_modulo"] = ((res.loc["tras las ampliaciones", "atendidos"] - res.loc["primera etapa", "atendidos"])
                                         / modulos if modulos else None)
    assert anclajes.sum() <= base.anclajes.sum()
    t.attrs["presupuesto"] = presupuesto
    estaciones = pd.DataFrame({"station_id": base.red.ids, "stock_inicial": base.stock, "etapa_1": inicial,
                               "final": anclajes, "completo": base.anclajes})
    guardar(estaciones, "T81_estaciones")
    return guardar(t, "T81_etapas"), guardar(pd.DataFrame(ampliaciones), "T81_ampliaciones"), estaciones


def publicar():
    base = Base()
    t80, traslados, est80 = anclajes_t80(base)
    t81, ampliaciones, est81 = despliegue_t81(base)
    posiciones = pd.DataFrame({"station_id": base.red.ids, "lon": base.red.lon, "lat": base.red.lat})
    exportar("fase1", "capacidad", {
        "t80": t80, "traslados": traslados.merge(posiciones.add_prefix("sale_"), left_on="sale", right_on="sale_station_id")
        .merge(posiciones.add_prefix("entra_"), left_on="entra", right_on="entra_station_id"),
        "t81": t81, "ampliaciones": ampliaciones, "modulo": MODULO,
        "umbral_rechazos": UMBRAL_RECHAZOS, "umbral_llena_pct": UMBRAL_LLENA_PCT,
        "modulos": t81.attrs["modulos"], "recuperados_por_modulo": t81.attrs["recuperados_por_modulo"],
    })
    return t80, traslados, t81, ampliaciones, est81
