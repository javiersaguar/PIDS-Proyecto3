import type { Data } from "plotly.js-dist-min";
import { Cargando } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { num, pc } from "../../formato";
import { FiltrosValidacion, IndicadoresValidacion } from "../../localizacion/PanelValidacion";
import {
  enlaceValidacion, SECTORES, useValidacionRed,
  type DatosValidacion, type EstadoValidacion, type ResultadoSolver,
} from "../../localizacion/validacion";

const COLORES: Record<string, string> = {
  lscp: "#975738", mclp: "#238471", pmediana: "#8a72a9",
  voraz: "#677685", kmedoids: "#306eae", kmeans: "#c28855",
};
const REPO = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/";

export function T30() {
  const estado = useValidacionRed();
  return (
    <Seccion id="t30" tarea="T26–T30" responsable="Javier Saguar" titulo="Selección y validación de la red"
      objetivo="Comparar redes con un mismo catálogo y evaluar los emplazamientos elegidos en la semana reservada."
      valor="Cuantifica por separado la cobertura geométrica de Roma y el cambio al recorrer calles de Tíber y Termini.">
      {estado.datos && estado.red && estado.geo && estado.pie ? (
        <article className="loc-bloque">
          <div className="loc-cabecera">
            <h3>La misma red en dos periodos</h3>
            <a href={enlaceValidacion(estado.periodo, estado.sector, estado.red.network_id)}>Abrir esta validación en 3D ↗</a>
          </div>
          <FiltrosValidacion estado={estado} />
          <div className="val-evidencia">
            <IndicadoresValidacion estado={estado} />
            <ComparacionPeatonal estado={estado} />
          </div>
          <p className="loc-nota">La comparación peatonal usa los viajes con los dos extremos en un núcleo y las dos rutas medibles. La geometría de toda Roma se muestra aparte.</p>
          <Metodos datos={estado.datos} radio={estado.red.radio_m} />
          <details className="tabla">
            <summary>Cómo se fijó y validó la red</summary>
            <p>Se eligió en el ajuste la red de menos estaciones entre los radios principales que alcanza el {estado.datos.objetivo_pct} % de viajes con ambos extremos cubiertos en recta. El P90 de todos los extremos deshace empates. Las ubicaciones se congelaron antes de evaluar la semana reservada.</p>
            <p>Las rutas usan calles, pasos y puentes del grafo OSM archivado. Para contar la cobertura de un viaje, el origen debe llegar en radio a una estación y el destino debe quedar en radio a pie desde una estación. El grafo de cada sector incluye un margen alrededor de la muestra.</p>
            <p>La cartografía es de noviembre de 2026 y se aplica a viajes observados de febrero de 2021. La referencia permite comparar el acceso bajo el mismo criterio.</p>
            <div className="loc-acciones">
              <a href={REPO + "movilidad/T26_cobertura_parcial.ipynb"}>Modelo T26</a>
              <a href={REPO + "movilidad/T27_pmediana_mclp.ipynb"}>Modelos T27</a>
              <a href={REPO + "movilidad/T28_pareto_eleccion.ipynb"}>Selección T28</a>
              <a href={REPO + "movilidad/T29_rutas_peatonales.ipynb"}>Rutas T29</a>
              <a href={REPO + "movilidad/T30_validacion_temporal.ipynb"}>Validación T30</a>
            </div>
          </details>
        </article>
      ) : <Cargando error={estado.error} />}
    </Seccion>
  );
}

