// Relato del mapa: cada capítulo fija la cámara, las capas y los controles, y explica
// una decisión del proyecto con cifras que vienen del manifiesto (nunca escritas a mano).
import type { ReactNode } from "react";
import { num, pc } from "../formato";
import { atendidoPor, type BarridoRadio, type Demo, type Red } from "./datos";

export type TipoDia = "laborable" | "fin_de_semana";
export type ModoEstaciones = "no" | "barrido" | "anclajes" | "ocupacion" | "energia" | "puntos";

export type Capas = {
  viajes: "no" | "todos" | "atencion";
  demanda: "no" | "total" | "hora" | "plana";
  saldo: boolean;
  estaciones: ModoEstaciones;
  radios: boolean;
  flujos: boolean;
};

export type Vista = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };

export type Contexto = {
  demo: Demo;
  red: Red;
  radio: number;
  barrido: BarridoRadio;
  k: number;
  t: number;
  tipoDia: TipoDia;
  ahora: { vacias: number; llenas: number; enCurso: number };
};

export type Cifra = { valor: string; nombre: string };

export type Capitulo = {
  id: string;
  corto: string;
  titulo: string;
  vista: (c: Contexto) => Vista;
  capas: Capas;
  controles: { reloj?: boolean; tipoDia?: boolean; franja?: boolean; red?: boolean; k?: boolean; tabla?: boolean; capas?: boolean };
  horaInicial?: number;
  reproducir?: boolean;
  animarK?: boolean;
  seleccionarMaxEnergia?: boolean;
  girar?: boolean;
  cuerpo: (c: Contexto) => ReactNode;
  cifras: (c: Contexto) => Cifra[];
  decision?: (c: Contexto) => ReactNode;
  leyenda?: "viajes" | "atencion" | "demanda" | "saldo" | "barrido" | "anclajes" | "ocupacion" | "energia" | "flujos" | "radios";
};

