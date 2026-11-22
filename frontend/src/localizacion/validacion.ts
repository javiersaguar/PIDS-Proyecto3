import { useCallback, useEffect, useMemo, useState } from "react";
import { useDatos } from "../datos";
import type { Punto } from "../mapa/datos";
import type { DatosT24, Marcador } from "./modelo";

export type Periodo = "ajuste" | "reservada";
export type Sector = "ambos" | "tiber" | "termini";
export type Rol = "recomendada" | "menos_estaciones" | "radio_menor";
export const PERIODOS: Record<Periodo, string> = { ajuste: "Periodo de ajuste", reservada: "Semana reservada" };
export const SECTORES: Record<Sector, string> = { ambos: "Tíber y Termini", tiber: "Tíber · Trastevere", termini: "Termini · corredor ferroviario" };
export const ROLES: Record<Rol, string> = { recomendada: "Red elegida", menos_estaciones: "Menos estaciones", radio_menor: "Radio menor" };

export type RedFinal = {
  network_id: string;
  rol: Rol;
  metodo: string;
  radio_m: number;
  k: number;
  estaciones: string[];
};

export type Geometria = {
  network_id: string;
  periodo: Periodo;
  viajes: number;
  viajes_dia: number;
  viajes_cubiertos: number;
  pct_viajes_cubiertos: number;
  d_p90_m: number;
};

export type Peatonal = {
  network_id: string;
  periodo: Periodo;
  sector: Sector;
  viajes_sector: number;
  viajes_comparables: number;
  viajes_sin_par_rutas: number;
  linea_cubiertos: number;
  a_pie_cubiertos: number;
  a_pie_total_verificados: number;
  pct_linea: number | null;
  pct_a_pie: number | null;
  delta_pp: number | null;
  p90_linea_m: number | null;
  p90_a_pie_m: number | null;
  cambios_estacion: number;
  extremos_asignables_ambos: number;
};

export type CasoPeatonal = {
  network_id: string;
  periodo: Periodo;
  sector: Exclude<Sector, "ambos">;
  station_id: string;
  extremo: "origen" | "destino";
  camino: Punto[];
  recta: Punto[];
  d_a_pie_m: number;
  d_recta_m: number;
};

export type SectorMapa = {
  id: Exclude<Sector, "ambos">;
  nucleo: [number, number, number, number];
  fuentes: { url: string; fecha: string }[];
};

export type Barrido = {
  network_id: string;
  metodo: string;
  k: number;
  radio_m: number;
  pct_viajes_cubiertos: number;
  d_p90_m: number;
  pareto_radio: boolean;
};

export type ResultadoSolver = {
  network_id: string;
  metodo: string;
  k: number;
  radio_m: number;
  pct_viajes_cubiertos: number;
  obj_factible: number;
  cota_obj: number | null;
  brecha_pct: number | null;
  solver_s: number;
  origen_solucion: string;
  estado_solver: string;
  optimalidad_probada: boolean;
};

export type DatosValidacion = {
  seleccionada: string;
  objetivo_pct: number;
  huella_redes: string;
  periodos: Record<Periodo, { inicio: string; fin: string; dias: number; viajes: number; viajes_dia: number }>;
  metodos: Record<string, string>;
  redes: RedFinal[];
  geometria: Geometria[];
  peatonal: Peatonal[];
  ejemplos: CasoPeatonal[];
  sectores: SectorMapa[];
  barrido: Barrido[];
  lscp: ResultadoSolver[];
  solver: ResultadoSolver[];
};

function leerRuta(ruta: string) {
  const [periodo, sector, id] = ruta.split("/");
  return {
    periodo: (periodo === "reservada" ? "reservada" : "ajuste") as Periodo,
    sector: (sector === "tiber" || sector === "termini" ? sector : "ambos") as Sector,
    redId: id ?? "",
    candidatoId: null as string | null,
  };
}

export function enlaceValidacion(periodo: Periodo, sector: Sector, networkId: string) {
  return ["#", "mapa", "validacion", periodo, sector, networkId].join("/");
}

export function useValidacionRed(activa = true, ruta = "") {
  const { datos, error } = useDatos<DatosValidacion>("fase1/t30_validacion_red", activa);
  const t24 = useDatos<DatosT24>("fase1/t24_candidatos", activa);
  const [sel, cambiar] = useState(() => leerRuta(ruta));
  useEffect(() => cambiar(leerRuta(ruta)), [ruta]);
  const red = datos?.redes.find((r) => r.network_id === (sel.redId || datos.seleccionada))
    ?? datos?.redes.find((r) => r.network_id === datos.seleccionada);
  const geo = datos?.geometria.find((r) => r.network_id === red?.network_id && r.periodo === sel.periodo);
  const pie = datos?.peatonal.find((r) => r.network_id === red?.network_id && r.periodo === sel.periodo && r.sector === sel.sector);
  const caso = datos?.ejemplos.find((r) => r.network_id === red?.network_id && r.periodo === sel.periodo && r.sector === sel.sector);
  const visibles = useMemo(() => datos?.sectores.filter((s) => sel.sector === "ambos" || sel.sector === s.id) ?? [],
    [datos, sel.sector]);
  const marcadores = useMemo<Marcador[]>(() => {
    if (!activa || !red || !t24.datos) return [];
    const ids = new Set(red.estaciones);
    return t24.datos.candidatos.filter((c) => ids.has(c.candidate_id)).map((c) => ({ candidato: c, grupo: "finalista" }));
  }, [activa, red, t24.datos]);
  const elegido = marcadores.find((m) => m.candidato.candidate_id === sel.candidatoId)?.candidato;
  const elegir = useCallback((id: string | null) => cambiar((s) => ({ ...s, candidatoId: id })), []);
  const cambiarSector = useCallback((sector: Sector) => cambiar((s) => ({ ...s, sector, candidatoId: null })), []);

  return {
    datos, error: error ?? t24.error, red, geo, pie, caso, visibles, marcadores, elegido,
    periodo: sel.periodo, sector: sel.sector, elegir, cambiarSector,
    cambiarPeriodo: (periodo: Periodo) => cambiar((s) => ({ ...s, periodo })),
    cambiarRed: (redId: string) => cambiar((s) => ({ ...s, redId, candidatoId: null })),
  };
}

export type EstadoValidacion = ReturnType<typeof useValidacionRed>;

export function contornoSector({ nucleo: [o, s, e, n] }: SectorMapa): Punto[] {
  return [[o,s], [e,s], [e,n], [o,n], [o,s]];
}
