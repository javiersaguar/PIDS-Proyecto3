import { useState } from "react";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { fecha, num, pc } from "../../formato";
import { COLOR } from "../../graficas";
import { pp } from "../../localizacion/PanelValidacion";
import { PERIODOS, type Periodo } from "../../localizacion/validacion";
import { useRuta } from "../../ruta";

type Servicio = {
  periodo: Periodo; solicitudes: number; cubiertas: number; n_atendido: number;
  n_sin_patinete: number; n_sin_anclaje: number; pct_atendidos_total: number; pct_atendidos_cubiertos: number;
  patinetes_movidos: number; km_rebalanceo: number;
};
type Reb = Servicio & { politica: string; limite: number; deficit_medio: number };
type Carga = Servicio & { caso: string; reserva_pct: number | null; factor_consumo: number; recarga_en_anclaje: boolean;
  n_sin_bateria: number | null; dias_hasta_primer_rechazo: number | null; traccion_kwh: number | null;
  recargada_kwh: number | null; pendiente_kwh: number | null; soc_final_pct: number | null };
type Red = Servicio & { red: string; estaciones: number; radio_m: number; redundantes: number;
  kwh_dia: number; pico_red_kw: number; pico_estacion_kw: number; cuota_top10_pct: number };
type Zona = { periodo: Periodo; red: string; zona: string; nombre: string; viajes: number; cubiertos: number; pct: number; prioritaria: boolean };
type Cierre = {
  periodo: Periodo; red: string; station_id: string; inicio: string; fin: string; exposicion_ajuste: number;
  solicitudes: number; atendidos_normal: number; atendidos_cierre: number; perdidos: number; recuperados: number;
  sin_estacion: number; desviados: number; metros_adicionales: number; perdida_periodo: number;
  recogidas_desviadas: number; devoluciones_desviadas: number; destino_mas_desviado: string;
  llena_normal_pct: number | null; llena_cierre_pct: number | null;
};
type Cambio = { red: string; paso: number; sale: string; entra: string; viajes_cubiertos: number };
type Datos = {
  flota: number; anclajes: number; limite: number;
  network_id: string;
  rebalanceo: Reb[]; bateria: Carga[]; redes: Red[]; zonas: Zona[]; cierres: Cierre[]; cambios: Cambio[];
};

const REDES: Record<string, string> = {
  habitual: "Red elegida", menos_estaciones: "Menos estaciones", radio_menor: "Menor radio",
  equidad: "Acceso territorial", redundante: "Redundante ante cierres",
};
const POLITICA: Record<string, string> = { deficit: "Mayor déficit", beneficio: "Beneficio marginal" };
const JAVIER = "Javier Saguar";

export const TAREAS_CIERRE = [
  { id: "t33", tarea: "T33", titulo: "Rebalanceo nocturno", responsable: JAVIER,
    objetivo: "Medir cuánto servicio recupera cada regla de traslado nocturno y a qué coste en kilómetros.",
    valor: "Fija la política de operación con la que se simula el resto del proyecto y el coste logístico que implica.",
    ficheros: ["T33_politicas", "T33_noches"] },
  { id: "t35", tarea: "T35", titulo: "Estado de carga", responsable: JAVIER,
    objetivo: "Comprobar si la batería de cada patinete limita el servicio y cuánto margen queda.",
    valor: "Decide si basta con cargar en los anclajes o hace falta otra forma de reponer energía, y conecta movilidad con consumo.",
    ficheros: ["T35_carga"] },
  { id: "t36", tarea: "T36", titulo: "Cobertura y flujos en Roma", responsable: "Alejandro Cuevas y Javier Saguar",
    objetivo: "Llevar al mapa 3D la cobertura, el servicio simulado y los flujos atendidos de la red elegida.",
    valor: "Es la vista de la demo: enseña dónde llega la red, dónde se pierden viajes y qué estaciones mueven más patinetes.",
    ficheros: ["T36_cobertura_operativa", "T36_flujos_operativos"] },
  { id: "t37", tarea: "T37", titulo: "Acceso de las zonas peor cubiertas", responsable: JAVIER,
    objetivo: "Mejorar la cobertura de las zonas peor servidas sin cambiar el número de estaciones.",
    valor: "Cuantifica el coste de priorizar el acceso territorial frente al servicio global, para decidirlo con datos.",
    ficheros: ["T37_zonas", "T37_equidad", "T37_T38_intercambios"] },
  { id: "t38", tarea: "T38", titulo: "Cierres de estaciones críticas", responsable: JAVIER,
    objetivo: "Medir cuántos viajes se pierden al cerrar cinco estaciones críticas y si una red redundante lo evita.",
    valor: "Mide la robustez de la red ante averías u obras, que el diseño por cobertura no tiene en cuenta.",
    ficheros: ["T38_cierres", "T38_redundante", "T37_T38_intercambios"] },
  { id: "t39", tarea: "T39", titulo: "Comparación final de redes", responsable: JAVIER,
    objetivo: "Comparar las redes finalistas y las variantes con la misma flota, anclajes y rebalanceo.",
    valor: "Cierra la fase: confirma qué red pasa a consumo y recarga y entrega la demanda de energía por estación.",
    ficheros: ["T39_redes", "T39_estaciones"] },
];
const CSV = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/resultados/tablas/movilidad/";
const kwh = (x: number | null, d = 1) => (x == null ? "—" : num(x, d));

