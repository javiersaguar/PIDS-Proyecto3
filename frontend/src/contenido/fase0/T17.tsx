import type { Data, Shape } from "plotly.js-dist-min";
import { useState } from "react";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { TIPO_DIA, fecha, indicadores, num, pc } from "../../formato";
import { COLOR, rgba, trazaTexto } from "../../graficas";

type Dia = {
  fecha: string;
  dia_semana: string;
  tipo_dia: string;
  periodo: string;
  viajes: number;
  horas_lluvia: number;
  lluvia_mm: number;
  temp_media_c: number;
  viento_max_kmh: number;
  mediana_tipo_dia: number;
  pct_mediana_tipo_dia: number;
  anomalo: boolean;
};
type Serie = { dias: Dia[]; tendencia_ajuste: { ordenada: number; pendiente: number } };
type Correlacion = { variable: string; grupo: string; n: number; spearman_rho: number; p_valor: number }[];
type Lluvia = {
  horas: { fecha: string; hora: number; tipo_dia: string; precipitacion_mm: number; viajes: number; horas_referencia: number; viajes_esperados: number; cociente: number }[];
  resumen: { grupo: string; horas_lluvia: number; viajes: number; viajes_esperados: number; cociente_agregado: number }[];
};
type Tendencia = {
  modelos: { modelo: string; periodo: string; n: number; pendiente_viajes_dia_por_dia: number; pendiente_ee: number; pendiente_pct_media_por_semana: number; r2: number }[];
  semana: { dia_semana: string; viajes_media_ajuste: number; viajes_reservada: number; cociente_reservada_ajuste: number }[];
};
type Indicadores = { indicador: string; valor: number | string }[];
type Viento = {
  diario: {
    variable: string;
    grupo: string;
    n: number;
    rho_viajes: number;
    rho_con_lluvia: number;
    rho_parcial_sin_lluvia: number;
    rho_parcial_sin_horas_lluvia: number;
    rho_lluvia_parcial_sin_viento: number;
    rho_quitando_un_dia_min: number;
    rho_quitando_un_dia_max: number;
  }[];
  fines_de_semana: { fecha: string; dia_semana: string; viajes: number; precipitacion_mm: number; horas_lluvia: number; viento_max_kmh: number; racha_max_kmh: number; temp_media_c: number }[];
  horario: { tipo_dia: string; modelo: string; horas: number; efecto: string; pct: number; pct_inf: number; pct_sup: number }[];
  horas_secas: { tipo_dia: string; horas: number; dias: number; viajes: number; viajes_esperados: number; cociente: number }[];
  dias_ventosos: { fecha: string; tipo_dia: string; horas: number }[];
  umbrales: { viento_kmh: number; calma_kmh: number };
};

const FASE = "fase0";
const COLOR_DIA: Record<string, string> = { laborable: COLOR.serie1, fin_de_semana: COLOR.serie2 };
const MEDIO_DIA = 12 * 3600 * 1000;
const RESERVADA = { x0: new Date("2021-02-22").getTime() - MEDIO_DIA, x1: new Date("2021-02-28").getTime() + MEDIO_DIA };

