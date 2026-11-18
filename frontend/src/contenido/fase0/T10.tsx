import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR, trazaEscalon, trazaZona, trazasUmbral } from "../../graficas";

type Embudo = {
  pasos: { paso: number; regla: string; descripcion: string; excluidos: number; quedan: number }[];
  recuento: { motivo: string; viajes: number; unico_motivo: number; porcentaje: number }[];
  periodos: { periodo: string; viajes: number; elegibles: number; porcentaje_elegibles: number }[];
};
type Histograma = { etiqueta: string; escala: "log" | "lineal"; bordes: number[]; cuentas: number[]; umbrales: number[] };
type Histogramas = { n_viajes: number; variables: Record<Variable, Histograma> };
type Barrido = { etiqueta: string; elegido: number; umbral: number[]; excluidos: number[]; porcentaje: number[] };
type Comparacion = {
  umbrales: Record<"principal" | "permisiva", Record<string, number>>;
  indicadores: Record<string, number | string>[];
  diferencia_ajuste_pc: { indicador: string; clave: string; diferencia_pc: number }[];
};
type Lentos = { indicador: string; valor: number }[];
type Variable = "tt_s" | "dis_m" | "vel_kmh";

const FASE = "fase0";

const REGLAS: Record<string, string> = {
  nulos: "Campos vacíos",
  duplicado: "Duplicados",
  tiempos_incoherentes: "Duración incoherente",
  velocidad_incoherente: "Velocidad incoherente",
  precio_incoherente: "Precio fuera de tarifa",
  fuera_de_zona: "Fuera del área de Roma",
  solape: "Solape del mismo patinete",
  tt_largo: "Más de 2 h",
  vel_alta: "Más de 25 km/h",
  tt_corto: "Menos de 60 s",
  dis_corta: "Menos de 100 m",
  vel_baja: "Menos de 2 km/h",
};

const UNIDAD: Record<Variable, string> = { tt_s: "s", dis_m: "m", vel_kmh: "km/h" };

function textoUmbral(v: Variable, u: number) {
  if (v === "tt_s") return u >= 3600 ? `${num(u / 3600)} h` : `${num(u)} s`;
  return `${num(u)} ${UNIDAD[v]}`;
}

export function T10() {
  const embudo = useDatos<Embudo>(`${FASE}/t10_embudo`);
  const p = embudo.datos;
  const total = p?.pasos[0].quedan ?? 0;
  const final = p?.pasos[p.pasos.length - 1].quedan ?? 0;
  const periodo = (n: string) => p?.periodos.find((x) => x.periodo === n);
  const estructurales = p?.pasos.filter((x) => x.paso >= 1 && x.paso <= 7) ?? [];

  return (
    <Seccion
      id="t10"
      tarea="T10"
      responsable="Javier Saguar"
      titulo="Limpieza de los viajes"
      notebook="exploracion/T10_limpieza.ipynb"
      objetivo="Decidir qué viajes del CSV original entran en el análisis con umbrales justificados con datos. No se borra ningún viaje: los no válidos quedan marcados con el motivo."
      valor="Todas las fases parten de estos viajes. Si se cuelan desbloqueos sin viaje o patinetes sin cerrar, inflan la demanda y la energía; si se quita demasiado, la red se diseña para menos demanda de la real."
    >
      {p ? (
        <Cifras
          cifras={[
            { valor: num(total), nombre: "viajes en el CSV", detalle: "1–28/02/2021" },
            { valor: num(final), nombre: "viajes elegibles", detalle: pc((100 * final) / total) + " del total" },
            {
              valor: num(periodo("ajuste")!.elegibles),
              nombre: "en el periodo de ajuste",
              detalle: pc(periodo("ajuste")!.porcentaje_elegibles) + " de sus viajes",
            },
            {
              valor: num(periodo("reservada")!.elegibles),
              nombre: "en la semana reservada",
              detalle: pc(periodo("reservada")!.porcentaje_elegibles) + " de sus viajes",
            },
            {
              valor: `${estructurales.filter((x) => x.excluidos > 0).length} de ${estructurales.length}`,
              nombre: "comprobaciones estructurales con errores",
            },
          ]}
        />
      ) : (
        <Cargando error={embudo.error} />
      )}
      {p && <BloqueEmbudo e={p} />}
      <BloqueDistribuciones />
      <BloqueLentos />
      <BloqueSensibilidad />
      <BloqueComparacion />
    </Seccion>
  );
}

