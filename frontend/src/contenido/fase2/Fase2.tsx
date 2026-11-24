import { useState } from "react";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { fecha, num, pc } from "../../formato";
import { useRuta } from "../../ruta";

type Periodo = "ajuste" | "reservada";
type Modelo = "a" | "b";
type Fisico = {
  periodo: Periodo; viajes: number; distancia_km: number; a_wh_km: number; b_wh_km: number; b_bruto_wh_km: number;
  k: number; llano_t16_wh_km: number; llano_horario_wh_km: number; viento_wh_km: number;
  rango_bajo_wh_km: number; rango_alto_wh_km: number; mae_wh: number; p95_abs_wh: number; max_a_wh: number;
  traccion_nula_b: number; cero_calibracion_total: number;
};
type Desnivel = {
  periodo: Periodo; viajes: number; suben: number; bajan: number; p95_abs_m: number; aporte_kwh: number; aporte_medio_wh: number;
};
type Hist = { periodo: Periodo; centros_m: number[]; cuentas: number[]; centros_wh: number[]; densidad: number[][] };
type Red = {
  periodo: Periodo; modelo: Modelo; viajes: number; estaciones: number; kwh: number; kwh_dia: number; pico_red_w: number;
  estacion_energia_max: string; energia_max_kwh: number; estacion_pico_max: string; pico_estacion_w: number; top_pct: number;
};
type Conciliacion = {
  periodo: Periodo; modelo: Modelo; observados: number; atendidos: number; sin_destino_en_red: number;
  observados_wh: number; atendidos_wh: number; sin_destino_wh: number; diferencia_wh: number;
};
type Comparacion = { periodo: Periodo; modelo: Modelo; red: string; viajes: number; kwh: number; top_pct: number; estacion_max: string };
type Carga = {
  periodo: Periodo; modelo: Modelo; reserva_pct: number; flota: number; solicitudes: number; atendidos: number;
  rechazos_bateria: number; unidades_bajo_reserva: number; min_soc_pct: number; mediana_min_unidad_pct: number;
};
type Datos = {
  fisico: Fisico[]; desnivel: Desnivel[]; histogramas: Hist[];
  resumen: Red[]; conciliacion: Conciliacion[];
  ranking: { periodo: Periodo; spearman: number; comunes_top: number; estaciones_pico_b_mayor: number }[];
  sensibilidad: Comparacion[]; soc: Carga[]; diario: { modelo: Modelo; periodo: Periodo; fecha: string; p05: number; mediana: number; minimo: number }[];
  estacion_inicial: string; n_top: number;
  observado_diario: { periodo: Periodo; fecha: string; viajes: number; energia_wh_a: number; energia_wh_b: number }[];
};
type Tornado = {
  factor: string; parametro: string; valor: string; periodo: Periodo; k: number; fisico_wh_km: number; kwh_dia: number;
  estacion_max: string; estacion_max_kwh_dia: number; pico_red_kw: number; spearman_central: number; comunes_top10: number;
  misma_estacion_max: boolean; cambio_estacion_max_kwh_dia_pct: number; cambio_pico_red_kw_pct: number;
};
type Sensibilidad = { tornado: Tornado[]; central: Record<Periodo, string> };
type Perfiles = { minutos: number[]; perfiles: { periodo: Periodo; station_id: string; a: number[]; b: number[] }[] };

const PERIODOS = [{ valor: "ajuste", texto: "Ajuste" }, { valor: "reservada", texto: "Semana reservada" }] as const;
const TAREAS = [
  { id: "t40", titulo: "Modelo de referencia", objetivo: "Verificar energía por distancia y total de viajes observados." },
  { id: "t41", titulo: "Modelo físico", objetivo: "Separar rodadura, aerodinámica y desnivel con supuestos trazables." },
  { id: "t42", titulo: "Desnivel de extremos", objetivo: "Cuantificar el efecto de la diferencia de elevación entre origen y destino." },
  { id: "t43", titulo: "Calibración", objetivo: "Ajustar una sola escala y comprobar su transferencia." },
  { id: "t44", titulo: "Demanda por estación", objetivo: "Conciliar la energía observada con la reposición en destinos atendidos." },
  { id: "t45", titulo: "Estado de carga", objetivo: "Seguir la batería de cada unidad simulada durante todo febrero." },
  { id: "t46", titulo: "Sensibilidad", objetivo: "Medir qué hipótesis cambian la estación con más energía, su demanda diaria y el pico de la red." },
];
const BASE = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/";
const color = { a: "#306eae", b: "#a45c2f" };
const modelos = ["a", "b"] as const;

