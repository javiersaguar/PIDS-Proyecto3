// Bloques de comprobaciones de la fase 0: viajes encadenados y puntos de entrega (T11), noche y
// toque de queda (T12), oferta frente a demanda (T13), modelo físico (T16) y hora local (T17).
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cargando, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR, trazaEscalon, trazasUmbral } from "../../graficas";

const FASE = "fase0";

type FilaEncadenados = {
  grupo: string;
  pausa_max_s: number;
  pares: number;
  pct_viajes_elegibles: number;
  pct_sigue: number;
  pct_vuelve: number;
  pct_ida_y_vuelta: number;
  dis_m_mediana_primero: number;
  dis_m_mediana_segundo: number;
};
type Encadenados = {
  parametros: { salto_max_m: number; pausa_s: number; referencia_h: [number, number] };
  tabla: FilaEncadenados[];
  bordes_min: number[];
  cuentas_min: number[];
  pares_principal: number;
  viajes_elegibles: number;
  viajes_unidos: number;
  pct_viajes_menos: number;
  cadenas_de_3_o_mas: number;
  pico_pausa_min: number;
  pico_pares: number;
};

export function BloqueEncadenados() {
  const { datos: d, error } = useDatos<Encadenados>(`${FASE}/t11_encadenados`);
  if (!d) return <Cargando error={error} />;
  const p = d.parametros;
  const principal = d.tabla.find((f) => f.pausa_max_s === p.pausa_s)!;
  const ref = d.tabla[d.tabla.length - 1];
  const alto = Math.max(...d.cuentas_min) * 1.15;
  const antes = d.cuentas_min.slice(d.pico_pausa_min - 5, d.pico_pausa_min);
  const trazas: Data[] = [
    trazaEscalon({
      bordes: d.bordes_min,
      cuentas: d.cuentas_min,
      nombre: "Pares",
      color: COLOR.serie1,
      plantilla: "%{customdata[0]}–%{customdata[1]} min<br>%{y} pares<extra></extra>",
    }),
    ...trazasUmbral(p.pausa_s / 60, alto, `${p.pausa_s / 60} min`),
  ];
  return (
    <Bloque
      titulo="6. Viajes encadenados"
      queMuestra={`Pares de viajes elegibles consecutivos del mismo patinete en los que el segundo sale a menos de ${p.salto_max_m} m de donde acabó el primero. La gráfica reparte sus pausas por minuto; la tabla dice hacia dónde va el segundo viaje.`}
      porQue="Es el caso contrario a los viajes con paradas de T10: un desplazamiento real puede quedar registrado como dos viajes si el usuario cierra y abre el alquiler en el mismo sitio. Si fueran muchos, la matriz OD tendría destinos intermedios que no son el final del trayecto."
      comoLeer={`«Sigue» es que el segundo viaje va en la misma dirección que el primero (menos de 60°) y «vuelve», que va hacia atrás (más de 120°). La fila de referencia son pares en el mismo sitio separados de ${p.referencia_h[0]} a ${p.referencia_h[1]} h, que son claramente viajes distintos.`}
      conclusiones={[
        <>
          Con una pausa de {p.pausa_s / 60} min como mucho hay <strong>{num(principal.pares)} pares</strong>,{" "}
          el {pc(principal.pct_viajes_elegibles, 2)} de los {num(d.viajes_elegibles)} viajes elegibles.
        </>,
        `Casi ninguno parece un trayecto partido. El segundo viaje sigue la dirección del primero en el ${pc(principal.pct_sigue)} de los pares y vuelve en el ${pc(principal.pct_vuelve)}. En la referencia son ${pc(ref.pct_sigue)} y ${pc(ref.pct_vuelve)}, así que solo unos 8 puntos de exceso podrían ser trayectos partidos. Uno de cada cinco pares es una ida y vuelta.`,
        `Las pausas dan un salto brusco a los ${d.pico_pausa_min} min: ${num(d.pico_pares)} pares entre ${d.pico_pausa_min} y ${d.pico_pausa_min + 1} min, frente a ${Math.min(...antes)}–${Math.max(...antes)} por minuto justo antes. Parece una regla de la aplicación que los datos no explican, y no afecta a la decisión.`,
        <>
          Unirlos quitaría el {pc(d.pct_viajes_menos, 2)} de los viajes. <strong>Se mantienen como viajes separados</strong>: cada uno
          es un alquiler pagado y el patinete queda aparcado en el punto intermedio. En T30, la cobertura de la red apenas
          cambia si se unen.
        </>,
      ]}
      fuente="tablas/exploracion/T11_encadenados.csv"
    >
      <Grafica
        descripcion="Histograma de la pausa entre dos viajes del mismo patinete que vuelve a salir en el mismo sitio"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          xaxis: { title: { text: "Pausa entre los dos viajes (min)" }, range: [0, 60] },
          yaxis: { title: { text: "Pares de viajes" }, range: [0, alto] },
        }}
      />
      <TablaDesplegable
        titulo="Ver los pares según la pausa máxima"
        cabeceras={["Grupo", "Pares", "% de elegibles", "Sigue", "Vuelve", "Ida y vuelta", "Distancia 1.º (m)", "Distancia 2.º (m)"]}
        numericas={[1, 2, 3, 4, 5, 6, 7]}
        filas={d.tabla.map((f) => [
          f.grupo.replace("<=", "≤").replace("referencia", "Referencia"),
          num(f.pares),
          pc(f.pct_viajes_elegibles, 2),
          pc(f.pct_sigue),
          pc(f.pct_vuelve),
          pc(f.pct_ida_y_vuelta),
          num(f.dis_m_mediana_primero),
          num(f.dis_m_mediana_segundo),
        ])}
      />
    </Bloque>
  );
}

