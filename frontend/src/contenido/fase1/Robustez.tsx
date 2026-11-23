// Estabilidad de los pares OD (T20) y robustez de la red a los viajes encadenados y a los
// puntos de entrega del operador (T30).
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cargando, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR } from "../../graficas";

type FilaEstabilidad = {
  comparacion: string;
  viajes_a: number;
  viajes_b: number;
  pares_union: number;
  pct_viajes_b_en_pares_de_a: number;
  tvd_pc: number;
  tvd_azar_pc: number;
  tvd_azar_p95_pc: number;
  exceso_pp: number;
  top20_comunes: number;
};

export function BloqueEstabilidadPares() {
  const { datos: d, error } = useDatos<FilaEstabilidad[]>("fase1/t20_estabilidad");
  if (!d) return <Cargando error={error} />;
  const ar = d[0];
  const semanas = d.filter((f) => f.comparacion.startsWith("semana") && !f.comparacion.includes("reservada"));
  const barras = (x: number[], nombre: string, color: string): Data =>
    ({
      type: "bar",
      orientation: "h",
      name: nombre,
      y: d.map((f) => f.comparacion),
      x,
      marker: { color },
      hovertemplate: `${nombre}: %{x:.1f} %<extra>%{y}</extra>`,
    }) as Data;
  return (
    <Bloque
      titulo="5. Estabilidad de los pares OD"
      queMuestra="Cuánto cambia el reparto de viajes entre pares de celdas de resolución 8 del ajuste a la semana reservada, frente a lo que cambiaría solo por azar y a lo que cambia de una semana a otra dentro del ajuste."
      porQue="Las celdas son estables (T13), pero cada par tiene muchos menos viajes y puede moverse más. Si la reservada cambiara más que dos semanas cualesquiera, no serviría para validar a nivel de par."
      comoLeer="La medida es la distancia de variación total: el porcentaje de viajes que habría que cambiar de par para pasar de una matriz a la otra. La barra gris es lo que daría el azar con los mismos tamaños de muestra."
      conclusiones={[
        `El ${pc(ar.pct_viajes_b_en_pares_de_a)} de los viajes de la reservada va por pares que ya tenían viajes en el ajuste, y ${ar.top20_comunes} de los 20 pares principales coinciden.`,
        <>
          El reparto cambia un {pc(ar.tvd_pc)}, pero solo por azar ya cambiaría un {pc(ar.tvd_azar_pc)}: el cambio real es de{" "}
          <strong>{num(ar.exceso_pp, 1)} puntos</strong>.
        </>,
        `Es lo mismo que cambian dos semanas del ajuste (de ${num(Math.min(...semanas.map((f) => f.exceso_pp)), 1)} a ${num(Math.max(...semanas.map((f) => f.exceso_pp)), 1)} puntos sobre el azar): la semana reservada no es especial.`,
        <>
          Un par concreto es sobre todo ruido. <strong>La red se diseña y valida con extremos y cobertura OD, no con pares sueltos.</strong>
        </>,
      ]}
      fuente="tablas/movilidad/T20_estabilidad_pares.csv"
    >
      <Grafica
        descripcion="Barras horizontales de la distancia de variación total observada y por azar entre periodos"
        trazas={[barras(d.map((f) => f.tvd_azar_pc), "Solo por azar", COLOR.eje), barras(d.map((f) => f.tvd_pc), "Observada", COLOR.serie1)]}
        alto={320}
        capa={{
          barmode: "group",
          margin: { l: 8 },
          legend: { x: 0.99, xanchor: "right", y: 0.02 },
          xaxis: { title: { text: "Distancia de variación total (%)" }, rangemode: "tozero", range: [0, Math.max(...d.map((f) => f.tvd_pc)) * 1.35] },
          yaxis: { autorange: "reversed", ticks: "", showgrid: false },
        }}
      />
      <TablaDesplegable
        titulo="Ver todas las comparaciones"
        cabeceras={["Comparación", "Viajes A", "Viajes B", "% de B en pares de A", "TVD", "Azar", "Azar P95", "Exceso (puntos)", "Comunes en el top 20"]}
        numericas={[1, 2, 3, 4, 5, 6, 7, 8]}
        filas={d.map((f) => [
          f.comparacion,
          num(f.viajes_a),
          num(f.viajes_b),
          pc(f.pct_viajes_b_en_pares_de_a),
          pc(f.tvd_pc),
          pc(f.tvd_azar_pc),
          pc(f.tvd_azar_p95_pc),
          num(f.exceso_pp, 1),
          num(f.top20_comunes),
        ])}
      />
    </Bloque>
  );
}

