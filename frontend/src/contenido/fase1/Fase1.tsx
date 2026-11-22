import { FASES } from "../../fases";
import { T20 } from "./T20";
import { T21 } from "./T21";
import { T22 } from "./T22";
import { T23 } from "./T23";
import { T24 } from "./T24";
import { T25 } from "./T25";
import { TAREAS_RED, ValidacionRed } from "./ValidacionRed";

const SECCIONES = [
  { id: "t20", tarea: "T20", titulo: "Primera matriz OD" },
  { id: "t21", tarea: "T21", titulo: "Matrices por zonas administrativas" },
  { id: "t22", tarea: "T22", titulo: "Matrices por franja" },
  { id: "t23", tarea: "T23", titulo: "Líneas de deseo" },
  { id: "t24", tarea: "T24", titulo: "Candidatos a estación" },
  { id: "t25", tarea: "T25", titulo: "Líneas base de localización" },
  ...TAREAS_RED,
  { id: "siguientes", tarea: "", titulo: "Lo que falta" },
  { id: "decisiones", tarea: "", titulo: "Decisiones" },
];

const DECISIONES = [
  ["Viajes intrazonales", "21,4 % en resolución 8; con radios de 300 m o más, parte empezarían y acabarían en la misma estación", "T20"],
  ["Desequilibrio interzonal", "Comparar el saldo por par y franja antes de decidir el rebalanceo", "T23"],
  ["Catálogo de estaciones", "Partir de los candidatos de T24 y revisar los avisos cartográficos de las redes finalistas", "T24"],
  ["Líneas base", "Comparar cobertura de viajes completos y distancia en cada extremo con el mismo presupuesto y radio", "T25"],
  ["Selección de la red", "Congelar los emplazamientos del ajuste antes de comprobar el acceso a pie y la transferencia temporal", "T28"],
];

export function Fase1() {
  const previsto = FASES.find((f) => f.id === "fase1")!.previsto;
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
      <section id="siguientes" className="seccion">
        <header>
          <div>
            <div className="etiqueta">T31–T39</div>
            <h2>Lo que falta de la fase</h2>
          </div>
          <div>
            <p>
              Las gráficas de estas tareas aparecerán aquí cuando sus notebooks exporten los datos. Parten de las
              decisiones de la fase 0: candidatos en H3 de resolución 9, radios de 200, 250 y 300 m (400 m como
              sensibilidad) y rebalanceo nocturno en el escenario base.
            </p>
          </div>
        </header>
        <div className="aviso">
          <strong>Previsto.</strong>
          <ul>
            {previsto.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </section>
      <section id="decisiones" className="seccion">
        <header>
          <div>
            <div className="etiqueta">Resumen</div>
            <h2>Decisiones de la fase 1 hasta ahora</h2>
          </div>
          <div>
            <p>
              El detalle de cada decisión, con su evidencia y sus limitaciones, está en <code>docs/conclusiones_eda.md</code>.
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
