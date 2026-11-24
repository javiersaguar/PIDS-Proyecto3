// Forma de public/datos.json (lo genera scripts/datos.mjs).
export type Datos = {
  consumo: { a_wh_km: number; a_kwh_dia: number; b_kwh_dia: number; cambia_estacion: boolean };
  embudo: {
    brutos: number;
    elegibles: number;
    pasos: { regla: string; descripcion: string; excluidos: number; quedan: number }[];
    periodos: { periodo: string; elegibles: number }[];
  };
  perfil: { horas: number[]; laborable: number[]; fin_de_semana: number[] };
  od: { viajes: number; pares: number; pct_intrazonal: number; pct_top20: number; asimetria: number; asimetria_azar: number };
  pareto: { id: string; metodo: string; radio: number; k: number; pct: number }[];
  finalistas: { id: string; rol: string; radio: number; k: number; pct: number; p90: number }[];
  red: { id: string; radio: number; k: number; pct: number; p90: number };
  estaciones: { id: string; lon: number; lat: number; anclajes: number; stock: number; salidas: number }[];
  lineas: { o: string; d: string; n: number }[];
  asignacion: {
    conciliacion: { resultado: string; viajes: number; pct: number }[];
    pct_circulares: number;
    pct_top10: number;
    pares: number;
    spearman: number;
    acceso_medio: number;
  };
  inventario: { flota: number; anclajes: number; pct: number; cuantil: number; rebalanceo: number; sin_desvio: number; reservada: number };
  flota: {
    objetivo: number;
    minima: number;
    diseno: number;
    anclajes: number;
    rebalanceo: number;
    curvas: { rebalanceo: number; puntos: { flota: number; pct: number; uso: number }[] }[];
    reservada: { flota: number; pct: number }[];
  };
  cierre: {
    limite: number;
    reb_pct: number;
    sin_reb_pct: number;
    doble_rechazos: number;
    sin_recarga_pct: number;
    sin_recarga_dias: number;
    equidad_pp: number;
    perdida_elegida: number;
    perdida_redundante: number;
    kwh_dia: number;
    pico_kw: number;
  };
};

// Miles con espacio fino también en números de cuatro cifras (12 865), como en la memoria.
export function num(x: number, decimales = 0): string {
  return x
    .toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: "always" })
    .replace(/^-/, "−")
    .replaceAll(".", " ");
}
export const pc = (x: number, decimales = 1) => `${num(x, decimales)} %`;
