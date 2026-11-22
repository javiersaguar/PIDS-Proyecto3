import { lazy, Suspense, useMemo, useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { fecha, num, pc } from "../../formato";
import { AVISOS, enlaceCatalogo, marcadoresT24, type DatosT24, type VistaCandidatos } from "../../localizacion/modelo";
import "../../localizacion/localizacion.css";

const MapaRoma = lazy(() => import("../../localizacion/MapaRoma"));
const CATALOGO = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/resultados/tablas/movilidad/T24_candidatos.csv";

export function T24() {
  const { datos, error } = useDatos<DatosT24>("fase1/t24_candidatos");
  return (
    <Seccion id="t24" tarea="T24" responsable="Javier Saguar" titulo="Candidatos a estación"
      notebook="movilidad/T24_candidatos_estacion.ipynb"
      objetivo="Crear un emplazamiento por celda del ajuste y revisar los puntos junto al río o a vías con restricciones."
      valor="Da a los modelos un catálogo común y permite localizar qué emplazamientos hay que comprobar sobre el terreno.">
      {datos ? <ExplorarCandidatos datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function ExplorarCandidatos({ datos }: { datos: DatosT24 }) {
  const [filtro, setFiltro] = useState<VistaCandidatos>("todos");
  const [id, setId] = useState<string | null>(null);
  const { resumen, candidatos, umbrales } = datos;
  const puntos = useMemo(() => marcadoresT24(datos, filtro), [datos, filtro]);
  const elegido = puntos.find((p) => p.candidato.candidate_id === id)?.candidato;
  const ordenados = useMemo(() => [...candidatos].sort((a, b) => b.extremos - a.extremos), [candidatos]);
  const movido = ordenados.find((c) => c.posicion === "extremo_en_tierra");
  const [inicio, fin] = datos.periodo_ajuste;
  let sumados = 0;
  const acumulado = ordenados.map((c) => 100 * (sumados += c.extremos) / resumen.extremos_ajuste);
  const k80 = acumulado.findIndex((v) => v >= 80) + 1;
  const ranking = [...puntos].sort((a, b) => b.candidato.extremos - a.candidato.extremos).slice(0, 10).reverse();
  const barras: Data[] = [
    { type: "bar", orientation: "h", name: "Orígenes", x: ranking.map(({ candidato: c }) => c.origenes),
      y: ranking.map(({ candidato: c }) => c.candidate_id), marker: { color: "#286db0" } },
    { type: "bar", orientation: "h", name: "Destinos", x: ranking.map(({ candidato: c }) => c.destinos),
      y: ranking.map(({ candidato: c }) => c.candidate_id), marker: { color: "#76a9c7" } },
  ];
  return (
    <article className="loc-bloque">
      <div className="loc-cabecera">
        <h3>Catálogo sobre el mapa de Roma</h3>
        <a href={enlaceCatalogo(elegido?.candidate_id)}>Abrir en el mapa 3D ↗</a>
      </div>
      <p>Del {fecha(inicio)} al {fecha(fin)}, los {num(resumen.extremos_ajuste)} extremos observados se agrupan en H3 de resolución {resumen.resolucion}.</p>
      <Cifras cifras={[
        { valor: num(resumen.candidatos), nombre: "celdas con demanda" },
        { valor: num(resumen.desplazados), nombre: "centros desplazados a tierra" },
        { valor: num(resumen.candidatos_con_avisos), nombre: "emplazamientos con avisos" },
      ]} />
      <div className="controles">
        <Segmentado etiqueta="Candidatos visibles" valor={filtro} opciones={AVISOS} cambiar={(v) => {
          setFiltro(v);
          setId(null);
        }} />
        {movido && <span className="loc-acciones"><button type="button" onClick={() => {
          setFiltro("desplazados");
          setId(movido.candidate_id);
        }}>Ver un centro desplazado</button></span>}
      </div>
      <Suspense fallback={<p className="loc-mapa loc-estado">Cargando mapa de Roma…</p>}>
        <MapaRoma catalogo={candidatos} marcadores={puntos} seleccionado={elegido} cambiar={setId} />
      </Suspense>
      <p className="loc-nota">El tamaño del punto representa los extremos de su celda. Selecciónalo para acercarte. El contorno muestra la celda y, en los puntos desplazados, la línea une el centro original con la posición usada en el catálogo.</p>
      <div className="loc-graficas">
        <section>
          <h3>Concentración de los extremos</h3>
          <p className="loc-nota">{num(k80)} celdas reúnen el {pc(80, 0)} de los extremos del ajuste.</p>
          <Grafica descripcion="Porcentaje acumulado de extremos por número de celdas, ordenadas por demanda" alto={280}
            trazas={[
              { type: "scatter", mode: "lines", fill: "tozeroy", fillcolor: "rgba(40,109,176,.13)", line: { color: "#286db0" },
                x: acumulado.map((_, i) => i + 1), y: acumulado, hovertemplate: "%{x} celdas · %{y:.1f} %<extra></extra>", showlegend: false },
              { type: "scatter", mode: "markers", x: [k80], y: [acumulado[k80 - 1]], marker: { size: 9, color: "#286db0" },
                hovertemplate: "%{x} celdas · %{y:.1f} %<extra></extra>", showlegend: false },
            ]}
            capa={{ margin: { t: 12 }, xaxis: { title: { text: "Celdas" } }, yaxis: { range: [0, 103], ticksuffix: " %" } }} />
        </section>
        <section>
          <h3>Celdas con más actividad</h3>
          <p className="loc-nota">Orígenes y destinos de las {num(ranking.length)} primeras del filtro visible.</p>
          <Grafica descripcion="Orígenes y destinos de los candidatos mostrados con mayor demanda" alto={280} trazas={barras}
            capa={{ barmode: "stack", margin: { l: 116, t: 12 },
              xaxis: { title: { text: "Extremos en el ajuste" } },
              yaxis: { tickvals: ranking.map(({ candidato: c }) => c.candidate_id),
                ticktext: ranking.map(({ candidato: c }) => (c.via_cercana ?? c.candidate_id).slice(0, 20)), tickfont: { size: 10 } } }} />
        </section>
      </div>
      <details className="tabla">
        <summary>Cómo se construyó y revisó el catálogo</summary>
        <p>Se conserva el centro de cada celda con demanda del ajuste. Cuando el centro cae en agua cartografiada, se busca el extremo observado en tierra más cercano dentro de esa celda. La ficha indica cuánto se desplazó el punto.</p>
        <p>El catálogo marca {num(resumen.proximos_rio)} posiciones a {umbrales.rio_m} m o menos del río y {num(resumen.proximos_via)} a {umbrales.via_m} m o menos de vías con restricciones. Una posición puede tener los dos avisos. El recuento de vecinos usa una separación menor de {resumen.solape_m} m.</p>
        <p>La vía de referencia se toma de la cartografía archivada. Comprobar el acceso peatonal y el espacio disponible corresponde a la revisión urbana de las finalistas.</p>
        <a href={CATALOGO}>Consultar el catálogo completo con coordenadas y avisos</a>
      </details>
    </article>
  );
}
