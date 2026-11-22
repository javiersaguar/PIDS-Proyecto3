import { Cargando } from "../../componentes/Controles";
import { Seccion } from "../../componentes/Seccion";
import { useValidacionRed } from "../../localizacion/validacion";
import { useRuta } from "../../ruta";
import { CoberturaParcial, ElegirRed, PresupuestoFijo } from "./ModelosRed";
import { AccesoPeatonal, TransferenciaTemporal } from "./PruebasRed";

export const TAREAS_RED = [
  { id: "t26", tarea: "T26", titulo: "Mínimo de estaciones", notebook: "T26_cobertura_parcial",
    objetivo: "Alcanzar el 80 % de viajes completos con el menor número de estaciones de T24, para cada radio.",
    valor: "Acota el coste de infraestructura mediante una solución comprobable y una cota inferior certificada.",
    tablas: [["T26_certificados.csv", "Cotas auditadas"], ["T26_redes.csv", "Emplazamientos factibles"]] },
  { id: "t27", tarea: "T27", titulo: "Modelos a presupuesto fijo", notebook: "T27_pmediana_mclp",
    objetivo: "Contrastar qué cambia al maximizar viajes completos o al acercar los extremos a las estaciones.",
    valor: "Mide la cobertura y las distancias con el mismo radio, presupuesto y demanda de ajuste.",
    tablas: [["T27_resultados.csv", "Resultados por método"], ["T27_certificados.csv", "Cotas de MCLP"]] },
  { id: "t28", tarea: "T28", titulo: "Pareto y elección de la red", notebook: "T28_pareto_eleccion",
    objetivo: "Comparar estaciones, cobertura y distancia de acceso antes de evaluar la semana reservada.",
    valor: "Explica la elección y permite explorar otros objetivos con las redes ensayadas.",
    tablas: [["T28_comparacion.csv", "Barrido y frentes"], ["T28_estaciones.csv", "Estaciones congeladas"]] },
  { id: "t29", tarea: "T29", titulo: "Acceso por calles", notebook: "T29_rutas_peatonales",
    objetivo: "Medir la cobertura de las redes congeladas por calles y pasos peatonales de Tíber y Termini.",
    valor: "Identifica dónde el radio geométrico sobreestima el acceso y cuánto depende del umbral.",
    tablas: [["T30_validacion_peatonal.csv", "Cobertura pareada"], ["T30_sensibilidad_peatonal.csv", "Sensibilidad al radio"]] },
  { id: "t30", tarea: "T30", titulo: "Validación en la semana reservada", notebook: "T30_validacion_temporal",
    objetivo: "Evaluar en los últimos siete días de febrero las redes seleccionadas en las primeras tres semanas.",
    valor: "Mide cuánto se conserva de la cobertura y localiza el cambio por día, horario y tipo de día.",
    tablas: [["T30_cobertura_diaria.csv", "Cobertura diaria"], ["T30_cobertura_franjas.csv", "Cobertura por franja"],
      ["T30_efectos_temporales.csv", "Descomposición del cambio"]] },
];
const TABLAS = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/resultados/tablas/movilidad/";

export function ValidacionRed() {
  const [, seccion, ...filtros] = useRuta();
  const actual = TAREAS_RED.find((s) => s.id === seccion) ?? TAREAS_RED[0];
  const estado = useValidacionRed(true, filtros.join("/"));
  const datos = estado.datos;
  return (
    <Seccion id={actual.id} tarea={actual.tarea} titulo={actual.titulo} responsable="Javier Saguar"
      objetivo={actual.objetivo} valor={actual.valor} notebook={"movilidad/" + actual.notebook + ".ipynb"}>
      <nav className="val-pasos" aria-label="Optimización y validación de la red">
        {TAREAS_RED.map((s) => (
          <a href={"#/fase1/" + s.id} key={s.id} aria-current={actual.id === s.id ? "page" : undefined}>
            <span>{s.tarea}</span>{s.titulo}
          </a>
        ))}
      </nav>
      {datos ? <article className="loc-bloque val-analisis" key={actual.id}>
        {actual.id === "t26" && <CoberturaParcial datos={datos} />}
        {actual.id === "t27" && <PresupuestoFijo datos={datos} />}
        {actual.id === "t28" && <ElegirRed datos={datos} />}
        {actual.id === "t29" && <AccesoPeatonal estado={estado} />}
        {actual.id === "t30" && <TransferenciaTemporal estado={estado} />}
        <div className="loc-acciones val-fuentes">
          {actual.tablas.map(([archivo, titulo]) => <a key={archivo} href={TABLAS + archivo}>{titulo} · CSV</a>)}
        </div>
      </article> : <Cargando error={estado.error} />}
    </Seccion>
  );
}
