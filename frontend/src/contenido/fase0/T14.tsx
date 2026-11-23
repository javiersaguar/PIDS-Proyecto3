import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { FRANJAS, fecha, franjaEje, indicadores, num, pc } from "../../formato";
import { COLOR, ESCALA_DIVERGENTE, capaMapa, rgba, trazaCeldas, trazaCeldasColor, trazaReferencias, type Celda } from "../../graficas";

type CeldaSaldo = Celda & { origenes: number; destinos: number; saldo_dia: number; saldo_rel: number; incluida: boolean };
type Saldo = { res: number; min_extremos: number; referencias: Record<string, [number, number]>; celdas: CeldaSaldo[] };
type Franjas = {
  franjas: {
    franja: string;
    celdas: { h3: string; origenes: number; destinos: number; saldo_dia: number; incluida: boolean }[];
  }[];
  desequilibrio: {
    franja: string;
    salidas_dia: number;
    desplazamiento_estructural_patinetes_dia: number;
    desplazamiento_diario_medio_patinetes_dia: number;
    pct_salidas_desplazadas_estructural: number;
  }[];
};
type Acumulado = { fechas: string[]; series: { rango: number; h3: string; tipo: string; saldo_acumulado: number[] }[] };
type Rebalanceo = { fecha: string; viajes: number; cota_res8_patinetes: number; pct_viajes_res8: number; cota_res9_patinetes: number; pct_viajes_res9: number }[];
type Operador = {
  celdas: { h3: string; origenes: number; destinos: number; saldo: number; recogidas: number; entregas: number; neto_entregas: number }[];
  spearman: number;
  pendiente: number;
  pct_compensado: number;
};
type Indicadores = { indicador: string; valor: number }[];

const FASE = "fase0";

export function T14() {
  const { datos: r, error } = useDatos<Indicadores>(`${FASE}/t14_resumen`);
  const { datos: f } = useDatos<Franjas>(`${FASE}/t14_franjas`);
  const i = r ? indicadores(r) : null;
  const manana = f?.desequilibrio.find((x) => x.franja === "punta_manana");
  return (
    <Seccion
      id="t14"
      tarea="T14"
      responsable="Alejandro Cuevas"
      titulo="Saldo neto orígenes − destinos por celda, franja y día"
      notebook="exploracion/T14_saldo.ipynb"
      objetivo="Ver dónde se acumulan o se vacían los patinetes y cuándo: el saldo O − D de cada celda H3 de resolución 8 en el periodo, por franja horaria y día a día."
      valor="Dice si hará falta rebalanceo y de qué orden de magnitud al día, qué zonas piden más anclajes (receptoras) y cuáles más stock inicial (emisoras), y en qué franjas se produce el desequilibrio. También contrasta el saldo con las recolocaciones del operador de T11."
    >
      {i && manana ? (
        <Cifras
          cifras={[
            { valor: `${i.celdas_emisoras} / ${i.celdas_receptoras}`, nombre: "celdas emisoras / receptoras", detalle: `de ${i.celdas_incluidas} con 30 o más extremos` },
            { valor: num(i.cota_rebalanceo_res8_media_patinetes_dia, 1), nombre: "patinetes a mover al día", detalle: `cota inferior en resolución 8; máx. ${num(i.cota_rebalanceo_res8_max_patinetes_dia)}` },
            { valor: num(i.cota_rebalanceo_res9_media_patinetes_dia, 1), nombre: "en resolución 9", detalle: `${pc(i.cota_rebalanceo_res9_media_pct_viajes)} de los viajes del día` },
            { valor: pc(manana.pct_salidas_desplazadas_estructural), nombre: "salidas desplazadas", detalle: "en la punta de mañana" },
            { valor: pc(i.operador_pct_saldo_compensado), nombre: "del saldo compensado", detalle: "por las recolocaciones del operador" },
          ]}
        />
      ) : (
        <Cargando error={error} />
      )}
      <BloqueSaldo />
      <BloqueFranjas />
      <BloqueAcumulado />
      {i && <BloqueRebalanceo i={i} />}
      <BloqueOperador />
    </Seccion>
  );
}

const PLANTILLA_SALDO = "%{location}<br>%{customdata[0]} orígenes · %{customdata[1]} destinos<br>Saldo %{customdata[2]:+.2f} patinetes/día<extra></extra>";

