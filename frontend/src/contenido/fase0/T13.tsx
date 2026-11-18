import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR, ESCALA_AZUL, capaMapa, rgba, trazaCeldas, trazaCeldasColor, trazaReferencias, type Celda } from "../../graficas";

type Densidad = {
  res: number;
  referencias: Record<string, [number, number]>;
  celdas: (Celda & { origenes: number; destinos: number })[];
};
type FilaConcentracion = {
  res: number;
  celdas_con_demanda: number;
  extremos: number;
  celdas_50pct: number;
  celdas_80pct: number;
  celdas_90pct: number;
  celdas_95pct: number;
  area_50pct_km2: number;
  area_80pct_km2: number;
  area_90pct_km2: number;
  area_95pct_km2: number;
  pct_extremos_top10pct_celdas: number;
  pct_extremos_top20pct_celdas: number;
};
type Concentracion = {
  curvas: { res8: number[]; res9: number[] };
  tabla: FilaConcentracion[];
  estaciones: { radio_m: number; cuota_pct: number; celdas: number; area_km2: number; area_por_estacion_km2: number; estaciones_orden_magnitud: number }[];
};
type Estabilidad = {
  res: number;
  celdas_ajuste: number;
  celdas_reservada: number;
  celdas_solo_reservada: number;
  spearman_cuotas: number;
  pct_extremos_reservada_en_celdas_ajuste: number;
}[];
type Aislados = {
  resumen: { celdas_con_extremos: number; celdas_densas: number; celdas_poco_usadas: number; celdas_aisladas: number; extremos_aislados: number }[];
  puntos: { trip_id: number; extremo: string; h3: string; lat: number; lon: number; dist_celda_densa_m: number; elegible: boolean; motivo: string }[];
  celdas: (Celda & { extremos: number })[];
};

const FASE = "fase0";

