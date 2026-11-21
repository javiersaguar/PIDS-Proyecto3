import { FASES } from "../../fases";
import { T20 } from "./T20";
import { T21 } from "./T21";

const SECCIONES = [
  { id: "t20", tarea: "T20", titulo: "Primera matriz OD" },
  { id: "t21", tarea: "T21", titulo: "Matrices por zonas administrativas" },
  { id: "siguientes", tarea: "", titulo: "Lo que falta" },
  { id: "decisiones", tarea: "", titulo: "Decisiones" },
];

const DECISIONES = [
  ["Viajes intrazonales", "21,4 % en resolución 8; con radios de 300 m o más, parte empezarían y acabarían en la misma estación", "T20"],
  ["Corredores asimétricos", "No hay: los pares son casi simétricos y el rebalanceo se plantea por zonas, no por corredores", "T20"],
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
      <section id="siguientes" className="seccion">
        <header>
          <div>
            <div className="etiqueta">T22–T39</div>
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
