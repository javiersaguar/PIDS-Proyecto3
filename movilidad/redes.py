"""Modelos de localización y evaluación de viajes sobre el catálogo de T24."""

from collections import Counter
from dataclasses import dataclass
from math import ceil, floor
from time import perf_counter

import numpy as np
import pandas as pd
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import coo_array, csr_array, vstack
from scipy.spatial.distance import cdist

from comun.config import cargar_config, carpeta_tablas
from comun.datos import cargar_viajes
from comun.geo import RADIO_TIERRA_M

TABLAS = carpeta_tablas("movilidad")
OBJETIVO_PCT = 80
RADIOS = tuple(cargar_config()["movilidad"]["radios_acceso_m"])
RADIOS_PRINCIPALES = tuple(r for r in RADIOS if r <= 300)
METODOS = {
    "lscp": "Cobertura parcial (LSCP)",
    "mclp": "Cobertura máxima OD (MCLP)",
    "pmediana": "p-mediana",
    "voraz": "Voraz por extremos",
    "kmedoids": "K-medoids",
    "kmeans": "K-means a candidatos",
}


def guardar(df, nombre):
    df.to_csv(TABLAS / f"{nombre}.csv", index=False, lineterminator="\n", float_format="%.9f")


def leer(nombre):
    return pd.read_csv(TABLAS / f"{nombre}.csv", dtype={"station_id": str, "candidate_id": str})


def catalogo():
    df = leer("T24_candidatos")
    return df.loc[df["incluido_barrido"]].sort_values("candidate_id").reset_index(drop=True)


def esfera(puntos):
    lon, lat = np.radians(np.asarray(puntos)).T
    return np.column_stack((np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)))


def distancias(a, b):
    d = cdist(esfera(a), esfera(b))
    np.minimum(d / 2, 1, out=d)
    np.arcsin(d, out=d)
    return d * (2 * RADIO_TIERRA_M)


def extremos(viajes):
    return np.vstack([viajes[["lonO", "latO"]], viajes[["lonD", "latD"]]])


def cobertura_split(distancia, radio):
    o, d = np.split(distancia <= radio, 2)
    return o, d, o & d


def indicadores(distancia, radio):
    origen, destino = np.split(distancia, 2)
    o, d, ambos = cobertura_split(distancia, radio)
    return {
        "viajes": len(o), "viajes_cubiertos": int(ambos.sum()),
        "viajes_un_extremo": int((o ^ d).sum()), "viajes_sin_cobertura": int((~o & ~d).sum()),
        "pct_viajes_cubiertos": 100 * ambos.mean(),
        "pct_origenes_cubiertos": 100 * o.mean(), "pct_destinos_cubiertos": 100 * d.mean(),
        "d_media_m": distancia.mean(), "d_p90_m": np.quantile(distancia, .9),
        "d_origen_p90_m": np.quantile(origen, .9), "d_destino_p90_m": np.quantile(destino, .9),
    }


@dataclass
class Problema:
    candidatos: pd.DataFrame
    viajes: pd.DataFrame
    distancia: np.ndarray

    @classmethod
    def del_ajuste(cls):
        c = catalogo()
        viajes = cargar_viajes(periodo="ajuste")
        return cls(c, viajes, distancias(extremos(viajes), c[["lon", "lat"]]))

    @property
    def n(self):
        return len(self.candidatos)

    @property
    def objetivo(self):
        return ceil(len(self.viajes) * OBJETIVO_PCT / 100)

    def medir(self, abiertos, radio):
        return indicadores(self.distancia[:, abiertos].min(axis=1), radio)

    def estaciones(self, abiertos, red_id):
        return (self.candidatos.iloc[np.sort(abiertos)][["candidate_id", "lon", "lat"]]
                .rename(columns={"candidate_id": "station_id"}).assign(network_id=red_id)
                [["network_id", "station_id", "lon", "lat"]])

    def indices(self, ids):
        por_id = pd.Series(self.candidatos.index, index=self.candidatos["candidate_id"])
        return np.sort(por_id.loc[ids].to_numpy())


