import { lazy, Suspense, useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { css } from "../../mapa/tema";
import { ControlesRed, type FiltrosRed } from "../../localizacion/Controles";
import {
  COLORES_LOCALIZACION, comparar, enlaceComparacion, marcadoresT25, METODOS,
  type DatosT24, type DatosT25, type ResultadoRed,
} from "../../localizacion/modelo";

const MapaRoma = lazy(() => import("../../localizacion/MapaRoma"));
type Indicador = "pct_viajes_cubiertos" | "d_media_m" | "d_p90_m";

export function T25() {
  const t25 = useDatos<DatosT25>("fase1/t25_lineas_base");
  const t24 = useDatos<DatosT24>("fase1/t24_candidatos");
  return (
    <Seccion id="t25" tarea="T25" responsable="Javier Saguar" titulo="Líneas base de localización"
      notebook="movilidad/T25_linea_base_localizacion.ipynb"
      objetivo="Comparar K-medoids y K-means con el mismo catálogo, número de estaciones y radio de acceso."
      valor="Mide cuántos viajes del ajuste quedan cubiertos en los dos extremos y dónde cambia la red al cambiar de método.">
      {t25.datos && t24.datos ? <Barrido datos={t25.datos} catalogo={t24.datos} /> : <Cargando error={t25.error ?? t24.error} />}
    </Seccion>
  );
}

function Barrido({ datos, catalogo }: { datos: DatosT25; catalogo: DatosT24 }) {
  const inicial = datos.radios.includes(300) ? 300 : datos.radios[0];
  const [filtros, cambiar] = useState<FiltrosRed>({ radio: inicial, k: datos.referencias[inicial], modo: "ambos", radiosVisibles: false });
  const [indicador, setIndicador] = useState<Indicador>("pct_viajes_cubiertos");
  const [id, setId] = useState<string | null>(null);
  const { radio, k, modo, radiosVisibles } = filtros;
  const comparacion = useMemo(() => comparar(datos, catalogo, radio, k), [datos, catalogo, radio, k]);
  const marcadores = useMemo(() => marcadoresT25(comparacion, modo), [comparacion, modo]);
  const elegido = marcadores.find(({ candidato }) => candidato.candidate_id === id)?.candidato;
  if (!comparacion) return <Cargando error="No hay redes para esta combinación de radio y estaciones." />;

  const filas = datos.barrido.filter((r) => r.radio_m === radio);
  const cobertura = indicador === "pct_viajes_cubiertos";
  const unidad = cobertura ? "%" : "m";
  const ejeY = cobertura ? "Viajes cubiertos (%)" : indicador === "d_media_m" ? "Distancia media (m)" : "P90 por extremo (m)";
  const curvas: Data[] = METODOS.map((m) => {
    const puntos = filas.filter((r) => r.metodo === m);
    return {
      type: "scatter", mode: "lines+markers", name: datos.metodos[m],
      x: puntos.map((r) => r.k), y: puntos.map((r) => r[indicador]),
      line: { color: css(COLORES_LOCALIZACION[m]) }, marker: { size: puntos.map((r) => r.k === k ? 9 : 4) },
      hovertemplate: `%{x} estaciones<br>%{y:.1f} ${unidad}<extra>%{fullData.name}</extra>`,
    };
  });
  const resultados = METODOS.map((m) => comparacion.resultados[m]);
  const niveles = [
    { campo: "viajes_cubiertos", nombre: "Ambos", color: "#246cab" },
    { campo: "viajes_un_extremo", nombre: "Un extremo", color: "#c58a45" },
    { campo: "viajes_sin_cobertura", nombre: "Ninguno", color: "#8d9bab" },
  ] as const;
  const desglose: Data[] = niveles.map(({ campo, nombre, color }) => ({
    type: "bar", orientation: "h", name: nombre,
    y: resultados.map((r) => r.metodo === "kmedoids" ? "K-medoids" : "K-means"),
    x: resultados.map((r) => 100 * r[campo] / r.viajes_ajuste),
    customdata: resultados.map((r) => r[campo]), marker: { color },
    hovertemplate: "%{customdata} viajes · %{x:.1f} %<extra>%{fullData.name}</extra>",
  }));
  const formatos: [string, (r: ResultadoRed) => string][] = [
    ["Ambos extremos cubiertos", (r) => `${num(r.viajes_cubiertos)} · ${pc(r.pct_viajes_cubiertos)}`],
    ["Orígenes cubiertos", (r) => pc(r.pct_origenes_cubiertos)],
    ["Destinos cubiertos", (r) => pc(r.pct_destinos_cubiertos)],
    ["Distancia media por extremo", (r) => `${num(r.d_media_m)} m`],
    ["P90 en origen y destino", (r) => `${num(r.d_origen_p90_m)} / ${num(r.d_destino_p90_m)} m`],
    ["Emplazamientos con avisos", (r) => num(r.estaciones_con_avisos)],
  ];
  return (
    <article className="loc-bloque">
      <div className="loc-cabecera">
        <h3>Comparación de redes sobre Roma</h3>
        <a href={enlaceComparacion(radio, k, modo, elegido?.candidate_id)}>Abrir esta comparación en 3D ↗</a>
      </div>
      <ControlesRed datos={datos} filtros={filtros} cambiar={cambiar} />
      <Cifras cifras={[
        { valor: num(comparacion.compartidos), nombre: "emplazamientos compartidos" },
        { valor: num(k - comparacion.compartidos), nombre: "exclusivos de cada método" },
        { valor: pc(resultados[0].pct_viajes_cubiertos - resultados[1].pct_viajes_cubiertos).replace(" %", " pp"),
          nombre: "cobertura de K-medoids frente a K-means" },
      ]} />
      <Suspense fallback={<p className="loc-mapa loc-estado">Cargando mapa de Roma…</p>}>
        <MapaRoma catalogo={catalogo.candidatos} marcadores={marcadores} seleccionado={elegido} cambiar={setId}
          radio={radio} dibujarRadios={radiosVisibles} comparacion={comparacion} metodos={datos.metodos} />
      </Suspense>
      <p className="loc-nota">Los círculos muestran distancia en línea recta. La ficha cuenta salidas y llegadas de viajes observados que tienen los dos extremos cubiertos por la red elegida.</p>
      <div className="loc-graficas">
        <section>
          <h3>Rendimiento con cada presupuesto</h3>
          <Segmentado etiqueta="Indicador del barrido" valor={indicador} cambiar={setIndicador} opciones={[
            { valor: "pct_viajes_cubiertos", texto: "Cobertura" },
            { valor: "d_media_m", texto: "Distancia media" },
            { valor: "d_p90_m", texto: "P90 de acceso" },
          ]} />
          <Grafica descripcion={ejeY + " según el número de estaciones"} alto={330} trazas={curvas}
            capa={{
              xaxis: { title: { text: "Estaciones por método" } }, yaxis: { title: { text: ejeY } },
              shapes: cobertura ? [{
                type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: datos.objetivo_pct, y1: datos.objetivo_pct,
                line: { color: "#677382", dash: "dot", width: 1.2 },
              }] : [],
            }} />
        </section>
        <section>
          <h3>Viajes según cobertura de sus extremos</h3>
          <p className="loc-nota">{num(k)} estaciones por método y radio de {num(radio)} m.</p>
          <Grafica descripcion="Proporción de viajes con cobertura en ambos extremos, uno solo y ninguno" alto={265} trazas={desglose}
            capa={{ barmode: "stack", margin: { l: 84, t: 12 }, xaxis: { range: [0, 100], ticksuffix: " %" } }} />
        </section>
      </div>
      <div className="loc-resultados">
        <table>
          <caption>Indicadores con {k} estaciones y {radio} m de radio</caption>
          <thead><tr><th scope="col">Indicador</th>{METODOS.map((m) => <th scope="col" key={m}>{datos.metodos[m]}</th>)}</tr></thead>
          <tbody>{formatos.map(([nombre, valor]) => <tr key={nombre}><th scope="row">{nombre}</th>
            {resultados.map((r) => <td key={r.metodo} className="num">{valor(r)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <details className="tabla">
        <summary>Cómo se comparan los métodos</summary>
        <p>Los métodos se ajustan sobre los pesos por celda del 1 al 21 de febrero. K-medoids busca centros dentro del catálogo. K-means calcula centroides y los asigna a candidatos distintos. Las distancias y la cobertura se calculan después con las coordenadas originales de cada viaje.</p>
        <p>El P90 es la distancia que deja al 90 % de los extremos por debajo e incluye los viajes fuera de radio. La semana reservada del 22 al 28 de febrero se utiliza en T30, con las redes y criterios ya fijados.</p>
        <a href="https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/resultados/tablas/movilidad/T25_barrido.csv">Consultar las métricas del barrido</a>
      </details>
    </article>
  );
}
