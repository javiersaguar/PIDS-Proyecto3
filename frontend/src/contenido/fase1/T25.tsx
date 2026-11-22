import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";

type Metodo = "kmedoids" | "kmeans";
type Indicador = "pct_viajes_cubiertos" | "d_media_m";
type Red = {
  network_id: string;
  metodo: Metodo;
  radio_m: number;
  k: number;
  pct_viajes_cubiertos: number;
  d_media_m: number;
  d_origen_p90_m: number;
  d_destino_p90_m: number;
  estaciones_con_avisos: number;
};
type Datos = {
  radios: number[];
  metodos: Record<Metodo, string>;
  referencias: Record<number, number>;
  objetivo_pct: number;
  barrido: Red[];
  candidatos: { candidate_id: string; x_km: number; y_km: number }[];
  redes: Record<string, number[]>;
};

const METODOS: Metodo[] = ["kmedoids", "kmeans"];
const COLORES: Record<Metodo, string> = { kmedoids: "#246cab", kmeans: "#bc572d" };

export function T25() {
  const { datos, error } = useDatos<Datos>("fase1/t25_lineas_base");
  return (
    <Seccion id="t25" tarea="T25" responsable="Javier Saguar" titulo="Líneas base de localización"
      notebook="movilidad/T25_linea_base_localizacion.ipynb"
      objetivo="Comparar K-medoids y K-means ajustado a candidatos con varios presupuestos de estaciones."
      valor="Fija referencias de cobertura y distancia para evaluar los modelos de optimización.">
      {datos ? <Barrido datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function Barrido({ datos }: { datos: Datos }) {
  const inicial = datos.radios.includes(300) ? 300 : datos.radios[0];
  const [radio, setRadio] = useState(inicial);
  const [k, setK] = useState(datos.referencias[inicial]);
  const [metodo, setMetodo] = useState<Metodo>("kmedoids");
  const [indicador, setIndicador] = useState<Indicador>("pct_viajes_cubiertos");
  const filas = datos.barrido.filter((r) => r.radio_m === radio);
  const ks = [...new Set(filas.map((r) => r.k))].sort((a, b) => a - b);
  const seleccion = filas.find((r) => r.k === k && r.metodo === metodo);
  if (!seleccion) return <Cargando error="No se ha encontrado la red seleccionada." />;

  const cambiarRadio = (nuevo: string) => {
    const metros = Number(nuevo);
    setRadio(metros);
    setK(datos.referencias[metros]);
  };
  const cobertura = indicador === "pct_viajes_cubiertos";
  const ejeY = cobertura ? "Viajes cubiertos (%)" : "Distancia media (m)";
  const curvas: Data[] = METODOS.map((nombre) => {
    const puntos = filas.filter((r) => r.metodo === nombre);
    return {
      type: "scatter", mode: "lines+markers", name: datos.metodos[nombre],
      x: puntos.map((r) => r.k), y: puntos.map((r) => r[indicador]),
      line: { color: COLORES[nombre] }, marker: { size: puntos.map((r) => r.k === k ? 9 : 4) },
      hovertemplate: `%{x} estaciones<br>%{y:.1f} ${cobertura ? "%" : "m"}<extra>%{fullData.name}</extra>`,
    };
  });
  const puntos = datos.redes[seleccion.network_id].map((i) => datos.candidatos[i]);
  const mapa: Data[] = [
    {
      type: "scatter", mode: "markers", name: "Candidatos",
      x: datos.candidatos.map((p) => p.x_km), y: datos.candidatos.map((p) => p.y_km),
      marker: { size: 4, color: "#b3c0c9" }, hoverinfo: "skip",
    },
    {
      type: "scatter", mode: "markers", name: datos.metodos[metodo],
      x: puntos.map((p) => p.x_km), y: puntos.map((p) => p.y_km), text: puntos.map((p) => p.candidate_id),
      marker: { size: 6, color: COLORES[metodo] }, hovertemplate: "%{text}<extra></extra>",
    },
  ];
  return (
    <Bloque titulo="Cobertura y distancia según número de estaciones"
      queMuestra="Dos métodos, evaluados con los extremos de los viajes del 1 al 21 de febrero."
      porQue="Los mismos candidatos y radios permiten medir cuánto cambia el resultado al variar el método o el presupuesto."
      comoLeer="Un viaje cuenta como cubierto si sus dos extremos están dentro del radio elegido. Las distancias incluyen todos los viajes."
      conclusiones={[`La red seleccionada tiene ${num(seleccion.estaciones_con_avisos)} estaciones con avisos cartográficos.`]}
      fuente="tablas/movilidad/T25_barrido.csv y T25_redes.csv">
      <div className="controles">
        <Segmentado etiqueta="Radio de acceso" valor={String(radio)} cambiar={cambiarRadio}
          opciones={datos.radios.map((r) => ({ valor: String(r), texto: `${r} m` }))} />
        <Segmentado etiqueta="Indicador del barrido" valor={indicador} cambiar={setIndicador} opciones={[
          { valor: "pct_viajes_cubiertos", texto: "Viajes cubiertos" }, { valor: "d_media_m", texto: "Distancia media" },
        ]} />
      </div>
      <Grafica descripcion={ejeY + " según el número de estaciones"} trazas={curvas} alto={335} capa={{
        xaxis: { title: { text: "Estaciones" } }, yaxis: { title: { text: ejeY } },
        shapes: cobertura ? [{
          type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: datos.objetivo_pct, y1: datos.objetivo_pct,
          line: { color: "#677382", dash: "dot", width: 1.2 },
        }] : [],
      }} />
      <div className="controles">
        <Segmentado etiqueta="Método de la red" valor={metodo} cambiar={setMetodo}
          opciones={METODOS.map((m) => ({ valor: m, texto: datos.metodos[m] }))} />
        <label>
          Estaciones <select aria-label="Estaciones" value={k} onChange={(e) => setK(Number(e.target.value))}>
            {ks.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <Cifras cifras={[
        { valor: pc(seleccion.pct_viajes_cubiertos), nombre: "viajes con ambos extremos cubiertos" },
        { valor: `${num(seleccion.d_media_m)} m`, nombre: "distancia media por extremo" },
        { valor: `${num(seleccion.d_origen_p90_m)} / ${num(seleccion.d_destino_p90_m)} m`, nombre: "P90 en origen y destino" },
      ]} />
      <Grafica descripcion="Emplazamientos de la red seleccionada" trazas={mapa} alto={400} capa={{
        xaxis: { title: { text: "Este UTM 33N (km)" }, showgrid: false },
        yaxis: { title: { text: "Norte UTM 33N (km)" }, scaleanchor: "x", showgrid: false },
      }} />
    </Bloque>
  );
}