type Robustez = {
  network_id: string;
  radio_m: number;
  encadenados: { periodo: string; version: string; viajes: number; viajes_cubiertos: number; pct_viajes_cubiertos: number }[];
  entregas: { puntos: string; n: number; pct_a_menos_del_radio: number }[];
};

export function BloqueRobustez() {
  const { datos: d, error } = useDatos<Robustez>("fase1/t30_robustez");
  if (!d) return <Cargando error={error} />;
  const fila = (periodo: string, version: string) => d.encadenados.find((f) => f.periodo === periodo && f.version === version)!;
  const [aj, ajU, re, reU] = [fila("ajuste", "tal cual"), fila("ajuste", "encadenados unidos"), fila("reservada", "tal cual"), fila("reservada", "encadenados unidos")];
  const e = Object.fromEntries(d.entregas.map((x) => [x.puntos, x.pct_a_menos_del_radio]));
  const trazas: Data[] = [
    {
      type: "bar",
      orientation: "h",
      y: d.entregas.map((x) => x.puntos[0].toUpperCase() + x.puntos.slice(1)),
      x: d.entregas.map((x) => x.pct_a_menos_del_radio),
      text: d.entregas.map((x) => pc(x.pct_a_menos_del_radio)),
      textposition: "outside",
      cliponaxis: false,
      textfont: { color: COLOR.texto },
      customdata: d.entregas.map((x) => x.n),
      marker: { color: d.entregas.map((x) => (x.puntos.startsWith("entregas") ? COLOR.serie2 : x.puntos.startsWith("recogidas") ? COLOR.serie1 : COLOR.eje)) },
      hovertemplate: `%{y}: %{x:.1f} % a menos de ${d.radio_m} m (%{customdata} puntos)<extra></extra>`,
    } as Data,
  ];
  return (
    <Bloque
      titulo="Robustez: viajes encadenados y puntos de entrega del operador"
      queMuestra={`La cobertura OD de la red principal (${d.network_id}) si se unen los viajes encadenados de T11, y la parte de las entregas del operador que queda a menos de ${d.radio_m} m de una estación.`}
      porQue="Si la cobertura dependiera de cómo se parte un trayecto, la red no sería robusta a esa decisión de limpieza. Y una red que dejara fuera los puntos donde el operador ya deja los patinetes le obligaría a cambiar su operación."
      comoLeer="La gráfica compara entregas, recogidas y orígenes. La tabla da la cobertura con los viajes tal cual y con los encadenados unidos."
      conclusiones={[
        `Al unir los encadenados, la cobertura pasa del ${pc(aj.pct_viajes_cubiertos, 2)} al ${pc(ajU.pct_viajes_cubiertos, 2)} en el ajuste y del ${pc(re.pct_viajes_cubiertos, 2)} al ${pc(reU.pct_viajes_cubiertos, 2)} en la reservada. Mantenerlos separados no cambia la red.`,
        `El ${pc(e["entregas del operador"])} de las entregas queda a menos de ${d.radio_m} m de una estación, como los orígenes del ajuste (${pc(e["orígenes del ajuste"])}) y más que las recogidas (${pc(e["recogidas del operador"])}). La red cubre los puntos de despliegue actuales.`,
      ]}
      fuente="tablas/movilidad/T30_robustez_encadenados.csv y T30_entregas_operador.csv"
    >
      <Grafica
        descripcion="Barras del porcentaje de entregas, recogidas y orígenes a menos del radio de la red"
        trazas={trazas}
        alto={220}
        capa={{
          showlegend: false,
          margin: { l: 8, r: 50 },
          xaxis: { title: { text: `A menos de ${d.radio_m} m de una estación (%)` }, range: [0, 100], ticksuffix: " %" },
          yaxis: { autorange: "reversed", ticks: "", showgrid: false },
        }}
      />
      <TablaDesplegable
        titulo="Ver la cobertura con y sin unir los encadenados"
        cabeceras={["Periodo", "Versión", "Viajes", "Cubiertos", "% cubiertos"]}
        numericas={[2, 3, 4]}
        filas={d.encadenados.map((f) => [f.periodo, f.version, num(f.viajes), num(f.viajes_cubiertos), pc(f.pct_viajes_cubiertos, 2)])}
      />
    </Bloque>
  );
}
