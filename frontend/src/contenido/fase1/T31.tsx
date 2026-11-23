// T31: asignación de viajes a estaciones y matriz estación → estación de la red elegida.
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR, capaMapa, rgba } from "../../graficas";

type Conciliacion = { resultado: string; viajes: number; pct_solicitudes: number; pct_cubiertas: number | null };
type Acceso = { extremo: string; medida: string; media_m: number; mediana_m: number; p90_m: number; pct_desviados: number };
type Indicador = { indicador: string; asignables: number; atendidos: number };
type Par = { origen: string; destino: string; distancia_m: number; asignables: number; atendidos: number };
type Estacion = {
  station_id: string;
  lon: number;
  lat: number;
  salidas_atendidas: number;
  llegadas_atendidas: number;
  rechazos_sin_patinete: number;
  rechazos_sin_anclaje: number;
  saldo_punta_manana: number;
  saldo_punta_tarde: number;
};
type Asignacion = {
  network_id: string;
  radio_m: number;
  factor_rodeo: number;
  conciliacion: Conciliacion[];
  acceso: Acceso[];
  indicadores: Indicador[];
  pares_top: Par[];
  estaciones: Estacion[];
  correlacion_saldo_puntas: number;
  laborables: number;
};

const RESULTADOS: Record<string, string> = {
  atendido: "Atendido",
  sin_patinete: "Sin patinete en el origen",
  sin_anclaje: "Sin anclaje en el destino",
  sin_cobertura: "Sin estación a 300 m en algún extremo",
};