export function Fase2() {
  const [, seccion] = useRuta();
  const actual = TAREAS.find((t) => t.id === seccion) ?? TAREAS[0];
  const { datos, error } = useDatos<Datos>("fase2/consumo");
  const [periodo, setPeriodo] = useState<Periodo>("ajuste");
  const f = datos?.fisico.find((x) => x.periodo === periodo);
  const resumen = datos?.resumen.filter((x) => x.periodo === periodo) ?? [];
  return <>
    <nav className="indice" aria-label="Secciones de consumo">
      {TAREAS.map((t) => <a href={"#/fase2/" + t.id} key={t.id} aria-current={t.id === actual.id ? "page" : undefined}>
        <span className="id">{t.id.toUpperCase()}</span>{t.titulo}</a>)}
      <a href="#/fase2/decisiones">Decisiones</a>
    </nav>
    {f && resumen.length > 0 && <Cifras cifras={[
      { valor: num(f.viajes), nombre: "Viajes observados", detalle: periodo === "ajuste" ? "1–21 de febrero" : "22–28 de febrero" },
      { valor: num(f.b_wh_km, 2) + " Wh/km", nombre: "Modelo B calibrado" },
      { valor: num(resumen[0].viajes), nombre: "Viajes atendidos", detalle: "Red habitual · T39" },
      { valor: num(resumen.find((r) => r.modelo === "a")!.kwh_dia, 2) + " kWh/día", nombre: "Reposición Modelo A", detalle: "Energía en batería" },
    ]} />}
    <Seccion id={actual.id} tarea={actual.id.toUpperCase()} titulo={actual.titulo} responsable="Javier Saguar"
      objetivo={actual.objetivo} valor="Justifica qué energía se pasa al dimensionado de recarga.">
      {!datos || !f ? <Cargando error={error} /> : <>
        <Segmentado etiqueta="Periodo de consumo" opciones={[...PERIODOS]} valor={periodo} cambiar={setPeriodo} />
        {actual.id === "t40" && <Referencia datos={datos} fisico={f} />}
        {actual.id === "t41" && <Fisica fila={f} />}
        {actual.id === "t42" && <Alturas fila={datos.desnivel.find((x) => x.periodo === periodo)!} hist={datos.histogramas.find((x) => x.periodo === periodo)!} />}
        {actual.id === "t43" && <Calibracion fila={f} hist={datos.histogramas.find((x) => x.periodo === periodo)!} />}
        {actual.id === "t44" && <Demanda datos={datos} periodo={periodo} />}
        {actual.id === "t45" && <Baterias datos={datos} periodo={periodo} />}
        {actual.id === "t46" && <Tornados periodo={periodo} />}
        <p className="fuente"><a href={BASE + (actual.id === "t46" ? "consumo/T46_sensibilidad.ipynb"
          : actual.id >= "t44" ? "consumo/T44_T45_agregados.ipynb" : "consumo/T41_T43_modelo_b.ipynb")}>
          Notebook ejecutado y resultados</a></p>
      </>}
    </Seccion>
    <section className="seccion" id="decisiones">
      <header><div><div className="etiqueta">Consumo</div><h2>Decisiones de T40–T46</h2></div>
        <p>Criterios para pasar de los viajes atendidos al dimensionado eléctrico de las estaciones.</p></header>
      {datos && <TablaDesplegable titulo="Evidencia, periodo y decisión" cabeceras={["Decisión", "Evidencia", "Efecto en el proyecto"]}
        filas={[
          ["A como referencia de recarga", "Coeficiente del enunciado y pico de red superior en ajuste", "Dimensionar la demanda base con A"],
          ["B como sensibilidad por estación", num(datos.ranking.find((r) => r.periodo === "ajuste")!.spearman, 3) +
            " de Spearman en ajuste. La estación con más energía cambia por el desnivel.", "Comprobar las cargas locales con ambos modelos"],
          ["Calibrar solo rodadura y aire", "El desnivel conserva su trabajo físico y ningún viaje queda en 0 Wh (antes " +
            num(datos.fisico.find((x) => x.periodo === "ajuste")!.cero_calibracion_total) + " en el ajuste)", "B más fiel en subidas y bajadas"],
          ["Margen de ±20 % en la demanda", "T46: los coeficientes físicos mueven poco la demanda; el coeficiente de referencia la mueve en proporción",
            "Probar el dimensionado de T50–T55 con ese margen"],
          ["Reposición en el destino atendido", "Suma reconciliada de viajes, patinetes y estaciones", "Usar T44_entrada_recarga.parquet en T50"],
          ["Reserva operativa de T35", pc(datos.soc[0].reserva_pct, 0) + " en las simulaciones de ambos modelos", "Evaluar la potencia disponible en la fase 3"],
        ]} />}
      <p><a href={BASE + "docs/conclusiones_eda.md#cierre-de-consumo-t40t46"}>Evidencia y limitaciones en el repositorio</a></p>
    </section>
  </>;
}