function ComparacionPeatonal({ estado: e }: { estado: EstadoValidacion }) {
  const filas = e.datos?.peatonal.filter((p) => p.network_id === e.red?.network_id && p.periodo === e.periodo
    && (e.sector === "ambos" || e.sector === p.sector)) ?? [];
  const x = filas.map((p) => SECTORES[p.sector].split(" · ")[0] + "<br>" + num(p.viajes_comparables) + " viajes");
  const trazas: Data[] = [
    { type: "bar", name: "Línea recta", x, y: filas.map((p) => p.pct_linea), marker: { color: "#678fa4" },
      hovertemplate: "%{y:.1f} %<extra>%{fullData.name}</extra>" },
    { type: "bar", name: "Por la red peatonal", x, y: filas.map((p) => p.pct_a_pie), marker: { color: "#238471" },
      hovertemplate: "%{y:.1f} %<extra>%{fullData.name}</extra>" },
  ];
  return (
    <div>
      <h3>Los mismos viajes, dos medidas de acceso</h3>
      <Grafica descripcion="Cobertura de ambos extremos en recta y a pie, sobre la misma muestra" alto={310} trazas={trazas}
        capa={{ barmode: "group", margin: { t: 12, b: 77 },
          yaxis: { range: [0, 100], ticksuffix: " %", title: { text: "Viajes cubiertos" } } }} />
    </div>
  );
}

function Metodos({ datos, radio }: { datos: DatosValidacion; radio: number }) {
  const t = datos.barrido.filter((p) => p.radio_m === radio);
  const trazas: Data[] = Object.keys(COLORES).flatMap((metodo) => {
    const filas = t.filter((p) => p.metodo === metodo);
    return filas.length ? [{
      type: "scatter", mode: "markers", name: datos.metodos[metodo],
      x: filas.map((p) => p.k), y: filas.map((p) => p.pct_viajes_cubiertos),
      customdata: filas.map((p) => p.d_p90_m),
      marker: { color: COLORES[metodo], size: filas.map((p) => p.pareto_radio ? 8 : 5),
        symbol: filas.map((p) => p.network_id === datos.seleccionada ? "star" : "circle"),
        opacity: filas.map((p) => p.pareto_radio ? 1 : .48) },
      hovertemplate: "%{x} estaciones · %{y:.2f} %<br>P90 %{customdata:.1f} m<extra>%{fullData.name}</extra>",
    } as Data] : [];
  });
  const filaCota = (r: ResultadoSolver) => (
    <tr key={r.network_id}>
      <td>{datos.metodos[r.metodo]}</td><td>{r.radio_m} m</td><td>{r.k}</td><td>{pc(r.pct_viajes_cubiertos)}</td>
      <td>{r.cota_obj === null ? "—" : num(r.cota_obj, r.metodo === "pmediana" ? 1 : 0)}</td>
      <td>{r.brecha_pct === null ? "—" : pc(r.brecha_pct, 2)}</td>
      <td>{r.origen_solucion} · {r.estado_solver}</td>
    </tr>
  );
  return (
    <div className="loc-bloque">
      <h3>Alternativas del ajuste a {radio} m</h3>
      <p className="loc-nota">Los puntos más grandes forman el frente en estaciones, cobertura y P90. La estrella identifica la red elegida.</p>
      <Grafica descripcion={`Comparación de presupuestos y cobertura en el ajuste para ${radio} m`} alto={340} trazas={trazas}
        capa={{ xaxis: { title: { text: "Estaciones" } }, yaxis: { title: { text: "Viajes cubiertos (%)" } },
          shapes: [{ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: datos.objetivo_pct,
            y1: datos.objetivo_pct, line: { color: "#77848e", dash: "dot", width: 1.2 } }] }} />
      <details className="tabla">
        <summary>Cotas y brechas de los modelos T26 y T27</summary>
        <p>La cota se expresa en estaciones para LSCP, viajes cubiertos para MCLP y metros medios ponderados por celda para p-mediana. La brecha cuantifica la diferencia frente a la cota del modelo.</p>
        <div className="tabla-scroll">
          <table>
            <thead><tr>
              <th>Método</th><th>Radio</th><th>Estaciones</th><th>Cobertura</th><th>Cota</th><th>Brecha</th><th>Solución</th>
            </tr></thead>
            <tbody>{[...datos.lscp, ...datos.solver.filter((r) => r.radio_m === radio)].map(filaCota)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