const ROMA = { longitude: 12.4905, latitude: 41.8885 };
const h = (horas: number) => (horas - 4) * 3600; // hora del reloj → segundos desde las 4:00
const fechaLarga = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${nombres[dia.getUTCDay()]} ${d} de ${meses[m - 1]}`;
};
const kWh = (x: number) => `${num(x, x < 1 ? 2 : 1)} kWh`;

export const CAPITULOS: Capitulo[] = [
  {
    id: "inicio",
    corto: "Inicio",
    titulo: "Roma, febrero de 2021: patinetes sin estaciones",
    vista: () => ({ ...ROMA, zoom: 12.35, pitch: 52, bearing: -18 }),
    capas: { viajes: "todos", demanda: "no", saldo: false, estaciones: "no", radios: false, flujos: false },
    controles: { reloj: true },
    horaInicial: h(17),
    reproducir: true,
    girar: true,
    leyenda: "viajes",
    cuerpo: ({ demo }) => {
      const c = demo.manifiesto.cifras;
      return (
        <>
          <p>
            El piloto de Helbiz registró {num(c.viajes_csv)} viajes en un mes con {num(c.patinetes_mes)} patinetes que se
            dejaban en la acera. El Ayuntamiento exige que, cuando no se usan, estén anclados a una estación de recarga.
          </p>
          <p>
            Así se movió la flota el {fechaLarga(demo.dia.fecha)}, un laborable típico ({num(demo.dia.viajes.length)} viajes).
            Cada trazo une el origen y el destino de un viaje durante su duración real. El CSV no trae trayectorias: la línea
            recta es ilustrativa.
          </p>
        </>
      );
    },
    cifras: ({ demo }) => {
      const c = demo.manifiesto.cifras;
      return [
        { valor: num(c.viajes_elegibles), nombre: "viajes válidos tras la limpieza" },
        { valor: num(c.viajes_dia_ajuste, 1), nombre: "viajes al día (1–21/02)" },
        { valor: num(c.simultaneos_max), nombre: "viajes a la vez, como máximo" },
        { valor: num(c.patinetes_activos_dia, 1), nombre: "patinetes usados al día" },
      ];
    },
    decision: () => (
      <>
        <b>La pregunta.</b> Si cada viaje tuviera que empezar y acabar en una estación, ¿cuántas hacen falta, dónde y con
        cuántos patinetes y anclajes?
      </>
    ),
  },
  {
    id: "demanda",
    corto: "Demanda",
    titulo: "Dónde empiezan y acaban los viajes",
    vista: () => ({ ...ROMA, zoom: 12.45, pitch: 48, bearing: 12 }),
    capas: { viajes: "no", demanda: "total", saldo: false, estaciones: "no", radios: false, flujos: false },
    controles: {},
    leyenda: "demanda",
    cuerpo: ({ demo }) => (
      <p>
        Cada hexágono es una celda H3 de 0,1 km² y su altura, los orígenes más destinos por día del periodo de ajuste
        (1–21/02). La demanda no se limita al centro histórico: varias de las celdas con más extremos están en barrios
        residenciales alrededor de San Giovanni y el Pigneto y al oeste, junto a Villa Pamphili. En total hay{" "}
        {num(demo.manifiesto.cifras.celdas9_con_demanda)} celdas con demanda.
      </p>
    ),
    cifras: ({ demo }) => {
      const c = demo.manifiesto.cifras;
      return [
        { valor: num(c.celdas9_con_demanda), nombre: "celdas con demanda" },
        { valor: num(c.celdas9_50pct), nombre: `celdas reúnen la mitad (${num(c.area9_50pct_km2, 1)} km²)` },
        { valor: pc(c.pct_extremos_top20pct_celdas9), nombre: "de los extremos en el 20 % de las celdas" },
      ];
    },
    decision: () => (
      <>
        <b>Decisión.</b> Los candidatos a estación son los centros de estas celdas: resolución 9, con 201 m de arista, del
        orden del radio de acceso a pie.
      </>
    ),
  },
  {
    id: "horas",
    corto: "Horas",
    titulo: "A qué hora",
    vista: () => ({ ...ROMA, zoom: 12.45, pitch: 50, bearing: 24 }),
    capas: { viajes: "no", demanda: "hora", saldo: false, estaciones: "no", radios: false, flujos: false },
    controles: { reloj: true, tipoDia: true },
    horaInicial: h(6),
    reproducir: true,
    leyenda: "demanda",
    cuerpo: ({ demo }) => {
      const c = demo.manifiesto.cifras;
      return (
        <p>
          La altura es ahora la media de orígenes más destinos en cada hora. En laborable aparece una punta de mañana de 7
          a 10 h y el máximo llega a las {c.hora_punta_laborable} h; el fin de semana apenas hay punta de mañana y el máximo
          es a las {c.hora_punta_fin_de_semana} h. El volumen diario es casi el mismo, pero los perfiles difieren en un{" "}
          {pc(c.diferencia_perfiles_pc)} de los viajes.
        </p>
      );
    },
    cifras: ({ demo }) => {
      const c = demo.manifiesto.cifras;
      return [
        { valor: num(c.viajes_dia_laborable, 1), nombre: "viajes por laborable" },
        { valor: num(c.viajes_dia_fin_de_semana, 1), nombre: "viajes por día de fin de semana" },
        { valor: `${c.hora_punta_laborable} h / ${c.hora_punta_fin_de_semana} h`, nombre: "hora punta: laborable / fin de semana" },
      ];
    },
    decision: () => (
      <>
        <b>Decisión.</b> Cinco franjas (madrugada, punta de mañana, mediodía, punta de tarde y noche) y laborable y fin de
        semana por separado en las matrices O-D y en el simulador.
      </>
    ),
  },
  {
    id: "saldo",
    corto: "Saldo",
    titulo: "El desequilibrio: zonas que se vacían y zonas que se llenan",
    vista: () => ({ ...ROMA, zoom: 12.2, pitch: 50, bearing: -32 }),
    capas: { viajes: "no", demanda: "no", saldo: true, estaciones: "no", radios: false, flujos: false },
    controles: { franja: true },
    leyenda: "saldo",
    cuerpo: () => (
      <>
        <p>
          Celdas de 0,74 km² según el saldo orígenes − destinos al día. En rojo, las que emiten más patinetes de los que
          reciben; en azul, las que los acumulan. La altura es el tamaño del saldo. Con estaciones, unas se vaciarían y
          otras se llenarían.
        </p>
        <p>Por franjas se ve el vaivén: el centro recibe patinetes por la mañana y los devuelve por la tarde.</p>
      </>
    ),
    cifras: ({ demo }) => {
      const c = demo.manifiesto.cifras;
      return [
        { valor: `${c.celdas8_emisoras} / ${c.celdas8_receptoras}`, nombre: "celdas emisoras / receptoras" },
        { valor: num(c.rebalanceo_res8_dia, 1), nombre: "patinetes/día a recolocar, como mínimo" },
        { valor: pc(c.operador_pct_saldo_compensado), nombre: "del saldo ya lo compensaba el operador" },
      ];
    },
    decision: ({ demo }) => (
      <>
        <b>Decisión.</b> El rebalanceo nocturno es parte del escenario base: {num(demo.manifiesto.cifras.rebalanceo_base_dia)}{" "}
        patinetes al día como punto de partida.
      </>
    ),
  },
  {
    id: "andar",
    corto: "Andar",
    titulo: "Cuánto se puede andar",
    vista: () => ({ longitude: 12.4935, latitude: 41.8935, zoom: 14.1, pitch: 38, bearing: -10 }),
    capas: { viajes: "no", demanda: "plana", saldo: false, estaciones: "puntos", radios: true, flujos: false },
    controles: { red: true },
    leyenda: "radios",
    cuerpo: ({ demo, radio }) => {
      const c = demo.manifiesto.cifras;
      const r = c.radios[String(radio)];
      return (
        <>
          <p>
            Con estaciones, cada viaje empieza y acaba andando. Una estación a {radio} m en línea recta son unos{" "}
            {num(radio * c.rodeo_mediana)} m por la calle (rodeo de {num(c.rodeo_mediana, 2)} medido en los viajes). Con el
            caso medio, a 2R/3 en cada extremo, se andan {num(r.dist_pie_medio_m)} m en total a {num(c.velocidad_pie_ms, 1)}{" "}
            m/s.
          </p>
          <p>
            Con {radio} m, en el {pc(r.pct_andar_supera_viaje_medio)} de los viajes se tardaría más en llegar andando a las
            estaciones que en el propio viaje. Cambia el radio para comparar.
          </p>
        </>
      );
    },
    cifras: ({ demo, radio }) => {
      const r = demo.manifiesto.cifras.radios[String(radio)];
      return [
        { valor: `${radio} m`, nombre: "radio de acceso" },
        { valor: pc(r.pct_andar_supera_viaje_medio), nombre: "tardaría más andando que en patinete" },
        { valor: pc(r.pct_dis_le_2R), nombre: "de los viajes recorre menos de 2R" },
      ];
    },
    decision: ({ demo }) => (
      <>
        <b>Decisión.</b> Radios de 200, 250 y 300 m. 400 m queda como sensibilidad: con él, el{" "}
        {pc(demo.manifiesto.cifras.radios["400"].pct_andar_supera_viaje_medio)} de los viajes tardaría más andando que en
        patinete.
      </>
    ),
  },
  {
    id: "estaciones",
    corto: "Estaciones",
    titulo: "Dónde poner las estaciones",
    vista: () => ({ ...ROMA, zoom: 12.5, pitch: 56, bearing: 18 }),
    capas: { viajes: "no", demanda: "plana", saldo: false, estaciones: "barrido", radios: true, flujos: false },
    controles: { red: true, k: true },
    animarK: true,
    leyenda: "barrido",
    cuerpo: ({ radio, barrido, demo }) => (
      <>
        <p>
          Se añaden estaciones de una en una sobre los {num(demo.redes.get(radio)!.resumen.candidatos)} candidatos. Cada vez
          entra la que cubre más orígenes o destinos que aún no tenían una estación a menos de {radio} m. La altura de cada
          columna es lo que aportó al entrar.
        </p>
        <p>
          Un viaje cuenta como cubierto si tiene estación en el origen y en el destino. La primera estación capta{" "}
          {num(barrido.ganancia_extremos[0] / demo.barrido.dias, 1)} extremos al día; la {barrido.k_referencia}.ª, solo{" "}
          {num(barrido.ganancia_extremos[barrido.k_referencia - 1] / demo.barrido.dias, 1)}.
        </p>
      </>
    ),
    cifras: ({ k, barrido, demo }) => [
      { valor: num(k), nombre: "estaciones" },
      { valor: pc(barrido.pct_viajes[k - 1]), nombre: "viajes con origen y destino cubiertos" },
      { valor: `${num(barrido.d_mediana_m[k - 1])} m`, nombre: "mediana a la estación más cercana" },
      { valor: num(barrido.ganancia_extremos[k - 1] / demo.barrido.dias, 1), nombre: "extremos/día que añade la última" },
    ],
    decision: ({ barrido, radio }) => (
      <>
        <b>Red preliminar.</b> La menor k que cubre el 80 % de los viajes: <b>{barrido.k_referencia} estaciones con {radio} m</b>.
        Es una heurística voraz; la red final saldrá de comparar LSCP, p-mediana y MCLP exactos (T25–T28).
      </>
    ),
  },
  {
    id: "flota",
    corto: "Flota",
    titulo: "Cuántos patinetes y cuántos anclajes",
    vista: () => ({ longitude: 12.4925, latitude: 41.8915, zoom: 13.35, pitch: 60, bearing: -28 }),
    capas: { viajes: "no", demanda: "no", saldo: false, estaciones: "anclajes", radios: false, flujos: false },
    controles: { red: true },
    leyenda: "anclajes",
    cuerpo: ({ demo }) => (
      <>
        <p>
          En cada estación se reproducen las salidas y llegadas de las {demo.manifiesto.periodo.dias} jornadas del ajuste,
          con el stock repuesto cada noche a las {demo.manifiesto.hora_reposicion}:00. El stock inicial es lo que necesita
          para no quedarse vacía en su peor jornada; los anclajes, el máximo de patinetes que llega a tener a la vez.
        </p>
        <p>
          La flota suma el peor día de cada estación, así que es conservadora. La simulación con rechazos (T32) la ajustará.
        </p>
      </>
    ),
    cifras: ({ red, demo }) => [
      { valor: num(red.resumen.flota), nombre: `patinetes (el piloto usó ${num(demo.manifiesto.cifras.patinetes_mes)})` },
      { valor: num(red.resumen.anclajes), nombre: `anclajes (mediana de ${num(red.resumen.anclajes_mediana)} por estación)` },
      { valor: num(red.resumen.rebalanceo_noche_media), nombre: "patinetes a recolocar cada noche" },
      { valor: num(red.resumen.viajes_por_patinete_dia, 2), nombre: "viajes por patinete y día" },
    ],
    decision: () => (
      <>
        <b>Referencia de capacidad.</b> Stock inicial y anclajes por estación para la simulación de inventario (T32), con
        asignación fija y sin rechazos.
      </>
    ),
  },
  {
    id: "compara",
    corto: "Comparar",
    titulo: "Cada radio, su red",
    vista: () => ({ ...ROMA, zoom: 12.3, pitch: 55, bearing: 8 }),
    capas: { viajes: "no", demanda: "no", saldo: false, estaciones: "anclajes", radios: true, flujos: false },
    controles: { red: true, tabla: true },
    leyenda: "anclajes",
    cuerpo: () => (
      <p>
        Las cuatro redes de referencia atienden el mismo 80 % de los viajes. Un radio mayor pide menos estaciones, menos
        patinetes y menos rebalanceo, pero cada usuario anda más. Es el compromiso que pide el enunciado: no hay una red que
        gane en todo.
      </p>
    ),
    cifras: () => [],
    decision: () => (
      <>
        <b>Siguiente paso.</b> Elegir la red con un criterio fijado en el ajuste y validarla con la semana reservada (22–28/02,
        T30).
      </>
    ),
  },
  {
    id: "jornada",
    corto: "Jornada",
    titulo: "Un día en las estaciones",
    vista: () => ({ ...ROMA, zoom: 12.75, pitch: 58, bearing: -12 }),
    capas: { viajes: "atencion", demanda: "no", saldo: false, estaciones: "ocupacion", radios: false, flujos: false },
    controles: { reloj: true, red: true },
    horaInicial: h(8),
    reproducir: true,
    leyenda: "ocupacion",
    cuerpo: ({ demo, red }) => (
      <p>
        La jornada del {fechaLarga(demo.dia.fecha)} con las {red.resumen.estaciones} estaciones. El contorno de cada columna son
        sus anclajes y el relleno, los patinetes anclados cada 15 minutos. En naranja, los viajes que la red atendería; en
        gris, los que quedan fuera por no tener estación cerca del origen o del destino.
      </p>
    ),
    cifras: ({ ahora, demo, radio }) => {
      const atendidos = demo.dia.viajes.filter((v) => atendidoPor(demo.dia, v, radio)).length;
      return [
        { valor: `${num(atendidos)} de ${num(demo.dia.viajes.length)}`, nombre: `viajes del día atendidos (${radio} m)` },
        { valor: num(ahora.enCurso), nombre: "viajes en curso ahora" },
        { valor: num(ahora.vacias), nombre: "estaciones vacías ahora" },
        { valor: num(ahora.llenas), nombre: "estaciones llenas ahora" },
      ];
    },
    decision: () => (
      <>
        <b>Lectura.</b> Ninguna estación se vacía ni se llena porque su stock y sus anclajes salen de su peor jornada. Con
        menos patinetes aparecerían rechazos: eso es lo que medirá T32–T34.
      </>
    ),
  },
  {
    id: "flujos",
    corto: "Flujos",
    titulo: "Hacia dónde van",
    vista: () => ({ ...ROMA, zoom: 12.55, pitch: 52, bearing: 30 }),
    capas: { viajes: "no", demanda: "no", saldo: false, estaciones: "puntos", radios: false, flujos: true },
    controles: { red: true },
    leyenda: "flujos",
    cuerpo: ({ red }) => (
      <p>
        Los {num(red.pares.length)} pares de estaciones con más viajes. El arco nace tenue en la estación de salida y se
        intensifica en la de llegada; su grosor es el número de viajes. Casi todos los pares tienen su gemelo en sentido
        contrario: el desequilibrio no viene de unos pocos corredores, sino de muchos flujos pequeños.
      </p>
    ),
    cifras: ({ red, demo }) => [
      { valor: num(red.viajesAtendidos / demo.manifiesto.periodo.dias, 1), nombre: "viajes atendidos al día" },
      { valor: pc((100 * red.viajesMismaEstacion) / red.viajesAtendidos), nombre: "vuelve a la misma estación" },
      { valor: pc(demo.manifiesto.cifras.pct_viajes_intrazonales_res8), nombre: "no sale de su celda de 0,74 km²" },
    ],
    decision: () => (
      <>
        <b>Decisión.</b> El rebalanceo se organiza por zonas, no por corredores (T20).
      </>
    ),
  },
  {
    id: "energia",
    corto: "Energía",
    titulo: "Cuánta energía hay que reponer",
    vista: ({ red }) => {
      const e = red.estaciones.reduce((a, b) => (b.energia_kwh_dia > a.energia_kwh_dia ? b : a));
      return { longitude: e.lon + 0.004, latitude: e.lat - 0.006, zoom: 13.6, pitch: 62, bearing: -20 };
    },
    capas: { viajes: "no", demanda: "no", saldo: false, estaciones: "energia", radios: false, flujos: false },
    controles: { red: true },
    seleccionarMaxEnergia: true,
    leyenda: "energia",
    cuerpo: ({ demo, red }) => {
      const c = demo.manifiesto.cifras;
      return (
        <>
          <p>
            Con {num(c.consumo_wh_km, 1)} Wh/km por la distancia recorrida, la energía de cada viaje se asigna a la estación
            donde termina, que es donde se recargará. Toda la flota gasta {kWh(c.flota_kwh_dia)}/día; las{" "}
            {red.resumen.estaciones} estaciones reciben {kWh(red.resumen.kwh_dia_total)}/día.
          </p>
          <p>
            La que más recibe se queda en {kWh(red.resumen.kwh_dia_estacion_max)}/día, frente a los {num(c.bateria_wh)} Wh de
            la batería de un patinete. Solo el {pc(c.pct_energia_10_16h)} de la energía llega con sol (10–16 h) y el{" "}
            {pc(c.pct_energia_16_24h)} entre las 16 y las 24 h.
          </p>
        </>
      );
    },
    cifras: ({ demo, red }) => [
      { valor: kWh(demo.manifiesto.cifras.flota_kwh_dia), nombre: "al día, toda la flota" },
      { valor: kWh(red.resumen.kwh_dia_estacion_max), nombre: "al día, la estación con más" },
      { valor: kWh(red.resumen.kwh_dia_estacion_mediana), nombre: "al día, la estación mediana" },
    ],
    decision: () => (
      <>
        <b>Para la fase 3.</b> Como la energía llega sobre todo por la tarde y la noche, la estación fotovoltaica necesitará
        batería para guardar lo que produce a mediodía (T50–T55).
      </>
    ),
  },
  {
    id: "explora",
    corto: "Explora",
    titulo: "Explora",
    vista: () => ({ ...ROMA, zoom: 12.4, pitch: 50, bearing: 0 }),
    capas: { viajes: "no", demanda: "no", saldo: false, estaciones: "anclajes", radios: false, flujos: false },
    controles: { reloj: true, red: true, capas: true, tipoDia: true },
    horaInicial: h(8),
    cuerpo: () => (
      <p>
        Combina capas, cambia de radio y mueve el reloj. Pulsa una estación para ver su ficha: por qué está ahí, cuánto se
        usa y cuánta energía recibe. Arrastra para mover el mapa y usa el botón derecho o Ctrl para inclinarlo y girarlo.
      </p>
    ),
    cifras: () => [],
  },
];