type Concentracion = {
  res: number;
  tabla: { serie: string; puntos: number; celdas: number; pct_top10_celdas: number; pct_top20_celdas: number; pct_top50_celdas: number; pct_top100_celdas: number }[];
  curvas: Record<"entregas" | "recogidas" | "origenes_elegibles", number[]>;
};
const SERIES_OPERADOR: [keyof Concentracion["curvas"], string, string][] = [
  ["entregas", "Entregas del operador", COLOR.serie2],
  ["recogidas", "Recogidas del operador", COLOR.serie1],
  ["origenes_elegibles", "Orígenes elegibles", COLOR.tenue],
];

export function BloqueConcentracionEntregas() {
  const { datos: d, error } = useDatos<Concentracion>(`${FASE}/t11_concentracion`);
  if (!d) return <Cargando error={error} />;
  const fila = Object.fromEntries(d.tabla.map((f) => [f.serie, f]));
  const trazas: Data[] = SERIES_OPERADOR.map(
    ([clave, nombre, color]) =>
      ({
        type: "scatter",
        mode: "lines",
        name: nombre,
        x: d.curvas[clave].map((_, k) => k + 1),
        y: d.curvas[clave],
        line: { color, width: 2 },
        hovertemplate: `${nombre}<br>%{x} celdas: %{y:.1f} %<extra></extra>`,
      }) as Data,
  );
  return (
    <Bloque
      titulo="7. Concentración de los puntos de entrega"
      queMuestra={`Qué parte de las entregas del operador cae en sus celdas H3 de resolución ${d.res} más usadas, frente a las recogidas y a los orígenes de los viajes elegibles.`}
      porQue="El apartado 4 dice que las entregas se concentran en menos sitios que las recogidas. Medirlo con cuotas evita que la conclusión dependa del número de celdas. Si el operador ya tiene puntos de despliegue, la red debe cubrirlos."
      comoLeer="Cada curva acumula los puntos de las celdas ordenadas de más a menos usadas. Cuanto más arriba y a la izquierda, más concentrados."
      conclusiones={[
        `Las 20 celdas con más entregas reciben el ${pc(fila.entregas.pct_top20_celdas)} de ellas. Las 20 principales de las recogidas reúnen el ${pc(fila.recogidas.pct_top20_celdas)} y las de los orígenes, el ${pc(fila.origenes_elegibles.pct_top20_celdas)}. Las entregas caen en ${num(fila.entregas.celdas)} celdas y las recogidas, en ${num(fila.recogidas.celdas)}.`,
        "El operador trabaja con puntos de despliegue. Según T30, el 90 % de las entregas queda a menos de 300 m de la red principal.",
      ]}
      fuente={`tablas/exploracion/T11_concentracion_res${d.res}.csv`}
    >
      <Grafica
        descripcion="Curvas de concentración acumulada de entregas, recogidas y orígenes por celda"
        trazas={trazas}
        alto={320}
        capa={{
          legend: { x: 0.98, xanchor: "right", y: 0.05 },
          xaxis: { title: { text: `Celdas de resolución ${d.res}, de más a menos usadas` }, type: "log" },
          yaxis: { title: { text: "Acumulado (%)" }, range: [0, 102], ticksuffix: " %" },
        }}
      />
      <TablaDesplegable
        titulo="Ver las cuotas de las celdas principales"
        cabeceras={["Serie", "Puntos", "Celdas", "10 celdas", "20 celdas", "50 celdas", "100 celdas"]}
        numericas={[1, 2, 3, 4, 5, 6]}
        filas={d.tabla.map((f) => [
          SERIES_OPERADOR.find(([c]) => c === f.serie)?.[1] ?? f.serie,
          num(f.puntos),
          num(f.celdas),
          pc(f.pct_top10_celdas),
          pc(f.pct_top20_celdas),
          pc(f.pct_top50_celdas),
          pc(f.pct_top100_celdas),
        ])}
      />
    </Bloque>
  );
}

