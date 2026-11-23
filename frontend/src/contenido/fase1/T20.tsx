import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { indicadores, num, pc } from "../../formato";
import { COLOR, ESCALA_AZUL } from "../../graficas";
import { BloqueEstabilidadPares } from "./Robustez";

type Top30 = {
  celdas: { rango: number; h3: string; origenes: number; destinos: number; extremos: number }[];
  viajes: number[][];
  pct_viajes: number;
};
type Par = { h3_o: string; h3_d: string; viajes: number; intrazonal: boolean; rango_o: number; rango_d: number; pct_viajes: number; distancia_h3: number };
type Asimetria = {
  pares_top: { h3_o: string; h3_d: string; rango_o: number; rango_d: number; ij: number; ji: number; total: number; neto_ij_menos_ji: number }[];
  indice: number;
  indice_azar: number;
};
type Indicadores = { indicador: string; valor: number }[];

const FASE = "fase1";

export function T20() {
  const { datos: r, error } = useDatos<Indicadores>(`${FASE}/t20_resumen`);
  const i = r ? indicadores(r) : null;
  return (
    <Seccion
      id="t20"
      tarea="T20"
      responsable="Alejandro Cuevas"
      titulo="Primera matriz origen-destino en H3"
      notebook="movilidad/T20_matrices_od.ipynb"
      objetivo="Construir la matriz origen-destino de los viajes entre celdas H3 de resolución 8 y describir sus pares principales, la parte intrazonal y su asimetría."
      valor="Es la primera matriz OD del requisito de movilidad. Dice cuántos viajes no salen de su zona, si la demanda se concentra en pocos corredores y si hay corredores que vacían una zona hacia otra."
    >
      {i ? (
        <Cifras
          cifras={[
            { valor: num(i.viajes), nombre: "viajes elegibles del ajuste", detalle: `de ${i.celdas_origen} celdas de origen a ${i.celdas_destino} de destino` },
            { valor: num(i.pares_con_viajes), nombre: "pares con viajes", detalle: `de ${num(i.pares_posibles)} posibles` },
            { valor: pc(i.pct_viajes_intrazonales), nombre: "viajes intrazonales", detalle: "empiezan y acaban en la misma celda" },
            { valor: pc(i.pct_viajes_top20_pares), nombre: "en los 20 pares principales", detalle: "no hay pocos corredores dominantes" },
            { valor: `${num(i.cociente_asimetria_observada_esperada, 2)}×`, nombre: "asimetría frente al azar", detalle: "los dos sentidos se equilibran" },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <BloqueMatriz />
      {i && <BloquePares i={i} />}
      {i && <BloqueAsimetria i={i} />}
      <BloqueEstabilidadPares />
    </Seccion>
  );
}

function BloqueMatriz() {
  const { datos: m, error } = useDatos<Top30>(`${FASE}/t20_od_top30`);
  const [diagonal, setDiagonal] = useState<"con" | "sin">("con");
  if (!m) return <Cargando error={error} />;
  const etiquetas = m.celdas.map((c) => `n.º ${c.rango}`);
  const z = m.viajes.map((fila, o) => fila.map((v, d) => (diagonal === "sin" && o === d ? null : v)));
  const customdata = m.celdas.map((co) => m.celdas.map((cd) => [co.h3, cd.h3]));
  const diag = m.viajes.reduce((a, fila, k) => a + fila[k], 0);
  const total = m.viajes.flat().reduce((a, b) => a + b, 0);
  const trazas: Data[] = [
    {
      type: "heatmap",
      x: etiquetas,
      y: etiquetas,
      z,
      customdata,
      colorscale: ESCALA_AZUL,
      zmin: 0,
      xgap: 1,
      ygap: 1,
      colorbar: { title: { text: "Viajes", side: "right" }, thickness: 12, outlinewidth: 0 },
      hovertemplate: "Origen %{y} (%{customdata[0]})<br>Destino %{x} (%{customdata[1]})<br>%{z} viajes<extra></extra>",
    } as unknown as Data,
  ];
  return (
    <Bloque
      titulo="1. Matriz entre las 30 celdas con más extremos"
      queMuestra="Los viajes entre las 30 celdas de resolución 8 con más orígenes más destinos del periodo de ajuste, con el mismo orden en filas (origen) y columnas (destino)."
      porQue="Muestra de un vistazo si los viajes se quedan en la diagonal (viajes cortos dentro de la zona) o conectan zonas alejadas."
      comoLeer="Las celdas están numeradas por su total de extremos (n.º 1 la que más). Quita la diagonal para ver mejor los viajes entre celdas distintas."
      conclusiones={[
        `Las 30 celdas con más extremos reúnen el ${pc(m.pct_viajes)} de los viajes entre ellas.`,
        `La diagonal es la parte más oscura (${pc((100 * diag) / total)} de los viajes de esta submatriz): los viajes más frecuentes son los que se quedan en su celda o van a una vecina.`,
      ]}
      fuente="figuras/movilidad/T20_od_top30 y tablas/movilidad/T20_od_res8.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Diagonal"
          valor={diagonal}
          cambiar={setDiagonal}
          opciones={[
            { valor: "con", texto: "Con la diagonal" },
            { valor: "sin", texto: "Sin la diagonal" },
          ]}
        />
      </div>
      <Grafica
        descripcion="Mapa de calor de la matriz origen-destino entre las 30 celdas con más extremos"
        trazas={trazas}
        alto={560}
        capa={{
          margin: { t: 8 },
          xaxis: { title: { text: "Celda de destino" }, tickangle: -90, tickfont: { size: 9 }, showgrid: false },
          yaxis: { title: { text: "Celda de origen" }, autorange: "reversed", tickfont: { size: 9 }, showgrid: false, scaleanchor: "x" },
        }}
      />
    </Bloque>
  );
}

function BloquePares({ i }: { i: Record<string, number> }) {
  const { datos: todos, error } = useDatos<Par[]>(`${FASE}/t20_pares_top20`);
  const { datos: entre } = useDatos<Par[]>(`${FASE}/t20_pares_top20_entre_celdas`);
  const [vista, setVista] = useState<"todos" | "entre">("todos");
  if (!todos || !entre) return <Cargando error={error} />;
  const pares = vista === "todos" ? todos : entre;
  const etiqueta = (p: Par) => (p.intrazonal ? `n.º ${p.rango_o} (misma celda)` : `n.º ${p.rango_o} → n.º ${p.rango_d}`);
  const grupo = (intrazonal: boolean, nombre: string, color: string): Data => {
    const f = pares.filter((p) => p.intrazonal === intrazonal);
    return {
      type: "bar",
      orientation: "h",
      name: nombre,
      y: f.map(etiqueta),
      x: f.map((p) => p.viajes),
      customdata: f.map((p) => [p.h3_o, p.h3_d, num(p.pct_viajes, 2), p.distancia_h3]),
      marker: { color },
      hovertemplate: "%{y}<br>%{customdata[0]} → %{customdata[1]}<br>%{x} viajes (%{customdata[2]} %) · a %{customdata[3]} celdas<extra></extra>",
    } as Data;
  };
  const trazas: Data[] = [grupo(true, "Intrazonal", COLOR.serie2), grupo(false, "Entre celdas distintas", COLOR.serie1)];
  const vecinos = entre.filter((p) => p.distancia_h3 === 1).length;
  return (
    <Bloque
      titulo="2. Pares con más viajes"
      queMuestra="Los 20 pares origen-destino con más viajes, con y sin los que empiezan y acaban en la misma celda."
      porQue="Indica los corredores principales que la red de estaciones debe servir bien."
      comoLeer="Cada barra es un par de celdas, numeradas como en la matriz. Pasa el ratón para ver sus identificadores H3 y a cuántas celdas de distancia están."
      conclusiones={[
        `Los 20 pares con más viajes reúnen el ${pc(i.pct_viajes_top20_pares)} de los viajes: la demanda no se concentra en pocos corredores.`,
        `De los 20 pares principales entre celdas distintas, ${vecinos} unen celdas vecinas y los otros ${entre.length - vecinos} están a dos celdas. Los mismos pares aparecen en los dos sentidos con volúmenes parecidos.`,
        <>
          El <strong>{pc(i.pct_viajes_intrazonales)} de los viajes</strong> no sale de su celda de resolución 8: con radios de
          300 m o más, parte de ellos empezarían y acabarían en la misma estación.
        </>,
      ]}
      fuente="tablas/movilidad/T20_pares_top20.csv y T20_pares_top20_entre_celdas.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Pares"
          valor={vista}
          cambiar={setVista}
          opciones={[
            { valor: "todos", texto: "Todos los pares" },
            { valor: "entre", texto: "Solo entre celdas distintas" },
          ]}
        />
      </div>
      <Grafica
        descripcion="Barras horizontales con los 20 pares origen-destino con más viajes"
        trazas={trazas}
        alto={520}
        capa={{
          margin: { t: 8 },
          barmode: "overlay",
          bargap: 0.25,
          xaxis: { title: { text: "Viajes en el periodo de ajuste" }, rangemode: "tozero" },
          yaxis: { autorange: "reversed", type: "category", categoryorder: "array", categoryarray: pares.map(etiqueta), tickfont: { size: 11 } },
        }}
      />
    </Bloque>
  );
}

function BloqueAsimetria({ i }: { i: Record<string, number> }) {
  const { datos: a, error } = useDatos<Asimetria>(`${FASE}/t20_asimetria`);
  if (!a) return <Cargando error={error} />;
  const p = a.pares_top;
  const etiqueta = p.map((x) => `n.º ${x.rango_o} ↔ n.º ${x.rango_d}`);
  const trazas: Data[] = [
    {
      type: "bar",
      orientation: "h",
      name: "Sentido de ida (primera → segunda)",
      y: etiqueta,
      x: p.map((x) => x.ij),
      customdata: p.map((x) => [x.h3_o, x.h3_d, x.neto_ij_menos_ji]),
      marker: { color: COLOR.serie1 },
      hovertemplate: "%{customdata[0]} → %{customdata[1]}<br>%{x} viajes · diferencia %{customdata[2]:+}<extra></extra>",
    } as Data,
    {
      type: "bar",
      orientation: "h",
      name: "Sentido de vuelta (segunda → primera)",
      y: etiqueta,
      x: p.map((x) => x.ji),
      customdata: p.map((x) => [x.h3_d, x.h3_o]),
      marker: { color: COLOR.serie2 },
      hovertemplate: "%{customdata[0]} → %{customdata[1]}<br>%{x} viajes<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="3. Asimetría M − Mᵀ"
      queMuestra="Los 10 pares de celdas distintas con más diferencia entre los dos sentidos, y la suma de |M − Mᵀ| frente a la que daría el azar si los dos sentidos fueran igual de probables."
      porQue="Si unos pocos corredores fueran muy asimétricos, el rebalanceo podría plantearse por corredores; si no, hay que plantearlo por zonas (T14)."
      comoLeer="Cada par tiene dos barras, una por sentido. Si fueran iguales, el par estaría equilibrado."
      conclusiones={[
        <>
          La suma de |M − Mᵀ| es el {pc(100 * a.indice)} de los viajes entre celdas distintas, frente al {pc(100 * a.indice_azar)}{" "}
          que daría el azar: <strong>solo {num(i.cociente_asimetria_observada_esperada, 2)} veces lo esperable</strong>. El par más
          asimétrico tiene {i.max_abs_asimetria_par} viajes de diferencia.
        </>,
        "El saldo de las zonas (T14) es la suma de muchos pares pequeños, no de unos pocos corredores: el rebalanceo se plantea por zonas.",
      ]}
      fuente="tablas/movilidad/T20_asimetria_pares_top10.csv y T20_resumen.csv"
    >
      <Grafica
        descripcion="Barras con los viajes en cada sentido de los diez pares más asimétricos"
        trazas={trazas}
        alto={400}
        capa={{
          barmode: "group",
          bargap: 0.3,
          bargroupgap: 0.05,
          margin: { t: 8 },
          xaxis: { title: { text: "Viajes en el periodo de ajuste" }, rangemode: "tozero" },
          yaxis: { autorange: "reversed", type: "category" },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla"
        cabeceras={["Par", "Ida", "Vuelta", "Total", "Diferencia"]}
        numericas={[1, 2, 3, 4]}
        filas={p.map((x, k) => [etiqueta[k], x.ij, x.ji, x.total, x.neto_ij_menos_ji > 0 ? `+${x.neto_ij_menos_ji}` : num(x.neto_ij_menos_ji)])}
      />
    </Bloque>
  );
}
