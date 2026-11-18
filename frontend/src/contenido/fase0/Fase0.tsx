import { T10 } from "./T10";
import { T11 } from "./T11";
import { T12 } from "./T12";
import { T13 } from "./T13";
import { T14 } from "./T14";
import { T15 } from "./T15";
import { T16 } from "./T16";
import { T17 } from "./T17";

const SECCIONES = [
  { id: "t10", tarea: "T10", titulo: "Limpieza" },
  { id: "t11", tarea: "T11", titulo: "Recolocaciones" },
  { id: "t12", tarea: "T12", titulo: "Patrones temporales" },
  { id: "t13", tarea: "T13", titulo: "Densidad en H3" },
  { id: "t14", tarea: "T14", titulo: "Saldo por celda" },
  { id: "t15", tarea: "T15", titulo: "Recorridos y radios" },
  { id: "t16", tarea: "T16", titulo: "Energía de referencia" },
  { id: "t17", tarea: "T17", titulo: "Meteorología" },
  { id: "decisiones", tarea: "", titulo: "Decisiones de la fase" },
];

const DECISIONES = [
  ["Umbrales de limpieza", "60 s, 100 m, 2 km/h, 25 km/h y 2 h", "T10"],
  ["Viajes elegibles", "23 292: 16 710 en el ajuste y 6 582 en la semana reservada", "T10"],
  ["Robustez de la limpieza", "La limpieza permisiva no cambia los indicadores clave; se usa la principal", "T10"],
  ["Umbral de recolocación", "200 m, en el valle entre el ruido de GPS y los saltos de kilómetros", "T11"],
  ["Recolocaciones del piloto", "Recogidas de varios días, no rebalanceo dentro del día; el escenario de la fase 1 será nocturno", "T11"],
  ["Franjas horarias", "Madrugada 0–7, punta de mañana 7–10, mediodía 10–16, punta de tarde 16–20 y noche 20–24", "T12"],
  ["Tipos de día", "Laborable y fin de semana por separado en las matrices OD y en el simulador", "T12"],
  ["Cota inferior de la flota", "41 patinetes; la flota la fijará la simulación de inventario por estación", "T12"],
  ["Rejilla de candidatos", "H3 de resolución 9 (201 m de arista); la resolución 8 queda para mapas, saldos y matrices OD", "T13"],
  ["Rango de estaciones del barrido", "230–387 con 200 m, 102–172 con 300 m y 58–97 con 400 m", "T13"],
  ["Marca fuera_de_zona", "No hace falta: el único extremo aislado ya no era elegible", "T13"],
  ["Rebalanceo", "Hace falta: el saldo es estructural y el piloto ya lo compensaba. Cota inferior de unos 100 patinetes/día en resolución 8 y 220 en resolución 9", "T14"],
  ["Franjas del desequilibrio", "Sobre todo la punta de mañana, que se invierte por la tarde: el simulador trabaja por franjas o en continuo", "T14"],
  ["Radios del barrido", "200, 250 y 300 m; 400 m como sensibilidad", "T15"],
  ["Rodeo y velocidad a pie (hipótesis)", "1,328 y 1,3 m/s", "T15"],
  ["Viajes circulares", "3,58 %: el simulador admite origen y destino en la misma estación", "T15"],
  ["Frecuencia de recarga", "Cada varios días con el uso observado (autonomía mediana de 45,6 días); se repite con la flota simulada", "T16"],
  ["Energía por estación", "De décimas de kWh a 1 kWh al día; más de la mitad llega de 16 a 24 h", "T16"],
  ["Días excluidos", "Ninguno: el 07/02 es un día real de lluvia; se marca y no se usa como día de diseño", "T17"],
  ["Semana reservada", "18 % más de viajes, sin lluvia y más cálida: la validación es más exigente que el ajuste", "T17"],
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
      <T13 />
      <T14 />
      <T15 />
      <T16 />
      <T17 />
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