export function CierreMovilidad() {
  const [, seccion] = useRuta();
  const actual = TAREAS_CIERRE.find((t) => t.id === seccion) ?? TAREAS_CIERRE[0];
  const { datos, error } = useDatos<Datos>("fase1/cierre_movilidad");
  const [periodo, setPeriodo] = useState<Periodo>("ajuste");
  return <Seccion id={actual.id} tarea={actual.tarea} titulo={actual.titulo} responsable={actual.responsable}
    objetivo={actual.objetivo} valor={actual.valor} notebook="movilidad/T33_T39_cierre.ipynb">
    <nav className="val-pasos" aria-label="Cierre de movilidad">
      {TAREAS_CIERRE.map((t) => <a key={t.id} href={"#/fase1/" + t.id} aria-current={t.id === actual.id ? "page" : undefined}>
        <span>{t.tarea}</span>{t.titulo}</a>)}
    </nav>
    {datos ? <>
      <div className="loc-controles"><label>Periodo de movilidad
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
          {Object.entries(PERIODOS).map(([p, label]) => <option key={p} value={p}>{label}</option>)}
        </select>
      </label></div>
      {actual.id === "t33" && <Rebalanceo datos={datos} periodo={periodo} />}
      {actual.id === "t35" && <Baterias filas={datos.bateria.filter((r) => r.periodo === periodo)} periodo={periodo} />}
      {actual.id === "t36" && <CapaMapa datos={datos} periodo={periodo} />}
      {actual.id === "t37" && <Equidad datos={datos} periodo={periodo} />}
      {actual.id === "t38" && <Cierres datos={datos} periodo={periodo} />}
      {actual.id === "t39" && <Redes datos={datos} periodo={periodo} />}
      <div className="loc-acciones val-fuentes">
        {actual.ficheros.map((f) => <a key={f} href={CSV + f + ".csv"}>{f.replaceAll("_", " ")} · CSV</a>)}
      </div>
    </> : <Cargando error={error} />}
  </Seccion>;
}

