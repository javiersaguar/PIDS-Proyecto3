// T32: simulación de inventario, stock inicial y anclajes por estación de la red elegida.
import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { fecha, num, pc } from "../../formato";
import { COLOR, ESCALA_AZUL, capaMapa } from "../../graficas";

type Fila = {
  cuantil: number;
  rebalanceo_max: number;
  flota: number;
  anclajes: number;
  pct_atendidos_cubiertos: number;
  n_sin_patinete: number;
  n_sin_anclaje: number;
  viajes_por_patinete_dia: number;
};
type Estacion = {
  station_id: string;
  lon: number;
  lat: number;
  stock_inicial: number;
  anclajes: number;
  salidas: number;
  llegadas: number;
  rotacion_dia: number;
  ocupacion_media_pct: number;
  pct_tiempo_vacia: number;
  pct_tiempo_llena: number;
};
type Noche = { fecha: string; patinetes_movidos: number; km: number; deficit_antes: number; deficit_despues: number };
type Inventario = {
  network_id: string;
  radio_m: number;
  hora_corte: number;
  servicio_objetivo: number;
  rebalanceo_base: number;
  cuantil: number;
  cotas: { caso: string; flota: number; anclajes: number }[];
  dimensionado: Fila[];
  resumen: Record<string, number>;
  estaciones: Estacion[];
  noches: Noche[];
  reservada: (Fila & { periodo: string; solicitudes: number; cubiertas: number })[];
};

const P = (q: number) => `P${Math.round(100 * q)}`;

