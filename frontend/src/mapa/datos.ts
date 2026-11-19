// Datos del mapa 3D: los exporta movilidad/T36_capas_mapa.ipynb en frontend/public/demo/.
// Nada de lo que enseña el mapa se calcula aquí salvo conversiones de unidades
// (recuentos del periodo → medias por día) y la posición ilustrativa de cada viaje.
import { useEffect, useState } from "react";

export type Punto = [number, number];

export type ResumenRed = {
  network_id: string;
  radio_m: number;
  estaciones: number;
  pct_viajes_atendidos: number;
  pct_origenes_cubiertos: number;
  pct_destinos_cubiertos: number;
  d_origen_mediana_m: number;
  d_destino_mediana_m: number;
  d_origen_p90_m: number;
  d_destino_p90_m: number;
  d_atendidos_media_m: number;
  viajes_atendidos_dia: number;
  flota: number;
  anclajes: number;
  anclajes_mediana: number;
  anclajes_max: number;
  rebalanceo_noche_media: number;
  rebalanceo_noche_max: number;
  pct_viajes_misma_estacion: number;
  kwh_dia_total: number;
  kwh_dia_estacion_max: number;
  kwh_dia_estacion_mediana: number;
  viajes_por_patinete_dia: number;
  metodo: string;
  candidatos: number;
  stations: string;
  perfiles: string;
  flujos: string;
};

export type Cifras = {
  viajes_csv: number;
  viajes_elegibles: number;
  patinetes_mes: number;
  patinetes_elegibles: number;
  viajes_ajuste: number;
  dias_ajuste: number;
  viajes_dia_ajuste: number;
  viajes_dia_reservada: number;
  viajes_dia_laborable: number;
  viajes_dia_fin_de_semana: number;
  diferencia_perfiles_pc: number;
  hora_punta_laborable: number;
  hora_punta_fin_de_semana: number;
  simultaneos_max: number;
  patinetes_activos_dia: number;
  celdas9_con_demanda: number;
  celdas9_50pct: number;
  celdas9_80pct: number;
  area9_50pct_km2: number;
  pct_extremos_top20pct_celdas9: number;
  celdas8_emisoras: number;
  celdas8_receptoras: number;
  rebalanceo_res8_dia: number;
  rebalanceo_res9_dia: number;
  rebalanceo_res8_dia_max: number;
  rebalanceo_base_dia: number;
  operador_pct_saldo_compensado: number;
  rodeo_mediana: number;
  velocidad_pie_ms: number;
  pct_viajes_circulares: number;
  radios: Record<
    string,
    {
      pct_andar_supera_viaje_medio: number;
      pct_andar_directo_mas_rapido_medio: number;
      pct_dis_le_2R: number;
      dist_pie_medio_m: number;
    }
  >;
  flota_kwh_dia: number;
  flota_kwh_dia_max: number;
  pct_energia_10_16h: number;
  pct_energia_16_24h: number;
  celda8_kwh_dia_max: number;
  pct_viajes_intrazonales_res8: number;
  consumo_wh_km: number;
  bateria_wh: number;
};

export type Manifiesto = {
  schema_version: number;
  run_id: string;
  zona_horaria: string;
  periodo: { nombre: string; desde: string; hasta: string; dias: number; dias_tipo: Record<string, number> };
  hora_reposicion: number;
  network_por_defecto: string;
  networks: ResumenRed[];
  barrido: string;
  capas: { base: string; demanda_res9: string; saldo_res8: string };
  dia: { fecha: string; fichero: string; viajes: number };
  franjas: Record<string, [number, number]>;
  cifras: Cifras;
  fuentes: { viajes: string; mapa_base: string };
};

export type Etiqueta = { nombre: string; tipo: "monumento" | "barrio" | "parque"; lon: number; lat: number };

export type Base = {
  vias_rapidas: Punto[][];
  principales: Punto[][];
  secundarias: Punto[][];
  calles: Punto[][];
  rios: Punto[][];
  tren: Punto[][];
  murallas: Punto[][];
  agua: Punto[][][];
  verde: Punto[][][];
  etiquetas: Etiqueta[];
  atribucion: string;
};

export type CeldaDemanda = {
  h3: string;
  extremos: number;
  o: number[];
  d: number[];
  o_fds: number[];
  d_fds: number[];
};

export type Demanda = {
  res: number;
  dias: { laborable: number; fin_de_semana: number };
  dias_total: number;
  celdas: CeldaDemanda[];
};