type Noche = {
  horas: { hora: number; viajes_mes: number; viajes_dia: number; toque_de_queda: boolean }[];
  toque: { inicio_h: number; fin_h: number; fuente: string };
  pct_salidas_toque: number;
  salidas_toque_dia: number;
  salidas_20h: number;
  salidas_21h: number;
  salidas_22h: number;
  caida_21_a_22_pc: number;
  caida_20_a_21_pc: number;
  salidas_0_a_5h: number;
  viajes_cruzan_22h: number;
};

export function BloqueNoche() {
  const { datos: d, error } = useDatos<Noche>(`${FASE}/t12_noche`);
  if (!d) return <Cargando error={error} />;
  const t = d.toque;
  const zona = (x0: number, x1: number) => ({
    type: "rect" as const, xref: "x" as const, yref: "paper" as const, x0, x1, y0: 0, y1: 1,
    fillcolor: COLOR.zonaExcluida, line: { width: 0 }, layer: "below" as const,
  });
  const trazas: Data[] = [
    {
      type: "bar",
      x: d.horas.map((h) => h.hora),
      y: d.horas.map((h) => h.viajes_dia),
      customdata: d.horas.map((h) => [h.viajes_mes, h.toque_de_queda ? "toque de queda" : "sin restricción"]),
      marker: { color: d.horas.map((h) => (h.toque_de_queda ? COLOR.eje : COLOR.serie1)) },
      hovertemplate: "%{x}:00–%{x}:59<br>%{y:.1f} viajes al día (%{customdata[0]} en el mes)<br>%{customdata[1]}<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="5. Noche y toque de queda"
      queMuestra="Cuántos viajes salen en cada hora en todo el mes, con las horas de toque de queda en gris."
      porQue={`En febrero de 2021 había toque de queda en toda Italia de ${t.inicio_h} a ${t.fin_h} h: solo se podía salir por trabajo, necesidad o salud. Es una restricción nacional, igual en todas las zonas de color. La demanda nocturna del piloto no es la de un mes normal.`}
      comoLeer="La banda gris marca las horas de toque de queda. Pasa el ratón por una barra para ver los viajes del mes en esa hora."
      conclusiones={[
        `Solo el ${pc(d.pct_salidas_toque, 2)} de las salidas (${num(d.salidas_toque_dia, 1)} al día) es de ${t.inicio_h} a ${t.fin_h} h; de 0 a 5 h hay ${num(d.salidas_0_a_5h)} en todo el mes.`,
        <>
          Las salidas bajan cada hora desde las 18 h, pero el mayor salto llega con el toque de queda: de 21 a 22 h caen un{" "}
          <strong>{pc(d.caida_21_a_22_pc)}</strong>, frente al {pc(d.caida_20_a_21_pc)} de 20 a 21 h.{" "}
          {num(d.viajes_cruzan_22h)} viajes empiezan antes de las 22 h y acaban después.
        </>,
        "La noche del piloto no se extrapola a un mes sin restricciones, y la memoria lo recoge como limitación. La caída a las 22 h confirma también que las horas de los datos son locales (T17, apartado 8).",
      ]}
      fuente={`tablas/exploracion/T12_noche.csv · ${t.fuente}`}
    >
      <Grafica
        descripcion="Barras de salidas por hora del día con las horas de toque de queda sombreadas"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          shapes: [zona(-0.5, t.fin_h - 0.5), zona(t.inicio_h - 0.5, 23.5)],
          xaxis: { title: { text: "Hora de salida" }, dtick: 2, range: [-0.6, 23.6] },
          yaxis: { title: { text: "Viajes por día (media del mes)" }, rangemode: "tozero" },
        }}
      />
    </Bloque>
  );
}

