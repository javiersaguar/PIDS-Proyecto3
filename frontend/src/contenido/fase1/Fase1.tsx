import { CierreMovilidad, TAREAS_CIERRE } from "./CierreMovilidad";
import { T20 } from "./T20";
import { T21 } from "./T21";
import { T22 } from "./T22";
import { T23 } from "./T23";
import { T24 } from "./T24";
import { T25 } from "./T25";
import { T31 } from "./T31";
import { T32 } from "./T32";
import { T34 } from "./T34";
import { TAREAS_RED, ValidacionRed } from "./ValidacionRed";

const SECCIONES = [
  { id: "t20", tarea: "T20", titulo: "Primera matriz OD" },
  { id: "t21", tarea: "T21", titulo: "Matrices por zonas administrativas" },
  { id: "t22", tarea: "T22", titulo: "Matrices por franja" },
  { id: "t23", tarea: "T23", titulo: "Líneas de deseo" },
  { id: "t24", tarea: "T24", titulo: "Candidatos a estación" },
  { id: "t25", tarea: "T25", titulo: "Líneas base de localización" },
  ...TAREAS_RED,
  { id: "t31", tarea: "T31", titulo: "Asignación y matriz entre estaciones" },
  { id: "t32", tarea: "T32", titulo: "Stock y anclajes por estación" },
  TAREAS_CIERRE[0],
  { id: "t34", tarea: "T34", titulo: "Curva de flota" },
  ...TAREAS_CIERRE.slice(1),
  { id: "decisiones", tarea: "", titulo: "Conclusiones" },
];

const DECISIONES = [
  ["Viajes intrazonales", "21,4 % en resolución 8; con radios de 300 m o más, parte empezarían y acabarían en la misma estación", "T20"],
  ["Desequilibrio interzonal", "Comparar el saldo por par y franja antes de decidir el rebalanceo", "T23"],
  ["Catálogo de estaciones", "Partir de los candidatos de T24 y revisar los avisos cartográficos de las redes finalistas", "T24"],
  ["Líneas base", "Comparar cobertura de viajes completos y distancia en cada extremo con el mismo presupuesto y radio", "T25"],
  ["Selección de la red", "Congelar los emplazamientos del ajuste antes de comprobar el acceso a pie y la transferencia temporal", "T28"],
  ["Asignación por viaje", "Estación más cercana a 300 m en cada extremo y resultado de la simulación; las 16 756 solicitudes cuadran con T32 y la tabla alimenta consumo", "T31"],
  ["Stock y anclajes", "Anclajes = P90 diario de stock y subida de cada estación (966 en total); el stock inicial reparte la flota elegida en proporción al P90 (474 de diseño)", "T32"],
  ["Tamaño de la flota", "400 patinetes con los 966 anclajes de T32 atienden el 95,1 % (criterio del 95 %); el máximo, 95,9 %, está en 475 y queda como alternativa", "T34"],
  ["Rebalanceo", "100 movimientos como tope y prioridad al déficit: la opción con menos kilómetros que supera el 95 % en ajuste. La regla marginal empata (mejor en reserva) y merece una prueba operativa.", "T33"],
  ["Batería", "Con carga en cada anclaje no limita, ni con reserva del 20 % ni con el doble de consumo. Sin carga en las estaciones el servicio cae a la mitad: la carga en la estación es imprescindible.", "T35"],
  ["Acceso territorial", "Cinco cambios de emplazamiento suben 6,31 puntos la cobertura de las ocho zonas peor servidas sin perder servicio global. Alternativa si se prioriza el acceso.", "T37"],
  ["Cierres", "Una variante con 13 cambios alrededor de las estaciones críticas reduce a la mitad los viajes perdidos por cierres (24 frente a 48 en reserva).", "T38"],
  ["Comparación de redes", "Las redes de 159 estaciones a 300 m empatan en servicio. La elegida sigue como referencia para consumo y recarga; adoptar la redundante queda como decisión de equipo.", "T39"],
];

export function Fase1() {
  return (
    <>
      <nav className="indice" aria-label="Secciones de la fase 1">
        {SECCIONES.map((s) => (
          <a key={s.id} href={`#/fase1/${s.id}`}>
            {s.tarea && <span className="id">{s.tarea}</span>}
            {s.titulo}
          </a>
        ))}
      </nav>
      <T20 />
      <T21 />
      <T22 />
      <T23 />
      <T24 />
      <T25 />
      <ValidacionRed />
      <T31 />
      <T32 />
      <T34 />
      <CierreMovilidad />
      <section id="decisiones" className="seccion">
        <header>
          <div>
            <div className="etiqueta">Resumen</div>
            <h2>Conclusiones de movilidad</h2>
          </div>
          <div>
            <p>
              La fase deja fijada la referencia de operación y cuantifica los compromisos de acceso, flota,
              rebalanceo y recarga. <a href="https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/docs/conclusiones_eda.md#cierre-de-la-fase-1">Métodos, evidencia y decisiones</a>.
            </p>
          </div>
        </header>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Decisión</th>
                <th>Valor</th>
                <th>Tarea</th>
              </tr>
            </thead>
            <tbody>
              {DECISIONES.map(([d, v, t]) => (
                <tr key={d}>
                  <td>{d}</td>
                  <td>{v}</td>
                  <td>
                    <a href={`#/fase1/${t.toLowerCase()}`}>{t}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