class CoberturaOD:
    """Agrupa las parejas de conjuntos accesibles que tienen la misma restricción."""

    def __init__(self, p, radio):
        self.n = p.n
        self.radio = radio
        self.alcance = csr_array(p.distancia <= radio, dtype=np.int32)
        n = len(p.viajes)
        self.O = self.alcance[:n].tocsr()
        self.D = self.alcance[n:].tocsr()
        conjuntos = [tuple(self.alcance.indices[a:b])
                     for a, b in zip(self.alcance.indptr[:-1], self.alcance.indptr[1:])]
        iguales = Counter(tuple(sorted((o, d))) for o, d in zip(conjuntos[:n], conjuntos[n:]) if o and d)
        self.pesos = np.array(list(iguales.values()), dtype=float)
        filas, columnas, coef = [], [], []
        f = 0
        for j, (o, d) in enumerate(iguales):
            for extremos_g in (o,) if o == d else (o, d):
                filas.extend([f] * (len(extremos_g) + 1))
                columnas.extend([*extremos_g, self.n + j])
                coef.extend([-1] * len(extremos_g) + [1])
                f += 1
        self.restricciones_od = coo_array((coef, (filas, columnas)), shape=(f, self.n + len(iguales))).tocsc()

    def cubiertos(self, indices):
        o = np.asarray(self.O[:, indices].sum(axis=1)).ravel() > 0
        d = np.asarray(self.D[:, indices].sum(axis=1)).ravel() > 0
        return int((o & d).sum())

    def voraz(self):
        """Prefijos de cobertura de extremos con el mismo catálogo y radio."""
        por_estacion = self.alcance.tocsc()
        ganancia = np.asarray(self.alcance.sum(axis=0)).ravel()
        quedan = np.ones(self.alcance.shape[0], dtype=bool)
        elegidas, cubiertos = [], []
        n = self.O.shape[0]
        for _ in range(self.n):
            nuevo = int(np.argmax(ganancia))
            elegidas.append(nuevo)
            filas = por_estacion.indices[por_estacion.indptr[nuevo]:por_estacion.indptr[nuevo + 1]]
            nuevas = filas[quedan[filas]]
            quedan[nuevas] = False
            ganancia -= np.asarray(self.alcance[nuevas].sum(axis=0)).ravel()
            ganancia[nuevo] = -1
            cubiertos.append(int((~quedan[:n] & ~quedan[n:]).sum()))
        return np.array(elegidas), np.array(cubiertos)

    def intercambiar(self, red, pasos=20):
        """Mejora OD factible mediante intercambios de una estación."""
        red = np.sort(red).copy()
        libre = np.ones(self.n, dtype=bool)
        libre[red] = False
        cod_o = np.asarray(self.O[:, red].sum(axis=1)).ravel()
        cod_d = np.asarray(self.D[:, red].sum(axis=1)).ravel()
        C_o, C_d = self.O.tocsc(), self.D.tocsc()
        ambos_lados = self.O.multiply(self.D).tocsr()
        for _ in range(pasos):
            cubierto = (cod_o > 0) & (cod_d > 0)
            actual = int(cubierto.sum())
            unico_o, unico_d = cubierto & (cod_o == 1), cubierto & (cod_d == 1)
            perdidas = (np.asarray(self.O[unico_o].sum(axis=0)).ravel()
                        + np.asarray(self.D[unico_d].sum(axis=0)).ravel()
                        - np.asarray(ambos_lados[unico_o & unico_d].sum(axis=0)).ravel())
            mejor = actual
            cambio = None
            for idx in np.argsort(perdidas[red], kind="stable")[:10]:
                sale = int(red[idx])
                filas_o = C_o.indices[C_o.indptr[sale]:C_o.indptr[sale + 1]]
                filas_d = C_d.indices[C_d.indptr[sale]:C_d.indptr[sale + 1]]
                cod_o[filas_o] -= 1
                cod_d[filas_d] -= 1
                o, d = cod_o > 0, cod_d > 0
                ganancia = (np.asarray(self.O[~o & d].sum(axis=0)).ravel()
                            + np.asarray(self.D[o & ~d].sum(axis=0)).ravel()
                            + np.asarray(ambos_lados[~o & ~d].sum(axis=0)).ravel())
                entra = int(np.argmax(np.where(libre, ganancia, -1)))
                total = actual - perdidas[sale] + ganancia[entra]
                if libre[entra] and total > mejor:
                    mejor = total
                    cambio = (idx, sale, entra)
                cod_o[filas_o] += 1
                cod_d[filas_d] += 1
            if cambio is None:
                break
            idx, sale, entra = cambio
            for col, valores in ((C_o, cod_o), (C_d, cod_d)):
                valores[col.indices[col.indptr[sale]:col.indptr[sale + 1]]] -= 1
                valores[col.indices[col.indptr[entra]:col.indptr[entra + 1]]] += 1
            red[idx] = entra
            libre[sale], libre[entra] = True, False
        return np.sort(red)

    def resolver(self, semilla, limite, *, objetivo=None):
        """Resuelve LSCP parcial o MCLP, conservando una solución factible comprobada."""
        ls = objetivo is not None
        semilla = np.sort(semilla)
        nc = self.n + len(self.pesos)
        ceros = np.zeros(self.n)
        coste_viajes = np.r_[ceros, self.pesos]
        cuenta = np.r_[np.ones(self.n), np.zeros(len(self.pesos))]
        coste = cuenta if ls else -coste_viajes
        pesos_min = objetivo if ls else self.cubiertos(semilla)
        a = vstack([self.restricciones_od, csr_array(cuenta.reshape(1, -1)),
                    csr_array(coste_viajes.reshape(1, -1))]).tocsc()
        lb = np.r_[np.full(self.restricciones_od.shape[0], -np.inf),
                   1 if ls else len(semilla), pesos_min]
        ub = np.r_[np.zeros(self.restricciones_od.shape[0]), len(semilla), np.inf]
        inicio = perf_counter()
        res = milp(
            coste, integrality=cuenta, bounds=Bounds(np.zeros(nc), np.ones(nc)),
            constraints=LinearConstraint(a, lb, ub),
            options={"time_limit": limite, "mip_rel_gap": 0.005},
        )
        t = perf_counter() - inicio
        elegida, origen = semilla, "heuristica OD"
        if res.x is not None:
            abierta = np.flatnonzero(res.x[:self.n] > .5)
            cubre = self.cubiertos(abierta)
            if (ls and cubre >= objetivo and len(abierta) <= len(semilla)) or (
                not ls and len(abierta) == len(semilla) and cubre >= pesos_min
            ):
                elegida, origen = abierta, "MILP"
        dual = getattr(res, "mip_dual_bound", None)
        fuente = "MILP"
        if dual is None or not np.isfinite(dual):
            lp = milp(coste, bounds=Bounds(np.zeros(nc), np.ones(nc)),
                      constraints=LinearConstraint(a, lb, ub), options={"time_limit": 3.0})
            if lp.success:
                dual, fuente = lp.fun, "relajacion lineal"
            else:
                dual, fuente = None, "cota por extremos"
        # Un viaje cubierto necesita un origen y un destino cubiertos. Sumar
        # capacidades individuales es optimista: cuenta también duplicados.
        acumuladas = [np.r_[0, np.cumsum(np.sort(np.asarray(m.sum(axis=0)).ravel())[::-1])]
                      for m in (self.O, self.D)]
        if ls:
            valor = len(elegida)
            por_extremos = max(int(np.searchsorted(c, objetivo)) for c in acumuladas)
            cota = max(por_extremos, ceil(dual - 1e-6)) if dual is not None else por_extremos
            cota = min(valor, cota)
        else:
            valor = self.cubiertos(elegida)
            cota = min(int(self.pesos.sum()), *(int(c[len(semilla)]) for c in acumuladas))
            if dual is not None:
                cota = max(valor, min(cota, floor(-dual + 1e-6)))
        return elegida, {**calidad(res.status, origen, valor, cota, limite, t), "fuente_cota": fuente}