function Referencia({ datos, fisico: f }: { datos: Datos; fisico: Fisico }) {
  const t = datos.observado_diario.filter((d) => d.periodo === f.periodo);
  return <Bloque titulo="Tracción de los viajes observados" queMuestra="Energía diaria usando la distancia registrada de cada viaje elegible."
    porQue="La referencia del enunciado permite conciliar Wh por viaje, patinete y flota."
    comoLeer="La fecha corresponde a la salida. El gráfico incluye viajes que quedarían fuera de la red simulada."
    conclusiones={[num(f.a_wh_km, 1) + " Wh/km. Un viaje de 2 km requiere 27 Wh.",
      "El máximo observado es " + num(f.max_a_wh, 1) + " Wh en un solo viaje."]}
    fuente="T40_energia_viaje.csv y T44_observado_flota_dia.csv">
    <Grafica descripcion="Energía diaria observada, Modelo A" alto={310} trazas={[{ type: "bar", x: t.map((d) => d.fecha),
      y: t.map((d) => d.energia_wh_a / 1000), marker: { color: color.a }, name: "Modelo A" }]}
      capa={{ xaxis: { type: "date", tickformat: "%d/%m" }, yaxis: { title: { text: "kWh/día" } } }} />
  </Bloque>;
}

function Fisica({ fila: f }: { fila: Fisico }) {
  return <Bloque titulo="Efecto de la física y los supuestos" queMuestra="Intensidad de los viajes con llano T16, desnivel neto y escenarios de sensibilidad."
    porQue="Velocidad y pendiente redistribuyen el consumo entre viajes."
    comoLeer="Las tres primeras barras son previas a la calibración. Las demás usan la escala central del ajuste, que multiplica solo rodadura y aire. El viento se reduce de 10 m a la altura del conductor."
    conclusiones={["En llano, " + num(f.llano_t16_wh_km, 2) + " Wh/km con la densidad de T16.",
      "Con densidad horaria, desnivel neto y la electrónica de a bordo, " + num(f.b_bruto_wh_km, 2) + " Wh/km antes de escalar.",
      "Con viento a la altura del conductor, " + num(f.viento_wh_km, 2) + " Wh/km."]}
    fuente="T41_intensidades.csv, Copernicus GLO-30 y Open-Meteo">
    <Grafica descripcion="Intensidad del Modelo B por escenario físico" alto={325} trazas={[{
      type: "bar", x: ["Llano T16", "Llano horario", "B físico", "B bajo", "B central", "B alto", "B con viento"],
      y: [f.llano_t16_wh_km, f.llano_horario_wh_km, f.b_bruto_wh_km, f.rango_bajo_wh_km, f.b_wh_km,
        f.rango_alto_wh_km, f.viento_wh_km], marker: { color: [color.a, color.a, color.a, color.b, color.b, color.b, color.b] },
    }]} capa={{ yaxis: { title: { text: "Wh/km" } }, xaxis: { tickangle: -22 } }} />
  </Bloque>;
}

function Alturas({ fila: d, hist: h }: { fila: Desnivel; hist: Hist }) {
  return <Bloque titulo="Distribución del desnivel neto" queMuestra="Diferencias de elevación entre destino y origen."
    porQue="El trabajo gravitatorio modifica el consumo en subida y en bajada."
    comoLeer="Negativo representa un destino más bajo. El DEM mide superficies de unos 30 m y los dos extremos resumen el viaje."
    conclusiones={[num(d.suben) + " viajes suben y " + num(d.bajan) + " bajan.",
      "El desnivel añade " + num(d.aporte_kwh, 2) + " kWh antes de calibrar. El 95 % de los valores absolutos queda dentro de " + num(d.p95_abs_m, 1) + " m."]}
    fuente="T42_desnivel.csv y ficha Copernicus GLO-30">
    <Grafica descripcion="Viajes por desnivel destino menos origen" alto={310} trazas={[{
      type: "bar", x: h.centros_m, y: h.cuentas, marker: { color: color.a },
    }]} capa={{ xaxis: { title: { text: "Desnivel neto (m)" } }, yaxis: { title: { text: "Viajes" } } }} />
  </Bloque>;
}

