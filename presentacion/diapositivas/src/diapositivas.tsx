// Contenido de cada diapositiva. Todas las cifras salen de datos.json (resultados de los notebooks).
import type { ReactNode } from "react";
import { Aparece, Conciliacion, CurvaFlota, Embudo, MapaRed, Pareto, PerfilHorario } from "./graficos";
import type { Datos } from "./tipos";
import { num, pc } from "./tipos";

export type Diapositiva = { id: string; titulo: string; contenido: (d: Datos) => ReactNode; portada?: boolean };

function Cabecera({ etiqueta, titulo, entradilla }: { etiqueta: string; titulo: ReactNode; entradilla?: ReactNode }) {
  return (
    <header>
      <Aparece>
        <div className="etiqueta">{etiqueta}</div>
        <h2>{titulo}</h2>
        {entradilla && <p className="entradilla">{entradilla}</p>}
      </Aparece>
    </header>
  );
}

function Cifras({ cifras, retardo = 0.2, columnas }: { cifras: { valor: string; nombre: string; detalle?: string }[]; retardo?: number; columnas?: number }) {
  return (
    <div className={`cifras${columnas === 1 ? " compactas" : ""}`} style={{ "--n": columnas ?? cifras.length } as React.CSSProperties}>
      {cifras.map((c, i) => (
        <Aparece key={c.nombre} retardo={retardo + 0.12 * i} className="cifra">
          <div className="valor">{c.valor}</div>
          <div className="nombre">{c.nombre}</div>
          {c.detalle && <div className="detalle">{c.detalle}</div>}
        </Aparece>
      ))}
    </div>
  );
}

function Puntos({ items, retardo = 0.4 }: { items: ReactNode[]; retardo?: number }) {
  return (
    <ul className="puntos">
      {items.map((t, i) => (
        <Aparece key={i} retardo={retardo + 0.15 * i}>
          <li>{t}</li>
        </Aparece>
      ))}
    </ul>
  );
}

export const DIAPOSITIVAS: Diapositiva[] = [
  {
    id: "portada",
    titulo: "Portada",
    portada: true,
    contenido: () => (
      <>
        <Aparece>
          <div className="etiqueta">PIDS · Proyecto 3 · Grupo 05</div>
          <h1>Estaciones de recarga para patinetes compartidos en Roma</h1>
          <p className="entradilla">Matrices origen-destino, red de estaciones y tamaño de la flota a partir de los viajes de Helbiz en febrero de 2021</p>
        </Aparece>
        <Aparece retardo={0.3} className="autores">
          Javier Saguar · Alejandro Cuevas
        </Aparece>
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
          <Aparece retardo={1.2} className="tarjeta">
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
        <div className="cuerpo tarjetas" style={{ alignContent: "center" }}>
          {[
            ["K-medoids y K-means", "Líneas base: agrupan los extremos de los viajes para cada número de estaciones."],
            ["Cobertura de conjuntos (LSCP)", "El mínimo de estaciones que cubre un porcentaje fijado de los viajes. MILP con HiGHS."],
            ["p-mediana", "Con un número fijo de estaciones, la menor distancia total de acceso."],
            ["Cobertura máxima (MCLP)", "Con un número fijo de estaciones, el máximo de viajes con los dos extremos cubiertos."],
          ].map(([t, p], i) => (
            <Aparece key={t} retardo={0.2 + 0.12 * i} className="tarjeta">
              <h3>{t}</h3>
              <p>{p}</p>
            </Aparece>
          ))}
        </div>
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
          <MapaRed estaciones={d.estaciones} lineas={d.lineas} conLineas />
          <Puntos
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
            <Aparece retardo={0.1}>
              <Conciliacion filas={d.asignacion.conciliacion} />
            </Aparece>
            <Cifras
              retardo={0.8}
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
          <MapaRed estaciones={d.estaciones} lineas={d.lineas} conLineas={false} />
          <Cifras
            columnas={1}
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
    id: "siguiente",
    titulo: "Lo que queda",
    contenido: (d) => (
      <>
        <Cabecera etiqueta="Siguientes pasos" titulo="De la movilidad a la energía" />
        <div className="cuerpo tarjetas" style={{ alignContent: "center" }}>
          <Aparece retardo={0.2} className="tarjeta">
            <h3>Flota decidida</h3>
            <p>
              {num(d.flota.minima)} patinetes (criterio del {d.flota.objetivo} %). La de {num(d.flota.diseno)} queda como alternativa con más margen si crece la demanda.
            </p>
          </Aparece>
          <Aparece retardo={0.32} className="tarjeta">
            <h3>Consumo (10 %)</h3>
            <p>Energía de cada viaje con 13,5 Wh/km y con el modelo físico, sumada por patinete y por estación a partir de la asignación.</p>
          </Aparece>
          <Aparece retardo={0.44} className="tarjeta">
            <h3>Estación de recarga (20 %)</h3>
            <p>Potencia y energía demandadas en cada estación, paneles con PVWatts y baterías para casar la generación con la recarga.</p>
          </Aparece>
          <Aparece retardo={0.56} className="tarjeta">
            <h3>Demo 3D</h3>
            <p>Un día de operación sobre el mapa de Roma, con las estaciones, los flujos y la maqueta de una estación.</p>
          </Aparece>
        </div>
      </>
    ),
  },
];
