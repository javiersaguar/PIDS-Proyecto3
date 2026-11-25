import { useState } from "react";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { useRuta } from "../../ruta";

type Periodo = "ajuste" | "reservada";
type Caso = "ideal" | "cargadores_100" | "cargadores_50" | "cargadores_25";
type Resumen = {
  periodo: Periodo; modelo: "a" | "b"; caso: Caso; llegadas: number; pedida_kwh: number; servida_kwh: number;
  pendiente_kwh: number; aplazada_kwh: number; kwh_dia: number; pico_red_kw: number; p95_red_kw: number;
  fuera_sol_pct: number; estaciones_con_cola: number; horas_con_cola: number; sesiones_en_espera: number;
  espera_media_min: number; espera_max_min: number; simultaneas_max: number;
  "pedida_kwh_eta_0.85": number; "pedida_kwh_eta_0.95": number;
};
type Candidata = {
  station_id: string; criterios: string; papel: "elegida" | "alternativa" | "candidata"; anclajes: number; llegadas: number;
  pedida_kwh: number; kwh_dia_media: number; kwh_dia_p95: number; pico_w: number; fuera_sol_pct: number;
  puesto_energia: number; puesto_pico: number; puesto_fuera_sol: number; puesto_energia_reservada_a: number;
  puesto_energia_ajuste_b: number;
};
type Estacion = {
  periodo: Periodo; station_id: string; anclajes: number; llegadas: number; pedida_kwh: number; kwh_dia_media: number;
  pico_w: number; simultaneas_max: number; fuera_sol_pct: number;
};
type Datos = {
  eta_cargador: number; potencia_bateria_w: number; altura_solar_min: number; minutos: number[]; sol: boolean[];
  resumen: Resumen[]; candidatas: Candidata[]; elegida: string; alternativa: string | null;
  perfil_red: Record<Periodo, number[]>; perfil_estaciones: { periodo: Periodo; station_id: string; w: number[] }[];
  estaciones: Estacion[];
};

const PERIODOS = [{ valor: "ajuste", texto: "Ajuste" }, { valor: "reservada", texto: "Semana reservada" }] as const;
const TAREAS = [
  { id: "t50", titulo: "Demanda por estación", objetivo: "Pasar de las llegadas con energía a curvas de potencia y energía de las 159 estaciones y elegir la estación que se dimensiona." },
];
const CASOS: Record<Caso, string> = {
  ideal: "Ideal (carga al llegar)", cargadores_100: "Un cargador por anclaje", cargadores_50: "Mitad de anclajes", cargadores_25: "Cuarta parte",
};
const BASE = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/";
const COLOR = { ajuste: "#306eae", reservada: "#a45c2f", sol: "rgba(242, 193, 78, 0.18)" };
const corto = (s: string) => s.slice(-9, -4);