function BloqueEmbudo({ e }: { e: Embudo }) {
  const pasos = e.pasos.slice(1);
  const trazas: Data[] = [
    {
      type: "bar",
      orientation: "h",
      y: pasos.map((x) => REGLAS[x.regla] ?? x.regla),
      x: pasos.map((x) => x.excluidos),
      customdata: pasos.map((x) => [x.descripcion, num(x.quedan)]),
      marker: { color: pasos.map((x) => (x.paso <= 7 ? COLOR.eje : COLOR.serie1)) },
      text: pasos.map((x) => num(x.excluidos)),
      textposition: "outside",
      cliponaxis: false,
      textfont: { color: COLOR.texto },
      hovertemplate: "<b>%{y}</b><br>%{customdata[0]}<br>Excluye %{x} viajes · quedan %{customdata[1]}<extra></extra>",
    } as Data,
  ];
  return (
    <Bloque
      titulo="1. Comprobaciones estructurales y embudo de limpieza"
      queMuestra="Cuántos viajes quita cada regla aplicada en orden. Las siete primeras (en gris) buscan errores de estructura: campos vacíos, duplicados, duraciones, velocidades o precios que no cuadran, puntos fuera de Roma y viajes solapados del mismo patinete. Las cinco últimas son umbrales de comportamiento."
      porQue="Si los datos son coherentes, solo hay que decidir umbrales de comportamiento. Esta tabla de embudo va a la memoria para que se pueda auditar cada viaje excluido."
      comoLeer="Cada viaje cuenta solo en la primera regla que incumple. En la tabla de abajo están todos los viajes marcados por cada regla, aunque ya los hubiera quitado otra antes."
      conclusiones={[
        <>
          Los datos son estructuralmente limpios: ninguna de las siete comprobaciones falla. El precio es exactamente{" "}
          <code>1 € + 0,15 €/min</code> y la velocidad <code>3,6 · dis / tt</code> en todos los viajes.
        </>,
        <>
          Solo se excluyen viajes por comportamiento: {num(e.pasos[8].excluidos)} de más de 2 h,{" "}
          {num(e.pasos[9].excluidos)} de más de 25 km/h, {num(e.pasos[10].excluidos)} de menos de 60 s,{" "}
          {num(e.pasos[11].excluidos)} más de menos de 100 m y {num(e.pasos[12].excluidos)} más de menos de 2 km/h.
        </>,
        <>
          Los dos periodos pierden una proporción parecida ({pc(e.periodos[0].porcentaje_elegibles)} y{" "}
          {pc(e.periodos[1].porcentaje_elegibles)} de elegibles), así que la limpieza no sesga la validación.
        </>,
      ]}
      fuente="tablas/exploracion/T10_embudo.csv y T10_recuento_motivos.csv"
    >
      <Grafica
        descripcion="Barras horizontales con los viajes que excluye cada regla de limpieza"
        trazas={trazas}
        alto={400}
        capa={{
          margin: { l: 8, r: 50 },
          xaxis: { title: { text: "Viajes excluidos" }, rangemode: "tozero" },
          yaxis: { autorange: "reversed", ticks: "", showgrid: false },
          showlegend: false,
        }}
      />
      <TablaDesplegable
        titulo="Ver todos los viajes marcados por cada regla"
        cabeceras={["Regla", "Viajes marcados", "Solo por esta regla", "% del CSV"]}
        numericas={[1, 2, 3]}
        filas={e.recuento.map((r) => [REGLAS[r.motivo] ?? r.motivo, num(r.viajes), num(r.unico_motivo), pc(r.porcentaje, 2)])}
      />
    </Bloque>
  );
}

