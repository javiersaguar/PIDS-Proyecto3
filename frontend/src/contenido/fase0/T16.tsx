import type { Data, Shape } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { indicadores, num, pc } from "../../formato";
import { COLOR, ESCALA_AZUL, REFERENCIAS_ROMA, capaMapa, rgba, trazaCeldas, trazaEscalon, trazaReferencias, trazaTexto, trazasUmbral, type Celda } from "../../graficas";

type FilaViaje = { periodo: string; viajes: number; energia_wh_p50: number; energia_wh_p95: number; energia_wh_max: number; pct_bateria_p50: number; pct_bateria_p95: number; pct_bateria_max: number; viajes_mayor_bateria: number };
type Viaje = { histograma: { bordes_wh: number[]; viajes: number[] }; tabla: FilaViaje[]; bateria_wh: number; consumo_wh_km: number };
type FilaPatineteDia = { periodo: string; patinete_dias: number; viajes_media: number; km_media: number; energia_wh_media: number; energia_wh_p50: number; energia_wh_p95: number; energia_wh_max: number; pct_patinete_dias_sobre_50pct_bateria: number; pct_patinete_dias_sobre_80pct_bateria: number };
type PatineteDia = { histograma: { bordes_wh: number[]; patinete_dias: number[] }; tabla: FilaPatineteDia[]; bateria_wh: number; umbrales_pct: number[] };
type Patinete = { autonomia_percentiles_dias: Record<string, number>; resumen: { indicador: string; valor: number }[] };
type Flota = { fecha: string; periodo: string; viajes: number; patinetes_activos: number; km: number; energia_kwh: number; cargas_completas_equivalentes: number }[];
type Celdas = { res: number; celdas: (Celda & { rango: number; kwh_dia: number })[] };
type Perfil = {
  horas: { hora: number; llegadas: number; energia_wh_dia: number; pct_energia: number }[];
  reparto_pct: { pct_energia_llega_10_16h: number; pct_energia_llega_16_24h: number; pct_energia_llega_resto: number };
  horas_sol: [number, number];
};
type Indicadores = { indicador: string; valor: number }[];

const FASE = "fase0";