export function Fase3() {
  const [, seccion] = useRuta();
  const actual = TAREAS.find((t) => t.id === seccion) ?? TAREAS[0];
  const { datos, error } = useDatos<Datos>("fase3/t50_demanda");
  const [periodo, setPeriodo] = useState<Periodo>("ajuste");
  const base = datos?.resumen.find((r) => r.periodo === periodo && r.modelo === "a" && r.caso === "cargadores_100");
  return <>
    <nav className="indice" aria-label="Secciones de la estación de recarga">
      {TAREAS.map((t) => <a href={"#/fase3/" + t.id} key={t.id} aria-current={t.id === actual.id ? "page" : undefined}>
        <span className="id">{t.id.toUpperCase()}</span>{t.titulo}</a>)}
      <a href="#/fase3/decisiones">Decisiones</a>
    </nav>
    {datos && base && <Cifras cifras={[
      { valor: num(base.kwh_dia, 2) + " kWh/día", nombre: "Energía desde la red", detalle: "159 estaciones · cargador con η = " + num(datos.eta_cargador, 2) },
      { valor: num(base.pico_red_kw, 2) + " kW", nombre: "Pico de la red", detalle: "P95 de " + num(base.p95_red_kw, 2) + " kW en 15 min" },
      { valor: pc(base.fuera_sol_pct, 0), nombre: "Energía sin sol", detalle: "Sol por debajo de " + datos.altura_solar_min + "°" },
      { valor: corto(datos.elegida), nombre: "Estación elegida", detalle: datos.elegida },
    ]} />}
    <Seccion id={actual.id} tarea={actual.id.toUpperCase()} titulo={actual.titulo} responsable="Alejandro Cuevas"
      objetivo={actual.objetivo} valor="Es la entrada del balance con paneles y batería (T54) y fija la estación que se diseña.">
      {!datos || !base ? <Cargando error={error} /> : <>
        <Segmentado etiqueta="Periodo" opciones={[...PERIODOS]} valor={periodo} cambiar={setPeriodo} />
        <Red datos={datos} periodo={periodo} r={base} />
        <Estaciones datos={datos} periodo={periodo} />
        <Cola datos={datos} periodo={periodo} />
        <p className="fuente"><a href={BASE + "estacion_recarga/T50_demanda_estaciones.ipynb"}>Notebook ejecutado y resultados</a></p>
      </>}
    </Seccion>
    <section className="seccion" id="decisiones">
      <header><div><div className="etiqueta">Estación de recarga</div><h2>Decisiones de T50</h2></div>
        <p>Supuestos con los que se pasa de la energía de los viajes a la potencia que ve la red.</p></header>
      {datos && <TablaDesplegable titulo="Evidencia y efecto en el proyecto" cabeceras={["Decisión", "Evidencia", "Efecto en el proyecto"]}
        filas={[
          ["Sesión a la potencia nominal del patinete", num(datos.potencia_bateria_w, 1) + " W en batería (576 Wh / 7 h); la duración se calcula en ese mismo lado",
            "El perfil ideal en batería coincide con T44"],
          ["Rendimiento del cargador " + num(datos.eta_cargador, 2), "Hipótesis; con 0,95 y 0,85 la energía va de un −5 % a un +6 %", "La energía y la potencia AC son las de batería / η"],
          ["Un cargador por anclaje", "Ninguna sesión espera y el pico es el ideal", "Los cargadores no limitan el diseño; el pico pasa al inversor"],
          ["Estación " + datos.elegida, "Mejor suma de puestos en energía, pico y energía sin sol en el ajuste",
            "T51 compara tres emplazamientos y T54 dimensiona paneles y batería"],
          ["Alternativa " + (datos.alternativa ?? "—"), "Energía casi igual y primera en la semana reservada", "T54 repite el balance con ella"],
        ]} />}
    </section>
  </>;
}

function Red({ datos, periodo, r }: { datos: Datos; periodo: Periodo; r: Resumen }) {
  const horas = datos.minutos.map((m) => (m + 7.5) / 60);
  const tramos: { x0: number; x1: number }[] = [];
  datos.sol.forEach((s, i) => {
    if (s && (i === 0 || !datos.sol[i - 1])) tramos.push({ x0: datos.minutos[i] / 60, x1: 24 });
    if (!s && i > 0 && datos.sol[i - 1]) tramos[tramos.length - 1].x1 = datos.minutos[i] / 60;
  });
  return <Bloque titulo="Día medio de la red y horas de sol" queMuestra="Potencia media que piden las 159 estaciones a la red eléctrica en cada cuarto de hora, sumadas."
    porQue="La forma de la curva frente a las horas de sol decide cuánta energía tiene que guardar la batería."
    comoLeer={"Un cargador por anclaje y Modelo A. La banda amarilla marca las horas con el sol a más de " + datos.altura_solar_min + "° en el ajuste."}
    conclusiones={[num(r.pedida_kwh, 1) + " kWh para " + num(r.llegadas) + " llegadas: " + num(r.kwh_dia, 2) + " kWh/día. Con η entre 0,85 y 0,95, de " +
      num(r["pedida_kwh_eta_0.95"], 1) + " a " + num(r["pedida_kwh_eta_0.85"], 1) + " kWh.",
      "El " + pc(r.fuera_sol_pct, 0) + " de la energía llega sin sol: la demanda crece por la tarde y alcanza su máximo después de las 17 h, cuando la producción ya cae.",
      "Pico de " + num(r.pico_red_kw, 2) + " kW para toda la red."]}
    fuente="T50_resumen.csv y T50_estaciones.csv">
    <Grafica descripcion="Potencia media diaria de la red por cuarto de hora" alto={320} trazas={(["ajuste", "reservada"] as const).map((p) => ({
      type: "scatter", mode: "lines", name: p === "ajuste" ? "Ajuste" : "Semana reservada", x: horas, y: datos.perfil_red[p].map((w) => w / 1000),
      line: { color: COLOR[p], width: p === periodo ? 2.6 : 1.4, dash: p === "ajuste" ? "solid" : "dash" },
    }))} capa={{ xaxis: { title: { text: "Hora local de Roma" }, range: [0, 24], dtick: 3 }, yaxis: { title: { text: "kW AC" }, rangemode: "tozero" },
      shapes: tramos.map((t) => ({ type: "rect", xref: "x", yref: "paper", x0: t.x0, x1: t.x1, y0: 0, y1: 1, fillcolor: COLOR.sol, line: { width: 0 }, layer: "below" })) }} />
  </Bloque>;
}