function BloqueDistribuciones() {
  const { datos, error } = useDatos<Histogramas>(`${FASE}/t10_histogramas`);
  const [variable, setVariable] = useState<Variable>("tt_s");
  if (!datos) return <Cargando error={error} />;
  const h = datos.variables[variable];
  const alto = Math.max(...h.cuentas) * 1.12;
  const xMin = h.bordes[0];
  const xMax = h.bordes[h.bordes.length - 1];
  const [uMin, uMax] = variable === "dis_m" ? [h.umbrales[0], undefined] : h.umbrales;
  const formato = h.escala === "log" ? ",.3~r" : ",.1f";
  const trazas: Data[] = [
    trazaZona(xMin, uMin, alto),
    ...(uMax !== undefined ? [trazaZona(uMax, xMax, alto)] : []),
    trazaEscalon({
      bordes: h.bordes,
      cuentas: h.cuentas,
      nombre: "Viajes",
      color: COLOR.serie1,
      plantilla: `%{customdata[0]:${formato}}–%{customdata[1]:${formato}} ${UNIDAD[variable]}<br>%{y} viajes<extra></extra>`,
    }),
    ...trazasUmbral(uMin, alto, textoUmbral(variable, uMin)),
    ...(uMax !== undefined ? trazasUmbral(uMax, alto, textoUmbral(variable, uMax), "left") : []),
  ];
  return (
    <Bloque
      titulo="2. Distribuciones de duración, distancia y velocidad con los umbrales"
      queMuestra={`Histograma de los ${num(datos.n_viajes)} viajes del periodo de ajuste (1–21/02) para cada variable, con los umbrales en línea discontinua y en gris la zona que queda fuera.`}
      porQue="Un umbral es defendible si separa dos poblaciones distintas (desbloqueos frente a viajes, viajes cerrados frente a olvidados). Si cortara por la mitad de la distribución, estaríamos quitando demanda real."
      comoLeer="Duración y distancia van en escala logarítmica para ver a la vez los segundos y las horas. Pasa el ratón por el escalón para ver cuántos viajes hay en cada intervalo."
      conclusiones={[
        "Duración: casi todos los viajes duran entre 2 y 30 minutos. Los 60 s dejan fuera un grupo pequeño de desbloqueos de pocos segundos y las 2 h, una cola larga y casi plana.",
        "Distancia: por debajo de 100 m hay una cola larga y plana que llega a menos de 1 m (patinetes que casi no se mueven). La distribución principal empieza a subir justo a partir del corte de 100 m.",
        "Velocidad: hay un pico junto a 0 km/h y un valle hacia los 2 km/h antes de la distribución principal (mediana de unos 12 km/h). El límite de 25 km/h es la velocidad máxima del patinete y solo afecta a 2 viajes.",
      ]}
      fuente="figuras/exploracion/T10_umbrales"
    >
      <div className="controles">
        <Segmentado
          etiqueta="Variable"
          valor={variable}
          cambiar={setVariable}
          opciones={[
            { valor: "tt_s", texto: "Duración" },
            { valor: "dis_m", texto: "Distancia" },
            { valor: "vel_kmh", texto: "Velocidad" },
          ]}
        />
      </div>
      <Grafica
        descripcion={`Histograma de ${h.etiqueta} con los umbrales de limpieza`}
        trazas={trazas}
        capa={{
          showlegend: false,
          margin: { t: 26 },
          xaxis: {
            type: h.escala === "log" ? "log" : "linear",
            ...(h.escala === "log" ? { dtick: 1, exponentformat: "none" as const } : {}),
            title: { text: h.etiqueta },
            range: h.escala === "log" ? [Math.log10(xMin), Math.log10(xMax)] : [0, variable === "vel_kmh" ? 40 : xMax],
          },
          yaxis: { title: { text: "Viajes" }, range: [0, alto] },
        }}
      />
    </Bloque>
  );
}

