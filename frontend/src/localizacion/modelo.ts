import type { Punto } from "../mapa/datos";
import type { RGB } from "../mapa/tema";

export type Candidato = {
  candidate_id: string;
  lat: number;
  lon: number;
  lat_centro: number;
  lon_centro: number;
  contorno: Punto[];
  origenes: number;
  destinos: number;
  extremos: number;
  posicion: "extremo_en_tierra" | "centro_h3";
  alerta_rio: boolean;
  alerta_via: boolean;
  recorte_osm: boolean;
  en_rio: boolean;
  incluido_barrido: boolean;
  d_vecino_m: number | null;
  vecinos_en_solape: number;
  d_rio_m: number | null;
  d_via_restringida_m: number | null;
  desplazamiento_m: number;
  via_cercana: string | null;
  d_via_cercana_m: number | null;
};

export type DatosT24 = {
  candidatos: Candidato[];
  resumen: {
    candidatos: number;
    desplazados: number;
    candidatos_con_avisos: number;
    resolucion: number;
    viajes_ajuste: number;
    extremos_ajuste: number;
    proximos_rio: number;
    proximos_via: number;
    solape_m: number;
  };
  periodo_ajuste: [string, string];
  umbrales: { rio_m: number; via_m: number };
};

export type Metodo = "kmedoids" | "kmeans";
export type ModoComparacion = "ambos" | Metodo;
export type VistaCandidatos = "todos" | "avisos" | "desplazados";
export type GrupoMapa = "candidato" | "aviso" | "desplazado" | Metodo | "comun";
export type Marcador = { candidato: Candidato; grupo: GrupoMapa };
export type Perfil = [salidas: number, llegadas: number];

export type ResultadoRed = {
  network_id: string;
  metodo: Metodo;
  radio_m: number;
  k: number;
  viajes_ajuste: number;
  viajes_cubiertos: number;
  viajes_un_extremo: number;
  viajes_sin_cobertura: number;
  pct_viajes_cubiertos: number;
  pct_origenes_cubiertos: number;
  pct_destinos_cubiertos: number;
  d_media_m: number;
  d_p90_m: number;
  d_origen_p90_m: number;
  d_destino_p90_m: number;
  estaciones_con_avisos: number;
};

export type DatosT25 = {
  radios: number[];
  metodos: Record<Metodo, string>;
  referencias: Record<number, number>;
  objetivo_pct: number;
  barrido: ResultadoRed[];
  candidatos: { candidate_id: string }[];
  redes: Record<string, number[]>;
  perfiles: Record<string, Perfil[]>;
};

export type Comparacion = {
  resultados: Record<Metodo, ResultadoRed>;
  perfiles: Record<Metodo, Map<string, Perfil | undefined>>;
  marcadores: Marcador[];
  compartidos: number;
};

export const METODOS: Metodo[] = ["kmedoids", "kmeans"];
export const COLORES_LOCALIZACION: Record<GrupoMapa, RGB> = {
  candidato: [36, 108, 171],
  aviso: [178, 86, 19],
  desplazado: [130, 61, 139],
  kmedoids: [36, 108, 171],
  kmeans: [185, 77, 33],
  comun: [17, 112, 91],
};
export const GRUPOS = {
  candidato: "Demanda por celda",
  aviso: "Aviso cartográfico",
  desplazado: "Centro desplazado",
  kmedoids: "Solo K-medoids",
  kmeans: "Solo K-means",
  comun: "En ambas redes",
};

export const AVISOS = [
  { valor: "todos", texto: "Catálogo completo" },
  { valor: "avisos", texto: "Con avisos" },
  { valor: "desplazados", texto: "Desplazados del río" },
] satisfies { valor: VistaCandidatos; texto: string }[];

export function avisos(c: Candidato): string[] {
  const etiquetas = [];
  if (c.en_rio) etiquetas.push("En río");
  else if (c.alerta_rio) etiquetas.push("Cerca del río");
  if (c.alerta_via) etiquetas.push("Cerca de vía con restricción");
  if (!c.recorte_osm) etiquetas.push("Fuera del recorte cartográfico");
  return etiquetas;
}

export function marcadoresT24(datos: DatosT24, filtro: VistaCandidatos): Marcador[] {
  return datos.candidatos.flatMap((c) => {
    const movido = c.posicion === "extremo_en_tierra";
    const aviso = avisos(c).length > 0;
    if ((filtro === "avisos" && !aviso) || (filtro === "desplazados" && !movido)) return [];
    return [{ candidato: c, grupo: movido ? "desplazado" : aviso ? "aviso" : "candidato" }];
  });
}

export function presupuestos(datos: DatosT25, radio: number) {
  return [...new Set(datos.barrido.filter((r) => r.radio_m === radio).map((r) => r.k))].sort((a, b) => a - b);
}

export function comparar(datos: DatosT25, catalogo: DatosT24, radio: number, k: number): Comparacion | null {
  const filas = datos.barrido.filter((r) => r.radio_m === radio && r.k === k);
  const medoids = filas.find((r) => r.metodo === "kmedoids");
  const means = filas.find((r) => r.metodo === "kmeans");
  if (!medoids || !means) return null;

  const perfilesDe = (r: ResultadoRed) => {
    const estaciones = datos.redes[r.network_id];
    const perfiles = datos.perfiles?.[`${r.network_id}_r${radio}`];
    return new Map(estaciones.map((i, pos) => [datos.candidatos[i].candidate_id, perfiles?.[pos]]));
  };
  const perfiles = { kmedoids: perfilesDe(medoids), kmeans: perfilesDe(means) };
  let compartidos = 0;
  const marcadores = catalogo.candidatos.flatMap<Marcador>((c) => {
    const a = perfiles.kmedoids.has(c.candidate_id);
    const b = perfiles.kmeans.has(c.candidate_id);
    if (!a && !b) return [];
    if (a && b) compartidos += 1;
    return [{ candidato: c, grupo: a && b ? "comun" : a ? "kmedoids" : "kmeans" }];
  });

  return { resultados: { kmedoids: medoids, kmeans: means }, perfiles, marcadores, compartidos };
}

export function marcadoresT25(comparacion: Comparacion | null, modo: ModoComparacion) {
  return comparacion?.marcadores.filter((m) => modo === "ambos" || m.grupo === "comun" || m.grupo === modo) ?? [];
}

export const enlaceCatalogo = (id?: string) => "#/mapa/localizacion/candidatos" + (id ? "/" + id : "");

export function enlaceComparacion(radio: number, k: number, modo: ModoComparacion, id?: string) {
  const ruta = `#/mapa/localizacion/redes/${radio}/${k}/${modo}`;
  return id ? `${ruta}/${id}` : ruta;
}