export function T16() {
  const { datos: r, error } = useDatos<Indicadores>(`${FASE}/t16_resumen`);
  const { datos: v } = useDatos<Viaje>(`${FASE}/t16_viaje`);
  const { datos: p } = useDatos<Patinete>(`${FASE}/t16_patinete`);
  const i = r ? indicadores(r) : null;
  const ip = p ? indicadores(p.resumen) : null;
  const ajuste = v?.tabla.find((t) => t.periodo === "ajuste");
  return (
    <Seccion
      id="t16"
      tarea="T16"
      responsable="Alejandro Cuevas"
      titulo="Kilómetros y energía de referencia por patinete y día"
      notebook="exploracion/T16_energia_referencia.ipynb"
      objetivo="Calcular cuánta energía mueve cada viaje, cada patinete, la flota y cada zona de destino con el modelo del enunciado (13,5 Wh por km recorrido) y una batería de 576 Wh."
      valor="Dice cada cuánto hay que recargar un patinete, el orden de magnitud de los kWh diarios por estación y qué parte de la energía llega en horas de sol. Con eso se fija la escala de la fase 3; el modelo físico es de la fase 2."
    >
      {i && ip && ajuste ? (
        <Cifras
          cifras={[
            { valor: `${num(ajuste.energia_wh_p50, 1)} Wh`, nombre: "por viaje", detalle: `mediana; ${pc(ajuste.pct_bateria_p50)} de la batería` },
            { valor: `${num(i.flota_kwh_dia_media_ajuste, 1)} kWh`, nombre: "de la flota al día", detalle: `media del ajuste; máx. ${num(i.flota_kwh_dia_max_ajuste, 1)}` },
            { valor: `${num(ip.dias_autonomia_estimada_p50, 1)} días`, nombre: "de autonomía", detalle: "mediana por patinete con el uso observado" },
            { valor: `${num(i.celda_kwh_dia_max, 2)} kWh`, nombre: "al día en la celda que más recibe", detalle: `mediana de las celdas: ${num(i.celda_kwh_dia_p50, 2)}` },
            { valor: pc(i.pct_energia_llega_16_24h), nombre: "llega de 16 a 24 h", detalle: `${pc(i.pct_energia_llega_10_16h)} con sol (10–16 h)` },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <BloqueViaje />
      <BloquePatineteDia />
      {ip && <BloqueAutonomia ip={ip} />}
      {i && <BloqueFlota i={i} />}
      <BloqueCeldas />
      <BloquePerfil />
      <p className="aviso">
        <strong>Comprobación.</strong> La energía sumada por viaje coincide con la sumada por patinete, por patinete y día,
        por día de la flota y por celda de destino, con diferencia de 0 Wh (tolerancia de 10⁻⁶ Wh), y un viaje de control de
        2 km da 27 Wh (tabla <code>T16_comprobacion.csv</code>).
      </p>
    </Seccion>
  );
}

function BloqueViaje() {
  const { datos: v, error } = useDatos<Viaje>(`${FASE}/t16_viaje`);
  if (!v) return <Cargando error={error} />;
  const a = v.tabla.find((t) => t.periodo === "ajuste")!;
  const alto = Math.max(...v.histograma.viajes) * 1.18;
  const trazas: Data[] = [
    trazaEscalon({
      bordes: v.histograma.bordes_wh,
      cuentas: v.histograma.viajes,
      nombre: "Viajes",
      color: COLOR.serie1,
      plantilla: "%{customdata[0]:.0f}–%{customdata[1]:.0f} Wh<br>%{y} viajes<extra></extra>",
    }),
    ...trazasUmbral(a.energia_wh_p50, alto * 0.86, `mediana ${num(a.energia_wh_p50, 1)} Wh`),
    ...trazasUmbral(a.energia_wh_p95, alto * 0.6, `P95 ${num(a.energia_wh_p95, 1)} Wh`),
  ];
  return (
    <Bloque
      titulo="1. Energía por viaje"
      queMuestra={`La energía de cada viaje elegible del periodo de ajuste con ${num(v.consumo_wh_km, 1)} Wh/km y el porcentaje de la batería de ${v.bateria_wh} Wh que gasta.`}
      porQue="Si un viaje pudiera gastar más que una batería, el sistema tendría que garantizar cargas completas antes de cada salida."
      conclusiones={[
        `El viaje mediano gasta ${num(a.energia_wh_p50, 1)} Wh (${pc(a.pct_bateria_p50)} de la batería); el P95, ${num(a.energia_wh_p95, 1)} Wh (${pc(a.pct_bateria_p95)}), y el máximo, ${num(a.energia_wh_max, 1)} Wh (${pc(a.pct_bateria_max)}).`,
        <>
          <strong>Ningún viaje supera los {v.bateria_wh} Wh</strong>: cualquier viaje cabe en una sola carga.
        </>,
      ]}
      fuente="figuras/exploracion/T16_distribuciones y tablas/exploracion/T16_viaje_distribucion.csv"
    >
      <Grafica
        descripcion="Histograma de la energía por viaje"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          xaxis: { title: { text: "Energía por viaje (Wh)" }, range: [0, v.histograma.bordes_wh[v.histograma.bordes_wh.length - 1]] },
          yaxis: { title: { text: "Viajes" }, range: [0, alto] },
        }}
      />
    </Bloque>
  );
}

function BloquePatineteDia() {
  const { datos: d, error } = useDatos<PatineteDia>(`${FASE}/t16_patinete_dia`);
  if (!d) return <Cargando error={error} />;
  const a = d.tabla.find((t) => t.periodo === "ajuste")!;
  const alto = Math.max(...d.histograma.patinete_dias) * 1.18;
  const mitad = (d.bateria_wh * d.umbrales_pct[0]) / 100;
  const trazas: Data[] = [
    trazaEscalon({
      bordes: d.histograma.bordes_wh,
      cuentas: d.histograma.patinete_dias,
      nombre: "Patinete-día",
      color: COLOR.serie1,
      plantilla: "%{customdata[0]:.0f}–%{customdata[1]:.0f} Wh<br>%{y} patinete-día<extra></extra>",
    }),
    ...trazasUmbral(a.energia_wh_p50, alto * 0.86, `mediana ${num(a.energia_wh_p50, 1)} Wh`),
    ...trazasUmbral(mitad, alto * 0.6, `${d.umbrales_pct[0]} % de la batería`, "left"),
  ];
  return (
    <Bloque
      titulo="2. Energía por patinete y día"
      queMuestra="La energía que gasta cada patinete en cada día en que tiene viajes (un patinete-día), en el periodo de ajuste."
      porQue="Si un patinete gastara más de una batería en un día, habría que recargarlo dentro del día."
      conclusiones={[
        `Un patinete con viajes hace de media ${num(a.viajes_media, 1)} viajes al día y gasta ${num(a.energia_wh_media, 1)} Wh; el P95 es de ${num(a.energia_wh_p95, 1)} Wh y el máximo de ${num(a.energia_wh_max, 1)} Wh.`,
        <>
          Solo el {pc(a.pct_patinete_dias_sobre_50pct_bateria, 2)} de los patinete-día pasa del 50 % de la batería y{" "}
          <strong>ninguno del 80 %</strong>: no hace falta recargar dentro del día.
        </>,
      ]}
      fuente="figuras/exploracion/T16_distribuciones y tablas/exploracion/T16_patinete_dia_resumen.csv"
    >
      <Grafica
        descripcion="Histograma de la energía por patinete y día"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          xaxis: { title: { text: "Energía por patinete y día (Wh)" }, range: [0, d.histograma.bordes_wh[d.histograma.bordes_wh.length - 1]] },
          yaxis: { title: { text: "Patinete-día" }, range: [0, alto] },
        }}
      />
    </Bloque>
  );
}

