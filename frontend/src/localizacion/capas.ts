import type { Layer } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { capaEtiquetas, capasBase } from "../mapa/capas";
import type { Base } from "../mapa/datos";
import { conAlfa, type Tema } from "../mapa/tema";
import { COLORES_LOCALIZACION, type Candidato, type Marcador } from "./modelo";
import { contornoSector, type CasoPeatonal, type SectorMapa } from "./validacion";

export function posicion(c: Candidato): [number, number] {
  return [c.lon, c.lat];
}

const REFERENCIAS_ROMA = new Set(["San Pietro", "Termini", "Colosseo", "San Paolo"]);

export function fondoLocalizacion(base: Base, tema: Tema, detalle: boolean) {
  const calles = detalle ? conAlfa(tema.calles, tema.nombre === "oscuro" ? 70 : 57) : tema.calles;
  return capasBase(base, { ...tema, calles });
}

export function rotulosLocalizacion(base: Base, tema: Tema, detalle: boolean) {
  const visibles = detalle ? base.etiquetas : base.etiquetas.filter((e) => REFERENCIAS_ROMA.has(e.nombre));
  return capaEtiquetas(visibles, tema, detalle ? 13 : 12);
}

const ENCIMA = { depthCompare: "always" as const, depthWriteEnabled: false };

export function capasLocalizacion(
  puntos: Marcador[], seleccionado: Candidato | undefined, radio: number, tema: Tema,
): Layer[] {
  const capas: Layer[] = [];
  if (radio > 0) {
    capas.push(new ScatterplotLayer<Marcador>({
      id: "localizacion-radios", data: puntos,
      getPosition: (m) => posicion(m.candidato), getRadius: radio,
      radiusUnits: "meters", stroked: true, filled: false, lineWidthUnits: "pixels",
      getLineWidth: 1, getLineColor: (m) => conAlfa(COLORES_LOCALIZACION[m.grupo], 120),
      parameters: ENCIMA,
    }));
  }
  if (seleccionado) {
    const c = seleccionado;
    capas.push(new PathLayer({
      id: "localizacion-contorno", data: [c.contorno], getPath: (p) => p,
      widthUnits: "pixels", getWidth: 2, getColor: COLORES_LOCALIZACION.desplazado,
      parameters: ENCIMA,
    }));
    if (c.posicion === "extremo_en_tierra") {
      capas.push(
        new PathLayer({
          id: "localizacion-desplazamiento", data: [[[c.lon_centro, c.lat_centro], posicion(c)]],
          getPath: (p) => p, widthUnits: "pixels", getWidth: 2,
          getColor: COLORES_LOCALIZACION.desplazado, parameters: ENCIMA,
        }),
        new ScatterplotLayer({
          id: "localizacion-centro", data: [[c.lon_centro, c.lat_centro]], getPosition: (p) => p,
          radiusUnits: "pixels", getRadius: 6, stroked: true, filled: false,
          getLineColor: COLORES_LOCALIZACION.desplazado, lineWidthUnits: "pixels", getLineWidth: 2,
          parameters: ENCIMA,
        }),
      );
    }
  }
  capas.push(new ScatterplotLayer<Marcador>({
    id: "localizacion-puntos", data: puntos, pickable: true, stroked: true,
    getPosition: (m) => posicion(m.candidato),
    getRadius: (m) => {
      if (m.candidato.candidate_id === seleccionado?.candidate_id) return 9;
      if (m.grupo === "comun" || m.grupo === "kmedoids" || m.grupo === "kmeans" || m.grupo === "finalista") return 5.5;
      return 4 + Math.min(6, Math.sqrt(m.candidato.extremos) / 3);
    },
    radiusUnits: "pixels", getFillColor: (m) => conAlfa(COLORES_LOCALIZACION[m.grupo], 229),
    lineWidthUnits: "pixels", getLineWidth: 1.3, getLineColor: tema.halo,
    parameters: ENCIMA, updateTriggers: { getRadius: seleccionado?.candidate_id, getLineColor: tema.nombre },
  }));
  return capas;
}

export function capasValidacion(sectores: SectorMapa[], caso?: CasoPeatonal): Layer[] {
  const capas: Layer[] = [new PathLayer<SectorMapa>({
    id: "validacion-sectores", data: sectores, getPath: contornoSector, pickable: true,
    getColor: [231, 153, 41, 230], getWidth: 2, widthUnits: "pixels", parameters: ENCIMA,
  })];
  if (caso) {
    capas.push(
      new PathLayer({
        id: "validacion-recta", data: [caso.recta], getPath: (p) => p,
        getColor: [172, 176, 187, 230], getWidth: 2, widthUnits: "pixels", parameters: ENCIMA,
      }),
      new PathLayer({
        id: "validacion-camino", data: [caso.camino], getPath: (p) => p,
        getColor: [59, 214, 155, 245], getWidth: 3.4, widthUnits: "pixels", parameters: ENCIMA,
      }),
    );
  }
  return capas;
}
