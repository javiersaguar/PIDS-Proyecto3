import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num } from "../../formato";

type Punto = [number, number];
type Vista = "todos" | "avisos" | "desplazados";
type Candidato = {
  candidate_id: string;
  x_km: number;
  y_km: number;
  origenes: number;
  destinos: number;
  extremos: number;
  posicion: "extremo_en_tierra" | "centro_h3";
  alerta_rio: boolean;
  alerta_via: boolean;
  recorte_osm: boolean;
  en_rio: boolean;
  d_vecino_m: number | null;
};
type Datos = {
  candidatos: Candidato[];
  resumen: { candidatos: number; desplazados: number; candidatos_con_avisos: number; resolucion: number };
  rios: Punto[][];
  limites: [Punto, Punto];
};

function avisos(c: Candidato): string[] {
  const texto = [];
  if (c.en_rio) texto.push("En río");
  else if (c.alerta_rio) texto.push("Cerca del río");
  if (c.alerta_via) texto.push("Cerca de vía con restricción");
  if (!c.recorte_osm) texto.push("Fuera del recorte cartográfico");
  return texto;
}

export function T24() {
  const { datos, error } = useDatos<Datos>("fase1/t24_candidatos");
  return (
    <Seccion id="t24" tarea="T24" responsable="Javier Saguar" titulo="Candidatos a estación"
      notebook="movilidad/T24_candidatos_estacion.ipynb"
      objetivo="Crear un candidato por celda con demanda del ajuste y revisar los emplazamientos sensibles."
      valor="Los modelos de localización comparten un catálogo y un registro de los puntos por verificar.">
      {datos ? <MapaCandidatos datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function MapaCandidatos({ datos }: { datos: Datos }) {
  const [vista, setVista] = useState<Vista>("todos");
  const seleccion = datos.candidatos.filter((c) =>
    vista === "todos" || (vista === "avisos" ? avisos(c).length > 0 : c.posicion === "extremo_en_tierra"));
  const puntos: Data = {
    type: "scatter", mode: "markers", name: "Candidatos",
    x: seleccion.map((c) => c.x_km), y: seleccion.map((c) => c.y_km),
    marker: {
      color: seleccion.map((c) => c.posicion === "extremo_en_tierra" ? "#823d8b" : avisos(c).length ? "#b65b27" : "#286db0"),
      size: seleccion.map((c) => 5 + 0.7 * Math.sqrt(c.extremos)), opacity: 0.75,
    },
    text: seleccion.map((c) => [
      c.candidate_id, `${num(c.origenes)} orígenes · ${num(c.destinos)} destinos`,
      c.posicion === "extremo_en_tierra" ? "Desplazado a un extremo en tierra" : "Centro de celda",
      c.d_vecino_m === null ? "" : `Vecino más cercano a ${num(c.d_vecino_m)} m`,
      ...avisos(c),
    ].filter(Boolean).join("<br>")),
    hovertemplate: "%{text}<extra></extra>", showlegend: false,
  };
  const rios = {
    type: "scatter", mode: "lines",
    x: datos.rios.flatMap((rio) => [...rio.map(([x]) => x), null]),
    y: datos.rios.flatMap((rio) => [...rio.map(([, y]) => y), null]),
    line: { color: "#759db9", width: 1.5 }, hoverinfo: "skip", showlegend: false,
  } as Data;
  return (
    <Bloque titulo="Demanda y revisión cartográfica"
      queMuestra={`Los candidatos proceden de la rejilla H3 de resolución ${datos.resumen.resolucion}.`}
      porQue="El mapa permite priorizar la comprobación urbana de los puntos próximos a barreras."
      comoLeer="El tamaño representa la demanda de la celda. El naranja marca avisos y el morado señala los centros desplazados."
      conclusiones={[`Se ven ${num(seleccion.length)} posiciones. El estado de cada emplazamiento está en el catálogo.`]}
      fuente="tablas/movilidad/T24_candidatos.csv · © OpenStreetMap contributors (ODbL)">
      <div className="controles">
        <Segmentado etiqueta="Candidatos visibles" valor={vista} cambiar={setVista} opciones={[
          { valor: "todos", texto: "Catálogo completo" }, { valor: "avisos", texto: "Con avisos" },
          { valor: "desplazados", texto: "Desplazados del río" },
        ]} />
      </div>
      <Cifras cifras={[
        { valor: num(datos.resumen.candidatos), nombre: "celdas con demanda" },
        { valor: num(datos.resumen.desplazados), nombre: "centros desplazados a tierra" },
        { valor: num(datos.resumen.candidatos_con_avisos), nombre: "candidatos con avisos cartográficos" },
      ]} />
      <Grafica descripcion="Emplazamientos candidatos y ríos de Roma" trazas={[rios, puntos]} alto={445} capa={{
        xaxis: { title: { text: "Este UTM 33N (km)" }, range: datos.limites[0], showgrid: false },
        yaxis: { title: { text: "Norte UTM 33N (km)" }, range: datos.limites[1], scaleanchor: "x", showgrid: false },
      }} />
    </Bloque>
  );
}
