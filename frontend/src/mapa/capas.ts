// Capas de deck.gl del mapa. Las escalas de altura son fijas entre redes para que al
// cambiar de radio se comparen las mismas unidades (plan, sección 8).
import { AmbientLight, DirectionalLight, LightingEffect, type Layer } from "@deck.gl/core";
import { H3HexagonLayer, TripsLayer } from "@deck.gl/geo-layers";
import { ArcLayer, ColumnLayer, PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import type { Capas, TipoDia } from "./capitulos";
import {
  atendidoPor,
  horaDelDia,
  type Base,
  type CeldaDemanda,
  type CeldaSaldo,
  type Demo,
  type Estacion,
  type Etiqueta,
  type Punto,
  type Red,
  type Viaje,
} from "./datos";
import { conAlfa, rampa, type RGBA, type Tema } from "./tema";

const MATERIAL = { ambient: 0.5, diffuse: 0.65, shininess: 28, specularColor: [40, 40, 40] as [number, number, number] };
const ENCIMA = { depthCompare: "always" as const, depthWriteEnabled: false };

// Cada viaje deja una estela de los últimos 20 minutos del reloj.
export const ESTELA_S = 1200;

export const ALTURA = {
  demandaTotal: 40, // m por extremo/día
  saldo: 230, // m por patinete/día
  barrido: 26, // m por extremo/día que aporta la estación
  anclaje: 44, // m por anclaje
  energiaMax: 1000, // m para la estación con más kWh/día de todas las redes
};

export function luces(tema: Tema) {
  return new LightingEffect({
    ambiente: new AmbientLight({ color: [255, 255, 255], intensity: tema.luz }),
    sol: new DirectionalLight({ color: [255, 255, 255], intensity: 1.4, direction: [-2, -6, -3] }),
  });
}

export function capasBase(base: Base, tema: Tema): Layer[] {
  const linea = (id: string, data: Punto[][], color: RGBA, ancho: number) =>
    new PathLayer<Punto[]>({
      id: `base-${id}-${tema.nombre}`,
      data,
      getPath: (p) => p,
      getColor: color,
      getWidth: ancho,
      widthUnits: "pixels",
      widthMinPixels: ancho,
      capRounded: true,
      jointRounded: true,
    });
  return [
    new SolidPolygonLayer<Punto[][]>({
      id: `base-verde-${tema.nombre}`,
      data: base.verde,
      getPolygon: (p) => p,
      getFillColor: tema.verde,
    }),
    new SolidPolygonLayer<Punto[][]>({
      id: `base-agua-${tema.nombre}`,
      data: base.agua,
      getPolygon: (p) => p,
      getFillColor: tema.agua,
    }),
    linea("calles", base.calles, tema.calles, 0.6),
    linea("secundarias", base.secundarias, tema.secundarias, 0.9),
    linea("tren", base.tren, tema.tren, 1),
    linea("principales", base.principales, tema.principales, 1.4),
    linea("rapidas", base.vias_rapidas, tema.viasRapidas, 1.8),
    linea("murallas", base.murallas, tema.murallas, 1.4),
    linea("rios", base.rios, tema.rio, 3),
  ];
}

export function capaEtiquetas(etiquetas: Etiqueta[], tema: Tema, zoom: number): Layer {
  // Los barrios solo a partir de cierto zoom para no tapar los datos en la vista general.
  const visibles = etiquetas.filter((e) => e.tipo === "monumento" || zoom >= 12.9);
  return new TextLayer<Etiqueta>({
    id: `etiquetas-${tema.nombre}`,
    data: visibles,
    getText: (e) => e.nombre,
    getPosition: (e) => [e.lon, e.lat],
    getSize: (e) => (e.tipo === "monumento" ? 13 : 11.5),
    getColor: (e) => (e.tipo === "monumento" ? tema.monumento : tema.barrio),
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: 600,
    characterSet: "auto",
    fontSettings: { sdf: true, fontSize: 64, buffer: 6 },
    outlineWidth: 4,
    outlineColor: tema.halo,
    billboard: true,
    sizeUnits: "pixels",
    getPixelOffset: [0, -2],
    parameters: ENCIMA,
    updateTriggers: { getColor: tema.nombre },
  });
}

export type EstadoCapas = {
  capas: Capas;
  red: Red;
  radio: number;
  k: number;
  t: number;
  tipoDia: TipoDia;
  franja: number; // −1: día completo
  seleccion: string | null;
};

// Valor de una celda de demanda: extremos por día (total) o por día de ese tipo y hora.
export function valorDemanda(c: CeldaDemanda, demo: Demo, modo: Capas["demanda"], hora: number, tipo: TipoDia): number {
  if (modo === "hora") {
    const dias = demo.demanda.dias[tipo];
    return tipo === "laborable" ? (c.o[hora] + c.d[hora]) / dias : (c.o_fds[hora] + c.d_fds[hora]) / dias;
  }
  return c.extremos / demo.demanda.dias_total;
}

export function valorSaldo(c: CeldaSaldo, franja: number): number {
  return franja < 0 ? c.saldo_dia : c.franjas[franja];
}

const maximos = new WeakMap<Demo, { demandaTotal: number; demandaHora: Record<TipoDia, number>; energia: number }>();
export function maximosDe(demo: Demo) {
  let m = maximos.get(demo);
  if (!m) {
    const celdas = demo.demanda.celdas;
    const porHora = (tipo: TipoDia) =>
      Math.max(...celdas.flatMap((c) => Array.from({ length: 24 }, (_, h) => valorDemanda(c, demo, "hora", h, tipo))));
    m = {
      demandaTotal: Math.max(...celdas.map((c) => c.extremos / demo.demanda.dias_total)),
      demandaHora: { laborable: porHora("laborable"), fin_de_semana: porHora("fin_de_semana") },
      energia: Math.max(...[...demo.redes.values()].flatMap((r) => r.estaciones.map((e) => e.energia_kwh_dia))),
    };
    maximos.set(demo, m);
  }
  return m;
}

type Barra = { lon: number; lat: number; rango: number; ganancia: number };

export function posicionViaje(v: Viaje, t: number): Punto {
  const f = (t - v.salida) / Math.max(1, v.llegada - v.salida);
  return [v.o[0] + (v.d[0] - v.o[0]) * f, v.o[1] + (v.d[1] - v.o[1]) * f];
}

export function pasoOcupacion(demo: Demo, t: number): number {
  const filas = demo.dia.ocupacion[demo.manifiesto.network_por_defecto][0].length;
  return Math.min(filas - 1, Math.max(0, Math.floor(t / demo.dia.paso_s)));
}

export function capasDatos(demo: Demo, e: EstadoCapas, tema: Tema): Layer[] {
  const { capas, red, radio, k, t, tipoDia, franja, seleccion } = e;
  const hora = horaDelDia(t, demo.manifiesto.hora_reposicion);
  const max = maximosDe(demo);
  const nid = red.resumen.network_id;
  const capasLista: Layer[] = [];

  if (capas.demanda !== "no") {
    const plana = capas.demanda === "plana";
    const tope = capas.demanda === "hora" ? max.demandaHora[tipoDia] : max.demandaTotal;
    const escala = (ALTURA.demandaTotal * max.demandaTotal) / tope; // la celda más alta mide lo mismo en los dos modos
    capasLista.push(
      new H3HexagonLayer<CeldaDemanda>({
        id: "demanda",
        data: demo.demanda.celdas,
        getHexagon: (c) => c.h3,
        extruded: !plana,
        coverage: plana ? 1 : 0.9,
        getElevation: (c) => valorDemanda(c, demo, capas.demanda, hora, tipoDia) * escala,
        getFillColor: (c) => {
          const v = valorDemanda(c, demo, capas.demanda, hora, tipoDia);
          return rampa(tema.demanda, (v / tope) ** 0.7, plana ? 45 : v === 0 ? 70 : 235);
        },
        material: MATERIAL,
        pickable: !plana,
        transitions: capas.demanda === "hora" ? { getElevation: 250, getFillColor: 250 } : undefined,
        updateTriggers: {
          getElevation: [capas.demanda, hora, tipoDia],
          getFillColor: [capas.demanda, hora, tipoDia, tema.nombre],
        },
      }),
    );
  }

  if (capas.saldo) {
    const tope = 4;
    capasLista.push(
      new H3HexagonLayer<CeldaSaldo>({
        id: "saldo",
        data: demo.saldo.celdas,
        getHexagon: (c) => c.h3,
        extruded: true,
        coverage: 0.92,
        getElevation: (c) => (c.incluida ? Math.abs(valorSaldo(c, franja)) * ALTURA.saldo : 0),
        getFillColor: (c) => {
          const v = valorSaldo(c, franja);
          if (!c.incluida) return conAlfa(tema.neutro, 90);
          return rampa(v > 0 ? tema.emisora : tema.receptora, Math.abs(v) / tope, 235);
        },
        material: MATERIAL,
        pickable: true,
        transitions: { getElevation: 400, getFillColor: 400 },
        updateTriggers: { getElevation: franja, getFillColor: [franja, tema.nombre] },
      }),
    );
  }

  // Estaciones: las del barrido (primeras k) o las de la red de referencia.
  const barrido = demo.barrido.radios[String(radio)];
  const barras: Barra[] =
    capas.estaciones === "barrido"
      ? Array.from({ length: k }, (_, i) => ({
          lon: barrido.lon[i],
          lat: barrido.lat[i],
          rango: i + 1,
          ganancia: barrido.ganancia_extremos[i] / demo.barrido.dias,
        }))
      : [];

  if (capas.radios) {
    const centros: Punto[] =
      capas.estaciones === "barrido" ? barras.map((b) => [b.lon, b.lat]) : red.estaciones.map((s) => [s.lon, s.lat]);
    capasLista.push(
      new ScatterplotLayer<Punto>({
        id: "radios",
        data: centros,
        getPosition: (p) => p,
        getRadius: radio,
        radiusUnits: "meters",
        filled: true,
        stroked: true,
        getFillColor: conAlfa(tema.estacion, tema.nombre === "oscuro" ? 26 : 30),
        getLineColor: conAlfa(tema.estacion, 150),
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        updateTriggers: { getRadius: radio, getFillColor: tema.nombre },
      }),
    );
  }

  if (capas.estaciones === "barrido") {
    capasLista.push(
      new ColumnLayer<Barra>({
        id: "barrido",
        data: barras,
        getPosition: (b) => [b.lon, b.lat],
        diskResolution: 20,
        radius: 48,
        extruded: true,
        getElevation: (b) => b.ganancia * ALTURA.barrido,
        getFillColor: (b) => (b.rango === k ? [...tema.monumento.slice(0, 3), 255] as RGBA : conAlfa(tema.estacion, 240)),
        material: MATERIAL,
        pickable: true,
        updateTriggers: { getFillColor: [k, tema.nombre] },
      }),
    );
  }

  if (capas.estaciones === "puntos") {
    capasLista.push(
      new ScatterplotLayer<Estacion>({
        id: "estaciones-puntos",
        data: red.estaciones,
        getPosition: (s) => [s.lon, s.lat],
        getRadius: 5,
        radiusUnits: "pixels",
        stroked: true,
        getFillColor: conAlfa(tema.estacion, 255),
        getLineColor: tema.halo,
        lineWidthUnits: "pixels",
        getLineWidth: 1.5,
        pickable: true,
        updateTriggers: { getFillColor: tema.nombre, getLineColor: tema.nombre },
      }),
    );
  }

  if (capas.estaciones === "anclajes" || capas.estaciones === "ocupacion") {
    const paso = pasoOcupacion(demo, t);
    const ocupacion = demo.dia.ocupacion[nid];
    const ocupados = (s: Estacion) => (capas.estaciones === "ocupacion" ? ocupacion[s.indice][paso] : s.stock_inicial);
    const colorRelleno = (s: Estacion): RGBA => {
      if (capas.estaciones === "anclajes") return conAlfa(tema.estacion, 255);
      const n = ocupados(s);
      if (n === 0) return conAlfa(tema.vacia, 255);
      if (n >= s.anclajes) return conAlfa(tema.llena, 255);
      return conAlfa(tema.normal, 235);
    };
    // Primero el relleno opaco y después los anclajes translúcidos sin escribir profundidad,
    // para que el relleno se vea a través de ellos.
    capasLista.push(
      new ColumnLayer<Estacion>({
        id: "estaciones-relleno",
        data: red.estaciones,
        getPosition: (s) => [s.lon, s.lat],
        diskResolution: 20,
        radius: 40,
        extruded: true,
        getElevation: (s) => Math.max(ocupados(s), 0.15) * ALTURA.anclaje,
        getFillColor: colorRelleno,
        material: MATERIAL,
        pickable: true,
        updateTriggers: {
          getElevation: [capas.estaciones, paso, nid],
          getFillColor: [capas.estaciones, paso, nid, tema.nombre],
        },
      }),
      new ColumnLayer<Estacion>({
        id: "estaciones-anclajes",
        data: red.estaciones,
        getPosition: (s) => [s.lon, s.lat],
        diskResolution: 20,
        radius: 62,
        extruded: true,
        getElevation: (s) => s.anclajes * ALTURA.anclaje,
        getFillColor: capas.estaciones === "anclajes" ? conAlfa(tema.estacion, 60) : tema.hueco,
        material: MATERIAL,
        pickable: true,
        parameters: { depthWriteEnabled: false },
        updateTriggers: { getFillColor: [capas.estaciones, tema.nombre] },
      }),
    );
  }

  if (capas.estaciones === "energia") {
    capasLista.push(
      new ColumnLayer<Estacion>({
        id: "estaciones-energia",
        data: red.estaciones,
        getPosition: (s) => [s.lon, s.lat],
        diskResolution: 20,
        radius: 55,
        extruded: true,
        getElevation: (s) => (s.energia_kwh_dia / max.energia) * ALTURA.energiaMax,
        getFillColor: (s) => rampa(tema.energia, 0.15 + (0.85 * s.energia_kwh_dia) / max.energia, 250),
        material: MATERIAL,
        pickable: true,
        updateTriggers: { getFillColor: tema.nombre },
      }),
    );
  }

  if (capas.flujos) {
    const tope = Math.max(...red.pares.map((p) => p.viajes));
    capasLista.push(
      new ArcLayer<Red["pares"][number]>({
        id: "flujos",
        data: red.pares,
        getSourcePosition: (p) => [p.o.lon, p.o.lat],
        getTargetPosition: (p) => [p.d.lon, p.d.lat],
        getSourceColor: conAlfa(tema.flujo, 45),
        getTargetColor: conAlfa(tema.flujo, 235),
        getWidth: (p) => 0.8 + 5 * Math.sqrt(p.viajes / tope),
        widthUnits: "pixels",
        getHeight: 0.45,
        pickable: true,
        updateTriggers: { getSourceColor: tema.nombre, getTargetColor: tema.nombre },
      }),
    );
  }

  if (capas.viajes !== "no") {
    const color = (v: Viaje): RGBA =>
      capas.viajes === "todos"
        ? conAlfa(tema.demanda[tema.nombre === "oscuro" ? 4 : 3], 255)
        : atendidoPor(demo.dia, v, radio)
          ? conAlfa(tema.estacion, 255)
          : tema.noAtendido;
    const enCurso = demo.dia.viajes.filter((v) => v.salida <= t && t <= v.llegada);
    capasLista.push(
      new TripsLayer<Viaje>({
        id: "viajes",
        data: demo.dia.viajes,
        getPath: (v) => [v.o, v.d],
        getTimestamps: (v) => [v.salida, v.llegada],
        getColor: color,
        currentTime: t,
        trailLength: ESTELA_S,
        fadeTrail: true,
        widthUnits: "pixels",
        getWidth: 2.6,
        capRounded: true,
        jointRounded: true,
        updateTriggers: { getColor: [capas.viajes, radio, tema.nombre] },
      }),
      new ScatterplotLayer<Viaje>({
        id: "viajes-cabeza",
        data: enCurso,
        getPosition: (v) => posicionViaje(v, t),
        getFillColor: color,
        getRadius: 2.6,
        radiusUnits: "pixels",
        updateTriggers: { getPosition: t, getFillColor: [capas.viajes, radio, tema.nombre] },
      }),
    );
  }

  const elegida = seleccion ? red.estaciones.find((s) => s.station_id === seleccion) : undefined;
  if (elegida) {
    capasLista.push(
      new ScatterplotLayer<Estacion>({
        id: "seleccion",
        data: [elegida],
        getPosition: (s) => [s.lon, s.lat],
        getRadius: 115,
        radiusUnits: "meters",
        radiusMinPixels: 12,
        filled: false,
        stroked: true,
        getLineColor: tema.monumento,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        parameters: ENCIMA,
        updateTriggers: { getLineColor: tema.nombre },
      }),
    );
  }
  return capasLista;
}
