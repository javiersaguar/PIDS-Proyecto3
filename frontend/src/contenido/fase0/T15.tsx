import { useState } from "react";
import type { Data, Layout, Shape } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { FRANJAS, TIPO_DIA, franjaEje, indicadores, num, pc } from "../../formato";
import { COLOR, ESCALA_AZUL, trazaEscalon, trazaTexto, trazasUmbral } from "../../graficas";

type Histograma = { bordes: number[]; viajes: number[]; mediana: number; escala_log: boolean };
type FilaPercentiles = { variable: string; unidad: string; viajes: number; media: number; min: number; p5: number; p25: number; p50: number; p75: number; p95: number; p99: number; max: number };
type Distribuciones = { histogramas: Record<"dis_m" | "tt_s" | "vel_kmh", Histograma>; tabla: FilaPercentiles[] };
type Rodeo = {
  histograma: { bordes: number[]; viajes: number[]; tope: number };
  rejilla: { recta_km: number[]; recorrida_km: number[]; viajes: number[][] };
  indicadores: Record<string, number>;
};
type Mediana = { tipo_dia: string; franja: string; viajes: number; dis_m_mediana: number; tt_s_mediana: number; vel_kmh_mediana: number };
type FilaRadio = {
  radio_m: number;
  dist_pie_peor_m: number;
  t_pie_peor_s: number;
  pct_t_pie_supera_viaje_peor: number;
  pct_andar_directo_mas_rapido_peor: number;
  dist_pie_medio_m: number;
  t_pie_medio_s: number;
  pct_t_pie_supera_viaje_medio: number;
  pct_andar_directo_mas_rapido_medio: number;
  pct_dis_le_2R: number;
};
type Radios = { tabla: FilaRadio[]; rodeo: number; velocidad_pie_ms: number; radios_plan: number[] };
type Indicadores = { indicador: string; valor: number }[];

const FASE = "fase0";