function BloqueLentos() {
  const lentos = useDatos<Lentos>(`${FASE}/t10_lentos`);
  const hist = useDatos<Histogramas>(`${FASE}/t10_histogramas`);
  if (!lentos.datos || !hist.datos) return <Cargando error={lentos.error ?? hist.error} />;
  const [menos1, otras, soloVb1, soloVb, disMed, ttMed, mas20] = lentos.datos.map((x) => x.valor);
  const v = hist.datos.variables.vel_kmh;
  const n = v.bordes.findIndex((b) => b >= 8);
  const bordes = v.bordes.slice(0, n + 1);
  const cuentas = v.cuentas.slice(0, n);
  const alto = Math.max(...cuentas) * 1.15;
  const trazas: Data[] = [
    trazaZona(0, v.umbrales[0], alto),
    {
      type: "bar",
      x: bordes.slice(0, -1).map((b, i) => (b + bordes[i + 1]) / 2),
      y: cuentas,
      width: bordes.slice(0, -1).map((b, i) => (bordes[i + 1] - b) * 0.92),
      customdata: bordes.slice(0, -1).map((b, i) => [b, bordes[i + 1]]),
      marker: { color: COLOR.serie1 },
      hovertemplate: "%{customdata[0]:.1f}–%{customdata[1]:.1f} km/h<br>%{y} viajes<extra></extra>",
    } as Data,
    ...trazasUmbral(v.umbrales[0], alto, "2 km/h"),
  ];
  return (
    <Bloque
      titulo="3. Los viajes casi parados"
      queMuestra="Detalle de la velocidad media entre 0 y 8 km/h en el periodo de ajuste y qué son los viajes del pico junto a 0 km/h."
      porQue="Un viaje a 1 km/h que recorre 500 m ocupa el patinete media hora. En la simulación de flota inflaría el tiempo de uso, así que hay que decidir de forma explícita qué hacer con ellos."
      conclusiones={[
        <>
          El pico de {num(menos1)} viajes por debajo de 1 km/h son desbloqueos sin recorrido: {num(otras)} ya caen
          por duración o distancia y solo {num(soloVb1)} pasan las demás reglas.
        </>,
        <>
          Los {num(soloVb)} viajes que solo excluye la regla nueva <code>vel_baja</code> recorren distancias normales
          (mediana de {num(disMed)} m) pero duran mucho (mediana de {num(ttMed, 1)} min; el {pc(mas20)} pasa de 20
          min). Son patinetes que no se cerraron a tiempo o que se llevaron a mano.
        </>,
        "Se añade vel_baja con umbral de 2 km/h, en el valle del histograma. Cuesta el 1 % de la demanda y la comparación del apartado 5 muestra que no cambia las conclusiones.",
      ]}
      fuente="tablas/exploracion/T10_viajes_lentos.csv"
    >
      <Grafica
        descripcion="Histograma de la velocidad media entre 0 y 8 km/h con el umbral de 2 km/h"
        trazas={trazas}
        alto={300}
        capa={{
          showlegend: false,
          bargap: 0,
          margin: { t: 26 },
          xaxis: { title: { text: "Velocidad media (km/h)" }, range: [0, 8], dtick: 1 },
          yaxis: { title: { text: "Viajes" }, range: [0, alto] },
        }}
      />
      <Cifras
        cifras={[
          { valor: num(menos1), nombre: "viajes a menos de 1 km/h" },
          { valor: num(soloVb), nombre: "solo excluidos por < 2 km/h" },
          { valor: `${num(disMed)} m`, nombre: "distancia mediana", detalle: "de esos viajes" },
          { valor: `${num(ttMed, 1)} min`, nombre: "duración mediana", detalle: "de esos viajes" },
        ]}
      />
    </Bloque>
  );
}

