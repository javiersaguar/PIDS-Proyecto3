"""Cotas independientes para las soluciones conservadas de T26 y T27."""

from dataclasses import dataclass
from time import perf_counter

import numpy as np
import pandas as pd
from scipy.optimize import linprog
from scipy.sparse import coo_array, csc_array, csr_array, vstack

from redes import CoberturaOD, Problema, guardar, leer

ESCALA_DUAL = 10**9
LIMITE_LP_S = 20


def dual_en_enteros(c, a, b, u, q=None, k=None, v=None):
    """Evalúa una cota inferior válida con aritmética entera.

    Para Ax <= b, u <= 0, y Qx = k, el coste se descompone en
    (c - A.T u - Q.T v) x + u Ax + v Qx. En la caja [0,1],
    el primer bloque está acotado por la suma de residuos negativos.
    Los multiplicadores se expresan en milmillonésimas. Redondearlos
    conserva la cota porque solo se exige el signo de u.
    """
    margen = np.minimum(u, 0)
    maximo = max(np.max(np.abs(margen), initial=0), np.max(np.abs(v), initial=0) if v is not None else 0)
    peso = int(np.abs(a.data).sum()) + int(np.abs(b).sum())
    if q is not None:
        peso += int(np.abs(q.data).sum()) + int(np.abs(k).sum())
    limite = (peso * (maximo + 1) + int(np.abs(c).sum())) * ESCALA_DUAL
    if not np.isfinite(limite) or limite >= np.iinfo(np.int64).max:
        raise ValueError("Los multiplicadores superan el intervalo de la comprobación entera.")
    mult = np.rint(ESCALA_DUAL * margen).astype(np.int64)
    valor = int(mult @ b)
    residuo = ESCALA_DUAL * c - a.T @ mult
    if q is not None:
        igual = np.rint(ESCALA_DUAL * v).astype(np.int64)
        valor += int(igual @ k)
        residuo -= q.T @ igual
    return valor + int(np.minimum(residuo, 0).sum())


@dataclass
class RelajacionOD:
    """Comparte cada conjunto accesible entre todos los grupos que lo usan."""

    a: csc_array
    cuenta: np.ndarray
    demanda: np.ndarray
    conjuntos: int

    @classmethod
    def desde(cls, modelo):
        patrones = sorted({v for par in modelo.grupos for v in par})
        local = {v: i for i, v in enumerate(patrones)}
        n, m, g = modelo.n, len(patrones), len(modelo.grupos)
        filas, columnas, valores = [], [], []
        for i, estaciones in enumerate(patrones):
            filas.extend([i] * (len(estaciones) + 1))
            columnas.extend([*estaciones, n + i])
            valores.extend([-1] * len(estaciones) + [1])
        fila = m
        for j, (origen, destino) in enumerate(modelo.grupos):
            for i in sorted({local[origen], local[destino]}):
                filas.extend([fila, fila])
                columnas.extend([n + i, n + m + j])
                valores.extend([-1, 1])
                fila += 1
        a = coo_array((valores, (filas, columnas)), shape=(fila, n + m + g), dtype=np.int64).tocsc()
        cuenta = np.r_[np.ones(n, dtype=np.int64), np.zeros(m + g, dtype=np.int64)]
        demanda = np.r_[np.zeros(n + m, dtype=np.int64), modelo.pesos.astype(np.int64)]
        return cls(a, cuenta, demanda, m)

    def resolver(self, objetivo=None, presupuesto=None):
        b = np.zeros(self.a.shape[0], dtype=np.int64)
        if objetivo is not None:
            c = self.cuenta
            a = vstack([self.a, csr_array(-self.demanda.reshape(1, -1))]).tocsc()
            b = np.r_[b, -objetivo]
            q, k = None, None
        else:
            c, a = -self.demanda, self.a
            q, k = csc_array(self.cuenta.reshape(1, -1)), np.array([presupuesto], dtype=np.int64)
        inicio = perf_counter()
        result = linprog(c, A_ub=a, b_ub=b, A_eq=q, b_eq=k, bounds=(0, 1),
                         method="highs-ipm", options={"time_limit": LIMITE_LP_S})
        segundos = round(perf_counter() - inicio, 3)
        datos = {"estado_lp": int(result.status), "segundos_lp": segundos,
                 "grupos_acceso": self.conjuntos, "cota_lp_verificada": None, "cota_entera_lp": None}
        if result.success:
            v = result.eqlin.marginals if q is not None else None
            inferior = dual_en_enteros(c, a, b, result.ineqlin.marginals, q, k, v)
            assert inferior / ESCALA_DUAL <= result.fun + 1e-6
            datos["cota_lp_verificada"] = (inferior if objetivo is not None else -inferior) / ESCALA_DUAL
            datos["cota_entera_lp"] = -(-inferior // ESCALA_DUAL) if objetivo is not None else (-inferior // ESCALA_DUAL)
        return datos


def auditar():
    p = Problema.del_ajuste()
    t26, t27 = leer("T26_resultados"), leer("T27_resultados")
    estaciones = pd.concat([leer("T26_redes"), leer("T27_redes")], ignore_index=True)
    posiciones = estaciones.groupby("network_id")["station_id"].agg(list)
    lscp, mclp = [], []
    for r in t26.itertuples():
        modelo = CoberturaOD(p, r.radio_m)
        lp = RelajacionOD.desde(modelo)
        numero = modelo.cubiertos(p.indices(posiciones.loc[r.network_id]))
        assert numero == r.viajes_cubiertos and numero >= r.objetivo_viajes
        cert = lp.resolver(objetivo=r.objetivo_viajes)
        inferior = max([int(r.cota_obj)] + ([cert["cota_entera_lp"]] if cert["cota_entera_lp"] is not None else []))
        assert inferior <= r.k
        lscp.append({
            "network_id": r.network_id, "radio_m": r.radio_m, "k_factible": r.k, "k_voraz": r.k_voraz,
            "objetivo_viajes": r.objetivo_viajes, "viajes_cubiertos": numero,
            "viajes_margen": numero - r.objetivo_viajes, "cota_previa": int(r.cota_obj),
            "cota_inferior": inferior, "brecha_estaciones": r.k - inferior,
            "origen_solucion": r.origen_solucion, **cert,
        })
        for red in t27.loc[t27["metodo"].eq("mclp") & t27["radio_m"].eq(r.radio_m)].itertuples():
            cubiertos = modelo.cubiertos(p.indices(posiciones.loc[red.network_id]))
            assert cubiertos == red.viajes_cubiertos
            cert = lp.resolver(presupuesto=red.k)
            superior = min([int(red.cota_obj)] + ([cert["cota_entera_lp"]] if cert["cota_entera_lp"] is not None else []))
            assert cubiertos <= superior
            mclp.append({
                "network_id": red.network_id, "radio_m": red.radio_m, "k": red.k,
                "viajes_cubiertos": cubiertos, "cota_previa": int(red.cota_obj),
                "cota_superior": superior, "brecha_viajes": superior - cubiertos, **cert,
            })
        print(f"Cotas auditadas a {r.radio_m} m", flush=True)
    guardar(pd.DataFrame(lscp), "T26_certificados")
    guardar(pd.DataFrame(mclp), "T27_certificados")


if __name__ == "__main__":
    auditar()
