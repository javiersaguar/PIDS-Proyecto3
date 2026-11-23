import { useState } from "react";
import { Cargando } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { fecha, num, pc } from "../../formato";
import { pp } from "../../localizacion/PanelValidacion";
import { PERIODOS, type Periodo } from "../../localizacion/validacion";
import { useRuta } from "../../ruta";

type Servicio = {
  periodo: Periodo; solicitudes: number; cubiertas: number; n_atendido: number;
  n_sin_patinete: number; n_sin_anclaje: number; pct_atendidos_total: number; pct_atendidos_cubiertos: number;
  patinetes_movidos: number; km_rebalanceo: number;
};
type Reb = Servicio & { politica: string; limite: number; deficit_medio: number };
type Carga = Servicio & { caso: string; n_sin_bateria: number; traccion_kwh: number | null;
  recargada_kwh: number | null; pendiente_kwh: number | null };
type Red = Servicio & { red: string; estaciones: number; radio_m: number; redundantes: number;
  kwh_dia: number; pico_red_kw: number; pico_estacion_kw: number; cuota_top10_pct: number };
type Zona = { periodo: Periodo; red: string; zona: string; nombre: string; viajes: number; pct: number; prioritaria: boolean };
type Cierre = {
  periodo: Periodo; red: string; station_id: string; inicio: string; fin: string; exposicion_ajuste: number;
  atendidos_normal: number; atendidos_cierre: number; perdidos: number; recuperados: number;
  desviados: number; metros_adicionales: number; perdida_periodo: number;
  recogidas_desviadas: number; devoluciones_desviadas: number; destino_mas_desviado: string;
  llena_normal_pct: number | null; llena_cierre_pct: number | null;
};
type Datos = {
  flota: number; anclajes: number; limite: number;
  network_id: string;
  rebalanceo: Reb[]; bateria: Carga[]; redes: Red[]; zonas: Zona[]; cierres: Cierre[];
};

const REDES: Record<string, string> = {
  habitual: "Red elegida", menos_estaciones: "Menos estaciones", radio_menor: "Menor radio",
  equidad: "Acceso territorial", redundante: "Redundante",
};
const POLITICA: Record<string, string> = { deficit: "Mayor déficit", beneficio: "Beneficio marginal" };
export const TAREAS_CIERRE = [
  { id: "t33", tarea: "T33", titulo: "Rebalanceo nocturno", objetivo: "Medir cuánto servicio recupera cada regla de traslado y a qué coste.",
    ficheros: ["T33_politicas", "T33_noches"] },
  { id: "t35", tarea: "T35", titulo: "Estado de carga", objetivo: "Comprobar cuándo la batería limita el servicio con el inventario elegido.",
    ficheros: ["T35_carga"] },
  { id: "t36", tarea: "T36", titulo: "Cobertura y flujos en Roma", objetivo: "Vincular la cartografía de la red elegida con los recuentos de cobertura y servicio.",
    ficheros: ["T36_cobertura_operativa", "T36_flujos_operativos"] },
  { id: "t37", tarea: "T37", titulo: "Acceso de las zonas peor cubiertas", objetivo: "Mejorar la cobertura del cuartil peor servido en el ajuste con un presupuesto fijo.",
    ficheros: ["T37_zonas", "T37_equidad", "T37_T38_intercambios"] },
  { id: "t38", tarea: "T38", titulo: "Cierres de estaciones críticas", objetivo: "Medir la respuesta ante cinco cierres y comprobar si la redundancia recupera servicio.",
    ficheros: ["T38_cierres", "T38_redundante", "T37_T38_intercambios"] },
  { id: "t39", tarea: "T39", titulo: "Comparación final de redes", objetivo: "Comparar cobertura, operación y demanda equivalente de recarga con los mismos recursos.",
    ficheros: ["T39_redes", "T39_estaciones"] },
];
const CSV = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/resultados/tablas/movilidad/";
const metros = (x: number | null) => x == null ? "—" : num(x, 1);

