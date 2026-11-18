import { useState } from "react";
import type { Data, PlotMouseEvent } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { fecha, num, pc } from "../../formato";
import { COLOR, ESCALA_AZUL } from "../../graficas";

type Dia = {
  fecha: string;
  viajes: number;
  patinetes_activos: number;
  dia_semana: string;
  tipo_dia: TipoDia;
  periodo: string;
  media_movil: number | null;
};
type Serie = {
  dias: Dia[];
  corte_reservada: string;
  viajes_dia_media_ajuste: number;
  viajes_dia_media_reservada: number;
  tendencia_ajuste_viajes_por_dia: number;
  dia_minimo: string;
  viajes_dia_minimo: number;
};
type Perfil = {
  horas: number[];
  laborable: number[];
  fin_de_semana: number[];
  franjas: { nombre: string; desde: number; hasta: number }[];
  por_franja: {
    franja: string;
    horas: string;
    laborable_viajes_dia: number;
    fin_de_semana_viajes_dia: number;
    laborable_cuota_pc: number;
    fin_de_semana_cuota_pc: number;
  }[];
  viajes_dia_laborable_ajuste: number;
  viajes_dia_fin_de_semana_ajuste: number;
  hora_punta_laborable: number;
  hora_punta_fin_de_semana: number;
  diferencia_perfiles_laborable_finde_pc: number;
};
type Calor = { dias: string[]; horas: number[]; valores: number[][]; dias_por_semana: number[] };
type Simultaneos = {
  dias: { fecha: string; maximo: number; media: number; hora_maximo: string; periodo: string; tipo_dia: TipoDia; patinetes_activos: number }[];
  minutos_por_dia: Record<string, number[]>;
  simultaneos_max_ajuste: number;
  simultaneos_max_ajuste_dia: string;
  simultaneos_max_ajuste_hora: string;
  simultaneos_max_reservada: number;
  simultaneos_p99_minutos_ajuste: number;
  patinetes_activos_dia_media_ajuste: number;
  patinetes_activos_dia_max_ajuste: number;
  patinetes_mes: number;
};
type TipoDia = "laborable" | "fin_de_semana";

