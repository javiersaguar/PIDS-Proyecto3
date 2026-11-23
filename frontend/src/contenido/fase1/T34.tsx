// T34: curva de flota frente a nivel de servicio e indicadores de uso.
import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR } from "../../graficas";

type Punto = {
  flota: number;
  rebalanceo_max: number;
  pct_atendidos_cubiertos: number;
  n_sin_patinete: number;
  n_sin_anclaje: number;
  viajes_por_patinete_dia: number;
  pct_tiempo_en_viaje: number;
};
type Caso = Punto & { caso: string; periodo: string; cubiertas: number };
type Flota = {
  network_id: string;
  anclajes: number;
  flota_diseno: number;
  servicio_objetivo: number;
  rebalanceo_base: number;
  flota_minima: number | null;
  curva: Punto[];
  comparacion: Caso[];
};

export function T34() {
  const { datos: d, error } = useDatos<Flota>("fase1/t34_flota");
  return (
    <Seccion
      id="t34"
      tarea="T34"
      responsable="Alejandro Cuevas"
      titulo="Curva de flota frente a nivel de servicio"
      notebook="movilidad/T34_curva_flota.ipynb"
      objetivo="Medir cuántos viajes se atienden y cuánto se usa cada patinete según el tamaño de la flota, con la red elegida y los anclajes de T32."
      valor="El enunciado pide a la vez minimizar los patinetes y maximizar su uso. La curva muestra lo que se gana y lo que se pierde con cada patinete más y fija la flota con un criterio decidido antes de ver el resultado."
    >
      {d ? <Contenido d={d} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function Contenido({ d }: { d: Flota }) {
  const base = d.curva.filter((f) => f.rebalanceo_max === d.rebalanceo_base);
  const minima = base.find((f) => f.flota === d.flota_minima)!;
  const mejor = base.reduce((a, b) => (b.pct_atendidos_cubiertos > a.pct_atendidos_cubiertos ? b : a));
  const res = d.comparacion.find((f) => f.periodo === "reservada" && f.flota === d.flota_minima)!;
  return (
    <>
      <Cifras
        cifras={[
          { valor: num(d.flota_minima ?? 0), nombre: "patinetes bastan", detalle: `${pc(minima.pct_atendidos_cubiertos)} de los viajes cubiertos` },
          { valor: num(mejor.flota), nombre: "máximo de servicio", detalle: `${pc(mejor.pct_atendidos_cubiertos)}; con más, empeora` },
          { valor: num(minima.viajes_por_patinete_dia, 2), nombre: "viajes por patinete y día", detalle: `con ${num(d.flota_minima ?? 0)} patinetes` },
          { valor: pc(res.pct_atendidos_cubiertos), nombre: "en la semana reservada", detalle: "misma flota, sin reajustar" },
        ]}
      />
      <BloqueCurva d={d} />
      <BloqueUso d={d} />
    </>
  );
}

function BloqueCurva({ d }: { d: Flota }) {
  const rebs = [...new Set(d.curva.map((f) => f.rebalanceo_max))];
  const colores: Record<number, string> = { 0: COLOR.eje, [d.rebalanceo_base]: COLOR.serie1, [Math.max(...rebs)]: COLOR.serie3 };
  const base = d.curva.filter((f) => f.rebalanceo_max === d.rebalanceo_base);
  const mejor = base.reduce((a, b) => (b.pct_atendidos_cubiertos > a.pct_atendidos_cubiertos ? b : a));
  const sinReb = d.curva.filter((f) => f.rebalanceo_max === 0);
  const maxSin = sinReb.reduce((a, b) => (b.pct_atendidos_cubiertos > a.pct_atendidos_cubiertos ? b : a));
  const en = (flota: number) => base.find((f) => f.flota === flota)!;
  const trazas: Data[] = rebs.map(
    (reb) =>
      ({
        type: "scatter",
        mode: "lines+markers",
        name: `${reb} recolocaciones por noche`,
        x: d.curva.filter((f) => f.rebalanceo_max === reb).map((f) => f.flota),
        y: d.curva.filter((f) => f.rebalanceo_max === reb).map((f) => f.pct_atendidos_cubiertos),
        line: { color: colores[reb] ?? COLOR.tenue, width: 2 },
        marker: { size: 5 },
        hovertemplate: `%{x} patinetes: %{y:.1f} % atendidos<extra>${reb} por noche</extra>`,
      }) as Data,
  );
  return (
    <Bloque
      titulo="1. Cuántos patinetes hacen falta"
      queMuestra={`Porcentaje de viajes cubiertos que se atienden según el tamaño de la flota, con los ${num(d.anclajes)} anclajes de T32. La flota se reparte entre estaciones en proporción al stock de diseño de T32.`}
      porQue="Con pocos patinetes faltan vehículos; con muchos, las estaciones se llenan y no hay dónde dejarlos. La flota buena está entre los dos extremos."
      comoLeer={`La línea discontinua es el objetivo del ${d.servicio_objetivo} % y la vertical, la flota mínima que lo alcanza con el rebalanceo base. El barrido va de 25 en 25 patinetes.`}
      conclusiones={[
        <>
          <strong>{num(d.flota_minima ?? 0)} patinetes bastan</strong> para atender el {pc(en(d.flota_minima ?? 0).pct_atendidos_cubiertos)} de los viajes cubiertos con{" "}
          {d.rebalanceo_base} recolocaciones por noche: {num(d.flota_diseno - (d.flota_minima ?? 0))} menos que el diseño de T32 ({num(d.flota_diseno)}).
        </>,
        `El servicio llega al máximo con ${num(mejor.flota)} patinetes (${pc(mejor.pct_atendidos_cubiertos)}). Con más, empeora: ${pc(en(600).pct_atendidos_cubiertos)} con 600 y ${pc(en(700).pct_atendidos_cubiertos)} con 700, porque las estaciones se llenan y los rechazos por falta de anclaje pasan de ${num(en(400).n_sin_anclaje)} a ${num(en(700).n_sin_anclaje)}.`,
        `Sin rebalanceo nocturno el máximo se queda en el ${pc(maxSin.pct_atendidos_cubiertos)}: el rebalanceo vale unos 10 puntos de servicio.`,
      ]}
      fuente="tablas/movilidad/T34_curva_flota.csv y figuras/movilidad/T34_curva_flota"
    >
      <Grafica
        descripcion="Porcentaje de viajes cubiertos atendidos frente al número de patinetes, para tres límites de rebalanceo nocturno"
        trazas={trazas}
        alto={380}
        capa={{
          legend: { x: 0.5, xanchor: "center", y: 1.02, yanchor: "bottom", orientation: "h" },
          xaxis: { title: { text: "Patinetes en la flota" } },
          yaxis: { title: { text: "Viajes cubiertos atendidos (%)" }, ticksuffix: " %" },
          shapes: [
            { type: "line", xref: "paper", x0: 0, x1: 1, y0: d.servicio_objetivo, y1: d.servicio_objetivo, line: { color: COLOR.serie2, width: 1, dash: "dash" } },
            ...(d.flota_minima ? [{ type: "line" as const, yref: "paper" as const, x0: d.flota_minima, x1: d.flota_minima, y0: 0, y1: 1, line: { color: COLOR.serie2, width: 1, dash: "dot" as const } }] : []),
          ],
        }}
      />
    </Bloque>
  );
}

type Vista = "uso" | "rechazos";

function BloqueUso({ d }: { d: Flota }) {
  const [vista, setVista] = useState<Vista>("uso");
  const base = d.curva.filter((f) => f.rebalanceo_max === d.rebalanceo_base);
  const x = base.map((f) => f.flota);
  const en = (flota: number) => base.find((f) => f.flota === flota)!;
  const min = en(d.flota_minima ?? d.flota_diseno);
  const max = base.reduce((a, b) => (b.pct_atendidos_cubiertos > a.pct_atendidos_cubiertos ? b : a));
  const trazas: Data[] =
    vista === "uso"
      ? [
          { type: "scatter", mode: "lines", name: "Viajes por patinete y día", x, y: base.map((f) => f.viajes_por_patinete_dia), line: { color: COLOR.serie1, width: 2 }, hovertemplate: "%{x} patinetes: %{y:.2f} viajes por patinete y día<extra></extra>" } as Data,
        ]
      : [
          { type: "scatter", mode: "lines", name: "Sin patinete", x, y: base.map((f) => f.n_sin_patinete), line: { color: COLOR.serie2, width: 2 }, hovertemplate: "%{x} patinetes: %{y} sin patinete<extra></extra>" } as Data,
          { type: "scatter", mode: "lines", name: "Sin anclaje", x, y: base.map((f) => f.n_sin_anclaje), line: { color: COLOR.texto, width: 2 }, hovertemplate: "%{x} patinetes: %{y} sin anclaje<extra></extra>" } as Data,
        ];
  return (
    <Bloque
      titulo="2. Uso de los patinetes y causas de rechazo"
      queMuestra={`Con ${d.rebalanceo_base} recolocaciones por noche, los viajes por patinete y día o los viajes rechazados por causa según el tamaño de la flota.`}
      porQue="Es el segundo objetivo del enunciado: maximizar el uso. Cada patinete de más baja el uso medio y solo compensa si sube el servicio."
      comoLeer="Los rechazos se cuentan sobre los viajes cubiertos de las tres semanas de ajuste."
      conclusiones={[
        `Pasar de ${num(min.flota)} a ${num(max.flota)} patinetes da ${num(max.pct_atendidos_cubiertos - min.pct_atendidos_cubiertos, 1)} puntos de servicio, y el uso baja de ${num(min.viajes_por_patinete_dia, 2)} a ${num(max.viajes_por_patinete_dia, 2)} viajes por patinete y día.`,
        `Con pocos patinetes domina la falta de vehículo; con muchos, la falta de anclaje. Las dos curvas se cruzan cerca del máximo de servicio: flota y anclajes se dimensionan juntos.`,
        `Los patinetes pasan menos del ${pc(Math.ceil(Math.max(...base.filter((f) => f.flota >= 300).map((f) => f.pct_tiempo_en_viaje))), 0)} del tiempo en viaje: el tamaño lo decide dónde y cuándo hacen falta, no cuántos viajes hay a la vez.`,
      ]}
      fuente="tablas/movilidad/T34_curva_flota.csv y T34_comparacion.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Qué mostrar"
          opciones={[
            { valor: "uso", texto: "Uso" },
            { valor: "rechazos", texto: "Rechazos" },
          ]}
          valor={vista}
          cambiar={setVista}
        />
      </div>
      <Grafica
        descripcion="Uso de los patinetes o viajes rechazados por causa frente al tamaño de la flota"
        trazas={trazas}
        alto={320}
        capa={{
          legend: { x: 0.5, xanchor: "center", y: 1.08, orientation: "h" },
          xaxis: { title: { text: "Patinetes en la flota" } },
          yaxis: { title: { text: vista === "uso" ? "Viajes por patinete y día" : "Viajes rechazados" } },
        }}
      />
      <TablaDesplegable
        titulo="Ver el diseño de T32 y la flota mínima en el ajuste y en la semana reservada"
        cabeceras={["Caso", "Periodo", "Patinetes", "Atendidos", "Sin patinete", "Sin anclaje", "Viajes por patinete y día"]}
        numericas={[2, 3, 4, 5, 6]}
        filas={d.comparacion.map((f) => [f.caso, f.periodo, num(f.flota), pc(f.pct_atendidos_cubiertos), num(f.n_sin_patinete), num(f.n_sin_anclaje), num(f.viajes_por_patinete_dia, 2)])}
      />
    </Bloque>
  );
}