type Oferta = {
  parametros: { res: number; horas: [number, number]; paso_min: number; celdas: number; top: number };
  celdas: { rango: number; h3: string; salidas_ajuste: number; pct_tiempo_vacia: number; disponibles_mediana: number; espera_h_mediana: number }[];
  pct_salidas_en_celdas_analizadas: number;
  top_pct_tiempo_vacia_mediana: number;
  top_pct_tiempo_vacia_max: number;
  top_disponibles_mediana: number;
  celdas_vacias_mas_25pct: number;
  spearman_salidas_vacia: number;
  patinetes_activos_dia_media: number;
  viajes_por_patinete_activo_dia: number;
  pct_tiempo_flota_en_viaje: number;
};

export function BloqueOferta() {
  const { datos: d, error } = useDatos<Oferta>(`${FASE}/t13_oferta`);
  if (!d) return <Cargando error={error} />;
  const p = d.parametros;
  const top = d.celdas.slice(0, p.top);
  const trazas: Data[] = [
    {
      type: "scatter",
      mode: "markers",
      x: d.celdas.map((c) => c.salidas_ajuste),
      y: d.celdas.map((c) => c.pct_tiempo_vacia),
      customdata: d.celdas.map((c) => [c.rango, c.disponibles_mediana, c.h3]),
      marker: { size: 8, color: d.celdas.map((c) => (c.rango <= p.top ? COLOR.serie1 : COLOR.eje)), line: { color: "#fff", width: 1 } },
      hovertemplate: "Celda %{customdata[2]} (rango %{customdata[0]})<br>%{x} salidas en el ajuste<br>%{y:.1f} % del tiempo sin patinetes<br>mediana de %{customdata[1]} esperando<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="5. Oferta frente a demanda"
      queMuestra={`Para las ${p.celdas} celdas H3 de resolución ${p.res} con más salidas, el porcentaje de instantes de ${p.horas[0]} a ${p.horas[1]} h del ajuste (cada ${p.paso_min} min) en que no había ningún patinete esperando. Un patinete espera en la celda donde acabó su viaje hasta el siguiente, si sale a menos de 200 m.`}
      porQue="Los viajes observados son demanda servida. Si las celdas con más demanda se quedaran a menudo sin patinetes, la demanda real sería mayor y la red se diseñaría sobre una demanda recortada."
      comoLeer={`En azul, las ${p.top} celdas con más salidas. La cuenta es pesimista: no incluye los patinetes recién entregados por el operador, así que el porcentaje es una cota superior.`}
      conclusiones={[
        <>
          En las {p.top} celdas con más salidas, la mediana del tiempo sin ningún patinete es del{" "}
          <strong>{pc(d.top_pct_tiempo_vacia_mediana)}</strong> (máximo {pc(d.top_pct_tiempo_vacia_max)}). En esas celdas hay una
          mediana de {num(d.top_disponibles_mediana)} patinetes esperando.
        </>,
        `Las celdas con más salidas son las que menos se vacían (Spearman ${num(d.spearman_salidas_vacia, 2)}). Las ${p.celdas} celdas analizadas reúnen el ${pc(d.pct_salidas_en_celdas_analizadas)} de las salidas. La oferta sigue a la demanda.`,
        `La flota se usa muy poco: ${num(d.patinetes_activos_dia_media, 1)} patinetes activos al día y ${num(d.viajes_por_patinete_activo_dia, 2)} viajes por patinete activo y día. Los patinetes pasan en viaje el ${pc(d.pct_tiempo_flota_en_viaje, 2)} del tiempo.`,
        <>
          <strong>La demanda observada se toma como demanda de diseño.</strong> En las celdas periféricas puede estar algo
          recortada: {num(d.celdas_vacias_mas_25pct)} de las {p.celdas} están vacías más del 25 % del tiempo.
        </>,
      ]}
      fuente="tablas/exploracion/T13_oferta_celdas.csv"
    >
      <Grafica
        descripcion="Dispersión de salidas por celda frente al porcentaje del tiempo sin patinetes esperando"
        trazas={trazas}
        alto={320}
        capa={{
          showlegend: false,
          xaxis: { title: { text: `Salidas en el ajuste por celda de resolución ${p.res}` }, type: "log" },
          yaxis: { title: { text: "Tiempo sin patinetes (%)" }, rangemode: "tozero", ticksuffix: " %" },
        }}
      />
      <TablaDesplegable
        titulo={`Ver las ${p.top} celdas con más salidas`}
        cabeceras={["Rango", "Celda H3", "Salidas", "Tiempo vacía", "Esperando (mediana)", "Espera mediana (h)"]}
        numericas={[0, 2, 3, 4, 5]}
        filas={top.map((c) => [num(c.rango), c.h3, num(c.salidas_ajuste), pc(c.pct_tiempo_vacia), num(c.disponibles_mediana), num(c.espera_h_mediana, 1)])}
      />
    </Bloque>
  );
}

type ModeloFisico = {
  parametros: { masa_usuario_kg: number; rendimiento_motor: number; rendimiento_descarga: number; velocidad_crucero_kmh: number };
  tabla: { rodadura: number; area_cd_m2: number; wh_km_velocidad_media: number; wh_km_crucero: number }[];
  consumo_wh_km: number;
  masa_total_kg: number;
  vel_kmh_mediana_ajuste: number;
  wh_km_central_velocidad_media: number;
  wh_km_central_crucero: number;
  wh_km_max_rango: number;
  wh_km_min_rango: number;
};

export function BloqueModeloFisico() {
  const { datos: d, error } = useDatos<ModeloFisico>(`${FASE}/t16_modelo_fisico`);
  if (!d) return <Cargando error={error} />;
  const p = d.parametros;
  const etiquetas = d.tabla.map((f) => `${num(f.rodadura, 3)} · ${num(f.area_cd_m2, 2)} m²`);
  const barras = (y: number[], nombre: string, color: string): Data =>
    ({
      type: "bar",
      name: nombre,
      x: etiquetas,
      y,
      marker: { color },
      hovertemplate: `${nombre}<br>Rodadura · área·Cd: %{x}<br>%{y:.1f} Wh/km<extra></extra>`,
    }) as Data;
  const trazas: Data[] = [
    barras(d.tabla.map((f) => f.wh_km_velocidad_media), "Velocidad media del viaje", COLOR.serie1),
    barras(d.tabla.map((f) => f.wh_km_crucero), `Crucero a ${p.velocidad_crucero_kmh} km/h`, COLOR.serie2),
  ];
  return (
    <Bloque
      titulo="9. Contraste con el modelo físico"
      queMuestra={`La energía por km que da el modelo físico del enunciado en llano y a velocidad constante (rodadura + aerodinámica), con ${num(d.masa_total_kg, 1)} kg, rendimientos de ${num(p.rendimiento_motor, 2)} (motor) y ${num(p.rendimiento_descarga, 2)} (descarga) y varios coeficientes supuestos.`}
      porQue={`Todo el dimensionado usa ${num(d.consumo_wh_km, 1)} Wh/km. Si el modelo físico diera mucho más, las estaciones se quedarían cortas. Es una comprobación de orden de magnitud: el modelo completo, con pendientes y aceleraciones, se hará en T41–T43.`}
      comoLeer="Cada pareja de barras es una combinación de coeficiente de rodadura y área frontal por coeficiente aerodinámico. La línea discontinua es el consumo del enunciado."
      conclusiones={[
        `El modelo da de ${num(d.wh_km_min_rango, 1)} a ${num(d.wh_km_max_rango, 1)} Wh/km. El caso central (0,015 y 0,55 m²) da ${num(d.wh_km_central_velocidad_media, 1)} Wh/km a la velocidad media de cada viaje (mediana de ${num(d.vel_kmh_mediana_ajuste, 1)} km/h) y ${num(d.wh_km_central_crucero, 1)} Wh/km a ${p.velocidad_crucero_kmh} km/h.`,
        `Todos los casos quedan por debajo de ${num(d.consumo_wh_km, 1)} Wh/km. La diferencia tendrían que explicarla las aceleraciones, las pendientes y las pérdidas que el modelo no incluye.`,
        <>
          <strong>Usar {num(d.consumo_wh_km, 1)} Wh/km queda del lado de la seguridad</strong> para dimensionar las estaciones.
        </>,
      ]}
      fuente="tablas/exploracion/T16_modelo_fisico.csv"
    >
      <Grafica
        descripcion="Barras de energía por km del modelo físico frente al consumo de referencia"
        trazas={trazas}
        alto={340}
        capa={{
          barmode: "group",
          legend: { x: 0.01, y: 0.99 },
          shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: d.consumo_wh_km, y1: d.consumo_wh_km, line: { color: COLOR.texto, width: 1.5, dash: "dash" } }],
          xaxis: { title: { text: "Rodadura · área·Cd" }, tickangle: -30 },
          yaxis: { title: { text: "Wh/km de batería" }, range: [0, d.consumo_wh_km * 1.3] },
        }}
      />
    </Bloque>
  );
}

