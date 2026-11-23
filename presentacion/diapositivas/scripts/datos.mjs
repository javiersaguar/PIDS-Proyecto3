// Reúne en public/datos.json las cifras de las diapositivas. Lee solo lo que generan los
// notebooks (resultados/tablas y frontend/public/datos), así que se regenera con ellos.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TABLAS = join(RAIZ, "resultados", "tablas");
const WEB = join(RAIZ, "frontend", "public", "datos");

// CSV con comillas opcionales; convierte a número lo que lo es.
function csv(ruta) {
  const filas = [];
  let campo = "", fila = [], comillas = false;
  const texto = readFileSync(ruta, "utf8").replace(/^﻿/, "");
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas.filter((f) => f.length > 1 || f[0] !== "");
  const valor = (v) => (v === "True" ? true : v === "False" ? false : v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);
  return resto.map((f) => Object.fromEntries(cab.map((k, j) => [k, valor(f[j] ?? "")])));
}
const json = (ruta) => JSON.parse(readFileSync(join(WEB, ruta), "utf8"));
const indicadores = (filas) => Object.fromEntries(filas.map((f) => [f.indicador, f.valor]));

const embudo = csv(join(TABLAS, "exploracion", "T10_embudo.csv"));
const periodos = csv(join(TABLAS, "exploracion", "T10_viajes_por_periodo.csv"));
const pareto = csv(join(TABLAS, "movilidad", "T28_comparacion.csv"));
const estaciones = csv(join(TABLAS, "movilidad", "T32_estaciones.csv"));
const t20 = indicadores(json("fase1/t20_resumen.json"));
const t31 = json("fase1/t31_asignacion.json");
const t32 = json("fase1/t32_inventario.json");
const t34 = json("fase1/t34_flota.json");
const perfil = json("fase0/t12_perfil_horario.json");

const finalistas = pareto.filter((f) => f.rol);
const recomendada = finalistas.find((f) => f.rol === "recomendada");
const ind31 = Object.fromEntries(t31.indicadores.map((f) => [f.indicador, f.atendidos]));

const datos = {
  embudo: {
    brutos: embudo[0].quedan,
    elegibles: embudo.at(-1).quedan,
    pasos: embudo.filter((f) => f.excluidos > 0).map((f) => ({ regla: f.regla, descripcion: f.descripcion, excluidos: f.excluidos, quedan: f.quedan })),
    periodos: periodos.map((f) => ({ periodo: f.periodo, elegibles: f.elegibles })),
  },
  perfil: { horas: perfil.horas, laborable: perfil.laborable, fin_de_semana: perfil.fin_de_semana },
  od: {
    viajes: t20.viajes,
    pares: t20.pares_con_viajes,
    pct_intrazonal: t20.pct_viajes_intrazonales,
    pct_top20: t20.pct_viajes_top20_pares,
    asimetria: t20.indice_asimetria,
    asimetria_azar: t20.indice_asimetria_esperado_azar,
  },
  pareto: pareto
    .filter((f) => f.pareto_radio && f.radio_m <= 300)
    .map((f) => ({ id: f.network_id, metodo: f.metodo, radio: f.radio_m, k: f.k, pct: f.pct_viajes_cubiertos })),
  finalistas: finalistas.map((f) => ({ id: f.network_id, rol: f.rol, radio: f.radio_m, k: f.k, pct: f.pct_viajes_cubiertos, p90: f.d_p90_m })),
  red: { id: recomendada.network_id, radio: recomendada.radio_m, k: recomendada.k, pct: recomendada.pct_viajes_cubiertos, p90: recomendada.d_p90_m },
  estaciones: estaciones.map((e) => ({ id: e.station_id, lon: e.lon, lat: e.lat, anclajes: e.anclajes, stock: e.stock_inicial, salidas: e.salidas })),
  lineas: t31.pares_top.map((p) => ({ o: p.origen, d: p.destino, n: p.atendidos })),
  asignacion: {
    conciliacion: t31.conciliacion.map((f) => ({ resultado: f.resultado, viajes: f.viajes, pct: f.pct_solicitudes })),
    pct_circulares: ind31.pct_mismo_origen_destino,
    pct_top10: ind31.pct_top10_pares,
    pares: ind31.pares_con_viajes,
    spearman: t31.correlacion_saldo_puntas,
    acceso_medio: t31.acceso.find((f) => f.extremo === "origen" && f.medida === "linea_recta").media_m,
  },
  inventario: {
    flota: t32.resumen.flota,
    anclajes: t32.resumen.anclajes,
    pct: t32.resumen.pct_atendidos_cubiertos,
    cuantil: t32.cuantil,
    rebalanceo: t32.rebalanceo_base,
    sin_desvio: t32.resumen.pct_atendidos_sin_desvio,
    reservada: t32.reservada.find((f) => f.periodo === "reservada" && f.rebalanceo_max === t32.rebalanceo_base).pct_atendidos_cubiertos,
  },
  flota: {
    objetivo: t34.servicio_objetivo,
    minima: t34.flota_minima,
    diseno: t34.flota_diseno,
    anclajes: t34.anclajes,
    rebalanceo: t34.rebalanceo_base,
    curvas: [0, t34.rebalanceo_base].map((reb) => ({
      rebalanceo: reb,
      puntos: t34.curva.filter((f) => f.rebalanceo_max === reb).map((f) => ({ flota: f.flota, pct: f.pct_atendidos_cubiertos, uso: f.viajes_por_patinete_dia })),
    })),
    reservada: t34.comparacion.filter((f) => f.periodo === "reservada").map((f) => ({ flota: f.flota, pct: f.pct_atendidos_cubiertos })),
  },
};

const salida = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "datos.json");
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(datos));
console.log(`datos.json: ${datos.estaciones.length} estaciones, ${datos.pareto.length} redes del frente, ${datos.lineas.length} líneas`);
