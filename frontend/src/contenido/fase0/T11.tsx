import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR, rgba, trazaEscalon, trazaTexto, trazasUmbral } from "../../graficas";
import { BloqueConcentracionEntregas, BloqueEncadenados } from "./Comprobaciones";

type Saltos = {
  bordes_m: number[];
  cuentas: number[];
  umbral_m: number;
  solapes: number;
  pares: number;
  cuantiles_m: Record<string, number>;
  sensibilidad: {
    umbral_m: number;
    saltos: number;
    porcentaje_encadenamientos: number;
    patinetes_con_salto: number;
    parado_h_mediana_con_salto: number;
    parado_h_mediana_sin_salto: number;
  }[];
};
type Parado = {
  bordes_h: number[];
  sin_salto: number[];
  con_salto: number[];
  umbral_m: number;
  horas_intradia: number;
  parado_h_mediana_con_salto: number;
  parado_h_mediana_sin_salto: number;
  recolocaciones_intradia_pc: number;
  recolocaciones_con_noche_pc: number;
};
type Puntos = { lat: number[]; lon: number[] };
type Mapa = { recogida: Puntos; entrega: Puntos; umbral_m: number; celdas_res10_recogida: number; celdas_res10_entrega: number };
type Resumen = {
  indicadores: Record<string, number>;
  por_dia: { fecha: string; viajes: number; patinetes_activos: number; recolocaciones: number }[];
};

const FASE = "fase0";