function BloqueSensibilidad() {
  const { datos, error } = useDatos<Record<string, Barrido>>(`${FASE}/t10_sensibilidad`);
  const [parametro, setParametro] = useState("tt_min_s");
  const [indice, setIndice] = useState<number | null>(null);
  if (!datos) return <Cargando error={error} />;
  const b = datos[parametro];
  const i = indice ?? b.umbral.indexOf(b.elegido);
  const unidad = b.etiqueta.match(/\((.*)\)/)?.[1] ?? "";
  const alto = Math.max(...b.porcentaje) * 1.15 + 0.5;
  const trazas: Data[] = [
    ...trazasUmbral(b.elegido, alto, "elegido"),
    {
      type: "scatter",
      mode: "lines+markers",
      x: b.umbral,
      y: b.porcentaje,
      customdata: b.excluidos,
      line: { color: COLOR.serie1, width: 2 },
      marker: { size: 8, color: COLOR.serie1, line: { color: "#fff", width: 2 } },
      hovertemplate: `%{x} ${unidad}<br>%{y:.2f} % (%{customdata} viajes)<extra></extra>`,
      name: "Excluidos",
    } as Data,
    {
      type: "scatter",
      mode: "markers",
      x: [b.umbral[i]],
      y: [b.porcentaje[i]],
      marker: { size: 13, color: COLOR.serie2, line: { color: "#fff", width: 2 } },
      hoverinfo: "skip",
      name: "Valor del deslizador",
    } as Data,
  ];
  const cambiar = (p: string) => {
    setParametro(p);
    setIndice(null);
  };
  return (
    <Bloque
      titulo="4. Sensibilidad de cada umbral"
      queMuestra="Qué porcentaje de los viajes del periodo de ajuste excluiría cada umbral por sí solo al moverlo, con el valor elegido en línea discontinua."
      porQue="Si un pequeño cambio de umbral moviera muchos viajes, la decisión sería frágil y habría que justificarla mejor o revisar su efecto en los resultados."
      comoLeer="Elige un parámetro y mueve el deslizador para ver cuántos viajes quitaría cada valor. Cada umbral se evalúa solo, sin las demás reglas."
      conclusiones={[
        "Duración mínima: la curva sube sin codo. 60 s es el criterio natural de «menos de un minuto no es un viaje» y excluye por sí solo el 3,7 %.",
        "Distancia mínima: el salto está por debajo de 25 m (3,5 %); a partir de ahí la curva es casi lineal, así que 50 m o 100 m cambian poco.",
        "Velocidad mínima: la curva sube suave; 2 km/h excluye el 5,0 % por sí solo, pero casi todos ya caen por las reglas anteriores.",
        "Velocidad y duración máximas: las curvas se aplanan antes del umbral elegido (25 km/h y 2 h), así que son decisiones estables.",
      ]}
      fuente="tablas/exploracion/T10_sensibilidad_umbrales.csv"
    >
      <div className="controles">
        <select value={parametro} onChange={(e) => cambiar(e.target.value)} aria-label="Parámetro">
          {Object.entries(datos).map(([k, v]) => (
            <option key={k} value={k}>
              {v.etiqueta}
            </option>
          ))}
        </select>
        <label className="deslizador">
          <span className="oculto">Valor del umbral</span>
          <input type="range" min={0} max={b.umbral.length - 1} step={1} value={i} onChange={(e) => setIndice(Number(e.target.value))} />
        </label>
      </div>
      <p className="lectura">
        Con {num(b.umbral[i], b.umbral[i] % 1 ? 1 : 0)} {unidad} se excluirían {num(b.excluidos[i])} viajes del ajuste (
        {pc(b.porcentaje[i], 2)}).
      </p>
      <Grafica
        descripcion={`Porcentaje de viajes excluidos según el umbral de ${b.etiqueta}`}
        trazas={trazas}
        alto={330}
        capa={{
          showlegend: false,
          margin: { t: 26 },
          xaxis: { title: { text: b.etiqueta } },
          yaxis: { title: { text: "Viajes excluidos (%)" }, range: [0, alto], ticksuffix: " %" },
        }}
      />
    </Bloque>
  );
}

