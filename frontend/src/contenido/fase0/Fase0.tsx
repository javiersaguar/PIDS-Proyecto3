import { T10 } from "./T10";
import { T11 } from "./T11";
import { T12 } from "./T12";

const SECCIONES = [
  { id: "t10", tarea: "T10", titulo: "Limpieza" },
  { id: "t11", tarea: "T11", titulo: "Recolocaciones" },
  { id: "t12", tarea: "T12", titulo: "Patrones temporales" },
  { id: "pendientes", tarea: "T13–T17", titulo: "Espacio, recorridos, energía y meteorología" },
  { id: "decisiones", tarea: "", titulo: "Decisiones de la fase" },
];

// Tareas de exploración que faltan, con la pregunta que responden y la decisión que alimentan
// (docs/PLAN.md, "Exploración orientada a decisiones").
const PENDIENTES = [
  {
    tarea: "T13",
    titulo: "Densidad de orígenes y destinos en H3",
    pregunta: "¿Dónde empiezan y acaban los viajes y cuántas celdas reúnen el 50, 80, 90 y 95 % de los extremos?",
    decision: "Resolución de la rejilla, zona donde buscar candidatos y rango de número de estaciones del barrido.",
  },
  {
    tarea: "T14",
    titulo: "Saldo neto por celda, franja y día",
    pregunta: "¿Dónde se acumula la flota a lo largo del día?",
    decision: "Necesidad de rebalanceo y estaciones que piden más anclajes.",
  },
  {
    tarea: "T15",
    titulo: "Recorridos y radios de acceso",
    pregunta: "¿Cómo son los recorridos: distancia, duración, velocidad, rodeo y viajes circulares?",
    decision: "Radios de acceso del barrido y demanda que dejaría de tener sentido con estaciones.",
  },
  {
    tarea: "T16",
    titulo: "Kilómetros y energía de referencia",
    pregunta: "¿Cuánta energía mueve cada patinete al día con 13,5 Wh/km?",
    decision: "Frecuencia de recarga y orden de magnitud de la demanda por estación.",
  },
  {
    tarea: "T17",
    titulo: "Meteorología y días anómalos",
    pregunta: "¿Explican la lluvia o la temperatura los días con poca demanda?",
    decision: "Si se excluye algún día y si la semana reservada es comparable.",
  },
];

const DECISIONES = [
  ["Umbrales de limpieza", "60 s, 100 m, 2 km/h, 25 km/h y 2 h", "T10"],
  ["Viajes elegibles", "23 292: 16 710 en el ajuste y 6 582 en la semana reservada", "T10"],
  ["Robustez de la limpieza", "La limpieza permisiva no cambia los indicadores clave; se usa la principal", "T10"],
  ["Umbral de recolocación", "200 m, en el valle entre el ruido de GPS y los saltos de kilómetros", "T11"],
  ["Rebalanceo", "El piloto hacía recogidas de varios días, no rebalanceo dentro del día; el escenario de la fase 1 será nocturno", "T11"],
  ["Franjas horarias", "Madrugada 0–7, punta de mañana 7–10, mediodía 10–16, punta de tarde 16–20 y noche 20–24", "T12"],
  ["Tipos de día", "Laborable y fin de semana por separado en las matrices OD y en el simulador", "T12"],
  ["Cota inferior de la flota", "41 patinetes; la flota la fijará la simulación de inventario por estación", "T12"],
  ["Semana reservada", "Tiene un 18 % más de demanda: la validación es más exigente que el ajuste", "T12"],
];

export function Fase0() {
  return (
    <>
      <nav className="indice" aria-label="Secciones de la fase 0">
        {SECCIONES.map((s) => (
          <a key={s.id} href={`#/fase0/${s.id}`}>
            {s.tarea && <span className="id">{s.tarea}</span>}
            {s.titulo}
          </a>
        ))}
      </nav>
      <T10 />
      <T11 />
      <T12 />
      <section id="pendientes" className="seccion">
        <header>
          <div>
            <div className="etiqueta">T13–T17 · Alejandro Cuevas</div>
            <h2>Espacio, recorridos, energía y meteorología</h2>
          </div>
          <div>
            <p>
              Estas tareas están en curso. Cada una tendrá aquí sus gráficas, con la misma estructura que las anteriores,
              en cuanto su notebook exporte los datos.
            </p>
          </div>
        </header>
        <div className="tarjetas">
          {PENDIENTES.map((p) => (
            <div key={p.tarea} className="tarjeta">
              <div className="arriba">
                <span>{p.tarea} · Alejandro Cuevas</span>
                <span className="chapa">pendiente</span>
              </div>
              <h3>{p.titulo}</h3>
              <p>
                <strong>Pregunta.</strong> {p.pregunta}
              </p>
              <p>
                <strong>Decisión.</strong> {p.decision}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section id="decisiones" className="seccion">
        <header>
          <div>
            <div className="etiqueta">Resumen</div>
            <h2>Decisiones de la fase 0</h2>
          </div>
          <div>
            <p>
              Lo que fija la exploración para las fases siguientes. El detalle de cada decisión, con su evidencia, el
              periodo usado y sus limitaciones, está en <code>docs/conclusiones_eda.md</code>.
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
                    <a href={`#/fase0/${t.toLowerCase()}`}>{t}</a>
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