export function T13() {
  const { datos: c, error } = useDatos<Concentracion>(`${FASE}/t13_concentracion`);
  const { datos: e } = useDatos<Estabilidad>(`${FASE}/t13_estabilidad`);
  const r8 = c?.tabla.find((t) => t.res === 8);
  const r9 = c?.tabla.find((t) => t.res === 9);
  return (
    <Seccion
      id="t13"
      tarea="T13"
      responsable="Alejandro Cuevas"
      titulo="Densidad de orígenes y destinos en H3 y concentración de la demanda"
      notebook="exploracion/T13_densidad.ipynb"
      objetivo="Ver dónde empiezan y acaban los viajes en una rejilla hexagonal H3 y cuántas celdas concentran la demanda."
      valor="Fija la resolución de la rejilla de candidatos a estación y el rango de número de estaciones que se barre en la fase 1. También comprueba que la demanda de la semana reservada cae en las mismas zonas que la del ajuste y busca extremos aislados para la limpieza."
    >
      {r8 && r9 && e ? (
        <Cifras
          cifras={[
            { valor: num(r8.celdas_con_demanda), nombre: "celdas de resolución 8", detalle: "531 m de arista; mapas y matrices OD" },
            { valor: num(r9.celdas_con_demanda), nombre: "celdas de resolución 9", detalle: "201 m de arista; candidatos a estación" },
            { valor: `${r8.celdas_50pct} / ${r8.celdas_80pct} / ${r8.celdas_95pct}`, nombre: "celdas con el 50 / 80 / 95 %", detalle: "de los extremos, en resolución 8" },
            { valor: num(e[0].spearman_cuotas, 2), nombre: "Spearman ajuste–reservada", detalle: "cuotas por celda en resolución 8" },
            { valor: "1", nombre: "extremo aislado", detalle: "y ya no era elegible" },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <BloqueDensidad />
      <BloqueConcentracion />
      <BloqueEstaciones />
      <BloqueAislados />
      <BloqueEstabilidad />
    </Seccion>
  );
}

function BloqueDensidad() {
  const { datos: d, error } = useDatos<Densidad>(`${FASE}/t13_densidad`);
  const [variable, setVariable] = useState<"extremos" | "origenes" | "destinos">("extremos");
  if (!d) return <Cargando error={error} />;
  const valor = (x: Densidad["celdas"][number]) =>
    variable === "extremos" ? x.origenes + x.destinos : variable === "origenes" ? x.origenes : x.destinos;
  const z = d.celdas.map(valor);
  const max = Math.max(...d.celdas.map((x) => x.origenes + x.destinos));
  const etiqueta = { extremos: "Orígenes + destinos", origenes: "Orígenes", destinos: "Destinos" }[variable];
  const trazas: Data[] = [
    trazaCeldas({
      celdas: d.celdas,
      z,
      escala: ESCALA_AZUL,
      zmin: 0,
      zmax: variable === "extremos" ? max : max / 2,
      titulo: `${etiqueta} (1–21/02)`,
      customdata: d.celdas.map((x) => [x.origenes, x.destinos]),
      plantilla: "%{location}<br>%{customdata[0]} orígenes · %{customdata[1]} destinos<extra></extra>",
    }),
    trazaReferencias(d.referencias),
  ];
  const top = [...d.celdas].sort((a, b) => b.origenes + b.destinos - (a.origenes + a.destinos))[0];
  return (
    <Bloque
      titulo="1. Densidad de orígenes y destinos"
      queMuestra={`Cuántos viajes elegibles del periodo de ajuste empiezan y acaban en cada una de las ${d.celdas.length} celdas H3 de resolución ${d.res} con demanda.`}
      porQue="La arista de la celda tiene que ser del orden del radio de acceso a una estación para que cada celda sea un candidato razonable, y el mapa dice dónde buscar estaciones."
      comoLeer="Cambia entre orígenes, destinos o la suma de los dos. Pasa el ratón por una celda para ver sus cifras y usa la rueda para acercarte."
      conclusiones={[
        "En el ajuste hay demanda en 111 celdas de resolución 8 (0,74 km² y 531 m de arista media) y en 600 de resolución 9 (0,105 km² y 201 m). La mediana es de 190 extremos por celda en resolución 8 y de 32 en resolución 9.",
        `Orígenes y destinos ocupan las mismas celdas. La que más extremos reúne (${num(top.origenes + top.destinos)}) está al sureste del Coliseo; le siguen otras del este y del suroeste y la del centro, entre San Pedro y Termini.`,
        <>
          La <strong>resolución 9</strong> tiene una arista del orden del radio de acceso (200 m): es la rejilla de los
          candidatos. La resolución 8 se queda para mapas, saldos y matrices OD.
        </>,
      ]}
      fuente="figuras/exploracion/T13_densidad_res8 y tablas/exploracion/T13_densidad_celdas.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Variable del mapa"
          valor={variable}
          cambiar={setVariable}
          opciones={[
            { valor: "extremos", texto: "Orígenes + destinos" },
            { valor: "origenes", texto: "Orígenes" },
            { valor: "destinos", texto: "Destinos" },
          ]}
        />
      </div>
      <Grafica descripcion="Mapa de Roma con los viajes que empiezan y acaban en cada celda H3 de resolución 8" trazas={trazas} alto={480} capa={capaMapa()} />
    </Bloque>
  );
}

function BloqueConcentracion() {
  const { datos: c, error } = useDatos<Concentracion>(`${FASE}/t13_concentracion`);
  if (!c) return <Cargando error={error} />;
  const curva = (y: number[], nombre: string, color: string): Data =>
    ({
      type: "scatter",
      mode: "lines",
      name: nombre,
      x: [0, ...y.map((_, i) => (100 * (i + 1)) / y.length)],
      y: [0, ...y],
      customdata: [0, ...y.map((_, i) => i + 1)],
      line: { color, width: 2 },
      hovertemplate: `${nombre}<br>%{customdata} celdas (%{x:.1f} %) reúnen el %{y:.1f} % de los extremos<extra></extra>`,
    }) as Data;
  const [r8, r9] = [c.tabla.find((t) => t.res === 8)!, c.tabla.find((t) => t.res === 9)!];
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: [0, 100],
      y: [0, 100],
      name: "Demanda repartida por igual",
      line: { color: COLOR.eje, width: 1.3, dash: "dot" },
      hoverinfo: "skip",
    } as Data,
    curva(c.curvas.res8, `Resolución 8 (${r8.celdas_con_demanda} celdas)`, COLOR.serie1),
    curva(c.curvas.res9, `Resolución 9 (${r9.celdas_con_demanda} celdas)`, COLOR.serie2),
  ];
  return (
    <Bloque
      titulo="2. Concentración de la demanda"
      queMuestra="Las celdas ordenadas de más a menos usadas y el porcentaje acumulado de orígenes y destinos que reúnen, en resolución 8 y 9."
      porQue="El número de celdas que reúnen casi toda la demanda acota cuántas estaciones tiene sentido probar en la fase 1."
      comoLeer="Cuanto más se separa una curva de la diagonal, más concentrada está la demanda. El eje horizontal es el porcentaje de celdas para comparar las dos resoluciones."
      conclusiones={[
        `La demanda está repartida: en resolución 8, ${r8.celdas_50pct} celdas reúnen el 50 % de los extremos, ${r8.celdas_80pct} el 80 % y ${r8.celdas_95pct} el 95 %; en resolución 9, ${r9.celdas_50pct}, ${r9.celdas_80pct} y ${r9.celdas_95pct}.`,
        `El 20 % de celdas más usadas reúne el ${pc(r8.pct_extremos_top20pct_celdas)} de los extremos en resolución 8 y el ${pc(r9.pct_extremos_top20pct_celdas)} en resolución 9.`,
      ]}
      fuente="figuras/exploracion/T13_concentracion y tablas/exploracion/T13_concentracion.csv"
    >
      <Grafica
        descripcion="Curvas de concentración de los extremos de viaje por celda H3 en resolución 8 y 9"
        trazas={trazas}
        alto={360}
        capa={{
          hovermode: "closest",
          margin: { t: 8 },
          xaxis: { title: { text: "Celdas, de más a menos usadas (%)" }, range: [0, 100], ticksuffix: " %" },
          yaxis: { title: { text: "Extremos acumulados (%)" }, range: [0, 101], ticksuffix: " %" },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla de concentración"
        cabeceras={["Resolución", "Celdas con demanda", "Celdas 50 %", "Celdas 80 %", "Celdas 90 %", "Celdas 95 %", "Área 95 % (km²)"]}
        numericas={[1, 2, 3, 4, 5, 6]}
        filas={c.tabla.map((t) => [
          t.res,
          num(t.celdas_con_demanda),
          num(t.celdas_50pct),
          num(t.celdas_80pct),
          num(t.celdas_90pct),
          num(t.celdas_95pct),
          num(t.area_95pct_km2, 1),
        ])}
      />
    </Bloque>
  );
}

function BloqueEstaciones() {
  const { datos: c, error } = useDatos<Concentracion>(`${FASE}/t13_concentracion`);
  if (!c) return <Cargando error={error} />;
  const radios = [...new Set(c.estaciones.map((x) => x.radio_m))];
  // Los radios están ordenados: un solo tono, de claro a oscuro.
  const colores = ["#86b6ef", "#3987e5", "#256abf", "#0d366b"];
  const trazas: Data[] = radios.map(
    (r, i) =>
      ({
        type: "bar",
        name: `Radio de ${r} m`,
        x: c.estaciones.filter((x) => x.radio_m === r).map((x) => `${x.cuota_pct} %`),
        y: c.estaciones.filter((x) => x.radio_m === r).map((x) => x.estaciones_orden_magnitud),
        customdata: c.estaciones.filter((x) => x.radio_m === r).map((x) => [x.celdas, num(x.area_km2, 1)]),
        marker: { color: colores[i] },
        hovertemplate: `Radio de ${r} m<br>%{y} estaciones para el %{x} de los extremos<br>%{customdata[0]} celdas de resolución 9, %{customdata[1]} km²<extra></extra>`,
      }) as Data,
  );
  const rango = (r: number) => {
    const f = c.estaciones.filter((x) => x.radio_m === r && (x.cuota_pct === 80 || x.cuota_pct === 95)).map((x) => x.estaciones_orden_magnitud);
    return `${Math.min(...f)}–${Math.max(...f)}`;
  };
  return (
    <Bloque
      titulo="3. Orden de magnitud del número de estaciones"
      queMuestra="Cuántos círculos de radio R, colocados en malla hexagonal, hacen falta para cubrir el área de las celdas de resolución 9 que reúnen el 50, 80, 90 y 95 % de los extremos."
      porQue="Da el rango de número de estaciones (k) que barrerá la fase 1 para cada radio de acceso, antes de localizar ninguna."
      comoLeer="Cada grupo de barras es una cuota de demanda; cada color, un radio de acceso."
      conclusiones={[
        <>
          Cubrir del 80 al 95 % de los extremos pide <strong>{rango(200)} estaciones con 200 m</strong>, {rango(250)} con
          250 m, {rango(300)} con 300 m y {rango(400)} con 400 m. Es el rango del barrido de k de la fase 1, ampliado un 20 % por
          cada lado.
        </>,
        "Es una cuenta de área: supone demanda uniforme dentro de cada celda y no sustituye a la localización.",
      ]}
      fuente="tablas/exploracion/T13_estaciones_orden_magnitud.csv"
    >
      <Grafica
        descripcion="Barras agrupadas con el número de estaciones necesario según la cuota de demanda y el radio de acceso"
        trazas={trazas}
        alto={340}
        capa={{
          barmode: "group",
          bargap: 0.25,
          bargroupgap: 0.08,
          margin: { t: 8 },
          xaxis: { title: { text: "Cuota de los extremos que se cubre" }, type: "category" },
          yaxis: { title: { text: "Estaciones (orden de magnitud)" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

function BloqueAislados() {
  const { datos: a, error } = useDatos<Aislados>(`${FASE}/t13_aislados`);
  if (!a) return <Cargando error={error} />;
  const r = a.resumen[0];
  const grupo = (f: (n: number) => boolean) => a.celdas.filter((x) => f(x.extremos));
  const plantilla = "%{location}<br>%{customdata} extremos en el mes<extra></extra>";
  const capaGrupo = (celdas: Aislados["celdas"], color: string, nombre: string) =>
    trazaCeldasColor(celdas, color, nombre, plantilla, celdas.map((x) => x.extremos));
  const p = a.puntos[0];
  const trazas: Data[] = [
    capaGrupo(grupo((n) => n >= 10), rgba(COLOR.serie1, 0.35), "10 o más extremos"),
    capaGrupo(grupo((n) => n > 2 && n < 10), "#9aa7b3", "De 3 a 9"),
    capaGrupo(grupo((n) => n <= 2), COLOR.serie2, "2 o menos"),
    {
      type: "scattermap",
      mode: "markers",
      lat: a.puntos.map((x) => x.lat),
      lon: a.puntos.map((x) => x.lon),
      name: "Extremo aislado",
      marker: { size: 13, color: COLOR.texto },
      customdata: a.puntos.map((x) => [x.trip_id, x.extremo, num(x.dist_celda_densa_m), x.motivo]),
      hovertemplate:
        "Viaje %{customdata[0]} (%{customdata[1]})<br>a %{customdata[2]} m de una celda con demanda<br>no elegible: %{customdata[3]}<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="4. Puntos aislados"
      queMuestra="Las celdas de resolución 8 con extremos de cualquier viaje del mes, según cuántos tienen, y los extremos cuya celda tiene 2 o menos y está a más de 1 km de la celda más cercana con 10 o más."
      porQue="Esos extremos serían candidatos a una marca fuera_de_zona en la limpieza: puntos donde nunca tendría sentido una estación."
      comoLeer="El punto oscuro es el único extremo aislado. Se usan todos los viajes del CSV, no solo los elegibles."
      conclusiones={[
        `De las ${r.celdas_con_extremos} celdas con extremos en el mes, ${r.celdas_densas} tienen 10 o más y ${r.celdas_poco_usadas} tienen 2 o menos. Solo una de estas está a más de 1 km de una celda con demanda.`,
        <>
          Sale <strong>un único extremo aislado</strong>: el {p.extremo} del viaje {p.trip_id}, que ya no es elegible por{" "}
          <code>{p.motivo}</code>. No hace falta otra regla de limpieza.
        </>,
      ]}
      fuente="figuras/exploracion/T13_puntos_aislados y tablas/exploracion/T13_puntos_aislados.csv"
    >
      <Grafica
        descripcion="Mapa de las celdas H3 de resolución 8 según su número de extremos y el único extremo aislado"
        trazas={trazas}
        alto={480}
        capa={capaMapa(10.2, 41.866)}
      />
    </Bloque>
  );
}

function BloqueEstabilidad() {
  const { datos: e, error } = useDatos<Estabilidad>(`${FASE}/t13_estabilidad`);
  if (!e) return <Cargando error={error} />;
  const trazas: Data[] = [
    {
      type: "bar",
      orientation: "h",
      y: e.map((x) => `Resolución ${x.res}`),
      x: e.map((x) => x.spearman_cuotas),
      text: e.map((x) => num(x.spearman_cuotas, 2)),
      textposition: "outside",
      cliponaxis: false,
      marker: { color: COLOR.serie1 },
      customdata: e.map((x) => [x.celdas_ajuste, x.celdas_reservada, x.celdas_solo_reservada, num(x.pct_extremos_reservada_en_celdas_ajuste, 2)]),
      hovertemplate:
        "%{y}: Spearman %{x:.3f}<br>%{customdata[0]} celdas en el ajuste, %{customdata[1]} en la reservada<br>%{customdata[2]} celdas nuevas; el %{customdata[3]} % de los extremos de la reservada cae en celdas del ajuste<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="5. Estabilidad entre periodos"
      queMuestra="La correlación de Spearman entre la cuota de demanda de cada celda en el ajuste y en la semana reservada, y qué parte de los extremos de la reservada cae en celdas que ya tenían demanda en el ajuste."
      porQue="Los candidatos se eligen con el ajuste y la red se valida con la semana reservada. Si la demanda cambiara de sitio, la validación no tendría sentido."
      conclusiones={[
        `La demanda es estable en el espacio: Spearman de ${num(e[0].spearman_cuotas, 2)} en resolución 8 y ${num(e[1].spearman_cuotas, 2)} en resolución 9.`,
        `El ${pc(e[0].pct_extremos_reservada_en_celdas_ajuste, 2)} (resolución 8) y el ${pc(e[1].pct_extremos_reservada_en_celdas_ajuste, 2)} (resolución 9) de los extremos de la reservada caen en celdas que ya tenían demanda en el ajuste. Solo aparecen ${e[0].celdas_solo_reservada} y ${e[1].celdas_solo_reservada} celdas nuevas.`,
        "Los candidatos del ajuste sirven para validar con la semana reservada.",
      ]}
      fuente="tablas/exploracion/T13_estabilidad.csv"
    >
      <Grafica
        descripcion="Correlación de Spearman entre las cuotas de demanda por celda del ajuste y de la semana reservada"
        trazas={trazas}
        alto={200}
        capa={{
          showlegend: false,
          margin: { t: 8, r: 40 },
          xaxis: { title: { text: "Spearman entre cuotas por celda" }, range: [0, 1] },
          yaxis: { autorange: "reversed" },
        }}
      />
    </Bloque>
  );
}