function Rebalanceo({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.rebalanceo.filter((r) => r.periodo === periodo);
  const de = (politica: string, limite: number) => filas.find((r) => r.politica === politica && r.limite === limite)!;
  const ref = de("deficit", datos.limite);
  const alt = de("beneficio", datos.limite);
  const sin = de("deficit", 0);
  const max = Math.max(...filas.map((r) => r.limite));
  const tope = de("deficit", max);
  const ganaAlt = alt.n_atendido >= ref.n_atendido && alt.km_rebalanceo < ref.km_rebalanceo;
  return <>
    <Cifras cifras={[
      { valor: pc(ref.pct_atendidos_cubiertos), nombre: "viajes cubiertos atendidos", detalle: `${datos.limite} movimientos por noche, regla por déficit` },
      { valor: pp(ref.pct_atendidos_cubiertos - sin.pct_atendidos_cubiertos), nombre: "frente a no rebalancear", detalle: `sin traslados se queda en ${pc(sin.pct_atendidos_cubiertos)}` },
      { valor: num(ref.km_rebalanceo, 0) + " km", nombre: "de traslados en el periodo", detalle: `${num(ref.patinetes_movidos)} patinetes movidos` },
      { valor: num(alt.n_atendido - ref.n_atendido), nombre: "viajes de diferencia con la regla marginal", detalle: `que recorre ${num(alt.km_rebalanceo - ref.km_rebalanceo, 1)} km de diferencia` },
    ]} />
    <Bloque titulo="1. Servicio frente a kilómetros de rebalanceo"
      queMuestra={`Para cada regla y límite de traslados por noche (0, ${datos.limite} y ${max}), el porcentaje de viajes cubiertos atendidos y los kilómetros equivalentes que recorre el vehículo en el periodo.`}
      porQue="El rebalanceo es el principal coste de operación. Interesa la regla que llega al 95 % de servicio con menos kilómetros."
      comoLeer="Cada línea es una regla y cada punto, un límite de traslados (la etiqueta). Arriba a la izquierda es mejor: más servicio con menos distancia."
      conclusiones={[
        <>Sin rebalanceo se atiende el {pc(sin.pct_atendidos_cubiertos)} de los viajes cubiertos; con {datos.limite} traslados por noche, el <strong>{pc(ref.pct_atendidos_cubiertos)}</strong>. El rebalanceo es imprescindible.</>,
        <>Subir a {max} traslados solo añade {num(tope.n_atendido - ref.n_atendido)} viajes a cambio de {num(tope.km_rebalanceo - ref.km_rebalanceo, 0)} km más: el límite que manda ya no es el rebalanceo sino los anclajes.</>,
        ganaAlt
          ? <>En este periodo la regla marginal es mejor en las dos cosas: {num(alt.n_atendido - ref.n_atendido)} viajes más y {num(ref.km_rebalanceo - alt.km_rebalanceo, 1)} km menos. Se mantiene la regla por déficit porque se eligió en el ajuste, pero <strong>las dos empatan</strong> y la marginal merece una prueba operativa.</>
          : <>Se mantiene la <strong>regla por déficit con {datos.limite} traslados</strong>: es la opción con menos kilómetros que supera el 95 % en el ajuste. La ventaja sobre la regla marginal es mínima ({num(alt.km_rebalanceo - ref.km_rebalanceo, 1)} km y {num(alt.n_atendido - ref.n_atendido)} viajes): en la práctica, un empate.</>,
      ]}
      fuente="tablas/movilidad/T33_politicas.csv y T33_noches.csv">
      <Grafica descripcion="Servicio frente a kilómetros de rebalanceo para las dos reglas" alto={320}
        trazas={Object.entries(POLITICA).map(([clave, nombre], i) => {
          const t = filas.filter((r) => r.politica === clave);
          return { type: "scatter", mode: "lines+markers+text", name: nombre,
            x: t.map((r) => r.km_rebalanceo), y: t.map((r) => r.pct_atendidos_cubiertos),
            text: t.map((r) => String(r.limite)), textposition: i ? "top left" : "bottom right",
            line: { color: i ? COLOR.serie2 : COLOR.serie1, width: 2 }, marker: { size: 9 },
            hovertemplate: "%{text} por noche: %{x:.0f} km, %{y:.2f} %<extra>" + nombre + "</extra>" };
        })}
        capa={{ xaxis: { title: { text: "Kilómetros equivalentes del periodo" } },
          yaxis: { title: { text: "Viajes cubiertos atendidos (%)" }, ticksuffix: " %" },
          shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 95, y1: 95, line: { color: COLOR.tenue, width: 1, dash: "dot" } }] }} />
    </Bloque>
    <TablaDesplegable titulo="Ver todas las combinaciones"
      cabeceras={["Política", "Límite", "Movimientos", "km equivalentes", "Déficit por noche", "Sin patinete", "Sin anclaje", "Atendidos"]}
      numericas={[1, 2, 3, 4, 5, 6, 7]}
      filas={filas.map((r) => [POLITICA[r.politica], r.limite, num(r.patinetes_movidos), num(r.km_rebalanceo, 1), num(r.deficit_medio, 1),
        num(r.n_sin_patinete), num(r.n_sin_anclaje), `${num(r.n_atendido)} · ${pc(r.pct_atendidos_cubiertos, 2)}`])} />
    <p className="loc-nota">La distancia suma los traslados individuales con el factor de rodeo de T15; la ruta real del vehículo
      agruparía traslados. Los movimientos se hacen a las 04:00 y el CSV nocturno incluye los rechazos del día siguiente.</p>
  </>;
}

