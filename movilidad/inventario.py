"""Asignación de viajes a estaciones e inventario de patinetes y anclajes (T32).

El simulador sigue las reglas de PLAN.md (apartado 4, «Capacidad e inventario»):

- Los eventos se procesan en orden temporal. Si una llegada y una salida coinciden en el
  mismo segundo, primero va la llegada.
- Al aceptar un viaje se comprueba que hay patinete en el origen y se reserva un anclaje en
  el destino. En un viaje circular cuenta el hueco que deja su propia salida.
- Se prueba primero la estación más cercana de cada extremo. Si falta patinete o hueco,
  se desvía a la siguiente dentro del radio. Se guarda la distancia extra.
- Cada noche, a la hora de corte, se recolocan como mucho N patinetes de las estaciones
  con más stock que el de diseño a las que tienen menos.

Las horas son de reloj local de Roma, en segundos. En febrero no hay cambio de hora.
"""

import heapq
from dataclasses import dataclass, field
from math import ceil

import numpy as np
import pandas as pd

from comun.config import cargar_config
from bateria import FlotaElectrica
from redes import distancias, extremos

# Hora local del rebalanceo nocturno y del cambio de «día de servicio». De 3 a 5 h salen
# 4 de los 16 756 viajes del ajuste (T12), así que el corte apenas parte viajes.
HORA_CORTE = 4
DIA_S = 86_400
# Una estación tiene que poder dar un patinete y recibir otro a la vez.
ANCLAJES_MIN = 2
STOCK_MIN = 1
CAUSAS = ("atendido", "sin_cobertura", "sin_patinete", "sin_anclaje")