type Desfase = {
  desfases: { desfase_h: number; horas_lluvia: number; cociente_agregado: number; deficit_pc: number }[];
  pct_lluvia_tambien_hora_siguiente: number;
};

export function BloqueDesfase() {
  const { datos: d, error } = useDatos<Desfase>(`${FASE}/t17_desfase`);
  if (!d) return <Cargando error={error} />;
  const f = Object.fromEntries(d.desfases.map((x) => [x.desfase_h, x]));
  const trazas: Data[] = [
    {
      type: "bar",
      x: d.desfases.map((x) => (x.desfase_h ? `${x.desfase_h > 0 ? "+" : ""}${x.desfase_h} h` : "0")),
      y: d.desfases.map((x) => x.deficit_pc),
      customdata: d.desfases.map((x) => [x.horas_lluvia, x.cociente_agregado]),
      text: d.desfases.map((x) => pc(x.deficit_pc)),
      textposition: "outside",
      cliponaxis: false,
      textfont: { color: COLOR.texto },
      marker: { color: d.desfases.map((x) => (x.desfase_h === 0 ? COLOR.serie1 : COLOR.eje)) },
      hovertemplate: "Desfase %{x}<br>%{customdata[0]} horas con lluvia<br>faltan el %{y:.1f} % de los viajes<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="8. Desfase de la lluvia y hora local"
      queMuestra="Los viajes que faltan en las horas con lluvia (apartado 3) cuando la lluvia se desplaza de −2 a +2 h respecto a la hora de salida."
      porQue="Las horas de los viajes se leen como hora local de Roma. Si estuvieran en UTC (una hora menos en febrero), el mayor descenso aparecería con un desfase de +1 h. Comprueba la zona horaria sin depender de la documentación."
      comoLeer="Cada barra es el porcentaje de viajes que faltan frente a horas secas de la misma hora y tipo de día. La azul es la hora sin desfase."
      conclusiones={[
        `El descenso es casi el mismo con cualquier desfase: ${pc(f[0].deficit_pc)} sin desfase, ${pc(f[1].deficit_pc)} con +1 h y ${pc(f[-1].deficit_pc)} con −1 h. Solo baja con +2 h.`,
        `La prueba no distingue la hora local de UTC porque la lluvia dura varias horas: el ${pc(d.pct_lluvia_tambien_hora_siguiente)} de las horas con lluvia tiene lluvia también en la siguiente.`,
        <>
          Lo que sí distingue es el toque de queda de T12: la mayor caída es de 21 a 22 h y no de 20 a 21 h. Si las horas fueran UTC,
          la caída de las 22 h locales aparecería a las 21 h de los datos. <strong>Las horas son locales (Europe/Rome).</strong>
        </>,
      ]}
      fuente="tablas/exploracion/T17_desfase_lluvia.csv"
    >
      <Grafica
        descripcion="Barras del porcentaje de viajes que faltan en horas con lluvia según el desfase"
        trazas={trazas}
        alto={300}
        capa={{
          showlegend: false,
          margin: { t: 24 },
          xaxis: { title: { text: "Desfase de la lluvia respecto a la hora de salida" }, type: "category" },
          yaxis: { title: { text: "Viajes que faltan (%)" }, rangemode: "tozero", range: [0, Math.max(...d.desfases.map((x) => x.deficit_pc)) * 1.25] },
        }}
      />
    </Bloque>
  );
}