export function CierreMovilidad() {
  const [, seccion] = useRuta();
  const actual = TAREAS_CIERRE.find((t) => t.id === seccion) ?? TAREAS_CIERRE[0];
  const { datos, error } = useDatos<Datos>("fase1/cierre_movilidad");
  const [periodo, setPeriodo] = useState<Periodo>("ajuste");
  return <Seccion id={actual.id} tarea={actual.tarea} titulo={actual.titulo} responsable="Equipo de movilidad"
    objetivo={actual.objetivo} valor="Contrasta alternativas con los supuestos, recuentos y controles documentados."
    notebook="movilidad/T33_T39_cierre.ipynb">
    <nav className="val-pasos" aria-label="Cierre de movilidad">
      {TAREAS_CIERRE.map((t) => <a key={t.id} href={"#/fase1/" + t.id} aria-current={t.id === actual.id ? "page" : undefined}>
        <span>{t.tarea}</span>{t.titulo}</a>)}
    </nav>
    {datos ? <article className="loc-bloque">
      <div className="loc-controles"><label>Periodo de movilidad
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          {Object.entries(PERIODOS).map(([p, label]) => <option key={p} value={p}>{label}</option>)}
        </select>
      </label></div>
      {actual.id === "t33" && <Rebalanceo datos={datos} periodo={periodo} />}
      {actual.id === "t35" && <Baterias filas={datos.bateria.filter((r) => r.periodo === periodo)} />}
      {actual.id === "t36" && <CapaMapa datos={datos} periodo={periodo} />}
      {actual.id === "t37" && <Equidad filas={datos.zonas.filter((r) => r.periodo === periodo && r.prioritaria)} />}
      {actual.id === "t38" && <Cierres datos={datos} periodo={periodo} />}
      {actual.id === "t39" && <Redes datos={datos} periodo={periodo} />}
      <div className="loc-acciones val-fuentes">
        {actual.ficheros.map((f) => <a key={f} href={CSV + f + ".csv"}>{f.replaceAll("_", " ")} · CSV</a>)}
      </div>
    </article> : <Cargando error={error} />}
  </Seccion>;
}