function BloqueSaldo() {
  const { datos: s, error } = useDatos<Saldo>(`${FASE}/t14_saldo`);
  const [modo, setModo] = useState<"dia" | "relativo">("dia");
  if (!s) return <Cargando error={error} />;
  const dentro = s.celdas.filter((c) => c.incluida);
  const fuera = s.celdas.filter((c) => !c.incluida);
  const z = dentro.map((c) => (modo === "dia" ? c.saldo_dia : c.saldo_rel));
  const tope = Math.max(...z.map(Math.abs));
  const trazas: Data[] = [
    trazaCeldasColor(
      fuera,
      "#d5dbe1",
      `Menos de ${s.min_extremos} extremos`,
      "%{location}<br>%{customdata[0]} orígenes · %{customdata[1]} destinos<extra></extra>",
      fuera.map((c) => [c.origenes, c.destinos]),
    ),
    trazaCeldas({
      celdas: dentro,
      z,
      escala: ESCALA_DIVERGENTE,
      zmin: -tope,
      zmax: tope,
      titulo: modo === "dia" ? "Saldo O − D (patinetes/día)" : "Saldo relativo (O − D)/(O + D)",
      customdata: dentro.map((c) => [c.origenes, c.destinos, c.saldo_dia, num(c.saldo_rel, 2)]),
      plantilla: PLANTILLA_SALDO.replace("<extra>", " · relativo %{customdata[3]}<extra>"),
    }),
    trazaReferencias(s.referencias),
  ];
  const ordenadas = [...dentro].sort((a, b) => b.saldo_dia - a.saldo_dia);
  const emisora = ordenadas[0];
  const receptora = ordenadas[ordenadas.length - 1];
  return (
    <Bloque
      titulo="1. Saldo por celda"
      queMuestra={`Orígenes menos destinos de cada celda en el periodo de ajuste, por día, en las celdas con al menos ${s.min_extremos} extremos.`}
      porQue="Una celda emisora (más salidas que llegadas) se vacía y pide stock inicial; una receptora se llena y pide anclajes libres."
      comoLeer="Rojo: emisora, pierde patinetes. Azul: receptora, los gana. Gris claro: celdas con muy pocos extremos para que el saldo signifique algo. El saldo relativo divide entre el total de extremos de la celda."
      conclusiones={[
        "Cuentan 90 de las 111 celdas, con el 99,34 % de los extremos: 42 emisoras, 45 receptoras y 3 equilibradas. En 14 el desequilibrio supera dos desviaciones típicas del caso equilibrado.",
        <>
          La principal emisora (<code>{emisora.h3}</code>, al sureste del Coliseo) pierde{" "}
          <strong>{num(emisora.saldo_dia, 1)} patinetes al día</strong> y la principal receptora (<code>{receptora.h3}</code>,
          entre San Pedro y Termini) gana {num(-receptora.saldo_dia, 1)}. Hay varias emisoras en el sur.
        </>,
      ]}
      fuente="figuras/exploracion/T14_saldo y tablas/exploracion/T14_saldo_celdas.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Medida del saldo"
          valor={modo}
          cambiar={setModo}
          opciones={[
            { valor: "dia", texto: "Patinetes al día" },
            { valor: "relativo", texto: "Saldo relativo" },
          ]}
        />
      </div>
      <Grafica descripcion="Mapa de Roma con el saldo orígenes menos destinos de cada celda H3 de resolución 8" trazas={trazas} alto={480} capa={capaMapa()} />
    </Bloque>
  );
}