export function T15() {
  const { datos: d, error } = useDatos<Distribuciones>(`${FASE}/t15_distribuciones`);
  const { datos: r } = useDatos<Indicadores>(`${FASE}/t15_resumen`);
  const i = r ? indicadores(r) : null;
  const p = (v: string) => d?.tabla.find((t) => t.variable === v);
  return (
    <Seccion
      id="t15"
      tarea="T15"
      responsable="Alejandro Cuevas"
      titulo="Recorridos: distancia, duración, velocidad, rodeo y radios de acceso"
      notebook="exploracion/T15_recorridos.ipynb"
      objetivo="Describir cómo son los viajes y medir cuánto cuesta andar hasta una estación y desde ella para cada radio de acceso."
      valor="Confirma o ajusta los radios del barrido de la fase 1, da el factor de rodeo con el que se pasa de distancia en línea recta a distancia andando y dice qué parte de la demanda deja de tener sentido con estaciones."
    >
      {d && i ? (
        <Cifras
          cifras={[
            { valor: `${num(p("dis_m")!.p50)} m`, nombre: "distancia mediana", detalle: `P95 ${num(p("dis_m")!.p95)} m` },
            { valor: `${num(p("tt_s")!.p50)} s`, nombre: "duración mediana", detalle: "unos 8 minutos" },
            { valor: `${num(p("vel_kmh")!.p50, 1)} km/h`, nombre: "velocidad mediana", detalle: "distancia de ruta entre duración" },
            { valor: num(i.rodeo_mediana, 3), nombre: "factor de rodeo", detalle: "ruta entre línea recta, mediana" },
            { valor: pc(i.pct_viajes_circulares, 2), nombre: "viajes circulares", detalle: `${num(i.viajes_circulares)} vuelven casi al origen` },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <BloqueDistribuciones />
      <BloqueRodeo />
      <BloqueMedianas />
      <BloqueRadios />
    </Seccion>
  );
}

const VARIABLES = {
  dis_m: {
    texto: "Distancia",
    eje: "Distancia recorrida (m)",
    unidad: "m",
    dec: 0,
    marcas: [100, 200, 500, 1000, 2000, 5000, 10000, 20000],
    etiquetas: ["100", "200", "500", "1000", "2000", "5000", "10 000", "20 000"],
  },
  tt_s: {
    texto: "Duración",
    eje: "Duración",
    unidad: "s",
    dec: 0,
    marcas: [60, 120, 300, 600, 1200, 1800, 3600, 7200],
    etiquetas: ["1 min", "2 min", "5 min", "10 min", "20 min", "30 min", "1 h", "2 h"],
  },
  vel_kmh: { texto: "Velocidad", eje: "Velocidad media (km/h)", unidad: "km/h", dec: 1, marcas: undefined, etiquetas: undefined },
} as const;

function BloqueDistribuciones() {
  const { datos: d, error } = useDatos<Distribuciones>(`${FASE}/t15_distribuciones`);
  const [v, setV] = useState<keyof typeof VARIABLES>("dis_m");
  if (!d) return <Cargando error={error} />;
  const h = d.histogramas[v];
  const meta = VARIABLES[v];
  const alto = Math.max(...h.viajes) * 1.18;
  const trazas: Data[] = [
    trazaEscalon({
      bordes: h.bordes,
      cuentas: h.viajes,
      nombre: "Viajes",
      color: COLOR.serie1,
      plantilla: `%{customdata[0]:,.${meta.dec}f}–%{customdata[1]:,.${meta.dec}f} ${meta.unidad}<br>%{y} viajes<extra></extra>`,
    }),
    ...trazasUmbral(h.mediana, alto * 0.86, `mediana ${num(h.mediana, meta.dec)} ${meta.unidad}`),
  ];
  const lg = Math.log10;
  const x0 = h.bordes[0];
  const x1 = h.bordes[h.bordes.length - 1];
  const nombres: Record<string, string> = { dis_m: "Distancia (m)", tt_s: "Duración (s)", vel_kmh: "Velocidad (km/h)", dist_recta_m: "Línea recta (m)", rodeo: "Rodeo" };
  return (
    <Bloque
      titulo="1. Distancia, duración y velocidad"
      queMuestra="Cómo se reparten la distancia de ruta, la duración y la velocidad media de los viajes elegibles del periodo de ajuste."
      porQue="El tamaño típico de un viaje fija con qué radios de acceso merece la pena usar el servicio y entra en el consumo por viaje (T16)."
      comoLeer="Distancia y duración tienen cola larga y se dibujan en escala logarítmica; la velocidad, en escala lineal. La tabla tiene los percentiles de cada variable."
      conclusiones={[
        "El viaje mediano recorre 1 619 m en 490 s (unos 8 min) a 12,5 km/h. El 95 % recorre menos de 5 187 m y dura menos de 1 699 s.",
        "La distancia en línea recta mediana es de 947 m: los viajes son cortos comparados con un radio de acceso de 300–400 m por extremo.",
      ]}
      fuente="figuras/exploracion/T15_distribuciones y tablas/exploracion/T15_distribuciones.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Variable"
          valor={v}
          cambiar={setV}
          opciones={(Object.keys(VARIABLES) as (keyof typeof VARIABLES)[]).map((k) => ({ valor: k, texto: VARIABLES[k].texto }))}
        />
      </div>
      <Grafica
        descripcion={`Histograma de la ${meta.texto.toLowerCase()} de los viajes elegibles del periodo de ajuste`}
        trazas={trazas}
        alto={340}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          xaxis: h.escala_log
            ? { type: "log", title: { text: meta.eje }, range: [lg(x0), lg(x1)], tickvals: [...(meta.marcas ?? [])], ticktext: [...(meta.etiquetas ?? [])] }
            : { title: { text: meta.eje }, range: [x0, x1] },
          yaxis: { title: { text: "Viajes" }, range: [0, alto] },
        }}
      />
      <TablaDesplegable
        titulo="Ver los percentiles"
        cabeceras={["Variable", "Viajes", "P5", "P25", "Mediana", "P75", "P95", "P99", "Máximo"]}
        numericas={[1, 2, 3, 4, 5, 6, 7, 8]}
        filas={d.tabla.map((t) => {
          const dec = t.variable === "rodeo" ? 3 : t.variable === "vel_kmh" ? 1 : 0;
          return [nombres[t.variable] ?? t.variable, num(t.viajes), ...[t.p5, t.p25, t.p50, t.p75, t.p95, t.p99, t.max].map((x) => num(x, dec))];
        })}
      />
    </Bloque>
  );
}

function BloqueRodeo() {
  const { datos: r, error } = useDatos<Rodeo>(`${FASE}/t15_rodeo`);
  const [vista, setVista] = useState<"factor" | "rejilla">("factor");
  if (!r) return <Cargando error={error} />;
  const i = r.indicadores;
  let trazas: Data[];
  let capa: Partial<Layout>;
  if (vista === "factor") {
    const h = r.histograma;
    const alto = Math.max(...h.viajes) * 1.18;
    trazas = [
      trazaEscalon({
        bordes: h.bordes,
        cuentas: h.viajes,
        nombre: "Viajes",
        color: COLOR.serie1,
        plantilla: "Rodeo de %{customdata[0]:.2f} a %{customdata[1]:.2f}<br>%{y} viajes<extra></extra>",
      }),
      ...trazasUmbral(i.rodeo_mediana, alto * 0.86, `mediana ${num(i.rodeo_mediana, 3)}`),
    ];
    capa = {
      showlegend: false,
      margin: { t: 20 },
      xaxis: { title: { text: "Factor de rodeo (distancia de ruta / línea recta)" }, range: [1, h.tope] },
      yaxis: { title: { text: "Viajes" }, range: [0, alto] },
    };
  } else {
    const g = r.rejilla;
    const centro = (b: number[]) => b.slice(0, -1).map((x, k) => (x + b[k + 1]) / 2);
    const xs = centro(g.recta_km);
    const ys = centro(g.recorrida_km);
    // viajes[recta][recorrida] → z[recorrida][recta], con log10 para ver también las casillas con pocos viajes.
    const z = ys.map((_, j) => xs.map((_, k) => (g.viajes[k][j] > 0 ? Math.log10(g.viajes[k][j]) : null)));
    const n = ys.map((_, j) => xs.map((_, k) => g.viajes[k][j]));
    const xmax = g.recta_km[g.recta_km.length - 1];
    trazas = [
      {
        type: "heatmap",
        x: xs,
        y: ys,
        z,
        customdata: n,
        colorscale: ESCALA_AZUL,
        zmin: 0,
        colorbar: { title: { text: "Viajes", side: "right" }, tickvals: [0, 1, 2, 3], ticktext: ["1", "10", "100", "1 000"], thickness: 12, outlinewidth: 0 },
        hovertemplate: "Línea recta %{x:.2f} km · recorrido %{y:.2f} km<br>%{customdata} viajes<extra></extra>",
      } as Data,
      {
        type: "scatter",
        mode: "lines",
        x: [0, xmax],
        y: [0, xmax],
        name: "Sin rodeo (1)",
        line: { color: COLOR.tenue, width: 1.3, dash: "dot" },
        hoverinfo: "skip",
      } as Data,
      {
        type: "scatter",
        mode: "lines",
        x: [0, xmax],
        y: [0, xmax * i.rodeo_mediana],
        name: `Rodeo mediano (${num(i.rodeo_mediana, 3)})`,
        line: { color: COLOR.serie2, width: 2, dash: "dash" },
        hoverinfo: "skip",
      } as Data,
    ];
    capa = {
      margin: { t: 8 },
      legend: { y: 1.02 },
      xaxis: { title: { text: "Distancia en línea recta (km)" }, range: [0, xmax] },
      yaxis: { title: { text: "Distancia recorrida (km)" }, range: [0, g.recorrida_km[g.recorrida_km.length - 1]] },
    };
  }
  return (
    <Bloque
      titulo="2. Rodeo y viajes circulares"
      queMuestra="El cociente entre la distancia recorrida y la distancia en línea recta de los viajes con al menos 200 m en línea recta, y la relación entre las dos distancias en todos los viajes."
      porQue="El rodeo sirve para pasar de distancia en línea recta a distancia andando aproximada. Los viajes circulares, con estaciones, empezarían y acabarían en la misma."
      comoLeer={`En el histograma, la última barra agrupa los rodeos de ${r.histograma.tope} o más. En la rejilla, cada casilla cuenta los viajes con esa pareja de distancias; la escala de color es logarítmica.`}
      conclusiones={[
        <>
          El rodeo mediano es <strong>{num(i.rodeo_mediana, 3)}</strong> (P25 {num(i.rodeo_p25, 3)}, P75 {num(i.rodeo_p75, 3)}) en{" "}
          {num(i.viajes_con_rodeo)} viajes. La cola larga (P95 {num(i.rodeo_p95, 2)}) son paseos, no desplazamientos directos. Se
          usa {num(i.rodeo_mediana, 3)} como hipótesis para la distancia andando.
        </>,
        <>
          Hay {num(i.viajes_circulares)} viajes circulares, el <strong>{pc(i.pct_viajes_circulares, 2)}</strong> (línea recta
          de menos de 100 m y ruta de 500 m o más): con estaciones empezarían y acabarían en la misma, y el simulador debe
          admitirlo.
        </>,
      ]}
      fuente="figuras/exploracion/T15_rodeo y tablas/exploracion/T15_resumen.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Vista"
          valor={vista}
          cambiar={setVista}
          opciones={[
            { valor: "factor", texto: "Factor de rodeo" },
            { valor: "rejilla", texto: "Recorrido frente a línea recta" },
          ]}
        />
      </div>
      <Grafica descripcion="Distribución del factor de rodeo de los viajes" trazas={trazas} alto={360} capa={capa} />
    </Bloque>
  );
}

const MEDIDAS = {
  dis_m_mediana: { texto: "Distancia", eje: "Distancia mediana (m)", formato: ".0f", unidad: "m" },
  tt_s_mediana: { texto: "Duración", eje: "Duración mediana (s)", formato: ".0f", unidad: "s" },
  vel_kmh_mediana: { texto: "Velocidad", eje: "Velocidad mediana (km/h)", formato: ".1f", unidad: "km/h" },
} as const;

function BloqueMedianas() {
  const { datos: m, error } = useDatos<Mediana[]>(`${FASE}/t15_medianas`);
  const [medida, setMedida] = useState<keyof typeof MEDIDAS>("dis_m_mediana");
  if (!m) return <Cargando error={error} />;
  const meta = MEDIDAS[medida];
  const franjas = Object.keys(FRANJAS);
  const trazas: Data[] = (["laborable", "fin_de_semana"] as const).map((t, k) => {
    const filas = franjas.map((f) => m.find((x) => x.tipo_dia === t && x.franja === f)!);
    return {
      type: "bar",
      name: TIPO_DIA[t],
      x: franjas.map(franjaEje),
      y: filas.map((x) => x[medida]),
      customdata: filas.map((x) => x.viajes),
      marker: { color: k === 0 ? COLOR.serie1 : COLOR.serie2 },
      hovertemplate: `${TIPO_DIA[t]}<br>%{y:${meta.formato}} ${meta.unidad} (%{customdata} viajes)<extra></extra>`,
    } as Data;
  });
  const total = (t: string) => m.find((x) => x.tipo_dia === t && x.franja === "todas")!;
  const dis = m.filter((x) => x.franja !== "todas").map((x) => x.dis_m_mediana);
  return (
    <Bloque
      titulo="3. Medianas por franja y tipo de día"
      queMuestra="La mediana de distancia, duración y velocidad en cada franja horaria, en laborables y fines de semana."
      porQue="Si los viajes cambiaran mucho de una franja a otra, el radio aceptable y el consumo por viaje también cambiarían."
      comoLeer="Elige la medida con los botones. La madrugada tiene pocos viajes (115 en laborables y 36 en fines de semana), así que su mediana es menos fiable."
      conclusiones={[
        `Los viajes son parecidos en todas las franjas: la mediana de distancia se mueve entre ${num(Math.min(...dis))} y ${num(Math.max(...dis))} m, y el fin de semana es algo más lento (${num(total("fin_de_semana").vel_kmh_mediana, 2)} km/h frente a ${num(total("laborable").vel_kmh_mediana, 2)} en laborable).`,
        <>
          <strong>No hace falta un radio distinto por franja.</strong>
        </>,
      ]}
      fuente="tablas/exploracion/T15_medianas_franja_tipo_dia.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Medida"
          valor={medida}
          cambiar={setMedida}
          opciones={(Object.keys(MEDIDAS) as (keyof typeof MEDIDAS)[]).map((k) => ({ valor: k, texto: MEDIDAS[k].texto }))}
        />
      </div>
      <Grafica
        descripcion="Barras con la mediana de cada medida por franja horaria y tipo de día"
        trazas={trazas}
        alto={330}
        capa={{
          barmode: "group",
          bargap: 0.3,
          bargroupgap: 0.08,
          margin: { t: 8 },
          xaxis: { type: "category" },
          yaxis: { title: { text: meta.eje }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

function BloqueRadios() {
  const { datos: r, error } = useDatos<Radios>(`${FASE}/t15_radios`);
  const [caso, setCaso] = useState<"medio" | "peor">("medio");
  if (!r) return <Cargando error={error} />;
  const t = r.tabla;
  const x = t.map((f) => f.radio_m);
  const linea = (y: number[], nombre: string, color: string, extra: string, customdata?: unknown[]): Data =>
    ({
      type: "scatter",
      mode: "lines+markers",
      x,
      y,
      name: nombre,
      customdata,
      line: { color, width: 2 },
      marker: { size: 8, color, line: { color: "#fff", width: 2 } },
      hovertemplate: `${nombre}: %{y:.1f} %${extra}<extra></extra>`,
    }) as Data;
  const medio = caso === "medio";
  const trazas: Data[] = [
    linea(
      t.map((f) => (medio ? f.pct_t_pie_supera_viaje_medio : f.pct_t_pie_supera_viaje_peor)),
      "Andar a las estaciones tarda más que el viaje",
      COLOR.serie1,
      "<br>%{customdata[0]} m a pie, %{customdata[1]} s",
      t.map((f) => (medio ? [num(f.dist_pie_medio_m), num(f.t_pie_medio_s)] : [num(f.dist_pie_peor_m), num(f.t_pie_peor_s)])),
    ),
    linea(
      t.map((f) => (medio ? f.pct_andar_directo_mas_rapido_medio : f.pct_andar_directo_mas_rapido_peor)),
      "Andar todo el trayecto sería más rápido",
      COLOR.serie2,
      "",
    ),
    linea(
      t.map((f) => f.pct_dis_le_2R),
      "El viaje recorre menos de 2R",
      COLOR.serie3,
      "",
    ),
    trazaTexto(250, 78, "Radios del barrido"),
    trazaTexto(400, 78, "Sensibilidad"),
  ];
  const formas: Partial<Shape>[] = [
    { type: "rect", xref: "x", yref: "paper", x0: 190, x1: 310, y0: 0, y1: 1, fillcolor: COLOR.franja, line: { width: 0 }, layer: "below" },
    { type: "line", xref: "x", yref: "paper", x0: 400, x1: 400, y0: 0, y1: 0.9, line: { color: COLOR.tenue, width: 1.3, dash: "dash" }, layer: "below" },
  ];
  const fila = (radio: number) => t.find((f) => f.radio_m === radio)!;
  return (
    <Bloque
      titulo="4. Radios de acceso"
      queMuestra={`Para radios de acceso de ${x[0]} a ${x[x.length - 1]} m, en qué porcentaje de viajes andar hasta la estación y desde ella tarda más que el propio viaje, en cuántos sería más rápido ir andando todo el trayecto y cuántos son más cortos que 2R.`}
      porQue="Con estaciones, cada viaje paga el acceso a pie. Si ese coste supera el viaje, el usuario no usaría el servicio. Fija los radios del barrido de la fase 1."
      comoLeer={`Caso medio: se anda 2R/3 en cada extremo; caso peor: R en cada extremo. Las distancias a pie llevan el rodeo de ${num(r.rodeo, 3)} y se recorren a ${num(r.velocidad_pie_ms, 1)} m/s.`}
      conclusiones={[
        `En el caso medio, andar a las estaciones tarda más que el viaje en el ${pc(fila(200).pct_t_pie_supera_viaje_medio, 2)} de los viajes con 200 m, el ${pc(fila(300).pct_t_pie_supera_viaje_medio, 2)} con 300 m y el ${pc(fila(400).pct_t_pie_supera_viaje_medio, 2)} con 400 m. Andar todo el trayecto sería más rápido en el ${pc(fila(200).pct_andar_directo_mas_rapido_medio, 2)}, el ${pc(fila(300).pct_andar_directo_mas_rapido_medio, 2)} y el ${pc(fila(400).pct_andar_directo_mas_rapido_medio, 2)}.`,
        <>
          Con 400 m, el {pc(fila(400).pct_dis_le_2R, 2)} de los viajes recorre menos de 2R.{" "}
          <strong>Se mantienen 200 y 300 m, se añade 250 m y 400 m queda como sensibilidad.</strong>
        </>,
        "La velocidad a pie de 1,3 m/s está dentro del rango de 1,24–1,43 m/s de Bohannon y Andrews (2011) para adultos de 20 a 69 años; es una hipótesis.",
      ]}
      fuente="figuras/exploracion/T15_radios_acceso y tablas/exploracion/T15_radios_acceso.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Caso de acceso"
          valor={caso}
          cambiar={setCaso}
          opciones={[
            { valor: "medio", texto: "Caso medio (2R/3)" },
            { valor: "peor", texto: "Caso peor (R)" },
          ]}
        />
      </div>
      <Grafica
        descripcion="Porcentaje de viajes penalizados por el acceso a pie según el radio de acceso"
        trazas={trazas}
        alto={360}
        capa={{
          hovermode: "x unified",
          margin: { t: 8 },
          legend: { y: 1.04 },
          shapes: formas as Shape[],
          xaxis: { title: { text: "Radio de acceso R (m)" }, tickvals: x, range: [130, 520], hoverformat: ".0f", ticksuffix: " m" },
          yaxis: { title: { text: "% de los viajes" }, range: [0, 85], ticksuffix: " %" },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla de radios"
        cabeceras={["Radio", "A pie, caso medio", "Tarda más que el viaje", "Andar es más rápido", "A pie, caso peor", "Tarda más que el viaje", "Andar es más rápido", "Viaje < 2R"]}
        numericas={[1, 2, 3, 4, 5, 6, 7]}
        filas={t.map((f) => [
          `${f.radio_m} m`,
          `${num(f.dist_pie_medio_m)} m · ${num(f.t_pie_medio_s)} s`,
          pc(f.pct_t_pie_supera_viaje_medio),
          pc(f.pct_andar_directo_mas_rapido_medio),
          `${num(f.dist_pie_peor_m)} m · ${num(f.t_pie_peor_s)} s`,
          pc(f.pct_t_pie_supera_viaje_peor),
          pc(f.pct_andar_directo_mas_rapido_peor),
          pc(f.pct_dis_le_2R),
        ])}
      />
    </Bloque>
  );
}