function Rebalanceo({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.rebalanceo.filter((r) => r.periodo === periodo);
  const ref = filas.find((r) => r.limite === datos.limite && r.politica === "deficit")!;
  const alt = filas.find((r) => r.limite === datos.limite && r.politica === "beneficio")!;
  return <>
    <div className="val-hallazgo"><strong>{num(alt.n_atendido - ref.n_atendido)} viajes de diferencia</strong>
      <p>Con un límite de {datos.limite} movimientos por noche, la regla marginal recorre {num(alt.km_rebalanceo, 1)} km
        equivalentes frente a {num(ref.km_rebalanceo, 1)} km de la regla por déficit.</p></div>
    <p>La prioridad marginal estima, con los saldos diarios del ajuste, la probabilidad de que una unidad más evite
      un déficit en cada estación. Las dos reglas toman el donante con excedente más próximo y operan a las 04:00, con la misma flota.</p>
    <Grafica descripcion="Servicio frente a kilómetros de rebalanceo" alto={285}
      trazas={Object.entries(POLITICA).map(([clave, nombre]) => {
        const t = filas.filter((r) => r.politica === clave);
        return { type: "scatter", mode: "lines+markers+text", name: nombre,
          x: t.map((r) => r.km_rebalanceo), y: t.map((r) => r.pct_atendidos_cubiertos),
          text: t.map((r) => String(r.limite)), textposition: clave === "deficit" ? "bottom right" : "top left" };
      })}
      capa={{ xaxis: { title: { text: "Kilómetros equivalentes del periodo" } },
        yaxis: { title: { text: "Viajes cubiertos atendidos (%)" } } }} />
    <div className="tabla-scroll"><table>
      <thead><tr><th>Política</th><th>Límite</th><th>Movimientos</th><th>km equivalentes</th><th>Déficit por noche</th><th>Sin patinete</th><th>Sin anclaje</th><th>Atendidos</th></tr></thead>
      <tbody>{filas.map((r) => <tr key={r.politica + r.limite}><th scope="row">{POLITICA[r.politica]}</th>
        <td>{r.limite}</td><td>{num(r.patinetes_movidos)}</td><td>{num(r.km_rebalanceo, 1)}</td><td>{num(r.deficit_medio, 1)}</td>
        <td>{num(r.n_sin_patinete)}</td><td>{num(r.n_sin_anclaje)}</td><td>{num(r.n_atendido)} · {pc(r.pct_atendidos_cubiertos, 2)} de los cubiertos</td></tr>)}</tbody>
    </table></div>
    <p className="loc-nota">El CSV nocturno incluye los rechazos del siguiente día de servicio. La distancia equivale a la suma
      de los traslados individuales con el factor de rodeo de T15. Los movimientos se ejecutan en el corte del simulador.</p>
  </>;
}

function Baterias({ filas }: { filas: Carga[] }) {
  const nombres: Record<string, string> = { inventario: "Inventario T32", carga: "Carga y reserva 0 %", reserva20: "Carga y reserva 20 %" };
  return <>
    <p>Cada patinete comienza cargado. Consume 13,5 Wh por kilómetro registrado y recupera energía en el anclaje a
      potencia constante, con 7 h de vacío a lleno. Se despacha la unidad suficiente de menor carga en la estación accesible.
      La reserva del 20 % permite comprobar un margen operativo adicional sobre el caso de referencia.</p>
    <div className="tabla-scroll"><table>
      <thead><tr><th>Escenario</th><th>Atendidos</th><th>Sin batería</th><th>Tracción (kWh)</th><th>Recargados (kWh)</th><th>Pendientes (kWh)</th></tr></thead>
      <tbody>{filas.map((r) => <tr key={r.caso}><th scope="row">{nombres[r.caso]}</th><td>{num(r.n_atendido)}</td><td>{r.n_sin_bateria}</td>
        <td>{metros(r.traccion_kwh)}</td><td>{metros(r.recargada_kwh)}</td><td>{r.pendiente_kwh == null ? "—" : num(r.pendiente_kwh, 3)}</td></tr>)}</tbody>
    </table></div>
    <p className="loc-nota">Balance en batería. Cada anclaje ocupado permite cargar en el modelo. La potencia disponible y la
      gestión de carga pertenecen al diseño de recarga.</p>
  </>;
}

function CapaMapa({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const r = datos.redes.find((r) => r.periodo === periodo && r.red === "habitual")!;
  return <>
    <div className="val-hallazgo"><strong>{num(r.cubiertas)} cubiertos · {num(r.n_atendido)} atendidos</strong>
      <p>De {num(r.solicitudes)} viajes de la red elegida en el periodo, con {datos.flota} patinetes y {datos.anclajes} anclajes.</p></div>
    <p>El mapa agrupa por H3 de origen y alterna entre acceso OD geométrico y servicio simulado. El grosor de cada arco
      refleja los viajes atendidos entre estaciones distintas. Selecciona una estación para aislar sus principales conexiones.
      Las tablas incluyen los viajes circulares y los flujos fuera del subconjunto visible.</p>
    <a href={"#/mapa/validacion/" + periodo + "/ambos/" + datos.network_id + "/operacion"}>Abrir cobertura y flujos en el mapa 3D ↗</a>
  </>;
}

function Equidad({ filas }: { filas: Zona[] }) {
  const base = filas.filter((r) => r.red === "habitual").sort((a, b) => a.pct - b.pct);
  const alternativas = base.map((r) => filas.find((s) => s.red === "equidad" && r.zona === s.zona));
  const baseComun = base.filter((_, i) => alternativas[i] != null);
  const ganancia = baseComun.length ? alternativas.reduce((s, r, i) => s + (r ? r.pct - base[i].pct : 0), 0) / baseComun.length : null;
  return <>
    <div className="val-hallazgo"><strong>{pp(ganancia)} de cobertura media</strong>
      <p>Cambio medio entre las zonas prioritarias, dando el mismo peso a cada una.</p></div>
    <p>Se fijó en el ajuste el cuartil inferior de zonas con al menos 100 salidas. El criterio exige cobertura
      de ambos extremos y protege la cobertura global de la red habitual. Se ensayan hasta cinco sustituciones
      de emplazamiento con el mismo radio y presupuesto.</p>
    <Grafica descripcion="Cobertura OD en cada zona prioritaria" alto={300} trazas={[
      { type: "bar", name: "Habitual", x: base.map((r) => r.zona), y: base.map((r) => r.pct), marker: { color: "#3e6e98" } },
      { type: "bar", name: "Acceso territorial", x: base.map((r) => r.zona), y: alternativas.map((r) => r?.pct ?? null), marker: { color: "#277d68" } },
    ]} capa={{ barmode: "group", yaxis: { title: { text: "Viajes cubiertos (%)" }, range: [0, 100] } }} />
    <div className="tabla-scroll"><table>
      <thead><tr><th>Zona de origen</th><th>Viajes</th><th>Habitual</th><th>Alternativa</th><th>Cambio</th></tr></thead>
      <tbody>{base.map((r, i) => <tr key={r.zona}><th scope="row">{r.zona} · {r.nombre}</th><td>{num(r.viajes)}</td>
        <td>{pc(r.pct)}</td><td>{alternativas[i] ? pc(alternativas[i]!.pct) : "—"}</td>
        <td>{pp(alternativas[i] ? alternativas[i]!.pct - r.pct : null)}</td></tr>)}</tbody>
    </table></div>
  </>;
}

function Cierres({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.cierres.filter((r) => r.periodo === periodo);
  const p = filas[0];
  return <>
    <p>Se ordenaron las estaciones por solicitudes cubiertas que dependían de ellas como única opción en algún extremo,
      durante la punta más demandada del ajuste. Se fijaron cinco cierres. En el periodo mostrado se simulan de
      { " " + p.inicio.slice(11, 16)} a {p.fin.slice(11, 16)} el {fecha(p.inicio.slice(0, 10))}. Se mantienen devoluciones ya reservadas.</p>
    <p>La red redundante prioriza dos opciones por extremo, conserva los cinco emplazamientos críticos y mantiene al
      menos el 80 % de cobertura del ajuste. Cada equipo de comparación mantiene flota y anclajes totales.</p>
    <Grafica descripcion="Pérdida neta por cierre en la punta" alto={300}
      trazas={["habitual", "redundante"].map((n, i) => {
        const t = filas.filter((r) => r.red === n);
        return { type: "bar", name: REDES[n], x: t.map((r) => r.station_id), y: t.map((r) => r.perdidos - r.recuperados),
          marker: { color: i ? "#277d68" : "#3e6e98" } };
      })} capa={{ barmode: "group", xaxis: { tickangle: -20 }, yaxis: { title: { text: "Viajes perdidos netos" } } }} />
    <div className="tabla-scroll"><table>
      <thead><tr><th>Estación</th><th>Red</th><th>Perdidos / recuperados</th><th>Recogidas / devoluciones desviadas</th><th>m extra</th><th>Saturación vecina</th><th>Pérdida neta del periodo</th></tr></thead>
      <tbody>{filas.map((r) => <tr key={r.red + r.station_id}><th scope="row">{r.station_id}</th><td>{REDES[r.red]}</td>
        <td>{r.perdidos} / {r.recuperados}</td><td>{r.recogidas_desviadas} / {r.devoluciones_desviadas}</td>
        <td>{num(r.metros_adicionales, 1)}</td>
        <td>{r.llena_normal_pct != null && r.llena_cierre_pct != null ? pc(r.llena_normal_pct) + " → " + pc(r.llena_cierre_pct) : "—"}</td>
        <td>{r.perdida_periodo}</td></tr>)}</tbody>
    </table></div>
    <p className="loc-nota">Los desvíos y metros adicionales comparan viajes atendidos en ambos escenarios. La saturación
      mide el tiempo con plazas ocupadas o reservadas en el destino que más devoluciones desviadas recibe.</p>
  </>;
}

function Redes({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.redes.filter((r) => r.periodo === periodo);
  return <>
    <p>Se usan {datos.flota} patinetes, {datos.anclajes} anclajes y hasta {datos.limite} movimientos nocturnos
      en cada red. Para las alternativas, la distribución de plazas y stock se dimensiona con la demanda de ajuste.
      La potencia se obtiene por solape de sesiones de reposición de energía en intervalos de 15 minutos.</p>
    <Grafica descripcion="Viajes atendidos frente al pico de potencia de las redes" alto={315}
      trazas={filas.map((r) => ({ type: "scatter", mode: "markers", name: REDES[r.red],
        x: [r.pico_red_kw], y: [r.pct_atendidos_total], marker: { size: 11, symbol: r.red === "habitual" ? "star" : "circle" } }))}
      capa={{ xaxis: { title: { text: "Pico simultáneo en batería (kW)" } },
        yaxis: { title: { text: "Solicitudes atendidas (%)" } } }} />
    <div className="tabla-scroll"><table>
      <thead><tr><th>Red</th><th>Estaciones y radio</th><th>Viajes cubiertos</th><th>Viajes atendidos</th><th>Dos opciones por extremo</th>
        <th>kWh/día</th><th>Pico de red (kW)</th><th>Pico por estación (kW)</th><th>Energía en las 10 primeras</th></tr></thead>
      <tbody>{filas.map((r) => <tr key={r.red}><th scope="row">{REDES[r.red]}</th><td>{r.estaciones} · {r.radio_m} m</td>
        <td>{num(r.cubiertas)} · {pc(100 * r.cubiertas / r.solicitudes, 2)}</td><td>{num(r.n_atendido)} · {pc(r.pct_atendidos_total, 2)}</td>
        <td>{num(r.redundantes)}</td><td>{num(r.kwh_dia, 2)}</td><td>{num(r.pico_red_kw, 2)}</td>
        <td>{num(r.pico_estacion_kw, 2)}</td><td>{pc(r.cuota_top10_pct)}</td></tr>)}</tbody>
    </table></div>
    <p className="loc-nota">La demanda estimada repone la energía de los viajes atendidos en su estación de devolución.
      Las cifras están en el lado batería y sirven de entrada al dimensionado eléctrico.</p>
  </>;
}