export function T32() {
  const { datos: d, error } = useDatos<Inventario>("fase1/t32_inventario");
  return (
    <Seccion
      id="t32"
      tarea="T32"
      responsable="Javier Saguar"
      titulo="Stock inicial y anclajes por estación"
      notebook="movilidad/T32_inventario.ipynb"
      objetivo="Simular el ajuste con patinetes y anclajes limitados, reserva del anclaje de destino, desvío dentro del radio y rebalanceo nocturno, y dimensionar cada estación de la red elegida."
      valor="Da el catálogo de estaciones con coordenadas, stock inicial, anclajes y utilización que leen la curva de flota (T34), el rebalanceo (T33) y la fase de consumo."
    >
      {d ? <Contenido d={d} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function Contenido({ d }: { d: Inventario }) {
  const r = d.resumen;
  const res = d.reservada.find((f) => f.periodo === "reservada" && f.rebalanceo_max === d.rebalanceo_base)!;
  return (
    <>
      <Cifras
        cifras={[
          { valor: num(r.flota), nombre: "patinetes", detalle: `stock inicial de las ${num(r.estaciones)} estaciones` },
          { valor: num(r.anclajes), nombre: "anclajes", detalle: `de 2 a ${Math.max(...d.estaciones.map((e) => e.anclajes))} por estación` },
          { valor: pc(r.pct_atendidos_cubiertos), nombre: "viajes cubiertos atendidos", detalle: `ajuste, ${d.rebalanceo_base} recolocaciones por noche` },
          { valor: pc(res.pct_atendidos_cubiertos), nombre: "en la semana reservada", detalle: "mismo diseño, sin reajustar" },
        ]}
      />
      <BloqueDimensionado d={d} />
      <BloqueEstaciones d={d} />
      <BloqueRebalanceo d={d} />
    </>
  );
}

function BloqueDimensionado({ d }: { d: Inventario }) {
  const base = d.dimensionado.filter((f) => f.rebalanceo_max === d.rebalanceo_base);
  const elegido = base.find((f) => f.cuantil === d.cuantil)!;
  const anterior = base[base.indexOf(elegido) - 1];
  const sinReb = d.dimensionado.filter((f) => f.rebalanceo_max === 0);
  const maxReb = Math.max(...d.dimensionado.map((f) => f.rebalanceo_max));
  const elegidoMax = d.dimensionado.find((f) => f.rebalanceo_max === maxReb && f.cuantil === d.cuantil)!;
  const mes = d.cotas[0];
  const colores: Record<number, string> = { 0: COLOR.eje, [d.rebalanceo_base]: COLOR.serie1, [maxReb]: COLOR.serie3 };
  const trazas: Data[] = [
    ...[...new Set(d.dimensionado.map((f) => f.rebalanceo_max))].map(
      (reb) =>
        ({
          type: "scatter",
          mode: "lines+markers",
          name: `${reb} recolocaciones por noche`,
          x: d.dimensionado.filter((f) => f.rebalanceo_max === reb).map((f) => f.anclajes),
          y: d.dimensionado.filter((f) => f.rebalanceo_max === reb).map((f) => f.pct_atendidos_cubiertos),
          customdata: d.dimensionado.filter((f) => f.rebalanceo_max === reb).map((f) => [P(f.cuantil), f.flota]),
          line: { color: colores[reb] ?? COLOR.tenue, width: 2 },
          marker: { size: 8 },
          hovertemplate: "%{customdata[0]}: %{x} anclajes, %{customdata[1]} patinetes<br>%{y:.1f} % atendidos<extra>" + `${reb} por noche</extra>`,
        }) as Data,
    ),
    {
      type: "scatter",
      mode: "markers",
      name: `Diseño elegido (${P(d.cuantil)})`,
      x: [elegido.anclajes],
      y: [elegido.pct_atendidos_cubiertos],
      marker: { size: 18, symbol: "star", color: COLOR.serie2, line: { color: "#fff", width: 2 } },
      hoverinfo: "skip",
    } as Data,
  ];
  return (
    <Bloque
      titulo="1. Cuánto servicio da cada anclaje"
      queMuestra={`Cada estación recibe como stock inicial el cuantil q de su stock necesario diario y como anclajes ese stock más el cuantil q de lo que sube su inventario en un día. Para cada q se simula el ajuste con 0, ${d.rebalanceo_base} y ${maxReb} recolocaciones por noche.`}
      porQue="Es la relación entre infraestructura y servicio que pide el enunciado. El criterio, fijado antes de mirar el resultado, es el menor q que atiende el 95 % de los viajes cubiertos con el rebalanceo base."
      comoLeer={`Cada punto es un cuantil, de P50 a P100. La línea de ${d.rebalanceo_base} recolocaciones es el escenario base; la estrella, el diseño elegido. Solo cuentan los viajes con estación a menos de ${d.radio_m} m en los dos extremos.`}
      conclusiones={[
        <>
          <strong>
            {P(d.cuantil)} es el primero que llega al {d.servicio_objetivo} %
          </strong>
          : {num(elegido.flota)} patinetes y {num(elegido.anclajes)} anclajes atienden el {pc(elegido.pct_atendidos_cubiertos)} de los viajes cubiertos.{" "}
          {P(anterior.cuantil)} se queda en el {pc(anterior.pct_atendidos_cubiertos)}.
        </>,
        `Sin rebalanceo, ni el diseño P100 llega al ${d.servicio_objetivo} % (${pc(sinReb[sinReb.length - 1].pct_atendidos_cubiertos)}), y para no quedarse nunca sin patinetes en todo el mes harían falta ${num(mes.flota)} patinetes y ${num(mes.anclajes)} anclajes.`,
        `Con ${maxReb} recolocaciones el diseño elegido apenas mejora (${pc(elegidoMax.pct_atendidos_cubiertos)}): con este tamaño de estaciones limita más la capacidad que el rebalanceo.`,
      ]}
      fuente="tablas/movilidad/T32_dimensionado.csv y figuras/movilidad/T32_dimensionado"
    >
      <Grafica
        descripcion="Porcentaje de viajes cubiertos atendidos frente al total de anclajes, para tres límites de rebalanceo nocturno"
        trazas={trazas}
        alto={380}
        capa={{
          legend: { x: 0.99, xanchor: "right", y: 0.04, yanchor: "bottom" },
          xaxis: { title: { text: "Anclajes en toda la red" } },
          yaxis: { title: { text: "Viajes cubiertos atendidos (%)" }, ticksuffix: " %", range: [65, 101] },
          shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: d.servicio_objetivo, y1: d.servicio_objetivo, line: { color: COLOR.serie2, width: 1, dash: "dash" } }],
        }}
      />
      <TablaDesplegable
        titulo="Ver el barrido con el rebalanceo base"
        cabeceras={["Cuantil", "Patinetes", "Anclajes", "Atendidos", "Sin patinete", "Sin anclaje", "Viajes por patinete y día"]}
        numericas={[1, 2, 3, 4, 5, 6]}
        filas={base.map((f) => [P(f.cuantil), num(f.flota), num(f.anclajes), pc(f.pct_atendidos_cubiertos), num(f.n_sin_patinete), num(f.n_sin_anclaje), num(f.viajes_por_patinete_dia, 2)])}
      />
    </Bloque>
  );
}

type Vista = "anclajes" | "vacia" | "llena";
const VISTAS: { valor: Vista; texto: string; campo: keyof Estacion; titulo: string }[] = [
  { valor: "anclajes", texto: "Anclajes", campo: "anclajes", titulo: "Anclajes" },
  { valor: "vacia", texto: "Tiempo vacía", campo: "pct_tiempo_vacia", titulo: "% del tiempo vacía" },
  { valor: "llena", texto: "Tiempo llena", campo: "pct_tiempo_llena", titulo: "% del tiempo llena" },
];

function BloqueEstaciones({ d }: { d: Inventario }) {
  const [vista, setVista] = useState<Vista>("anclajes");
  const v = VISTAS.find((x) => x.valor === vista)!;
  const e = d.estaciones;
  const dias = d.resumen.dias;
  const mediana = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const vacias = e.filter((x) => x.pct_tiempo_vacia > 15).length;
  const llenas = e.filter((x) => x.pct_tiempo_llena > 15).length;
  const trazas: Data[] = [
    {
      type: "scattermap",
      mode: "markers",
      lat: e.map((x) => x.lat),
      lon: e.map((x) => x.lon),
      marker: {
        size: e.map((x) => 6 + 1.6 * x.anclajes),
        color: e.map((x) => x[v.campo] as number),
        colorscale: ESCALA_AZUL,
        cmin: 0,
        colorbar: { title: { text: v.titulo, side: "right" }, thickness: 12, len: 0.6 },
        opacity: 0.9,
      },
      customdata: e.map((x) => [x.station_id, x.stock_inicial, x.anclajes, num(x.salidas / dias, 1), pc(x.ocupacion_media_pct, 0), pc(x.pct_tiempo_vacia), pc(x.pct_tiempo_llena)]),
      hovertemplate:
        "%{customdata[0]}<br>%{customdata[1]} patinetes al empezar el día, %{customdata[2]} anclajes<br>%{customdata[3]} salidas al día, ocupación media %{customdata[4]}<br>vacía %{customdata[5]} y llena %{customdata[6]} del tiempo<extra></extra>",
      showlegend: false,
    } as Data,
  ];
  return (
    <Bloque
      titulo="2. Estaciones de la red elegida"
      queMuestra={`Las ${e.length} estaciones de ${d.network_id} con el diseño ${P(d.cuantil)} y ${d.rebalanceo_base} recolocaciones por noche. El tamaño del punto son los anclajes y el color, la variable elegida.`}
      porQue="Es el catálogo que pide el enunciado. Las estaciones que pasan mucho tiempo vacías o llenas son las primeras candidatas a cambiar de tamaño o a recibir más rebalanceo."
      comoLeer="Vacía: sin ningún patinete. Llena: todos los anclajes ocupados o reservados por viajes en curso. Los porcentajes son sobre todas las horas del ajuste, también las de la noche."
      conclusiones={[
        `Las estaciones tienen una mediana de ${mediana(e.map((x) => x.anclajes))} anclajes y empiezan el día con una mediana de ${mediana(e.map((x) => x.stock_inicial))} patinetes. El tamaño sigue al uso: las estaciones con más salidas tienen más anclajes.`,
        `La estación mediana pasa el ${pc(mediana(e.map((x) => x.pct_tiempo_vacia)))} del tiempo vacía y el ${pc(mediana(e.map((x) => x.pct_tiempo_llena)))} llena. ${vacias} pasan más del 15 % del tiempo vacías y ${llenas}, más del 15 % llenas.`,
        `${num(d.resumen.viajes_con_desvio)} viajes atendidos se desvían a otra estación del radio, con ${num(d.resumen.desvio_medio_m)} m de más de media. Sin desvío se atendería el ${pc(d.resumen.pct_atendidos_sin_desvio)}.`,
      ]}
      fuente="tablas/movilidad/T32_estaciones.csv"
    >
      <div className="controles">
        <Segmentado etiqueta="Color de las estaciones" opciones={VISTAS} valor={vista} cambiar={setVista} />
      </div>
      <Grafica descripcion="Mapa de las estaciones con su número de anclajes y su tiempo vacías o llenas" trazas={trazas} alto={480} capa={capaMapa(11.6, 41.893)} />
      <TablaDesplegable
        titulo="Ver el catálogo de estaciones"
        cabeceras={["Estación", "Patinetes al empezar", "Anclajes", "Salidas", "Llegadas", "Salidas por anclaje y día", "Ocupación media", "Vacía", "Llena"]}
        numericas={[1, 2, 3, 4, 5, 6, 7, 8]}
        filas={[...e]
          .sort((a, b) => b.salidas - a.salidas)
          .map((x) => [x.station_id, num(x.stock_inicial), num(x.anclajes), num(x.salidas), num(x.llegadas), num(x.rotacion_dia, 2), pc(x.ocupacion_media_pct), pc(x.pct_tiempo_vacia), pc(x.pct_tiempo_llena)])}
      />
    </Bloque>
  );
}

function BloqueRebalanceo({ d }: { d: Inventario }) {
  const n = d.noches;
  const r = d.resumen;
  const agotadas = n.filter((x) => x.patinetes_movidos === d.rebalanceo_base).length;
  const kmNoche = n.reduce((s, x) => s + x.km, 0) / n.length;
  const pendientes = n.reduce((s, x) => s + x.deficit_despues, 0) / n.length;
  const res = d.reservada.filter((f) => f.periodo === "reservada");
  const resBase = res.find((f) => f.rebalanceo_max === d.rebalanceo_base)!;
  const trazas: Data[] = [
    {
      type: "bar",
      name: "Patinetes recolocados",
      x: n.map((x) => fecha(x.fecha)),
      y: n.map((x) => x.patinetes_movidos),
      marker: { color: COLOR.serie1 },
      hovertemplate: "%{x}: %{y} recolocados<extra></extra>",
    } as Data,
    {
      type: "bar",
      name: "Quedan por reponer",
      x: n.map((x) => fecha(x.fecha)),
      y: n.map((x) => x.deficit_despues),
      marker: { color: COLOR.serie2 },
      hovertemplate: "%{x}: %{y} sin reponer<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="3. Rechazos y rebalanceo nocturno"
      queMuestra={`Cada noche, a las ${d.hora_corte} h, cuántos patinetes se recolocan hacia el stock inicial (como mucho ${d.rebalanceo_base}) y cuántos quedan por reponer.`}
      porQue="Si el límite se agota casi todas las noches, el rebalanceo es un cuello de botella del servicio y merece la comparación de políticas de T33."
      comoLeer="Las barras de cada noche se apilan: la altura total es lo que faltaba antes de rebalancear. Se recoloca desde la estación con sobrante más cercana a la que más falta."
      conclusiones={[
        `De ${num(r.cubiertas)} viajes cubiertos se atienden ${num(r.n_atendido)}: se rechazan ${num(r.n_sin_patinete)} por falta de patinete y ${num(r.n_sin_anclaje)} por falta de anclaje.`,
        `El límite de ${d.rebalanceo_base} se agota en ${agotadas} de las ${n.length} noches, con unos ${num(kmNoche)} km por noche, y quedan de media ${num(pendientes)} patinetes por reponer.`,
        `Los ${num(r.flota)} patinetes hacen ${num(r.viajes_por_patinete_dia, 2)} viajes por patinete y día y están en viaje el ${pc(r.pct_tiempo_en_viaje)} del tiempo.`,
        <>
          En la semana reservada, con un 18 % más de demanda diaria, el mismo diseño atiende el <strong>{pc(resBase.pct_atendidos_cubiertos)}</strong> de{" "}
          {num(resBase.cubiertas)} viajes cubiertos: aguanta fuera de la muestra, por poco debajo del {d.servicio_objetivo} %.
        </>,
      ]}
      fuente="tablas/movilidad/T32_noches.csv y T32_reservada.csv"
    >
      <Grafica
        descripcion="Barras apiladas por noche de patinetes recolocados y patinetes que quedan por reponer"
        trazas={trazas}
        alto={300}
        capa={{
          barmode: "stack",
          legend: { x: 0.01, y: 1.12, orientation: "h" },
          yaxis: { title: { text: "Patinetes" } },
          xaxis: { type: "category", tickangle: -45 },
        }}
      />
      <TablaDesplegable
        titulo="Ver el diseño en el ajuste y en la semana reservada"
        cabeceras={["Periodo", "Recolocaciones por noche", "Solicitudes", "Cubiertas", "Atendidas", "Sin patinete", "Sin anclaje"]}
        numericas={[1, 2, 3, 4, 5, 6]}
        filas={d.reservada.map((f) => [f.periodo, num(f.rebalanceo_max), num(f.solicitudes), num(f.cubiertas), pc(f.pct_atendidos_cubiertos), num(f.n_sin_patinete), num(f.n_sin_anclaje)])}
      />
    </Bloque>
  );
}