const FASE = "fase0";
const TIPOS: { tipo: TipoDia; nombre: string; color: string }[] = [
  { tipo: "laborable", nombre: "Laborable", color: COLOR.serie1 },
  { tipo: "fin_de_semana", nombre: "Fin de semana", color: COLOR.serie2 },
];
const EJE_FECHAS = { type: "date" as const, tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01" };

// Sombrea la semana reservada (22–28/02) en las gráficas por día. Las barras van centradas en
// cada fecha, así que la zona empieza medio día antes del corte y acaba medio día después del 28.
function zonaReservada(corte: string) {
  const desde = new Date(`${corte}T00:00:00Z`);
  desde.setUTCHours(-12);
  const inicio = desde.toISOString().slice(0, 19);
  return {
    shapes: [
      {
        type: "rect" as const,
        xref: "x" as const,
        yref: "paper" as const,
        x0: inicio,
        x1: "2021-02-28T12:00:00",
        y0: 0,
        y1: 1,
        fillcolor: COLOR.franja,
        line: { width: 0 },
        layer: "below" as const,
      },
    ],
    annotations: [
      {
        x: inicio,
        xref: "x" as const,
        yref: "paper" as const,
        y: 1,
        xanchor: "left" as const,
        yanchor: "bottom" as const,
        text: "Semana reservada",
        showarrow: false,
        font: { size: 11, color: COLOR.tenue },
      },
    ],
  };
}

export function T12() {
  const serie = useDatos<Serie>(`${FASE}/t12_serie_diaria`);
  const perfil = useDatos<Perfil>(`${FASE}/t12_perfil_horario`);
  const simult = useDatos<Simultaneos>(`${FASE}/t12_simultaneos`);
  const s = serie.datos;
  const p = perfil.datos;
  const m = simult.datos;
  return (
    <Seccion
      id="t12"
      tarea="T12"
      responsable="Javier Saguar"
      titulo="Patrones temporales y viajes simultáneos"
      notebook="exploracion/T12_temporal.ipynb"
      objetivo="Describir cuándo se viaja (por día, por hora y por tipo de día) y cuántos patinetes están en uso a la vez."
      valor="Fija las franjas horarias y los tipos de día de las matrices OD y del simulador, dice si la semana reservada es comparable con el periodo de ajuste y da una cota inferior de la flota."
    >
      {s && p && m ? (
        <Cifras
          cifras={[
            { valor: num(s.viajes_dia_media_ajuste, 1), nombre: "viajes al día en el ajuste", detalle: "1–21/02" },
            {
              valor: num(s.viajes_dia_media_reservada, 1),
              nombre: "viajes al día en la reservada",
              detalle: `${pc((100 * s.viajes_dia_media_reservada) / s.viajes_dia_media_ajuste - 100, 0)} más`,
            },
            {
              valor: pc(p.diferencia_perfiles_laborable_finde_pc),
              nombre: "diferencia de forma",
              detalle: "entre laborable y fin de semana",
            },
            {
              valor: num(m.simultaneos_max_ajuste),
              nombre: "viajes a la vez como máximo",
              detalle: `${fecha(m.simultaneos_max_ajuste_dia)} a las ${m.simultaneos_max_ajuste_hora}`,
            },
            {
              valor: num(m.patinetes_activos_dia_media_ajuste, 1),
              nombre: "patinetes usados al día",
              detalle: `de ${num(m.patinetes_mes)} en el mes`,
            },
          ]}
        />
      ) : (
        <Cargando error={serie.error ?? perfil.error ?? simult.error} />
      )}
      {s && <BloqueSerie s={s} />}
      {p && <BloquePerfil p={p} />}
      <BloqueCalor />
      {m && <BloqueSimultaneos m={m} />}
    </Seccion>
  );
}

function BloqueSerie({ s }: { s: Serie }) {
  const trazas: Data[] = [
    ...TIPOS.map(
      ({ tipo, nombre, color }) =>
        ({
          type: "bar",
          name: nombre,
          x: s.dias.filter((d) => d.tipo_dia === tipo).map((d) => d.fecha),
          y: s.dias.filter((d) => d.tipo_dia === tipo).map((d) => d.viajes),
          customdata: s.dias.filter((d) => d.tipo_dia === tipo).map((d) => [d.dia_semana, d.patinetes_activos]),
          marker: { color },
          hovertemplate: "%{customdata[0]} %{x|%d/%m}<br>%{y} viajes · %{customdata[1]} patinetes<extra></extra>",
        }) as Data,
    ),
    {
      type: "scatter",
      mode: "lines",
      name: "Media móvil de 7 días",
      x: s.dias.map((d) => d.fecha),
      y: s.dias.map((d) => d.media_movil),
      line: { color: COLOR.texto, width: 2 },
      connectgaps: false,
      hovertemplate: "Media móvil: %{y:.1f}<extra></extra>",
    } as Data,
  ];
  const dmin = s.dias.find((d) => d.fecha === s.dia_minimo)!;
  return (
    <Bloque
      titulo="1. Viajes por día"
      queMuestra="Viajes elegibles de cada día de febrero, separando laborables y fines de semana, con la media móvil de siete días. La zona sombreada es la semana reservada para validar."
      porQue="Si la demanda crece durante el mes, la semana reservada no es una muestra cualquiera y validar la red con ella es más exigente. Los días anómalos se explican con la meteorología (T17) antes de decidir si se quitan."
      conclusiones={[
        <>
          En el ajuste hay {num(s.viajes_dia_media_ajuste, 1)} viajes al día de media y en la semana reservada{" "}
          {num(s.viajes_dia_media_reservada, 1)} (
          <strong>+{num((100 * s.viajes_dia_media_reservada) / s.viajes_dia_media_ajuste - 100, 0)} %</strong>). La
          tendencia del ajuste es de +{num(s.tendencia_ajuste_viajes_por_dia, 1)} viajes al día por cada día.
        </>,
        "La semana reservada es más exigente que el periodo de ajuste: la red se validará con más demanda de la que se usó para diseñarla, y hay que decirlo en la memoria.",
        `El día con menos viajes es el ${dmin.dia_semana} ${fecha(dmin.fecha)} (${num(s.viajes_dia_minimo)}), la mitad que el sábado anterior. Pendiente de cruzarlo con la lluvia en T17.`,
      ]}
      fuente="tablas/exploracion/T12_viajes_diarios.csv"
    >
      <Grafica
        descripcion="Barras de viajes por día de febrero de 2021 con la media móvil de siete días"
        trazas={trazas}
        capa={{
          ...zonaReservada(s.corte_reservada),
          bargap: 0.25,
          margin: { t: 30 },
          legend: { y: 1.1 },
          xaxis: EJE_FECHAS,
          yaxis: { title: { text: "Viajes elegibles por día" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

function BloquePerfil({ p }: { p: Perfil }) {
  const [modo, setModo] = useState<"viajes" | "cuota">("viajes");
  const valores = (v: number[]) => {
    const total = v.reduce((a, b) => a + b, 0);
    return modo === "cuota" ? v.map((x) => (100 * x) / total) : v;
  };
  const trazas: Data[] = TIPOS.map(
    ({ tipo, nombre, color }) =>
      ({
        type: "scatter",
        mode: "lines",
        name: nombre,
        x: [...p.horas, 24],
        y: [...valores(p[tipo]), valores(p[tipo])[23]],
        line: { shape: "hv", color, width: 2.5 },
        hovertemplate:
          modo === "cuota"
            ? `${nombre}: %{y:.1f} % de los viajes del día<extra></extra>`
            : `${nombre}: %{y:.1f} viajes<extra></extra>`,
      }) as Data,
  );
  const franjas = {
    shapes: p.franjas.map((f, i) => ({
      type: "rect" as const,
      xref: "x" as const,
      yref: "paper" as const,
      x0: f.desde,
      x1: f.hasta,
      y0: 0,
      y1: 1,
      fillcolor: i % 2 ? COLOR.franja : "rgba(0,0,0,0)",
      line: { width: 0 },
      layer: "below" as const,
    })),
    annotations: p.franjas.map((f) => ({
      x: (f.desde + f.hasta) / 2,
      xref: "x" as const,
      yref: "paper" as const,
      y: 1,
      yanchor: "bottom" as const,
      text: f.nombre,
      showarrow: false,
      font: { size: 11, color: COLOR.tenue },
    })),
  };
  const fila = (n: string) => p.por_franja.find((x) => x.franja === n)!;
  return (
    <Bloque
      titulo="2. Perfil horario por tipo de día y franjas"
      queMuestra="Viajes que salen en cada hora en un laborable medio y en un fin de semana medio del periodo de ajuste, sobre las cinco franjas horarias de config.yaml."
      porQue="Las matrices OD y el simulador trabajan por franja y tipo de día. Si los dos tipos de día tuvieran la misma forma bastaría con una matriz; si no, hay que separarlos. Las franjas deben agrupar horas con un comportamiento parecido."
      comoLeer="En cuota se compara la forma de los dos perfiles: qué parte de los viajes del día sale en cada hora."
      conclusiones={[
        `Laborables y fines de semana tienen el mismo volumen diario (${num(p.viajes_dia_laborable_ajuste, 1)} frente a ${num(p.viajes_dia_fin_de_semana_ajuste, 1)} viajes) pero distinta forma: los perfiles difieren en un ${pc(p.diferencia_perfiles_laborable_finde_pc)} de los viajes.`,
        `El laborable tiene una punta de mañana de 7 a 10 h (${pc(fila("punta_manana").laborable_cuota_pc)} de sus viajes frente al ${pc(fila("punta_manana").fin_de_semana_cuota_pc)} en fin de semana) y su máximo a las ${p.hora_punta_laborable} h. El fin de semana empieza tarde y concentra más en la punta de tarde (${pc(fila("punta_tarde").fin_de_semana_cuota_pc)} frente a ${pc(fila("punta_tarde").laborable_cuota_pc)}), con el máximo a las ${p.hora_punta_fin_de_semana} h.`,
        <>
          Las franjas provisionales caen donde cambia el perfil, así que <strong>se fijan como definitivas</strong>. Las
          matrices OD y el simulador se separan por tipo de día.
        </>,
      ]}
      fuente="tablas/exploracion/T12_perfil_horario.csv y T12_franjas.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Escala"
          valor={modo}
          cambiar={setModo}
          opciones={[
            { valor: "viajes", texto: "Viajes por hora" },
            { valor: "cuota", texto: "Cuota del día (%)" },
          ]}
        />
      </div>
      <Grafica
        descripcion="Perfil horario de salidas en laborable y en fin de semana con las franjas horarias"
        trazas={trazas}
        capa={{
          ...franjas,
          hovermode: "x unified",
          margin: { t: 28 },
          legend: { y: 1.12 },
          xaxis: { range: [0, 24], dtick: 2, title: { text: "Hora de salida" }, hoverformat: ".0f", ticksuffix: " h" },
          yaxis: {
            title: { text: modo === "cuota" ? "% de los viajes del día" : "Viajes por hora y día" },
            rangemode: "tozero",
          },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla por franja"
        cabeceras={["Franja", "Horas", "Laborable (viajes/día)", "Fin de semana (viajes/día)", "Laborable (%)", "Fin de semana (%)"]}
        numericas={[2, 3, 4, 5]}
        filas={p.por_franja.map((f) => [
          p.franjas.find((x) => `${x.desde}-${x.hasta}` === f.horas)?.nombre ?? f.franja,
          f.horas.replace("-", "–") + " h",
          num(f.laborable_viajes_dia, 1),
          num(f.fin_de_semana_viajes_dia, 1),
          pc(f.laborable_cuota_pc),
          pc(f.fin_de_semana_cuota_pc),
        ])}
      />
    </Bloque>
  );
}

function BloqueCalor() {
  const { datos: c, error } = useDatos<Calor>(`${FASE}/t12_calor`);
  if (!c) return <Cargando error={error} />;
  const trazas: Data[] = [
    {
      type: "heatmap",
      z: c.valores,
      x: c.horas,
      y: c.dias,
      colorscale: ESCALA_AZUL,
      xgap: 2,
      ygap: 2,
      colorbar: { title: { text: "Viajes<br>por hora", font: { size: 11 } }, thickness: 12, outlinewidth: 0, tickfont: { size: 11 } },
      hovertemplate: "%{y}, de %{x} a %{x}:59 h<br>%{z:.1f} viajes de media<extra></extra>",
    } as Data,
  ];
  const totales = c.valores.map((fila) => fila.reduce((a, b) => a + b, 0));
  const masFlojo = c.dias[totales.indexOf(Math.min(...totales))];
  return (
    <Bloque
      titulo="3. Día de la semana × hora"
      queMuestra="Viajes medios en cada hora de cada día de la semana del periodo de ajuste. Cuanto más oscura la celda, más viajes."
      porQue="Comprueba si basta con dos tipos de día o si algún día (por ejemplo el viernes por la noche) se comporta distinto y merecería su propio escenario en el simulador."
      comoLeer={`Cada día de la semana aparece solo ${c.dias_por_semana[0]} veces en el ajuste, así que un día con lluvia pesa mucho en su fila.`}
      conclusiones={[
        "De lunes a viernes el patrón se repite: punta de mañana entre las 8 y las 10 h (máximo de 9 a 10 h), un bajón a media mañana y punta de tarde entre las 17 y las 20 h.",
        `El sábado no tiene punta de mañana y tiene la tarde más fuerte del periodo (${num(c.valores[5][16])} viajes de 16 a 17 h). Viernes y sábado son los días con más viajes (unos ${num(Math.round((totales[4] + totales[5]) / 10) * 5)}) y el ${masFlojo} el que menos (${num(Math.min(...totales))}).`,
        <>
          Con tres repeticiones por día no hay base para más tipos de día: se mantienen <strong>laborable y fin de semana</strong>.
        </>,
      ]}
      fuente="tablas/exploracion/T12_calor_dia_hora.csv"
    >
      <Grafica
        descripcion="Mapa de calor de viajes medios por hora y día de la semana"
        trazas={trazas}
        alto={340}
        capa={{
          margin: { t: 8 },
          xaxis: { dtick: 2, title: { text: "Hora de salida" }, ticksuffix: " h", showgrid: false },
          yaxis: { autorange: "reversed", showgrid: false, ticks: "" },
        }}
      />
    </Bloque>
  );
}

function BloqueSimultaneos({ m }: { m: Simultaneos }) {
  const [dia, setDia] = useState(m.simultaneos_max_ajuste_dia);
  const info = m.dias.find((d) => d.fecha === dia)!;
  const minutos = m.minutos_por_dia[dia];
  const horas = minutos.map((_, i) => i / 60);
  const iMax = minutos.indexOf(Math.max(...minutos));
  const barras: Data[] = TIPOS.map(
    ({ tipo, nombre, color }) =>
      ({
        type: "bar",
        name: nombre,
        x: m.dias.filter((d) => d.tipo_dia === tipo).map((d) => d.fecha),
        y: m.dias.filter((d) => d.tipo_dia === tipo).map((d) => d.maximo),
        customdata: m.dias.filter((d) => d.tipo_dia === tipo).map((d) => d.hora_maximo),
        marker: {
          color,
          opacity: m.dias.filter((d) => d.tipo_dia === tipo).map((d) => (d.fecha === dia ? 1 : 0.45)),
        },
        hovertemplate: "%{x|%d/%m}: máximo de %{y} viajes a las %{customdata}<extra></extra>",
      }) as Data,
  );
  const curva: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: horas,
      y: minutos,
      line: { color: info.tipo_dia === "laborable" ? COLOR.serie1 : COLOR.serie2, width: 1.5 },
      fill: "tozeroy",
      fillcolor: info.tipo_dia === "laborable" ? "rgba(42,120,214,0.15)" : "rgba(235,104,52,0.15)",
      customdata: minutos.map((_, i) => `${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`),
      hovertemplate: "%{customdata}: %{y} viajes en curso<extra></extra>",
      showlegend: false,
    } as Data,
    {
      type: "scatter",
      mode: "text+markers",
      x: [horas[iMax]],
      y: [minutos[iMax]],
      text: [`máximo: ${minutos[iMax]}`],
      textposition: "top center",
      marker: { size: 9, color: COLOR.texto },
      hoverinfo: "skip",
      showlegend: false,
      cliponaxis: false,
    } as Data,
  ];
  const elegir = (e: PlotMouseEvent) => {
    const x = e.points?.[0]?.x;
    if (typeof x === "string") setDia(x.slice(0, 10));
  };
  return (
    <Bloque
      titulo="4. Viajes simultáneos"
      queMuestra="Arriba, el máximo diario de viajes en curso a la vez. Abajo, los viajes en curso minuto a minuto del día elegido."
      porQue="El máximo de viajes a la vez es una cota inferior de la flota: nunca hacen falta menos patinetes que viajes en curso. Comparado con los patinetes del piloto dice si la flota está limitada por el uso simultáneo o por tener los patinetes en el sitio adecuado."
      comoLeer="Haz clic en una barra o elige un día en la lista para ver su curva."
      conclusiones={[
        <>
          Como mucho hay <strong>{m.simultaneos_max_ajuste} viajes en curso a la vez</strong> en el ajuste (
          {fecha(m.simultaneos_max_ajuste_dia)} a las {m.simultaneos_max_ajuste_hora}) y {m.simultaneos_max_reservada} en la
          semana reservada. En el 99 % de los minutos hay {num(m.simultaneos_p99_minutos_ajuste)} o menos.
        </>,
        `Cada día se usan de media ${num(m.patinetes_activos_dia_media_ajuste, 1)} patinetes distintos (máximo ${num(m.patinetes_activos_dia_max_ajuste)}) de los ${num(m.patinetes_mes)} que aparecen en viajes elegibles.`,
        <>
          La cota inferior de {m.simultaneos_max_ajuste} está muy lejos de la flota observada:{" "}
          <strong>el tamaño de flota no lo decide el uso simultáneo sino tener patinetes en cada estación cuando se piden</strong>. La
          simulación de inventario por estación de la fase 1 es la que manda.
        </>,
      ]}
      fuente="tablas/exploracion/T12_simultaneos_diarios.csv"
    >
      <Grafica
        descripcion="Barras con el máximo diario de viajes simultáneos; al hacer clic se elige el día"
        trazas={barras}
        alto={230}
        alClic={elegir}
        capa={{
          ...zonaReservada("2021-02-22"),
          barmode: "overlay",
          bargap: 0.25,
          margin: { t: 30 },
          legend: { y: 1.16 },
          xaxis: EJE_FECHAS,
          yaxis: { title: { text: "Máximo diario" }, rangemode: "tozero" },
        }}
      />
      <div className="controles" style={{ marginTop: 12 }}>
        <label>
          Día{" "}
          <select value={dia} onChange={(e) => setDia(e.target.value)}>
            {m.dias.map((d) => (
              <option key={d.fecha} value={d.fecha}>
                {fecha(d.fecha)} · {d.tipo_dia === "laborable" ? "laborable" : "fin de semana"}
                {d.periodo === "reservada" ? " · reservada" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="lectura">
          Máximo de {info.maximo} a las {info.hora_maximo} · media de {num(info.media, 1)} · {num(info.patinetes_activos)} patinetes
          usados
        </span>
      </div>
      <Grafica
        descripcion={`Viajes en curso minuto a minuto el ${fecha(dia)}`}
        trazas={curva}
        alto={260}
        capa={{
          margin: { t: 24 },
          xaxis: { range: [0, 24], dtick: 2, ticksuffix: " h", title: { text: "Hora" } },
          yaxis: { title: { text: "Viajes en curso" }, rangemode: "tozero", range: [0, m.simultaneos_max_reservada * 1.15] },
        }}
      />
    </Bloque>
  );
}