export type CeldaSaldo = {
  h3: string;
  saldo_dia: number;
  extremos: number;
  tipo: string;
  incluida: boolean;
  significativa: boolean;
  franjas: number[];
};

export type Saldo = { res: number; franjas: string[]; franjas_horas: [number, number][]; celdas: CeldaSaldo[] };

export type Estacion = {
  station_id: string;
  rango: number;
  h3: string;
  lon: number;
  lat: number;
  ganancia_extremos: number;
  extremos_en_radio: number;
  salidas: number;
  llegadas: number;
  salidas_dia: number;
  llegadas_dia: number;
  saldo_dia: number;
  stock_inicial: number;
  anclajes: number;
  energia_kwh_dia: number;
  cargas_dia: number;
  rotacion_dia: number;
  indice: number;
};

export type Perfil = {
  station_id: string;
  salidas: number[];
  llegadas: number[];
  salidas_fds: number[];
  llegadas_fds: number[];
  energia_wh: number[];
};

export type Red = {
  resumen: ResumenRed;
  estaciones: Estacion[];
  perfiles: Map<string, Perfil>;
  pares: { o: Estacion; d: Estacion; viajes: number }[];
  viajesMismaEstacion: number;
  viajesAtendidos: number;
};

export type BarridoRadio = {
  k_referencia: number;
  network_id: string;
  h3: string[];
  lon: number[];
  lat: number[];
  ganancia_extremos: number[];
  pct_viajes: number[];
  pct_extremos: number[];
  d_mediana_m: number[];
  d_p90_m: number[];
};

export type Barrido = { criterio: string; dias: number; viajes: number; radios: Record<string, BarridoRadio> };

export type Viaje = {
  o: Punto;
  d: Punto;
  salida: number;
  llegada: number;
  // Bit i: lo atiende la red de referencia del radio radios[i] (Dia.radios).
  atendido: number;
};

export type Dia = {
  fecha: string;
  inicio: string;
  viajes: Viaje[];
  radios: number[];
  paso_s: number;
  ocupacion: Record<string, number[][]>;
};

export type Demo = {
  manifiesto: Manifiesto;
  base: Base;
  demanda: Demanda;
  saldo: Saldo;
  barrido: Barrido;
  dia: Dia;
  redes: Map<number, Red>;
};

const RAIZ = `${import.meta.env.BASE_URL}demo/`;

async function pedir<T>(ruta: string): Promise<T> {
  const r = await fetch(RAIZ + ruta);
  if (!r.ok) throw new Error(`No se pudo leer demo/${ruta} (${r.status})`);
  return (await r.json()) as T;
}

type BaseCodificada = {
  origen: [number, number];
  escala: number;
  etiquetas: Etiqueta[];
  atribucion: string;
  [capa: string]: unknown;
};

// El mapa base viene en enteros de 1e-5 grados respecto a la esquina suroeste del recorte.
function decodificarBase(b: BaseCodificada): Base {
  const [x0, y0] = b.origen;
  const e = b.escala;
  const linea = (plano: number[]): Punto[] => {
    const salida: Punto[] = [];
    for (let i = 0; i < plano.length; i += 2) salida.push([x0 + plano[i] * e, y0 + plano[i + 1] * e]);
    return salida;
  };
  const lineas = (capa: string) => (b[capa] as number[][]).map(linea);
  const poligonos = (capa: string) => (b[capa] as number[][][]).map((anillos) => anillos.map(linea));
  return {
    vias_rapidas: lineas("vias_rapidas"),
    principales: lineas("principales"),
    secundarias: lineas("secundarias"),
    calles: lineas("calles"),
    rios: lineas("rios"),
    tren: lineas("tren"),
    murallas: lineas("murallas"),
    agua: poligonos("agua"),
    verde: poligonos("verde"),
    etiquetas: b.etiquetas,
    atribucion: b.atribucion,
  };
}

type GeoEstaciones = {
  features: { geometry: { coordinates: [number, number] }; properties: Omit<Estacion, "lon" | "lat" | "indice"> }[];
};