def calidad(status, origen, valor, cota, limite, t):
    brecha = 100 * abs(valor - cota) / max(abs(valor), 1e-12) if cota is not None else None
    return {
        "estado_solver": {0: "tolerancia solver", 1: "limite", 2: "inviable", 3: "no acotado"}.get(status, "otro"),
        "origen_solucion": origen,
        "obj_factible": valor, "cota_obj": cota, "brecha_pct": brecha,
        "limite_s": limite, "solver_s": round(t, 3),
        "optimalidad_probada": bool(brecha is not None and brecha < 1e-7),
    }


def semillas_pmediana(dist, pesos, kmax):
    """Añade la estación que más reduce la distancia ponderada a cada celda."""
    cercania = np.full(len(dist), dist.max() + 1)
    elegidas = []
    for _ in range(kmax):
        ahorros = np.sum(np.maximum(cercania[:, None] - dist, 0) * pesos[:, None], axis=0)
        ahorros[elegidas] = -1
        i = int(ahorros.argmax())
        elegidas.append(i)
        cercania = np.minimum(cercania, dist[:, i])
    return np.array(elegidas)


def pmediana(dist, pesos, semilla, limite, vecinos=16):
    """Acota la p-mediana completa con asignaciones cercanas y una cota para el resto.

    El flujo residual paga la distancia al siguiente candidato. Es una relajación
    válida y aporta una cota inferior para todos los candidatos. La red abierta
    se evalúa con distancias completas, incluida cualquier asignación lejana.
    """
    n = len(dist)
    l = min(n, vecinos)
    dorden = np.argsort(dist, axis=1, kind="stable")
    opciones = dorden[:, :l]
    costes = np.take_along_axis(dist, opciones, axis=1)
    d_residual = dist[np.arange(n), dorden[:, l]] if l < n else np.zeros(n)
    pesos = np.asarray(pesos, dtype=float) / np.sum(pesos)
    c = np.r_[np.zeros(n), (costes * pesos[:, None]).ravel(), d_residual * pesos]
    n_asig = n * l
    x_asig = n + np.arange(n_asig)
    i_asig = 1 + np.repeat(np.arange(n), l)
    x_res = n + n_asig + np.arange(n)
    fila_apertura = 1 + n + np.arange(n_asig)
    fil = np.r_[np.zeros(n, dtype=int), i_asig, 1 + np.arange(n), fila_apertura, fila_apertura]
    col = np.r_[np.arange(n), x_asig, x_res, x_asig, opciones.ravel()]
    val = np.r_[np.ones(n + n_asig + n + n_asig), -np.ones(n_asig)]
    a = coo_array((val, (fil, col)), shape=(1 + n + n_asig, len(c))).tocsc()
    k = len(semilla)
    lb = np.r_[k, np.ones(n), np.full(n_asig, -np.inf)]
    ub = np.r_[k, np.ones(n), np.zeros(n_asig)]
    tipo = np.r_[np.ones(n), np.zeros(len(c) - n)]
    sup = np.ones(len(c))
    if l == n:
        sup[x_res] = 0
    inicio = perf_counter()
    res = milp(c, integrality=tipo, bounds=Bounds(np.zeros(len(c)), sup),
               constraints=LinearConstraint(a, lb, ub),
               options={"time_limit": limite, "mip_rel_gap": 0.005})
    t = perf_counter() - inicio

    def coste(red):
        return float(dist[:, red].min(axis=1) @ pesos)

    elegida, origen = np.sort(semilla), "voraz distancia"
    valor = coste(elegida)
    if res.x is not None:
        candidata = np.flatnonzero(res.x[:n] > .5)
        if len(candidata) == k and coste(candidata) <= valor:
            elegida, origen = candidata, "MILP"
            valor = coste(candidata)
    dual = getattr(res, "mip_dual_bound", None)
    dual = max(0., min(valor, float(dual))) if dual is not None and np.isfinite(dual) else 0.
    return elegida, {**calidad(res.status, origen, valor, dual, limite, t), "fuente_cota": "MILP relajado"}
