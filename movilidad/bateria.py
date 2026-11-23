"""Baterías por vehículo con carga lineal mientras la unidad ocupa un anclaje."""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Carga:
    consumo_wh: np.ndarray
    capacidad_wh: float
    horas_recarga: float
    reserva_pct: float = 0


class FlotaElectrica:
    def __init__(self, carga, stock, inicio, viajes):
        consumo = np.asarray(carga.consumo_wh, dtype=float)
        if (consumo.shape != (viajes,) or not np.isfinite(consumo).all() or np.any(consumo < 0)
                or not np.isfinite([carga.capacidad_wh, carga.horas_recarga, carga.reserva_pct]).all()
                or carga.capacidad_wh <= 0 or carga.horas_recarga <= 0 or not 0 <= carga.reserva_pct < 100):
            raise ValueError("Parámetros de batería o consumos por viaje inválidos.")
        self.consumo = consumo
        self.capacidad = carga.capacidad_wh
        self.reserva = self.capacidad * carga.reserva_pct / 100
        self.wh_por_s = self.capacidad / (3600 * carga.horas_recarga)
        self.energia = np.full(stock.sum(), self.capacidad, dtype=float)
        self.desde = np.full(stock.sum(), inicio, dtype=np.int64)
        cortes = np.r_[0, stock.cumsum()]
        self.unidades = [set(range(a, b)) for a, b in zip(cortes[:-1], cortes[1:])]
        self.recargada = 0.
        self.gastada = 0.

    def nivel(self, unidad, t):
        return min(self.capacidad, self.energia[unidad] + (t - self.desde[unidad]) * self.wh_por_s)

    def elegir(self, estacion, viaje, t):
        minimo = self.consumo[viaje] + self.reserva
        niveles = ((self.nivel(u, t), u) for u in self.unidades[estacion])
        # Primero la unidad suficiente de menor carga, reservando las más cargadas.
        return min(((nivel, u) for nivel, u in niveles if nivel + 1e-9 >= minimo),
                   default=(0., None))[1]

    def salir(self, unidad, estacion, t):
        nivel = self.nivel(unidad, t)
        self.recargada += nivel - self.energia[unidad]
        self.energia[unidad] = nivel
        self.unidades[estacion].remove(unidad)

    def viajar(self, unidad, estacion, t, viaje):
        self.salir(unidad, estacion, t)
        self.energia[unidad] -= self.consumo[viaje]
        self.gastada += self.consumo[viaje]
        assert self.energia[unidad] >= -1e-8

    def llegar(self, unidad, estacion, t):
        self.desde[unidad] = t
        self.unidades[estacion].add(unidad)

    def mover(self, origen, destino, t):
        unidad = min(self.unidades[origen], key=lambda u: (-self.nivel(u, t), u))
        self.salir(unidad, origen, t)
        self.llegar(unidad, destino, t)

    def balance(self, t, inventario):
        assert np.array_equal(inventario, [len(s) for s in self.unidades])
        final = sum(self.nivel(u, t) for s in self.unidades for u in s)
        recarga = self.recargada + final - self.energia.sum()
        pendiente = self.capacidad * len(self.energia) - final
        assert np.isclose(self.gastada, recarga + pendiente)
        return {"traccion_kwh": self.gastada / 1000, "recargada_kwh": recarga / 1000,
                "pendiente_kwh": pendiente / 1000,
                "soc_final_pct": 100 * final / (self.capacidad * len(self.energia)) if len(self.energia) else None}