function BloqueFranjas() {
  const { datos: f, error } = useDatos<Franjas>(`${FASE}/t14_franjas`);
  const { datos: s } = useDatos<Saldo>(`${FASE}/t14_saldo`);
  const [franja, setFranja] = useState("punta_manana");
  if (!f || !s) return <Cargando error={error} />;
  const contorno = new Map(s.celdas.map((c) => [c.h3, c.contorno]));
  const conContorno = <T extends { h3: string }>(c: T) => ({ ...c, contorno: contorno.get(c.h3)! });
  const tope = Math.max(...f.franjas.flatMap((x) => x.celdas.filter((c) => c.incluida).map((c) => Math.abs(c.saldo_dia))));
  const actual = f.franjas.find((x) => x.franja === franja)!;
  const dentro = actual.celdas.filter((c) => c.incluida && contorno.has(c.h3)).map(conContorno);
  const fuera = actual.celdas.filter((c) => !c.incluida && contorno.has(c.h3)).map(conContorno);
  const mapa: Data[] = [
    trazaCeldasColor(fuera, "#d5dbe1", "Pocos extremos en la franja", "%{location}<br>%{customdata[0]} orígenes · %{customdata[1]} destinos<extra></extra>", fuera.map((c) => [c.origenes, c.destinos])),
    trazaCeldas({
      celdas: dentro,
      z: dentro.map((c) => c.saldo_dia),
      escala: ESCALA_DIVERGENTE,
      zmin: -tope,
      zmax: tope,
      titulo: "Saldo O − D (patinetes/día)",
      customdata: dentro.map((c) => [c.origenes, c.destinos, c.saldo_dia]),
      plantilla: PLANTILLA_SALDO,
    }),
    trazaReferencias(s.referencias),
  ];
  const d = f.desequilibrio;
  const barras: Data[] = [
    {
      type: "bar",
      x: d.map((x) => franjaEje(x.franja)),
      y: d.map((x) => x.desplazamiento_estructural_patinetes_dia),
      text: d.map((x) => `${pc(x.pct_salidas_desplazadas_estructural)} de las salidas`),
      textposition: "outside",
      cliponaxis: false,
      customdata: d.map((x) => [num(x.salidas_dia, 1), num(x.desplazamiento_diario_medio_patinetes_dia, 1)]),
      marker: { color: d.map((x) => (x.franja === franja ? COLOR.serie1 : rgba(COLOR.serie1, 0.45))) },
      hovertemplate:
        "%{y:.1f} patinetes/día desplazados por el flujo neto<br>%{customdata[0]} salidas al día · %{customdata[1]} desplazados de media cada día<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="2. Saldo por franja horaria"
      queMuestra="El mismo saldo en cada franja horaria de T12, con la misma escala de color, y cuántos patinetes desplaza al día el flujo neto en cada franja."
      porQue="El saldo del día puede esconder movimientos que se compensan entre la mañana y la tarde. El simulador y el rebalanceo tienen que saber en qué franjas se produce el desequilibrio."
      comoLeer="Elige la franja con los botones; la barra oscura es la franja del mapa. La escala de color es la misma en todas las franjas para poder compararlas."
      conclusiones={[
        <>
          En la punta de mañana el flujo neto desplaza <strong>29,8 patinetes al día, el 32,4 % de sus salidas</strong>.
          Mediodía y punta de tarde desplazan casi lo mismo (28,3 y 29,1), pero es solo el 9,9 % y el 9,2 % de sus
          salidas.
        </>,
        "El centro recibe patinetes por la mañana y los devuelve por la tarde: el saldo diario esconde esa inversión, así que el simulador debe trabajar por franjas o en continuo.",
      ]}
      fuente="figuras/exploracion/T14_saldo_franjas y tablas/exploracion/T14_desequilibrio_franjas.csv"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Franja horaria"
          valor={franja}
          cambiar={setFranja}
          opciones={f.franjas.map((x) => ({ valor: x.franja, texto: FRANJAS[x.franja].replace(/ \(.*\)/, "") }))}
        />
      </div>
      <Grafica descripcion={`Mapa del saldo por celda en la franja ${FRANJAS[franja]}`} trazas={mapa} alto={420} capa={capaMapa()} />
      <Grafica
        descripcion="Patinetes desplazados al día por el flujo neto en cada franja horaria"
        trazas={barras}
        alto={260}
        capa={{
          showlegend: false,
          margin: { t: 24 },
          xaxis: { type: "category" },
          yaxis: { title: { text: "Patinetes/día" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

function BloqueAcumulado() {
  const { datos: a, error } = useDatos<Acumulado>(`${FASE}/t14_acumulado`);
  if (!a) return <Cargando error={error} />;
  const vistos = new Set<string>();
  const trazas: Data[] = a.series.map((s) => {
    const emisora = s.tipo === "emisora";
    const color = emisora ? COLOR.serie2 : COLOR.serie1;
    const primera = !vistos.has(s.tipo);
    vistos.add(s.tipo);
    return {
      type: "scatter",
      mode: "lines",
      x: a.fechas,
      y: s.saldo_acumulado,
      name: emisora ? "Emisoras (se vacían)" : "Receptoras (se llenan)",
      legendgroup: s.tipo,
      showlegend: primera,
      line: { color, width: 2 },
      hovertemplate: `Celda n.º ${s.rango} (${s.tipo})<br>${s.h3}<br>%{x|%d/%m}: saldo acumulado %{y:+}<extra></extra>`,
    } as Data;
  });
  const ultimo = a.fechas[a.fechas.length - 1];
  return (
    <Bloque
      titulo="3. Persistencia día a día"
      queMuestra="El saldo acumulado día a día de las 10 celdas con mayor saldo absoluto del periodo de ajuste."
      porQue="Si el acumulado crece sin volver a cero, la acumulación es estructural: los patinetes no vuelven solos y hará falta rebalanceo."
      comoLeer="Por encima de cero, la celda ha perdido patinetes desde el 1 de febrero; por debajo, los ha ganado. Pasa el ratón por una línea para ver su celda."
      conclusiones={[
        `En estas 10 celdas el acumulado tiene el mismo signo que el total en el 81–100 % de los días, y en ocho de ellas el 100 %: crece durante todo el periodo sin volver a cero (hasta ${fecha(ultimo)}).`,
        <>
          La acumulación es <strong>estructural</strong>: sin traslados, las emisoras se vaciarían y las receptoras se
          llenarían.
        </>,
      ]}
      fuente="figuras/exploracion/T14_saldo_acumulado y tablas/exploracion/T14_persistencia.csv"
    >
      <Grafica
        descripcion="Saldo acumulado día a día de las diez celdas con mayor saldo absoluto"
        trazas={trazas}
        alto={360}
        capa={{
          hovermode: "closest",
          margin: { t: 8 },
          xaxis: { type: "date", tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01" },
          yaxis: { title: { text: "Saldo O − D acumulado (patinetes)" }, zeroline: true, zerolinecolor: COLOR.eje },
        }}
      />
    </Bloque>
  );
}

function BloqueRebalanceo({ i }: { i: Record<string, number> }) {
  const { datos: r, error } = useDatos<Rebalanceo>(`${FASE}/t14_rebalanceo`);
  if (!r) return <Cargando error={error} />;
  const fechas = r.map((x) => x.fecha);
  const linea = (y: number[], pct: number[], nombre: string, color: string): Data =>
    ({
      type: "scatter",
      mode: "lines+markers",
      x: fechas,
      y,
      customdata: pct,
      name: nombre,
      line: { color, width: 2 },
      marker: { size: 8, color, line: { color: "#fff", width: 2 } },
      hovertemplate: `${nombre}: %{y:.0f} patinetes (%{customdata:.1f} % de los viajes)<extra></extra>`,
    }) as Data;
  const estructural = (y: number, color: string, texto: string): Data =>
    ({
      type: "scatter",
      mode: "lines",
      x: [fechas[0], fechas[fechas.length - 1]],
      y: [y, y],
      name: texto,
      line: { color, width: 1.3, dash: "dash" },
      hoverinfo: "skip",
    }) as Data;
  const trazas: Data[] = [
    linea(r.map((x) => x.cota_res8_patinetes), r.map((x) => x.pct_viajes_res8), "Resolución 8", COLOR.serie1),
    linea(r.map((x) => x.cota_res9_patinetes), r.map((x) => x.pct_viajes_res9), "Resolución 9", COLOR.serie2),
    estructural(i.desplazamiento_estructural_res8_patinetes_dia, COLOR.serie1, "Parte estructural, res. 8"),
    estructural(i.desplazamiento_estructural_res9_patinetes_dia, COLOR.serie2, "Parte estructural, res. 9"),
  ];
  return (
    <Bloque
      titulo="4. Cota inferior del rebalanceo diario"
      queMuestra="La suma de los saldos absolutos de todas las celdas cada día, dividida entre 2: el mínimo de patinetes que habría que mover ese día para devolver cada celda a su estado inicial."
      porQue="Da el orden de magnitud de los traslados que tendrá que simular la fase 1. Depende de la resolución, así que se calcula en resolución 8 y 9."
      comoLeer="Las líneas discontinuas son la parte estructural: el saldo del periodo repartido por día. Pasa el ratón por un día para comparar las dos resoluciones."
      conclusiones={[
        <>
          En resolución 8, la cota es de{" "}
          <strong>
            {num(i.cota_rebalanceo_res8_media_patinetes_dia, 1)} patinetes al día de media y{" "}
            {num(i.cota_rebalanceo_res8_max_patinetes_dia)} como máximo
          </strong>{" "}
          ({pc(i.cota_rebalanceo_res8_media_pct_viajes)} de los viajes del día). En resolución 9 sube a{" "}
          {num(i.cota_rebalanceo_res9_media_patinetes_dia, 1)} y {num(i.cota_rebalanceo_res9_max_patinetes_dia, 1)} (
          {pc(i.cota_rebalanceo_res9_media_pct_viajes)}).
        </>,
        `La parte estructural es de ${num(i.desplazamiento_estructural_res8_patinetes_dia, 1)} patinetes al día en resolución 8 y ${num(i.desplazamiento_estructural_res9_patinetes_dia, 1)} en resolución 9; el resto son desequilibrios que se compensan en días distintos.`,
      ]}
      fuente="tablas/exploracion/T14_rebalanceo_diario.csv y T14_resumen.csv"
    >
      <Grafica
        descripcion="Cota inferior diaria de patinetes a rebalancear en resolución 8 y 9"
        trazas={trazas}
        alto={340}
        capa={{
          hovermode: "x unified",
          margin: { t: 8 },
          xaxis: { type: "date", tickformat: "%d/%m", dtick: 7 * 24 * 3600 * 1000, tick0: "2021-02-01", hoverformat: "%A %d/%m" },
          yaxis: { title: { text: "Patinetes a mover al día" }, rangemode: "tozero" },
        }}
      />
      <TablaDesplegable
        titulo="Ver la tabla por día"
        cabeceras={["Fecha", "Viajes", "Cota res. 8", "% de viajes (res. 8)", "Cota res. 9", "% de viajes (res. 9)"]}
        numericas={[1, 2, 3, 4, 5]}
        filas={r.map((x) => [x.fecha, num(x.viajes), num(x.cota_res8_patinetes, 1), num(x.pct_viajes_res8, 1), num(x.cota_res9_patinetes, 1), num(x.pct_viajes_res9, 1)])}
      />
    </Bloque>
  );
}

function BloqueOperador() {
  const { datos: o, error } = useDatos<Operador>(`${FASE}/t14_operador`);
  if (!o) return <Cargando error={error} />;
  const xs = o.celdas.map((c) => c.saldo);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      x: [x0, x1],
      y: [x0, x1],
      name: "Compensación completa",
      line: { color: COLOR.eje, width: 1.3, dash: "dot" },
      hoverinfo: "skip",
    } as Data,
    {
      type: "scatter",
      mode: "lines",
      x: [x0, x1],
      y: [o.pendiente * x0, o.pendiente * x1],
      name: `Ajuste: pendiente ${num(o.pendiente, 2)}`,
      line: { color: COLOR.texto, width: 1.3, dash: "dash" },
      hoverinfo: "skip",
    } as Data,
    {
      type: "scatter",
      mode: "markers",
      x: xs,
      y: o.celdas.map((c) => c.neto_entregas),
      name: "Celdas de resolución 8",
      marker: { size: 8, color: rgba(COLOR.serie1, 0.75), line: { color: "#fff", width: 1 } },
      customdata: o.celdas.map((c) => [c.h3, c.origenes, c.destinos, c.recogidas, c.entregas]),
      hovertemplate:
        "%{customdata[0]}<br>Saldo O − D del mes: %{x:+}<br>Entregas netas del operador: %{y:+}<br>%{customdata[1]} orígenes · %{customdata[2]} destinos<br>%{customdata[3]} recogidas · %{customdata[4]} entregas<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="5. Saldo frente a las recolocaciones del operador"
      queMuestra="Para cada celda, el saldo O − D de los viajes del mes frente a las entregas netas del operador (entregas menos recogidas, de T11), con el mismo universo que T11: todos los viajes."
      porQue="Si coinciden, el piloto ya compensaba la acumulación con sus recogidas, y con estaciones de recarga (sin recogidas para cargar) habrá que hacerlo con un rebalanceo explícito."
      comoLeer="Una celda sobre la diagonal de puntos tendría su saldo compensado del todo. La línea discontinua es el ajuste por mínimos cuadrados que pasa por el origen."
      conclusiones={[
        <>
          Sí coinciden: Spearman de {num(o.spearman, 2)} y pendiente de {num(o.pendiente, 2)} en {o.celdas.length} celdas.
          Las recolocaciones compensan el <strong>{pc(o.pct_compensado)} del saldo</strong>.
        </>,
        "La celda en la que el operador entrega más es la principal emisora. El piloto ya rebalanceaba, aunque con recogidas de varios días (T11): el rebalanceo nocturno es parte del escenario base de la fase 1.",
      ]}
      fuente="figuras/exploracion/T14_saldo_frente_operador y tablas/exploracion/T14_saldo_frente_operador.csv"
    >
      <Grafica
        descripcion="Dispersión del saldo de los viajes por celda frente a las entregas netas del operador"
        trazas={trazas}
        alto={380}
        capa={{
          hovermode: "closest",
          margin: { t: 8 },
          xaxis: { title: { text: "Saldo O − D de los viajes en el mes" }, zeroline: true, zerolinecolor: COLOR.eje },
          yaxis: { title: { text: "Entregas netas del operador" }, zeroline: true, zerolinecolor: COLOR.eje },
        }}
      />
    </Bloque>
  );
}
