import { useState } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";

type Punto = [number, number];
type Periodo = "mes" | "ajuste" | "reservada";
type Par = { origen: string; destino: string; ida: number; vuelta: number; viajes: number; saldo: number };
type Indicadores = { interzonales: number; pct_top10_interzonales: number; asimetria: number; asimetria_azar: number };
type Datos = {
  periodos: Record<Periodo, { pares: Par[]; resumen: Indicadores }>;
  centros: Record<string, Punto>;
  referencias: Record<string, Punto>;
  limites: [number, number, number, number];
  bordes: Punto[][];
  max_viajes: number;
};

export function T23() {
  const { datos, error } = useDatos<Datos>("fase1/t23_lineas_deseo");
  return (
    <Seccion id="t23" tarea="T23" responsable="Javier Saguar" titulo="Indicadores OD y líneas de deseo"
      notebook="movilidad/T23_indicadores_lineas_deseo.ipynb"
      objetivo="Localizar los pares H3 con más intercambio y medir el desequilibrio entre sus dos sentidos."
      valor="Separa los flujos con más viajes de los que generan mayor saldo entre zonas.">
      {datos ? <MapaFlujos datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function MapaFlujos({ datos }: { datos: Datos }) {
  const [periodo, setPeriodo] = useState<Periodo>("ajuste");
  const { pares, resumen } = datos.periodos[periodo];
  const bordes: Data = {
    type: "scatter", mode: "lines",
    x: datos.bordes.flatMap((linea) => [...linea.map(([x]) => x), null]),
    y: datos.bordes.flatMap((linea) => [...linea.map(([, y]) => y), null]),
    line: { color: "#aab8c2", width: 1 }, hoverinfo: "skip", showlegend: false,
  } as Data;
  const flujos: Data[] = [...pares].reverse().map((par) => {
    const a = datos.centros[par.origen];
    const b = datos.centros[par.destino];
    const etiqueta = `${par.origen} ↔ ${par.destino}<br>${num(par.viajes)} viajes · ${par.ida} ida / ${par.vuelta} vuelta`;
    return {
      type: "scatter", mode: "lines",
      x: [a[0], (a[0] + b[0]) / 2, b[0]],
      y: [a[1], (a[1] + b[1]) / 2, b[1]],
      text: [etiqueta, etiqueta, etiqueta],
      line: { color: "#256abf", width: 1 + 6 * Math.sqrt(par.viajes / datos.max_viajes) },
      opacity: 0.72, hovertemplate: "%{text}<extra></extra>", showlegend: false,
    };
  });
  const referencias = Object.entries(datos.referencias);
  const lugares: Data = {
    type: "scatter", mode: "markers+text",
    x: referencias.map(([, [x]]) => x), y: referencias.map(([, [, y]]) => y),
    text: referencias.map(([nombre]) => nombre), textposition: "top center",
    marker: { color: "#374957", size: 6 }, hoverinfo: "skip", showlegend: false,
  };
  const flechas: Partial<Layout>["annotations"] = pares.filter((par) => par.saldo !== 0).map((par) => {
    const origen = datos.centros[par.origen];
    const destino = datos.centros[par.destino];
    const [a, b] = par.saldo > 0 ? [origen, destino] : [destino, origen];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    return {
      text: "", xref: "x", yref: "y", axref: "x", ayref: "y", showarrow: true,
      x: a[0] + 0.68 * dx, y: a[1] + 0.68 * dy, ax: a[0] + 0.42 * dx, ay: a[1] + 0.42 * dy,
      arrowhead: 2, arrowwidth: 1, arrowcolor: "#0c345d",
    };
  });
  const [xmin, ymin, xmax, ymax] = datos.limites;
  return (
    <Bloque titulo="Pares con mayor volumen entre celdas"
      queMuestra="Hasta doce líneas entre centros de celda, sobre los límites municipales de Istat."
      porQue="Las líneas permiten ubicar las conexiones principales con el mismo encuadre entre periodos."
      comoLeer="El grosor suma los dos sentidos. La flecha señala el predominante. Son conexiones agregadas en línea recta."
      conclusiones={[`El desequilibrio agregado es el ${pc(100 * resumen.asimetria)} de los viajes entre celdas frente al ${pc(100 * resumen.asimetria_azar)} esperado con sentidos equiprobables.`]}
      fuente="tablas/movilidad/T23_indicadores.csv y T23_pares_principales.csv · Istat (CC BY 4.0)">
      <div className="controles">
        <Segmentado etiqueta="Periodo del mapa" valor={periodo} cambiar={setPeriodo} opciones={[
          { valor: "ajuste", texto: "Ajuste" }, { valor: "reservada", texto: "Semana reservada" },
          { valor: "mes", texto: "Mes completo" },
        ]} />
      </div>
      <Cifras cifras={[
        { valor: num(resumen.interzonales), nombre: "viajes entre celdas" },
        { valor: pc(resumen.pct_top10_interzonales), nombre: "en los diez pares principales" },
      ]} />
      <Grafica descripcion="Líneas rectas entre los pares H3 con mayor volumen de viajes" trazas={[bordes, ...flujos, lugares]} alto={440} capa={{
        annotations: flechas,
        xaxis: { range: [xmin, xmax], title: { text: "Este UTM 33N (km)" }, showgrid: false },
        yaxis: { range: [ymin, ymax], title: { text: "Norte UTM 33N (km)" }, scaleanchor: "x", showgrid: false },
      }} />
      <TablaDesplegable titulo="Ver ida y vuelta de cada par" numericas={[2, 3, 4]}
        cabeceras={["Celda A", "Celda B", "A → B", "B → A", "Total"]}
        filas={pares.map((p) => [p.origen, p.destino, num(p.ida), num(p.vuelta), num(p.viajes)])} />
    </Bloque>
  );
}