const CASOS: Record<string, string> = {
  carga: "Carga en anclaje, sin reserva", reserva20: "Carga en anclaje, reserva 20 %",
  consumo_doble: "Doble de consumo, reserva 20 %", sin_recarga: "Sin recarga en anclaje, reserva 20 %",
};

function Baterias({ filas, periodo }: { filas: Carga[]; periodo: Periodo }) {
  const caso = (c: string) => filas.find((r) => r.caso === c)!;
  const base = caso("reserva20"), doble = caso("consumo_doble"), sin = caso("sin_recarga");
  const casos = filas.filter((r) => r.caso in CASOS);
  return <>
    <Cifras cifras={[
      { valor: num(base.n_sin_bateria ?? 0), nombre: "rechazos por batería", detalle: "carga en cada anclaje y reserva del 20 %" },
      { valor: num(doble.n_sin_bateria ?? 0), nombre: "con el doble de consumo", detalle: "27 Wh/km, la misma reserva" },
      { valor: pc(sin.pct_atendidos_cubiertos), nombre: "de servicio sin recarga en anclaje", detalle: `frente al ${pc(base.pct_atendidos_cubiertos)} con carga` },
      { valor: sin.dias_hasta_primer_rechazo == null ? "—" : num(sin.dias_hasta_primer_rechazo, 1) + " días", nombre: "hasta el primer rechazo sin recarga", detalle: "la flota sale cargada al empezar" },
    ]} />
    <Bloque titulo="1. Cuándo limita la batería"
      queMuestra="Viajes cubiertos atendidos y rechazados por batería en cuatro casos. Cada patinete sale cargado (576 Wh), gasta 13,5 Wh por kilómetro registrado (T40) y, si el caso lo permite, recarga en el anclaje con 7 h de vacío a lleno. Se despacha la unidad suficiente con menos carga."
      porQue="Si la batería limitara, la flota o los anclajes no bastarían aunque hubiera patinetes. Las pruebas de estrés dicen cuánto margen hay y si la carga en la estación es necesaria."
      comoLeer="Cada barra es un caso; la parte naranja son los viajes perdidos por falta de batería. Los dos primeros casos dan lo mismo porque un viaje gasta de media el 5 % de la batería."
      conclusiones={[
        <>Con carga en los anclajes <strong>la batería no limita</strong>: {num(base.n_sin_bateria ?? 0)} rechazos con una reserva del 20 % y {num(doble.n_sin_bateria ?? 0)} con el doble de consumo. Al final quedan {kwh(base.pendiente_kwh, 3)} kWh por reponer.</>,
        <>Sin recarga en los anclajes, los rechazos empiezan a los {num(sin.dias_hasta_primer_rechazo ?? 0, 1)} días y el servicio cae al {pc(sin.pct_atendidos_cubiertos)} ({num(sin.n_sin_bateria ?? 0)} viajes sin batería). <strong>La carga en la propia estación es imprescindible</strong>; si no, habría que cambiar baterías cada uno o dos días.</>,
        periodo === "reservada"
          ? "La semana reservada solo dura 7 días y la flota sale cargada, por eso sin recarga la caída es menor que en las tres semanas del ajuste."
          : "La potencia que hace falta para esa carga y su relación con la producción solar se calculan en la fase de recarga.",
      ]}
      fuente="tablas/movilidad/T35_carga.csv y tablas/consumo/T40_energia_viaje.csv">
      <Grafica descripcion="Viajes cubiertos atendidos y rechazados por batería en cada caso" alto={300}
        trazas={[
          { type: "bar", name: "Atendidos", y: casos.map((r) => CASOS[r.caso]), x: casos.map((r) => r.n_atendido), orientation: "h", marker: { color: COLOR.serie1 } },
          { type: "bar", name: "Sin batería", y: casos.map((r) => CASOS[r.caso]), x: casos.map((r) => r.n_sin_bateria ?? 0), orientation: "h", marker: { color: COLOR.serie2 } },
        ]}
        capa={{ barmode: "stack", margin: { l: 230 }, xaxis: { title: { text: "Viajes cubiertos" } }, yaxis: { autorange: "reversed" },
          legend: { orientation: "h", y: 1.12 } }} />
    </Bloque>
    <TablaDesplegable titulo="Ver el balance de energía"
      cabeceras={["Caso", "Atendidos", "Sin batería", "Tracción (kWh)", "Recargada (kWh)", "Pendiente (kWh)", "Carga final media"]}
      numericas={[1, 2, 3, 4, 5, 6]}
      filas={casos.map((r) => [CASOS[r.caso], num(r.n_atendido), num(r.n_sin_bateria ?? 0), kwh(r.traccion_kwh), kwh(r.recargada_kwh),
        kwh(r.pendiente_kwh, 3), r.soc_final_pct == null ? "—" : pc(r.soc_final_pct)])} />
    <p className="loc-nota">Balance en el lado batería: la tracción es igual a la energía recargada más la pendiente al final.
      Cada anclaje ocupado puede cargar; la potencia disponible y la gestión de carga pertenecen al diseño de recarga.</p>
  </>;
}