function BloqueAutonomia({ ip }: { ip: Record<string, number> }) {
  const { datos: p, error } = useDatos<Patinete>(`${FASE}/t16_patinete`);
  if (!p) return <Cargando error={error} />;
  const pares = Object.entries(p.autonomia_percentiles_dias)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "lines+markers",
      x: pares.map(([, v]) => v),
      y: pares.map(([k]) => k),
      name: "Patinetes",
      line: { color: COLOR.serie1, width: 2, shape: "linear" },
      marker: { size: 7, color: COLOR.serie1, line: { color: "#fff", width: 1.5 } },
      hovertemplate: "El %{y} % de los patinetes agota la batería en %{x:.1f} días o menos<extra></extra>",
    } as Data,
    ...trazasUmbral(7, 100, "1 semana", "left"),
    ...trazasUmbral(21, 100, "periodo de ajuste", "right"),
  ];
  return (
    <Bloque
      titulo="3. Autonomía de cada patinete"
      queMuestra="Los días que tardaría cada patinete en gastar una batería completa con la energía media que gasta por día en servicio, como distribución acumulada."
      porQue="La distribución de la autonomía da la frecuencia de recarga necesaria. Se supone la batería completa utilizable y llena en el primer viaje del periodo."
      comoLeer="Cada punto es un percentil: el eje vertical dice qué parte de los patinetes agota la batería en los días del eje horizontal o menos. El eje horizontal es logarítmico."
      conclusiones={[
        `En el ajuste, un patinete recorre de media ${num(ip.km_ajuste_media, 1)} km y hace ${num(ip.ciclos_ajuste_media, 2)} ciclos equivalentes; el máximo es de ${num(ip.ciclos_ajuste_max, 3)} ciclos. Solo el ${pc(ip.pct_patinetes_agotan_en_ajuste)} agotaría la batería sin recargar en los 21 días.`,
        <>
          La autonomía mediana es de {num(ip.dias_autonomia_estimada_p50, 1)} días (P10 {num(ip.dias_autonomia_estimada_p10, 1)}; P90{" "}
          {num(ip.dias_autonomia_estimada_p90)}). <strong>Con el uso observado basta con recargar cada varios días.</strong>
        </>,
        "Con estaciones y una flota simulada menor, cada patinete hará más viajes y la autonomía bajará: hay que repetir el cálculo con la flota de la fase 1.",
      ]}
      fuente="tablas/exploracion/T16_patinete.csv y T16_patinete_resumen.csv"
    >
      <Grafica
        descripcion="Distribución acumulada de la autonomía de los patinetes en días"
        trazas={trazas}
        alto={340}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          xaxis: { type: "log", dtick: 1, exponentformat: "none", title: { text: "Días hasta agotar la batería" }, range: [0, Math.log10(5000)] },
          yaxis: { title: { text: "Patinetes (% acumulado)" }, range: [0, 112], ticksuffix: " %", tickvals: [0, 25, 50, 75, 100] },
        }}
      />
    </Bloque>
  );
}

