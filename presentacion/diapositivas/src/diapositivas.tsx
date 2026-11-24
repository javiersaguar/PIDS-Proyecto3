// Contenido de cada diapositiva. Todas las cifras salen de datos.json (resultados de los notebooks).
import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { Aparece, Contador, Palabras, SUAVE, useEstatico } from "./animacion";
import { Conciliacion, CurvaFlota, Embudo, MapaRed, Pareto, PerfilHorario } from "./graficos";
import type { Datos } from "./tipos";
import { num, pc } from "./tipos";

export type Diapositiva = { id: string; titulo: string; contenido: (d: Datos) => ReactNode; portada?: boolean };

// Etiqueta con una raya que se estira, título palabra a palabra y entradilla.
function Cabecera({ etiqueta, titulo, entradilla }: { etiqueta: string; titulo: string; entradilla?: ReactNode }) {
  const estatico = useEstatico();
  return (
    <header>
      <div className="etiqueta">
        <motion.span className="raya" initial={estatico ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, ease: SUAVE }} />
        <motion.span initial={estatico ? false : { opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.6, ease: SUAVE }}>
          {etiqueta}
        </motion.span>
      </div>
      <h2>
        <Palabras texto={titulo} retardo={0.15} />
      </h2>
      {entradilla && (
        <Aparece retardo={0.55}>
          <p className="entradilla">{entradilla}</p>
        </Aparece>
      )}
    </header>
  );
}

type Cifra = { valor: string; nombre: string; detalle?: string };

// Tarjetas de cifras: entran con muelle y el número cuenta hasta su valor.
function Cifras({ cifras, retardo = 0.4, columnas }: { cifras: Cifra[]; retardo?: number; columnas?: number }) {
  const estatico = useEstatico();
  return (
    <div className={`cifras${columnas === 1 ? " compactas" : ""}`} style={{ "--n": columnas ?? cifras.length } as CSSProperties}>
      {cifras.map((c, i) => {
        const r = retardo + 0.14 * i;
        return (
          <motion.div
            key={c.nombre}
            className="cifra"
            initial={estatico ? false : { opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: r, type: "spring", stiffness: 140, damping: 16 }}
          >
            <motion.span className="brillo" initial={estatico ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: r + 0.2, duration: 0.9, ease: SUAVE }} />
            <div className="valor">
              <Contador texto={c.valor} retardo={r + 0.1} />
            </div>
            <div className="nombre">{c.nombre}</div>
            {c.detalle && <div className="detalle">{c.detalle}</div>}
          </motion.div>
        );
      })}
    </div>
  );
}

// Lista de ideas: cada una entra desde la izquierda con su marca girando.
function Puntos({ items, retardo = 0.6 }: { items: ReactNode[]; retardo?: number }) {
  const estatico = useEstatico();
  return (
    <ul className="puntos">
      {items.map((t, i) => (
        <motion.li key={i} initial={estatico ? false : { opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: retardo + 0.18 * i, duration: 0.7, ease: SUAVE }}>
          <motion.span className="marca" initial={estatico ? false : { rotate: -135, scale: 0 }} animate={{ rotate: 45, scale: 1 }} transition={{ delay: retardo + 0.18 * i + 0.1, type: "spring", stiffness: 260, damping: 14 }} />
          {t}
        </motion.li>
      ))}
    </ul>
  );
}

// Tarjetas que se abaten en 3D al entrar.
function Tarjetas({ items, retardo = 0.5 }: { items: [string, ReactNode][]; retardo?: number }) {
  const estatico = useEstatico();
  return (
    <div className="cuerpo tarjetas" style={{ alignContent: "center" }}>
      {items.map(([t, p], i) => (
        <motion.div
          key={t}
          className="tarjeta"
          style={{ transformPerspective: 1200, transformOrigin: "50% 0%" }}
          initial={estatico ? false : { opacity: 0, rotateX: -75, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ delay: retardo + 0.14 * i, type: "spring", stiffness: 90, damping: 14 }}
        >
          <h3>{t}</h3>
          <p>{p}</p>
        </motion.div>
      ))}
    </div>
  );
}