def segundos(ts):
    """Segundos de reloj local desde 1970 de una serie con zona horaria."""
    local = ts.dt.tz_localize(None) if ts.dt.tz is not None else ts
    return ((local - pd.Timestamp("1970-01-01")) // pd.Timedelta("1s")).to_numpy(np.int64)


@dataclass
class Red:
    ids: np.ndarray
    lon: np.ndarray
    lat: np.ndarray
    radio: float
    entre: np.ndarray = field(repr=False)   # distancia en línea recta entre estaciones (m)

    @classmethod
    def de_tabla(cls, estaciones, radio):
        lonlat = estaciones[["lon", "lat"]].to_numpy(float)
        return cls(estaciones["station_id"].to_numpy(str), lonlat[:, 0], lonlat[:, 1], float(radio),
                   distancias(lonlat, lonlat))

    @property
    def n(self):
        return len(self.ids)


@dataclass
class Demanda:
    """Solicitudes de viaje con las estaciones accesibles de cada extremo, de cerca a lejos."""
    trip_id: np.ndarray
    t_o: np.ndarray
    t_d: np.ndarray
    opc_o: list
    dist_o: list
    opc_d: list
    dist_d: list

    @classmethod
    def de_viajes(cls, viajes, red):
        d = distancias(extremos(viajes), np.column_stack([red.lon, red.lat]))
        orden = np.argsort(d, axis=1, kind="stable")
        dist = np.take_along_axis(d, orden, axis=1)
        dentro = (dist <= red.radio).sum(axis=1)
        opc = [orden[i, :k] for i, k in enumerate(dentro)]
        dis = [dist[i, :k] for i, k in enumerate(dentro)]
        n = len(viajes)
        t_o, t_d = segundos(viajes["tsO"]), segundos(viajes["tsD"])
        if np.any(t_d < t_o):
            raise ValueError("Hay viajes que acaban antes de empezar.")
        return cls(viajes["trip_id"].to_numpy(), t_o, t_d, opc[:n], dis[:n], opc[n:], dis[n:])

    @property
    def n(self):
        return len(self.t_o)

    @property
    def cubierto(self):
        return np.array([len(o) > 0 and len(d) > 0 for o, d in zip(self.opc_o, self.opc_d)])

    def mas_cercana(self):
        """Estación más cercana de cada extremo (−1 si no hay ninguna dentro del radio)."""
        o = np.array([x[0] if len(x) else -1 for x in self.opc_o])
        d = np.array([x[0] if len(x) else -1 for x in self.opc_d])
        return o, d


def dias_naturales(dem):
    """Primer y último día natural con salidas (índice de día desde 1970)."""
    return int(dem.t_o.min() // DIA_S), int(dem.t_o.max() // DIA_S)


def dias(t, dem, hora_corte=HORA_CORTE):
    """Día de servicio de cada instante: empieza a la hora de corte.

    Lo que pasa antes del primer corte cuenta en el primer día, y lo que pasa tras el
    último día natural (viajes que acaban de madrugada), en el último.
    """
    d0, d1 = dias_naturales(dem)
    return np.clip((np.asarray(t) - hora_corte * 3600) // DIA_S, d0, d1)


def horizonte(dem, hora_corte=HORA_CORTE):
    """Inicio y fin del periodo simulado (días naturales) y cortes nocturnos intermedios."""
    d0, d1 = dias_naturales(dem)
    c = hora_corte * 3600
    return d0 * DIA_S, max((d1 + 1) * DIA_S, int(dem.t_d.max())), [d * DIA_S + c for d in range(d0 + 1, d1 + 1)]


# ---------------------------------------------------------------------------------------
# Referencia sin restricciones
# ---------------------------------------------------------------------------------------

def eventos_referencia(dem, n_est):
    """Salidas (−1) y llegadas (+1) de los viajes cubiertos en su estación más cercana."""
    o, d = dem.mas_cercana()
    ok = (o >= 0) & (d >= 0)
    ev = pd.DataFrame({
        "estacion": np.r_[o[ok], d[ok]],
        "t": np.r_[dem.t_o[ok], dem.t_d[ok]],
        "delta": np.r_[-np.ones(ok.sum(), int), np.ones(ok.sum(), int)],
    })
    # Llegadas antes que salidas en el mismo segundo.
    return ev.sort_values(["estacion", "t", "delta"], ascending=[True, True, False], kind="stable")


def referencia(dem, n_est, hora_corte=HORA_CORTE):
    """Stock mínimo y pico de inventario por estación, del mes seguido y de cada día.

    `mes`: sin rebalanceo en todo el periodo. El stock inicial es el que evita que el saldo
    acumulado llegadas − salidas sea negativo; los anclajes son el inventario máximo.
    `necesidad` y `excedente` (estaciones × días): lo mismo con el inventario repuesto cada
    noche (rebalanceo perfecto). El excedente es lo que sube el inventario sobre el de
    arranque del día.
    """
    ev = eventos_referencia(dem, n_est)
    ev["dia"] = dias(ev["t"], dem, hora_corte)
    ev["acum_mes"] = ev.groupby("estacion")["delta"].cumsum()
    ev["acum_dia"] = ev.groupby(["estacion", "dia"])["delta"].cumsum()
    g = ev.groupby("estacion")["acum_mes"]
    stock_mes = (-g.min()).clip(lower=0).reindex(range(n_est), fill_value=0)
    pico_mes = (stock_mes + g.max().reindex(range(n_est), fill_value=0).clip(lower=0)).astype(int)
    d0, d1 = dias_naturales(dem)
    columnas = pd.MultiIndex.from_product([range(n_est), range(d0, d1 + 1)])
    gd = ev.groupby(["estacion", "dia"])["acum_dia"]
    necesidad = (-gd.min()).clip(lower=0).reindex(columnas, fill_value=0).unstack()
    excedente = gd.max().clip(lower=0).reindex(columnas, fill_value=0).unstack()
    return {"stock_mes": stock_mes.astype(int).to_numpy(), "anclajes_mes": pico_mes.to_numpy(),
            "necesidad": necesidad.to_numpy(int), "excedente": excedente.to_numpy(int)}


def dimensionar(ref, cuantil):
    """Stock y anclajes por estación que cubren el cuantil de los días con rebalanceo perfecto.

    Stock = cuantil diario del stock necesario. Anclajes = stock + cuantil diario de lo
    que sube el inventario sobre el de arranque, con los mínimos del módulo.
    """
    q = lambda m: np.ceil(np.quantile(m, cuantil, axis=1) - 1e-9).astype(int)
    stock = np.maximum(q(ref["necesidad"]), STOCK_MIN)
    anclajes = np.maximum(stock + q(ref["excedente"]), ANCLAJES_MIN)
    return stock, anclajes


def repartir(pesos, total):
    """Reparte `total` patinetes en proporción a `pesos` (restos mayores, desempate estable)."""
    pesos = np.asarray(pesos, float)
    cuota = total * pesos / pesos.sum()
    base = np.floor(cuota).astype(int)
    resto = total - base.sum()
    base[np.argsort(-(cuota - base), kind="stable")[:resto]] += 1
    return base


def repartir_flota(stock_diseno, anclajes, flota):
    """Reparte una flota entre estaciones en proporción al stock de diseño, sin pasar de los
    anclajes de cada una (T34). Con la flota del diseño devuelve el stock de diseño."""
    stock_diseno = np.asarray(stock_diseno, int)
    anclajes = np.asarray(anclajes, int)
    if flota > anclajes.sum():
        raise ValueError("La flota no cabe en los anclajes.")
    stock = np.zeros_like(anclajes)
    libres = np.ones(len(anclajes), bool)
    while (falta := flota - stock.sum()) > 0:
        extra = repartir(np.where(libres, stock_diseno, 0), falta)
        stock = np.minimum(stock + extra, anclajes)
        libres = stock < anclajes
    return stock


# ---------------------------------------------------------------------------------------
# Simulación con restricciones
# ---------------------------------------------------------------------------------------

@dataclass
class Resultado:
    viajes: pd.DataFrame
    estaciones: pd.DataFrame
    noches: pd.DataFrame
    resumen: dict
    traza_carga: pd.DataFrame | None = None


def simular(dem, red, stock, anclajes, rebalanceo_max, *, desvio=True, hora_corte=HORA_CORTE,
            factor_rodeo=None, objetivo=None, prioridad=None, carga=None, cierre=None, observacion=None):
    """Simula el mes con patinetes y anclajes limitados.

    `stock` es el inventario de arranque y el objetivo del rebalanceo nocturno (salvo que
    se dé `objetivo`). `rebalanceo_max` es el máximo de patinetes que se mueven cada noche.
    `prioridad[s, stock]` da el beneficio marginal estimado de añadir una unidad.
    `cierre` es (índice de estación, inicio incluido, fin excluido) en segundos locales.
    Durante el cierre se suspenden nuevas asignaciones y se mantienen las reservas.
    `observacion` acota una ventana para medir saturación con las mismas reglas.
    """
    if factor_rodeo is None:
        factor_rodeo = cargar_config()["movilidad"]["factor_rodeo"]
    stock = np.asarray(stock, int).copy()
    cap = np.asarray(anclajes, int).copy()
    objetivo = stock.copy() if objetivo is None else np.asarray(objetivo, int)
    if np.any(stock > cap) or np.any(stock < 0):
        raise ValueError("El stock inicial no cabe en los anclajes.")
    n_est, flota = red.n, int(stock.sum())
    inv, res = stock.copy(), np.zeros(n_est, int)
    t_ini, t_fin, cortes = horizonte(dem, hora_corte)
    if cierre is not None and not 0 <= cierre[0] < n_est:
        raise ValueError("La estación cerrada no pertenece a la red.")
    ventana = observacion if observacion is not None else cierre[1:] if cierre is not None else None
    if ventana is not None and not t_ini <= ventana[0] < ventana[1] <= t_fin:
        raise ValueError("La ventana de observación debe quedar dentro del horizonte.")
    electrica = FlotaElectrica(carga, stock, t_ini, dem.n) if carga is not None else None
    if prioridad is not None:
        prioridad = np.asarray(prioridad, float)
        if prioridad.ndim != 2 or prioridad.shape[0] != n_est or prioridad.shape[1] <= objetivo.max():
            raise ValueError("La prioridad debe cubrir todas las estaciones y el stock objetivo.")

    # Acumuladores de ocupación ponderados por tiempo.
    ultimo = np.full(n_est, t_ini, np.int64)
    area_inv = np.zeros(n_est)
    t_vacia = np.zeros(n_est)
    t_llena = np.zeros(n_est)
    t_llena_ventana = np.zeros(n_est)

    def tocar(s, t):
        dt = t - ultimo[s]
        if dt:
            area_inv[s] += dt * inv[s]
            if inv[s] == 0:
                t_vacia[s] += dt
            if inv[s] + res[s] >= cap[s]:
                t_llena[s] += dt
                if ventana is not None:
                    t_llena_ventana[s] += max(0, min(t, ventana[1]) - max(ultimo[s], ventana[0]))
            ultimo[s] = t

    def comprobar(s):
        if inv[s] < 0 or inv[s] + res[s] > cap[s]:
            raise AssertionError(f"Estación {s}: inventario {inv[s]}, reservas {res[s]}, anclajes {cap[s]}")

    llegadas = []   # (t, n.º de orden, estación, unidad si se simula carga)
    resultado = np.full(dem.n, "", dtype=object)
    est_o = np.full(dem.n, -1)
    est_d = np.full(dem.n, -1)
    extra_o = np.zeros(dem.n)
    extra_d = np.zeros(dem.n)
    noches = []

    def llegar(t, s, unidad):
        tocar(s, t)
        res[s] -= 1
        inv[s] += 1
        if electrica is not None:
            electrica.llegar(unidad, s, t)
        comprobar(s)

    def rebalancear(t):
        for s in range(n_est):
            tocar(s, t)
        movidos, metros = 0, 0.0
        sobra = np.maximum(inv - objetivo, 0)
        falta = np.minimum(np.maximum(objetivo - inv, 0), cap - inv - res)
        antes = int(falta.sum())
        if cierre is not None and cierre[1] <= t < cierre[2]:
            sobra[cierre[0]] = 0
            falta[cierre[0]] = 0
        excluido = antes - int(falta.sum())
        while movidos < rebalanceo_max and falta.any() and sobra.any():
            destinos = np.flatnonzero(falta)
            if prioridad is None:
                destino = int(np.argmax(falta))
            else:
                orden = np.lexsort((-falta[destinos], -prioridad[destinos, inv[destinos]]))
                destino = int(destinos[orden[0]])
            candidatas = np.flatnonzero(sobra > 0)
            origen = int(candidatas[np.argmin(red.entre[destino, candidatas])])
            inv[origen] -= 1
            inv[destino] += 1
            sobra[origen] -= 1
            falta[destino] -= 1
            if electrica is not None:
                electrica.mover(origen, destino, t)
            movidos += 1
            metros += red.entre[origen, destino] * factor_rodeo
        for s in range(n_est):
            comprobar(s)
        if int(inv.sum() + res.sum()) != flota:
            raise AssertionError("El total de patinetes no se conserva en el rebalanceo.")
        noches.append({"corte": t, "patinetes_movidos": movidos, "km": metros / 1000,
                       "deficit_antes": antes, "deficit_despues": int(falta.sum()) + excluido,
                       "en_viaje": int(res.sum())})

    pendientes = list(cortes)

    def avanzar(hasta):
        # Llegadas y cortes hasta `hasta` incluido; en el mismo segundo, primero la llegada.
        while True:
            t_lleg = llegadas[0][0] if llegadas else None
            t_cor = pendientes[0] if pendientes else None
            if t_lleg is not None and t_lleg <= hasta and (t_cor is None or t_lleg <= t_cor):
                t, _, s, unidad = heapq.heappop(llegadas)
                llegar(t, s, unidad)
            elif t_cor is not None and t_cor <= hasta:
                rebalancear(pendientes.pop(0))
            else:
                return

    for i in np.argsort(dem.t_o, kind="stable"):
        t = int(dem.t_o[i])
        avanzar(t)
        opc_o, opc_d = dem.opc_o[i], dem.opc_d[i]
        if not len(opc_o) or not len(opc_d):
            resultado[i] = "sin_cobertura"
            continue
        limite_o = len(opc_o) if desvio else 1
        limite_d = len(opc_d) if desvio else 1
        cerrada = cierre[0] if cierre is not None and cierre[1] <= t < cierre[2] else -1
        origenes = [k for k in range(limite_o) if opc_o[k] != cerrada]
        destinos = [k for k in range(limite_d) if opc_d[k] != cerrada]
        if not origenes or not destinos:
            resultado[i] = "sin_estacion"
            continue
        con_stock = [k for k in origenes if inv[opc_o[k]] > 0]
        k_o = next(iter(con_stock), None)
        unidad = None
        if electrica is not None and con_stock:
            aptas = ((k, electrica.elegir(int(opc_o[k]), i, t)) for k in con_stock)
            k_o, unidad = next(((k, u) for k, u in aptas if u is not None), (None, None))
        if k_o is None:
            resultado[i] = "sin_bateria" if con_stock else "sin_patinete"
            continue
        o = int(opc_o[k_o])

        def libre(s):
            return cap[s] - inv[s] - res[s] + (1 if s == o else 0)

        k_d = next((k for k in destinos if libre(int(opc_d[k])) > 0), None)
        if k_d is None:
            resultado[i] = "sin_anclaje"
            continue
        d = int(opc_d[k_d])
        tocar(o, t)
        inv[o] -= 1
        tocar(d, t)
        res[d] += 1
        comprobar(o)
        comprobar(d)
        if electrica is not None:
            electrica.viajar(unidad, o, t, i)
        heapq.heappush(llegadas, (int(dem.t_d[i]), int(i), d, unidad))
        resultado[i] = "atendido"
        est_o[i], est_d[i] = o, d
        extra_o[i] = dem.dist_o[i][k_o] - dem.dist_o[i][0]
        extra_d[i] = dem.dist_d[i][k_d] - dem.dist_d[i][0]

    avanzar(t_fin)
    for s in range(n_est):
        tocar(s, t_fin)
    if llegadas or res.any() or int(inv.sum()) != flota:
        raise AssertionError("Al final del periodo quedan patinetes sin devolver o el total no cuadra.")
    if (resultado == "").any():
        raise AssertionError("Hay solicitudes sin resultado.")

    viajes = pd.DataFrame({
        "trip_id": dem.trip_id, "resultado": resultado,
        "estacion_origen": np.where(est_o >= 0, red.ids[est_o], ""),
        "estacion_destino": np.where(est_d >= 0, red.ids[est_d], ""),
        "desvio_origen_m": extra_o, "desvio_destino_m": extra_d,
    })
    atendido = resultado == "atendido"
    duracion = t_fin - t_ini
    n_dias = duracion / DIA_S
    salidas = np.bincount(est_o[atendido], minlength=n_est)
    llegadas_est = np.bincount(est_d[atendido], minlength=n_est)
    estaciones = pd.DataFrame({
        "station_id": red.ids, "lon": red.lon, "lat": red.lat,
        "stock_inicial": stock, "anclajes": cap,
        "salidas": salidas, "llegadas": llegadas_est,
        "rotacion_dia": salidas / cap / n_dias,
        "ocupacion_media_pct": 100 * area_inv / duracion / cap,
        "pct_tiempo_vacia": 100 * t_vacia / duracion,
        "pct_tiempo_llena": 100 * t_llena / duracion,
        "stock_final": inv.copy(),
    })
    if ventana is not None:
        estaciones["pct_llena_ventana"] = 100 * t_llena_ventana / (ventana[1] - ventana[0])
    causas = CAUSAS + (("sin_bateria",) if electrica is not None else ()) + (("sin_estacion",) if cierre is not None else ())
    cuenta = pd.Series(resultado).value_counts().reindex(causas, fill_value=0)
    cubiertos = dem.n - int(cuenta["sin_cobertura"])
    horas_viaje = float((dem.t_d[atendido] - dem.t_o[atendido]).sum()) / 3600
    noches = pd.DataFrame(noches, columns=["corte", "patinetes_movidos", "km", "deficit_antes",
                                           "deficit_despues", "en_viaje"])
    resumen = {
        "flota": flota, "anclajes": int(cap.sum()), "rebalanceo_max": rebalanceo_max, "desvio": desvio,
        "solicitudes": dem.n, "cubiertas": cubiertos,
        **{f"n_{c}": int(cuenta[c]) for c in causas},
        "pct_atendidos_cubiertos": 100 * cuenta["atendido"] / max(cubiertos, 1),
        "pct_atendidos_total": 100 * cuenta["atendido"] / dem.n,
        "viajes_con_desvio": int(((extra_o > 0) | (extra_d > 0))[atendido].sum()),
        "desvio_medio_m": float((extra_o + extra_d)[atendido & ((extra_o > 0) | (extra_d > 0))].mean())
        if ((extra_o > 0) | (extra_d > 0))[atendido].any() else 0.0,
        "dias": n_dias,
        "viajes_por_patinete_dia": cuenta["atendido"] / max(flota, 1) / n_dias,
        "pct_tiempo_en_viaje": 100 * horas_viaje / max(flota, 1) / (duracion / 3600),
        "patinetes_movidos": int(noches["patinetes_movidos"].sum()),
        "km_rebalanceo": float(noches["km"].sum()),
    }
    traza = None
    if electrica is not None:
        resumen.update(electrica.balance(t_fin, inv))
        if electrica.traza is not None:
            traza = pd.DataFrame(electrica.traza, columns=["unidad", "t", "estacion", "evento", "energia_wh"])
    return Resultado(viajes, estaciones, noches, resumen, traza)