function BloqueComparacion() {
  const { datos, error } = useDatos<Comparacion>(`${FASE}/t10_comparacion`);
  if (!datos) return <Cargando error={error} />;
  const d = datos.diferencia_ajuste_pc;
  const trazas: Data[] = [
    {
      type: "bar",
      orientation: "h",
      y: d.map((x) => x.indicador),
      x: d.map((x) => x.diferencia_pc),
      marker: { color: COLOR.serie1 },
      text: d.map((x) => (x.diferencia_pc > 0 ? "+" : "") + pc(x.diferencia_pc, 2)),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate: "<b>%{y}</b><br>%{x:+.2f} % con la limpieza permisiva<extra></extra>",
    } as Data,
  ];
  const ind = (limpieza: string, periodo: string) =>
    datos.indicadores.find((x) => x.limpieza === limpieza && x.periodo === periodo)!;
  const filas = [
    ["Viajes elegibles", "viajes_elegibles", 0],
    ["Distancia mediana (m)", "dis_m_mediana", 1],
    ["Duración mediana (s)", "tt_s_mediana", 0],
    ["Velocidad mediana (km/h)", "vel_kmh_mediana", 2],
    ["Kilómetros totales", "km_totales", 1],
    ["Energía con 13,5 Wh/km (kWh)", "energia_kwh_13_5", 1],
    ["Celdas H3 de resolución 8 usadas", "celdas_h3_res8", 0],
    ["Extremos en el 20 % de celdas más usadas (%)", "extremos_en_20pc_celdas_pc", 2],
  ] as const;
  const u = datos.umbrales;
  return (
    <Bloque
      titulo="5. Limpieza permisiva frente a la principal"
      queMuestra={`Cuánto cambia cada indicador del periodo de ajuste si se usa una limpieza menos restrictiva: ${u.permisiva.tt_min_s} s, ${u.permisiva.dis_min_m} m, sin velocidad mínima, ${u.permisiva.vel_max_kmh} km/h y ${num(u.permisiva.tt_max_s / 3600)} h.`}
      porQue="Es la prueba de robustez de la limpieza. Si los indicadores que usarán las fases siguientes apenas cambian, las conclusiones del proyecto no dependen de los umbrales."
      conclusiones={[
        <>
          La permisiva deja un {pc(d[0].diferencia_pc)} más de viajes en el ajuste ({num(Number(ind("permisiva", "ajuste").viajes_elegibles))}{" "}
          frente a {num(Number(ind("principal", "ajuste").viajes_elegibles))}).
        </>,
        "Las medianas de distancia, duración y velocidad cambian menos de un 3 %; los kilómetros y la energía, un 0,6 %.",
        <>
          La concentración espacial es la misma: el 20 % de celdas H3 más usadas reúne el{" "}
          {pc(Number(ind("principal", "ajuste").extremos_en_20pc_celdas_pc))} de los extremos con las dos limpiezas.
        </>,
        <>
          <strong>Se usa la limpieza principal</strong>: las conclusiones no dependen de los umbrales. La comparación
          se repetirá con los indicadores de la red elegida.
        </>,
      ]}
      fuente="tablas/exploracion/T10_comparacion_limpiezas.csv"
    >
      <Grafica
        descripcion="Diferencia porcentual de cada indicador entre la limpieza permisiva y la principal"
        trazas={trazas}
        alto={330}
        capa={{
          showlegend: false,
          margin: { l: 8, r: 60 },
          xaxis: {
            title: { text: "Permisiva respecto a principal (%)" },
            zeroline: true,
            zerolinecolor: COLOR.texto,
            ticksuffix: " %",
            range: [Math.min(...d.map((x) => x.diferencia_pc)) - 1.3, Math.max(...d.map((x) => x.diferencia_pc)) + 0.9],
          },
          yaxis: { autorange: "reversed", ticks: "", showgrid: false },
        }}
      />
      <TablaDesplegable
        titulo="Ver los indicadores de las dos limpiezas"
        cabeceras={["Indicador", "Principal, ajuste", "Permisiva, ajuste", "Principal, reservada", "Permisiva, reservada"]}
        numericas={[1, 2, 3, 4]}
        filas={filas.map(([nombre, clave, dec]) => [
          nombre,
          num(Number(ind("principal", "ajuste")[clave]), dec),
          num(Number(ind("permisiva", "ajuste")[clave]), dec),
          num(Number(ind("principal", "reservada")[clave]), dec),
          num(Number(ind("permisiva", "reservada")[clave]), dec),
        ])}
      />
    </Bloque>
  );
}