export function T31() {
  const { datos: d, error } = useDatos<Asignacion>("fase1/t31_asignacion");
  return (
    <Seccion
      id="t31"
      tarea="T31"
      responsable="Alejandro Cuevas"
      titulo="Asignación de viajes y matriz estación → estación"
      notebook="movilidad/T31_asignacion_estaciones.ipynb"
      objetivo="Asignar cada viaje del ajuste a las estaciones de la red elegida y construir la matriz origen-destino entre estaciones, sin límites de capacidad y con los viajes que atiende la simulación de T32."
      valor="La tabla de asignación por viaje es la entrada de la fase de consumo y de la estación de recarga. Las matrices dicen cómo se reparten los flujos entre estaciones y dónde se pierde servicio."
    >
      {d ? <Contenido d={d} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function Contenido({ d }: { d: Asignacion }) {
  const c = Object.fromEntries(d.conciliacion.map((f) => [f.resultado, f]));
  const ind = Object.fromEntries(d.indicadores.map((f) => [f.indicador, f]));
  const origen = d.acceso.find((f) => f.extremo === "origen" && f.medida === "linea_recta")!;
  return (
    <>
      <Cifras
        cifras={[
          { valor: num(c.atendido.viajes), nombre: "viajes atendidos", detalle: `${pc(c.atendido.pct_solicitudes)} de las solicitudes del ajuste` },
          { valor: num(ind.pares_con_viajes.atendidos), nombre: "pares de estaciones con viajes", detalle: `${pc(ind.pct_pares_posibles.atendidos)} de los posibles` },
          { valor: pc(ind.pct_mismo_origen_destino.atendidos), nombre: "vuelven a su estación", detalle: "viajes circulares" },
          { valor: `${num(origen.media_m)} m`, nombre: "acceso medio en el origen", detalle: `en línea recta; P90 de ${num(origen.p90_m)} m` },
        ]}
      />
      <BloqueConciliacion d={d} />
      <BloqueFlujos d={d} />
      <BloqueSaldo d={d} />
    </>
  );
}

function BloqueConciliacion({ d }: { d: Asignacion }) {
  const total = d.conciliacion.reduce((s, f) => s + f.viajes, 0);
  const c = Object.fromEntries(d.conciliacion.map((f) => [f.resultado, f]));
  const colores: Record<string, string> = {
    atendido: COLOR.serie1,
    sin_patinete: COLOR.serie2,
    sin_anclaje: rgba(COLOR.serie2, 0.55),
    sin_cobertura: COLOR.eje,
  };
  const trazas: Data[] = d.conciliacion.map(
    (f) =>
      ({
        type: "bar",
        orientation: "h",
        name: RESULTADOS[f.resultado],
        y: ["Solicitudes"],
        x: [f.viajes],
        marker: { color: colores[f.resultado] },
        hovertemplate: `${RESULTADOS[f.resultado]}: %{x} viajes (${pc(f.pct_solicitudes)})<extra></extra>`,
      }) as Data,
  );
  const acc = (extremo: string, medida: string) => d.acceso.find((f) => f.extremo === extremo && f.medida === medida)!;
  return (
    <Bloque
      titulo="1. Qué le pasa a cada solicitud"
      queMuestra={`Las ${num(total)} solicitudes del ajuste según su resultado en la simulación de T32 con la red ${d.network_id}.`}
      porQue="Cada viaje tiene que tener un único resultado y las cuentas tienen que cuadrar con T32: es la tabla que leen consumo y recarga."
      comoLeer={`Un viaje está cubierto si tiene estación a ${d.radio_m} m o menos en los dos extremos. La distancia a pie se estima con el factor de rodeo de T15 (${num(d.factor_rodeo, 3)}).`}
      conclusiones={[
        `Se atienden ${num(c.atendido.viajes)} viajes (${pc(c.atendido.pct_cubiertas!)} de los cubiertos). Se pierden ${num(c.sin_patinete.viajes)} por falta de patinete, ${num(c.sin_anclaje.viajes)} por falta de anclaje y ${num(c.sin_cobertura.viajes)} no tienen estación cerca.`,
        `La estación queda de media a ${num(acc("origen", "linea_recta").media_m)} m en línea recta en el origen y a ${num(acc("destino", "linea_recta").media_m)} m en el destino; a pie, unos ${num(acc("origen", "a_pie_estimada").media_m)} y ${num(acc("destino", "a_pie_estimada").media_m)} m.`,
        `Solo el ${pc(acc("origen", "linea_recta").pct_desviados)} de los orígenes atendidos acaba en una estación que no es la más cercana.`,
      ]}
      fuente="tablas/movilidad/T31_conciliacion.csv y T31_acceso.csv"
    >
      <Grafica
        descripcion="Barra apilada de las solicitudes del ajuste por resultado"
        trazas={trazas}
        alto={210}
        capa={{ barmode: "stack", legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", traceorder: "normal" }, margin: { t: 60 }, xaxis: { title: { text: "Viajes" } }, yaxis: { showticklabels: false } }}
      />
    </Bloque>
  );
}

function BloqueFlujos({ d }: { d: Asignacion }) {
  const pos = new Map(d.estaciones.map((e) => [e.station_id, e]));
  const pares = d.pares_top;
  const max = Math.max(...pares.map((p) => p.atendidos));
  const tramos = [
    { desde: 0.5, ancho: 6, alfa: 0.85 },
    { desde: 0.25, ancho: 3.5, alfa: 0.6 },
    { desde: 0, ancho: 1.5, alfa: 0.35 },
  ];
  const usados = new Set<Par>();
  const lineas: Data[] = tramos.map((t) => {
    const lon: (number | null)[] = [];
    const lat: (number | null)[] = [];
    for (const p of pares) {
      if (usados.has(p) || p.atendidos < t.desde * max) continue;
      usados.add(p);
      const a = pos.get(p.origen)!;
      const b = pos.get(p.destino)!;
      lon.push(a.lon, b.lon, null);
      lat.push(a.lat, b.lat, null);
    }
    return {
      type: "scattermap",
      mode: "lines",
      lon,
      lat,
      line: { color: rgba(COLOR.serie1, t.alfa), width: t.ancho },
      hoverinfo: "skip",
      name: t.desde > 0 ? `Más de ${Math.round(t.desde * max)} viajes` : "Resto de los 200 pares",
    } as Data;
  });
  const e = d.estaciones;
  const maxSal = Math.max(...e.map((x) => x.salidas_atendidas));
  const puntos: Data = {
    type: "scattermap",
    mode: "markers",
    lon: e.map((x) => x.lon),
    lat: e.map((x) => x.lat),
    marker: { size: e.map((x) => 4 + 14 * Math.sqrt(x.salidas_atendidas / maxSal)), color: COLOR.texto, opacity: 0.85 },
    customdata: e.map((x) => [x.station_id, x.salidas_atendidas, x.llegadas_atendidas]),
    hovertemplate: "%{customdata[0]}<br>%{customdata[1]} salidas y %{customdata[2]} llegadas atendidas<extra></extra>",
    name: "Estaciones (tamaño: salidas)",
  } as Data;
  const orden = pares.map((p) => p.distancia_m).sort((a, b) => a - b);
  const m = orden.length / 2;
  const mediana = orden.length % 2 ? orden[Math.floor(m)] : (orden[m - 1] + orden[m]) / 2;
  const top10 = d.indicadores.find((f) => f.indicador === "pct_top10_pares")!;
  const asim = d.indicadores.find((f) => f.indicador === "asimetria_pct")!;
  const azar = d.indicadores.find((f) => f.indicador === "asimetria_aleatoria_pct")!;
  return (
    <Bloque
      titulo="2. Líneas de deseo entre estaciones"
      queMuestra={`Los ${pares.length} pares de estaciones distintas con más viajes atendidos. El grosor de la línea crece con los viajes del par y el tamaño de cada estación, con sus salidas.`}
      porQue="Es la matriz estación → estación que completa el primer requisito del enunciado con la red propuesta. Dice si la operación se parece a unas pocas líneas fuertes o a una red repartida."
      comoLeer="Las líneas son rectas entre estaciones y representan flujos agregados de todo el ajuste, no recorridos."
      conclusiones={[
        `La demanda está muy repartida: los diez pares más fuertes solo suman el ${pc(top10.atendidos)} de los viajes atendidos.`,
        `Los flujos fuertes son cortos: los ${pares.length} pares de la figura unen estaciones a ${num(mediana)} m de mediana.`,
        `La asimetría entre ida y vuelta (${pc(asim.atendidos)}) es poco mayor que la que darían viajes de ida o vuelta al azar (${pc(azar.atendidos)}). El desequilibrio que importa es el saldo de cada estación.`,
      ]}
      fuente="tablas/movilidad/T31_matriz_estaciones.csv y T31_indicadores.csv"
    >
      <Grafica descripcion="Mapa de las líneas de deseo entre las estaciones de la red elegida" trazas={[...lineas.reverse(), puntos]} alto={480} capa={capaMapa(11.6, 41.893)} />
      <TablaDesplegable
        titulo="Ver los 20 pares con más viajes"
        cabeceras={["Origen", "Destino", "Distancia (m)", "Asignables", "Atendidos"]}
        numericas={[2, 3, 4]}
        filas={pares.slice(0, 20).map((p) => [p.origen, p.destino, num(p.distancia_m), num(p.asignables), num(p.atendidos)])}
      />
    </Bloque>
  );
}

function BloqueSaldo({ d }: { d: Asignacion }) {
  const e = d.estaciones;
  const n = d.laborables;
  const opuestos = e.filter((x) => x.saldo_punta_manana * x.saldo_punta_tarde < 0).length;
  const mismo = e.filter((x) => x.saldo_punta_manana * x.saldo_punta_tarde > 0).length;
  const rech = e.map((x) => x.rechazos_sin_patinete + x.rechazos_sin_anclaje).sort((a, b) => b - a);
  const totalRech = rech.reduce((s, x) => s + x, 0);
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "markers",
      x: e.map((x) => x.saldo_punta_manana / n),
      y: e.map((x) => x.saldo_punta_tarde / n),
      marker: { color: COLOR.serie1, size: 8, opacity: 0.7 },
      customdata: e.map((x) => [x.station_id, x.saldo_punta_manana, x.saldo_punta_tarde]),
      hovertemplate: "%{customdata[0]}<br>mañana %{customdata[1]:+d}, tarde %{customdata[2]:+d} en el periodo<extra></extra>",
      showlegend: false,
    } as Data,
  ];
  return (
    <Bloque
      titulo="3. Saldo de las estaciones en las dos puntas"
      queMuestra={`Para cada estación, llegadas menos salidas por laborable en la punta de mañana (7–10 h) y en la de tarde (16–20 h), en los ${n} laborables del ajuste.`}
      porQue="Si lo que una estación gana por la mañana lo devuelve por la tarde, parte del desequilibrio se compensa solo y el rebalanceo nocturno corrige el resto."
      comoLeer="Arriba a la izquierda y abajo a la derecha están las estaciones que cambian de signo entre las dos puntas. Se usan los viajes cubiertos en su estación más cercana."
      conclusiones={[
        `El saldo de la mañana y el de la tarde tienen un Spearman de ${num(d.correlacion_saldo_puntas, 2)}: ${opuestos} estaciones cambian de signo entre las dos puntas y ${mismo} no.`,
        `La compensación es parcial: el resto del desequilibrio se acumula de un día a otro, y por eso hace falta el rebalanceo nocturno de T32.`,
        `Los ${num(totalRech)} viajes rechazados están repartidos: las diez estaciones con más rechazos suman el ${pc((100 * rech.slice(0, 10).reduce((s, x) => s + x, 0)) / totalRech)}.`,
      ]}
      fuente="tablas/movilidad/T31_estaciones.csv"
    >
      <Grafica
        descripcion="Dispersión del saldo de cada estación en la punta de mañana frente a la punta de tarde"
        trazas={trazas}
        alto={360}
        capa={{
          xaxis: { title: { text: "Saldo en la punta de mañana (por laborable)" }, zeroline: true, zerolinecolor: COLOR.eje },
          yaxis: { title: { text: "Saldo en la punta de tarde (por laborable)" }, zeroline: true, zerolinecolor: COLOR.eje },
        }}
      />
    </Bloque>
  );
}