function CapaMapa({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const r = datos.redes.find((r) => r.periodo === periodo && r.red === "habitual")!;
  return <>
    <Cifras cifras={[
      { valor: num(r.solicitudes), nombre: "solicitudes", detalle: PERIODOS[periodo].toLowerCase() },
      { valor: pc(100 * r.cubiertas / r.solicitudes), nombre: "con estación en los dos extremos", detalle: `${num(r.cubiertas)} viajes cubiertos` },
      { valor: pc(r.pct_atendidos_total), nombre: "atendidos en la simulación", detalle: `${datos.flota} patinetes y ${datos.anclajes} anclajes` },
    ]} />
    <Bloque titulo="1. Cobertura, servicio y flujos en el mapa 3D"
      queMuestra="El mapa agrupa las salidas por celda H3 de origen y alterna entre la cobertura geométrica (hay estación a 300 m en los dos extremos) y el servicio simulado (además hubo patinete y anclaje). Los arcos son los viajes atendidos entre estaciones distintas."
      porQue="Separa los viajes que la red no alcanza de los que alcanza pero pierde por inventario, que se arreglan de forma distinta: más estaciones o más patinetes y anclajes."
      comoLeer="Abre el mapa, elige la capa y selecciona una estación para aislar sus conexiones principales. El grosor del arco es el número de viajes."
      conclusiones={[
        <>De {num(r.solicitudes)} solicitudes, {num(r.cubiertas)} tienen estación en los dos extremos y <strong>{num(r.n_atendido)} se atienden</strong>.</>,
        <>Los viajes sin estación a 300 m ({num(r.solicitudes - r.cubiertas)}) son muchos más que los cubiertos que se pierden por falta de patinete o anclaje ({num(r.cubiertas - r.n_atendido)}): <strong>la pérdida principal es de alcance</strong>, no de inventario.</>,
        "Las tablas incluyen los viajes circulares y todos los flujos, también los que el mapa no dibuja para no saturarlo.",
      ]}
      fuente="tablas/movilidad/T36_cobertura_operativa.csv y T36_flujos_operativos.csv">
      <p><a href={"#/mapa/validacion/" + periodo + "/ambos/" + datos.network_id + "/operacion"}>Abrir cobertura y flujos en el mapa 3D ↗</a></p>
    </Bloque>
  </>;
}

function Equidad({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.zonas.filter((r) => r.periodo === periodo && r.prioritaria);
  const base = filas.filter((r) => r.red === "habitual").sort((a, b) => a.pct - b.pct);
  const alt = base.map((r) => filas.find((s) => s.red === "equidad" && r.zona === s.zona));
  const comunes = base.filter((_, i) => alt[i] != null);
  const ganancia = comunes.length ? alt.reduce((s, r, i) => s + (r ? r.pct - base[i].pct : 0), 0) / comunes.length : null;
  const red = (n: string) => datos.redes.find((r) => r.periodo === periodo && r.red === n)!;
  const h = red("habitual"), e = red("equidad");
  const cambios = datos.cambios.filter((c) => c.red === "equidad").length;
  const mejora = base.filter((r, i) => alt[i] && alt[i]!.pct > r.pct + 0.05).length;
  const empeora = base.filter((r, i) => alt[i] && alt[i]!.pct < r.pct - 0.05).length;
  return <>
    <Cifras cifras={[
      { valor: pp(ganancia, 2), nombre: "de cobertura media en las zonas prioritarias", detalle: `${base.length} zonas, mismo peso cada una` },
      { valor: String(cambios), nombre: "estaciones cambiadas de sitio", detalle: "mismo número de estaciones y radio" },
      { valor: num(e.n_atendido - h.n_atendido), nombre: "viajes atendidos en toda Roma", detalle: "frente a la red elegida" },
    ]} />
    <Bloque titulo="1. Cobertura de las zonas peor servidas"
      queMuestra="Porcentaje de salidas con estación en los dos extremos en cada zona prioritaria, con la red elegida y con la variante de acceso territorial. Las zonas prioritarias son el cuartil peor cubierto en el ajuste entre las zonas urbanísticas con al menos 100 salidas."
      porQue="La red se eligió por viajes cubiertos, lo que favorece el centro. Esta variante mide cuánto cuesta dar más acceso a las zonas peor servidas con el mismo presupuesto."
      comoLeer="Cada par de barras es una zona, ordenadas de peor a mejor cobertura con la red elegida. Las zonas y los cambios se fijan con el ajuste; la semana reservada es la comprobación."
      conclusiones={[
        <>Con {cambios} cambios de emplazamiento, la cobertura media de las zonas prioritarias sube <strong>{num(ganancia ?? 0, 2)} puntos</strong>; mejoran {mejora} de las {base.length} zonas y {empeora ? `empeoran ${empeora}` : "ninguna empeora"}.</>,
        <>En toda Roma la variante atiende {num(e.n_atendido)} viajes frente a {num(h.n_atendido)} de la elegida: <strong>el coste en servicio global es prácticamente nulo</strong>.</>,
        "Queda como alternativa si el equipo decide priorizar el acceso territorial; la red elegida se mantiene porque sobre ella se dimensionaron flota y anclajes.",
      ]}
      fuente="tablas/movilidad/T37_zonas.csv, T37_equidad.csv y T37_T38_intercambios.csv">
      <Grafica descripcion="Cobertura OD en cada zona prioritaria con las dos redes" alto={320} trazas={[
        { type: "bar", name: "Red elegida", x: base.map((r) => r.zona + " " + r.nombre), y: base.map((r) => r.pct), marker: { color: COLOR.serie1 } },
        { type: "bar", name: "Acceso territorial", x: base.map((r) => r.zona + " " + r.nombre), y: alt.map((r) => r?.pct ?? null), marker: { color: COLOR.serie3 } },
      ]} capa={{ barmode: "group", xaxis: { tickangle: -30 }, yaxis: { title: { text: "Viajes cubiertos (%)" }, range: [0, 100], ticksuffix: " %" },
        legend: { orientation: "h", y: 1.12 } }} />
    </Bloque>
    <TablaDesplegable titulo="Ver las zonas" cabeceras={["Zona de origen", "Salidas", "Red elegida", "Acceso territorial", "Cambio"]} numericas={[1, 2, 3, 4]}
      filas={base.map((r, i) => [`${r.zona} · ${r.nombre}`, num(r.viajes), pc(r.pct), alt[i] ? pc(alt[i]!.pct) : "—", pp(alt[i] ? alt[i]!.pct - r.pct : null)])} />
  </>;
}

function Cierres({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.cierres.filter((r) => r.periodo === periodo);
  const p = filas[0];
  const neta = (n: string) => filas.filter((r) => r.red === n).reduce((s, r) => s + r.perdidos - r.recuperados, 0);
  const suma = (n: string, k: "desviados" | "sin_estacion") => filas.filter((r) => r.red === n).reduce((s, r) => s + r[k], 0);
  const nh = neta("habitual"), nr = neta("redundante");
  const cambios = datos.cambios.filter((c) => c.red === "redundante").length;
  const saturada = filas.filter((r) => r.llena_cierre_pct != null && r.llena_normal_pct != null && r.llena_cierre_pct - r.llena_normal_pct > 10)
    .sort((a, b) => b.llena_cierre_pct! - a.llena_cierre_pct!)[0];
  return <>
    <Cifras cifras={[
      { valor: num(nh), nombre: "viajes perdidos con la red elegida", detalle: "suma de los cinco cierres en la punta" },
      { valor: num(nr), nombre: "con la red redundante", detalle: `${pc(100 * (nh - nr) / Math.max(nh, 1), 0)} menos` },
      { valor: String(cambios), nombre: "estaciones cambiadas de sitio", detalle: "las cinco críticas se conservan" },
    ]} />
    <Bloque titulo="1. Viajes perdidos al cerrar cada estación crítica"
      queMuestra={<>Se cierra por separado cada una de las cinco estaciones con más viajes que dependen solo de ella en la punta de tarde (16–20 h) del día más cargado del ajuste. En este periodo la ventana es de {p.inicio.slice(11, 16)} a {p.fin.slice(11, 16)} el {fecha(p.inicio.slice(0, 10))}. Las devoluciones ya reservadas se mantienen y los viajes pueden desviarse a otra estación dentro del radio.</>}
      porQue="Una red diseñada para cubrir con las mínimas estaciones deja muchos viajes con una sola opción. Si esa estación se avería o se cierra por obras, esos viajes se pierden."
      comoLeer="Cada par de barras es un cierre: viajes perdidos netos (perdidos menos recuperados) en la ventana, con la red elegida y con la redundante. La redundante se eligió con el ajuste; la semana reservada es la comprobación."
      conclusiones={[
        <>La red redundante pierde <strong>{num(nr)} viajes frente a {num(nh)}</strong>: más viajes encuentran otra estación dentro del radio ({num(suma("redundante", "desviados"))} desviados frente a {num(suma("habitual", "desviados"))}).</>,
        <>Se obtiene con {cambios} cambios de emplazamiento que maximizan los viajes que siguen cubiertos al cerrar cada estación crítica, sin bajar del 80 % de cobertura. Una primera variante que buscaba dos opciones en cada extremo de todos los viajes solo admitía dos cambios y no reducía las pérdidas: <strong>la redundancia útil es la local</strong>.</>,
        saturada
          ? <>El desvío tiene un coste: con el cierre de {saturada.station_id}, la estación que recibe más devoluciones desviadas pasa de estar llena el {pc(saturada.llena_normal_pct!)} al {pc(saturada.llena_cierre_pct!)} del tiempo.</>
          : "En este periodo los desvíos no llenan las estaciones vecinas.",
      ]}
      fuente="tablas/movilidad/T38_cierres.csv, T38_redundante.csv y T37_T38_intercambios.csv">
      <Grafica descripcion="Viajes perdidos netos por cierre con las dos redes" alto={320}
        trazas={["habitual", "redundante"].map((n, i) => {
          const t = filas.filter((r) => r.red === n);
          return { type: "bar", name: REDES[n], x: t.map((r) => r.station_id), y: t.map((r) => r.perdidos - r.recuperados),
            marker: { color: i ? COLOR.serie3 : COLOR.serie1 } };
        })} capa={{ barmode: "group", xaxis: { tickangle: -20, title: { text: "Estación cerrada" } }, yaxis: { title: { text: "Viajes perdidos netos" } },
          legend: { orientation: "h", y: 1.12 } }} />
    </Bloque>
    <TablaDesplegable titulo="Ver el detalle de cada cierre"
      cabeceras={["Estación", "Red", "Perdidos / recuperados", "Sin otra estación", "Recogidas / devoluciones desviadas", "m extra", "Saturación del destino", "Pérdida en el periodo"]}
      numericas={[3, 5, 7]}
      filas={filas.map((r) => [r.station_id, REDES[r.red], `${r.perdidos} / ${r.recuperados}`, num(r.sin_estacion), `${r.recogidas_desviadas} / ${r.devoluciones_desviadas}`,
        num(r.metros_adicionales, 0),
        r.llena_normal_pct != null && r.llena_cierre_pct != null ? pc(r.llena_normal_pct) + " → " + pc(r.llena_cierre_pct) : "—", num(r.perdida_periodo)])} />
    <p className="loc-nota">Los desvíos y metros adicionales comparan viajes atendidos con y sin cierre. La saturación es el tiempo
      con plazas ocupadas o reservadas en el destino que más devoluciones desviadas recibe.</p>
  </>;
}

function Redes({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const filas = datos.redes.filter((r) => r.periodo === periodo);
  const h = filas.find((r) => r.red === "habitual")!;
  const mejor = [...filas].sort((a, b) => b.n_atendido - a.n_atendido)[0];
  const parecidas = filas.filter((r) => r.estaciones === h.estaciones && r.radio_m === h.radio_m);
  const rango = Math.max(...parecidas.map((r) => r.pct_atendidos_total)) - Math.min(...parecidas.map((r) => r.pct_atendidos_total));
  const menor = filas.find((r) => r.red === "radio_menor");
  return <>
    <Cifras cifras={[
      { valor: num(h.kwh_dia, 1) + " kWh", nombre: "al día para recargar la flota", detalle: "red elegida, en el lado batería" },
      { valor: num(h.pico_red_kw, 2) + " kW", nombre: "pico simultáneo de la red", detalle: `${num(h.pico_estacion_kw, 2)} kW en la estación con más pico` },
      { valor: pc(h.cuota_top10_pct), nombre: "de la energía en 10 estaciones", detalle: `de ${h.estaciones}` },
      { valor: num(rango, 2) + " pp", nombre: "entre las redes de 159 estaciones", detalle: "diferencia de viajes atendidos" },
    ]} />
    <Bloque titulo="1. Servicio y demanda de recarga de cada red"
      queMuestra={`Las tres finalistas de T28 y las variantes territorial y redundante, simuladas con ${datos.flota} patinetes, ${datos.anclajes} anclajes y hasta ${datos.limite} traslados por noche. En las alternativas, plazas y stock se reparten con la demanda del ajuste.`}
      porQue="Con los mismos recursos, la mejor red es la que más viajes atiende; su energía por estación es la entrada de la fase de recarga."
      comoLeer="Cada punto es una red: más arriba atiende más solicitudes y más a la derecha exige más potencia simultánea. La estrella es la red elegida."
      conclusiones={[
        <>Las redes de 159 estaciones a 300 m <strong>empatan en servicio</strong>: se separan {num(rango, 2)} puntos. En este periodo la que más atiende es la {REDES[mejor.red].toLowerCase()} ({num(mejor.n_atendido)} frente a {num(h.n_atendido)} de la elegida).</>,
        menor ? <>Bajar el radio a {menor.radio_m} m con {menor.estaciones} estaciones reparte los mismos anclajes en más sitios y atiende {num(h.n_atendido - menor.n_atendido)} viajes menos: con presupuesto fijo, menos estaciones más grandes funcionan mejor.</> : "",
        <>La red elegida sigue como referencia para consumo y recarga porque se fijó antes de medir el servicio y sobre ella se dimensionaron flota y anclajes. Cambiarla por la redundante, que pierde la mitad de viajes en los cierres (T38), es una <strong>decisión de equipo</strong> que obligaría a repetir T31–T34.</>,
        <>La recarga de la red elegida pide {num(h.kwh_dia, 1)} kWh al día con un pico de {num(h.pico_red_kw, 2)} kW en toda la red: la demanda es pequeña y está repartida.</>,
      ].filter(Boolean)}
      fuente="tablas/movilidad/T39_redes.csv y T39_estaciones.csv">
      <Grafica descripcion="Viajes atendidos frente al pico de potencia de cada red" alto={320}
        trazas={filas.map((r) => ({ type: "scatter", mode: "markers", name: REDES[r.red],
          x: [r.pico_red_kw], y: [r.pct_atendidos_total], marker: { size: r.red === "habitual" ? 16 : 11, symbol: r.red === "habitual" ? "star" : "circle" },
          hovertemplate: `${REDES[r.red]}: %{y:.2f} % atendidas, %{x:.2f} kW<extra></extra>` }))}
        capa={{ xaxis: { title: { text: "Pico simultáneo en batería (kW)" } },
          yaxis: { title: { text: "Solicitudes atendidas (%)" }, ticksuffix: " %" } }} />
    </Bloque>
    <TablaDesplegable titulo="Ver la comparación completa"
      cabeceras={["Red", "Estaciones y radio", "Viajes cubiertos", "Viajes atendidos", "Dos opciones por extremo", "kWh/día", "Pico de red (kW)", "Pico por estación (kW)", "Energía en las 10 primeras"]}
      numericas={[2, 3, 4, 5, 6, 7, 8]}
      filas={filas.map((r) => [REDES[r.red], `${r.estaciones} · ${r.radio_m} m`, `${num(r.cubiertas)} · ${pc(100 * r.cubiertas / r.solicitudes, 2)}`,
        `${num(r.n_atendido)} · ${pc(r.pct_atendidos_total, 2)}`, num(r.redundantes), num(r.kwh_dia, 2), num(r.pico_red_kw, 2), num(r.pico_estacion_kw, 2), pc(r.cuota_top10_pct)])} />
    <p className="loc-nota">Cada viaje atendido repone su energía en la estación de destino a la potencia del cargador, solapando sesiones
      por cuartos de hora y sin límite de potencia. Las cifras están en el lado batería; el rendimiento del cargador se añade en recarga.</p>
  </>;
}