function Calibracion({ fila: f, hist: h }: { fila: Fisico; hist: Hist }) {
  return <>
    <Bloque titulo="Comparación por viaje" queMuestra="Número de viajes por combinación de Wh de los modelos A y B calibrado."
      porQue="La intensidad total igualada puede ocultar diferencias por viaje o estación."
      comoLeer="La diagonal marca la coincidencia. Por encima, B asigna mayor energía que A."
      conclusiones={["Escala de rodadura y aire del ajuste k = " + num(f.k, 4) + ". En este periodo B da " + num(f.b_wh_km, 2) + " Wh/km.",
        "Diferencia absoluta media de " + num(f.mae_wh, 2) + " Wh por viaje. El P95 es " + num(f.p95_abs_wh, 2) + " Wh.",
        "Ningún viaje queda en 0 Wh: " + num(f.traccion_nula_b) + " bajan sin tracción y solo gastan la electrónica. Escalando toda la energía quedaban " +
        num(f.cero_calibracion_total) + " en cero."]}
      fuente="T43_calibracion.csv y T43_viajes.csv.gz">
      <Grafica descripcion="Dispersión de energía A y B por viaje" alto={345} trazas={[{
        type: "heatmap", x: h.centros_wh, y: h.centros_wh, z: h.densidad, colorscale: "Blues",
        colorbar: { title: { text: "Viajes" } },
      }]} capa={{ xaxis: { title: { text: "Modelo A (Wh/viaje)" } }, yaxis: { title: { text: "Modelo B calibrado (Wh/viaje)" } },
        shapes: [{ type: "line", x0: 0, y0: 0, x1: h.centros_wh.at(-1), y1: h.centros_wh.at(-1), line: { dash: "dot", width: 1.5 } }] }} />
    </Bloque>
    <p><a href={BASE + "resultados/tablas/consumo/T43_mayores_diferencias.csv"}>Viajes con mayor diferencia</a> ·{" "}
      <a href={BASE + "resultados/tablas/consumo/T43_velocidad_desnivel.csv"}>Diferencia por velocidad y desnivel</a></p>
  </>;
}