export function T11() {
  const { datos: r, error } = useDatos<Resumen>(`${FASE}/t11_resumen`);
  const i = r?.indicadores;
  return (
    <Seccion
      id="t11"
      tarea="T11"
      responsable="Javier Saguar"
      titulo="Solapes por patinete y recolocaciones del operador"
      notebook="exploracion/T11_recolocaciones.ipynb"
      objetivo="Saber si el piloto ya movía patinetes sin que hubiera un viaje (recolocaciones, recogidas para recargar o mantenimiento), cuántas veces, cuándo y dónde."
      valor="Con estaciones, los patinetes se recargan anclados y el operador solo tendría que rebalancear. Si el piloto ya dependía de mover patinetes, la simulación de flota tiene que incluir un escenario de rebalanceo."
    >
      {i ? (
        <Cifras
          cifras={[
            { valor: num(i.solapes), nombre: "solapes", detalle: `en ${num(i.encadenamientos)} pares de viajes` },
            {
              valor: num(i.recolocaciones),
              nombre: "recolocaciones",
              detalle: `${pc(i.recolocaciones_pc_encadenamientos)} de los pares (salto > ${i.umbral_recolocacion_m} m)`,
            },
            { valor: num(i.recolocaciones_por_dia_media, 1), nombre: "recolocaciones al día", detalle: "media del mes" },
            {
              valor: num(i.patinetes_recolocados),
              nombre: "patinetes recolocados",
              detalle: `de ${num(i.patinetes)} patinetes`,
            },
            {
              valor: `${num(i.recolocacion_parado_h_mediana, 1)} h`,
              nombre: "parado antes de reaparecer",
              detalle: `mediana; ${num(i.sin_salto_parado_h_mediana, 1)} h sin salto`,
            },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <BloqueSaltos />
      <BloqueSensibilidad />
      <BloqueParado />
      <BloqueMapa />
      {r && <BloquePorDia r={r} />}
      <BloqueEncadenados />
      <BloqueConcentracionEntregas />
    </Seccion>
  );
}

function BloqueSaltos() {
  const { datos: s, error } = useDatos<Saltos>(`${FASE}/t11_saltos`);
  if (!s) return <Cargando error={error} />;
  const alto = Math.max(...s.cuentas) * 1.15;
  const trazas: Data[] = [
    trazaEscalon({
      bordes: s.bordes_m,
      cuentas: s.cuentas,
      nombre: "Pares de viajes",
      color: COLOR.serie1,
      plantilla: "%{customdata[0]:,.3~r}–%{customdata[1]:,.3~r} m<br>%{y} pares de viajes<extra></extra>",
    }),
    ...trazasUmbral(s.umbral_m, alto * 0.75, `${s.umbral_m} m`),
    trazaTexto(15, alto * 0.93, "Ruido de GPS"),
    trazaTexto(4200, alto * 0.93 * 0.5, "Patinete movido sin viaje"),
  ];
  return (
    <Bloque
      titulo="1. Salto entre viajes consecutivos del mismo patinete"
      queMuestra={`Distancia en línea recta entre el punto donde acaba un viaje y el punto donde empieza el siguiente del mismo patinete, para los ${num(s.pares)} pares de viajes consecutivos del mes (incluidos los no elegibles, porque el patinete se movió igualmente).`}
      porQue="Si el patinete se queda donde lo dejaron, el salto es ruido de GPS. Un segundo grupo de saltos grandes es la huella de que alguien lo movió sin registrar un viaje, y el valle entre los dos grupos da un umbral objetivo para contar recolocaciones."
      comoLeer="El eje horizontal es logarítmico. La primera barra agrupa los saltos de menos de 1 m."
      conclusiones={[
        `No hay solapes: ningún patinete empieza un viaje antes de terminar el anterior (${s.solapes} casos).`,
        `La distribución tiene dos grupos claros. El primero es ruido de GPS (mediana ${num(s.cuantiles_m["0.5"], 1)} m, P75 ${num(s.cuantiles_m["0.75"], 1)} m). El segundo son saltos de varios kilómetros, con el pico entre 3 y 6 km.`,
        <>
          Entre los dos hay un valle casi vacío de unos 100 a 500 m. Se toma <strong>{s.umbral_m} m</strong> como umbral
          de recolocación, dentro del valle.
        </>,
      ]}
      fuente="figuras/exploracion/T11_saltos"
    >
      <Grafica
        descripcion="Histograma en escala logarítmica del salto entre viajes consecutivos del mismo patinete"
        trazas={trazas}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          xaxis: { type: "log", dtick: 1, exponentformat: "none", title: { text: "Salto entre viajes consecutivos (m)" }, range: [0, Math.log10(s.bordes_m[s.bordes_m.length - 1])] },
          yaxis: { title: { text: "Pares de viajes" }, range: [0, alto] },
        }}
      />
    </Bloque>
  );
}

function BloqueSensibilidad() {
  const { datos: s, error } = useDatos<Saltos>(`${FASE}/t11_saltos`);
  if (!s) return <Cargando error={error} />;
  const t = s.sensibilidad;
  const trazas: Data[] = [
    {
      type: "bar",
      x: t.map((x) => `${num(x.umbral_m)} m`),
      y: t.map((x) => x.saltos),
      customdata: t.map((x) => [pc(x.porcentaje_encadenamientos, 2), num(x.patinetes_con_salto), num(x.parado_h_mediana_con_salto, 1)]),
      marker: { color: t.map((x) => (x.umbral_m === s.umbral_m ? COLOR.serie1 : rgba(COLOR.serie1, 0.45))) },
      text: t.map((x) => num(x.saltos)),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate:
        "Umbral de %{x}<br>%{y} recolocaciones (%{customdata[0]} de los pares)<br>%{customdata[1]} patinetes · parada mediana %{customdata[2]} h<extra></extra>",
    } as Data,
  ];
  const elegido = t.find((x) => x.umbral_m === s.umbral_m)!;
  const mil = t.find((x) => x.umbral_m === 1000)!;
  return (
    <Bloque
      titulo="2. Sensibilidad al umbral de recolocación"
      queMuestra="Cuántas recolocaciones se cuentan con umbrales de 100 m a 2 km. La barra oscura es el umbral elegido."
      porQue="Si la cifra dependiera mucho del umbral, no se podría usar para dimensionar el rebalanceo. Si es estable, el umbral no es una decisión crítica."
      conclusiones={[
        `Con ${s.umbral_m} m hay ${num(elegido.saltos)} recolocaciones (${pc(elegido.porcentaje_encadenamientos)} de los pares consecutivos) que afectan a ${num(elegido.patinetes_con_salto)} patinetes.`,
        `La cifra es estable: de ${num(t[0].saltos)} con 100 m a ${num(mil.saltos)} con 1 km (${pc((100 * (mil.saltos - t[0].saltos)) / t[0].saltos, 0)}). Solo con 2 km cae más, porque el umbral se mete en el grupo de los saltos grandes.`,
      ]}
      fuente="tablas/exploracion/T11_saltos_sensibilidad.csv"
    >
      <Grafica
        descripcion="Barras con el número de recolocaciones según el umbral de salto"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          margin: { t: 20 },
          xaxis: { title: { text: "Umbral de salto" }, type: "category" },
          yaxis: { title: { text: "Recolocaciones" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

function BloqueParado() {
  const { datos: p, error } = useDatos<Parado>(`${FASE}/t11_parado`);
  const [modo, setModo] = useState<"recuento" | "porcentaje">("porcentaje");
  if (!p) return <Cargando error={error} />;
  const escala = (c: number[]) => {
    const total = c.reduce((a, b) => a + b, 0);
    return modo === "porcentaje" ? c.map((x) => (100 * x) / total) : c;
  };
  const sin = escala(p.sin_salto);
  const con = escala(p.con_salto);
  const alto = Math.max(...sin, ...con) * 1.18;
  const unidad = modo === "porcentaje" ? "%{y:.2f} % del grupo" : "%{y} pares";
  const trazas: Data[] = [
    trazaEscalon({
      bordes: p.bordes_h,
      cuentas: sin,
      nombre: `Salto ≤ ${p.umbral_m} m (el patinete sigue donde lo dejaron)`,
      color: COLOR.serie1,
      relleno: 0.25,
      plantilla: `Salto ≤ ${p.umbral_m} m<br>%{customdata[0]:,.3~r}–%{customdata[1]:,.3~r} h<br>${unidad}<extra></extra>`,
    }),
    trazaEscalon({
      bordes: p.bordes_h,
      cuentas: con,
      nombre: `Salto > ${p.umbral_m} m (recolocación)`,
      color: COLOR.serie2,
      relleno: 0.25,
      plantilla: `Salto > ${p.umbral_m} m<br>%{customdata[0]:,.3~r}–%{customdata[1]:,.3~r} h<br>${unidad}<extra></extra>`,
    }),
    ...trazasUmbral(p.horas_intradia, alto * 0.88, `${p.horas_intradia} h`, "left"),
    ...trazasUmbral(24, alto * 0.88, "1 día", "left"),
    ...trazasUmbral(168, alto * 0.88, "1 semana", "left"),
  ];
  return (
    <Bloque
      titulo="3. Cuándo: tiempo parado antes de reaparecer"
      queMuestra="Tiempo entre el final de un viaje y el inicio del siguiente del mismo patinete, separando los pares con recolocación (salto grande) de los que no la tienen."
      porQue="Distingue dos operaciones. Un rebalanceo durante el día mueve patinetes de donde sobran a donde faltan en pocas horas. Una recogida para recargar o reparar retira el patinete uno o varios días. Con estaciones de recarga la segunda desaparece."
      comoLeer="En porcentaje se comparan las formas de los dos grupos aunque tengan tamaños distintos; en recuento, el número de pares. El eje horizontal es logarítmico."
      conclusiones={[
        <>
          Un patinete recolocado ha estado parado una mediana de <strong>{num(p.parado_h_mediana_con_salto, 1)} h</strong>,
          frente a {num(p.parado_h_mediana_sin_salto, 1)} h cuando no hay salto.
        </>,
        `Solo el ${pc(p.recolocaciones_intradia_pc)} de las recolocaciones ocurre en menos de ${p.horas_intradia} h y el ${pc(p.recolocaciones_con_noche_pc)} incluye al menos una noche.`,
        "No es rebalanceo dentro del día: encaja con recogidas para recargar o mantener que devuelven el patinete días después. En el escenario de rebalanceo de la fase 1 el operador trabajará de noche.",
      ]}
      fuente="figuras/exploracion/T11_parado"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Escala"
          valor={modo}
          cambiar={setModo}
          opciones={[
            { valor: "porcentaje", texto: "% de cada grupo" },
            { valor: "recuento", texto: "Recuento" },
          ]}
        />
      </div>
      <Grafica
        descripcion="Histogramas del tiempo parado entre viajes con y sin recolocación"
        trazas={trazas}
        alto={360}
        capa={{
          margin: { t: 8 },
          legend: { y: 1.04 },
          xaxis: { type: "log", dtick: 1, exponentformat: "none", title: { text: "Tiempo parado entre viajes (h)" }, range: [-2, Math.log10(p.bordes_h[p.bordes_h.length - 1])] },
          yaxis: { title: { text: modo === "porcentaje" ? "% de los pares del grupo" : "Pares de viajes" }, range: [0, alto] },
        }}
      />
    </Bloque>
  );
}

function BloqueMapa() {
  const { datos: m, error } = useDatos<Mapa>(`${FASE}/t11_mapa`);
  const [capaVista, setCapaVista] = useState<"ambas" | "recogida" | "entrega">("ambas");
  if (!m) return <Cargando error={error} />;
  const punto = (p: Puntos, nombre: string, color: string): Data =>
    ({
      type: "scattermap",
      mode: "markers",
      lat: p.lat,
      lon: p.lon,
      name: nombre,
      marker: { size: 5, color, opacity: 0.55 },
      hovertemplate: `${nombre}<br>%{lat:.4f}, %{lon:.4f}<extra></extra>`,
    }) as Data;
  const trazas: Data[] = [
    ...(capaVista !== "entrega" ? [punto(m.recogida, "Dónde se recogen", COLOR.serie1)] : []),
    ...(capaVista !== "recogida" ? [punto(m.entrega, "Dónde reaparecen", COLOR.serie2)] : []),
  ];
  return (
    <Bloque
      titulo="4. Dónde recoge y dónde entrega el operador"
      queMuestra={`Cada punto es una recolocación (salto > ${m.umbral_m} m): en azul, el final del viaje anterior, donde se recoge el patinete; en naranja, el inicio del siguiente, donde reaparece.`}
      porQue="Si el operador devuelve los patinetes a pocos puntos, esos puntos son los que él considera buenos para empezar viajes: candidatos naturales a estación o a más stock inicial. El saldo por celda se contrastará con el de orígenes y destinos de T14."
      comoLeer="Usa los botones para ver cada capa por separado y la rueda del ratón para acercarte a un barrio."
      conclusiones={[
        <>
          Los patinetes se recogen por toda el área de servicio, pero reaparecen en muchos menos sitios:{" "}
          {num(m.celdas_res10_entrega)} celdas H3 de resolución 10 frente a {num(m.celdas_res10_recogida)} donde se
          recogen.
        </>,
        "El operador concentra las entregas en unos puntos de despliegue; la celda de resolución 8 que más recibe gana 90 patinetes netos en el mes.",
        "Esos puntos de despliegue son candidatos a estación o a más stock inicial, y su saldo se cruzará con el de T14.",
      ]}
      fuente="figuras/exploracion/T11_mapa_recolocaciones y tablas/exploracion/T11_celdas_res8.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Capa del mapa"
          valor={capaVista}
          cambiar={setCapaVista}
          opciones={[
            { valor: "ambas", texto: "Las dos" },
            { valor: "recogida", texto: "Dónde se recogen" },
            { valor: "entrega", texto: "Dónde reaparecen" },
          ]}
        />
      </div>
      <Grafica
        descripcion="Mapa de Roma con los puntos de recogida y de reaparición de los patinetes recolocados"
        trazas={trazas}
        alto={480}
        capa={{
          margin: { l: 0, r: 0, t: 0, b: 0 },
          legend: { x: 0.01, y: 0.99, yanchor: "top", bgcolor: "rgba(255,255,255,0.85)" },
          map: { style: "carto-positron", center: { lat: 41.895, lon: 12.49 }, zoom: 11.3 },
        }}
      />
    </Bloque>
  );
}

function BloquePorDia({ r }: { r: Resumen }) {
  const d = r.por_dia;
  const linea = (y: number[], nombre: string, color: string): Data =>
    ({
      type: "scatter",
      mode: "lines+markers",
      x: d.map((x) => x.fecha),
      y,
      name: nombre,
      line: { color, width: 2 },
      marker: { size: 8, color, line: { color: "#fff", width: 2 } },
      hovertemplate: `${nombre}: %{y}<extra></extra>`,
    }) as Data;
  const trazas: Data[] = [
    linea(d.map((x) => x.patinetes_activos), "Patinetes usados", COLOR.serie1),
    linea(d.map((x) => x.recolocaciones), "Patinetes recolocados", COLOR.serie2),
  ];
  const media = d.reduce((a, x) => a + x.patinetes_activos, 0) / d.length;
  const min = Math.min(...d.map((x) => x.patinetes_activos));
  const max = Math.max(...d.map((x) => x.patinetes_activos));
  return (
    <Bloque
      titulo="5. Recolocaciones por día"
      queMuestra="Cuántos patinetes distintos se usan cada día y cuántos reaparecen ese día después de una recolocación."
      porQue="Da el orden de magnitud del trabajo del operador hoy, que es la referencia con la que se comparará el rebalanceo de la red con estaciones."
      comoLeer="Pasa el ratón por un día para comparar las dos series."
      conclusiones={[
        <>
          El operador recoloca de media <strong>{num(r.indicadores.recolocaciones_por_dia_media, 1)} patinetes al día</strong>, con
          un salto mediano de {num(r.indicadores.recolocacion_salto_km_mediana, 2)} km.
        </>,
        `Cada día se usan de media ${num(media)} patinetes distintos (entre ${num(min)} y ${num(max)}), así que el operador mueve cada día el equivalente a un tercio de la flota activa.`,
        "Con estaciones de recarga desaparecen las recogidas para cargar. La pregunta para la simulación es cuánto rebalanceo nocturno queda por la acumulación de patinetes que mida T14.",
      ]}
      fuente="tablas/exploracion/T11_por_dia.csv y T11_resumen.csv"
    >
      <Grafica
        descripcion="Series diarias de patinetes usados y patinetes recolocados en febrero de 2021"
        trazas={trazas}
        alto={340}
        capa={{
          hovermode: "x unified",
          margin: { t: 8 },
          xaxis: { type: "date", tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01", hoverformat: "%A %d/%m" },
          yaxis: { title: { text: "Patinetes" }, rangemode: "tozero" },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla por día"
        cabeceras={["Fecha", "Viajes", "Patinetes usados", "Recolocaciones"]}
        numericas={[1, 2, 3]}
        filas={d.map((x) => [x.fecha, num(x.viajes), num(x.patinetes_activos), num(x.recolocaciones)])}
      />
    </Bloque>
  );
}