async function cargarRed(resumen: ResumenRed): Promise<Red> {
  const [geo, perfiles, flujos] = await Promise.all([
    pedir<GeoEstaciones>(resumen.stations),
    pedir<{ estaciones: Perfil[] }>(resumen.perfiles),
    pedir<{ pares: [string, string, number][]; viajes_misma_estacion: number; viajes_atendidos: number }>(resumen.flujos),
  ]);
  const estaciones: Estacion[] = geo.features.map((f, indice) => ({
    ...f.properties,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    indice,
  }));
  const porId = new Map(estaciones.map((e) => [e.station_id, e]));
  return {
    resumen,
    estaciones,
    perfiles: new Map(perfiles.estaciones.map((p) => [p.station_id, p])),
    pares: flujos.pares.map(([o, d, viajes]) => ({ o: porId.get(o)!, d: porId.get(d)!, viajes })),
    viajesMismaEstacion: flujos.viajes_misma_estacion,
    viajesAtendidos: flujos.viajes_atendidos,
  };
}

async function cargarTodo(alAvanzar: (fraccion: number) => void): Promise<Demo> {
  const manifiesto = await pedir<Manifiesto>("manifest.json");
  let hechos = 0;
  const total = 5 + manifiesto.networks.length;
  const contar = <T,>(p: Promise<T>) =>
    p.then((x) => {
      hechos += 1;
      alAvanzar(hechos / total);
      return x;
    });
  const [base, demanda, saldo, barrido, diaCrudo, ...redes] = await Promise.all([
    contar(pedir<BaseCodificada>(manifiesto.capas.base).then(decodificarBase)),
    contar(pedir<Demanda>(manifiesto.capas.demanda_res9)),
    contar(pedir<Saldo>(manifiesto.capas.saldo_res8)),
    contar(pedir<Barrido>(manifiesto.barrido)),
    contar(
      pedir<{
        fecha: string;
        inicio: string;
        viajes: number[][];
        atendido_bits: number[];
        paso_s: number;
        ocupacion: Record<string, number[][]>;
      }>(
        manifiesto.dia.fichero,
      ),
    ),
    ...manifiesto.networks.map((r) => contar(cargarRed(r))),
  ]);
  const dia: Dia = {
    fecha: diaCrudo.fecha,
    inicio: diaCrudo.inicio,
    paso_s: diaCrudo.paso_s,
    ocupacion: diaCrudo.ocupacion,
    radios: diaCrudo.atendido_bits,
    viajes: diaCrudo.viajes.map(([lonO, latO, lonD, latD, salida, llegada, atendido]) => ({
      o: [lonO, latO],
      d: [lonD, latD],
      salida,
      llegada,
      atendido,
    })),
  };
  return {
    manifiesto,
    base,
    demanda,
    saldo,
    barrido,
    dia,
    redes: new Map(redes.map((r) => [r.resumen.radio_m, r])),
  };
}

export type EstadoCarga = { demo: Demo; error: null; progreso: 1 } | { demo: null; error: string | null; progreso: number };

export function useDemo(): EstadoCarga {
  const [estado, setEstado] = useState<EstadoCarga>({ demo: null, error: null, progreso: 0 });
  useEffect(() => {
    let vigente = true;
    cargarTodo((progreso) => vigente && setEstado((e) => (e.demo ? e : { demo: null, error: null, progreso })))
      .then((demo) => vigente && setEstado({ demo, error: null, progreso: 1 }))
      .catch((e: Error) => vigente && setEstado({ demo: null, error: e.message, progreso: 0 }));
    return () => {
      vigente = false;
    };
  }, []);
  return estado;
}

// Distancia en metros (haversine), solo para nombrar la referencia más cercana a una estación.
export function distanciaM(a: Punto, b: Punto): number {
  const r = Math.PI / 180;
  const s =
    Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}

export function referenciaCercana(etiquetas: Etiqueta[], p: Punto): { nombre: string; metros: number } {
  let mejor = { nombre: "", metros: Infinity };
  for (const e of etiquetas) {
    const m = distanciaM(p, [e.lon, e.lat]);
    if (m < mejor.metros) mejor = { nombre: e.nombre, metros: m };
  }
  return mejor;
}

// Reloj de la jornada operativa: segundos desde las 4:00 → "HH:MM".
export function horaReloj(segundos: number, horaInicio: number): string {
  const total = Math.floor(segundos / 60) + horaInicio * 60;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function horaDelDia(segundos: number, horaInicio: number): number {
  return (Math.floor(segundos / 3600) + horaInicio) % 24;
}

export function atendidoPor(dia: Dia, v: Viaje, radio: number): boolean {
  const i = dia.radios.indexOf(radio);
  return i >= 0 && (v.atendido & (1 << i)) !== 0;
}