// Cifras grandes en fila para la portada y el cierre.
function Marcador({ items, retardo }: { items: [string, string][]; retardo: number }) {
  const estatico = useEstatico();
  return (
    <div className="marcador">
      {items.map(([valor, nombre], i) => (
        <motion.div key={nombre} initial={estatico ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: retardo + 0.15 * i, duration: 0.8, ease: SUAVE }}>
          <div className="valor">
            <Contador texto={valor} retardo={retardo + 0.15 * i} duracion={2} />
          </div>
          <div className="nombre">{nombre}</div>
        </motion.div>
      ))}
    </div>
  );
}

// Lista de diapositivas, en el orden en que se proyectan. Para quitar una, se borra su bloque
// { id, titulo, contenido }; para moverla, se corta y se pega en otra posición. Para añadir una,
// se copia esta plantilla donde toque (los números de página y los puntos se ajustan solos):
//
//   {
//     id: "nueva",                       // identificador único, sin espacios
//     titulo: "Título corto",            // lo leen los lectores de pantalla y los puntos de abajo
//     contenido: (d) => (                // d: cifras de datos.json (tipos.ts dice qué hay)
//       <>
//         <Cabecera etiqueta="Fase X · Tema" titulo="Frase que resume la diapositiva" entradilla="Texto opcional" />
//         <div className="cuerpo dos">    {/* dos columnas; "dos-iguales" las hace iguales */}
//           <Puntos items={[<>Idea con <strong>énfasis</strong></>, <>Otra idea: {num(d.red.k)} estaciones</>]} />
//           <Cifras columnas={1} cifras={[{ valor: pc(d.inventario.pct), nombre: "atendidos", detalle: "con 400 patinetes" }]} />
//         </div>
//       </>
//     ),
//   },
//
// Otras piezas: <Tarjetas items={[["Título", "Texto"], …]} />, <Aparece retardo={0.5}>…</Aparece>
// para que cualquier bloque entre animado, y los gráficos de graficos.tsx (MapaRed, CurvaFlota…).
export const DIAPOSITIVAS: Diapositiva[] = [
  {
    id: "portada",
    titulo: "Portada",
    portada: true,
    contenido: (d) => (
      <>
        <div className="fondo-mapa">
          <MapaRed estaciones={d.estaciones} lineas={d.lineas} modo="fondo" retardo={0.4} />
        </div>
        <div className="portada-texto">
          <Aparece>
            <div className="etiqueta">PIDS · Proyecto 3 · Grupo 05</div>
          </Aparece>
          <h1>
            <Palabras texto="Estaciones de recarga" retardo={0.2} paso={0.09} />
            <br />
            <span className="degradado">
              <Palabras texto="para patinetes en Roma" retardo={0.45} paso={0.09} />
            </span>
          </h1>
          <Aparece retardo={1}>
            <p className="entradilla">Matrices origen-destino, red de estaciones y tamaño de la flota a partir de los viajes de Helbiz en febrero de 2021</p>
          </Aparece>
          <Marcador
            retardo={1.3}
            items={[
              [num(d.embudo.elegibles), "viajes válidos"],
              [num(d.red.k), `estaciones a ${num(d.red.radio)} m`],
              [num(d.flota.minima), "patinetes"],
            ]}
          />
          <Aparece retardo={1.9} className="autores">
            Javier Saguar · Alejandro Cuevas
          </Aparece>
        </div>
      </>
    ),
  },
  {
    id: "problema",
    titulo: "El problema",
    contenido: () => (
      <>
        <Cabecera
          etiqueta="El encargo"
          titulo="Todos los patinetes, anclados a una estación"
          entradilla="El Ayuntamiento no deja aparcar en la acera. Hay que decidir cuántas estaciones poner, dónde, con cuántos anclajes y con cuántos patinetes."
        />
        <div className="cuerpo dos-iguales">
          <Puntos
            items={[
              <><strong>Pocas estaciones</strong> y muchos patinetes en cada una</>,
              <><strong>Estación cerca</strong> del origen de cada viaje</>,
              <><strong>Estación cerca</strong> del destino de cada viaje</>,
              <><strong>Pocos patinetes</strong> en el sistema</>,
              <><strong>Mucho uso</strong> de cada patinete</>,
            ]}
          />
          <Aparece retardo={1.6} className="tarjeta destacada">
            <h3>Los objetivos chocan</h3>
            <p>
              Menos estaciones obligan a andar más, y menos patinetes dejan viajes sin atender. La solución es un compromiso: fijamos el criterio antes de mirar el resultado y lo
              comprobamos con una semana que no se usa para ajustar.
            </p>
          </Aparece>
        </div>
      </>
    ),
  },
  {
    id: "datos",
    titulo: "Datos",
    contenido: (d) => {
      const [aj, res] = d.embudo.periodos;
      return (
        <>
          <Cabecera
            etiqueta="Fase 0 · Datos"
            titulo={`${num(d.embudo.elegibles)} viajes válidos de ${num(d.embudo.brutos)}`}
            entradilla="La limpieza solo quita lo que no es un viaje: desbloqueos sin moverse, recorridos de pocos metros y duraciones o velocidades imposibles."
          />
          <div className="cuerpo dos">
            <Embudo e={d.embudo} />
            <Cifras
              retardo={1}
              cifras={[
                { valor: num(aj.elegibles), nombre: "Periodo de ajuste", detalle: "1 a 21 de febrero: con él se diseña" },
                { valor: num(res.elegibles), nombre: "Semana reservada", detalle: "22 a 28 de febrero: solo para validar" },
              ]}
            />
          </div>
        </>
      );
    },
  },
  {
    id: "demanda",
    titulo: "Cuándo se viaja",
    contenido: (d) => {
      const pico = d.perfil.horas[d.perfil.laborable.indexOf(Math.max(...d.perfil.laborable))];
      return (
        <>
          <Cabecera etiqueta="Fase 0 · Exploración" titulo="Dos formas de usar el patinete" />
          <div className="cuerpo dos">
            <PerfilHorario p={d.perfil} />
            <Puntos
              retardo={1.2}
              items={[
                <>Entre semana hay una <strong>punta de mañana de 7 a 10 h</strong> y el máximo llega a las <strong>{pico} h</strong>.</>,
                <>El fin de semana no hay punta de mañana: el uso sube hasta media tarde y se mantiene hasta la noche.</>,
                <>El centro recibe patinetes por la mañana y los devuelve por la tarde, pero no del todo: hace falta rebalancear.</>,
              ]}
            />
          </div>
        </>
      );
    },
  },
  {
    id: "od",
    titulo: "Matrices origen-destino",
    contenido: (d) => (
      <>
        <Cabecera
          etiqueta="Fase 1 · Matrices O-D"
          titulo="Una demanda repartida, de viajes cortos"
          entradilla="Matrices en celdas H3, por municipios y zonas urbanísticas, por franja horaria y por tipo de día."
        />
        <div className="cuerpo" style={{ alignContent: "center" }}>
          <Cifras
            retardo={0.7}
            cifras={[
              { valor: num(d.od.pares), nombre: "pares de celdas con viajes", detalle: `${num(d.od.viajes)} viajes del ajuste, H3 de resolución 8` },
              { valor: pc(d.od.pct_intrazonal), nombre: "no salen de su celda", detalle: "parte empezaría y acabaría en la misma estación" },
              { valor: pc(d.od.pct_top20), nombre: "en los 20 pares más fuertes", detalle: "no hay unos pocos corredores dominantes" },
              { valor: num(d.od.asimetria, 3), nombre: "índice de asimetría", detalle: `frente a ${num(d.od.asimetria_azar, 3)} si ida y vuelta fuesen al azar` },
            ]}
          />
        </div>
      </>
    ),
  },
  {
    id: "metodos",
    titulo: "Cómo se elige la red",
    contenido: () => (
      <>
        <Cabecera
          etiqueta="Fase 1 · Localización"
          titulo="Cuatro métodos con las mismas reglas"
          entradilla="Mismos candidatos (celdas H3 de resolución 9 con demanda), mismos viajes y misma definición: un viaje está cubierto si su origen y su destino tienen estación dentro del radio."
        />
        <Tarjetas
          retardo={0.8}
          items={[
            ["K-medoids y K-means", "Líneas base: agrupan los extremos de los viajes para cada número de estaciones."],
            ["Cobertura de conjuntos (LSCP)", "El mínimo de estaciones que cubre un porcentaje fijado de los viajes. MILP con HiGHS."],
            ["p-mediana", "Con un número fijo de estaciones, la menor distancia total de acceso."],
            ["Cobertura máxima (MCLP)", "Con un número fijo de estaciones, el máximo de viajes con los dos extremos cubiertos."],
          ]}
        />
      </>
    ),
  },
  {
    id: "pareto",
    titulo: "Frente de Pareto",
    contenido: (d) => {
      const alt = d.finalistas.find((f) => f.rol === "radio_menor");
      return (
        <>
          <Cabecera etiqueta="Fase 1 · Elección de la red" titulo={`${num(d.red.k)} estaciones a ${num(d.red.radio)} m`} />
          <div className="cuerpo dos">
            <Pareto redes={d.pareto} finalistas={d.finalistas} elegida={d.red.id} />
            <Puntos
              retardo={1.4}
              items={[
                <>Criterio fijado antes: <strong>el mínimo de estaciones que cubre el 80 %</strong> de los viajes, con origen y destino cubiertos.</>,
                <>La red elegida cubre el <strong>{pc(d.red.pct, 2)}</strong> y el 90 % de los extremos tiene su estación a menos de {num(d.red.p90)} m.</>,
                alt && <>Con {num(alt.radio)} m harían falta {num(alt.k)} estaciones ({num(alt.k - d.red.k)} más) para la misma cobertura.</>,
                <>Se contrasta con la semana reservada y con rutas a pie en dos sectores con barreras: en los dos casos la cobertura baja.</>,
              ].filter(Boolean)}
            />
          </div>
        </>
      );
    },
  },
  {
    id: "red",
    titulo: "La red elegida",
    contenido: (d) => (
      <>
        <Cabecera etiqueta="Fase 1 · Red elegida" titulo="Dónde van las estaciones y por dónde se viaja" />
        <div className="cuerpo dos-iguales">
          <MapaRed estaciones={d.estaciones} lineas={d.lineas} modo="lineas" retardo={0.3} />
          <Puntos
            retardo={1.4}
            items={[
              <>Las líneas son los <strong>{num(d.lineas.length)} pares de estaciones</strong> con más viajes atendidos; el tamaño del punto, las salidas de cada estación.</>,
              <>Los diez pares más fuertes solo suman el <strong>{pc(d.asignacion.pct_top10)}</strong> de los viajes: no hay líneas que tratar aparte.</>,
              <>El <strong>{pc(d.asignacion.pct_circulares)}</strong> de los viajes vuelve a la misma estación.</>,
              <>El saldo de la mañana y el de la tarde tienen un Spearman de {num(d.asignacion.spearman, 2)}: parte de lo que entra por la mañana sale por la tarde, y el resto lo corrige el rebalanceo nocturno.</>,
            ]}
          />
        </div>
      </>
    ),
  },
  {
    id: "asignacion",
    titulo: "Qué pasa con cada viaje",
    contenido: (d) => {
      const c = Object.fromEntries(d.asignacion.conciliacion.map((f) => [f.resultado, f]));
      return (
        <>
          <Cabecera
            etiqueta="Fase 1 · Asignación (T31)"
            titulo="Cada solicitud del ajuste tiene un único resultado"
            entradilla="Cada viaje va a la estación más cercana de cada extremo; si falta patinete o hueco, se desvía a otra dentro del radio. Esta tabla es la entrada de la fase de consumo."
          />
          <div className="cuerpo" style={{ alignContent: "center", gap: 56 }}>
            <Conciliacion filas={d.asignacion.conciliacion} />
            <Cifras
              retardo={1.6}
              cifras={[
                { valor: pc((100 * c.atendido.viajes) / (c.atendido.viajes + c.sin_patinete.viajes + c.sin_anclaje.viajes)), nombre: "de los viajes cubiertos se atienden", detalle: "con la capacidad limitada de cada estación" },
                { valor: `${num(d.asignacion.acceso_medio)} m`, nombre: "de acceso medio en el origen", detalle: "en línea recta hasta la estación" },
                { valor: num(d.asignacion.pares), nombre: "pares de estaciones con viajes", detalle: "una red muy repartida" },
              ]}
            />
          </div>
        </>
      );
    },
  },
  {
    id: "inventario",
    titulo: "Stock y anclajes",
    contenido: (d) => (
      <>
        <Cabecera
          etiqueta="Fase 1 · Inventario (T32)"
          titulo="Cada estación, dimensionada para su día malo"
          entradilla={`Los anclajes cubren el P${Math.round(100 * d.inventario.cuantil)} de los días de cada estación y la flota de ${num(d.inventario.flota)} patinetes se reparte en proporción. Se simula el mes con reserva del anclaje de destino, desvíos y ${d.inventario.rebalanceo} recolocaciones por noche.`}
        />
        <div className="cuerpo dos-iguales">
          <MapaRed estaciones={d.estaciones} lineas={d.lineas} modo="anclajes" retardo={0.4} />
          <Cifras
            columnas={1}
            retardo={1}
            cifras={[
              { valor: num(d.inventario.anclajes), nombre: "anclajes", detalle: `de 2 a ${Math.max(...d.estaciones.map((e) => e.anclajes))} por estación (tamaño del punto)` },
              { valor: pc(d.inventario.pct), nombre: "atendidos en el ajuste", detalle: `${pc(d.inventario.sin_desvio)} sin desvíos` },
              { valor: pc(d.inventario.reservada), nombre: "en la semana reservada", detalle: "misma red y flota, un 18 % más de demanda" },
            ]}
          />
        </div>
      </>
    ),
  },
  {
    id: "flota",
    titulo: "Tamaño de la flota",
    contenido: (d) => {
      const res = d.flota.reservada.find((r) => r.flota === d.flota.minima);
      return (
        <>
          <Cabecera etiqueta="Fase 1 · Flota (T34)" titulo={`${num(d.flota.minima)} patinetes bastan; más, empeoran`} />
          <div className="cuerpo dos">
            <CurvaFlota f={d.flota} />
            <Puntos
              retardo={2.6}
              items={[
                <>Con los {num(d.flota.anclajes)} anclajes, <strong>{num(d.flota.minima)} patinetes</strong> son la flota más pequeña que atiende el {d.flota.objetivo} % de los viajes cubiertos.</>,
                <>Por encima del máximo, las estaciones se llenan y no hay dónde dejar el patinete: <strong>flota y anclajes se dimensionan juntos</strong>.</>,
                <>El rebalanceo nocturno vale unos 10 puntos de servicio.</>,
                res && <>En la semana reservada, {num(d.flota.minima)} patinetes atienden el {pc(res.pct)}.</>,
              ].filter(Boolean)}
            />
          </div>
        </>
      );
    },
  },
  {
    id: "operacion",
    titulo: "Operación de la red",
    contenido: (d) => (
      <>
        <Cabecera
          etiqueta="Fase 1 · Cierre de movilidad (T33–T39)"
          titulo="La red aguanta la operación"
          entradilla="Con la misma flota y anclajes se prueban el rebalanceo, la batería, el acceso de las zonas peor servidas y el cierre de estaciones críticas."
        />
        <Tarjetas
          retardo={0.5}
          items={[
            ["Rebalanceo (T33)", <>{d.cierre.limite} traslados por noche suben el servicio del {pc(d.cierre.sin_reb_pct)} al {pc(d.cierre.reb_pct)}. Las dos reglas probadas empatan.</>],
            ["Batería (T35)", <>Con carga en cada anclaje no limita: {num(d.cierre.doble_rechazos)} rechazos con el doble de consumo. Sin cargar en la estación, falla a los {num(d.cierre.sin_recarga_dias, 1)} días y el servicio del mes cae al {pc(d.cierre.sin_recarga_pct)}.</>],
            ["Acceso y cierres (T37–T38)", <>Cambiar 5 estaciones sube {num(d.cierre.equidad_pp, 1)} puntos las zonas peor servidas; cambiar 13 deja en {num(d.cierre.perdida_redundante)} los viajes perdidos por cierres, frente a {num(d.cierre.perdida_elegida)}.</>],
            ["Recarga (T39)", <>La red elegida pide {num(d.cierre.kwh_dia, 1)} kWh al día y {num(d.cierre.pico_kw, 1)} kW de pico en toda la red: demanda pequeña y repartida.</>],
          ]}
        />
      </>
    ),
  },
  {
    id: "siguiente",
    titulo: "Lo que queda",
    contenido: (d) => (
      <>
        <Cabecera etiqueta="Siguientes pasos" titulo="De la movilidad a la energía" />
        <Tarjetas
          retardo={0.5}
          items={[
            ["Flota decidida", <>{num(d.flota.minima)} patinetes (criterio del {d.flota.objetivo} %). La de {num(d.flota.diseno)} queda como alternativa con más margen si crece la demanda.</>],
            ["Consumo (10 %)", <>En reserva, {num(d.consumo.a_kwh_dia, 2)} kWh/día con A y {num(d.consumo.b_kwh_dia, 2)} con B.
              {d.consumo.cambia_estacion && " La estación de mayor energía cambia por el desnivel."} Recarga parte de A ({num(d.consumo.a_wh_km, 1)} Wh/km), contrasta cada estación con B y prueba un ±20 % de demanda (T46).</>],
            ["Estación de recarga (20 %)", "Potencia y energía demandadas en cada estación, paneles con PVWatts y baterías para casar la generación con la recarga."],
            ["Demo 3D", "Un día de operación sobre el mapa de Roma, con las estaciones, los flujos y la maqueta de una estación."],
          ]}
        />
      </>
    ),
  },
  {
    id: "cierre",
    titulo: "Cierre",
    portada: true,
    contenido: (d) => (
      <>
        <div className="fondo-mapa">
          <MapaRed estaciones={d.estaciones} lineas={d.lineas} modo="fondo" retardo={0.2} />
        </div>
        <div className="portada-texto">
          <Aparece>
            <div className="etiqueta">La red propuesta</div>
          </Aparece>
          <Marcador
            retardo={0.3}
            items={[
              [num(d.red.k), `estaciones a ${num(d.red.radio)} m`],
              [num(d.inventario.anclajes), "anclajes"],
              [num(d.inventario.flota), "patinetes"],
              [pc(d.inventario.pct), "viajes cubiertos atendidos"],
            ]}
          />
          <h1 className="preguntas">
            <span className="degradado">
              <Palabras texto="¿Preguntas?" retardo={1.2} />
            </span>
          </h1>
          <Aparece retardo={1.6} className="autores">
            Javier Saguar · Alejandro Cuevas
          </Aparece>
        </div>
      </>
    ),
  },
];