function Demanda({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const { datos: perfiles, error } = useDatos<Perfiles>("fase2/perfiles");
  const [estacion, setEstacion] = useState(datos.estacion_inicial);
  const t = datos.resumen.filter((r) => r.periodo === periodo);
  const [a, b] = modelos.map((m) => t.find((r) => r.modelo === m)!);
  const r = datos.ranking.find((d) => d.periodo === periodo)!;
  const pares = perfiles?.perfiles.filter((d) => d.periodo === periodo) ?? [];
  const p = pares.find((f) => f.station_id === estacion);
  const sensibilidad = datos.sensibilidad.filter((x) => x.periodo === periodo);
  return <>
    <div className="loc-controles"><label>Estación de devolución
      <select value={estacion} onChange={(e) => setEstacion(e.target.value)} disabled={!perfiles}>
        {!perfiles && <option value={estacion}>{estacion}</option>}
        {pares.map((f) => <option key={f.station_id} value={f.station_id}>{f.station_id}</option>)}
      </select></label></div>
    <Bloque titulo="Perfil medio de reposición por estación" queMuestra="Potencia media por cuarto de hora en la estación seleccionada."
      porQue="Dos modelos con kWh similares pueden cambiar la hora y ubicación de los picos."
      comoLeer="Potencia en batería. Se reponen los Wh a partir de la devolución y se promedian días naturales."
      conclusiones={["La red necesita " + num(a.kwh_dia, 2) + " kWh/día con A y " + num(b.kwh_dia, 2) + " con B.",
        "La estación con mayor energía pasa de " + a.estacion_energia_max + " con A a " + b.estacion_energia_max +
        " con B. Comparten " + r.comunes_top + " de las " + datos.n_top + " primeras.",
        "B supera el pico local de A en " + num(r.estaciones_pico_b_mayor) + " estaciones."]}
      fuente="T44_resumen.csv, T44_estaciones.csv y llegada atendida T39">
      {p && perfiles ? <Grafica descripcion="Potencia media diaria en la estación de devolución" alto={315} trazas={modelos.map((m) => ({
        type: "scatter", mode: "lines", name: m.toUpperCase(), x: perfiles.minutos.map((d) => d / 60), y: p[m],
        line: { color: color[m], shape: "hv" },
      }))} capa={{ xaxis: { title: { text: "Hora local de Roma" }, range: [0, 24] }, yaxis: { title: { text: "W en batería" }, rangemode: "tozero" } }} />
        : <Cargando error={error} />}
    </Bloque>
    <TablaDesplegable titulo="Picos, estaciones críticas y conciliación" cabeceras={["Modelo", "Pico red (W)", "Mayor pico individual (W)", "Estación del pico", "Sin devolución", "Diferencia (Wh)"]}
      filas={t.map((x) => {
        const c = datos.conciliacion.find((s) => s.periodo === periodo && s.modelo === x.modelo)!;
        return [x.modelo.toUpperCase(), num(x.pico_red_w, 1), num(x.pico_estacion_w, 1), x.estacion_pico_max, num(c.sin_destino_en_red), num(c.diferencia_wh)];
      })} />
    <TablaDesplegable titulo="Sensibilidad sobre exactamente los mismos viajes" cabeceras={["Red", "Modelo", "Viajes comunes", "kWh", "Cuota de las primeras estaciones", "Estación con mayor energía"]}
      filas={sensibilidad.map((x) => [x.red, x.modelo.toUpperCase(), num(x.viajes), num(x.kwh, 2), pc(x.top_pct, 2), x.estacion_max])} />
    <p><a href={BASE + "resultados/tablas/consumo/T44_estaciones.csv"}>Energía y P95 por estación</a> ·{" "}
      <a href={BASE + "resultados/tablas/consumo/T44_perfil_15min.csv.gz"}>Perfil completo de 15 minutos</a> ·{" "}
      <a href={BASE + "resultados/tablas/consumo/T44_perfil_hora.csv.gz"}>Perfil horario completo</a></p>
  </>;
}

function Baterias({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  const t = datos.soc.filter((r) => r.periodo === periodo);
  const minimos = modelos.map((m) => t.find((r) => r.modelo === m)!.min_soc_pct);
  return <Bloque titulo="Mínimo diario de batería por patinete" queMuestra="Mediana y P05 del mínimo diario de las unidades simuladas."
    porQue="El mínimo permite medir el margen respecto a la reserva de despacho."
    comoLeer="Se preserva el estado al pasar de ajuste a reserva. El P05 muestra la cola con menor carga."
    conclusiones={["Mínimo de " + pc(minimos[0], 2) + " con A y " + pc(minimos[1], 2) + " con B.",
      "Rechazos por batería A/B " + t.map((r) => r.rechazos_bateria).join(" / ") + ". Reserva de " + pc(t[0].reserva_pct, 0) + "."]}
    fuente="T45_soc_diario.csv y control independiente de T35">
    <Grafica descripcion="Mínimos de estado de carga por día" alto={325} trazas={modelos.flatMap((m) => {
      const x = datos.diario.filter((d) => d.periodo === periodo && d.modelo === m);
      return (["mediana", "p05"] as const).map((q) => ({ type: "scatter" as const, mode: "lines+markers" as const,
        name: m.toUpperCase() + " · " + q.toUpperCase(), x: x.map((d) => fecha(d.fecha)), y: x.map((d) => d[q]),
        line: { color: color[m], dash: q === "p05" ? "dash" as const : "solid" as const } }));
    })} capa={{ yaxis: { title: { text: "Carga (%)" }, range: [0, 105] },
      shapes: [{ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: t[0].reserva_pct, y1: t[0].reserva_pct, line: { dash: "dot" } }] }} />
  </Bloque>;
}

type Cambio = "cambio_estacion_max_kwh_dia_pct" | "cambio_pico_red_kw_pct";

function Tornados({ periodo }: { periodo: Periodo }) {
  const { datos, error } = useDatos<Sensibilidad>("fase2/sensibilidad");
  if (!datos) return <Cargando error={error} />;
  const t = datos.tornado.filter((x) => x.periodo === periodo);
  const centro = t.find((x) => x.parametro === "central")!;
  const casos = t.filter((x) => x.parametro !== "central");
  const rango = (f: string, c: Cambio) => {
    const v = casos.filter((x) => x.factor === f).map((x) => x[c]);
    return [Math.min(0, ...v), Math.max(0, ...v)];
  };
  const amplitud = (f: string) => Math.max(...rango(f, "cambio_pico_red_kw_pct").map(Math.abs));
  const orden = [...new Set(casos.map((x) => x.factor))].sort((a, b) => amplitud(a) - amplitud(b));
  const fisicos = casos.filter((x) => !["referencia_relativa", "calibracion"].includes(x.parametro));
  const maximo = (c: Cambio) => Math.max(...fisicos.map((x) => Math.abs(x[c])));
  const cambian = [...new Set(casos.filter((x) => !x.misma_estacion_max && x.parametro !== "referencia_relativa")
    .map((x) => x.factor.toLowerCase()))];
  const ref = casos.filter((x) => x.parametro === "referencia_relativa").map((x) => x.pico_red_kw);
  const trazas = (c: Cambio) => [{
    type: "bar" as const, orientation: "h" as const, y: orden, base: orden.map((f) => rango(f, c)[0]),
    x: orden.map((f) => rango(f, c)[1] - rango(f, c)[0]), marker: { color: color.a },
    customdata: orden.map((f) => rango(f, c)[1]),
    hovertemplate: "%{y}<br>De %{base:.1f} % a %{customdata:.1f} %<extra></extra>",
  }];
  const capa = { xaxis: { title: { text: "Cambio frente al caso central (%)" }, zeroline: true }, yaxis: { automargin: true } };
  return <>
    <Bloque titulo="Qué hipótesis mueven la demanda de recarga"
      queMuestra="Cambio de la energía diaria de la estación que más recibe al mover un parámetro cada vez."
      porQue="La fase 3 dimensiona una estación concreta: importa si cambia cuál es y cuánta energía pide."
      comoLeer="Cada barra va del menor al mayor cambio frente al caso central. En cada caso se recalibra la escala para que el ajuste dé 13,5 Wh/km, salvo en el contraste del coeficiente de referencia."
      conclusiones={["Los parámetros físicos mueven la energía de la estación máxima como mucho un " + pc(maximo("cambio_estacion_max_kwh_dia_pct"), 1) +
        " y el pico de la red un " + pc(maximo("cambio_pico_red_kw_pct"), 1) + ".",
        "La estación con más energía es " + centro.estacion_max + " (" + num(centro.estacion_max_kwh_dia, 3) + " kWh/día)." +
        (cambian.length ? " Solo cambia con: " + cambian.join(", ") + "." : " No cambia en ningún caso."),
        "Un ±20 % en el coeficiente de referencia lleva el pico de la red de " + num(Math.min(...ref), 2) + " a " +
        num(Math.max(...ref), 2) + " kW: es la incertidumbre que debe probar el dimensionado."]}
      fuente="T46_tornado.csv">
      <Grafica descripcion="Cambio de la energía diaria de la estación máxima por parámetro" alto={380}
        trazas={trazas("cambio_estacion_max_kwh_dia_pct")} capa={capa} />
    </Bloque>
    <Bloque titulo="Pico simultáneo de la red" queMuestra="Cambio del pico de potencia de todas las estaciones juntas por parámetro."
      porQue="El pico de la red es la referencia para la potencia de los cargadores y de la conexión."
      comoLeer="Igual que la gráfica anterior. La potencia es la de T44, en el lado de la batería."
      conclusiones={["Pico central: " + num(centro.pico_red_kw, 2) + " kW en este periodo."]} fuente="T46_tornado.csv">
      <Grafica descripcion="Cambio del pico simultáneo de la red por parámetro" alto={380} trazas={trazas("cambio_pico_red_kw_pct")} capa={capa} />
    </Bloque>
    <TablaDesplegable titulo="Todos los casos" cabeceras={["Parámetro", "Valor", "Escala k", "kWh/día de la red", "Estación máxima", "kWh/día", "Pico red (kW)", "Spearman"]}
      filas={t.map((x) => [x.factor, x.parametro === "central" ? "central" : x.valor, num(x.k, 3), num(x.kwh_dia, 2), x.estacion_max,
        num(x.estacion_max_kwh_dia, 3), num(x.pico_red_kw, 2), num(x.spearman_central, 3)])} />
  </>;
}