function Estaciones({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const [estacion, setEstacion] = useState(datos.elegida);
  const est = datos.estaciones.filter((e) => e.periodo === periodo);
  const perfil = datos.perfil_estaciones.find((p) => p.periodo === periodo && p.station_id === estacion);
  const candidatas = datos.candidatas;
  const el = candidatas.find((c) => c.papel === "elegida")!;
  const alt = candidatas.find((c) => c.papel === "alternativa");
  const destacadas = new Set(candidatas.map((c) => c.station_id));
  return <>
    <Bloque titulo="Energía, pico y demanda sin sol por estación" queMuestra="Cada punto es una estación: energía del periodo frente a su pico en 15 minutos; el color es la parte que llega sin sol."
      porQue="La energía fija los paneles, la parte sin sol la batería y el pico el inversor. La estación que lidera las tres cosas es la cota de diseño."
      comoLeer="Las candidatas son las primeras del ajuste en cada criterio. Pulsa un punto para ver su día medio."
      conclusiones={[
        "Se elige " + el.station_id + ": puestos " + el.puesto_energia + ", " + el.puesto_pico + " y " + el.puesto_fuera_sol +
          " en energía, pico y energía sin sol en el ajuste, con " + pc(el.fuera_sol_pct, 0) + " sin sol.",
        alt ? "La alternativa " + alt.station_id + " pide casi lo mismo (" + num(alt.pedida_kwh, 1) + " frente a " + num(el.pedida_kwh, 1) +
          " kWh) y es la primera en la semana reservada; la elegida baja al puesto " + el.puesto_energia_reservada_a + ". T54 repite el balance con las dos." : "",
      ].filter(Boolean)}
      fuente="T50_estaciones.csv y T50_candidatas.csv">
      <Grafica descripcion="Energía frente a pico por estación" alto={360}
        alClic={(e) => { const id = e.points[0]?.customdata; if (typeof id === "string") setEstacion(id); }}
        trazas={[{
          type: "scatter", mode: "markers", x: est.map((e) => e.pedida_kwh), y: est.map((e) => e.pico_w),
          customdata: est.map((e) => e.station_id), text: est.map((e) => e.station_id + "<br>" + e.anclajes + " anclajes · " + num(e.fuera_sol_pct, 0) + " % sin sol"),
          hovertemplate: "%{text}<br>%{x:.2f} kWh · %{y:.0f} W<extra></extra>",
          marker: { size: est.map((e) => (destacadas.has(e.station_id) ? 15 : 8)), color: est.map((e) => e.fuera_sol_pct), colorscale: "Viridis",
            colorbar: { title: { text: "% sin sol" } }, line: { width: est.map((e) => (e.station_id === estacion ? 2.5 : 0)), color: "#d43" } },
        }]} capa={{ xaxis: { title: { text: "Energía del periodo (kWh AC)" } }, yaxis: { title: { text: "Pico en 15 min (W AC)" } } }} />
    </Bloque>
    <div className="loc-controles"><label>Estación
      <select value={estacion} onChange={(e) => setEstacion(e.target.value)}>
        {est.map((e) => <option key={e.station_id} value={e.station_id}>{e.station_id}{e.station_id === datos.elegida ? " · elegida" : e.station_id === datos.alternativa ? " · alternativa" : ""}</option>)}
      </select></label></div>
    {perfil && <Grafica descripcion="Día medio de la estación seleccionada" alto={280} trazas={[{
      type: "scatter", mode: "lines", name: estacion, x: datos.minutos.map((m) => (m + 7.5) / 60), y: perfil.w, line: { color: COLOR[periodo], shape: "hv" },
    }]} capa={{ xaxis: { title: { text: "Hora local de Roma" }, range: [0, 24], dtick: 3 }, yaxis: { title: { text: "W AC" }, rangemode: "tozero" } }} />}
    <TablaDesplegable titulo="Candidatas y su posición en cada criterio" numericas={[2, 3, 4, 5, 6, 7, 8]}
      cabeceras={["Estación", "Papel · criterios", "Anclajes", "kWh ajuste", "kWh/día P95", "Pico (W)", "% sin sol", "Puestos E · P · S", "Puesto E reserva · B"]}
      filas={candidatas.map((c) => [c.station_id, c.papel + " · " + c.criterios.replaceAll(";", ", ").replaceAll("_", " "), c.anclajes, num(c.pedida_kwh, 2),
        num(c.kwh_dia_p95, 2), num(c.pico_w, 0), pc(c.fuera_sol_pct, 0), c.puesto_energia + " · " + c.puesto_pico + " · " + c.puesto_fuera_sol,
        c.puesto_energia_reservada_a + " · " + c.puesto_energia_ajuste_b])} />
  </>;
}

function Cola({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const t = (Object.keys(CASOS) as Caso[]).map((c) => datos.resumen.find((r) => r.periodo === periodo && r.modelo === "a" && r.caso === c)!);
  const c25 = t[3];
  return <Bloque titulo="Cuántos cargadores hacen falta" queMuestra="Pico de la red y sesiones que esperan según cuántos anclajes tienen cargador."
    porQue="Si cada anclaje carga, la potencia de la estación sale de la simultaneidad real; si se ahorran cargadores, aparecen colas y energía aplazada."
    comoLeer="Las sesiones esperan por orden de llegada y no se interrumpen. La energía pedida es la misma en todos los casos."
    conclusiones={["Con un cargador por anclaje nadie espera: como mucho cargan " + t[1].simultaneas_max + " patinetes a la vez en una estación.",
      "Con la cuarta parte esperan " + num(c25.sesiones_en_espera) + " sesiones en " + c25.estaciones_con_cola + " estaciones, " + num(c25.espera_media_min, 0) +
        " min de media y hasta " + num(c25.espera_max_min, 0) + " min; el pico solo baja de " + num(t[1].pico_red_kw, 2) + " a " + num(c25.pico_red_kw, 2) + " kW."]}
    fuente="T50_resumen.csv">
    <Grafica descripcion="Sesiones en espera según los cargadores" alto={300} trazas={[
      { type: "bar", name: "Sesiones en espera", x: t.map((r) => CASOS[r.caso]), y: t.map((r) => r.sesiones_en_espera), marker: { color: COLOR.reservada } },
      { type: "scatter", mode: "lines+markers", name: "Pico de la red (kW)", x: t.map((r) => CASOS[r.caso]), y: t.map((r) => r.pico_red_kw), yaxis: "y2", line: { color: COLOR.ajuste } },
    ]} capa={{ yaxis: { title: { text: "Sesiones" }, rangemode: "tozero" }, yaxis2: { title: { text: "kW" }, overlaying: "y", side: "right", rangemode: "tozero" },
      legend: { orientation: "h", y: -0.25 } }} />
  </Bloque>;
}