export function T17() {
  const { datos: r, error } = useDatos<Indicadores>(`${FASE}/t17_resumen`);
  const { datos: c } = useDatos<Correlacion>(`${FASE}/t17_correlaciones`);
  const { datos: l } = useDatos<Lluvia>(`${FASE}/t17_lluvia_horaria`);
  const i = r ? indicadores(r) : null;
  const rho = c?.find((x) => x.variable === "precipitacion_mm" && x.grupo === "todos");
  const todas = l?.resumen.find((x) => x.grupo === "todos");
  return (
    <Seccion
      id="t17"
      tarea="T17"
      responsable="Alejandro Cuevas"
      titulo="Meteorología frente a demanda y días anómalos"
      notebook="exploracion/T17_meteorologia.ipynb"
      objetivo="Ver si la lluvia, la temperatura y el viento explican los días con pocos viajes y el crecimiento de la demanda a lo largo del mes."
      valor="Decide si se excluye algún día del análisis y si la semana reservada es comparable con el periodo de ajuste. Si la demanda crece por algo que no es el tiempo, la validación temporal es más exigente."
    >
      {i && rho && todas ? (
        <Cifras
          cifras={[
            { valor: `${num(i.lluvia_total_ajuste_mm, 1)} mm`, nombre: "de lluvia en el ajuste", detalle: `${num(i.lluvia_total_reservada_mm)} mm en la semana reservada` },
            { valor: num(rho.spearman_rho, 2), nombre: "Spearman viajes–lluvia", detalle: `diaria, n = ${rho.n}` },
            { valor: pc(100 * todas.cociente_agregado, 0), nombre: "de los viajes esperados", detalle: `en las ${todas.horas_lluvia} horas con lluvia` },
            { valor: "07/02", nombre: "único día anómalo", detalle: "domingo con 24,6 mm de lluvia" },
            { valor: `+${pc(100 * (i.viajes_dia_media_reservada / i.viajes_dia_media_ajuste - 1))}`, nombre: "viajes en la reservada", detalle: "por día, frente al ajuste" },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <p className="fuente">
        Datos meteorológicos de la API histórica de Open-Meteo para Roma centro (modelo best_match con ECMWF IFS, ERA5 y
        ERA5-Land; licencia CC BY 4.0), guardados en <code>datos/externos/meteorologia/</code>. Viajes elegibles del mes
        completo: con 28 días, las asociaciones son orientativas.
      </p>
      <BloqueSerie />
      <BloqueCorrelaciones />
      <BloqueHorasLluvia />
      <BloqueAnomalos />
      <BloqueSemana />
      <BloqueViento />
    </Seccion>
  );
}

function BloqueSerie() {
  const { datos: s, error } = useDatos<Serie>(`${FASE}/t17_serie`);
  if (!s) return <Cargando error={error} />;
  const d = s.dias;
  const ajuste = d.filter((x) => x.periodo === "ajuste");
  const puntos = (tipo: string): Data => {
    const f = d.filter((x) => x.tipo_dia === tipo);
    return {
      type: "scatter",
      mode: "markers",
      name: TIPO_DIA[tipo],
      x: f.map((x) => x.fecha),
      y: f.map((x) => x.viajes),
      customdata: f.map((x) => [x.lluvia_mm, x.horas_lluvia, x.temp_media_c]),
      marker: { size: 9, color: COLOR_DIA[tipo], line: { color: "#fff", width: 2 } },
      hovertemplate: `%{x|%A %d/%m}: %{y} viajes<br>%{customdata[0]} mm en %{customdata[1]} h · %{customdata[2]:.1f} °C<extra></extra>`,
    } as Data;
  };
  const t = s.tendencia_ajuste;
  const anomalo = d.find((x) => x.anomalo)!;
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: d.map((x) => x.fecha),
      y: d.map((x) => x.viajes),
      line: { color: COLOR.eje, width: 1.3 },
      hoverinfo: "skip",
      showlegend: false,
    } as Data,
    {
      type: "scatter",
      mode: "lines",
      name: "Tendencia del ajuste",
      x: [ajuste[0].fecha, ajuste[ajuste.length - 1].fecha],
      y: [t.ordenada, t.ordenada + t.pendiente * (ajuste.length - 1)],
      line: { color: COLOR.texto, width: 1.3, dash: "dash" },
      hoverinfo: "skip",
    } as Data,
    puntos("laborable"),
    puntos("fin_de_semana"),
    trazaTexto(anomalo.fecha, anomalo.viajes, `${fecha(anomalo.fecha)}: ${anomalo.viajes} viajes`, "bottom right"),
    {
      type: "bar",
      name: "Lluvia",
      x: d.map((x) => x.fecha),
      y: d.map((x) => x.lluvia_mm),
      yaxis: "y2",
      marker: { color: rgba(COLOR.serie3, 0.85) },
      hovertemplate: "%{x|%d/%m}: %{y:.1f} mm<extra></extra>",
    } as Data,
  ];
  const formas: Partial<Shape>[] = [
    { type: "rect", xref: "x", yref: "paper", x0: RESERVADA.x0, x1: RESERVADA.x1, y0: 0, y1: 1, fillcolor: COLOR.zonaExcluida, line: { width: 0 }, layer: "below" },
  ];
  const lluviosos = d.filter((x) => x.lluvia_mm > 5 && !x.anomalo).map((x) => fecha(x.fecha));
  return (
    <Bloque
      titulo="1. Viajes diarios y lluvia"
      queMuestra="Los viajes de cada día del mes, separados en laborables y fines de semana, con la tendencia del periodo de ajuste y, debajo, la lluvia diaria."
      porQue="Si los días con pocos viajes coinciden con la lluvia, son días reales de baja demanda y no errores; si el crecimiento no sigue al tiempo, hay otra causa."
      comoLeer="Las dos gráficas comparten el eje de fechas. La zona sombreada es la semana reservada (22–28/02)."
      conclusiones={[
        "La lluvia se concentra en la primera mitad del mes: 75,7 mm en el ajuste, con 6 días de más de 1 mm, y ninguna en la semana reservada.",
        `El día con menos viajes, el domingo ${fecha(anomalo.fecha)}, es el de más lluvia (${num(anomalo.lluvia_mm, 1)} mm). Los otros días con más de 5 mm (${lluviosos.join(", ")}) también quedan por debajo de la tendencia.`,
      ]}
      fuente="figuras/exploracion/T17_viajes_lluvia y tablas/exploracion/T17_serie_diaria.csv"
    >
      <Grafica
        descripcion="Viajes diarios por tipo de día con la tendencia del ajuste y la lluvia diaria debajo"
        trazas={trazas}
        alto={430}
        capa={{
          hovermode: "closest",
          margin: { t: 8 },
          shapes: formas as Shape[],
          xaxis: { type: "date", anchor: "y2", tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01", range: ["2021-01-31 12:00", "2021-02-28 12:00"] },
          yaxis: { domain: [0.36, 1], title: { text: "Viajes al día" }, rangemode: "tozero" },
          yaxis2: { domain: [0, 0.26], title: { text: "Lluvia (mm)" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

const VARIABLES: Record<string, string> = {
  precipitacion_mm: "Lluvia diaria",
  horas_lluvia: "Horas de lluvia",
  temp_media_c: "Temperatura media",
  viento_max_kmh: "Viento máximo",
};
const GRUPOS: Record<string, [string, string]> = {
  todos: ["Todos los días", COLOR.serie1],
  laborable: ["Laborables", COLOR.serie2],
  fin_de_semana: ["Fines de semana", COLOR.serie3],
};

function BloqueCorrelaciones() {
  const { datos: c, error } = useDatos<Correlacion>(`${FASE}/t17_correlaciones`);
  if (!c) return <Cargando error={error} />;
  const variables = Object.keys(VARIABLES);
  const trazas: Data[] = Object.entries(GRUPOS).map(([g, [nombre, color]]) => {
    const f = variables.map((v) => c.find((x) => x.variable === v && x.grupo === g)!);
    return {
      type: "bar",
      orientation: "h",
      name: nombre,
      y: variables.map((v) => VARIABLES[v]),
      x: f.map((x) => x.spearman_rho),
      customdata: f.map((x) => [x.n, num(x.p_valor, 4)]),
      marker: { color },
      hovertemplate: `${nombre} · %{y}<br>Spearman %{x:.2f} (n = %{customdata[0]}, p = %{customdata[1]})<extra></extra>`,
    } as Data;
  });
  const v = (variable: string, grupo: string) => c.find((x) => x.variable === variable && x.grupo === grupo)!;
  return (
    <Bloque
      titulo="2. Correlación de los viajes diarios con el tiempo"
      queMuestra="La correlación de Spearman entre los viajes de cada día y la lluvia, las horas de lluvia, la temperatura media y el viento máximo, en todo el mes y por tipo de día."
      porQue="Mide la asociación sin suponer una relación lineal. Con 28 días, y solo 8 de fin de semana, es una indicación, no una prueba."
      comoLeer="Una barra a la izquierda del cero quiere decir que hay menos viajes cuanto mayor es la variable. Pasa el ratón para ver el tamaño de la muestra y el p-valor."
      conclusiones={[
        `Los viajes bajan con la lluvia: Spearman de ${num(v("precipitacion_mm", "todos").spearman_rho, 2)} con la lluvia diaria y de ${num(v("horas_lluvia", "todos").spearman_rho, 2)} con las horas de lluvia (n = 28). En laborables es ${num(v("precipitacion_mm", "laborable").spearman_rho, 2)} (n = 20).`,
        `La temperatura media no se asocia con los viajes (${num(v("temp_media_c", "todos").spearman_rho, 2)}): en febrero de 2021 varió poco y no explica la demanda.`,
      ]}
      fuente="figuras/exploracion/T17_dispersion y tablas/exploracion/T17_correlaciones.csv"
    >
      <Grafica
        descripcion="Barras con la correlación de Spearman de los viajes diarios con cada variable meteorológica"
        trazas={trazas}
        alto={360}
        capa={{
          barmode: "group",
          bargap: 0.25,
          bargroupgap: 0.06,
          margin: { t: 8 },
          xaxis: { title: { text: "Correlación de Spearman con los viajes diarios" }, range: [-1, 1], zeroline: true, zerolinecolor: COLOR.texto, dtick: 0.25 },
          yaxis: { autorange: "reversed" },
        }}
      />
    </Bloque>
  );
}

function BloqueHorasLluvia() {
  const { datos: l, error } = useDatos<Lluvia>(`${FASE}/t17_lluvia_horaria`);
  if (!l) return <Cargando error={error} />;
  const max = Math.max(...l.horas.map((h) => Math.max(h.viajes, h.viajes_esperados))) * 1.05;
  const puntos = (tipo: string): Data => {
    const f = l.horas.filter((h) => h.tipo_dia === tipo);
    return {
      type: "scatter",
      mode: "markers",
      name: TIPO_DIA[tipo],
      x: f.map((h) => h.viajes_esperados),
      y: f.map((h) => h.viajes),
      customdata: f.map((h) => [fecha(h.fecha), h.hora, h.hora + 1, num(h.precipitacion_mm, 1), h.horas_referencia, num(h.cociente, 2)]),
      marker: { size: 9, color: COLOR_DIA[tipo], line: { color: "#fff", width: 1.5 } },
      hovertemplate:
        "%{customdata[0]}, %{customdata[1]}–%{customdata[2]} h · %{customdata[3]} mm<br>%{y} viajes frente a %{x:.1f} esperados (×%{customdata[5]})<br>referencia: %{customdata[4]} horas secas<extra></extra>",
    } as Data;
  };
  const r = (g: string) => l.resumen.find((x) => x.grupo === g)!;
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: [0, max],
      y: [0, max],
      name: "Como sin lluvia",
      line: { color: COLOR.eje, width: 1.3, dash: "dot" },
      hoverinfo: "skip",
    } as Data,
    puntos("laborable"),
    puntos("fin_de_semana"),
  ];
  return (
    <Bloque
      titulo="3. Viajes en las horas con lluvia"
      queMuestra="Los viajes de cada hora con más de 0,1 mm de lluvia, de 7 a 23 h, frente a los esperados: la media de la misma hora y tipo de día sin lluvia en los 7 días de alrededor."
      porQue="Mide el efecto de la lluvia hora a hora con una referencia cercana en el tiempo, para no confundirlo con el crecimiento del mes."
      comoLeer="Un punto por debajo de la diagonal es una hora con menos viajes de los esperados."
      conclusiones={[
        `En las ${r("todos").horas_lluvia} horas con lluvia hubo el ${pc(100 * r("todos").cociente_agregado, 0)} de los viajes esperados: el ${pc(100 * r("laborable").cociente_agregado, 0)} en laborables y solo el ${pc(100 * r("fin_de_semana").cociente_agregado, 0)} en fin de semana.`,
        "La lluvia reduce mucho más los viajes del fin de semana que los de los laborables, en los que la mayoría se mantiene.",
      ]}
      fuente="tablas/exploracion/T17_lluvia_horaria.csv y T17_lluvia_horaria_resumen.csv"
    >
      <Grafica
        descripcion="Dispersión de los viajes observados frente a los esperados en las horas con lluvia"
        trazas={trazas}
        alto={360}
        capa={{
          hovermode: "closest",
          margin: { t: 8 },
          xaxis: { title: { text: "Viajes esperados sin lluvia" }, range: [0, max] },
          yaxis: { title: { text: "Viajes observados" }, range: [0, max] },
        }}
      />
    </Bloque>
  );
}

function BloqueAnomalos() {
  const { datos: s, error } = useDatos<Serie>(`${FASE}/t17_serie`);
  if (!s) return <Cargando error={error} />;
  const d = s.dias;
  const trazas: Data[] = (["laborable", "fin_de_semana"] as const).map((tipo) => {
    const f = d.filter((x) => x.tipo_dia === tipo);
    return {
      type: "bar",
      name: TIPO_DIA[tipo],
      x: f.map((x) => x.fecha),
      y: f.map((x) => x.pct_mediana_tipo_dia),
      customdata: f.map((x) => [x.viajes, num(x.mediana_tipo_dia, 1), num(x.lluvia_mm, 1), x.horas_lluvia]),
      marker: { color: f.map((x) => (x.anomalo ? COLOR.texto : COLOR_DIA[tipo])) },
      hovertemplate:
        "%{x|%A %d/%m}: %{y:.1f} % de la mediana<br>%{customdata[0]} viajes; mediana del tipo de día %{customdata[1]}<br>%{customdata[2]} mm en %{customdata[3]} h<extra></extra>",
    } as Data;
  });
  const a = d.find((x) => x.anomalo)!;
  const formas: Partial<Shape>[] = [
    { type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: 70, y1: 70, line: { color: COLOR.texto, width: 1.3, dash: "dash" } },
    { type: "rect", xref: "x", yref: "paper", x0: RESERVADA.x0, x1: RESERVADA.x1, y0: 0, y1: 1, fillcolor: COLOR.zonaExcluida, line: { width: 0 }, layer: "below" },
  ];
  return (
    <Bloque
      titulo="4. Días anómalos"
      queMuestra="Los viajes de cada día como porcentaje de la mediana de su tipo de día (laborable o fin de semana), con el umbral del 70 %."
      porQue="Decide si algún día se quita del análisis o se trata aparte en el simulador."
      comoLeer="La línea discontinua es el umbral del 70 %; la barra oscura, el único día por debajo. La zona sombreada es la semana reservada."
      conclusiones={[
        <>
          Solo el <strong>{fecha(a.fecha)}</strong> está por debajo del 70 %: {a.viajes} viajes, el {pc(a.pct_mediana_tipo_dia)} de la
          mediana de los fines de semana, con {num(a.lluvia_mm, 1)} mm y {a.horas_lluvia} horas de lluvia.
        </>,
        "Es demanda real de un día de lluvia: no se excluye, pero no debe usarse como día de diseño ni como día tipo.",
      ]}
      fuente="tablas/exploracion/T17_dias_anomalos.csv y T17_serie_diaria.csv"
    >
      <Grafica
        descripcion="Barras con los viajes de cada día como porcentaje de la mediana de su tipo de día"
        trazas={trazas}
        alto={330}
        capa={{
          bargap: 0.2,
          margin: { t: 8 },
          shapes: formas as Shape[],
          xaxis: { type: "date", tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01" },
          yaxis: { title: { text: "% de la mediana de su tipo de día" }, rangemode: "tozero", ticksuffix: " %" },
        }}
      />
    </Bloque>
  );
}

function BloqueSemana() {
  const { datos: t, error } = useDatos<Tendencia>(`${FASE}/t17_tendencia`);
  if (!t) return <Cargando error={error} />;
  const dias = t.semana.filter((x) => x.dia_semana !== "semana");
  const media = t.semana.find((x) => x.dia_semana === "semana")!;
  const nombre = (d: string) => d[0].toUpperCase() + d.slice(1);
  const trazas: Data[] = [
    {
      type: "bar",
      name: "Media del ajuste (3 semanas)",
      x: dias.map((x) => nombre(x.dia_semana)),
      y: dias.map((x) => x.viajes_media_ajuste),
      marker: { color: COLOR.serie1 },
      hovertemplate: "%{x}: %{y:.0f} viajes de media en el ajuste<extra></extra>",
    } as Data,
    {
      type: "bar",
      name: "Semana reservada",
      x: dias.map((x) => nombre(x.dia_semana)),
      y: dias.map((x) => x.viajes_reservada),
      text: dias.map((x) => `×${num(x.cociente_reservada_ajuste, 2)}`),
      textposition: "outside",
      cliponaxis: false,
      marker: { color: COLOR.serie2 },
      hovertemplate: "%{x}: %{y} viajes en la reservada (%{text} respecto al ajuste)<extra></extra>",
    } as Data,
  ];
  const m = t.modelos;
  const cocientes = dias.map((x) => x.cociente_reservada_ajuste);
  return (
    <Bloque
      titulo="5. Tendencia y semana reservada"
      queMuestra="Los viajes de cada día de la semana en la semana reservada frente a su media en las tres semanas del ajuste. La tabla tiene la pendiente de los viajes diarios con y sin tener en cuenta el tiempo."
      porQue="Si el tiempo explicara el crecimiento, la semana reservada sería comparable con el ajuste una vez descontado. Si no, la validación con la reservada es más exigente."
      comoLeer="La etiqueta de cada barra naranja es el cociente entre la semana reservada y la media del ajuste."
      conclusiones={[
        `En el ajuste los viajes crecen ${num(m[0].pendiente_viajes_dia_por_dia, 1)} al día por cada día (error típico ${num(m[0].pendiente_ee, 1)}), un ${pc(m[0].pendiente_pct_media_por_semana)} de la media por semana.`,
        <>
          En el mes, la pendiente es de {num(m[2].pendiente_viajes_dia_por_dia, 1)} viajes/día cada día (e. t. {num(m[2].pendiente_ee, 1)}); al
          añadir lluvia y temperatura baja a {num(m[3].pendiente_viajes_dia_por_dia, 1)} (e. t. {num(m[3].pendiente_ee, 1)}).{" "}
          <strong>El tiempo explica parte del crecimiento, no todo.</strong>
        </>,
        `Todos los días de la semana tienen más viajes en la reservada (cociente de ${num(Math.min(...cocientes), 2)} a ${num(Math.max(...cocientes), 2)}; ${num(media.cociente_reservada_ajuste, 3)} de media). La semana reservada fue además seca, más cálida (10,9 °C frente a 9,3 °C) y con menos viento: es más exigente que el ajuste.`,
        "No hemos podido leer el texto oficial de las restricciones por COVID en Lacio en febrero de 2021, así que no se afirma nada sobre ellas.",
      ]}
      fuente="tablas/exploracion/T17_tendencia.csv y T17_cociente_semana.csv"
    >
      <Grafica
        descripcion="Barras con los viajes por día de la semana en el ajuste y en la semana reservada"
        trazas={trazas}
        alto={330}
        capa={{
          barmode: "group",
          bargap: 0.25,
          bargroupgap: 0.06,
          margin: { t: 24 },
          xaxis: { type: "category" },
          yaxis: { title: { text: "Viajes al día" }, rangemode: "tozero" },
        }}
      />
      <TablaDesplegable
        titulo="Ver los modelos de tendencia"
        cabeceras={["Modelo", "Periodo", "Días", "Pendiente (viajes/día por día)", "Error típico", "% de la media por semana", "R²"]}
        numericas={[2, 3, 4, 5, 6]}
        filas={m.map((x) => [
          x.modelo.replaceAll("_", " ").replaceAll(" + ", " + "),
          x.periodo,
          x.n,
          num(x.pendiente_viajes_dia_por_dia, 2),
          num(x.pendiente_ee, 2),
          pc(x.pendiente_pct_media_por_semana),
          num(x.r2, 3),
        ])}
      />
    </Bloque>
  );
}

const MODELOS_VIENTO: Record<string, string> = { entre_dias: "entre días", dentro_del_dia: "mismo día" };
const POSICION_ETIQUETA: Record<string, string> = { "2021-02-13": "bottom center", "2021-02-14": "top left", "2021-02-27": "bottom right" };

function BloqueViento() {
  const { datos: v, error } = useDatos<Viento>(`${FASE}/t17_viento`);
  const [vista, setVista] = useState<"dias" | "horas">("dias");
  if (!v) return <Cargando error={error} />;
  const f = v.diario.find((x) => x.variable === "viento_max_kmh" && x.grupo === "fin_de_semana")!;
  const r = v.diario.find((x) => x.variable === "racha_max_kmh" && x.grupo === "fin_de_semana")!;
  const lab = v.diario.find((x) => x.variable === "viento_max_kmh" && x.grupo === "laborable")!;
  const efecto = (tipo: string, modelo: string, que = "+10 km/h de viento") =>
    v.horario.find((x) => x.tipo_dia === tipo && x.modelo === modelo && x.efecto === que)!;
  const fe = efecto("fin_de_semana", "entre_dias");
  const fd = efecto("fin_de_semana", "dentro_del_dia");
  const le = efecto("laborable", "entre_dias");
  const ld = efecto("laborable", "dentro_del_dia");
  const lluvias = [efecto("fin_de_semana", "entre_dias", "hora con lluvia"), efecto("fin_de_semana", "dentro_del_dia", "hora con lluvia")];
  const secas = v.horas_secas.find((x) => x.tipo_dia === "fin_de_semana")!;
  const diasSecas = v.dias_ventosos.filter((x) => x.tipo_dia === "fin_de_semana").map((x) => fecha(x.fecha));
  const d14 = v.fines_de_semana.find((x) => x.fecha === "2021-02-14")!;
  const calmos = v.fines_de_semana.filter((x) => x.precipitacion_mm <= 1 && x.viento_max_kmh < 15).map((x) => x.viajes);

  const puntos = (seco: boolean): Data => {
    const g = v.fines_de_semana.filter((x) => (x.precipitacion_mm <= 1) === seco);
    return {
      type: "scatter",
      mode: "text+markers",
      name: seco ? "Seco (≤ 1 mm)" : "Con lluvia",
      x: g.map((x) => x.viento_max_kmh),
      y: g.map((x) => x.viajes),
      text: g.map((x) => fecha(x.fecha)),
      textposition: g.map((x) => POSICION_ETIQUETA[x.fecha] ?? "middle right"),
      textfont: { size: 11, color: COLOR.tenue },
      customdata: g.map((x) => [x.dia_semana, num(x.precipitacion_mm, 1), num(x.racha_max_kmh, 1), num(x.temp_media_c, 1)]),
      marker: seco
        ? { color: COLOR.serie2, size: 11, line: { color: "#ffffff", width: 1.5 } }
        : { color: "#ffffff", size: 11, line: { color: COLOR.serie2, width: 2.5 } },
      hovertemplate:
        "%{customdata[0]} %{text}: %{y} viajes<br>viento máximo %{x:.1f} km/h, racha %{customdata[2]} km/h<br>%{customdata[1]} mm de lluvia, %{customdata[3]} °C de media<extra></extra>",
    } as unknown as Data;
  };
  const viento = v.horario.filter((x) => x.efecto === "+10 km/h de viento");
  const etiqueta = (x: { tipo_dia: string; modelo: string }) => `${TIPO_DIA[x.tipo_dia]}, ${MODELOS_VIENTO[x.modelo]}`;
  const efectos: Data[] = ["laborable", "fin_de_semana"].map((tipo) => {
    const g = viento.filter((x) => x.tipo_dia === tipo);
    return {
      type: "scatter",
      mode: "markers",
      name: TIPO_DIA[tipo],
      x: g.map((x) => x.pct),
      y: g.map(etiqueta),
      error_x: {
        type: "data",
        symmetric: false,
        array: g.map((x) => x.pct_sup - x.pct),
        arrayminus: g.map((x) => x.pct - x.pct_inf),
        color: COLOR_DIA[tipo],
        thickness: 2,
        width: 5,
      },
      customdata: g.map((x) => [num(x.pct_inf, 1), num(x.pct_sup, 1), x.horas]),
      marker: { color: COLOR_DIA[tipo], size: 11 },
      hovertemplate: "%{y}: %{x:.1f} % por cada 10 km/h<br>IC 95 %: %{customdata[0]} a %{customdata[1]} %<br>%{customdata[2]} horas de 7 a 23 h<extra></extra>",
    } as unknown as Data;
  });
  return (
    <Bloque
      titulo="6. Viento frente a lluvia"
      queMuestra="La asociación entre viajes y viento máximo en los ocho días de fin de semana. El modelo horario estima el cambio asociado con 10 km/h más de viento, controlando la lluvia."
      porQue="En el fin de semana el viento máximo se asocia con los viajes más que la lluvia, pero son 8 días. Decide si el viento entra en el simulador o en la elección de los días de diseño."
      comoLeer="En la vista por días, los puntos huecos son días con lluvia. En la vista por horas, cada punto es el cambio de los viajes por hora con 10 km/h más de viento y la barra, su intervalo al 95 %. «Entre días» compara la misma hora en días distintos; «mismo día» solo compara horas de un mismo día."
      conclusiones={[
        <>
          <strong>El viento no es un reflejo de la lluvia.</strong> En fin de semana el viento máximo y la lluvia apenas van juntos (Spearman de{" "}
          {num(f.rho_con_lluvia, 2)}). Descontando la lluvia, la correlación del viento con los viajes sigue en {num(f.rho_parcial_sin_lluvia, 2)}, y
          quitando cualquier día queda entre {num(f.rho_quitando_un_dia_max, 2)} y {num(f.rho_quitando_un_dia_min, 2)}. La lluvia, descontando el viento,
          baja a {num(f.rho_lluvia_parcial_sin_viento, 2)}. Con la racha máxima sale lo mismo, algo más débil ({num(r.rho_parcial_sin_lluvia, 2)}).
        </>,
        <>
          <strong>Por horas se confirma con los dos efectos a la vez.</strong> En fin de semana, 10 km/h más de viento quitan un {pc(-fe.pct, 0)} de los
          viajes entre días (IC 95 % de {pc(fe.pct_inf, 0)} a {pc(fe.pct_sup, 0)}) y un {pc(-fd.pct, 0)} dentro del mismo día. La lluvia, en el mismo
          modelo, quita entre un {pc(-lluvias[1].pct, 0)} y un {pc(-lluvias[0].pct, 0)}. En laborables el viento quita un {pc(-le.pct, 0)} entre días y un{" "}
          {pc(-ld.pct, 0)} dentro del día, sin diferencia clara con cero (la correlación diaria parcial es {num(lab.rho_parcial_sin_lluvia, 2)}).
        </>,
        `En fin de semana, las ${secas.horas} horas secas con al menos ${v.umbrales.viento_kmh} km/h tuvieron el ${pc(100 * secas.cociente, 0)} de los viajes de las horas secas en calma (menos de ${v.umbrales.calma_kmh} km/h) a la misma hora. Todas son del ${diasSecas.join(" y el ")}.`,
        `El límite es que la prueba descansa en un episodio: el fin de semana del 13–14/02, frío y con rachas de casi 70 km/h. El 14/02 no llovió y tuvo ${d14.viajes} viajes, frente a ${Math.min(...calmos)}–${Math.max(...calmos)} de los fines de semana secos y en calma. El modelo por horas descuenta la temperatura y el efecto se mantiene.`,
        <>
          En este mes, la asociación entre viento y menos viajes de fin de semana se apoya en un solo episodio. El simulador conserva la demanda
          observada. El 07/02 y el 13–14/02 se marcan como tiempo adverso al elegir los días de diseño.
        </>,
      ]}
      fuente="tablas/exploracion/T17_viento_diario.csv, T17_viento_horario.csv y T17_viento_horas_secas.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Vista"
          valor={vista}
          cambiar={setVista}
          opciones={[
            { valor: "dias", texto: "Fines de semana por días" },
            { valor: "horas", texto: "Efecto por horas" },
          ]}
        />
      </div>
      {vista === "dias" ? (
        <Grafica
          descripcion="Dispersión de los viajes de los 8 días de fin de semana frente al viento máximo del día, con los días de lluvia huecos"
          trazas={[puntos(true), puntos(false)]}
          alto={360}
          capa={{
            margin: { t: 8 },
            xaxis: { title: { text: "Viento máximo del día (km/h)" }, range: [7, 41] },
            yaxis: { title: { text: "Viajes elegibles/día" }, rangemode: "tozero" },
          }}
        />
      ) : (
        <Grafica
          descripcion="Efecto en % de 10 km/h más de viento en los viajes por hora, con su intervalo al 95 %, por tipo de día y modelo"
          trazas={efectos}
          alto={320}
          capa={{
            margin: { t: 8 },
            shapes: [{ type: "line", xref: "x", yref: "paper", x0: 0, x1: 0, y0: 0, y1: 1, line: { color: COLOR.tenue, width: 1.3 } }] as Shape[],
            xaxis: { title: { text: "Cambio en viajes por hora con +10 km/h (%)" }, ticksuffix: " %" },
            yaxis: { type: "category", autorange: "reversed" },
          }}
        />
      )}
      <TablaDesplegable
        titulo="Ver los 8 días de fin de semana"
        cabeceras={["Día", "Viajes", "Lluvia (mm)", "Horas con lluvia", "Viento máximo (km/h)", "Racha máxima (km/h)", "Temperatura media (°C)"]}
        numericas={[1, 2, 3, 4, 5, 6]}
        filas={v.fines_de_semana.map((x) => [
          `${x.dia_semana} ${fecha(x.fecha)}`,
          x.viajes,
          num(x.precipitacion_mm, 1),
          x.horas_lluvia,
          num(x.viento_max_kmh, 1),
          num(x.racha_max_kmh, 1),
          num(x.temp_media_c, 1),
        ])}
      />
    </Bloque>
  );
}