function BloqueFlota({ i }: { i: Record<string, number> }) {
  const { datos: f, error } = useDatos<Flota>(`${FASE}/t16_flota_diaria`);
  if (!f) return <Cargando error={error} />;
  const barras = (periodo: string, nombre: string, color: string): Data => {
    const d = f.filter((x) => x.periodo === periodo);
    return {
      type: "bar",
      name: nombre,
      x: d.map((x) => x.fecha),
      y: d.map((x) => x.energia_kwh),
      customdata: d.map((x) => [num(x.km), num(x.cargas_completas_equivalentes, 1), x.patinetes_activos, x.viajes]),
      marker: { color },
      hovertemplate:
        "%{x|%A %d/%m}<br>%{y:.1f} kWh · %{customdata[0]} km<br>%{customdata[1]} cargas completas · %{customdata[2]} patinetes · %{customdata[3]} viajes<extra></extra>",
    } as Data;
  };
  const media = (periodo: string, valor: number, primera: boolean): Data => {
    const d = f.filter((x) => x.periodo === periodo);
    const x0 = new Date(d[0].fecha).getTime() - 12 * 3600 * 1000;
    const x1 = new Date(d[d.length - 1].fecha).getTime() + 12 * 3600 * 1000;
    return {
      type: "scatter",
      mode: "lines",
      x: [x0, x1],
      y: [valor, valor],
      name: "Media de cada periodo",
      legendgroup: "media",
      showlegend: primera,
      line: { color: COLOR.texto, width: 1.5, dash: "dash" },
      hovertemplate: `Media: ${num(valor, 1)} kWh/día<extra></extra>`,
    } as Data;
  };
  const trazas: Data[] = [
    barras("ajuste", "Periodo de ajuste", rgba(COLOR.serie1, 0.8)),
    barras("reservada", "Semana reservada", rgba(COLOR.serie2, 0.8)),
    media("ajuste", i.flota_kwh_dia_media_ajuste, true),
    media("reservada", i.flota_kwh_dia_media_reservada, false),
  ];
  return (
    <Bloque
      titulo="4. Energía de la flota por día"
      queMuestra="Los kWh que gasta cada día toda la flota y su equivalente en cargas completas de batería."
      porQue="Es la energía total que tendrán que reponer las estaciones y su variación de un día a otro."
      comoLeer="Pasa el ratón por un día para ver los km, las cargas completas equivalentes y los patinetes y viajes de ese día."
      conclusiones={[
        <>
          En el ajuste, la flota recorre de media {num(i.flota_km_dia_media_ajuste)} km al día y gasta{" "}
          <strong>{num(i.flota_kwh_dia_media_ajuste, 1)} kWh/día</strong> ({num(i.flota_cargas_dia_media_ajuste, 1)} cargas
          completas); el máximo es de {num(i.flota_kwh_dia_max_ajuste, 1)} kWh ({num(i.flota_cargas_dia_max_ajuste, 1)} cargas).
        </>,
        `En la semana reservada sube a ${num(i.flota_kwh_dia_media_reservada, 1)} kWh/día, en línea con el crecimiento de la demanda (T12 y T17).`,
      ]}
      fuente="figuras/exploracion/T16_flota_diaria y tablas/exploracion/T16_flota_diaria.csv"
    >
      <Grafica
        descripcion="Barras con la energía diaria de la flota en febrero de 2021"
        trazas={trazas}
        alto={340}
        capa={{
          bargap: 0.2,
          margin: { t: 8 },
          xaxis: { type: "date", tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01" },
          yaxis: { title: { text: "Energía de la flota (kWh/día)" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

function BloqueCeldas() {
  const { datos: c, error } = useDatos<Celdas>(`${FASE}/t16_celdas`);
  if (!c) return <Cargando error={error} />;
  const max = Math.max(...c.celdas.map((x) => x.kwh_dia));
  const trazas: Data[] = [
    trazaCeldas({
      celdas: c.celdas,
      z: c.celdas.map((x) => x.kwh_dia),
      escala: ESCALA_AZUL,
      zmin: 0,
      zmax: max,
      titulo: "kWh/día que llegan",
      customdata: c.celdas.map((x) => [x.rango, num(x.kwh_dia / 0.576, 2)]),
      plantilla: "%{location} (n.º %{customdata[0]})<br>%{z:.2f} kWh/día · %{customdata[1]} cargas completas<extra></extra>",
    }),
    trazaReferencias(REFERENCIAS_ROMA),
  ];
  return (
    <Bloque
      titulo="5. Energía por celda de destino"
      queMuestra={`Los kWh por día que llegan a cada celda H3 de resolución ${c.res} en el periodo de ajuste, suponiendo, como el plan, que el patinete se recarga donde se deja.`}
      porQue="Da el orden de magnitud de la energía que tendrá que reponer cada estación. Una estación cubrirá menos área que una celda de resolución 8."
      comoLeer="Pasa el ratón por una celda para ver su puesto en la clasificación y su equivalente en cargas completas de 576 Wh."
      conclusiones={[
        <>
          La celda que más energía recibe llega a <strong>{num(max, 2)} kWh/día</strong> (
          {num(max / 0.576, 1)} cargas completas); la mediana de las celdas es de 0,13 kWh/día. Una estación estará entre
          décimas de kWh y 1 kWh al día.
        </>,
        "47 de las 111 celdas reúnen el 80 % de la energía.",
      ]}
      fuente="figuras/exploracion/T16_energia_celdas y tablas/exploracion/T16_energia_celdas.csv"
    >
      <Grafica descripcion="Mapa de la energía diaria que llega a cada celda H3 de resolución 8" trazas={trazas} alto={460} capa={capaMapa()} />
    </Bloque>
  );
}

function BloquePerfil() {
  const { datos: p, error } = useDatos<Perfil>(`${FASE}/t16_perfil_horario`);
  if (!p) return <Cargando error={error} />;
  const [h0, h1] = p.horas_sol;
  const trazas: Data[] = [
    {
      type: "bar",
      x: p.horas.map((h) => h.hora + 0.5),
      y: p.horas.map((h) => h.energia_wh_dia),
      width: 0.85,
      customdata: p.horas.map((h) => [h.hora, h.hora + 1, num(h.pct_energia, 1), num(h.llegadas)]),
      marker: { color: p.horas.map((h) => (h.hora >= h0 && h.hora < h1 ? COLOR.serie3 : COLOR.serie1)) },
      hovertemplate: "%{customdata[0]}–%{customdata[1]} h<br>%{y:.0f} Wh/día (%{customdata[2]} % de la energía)<br>%{customdata[3]} llegadas en el periodo<extra></extra>",
    } as Data,
    trazaTexto((h0 + h1) / 2, Math.max(...p.horas.map((h) => h.energia_wh_dia)) * 1.04, `Horas de sol (${h0}–${h1} h): ${pc(p.reparto_pct.pct_energia_llega_10_16h)}`),
  ];
  const formas: Partial<Shape>[] = [
    { type: "rect", xref: "x", yref: "paper", x0: h0, x1: h1, y0: 0, y1: 1, fillcolor: COLOR.franja, line: { width: 0 }, layer: "below" },
  ];
  return (
    <Bloque
      titulo="6. Perfil horario de la energía que llega"
      queMuestra="La energía que llega a destino en cada hora del día, de media por día del periodo de ajuste."
      porQue="Si la recarga empieza al llegar, la energía que llega sin sol tendrá que salir de la batería de la estación: es una primera medida de cuánto tendrá que trabajar."
      comoLeer="Las barras verdes son las horas de sol que usa el notebook (10 a 16 h); las azules, el resto del día."
      conclusiones={[
        `El ${pc(p.reparto_pct.pct_energia_llega_10_16h, 2)} de la energía llega de 10 a 16 h, el ${pc(p.reparto_pct.pct_energia_llega_16_24h, 2)} de 16 a 24 h y el ${pc(p.reparto_pct.pct_energia_llega_resto, 2)} el resto del día.`,
        <>
          Con carga inmediata, la batería de la estación tendría que guardar unos dos tercios de la energía. La{" "}
          <strong>carga inteligente</strong> (aplazar la recarga a las horas de sol) es la alternativa que se estudiará en
          la fase 3.
        </>,
      ]}
      fuente="figuras/exploracion/T16_perfil_horario y tablas/exploracion/T16_perfil_horario.csv"
    >
      <Grafica
        descripcion="Barras con la energía que llega a destino en cada hora del día"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          shapes: formas as Shape[],
          xaxis: { title: { text: "Hora de llegada" }, range: [0, 24], tickvals: [0, 4, 8, 12, 16, 20, 24], ticksuffix: " h" },
          yaxis: { title: { text: "Energía que llega (Wh/día)" }, rangemode: "tozero" },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla por hora"
        cabeceras={["Hora", "Llegadas", "Wh/día", "% de la energía"]}
        numericas={[1, 2, 3]}
        filas={p.horas.map((h) => [`${h.hora}–${h.hora + 1} h`, num(h.llegadas), num(h.energia_wh_dia, 1), pc(h.pct_energia, 2)])}
      />
    </Bloque>
  );
}
