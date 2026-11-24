import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { COLOR } from "../../graficas";
import { PERIODOS, type Periodo } from "../../localizacion/validacion";

type Estrategia = "actual" | "uso" | "beneficio";
type FilaT80 = {
  periodo: Periodo; estrategia: Estrategia; anclajes_movidos: number; atendidos: number; sin_anclaje: number;
  sin_patinete: number; pct_atendidos_cubiertos: number; recuperados: number; por_anclaje: number | null;
  perdida_en_las_que_ceden: number;
};
type Traslado = { paso: number; sale: string; entra: string; estrategia: Exclude<Estrategia, "actual">; ganancia_ajuste: number | null };
type FilaT81 = {
  etapa: string; periodo: Periodo; anclajes: number; atendidos: number; sin_anclaje: number; solicitudes: number;
  atendidos_completo: number | null; saturadas: number | null; modulos_nuevos: number | null;
};
type Datos = {
  t80: FilaT80[]; traslados: Traslado[]; t81: FilaT81[]; modulo: number; modulos: number;
  umbral_rechazos: number; umbral_llena_pct: number; recuperados_por_modulo: number;
};

const ESTRATEGIA: Record<Exclude<Estrategia, "actual">, string> = {
  uso: "Hacia las más usadas", beneficio: "Búsqueda del mayor beneficio",
};
const CSV = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/resultados/tablas/movilidad/";
const signo = (x: number) => (x > 0 ? "+" : "") + num(x);

export const TAREA_CAPACIDAD = { id: "t80", tarea: "T80–T81", titulo: "Reparto de anclajes y despliegue por etapas" };

export function Capacidad() {
  const { datos, error } = useDatos<Datos>("fase1/capacidad");
  return <Seccion id="t80" tarea="T80–T81" titulo={TAREA_CAPACIDAD.titulo} responsable="Javier Saguar"
    objetivo="Comprobar si el reparto de anclajes de T32 mejora al trasladar diez anclajes y cuánto servicio cuesta desplegar la red por etapas con el mismo total."
    valor="Confirma la capacidad que pasa a la estación de recarga y da una alternativa para repartir la inversión en el tiempo."
    notebook="movilidad/T80_T81_capacidad.ipynb">
    {datos ? <Contenido d={datos} /> : <Cargando error={error} />}
  </Seccion>;
}

function Contenido({ d }: { d: Datos }) {
  const f = (p: Periodo, e: Estrategia) => d.t80.find((r) => r.periodo === p && r.estrategia === e)!;
  const mejorAj = f("ajuste", "beneficio"), mejorRes = f("reservada", "beneficio"), usoRes = f("reservada", "uso");
  const res = d.t81.filter((r) => r.periodo === "reservada");
  const etapa = (n: string) => res.find((r) => r.etapa === n)!;
  const primera = etapa("primera etapa"), final = etapa("tras las ampliaciones"), completo = etapa("despliegue completo");
  const semanas = d.t81.filter((r) => r.periodo === "ajuste");
  const otras = d.t80.filter((r) => r.estrategia !== "actual");
  return <>
    <Cifras cifras={[
      { valor: signo(mejorRes.recuperados), nombre: "viajes con el mejor traslado en la reserva", detalle: `${signo(mejorAj.recuperados)} en el ajuste, donde se eligió` },
      { valor: num(primera.anclajes), nombre: "anclajes en la primera etapa", detalle: `frente a ${num(completo.anclajes)} del despliegue completo` },
      { valor: num(completo.atendidos - primera.atendidos), nombre: "viajes menos en la reserva con la primera etapa", detalle: `${num(primera.sin_anclaje)} devoluciones sin hueco` },
      { valor: num(completo.atendidos - final.atendidos), nombre: "viajes menos tras tres ampliaciones", detalle: `${num(d.modulos)} módulos de ${d.modulo}, ${num(final.anclajes)} anclajes` },
    ]} />
    <Bloque titulo="1. Traslado de diez anclajes (T80)"
      queMuestra="Viajes atendidos frente a la asignación de T32 al trasladar diez anclajes con la misma flota y el mismo total. Hacia las más usadas: uno a cada una de las diez estaciones con más salidas y llegadas. Mayor beneficio: en cada paso, el traslado que más viajes añade en el ajuste."
      porQue="Si unos pocos anclajes mal colocados limitaran el servicio, moverlos sería la mejora más barata de la red."
      comoLeer="Barras azules: periodo de ajuste, donde se eligen los traslados. Barras naranjas: semana reservada, que solo los comprueba."
      conclusiones={[
        <>La búsqueda del mayor beneficio recupera {num(mejorAj.recuperados)} viajes en el ajuste ({num(mejorAj.por_anclaje ?? 0, 1)} por anclaje), pero solo <strong>{signo(mejorRes.recuperados)}</strong> en la semana reservada: casi toda la ganancia se debe a ajustarse al periodo de elección.</>,
        <>Llevar anclajes a las estaciones más usadas da {signo(usoRes.recuperados)} viajes en la reserva. Las más usadas no son las que rechazan devoluciones.</>,
        <><strong>Se mantiene el reparto de T32</strong>: con diez traslados ya está cerca de su óptimo.</>,
      ]}
      fuente="tablas/movilidad/T80_anclajes.csv y T80_traslados.csv">
      <Grafica descripcion="Viajes atendidos frente a T32 con cada estrategia de traslado" alto={300}
        trazas={(["ajuste", "reservada"] as Periodo[]).map((p, i) => {
          const g = otras.filter((r) => r.periodo === p);
          return { type: "bar", name: PERIODOS[p], x: g.map((r) => ESTRATEGIA[r.estrategia as keyof typeof ESTRATEGIA]),
            y: g.map((r) => r.recuperados), marker: { color: i ? COLOR.serie2 : COLOR.serie1 },
            hovertemplate: "%{x}: %{y:+d} viajes<extra>" + PERIODOS[p] + "</extra>" };
        })}
        capa={{ barmode: "group", yaxis: { title: { text: "Viajes atendidos frente a T32" }, zeroline: true },
          legend: { orientation: "h", y: 1.12 } }} />
    </Bloque>
    <TablaDesplegable titulo="Ver los traslados"
      cabeceras={["Estrategia", "Paso", "Sale de", "Entra en", "Viajes ganados en el ajuste"]} numericas={[1, 4]}
      filas={d.traslados.map((t) => [ESTRATEGIA[t.estrategia], t.paso, t.sale, t.entra, t.ganancia_ajuste == null ? "—" : num(t.ganancia_ajuste)])} />
    <Bloque titulo="2. Despliegue por etapas (T81)"
      queMuestra={`La primera etapa da a cada estación los módulos de ${d.modulo} anclajes justos para su stock inicial más un hueco. Al final de cada semana del ajuste se amplía un módulo en las estaciones saturadas (al menos ${d.umbral_rechazos} devoluciones rechazadas o llena el ${d.umbral_llena_pct} % del tiempo), sin pasar de los ${num(completo.anclajes)} anclajes de T32.`}
      porQue="Instalar por etapas reparte la inversión y deja que la demanda real decida dónde crecer. Hay que saber cuánto servicio se pierde mientras tanto."
      comoLeer="Izquierda: cada semana del ajuste con las capacidades de esa etapa (azul) y con el despliegue completo (gris). Derecha: la semana reservada con las tres configuraciones."
      conclusiones={[
        <>La primera etapa instala un {pc((1 - primera.anclajes / completo.anclajes) * 100, 0)} menos de anclajes y pierde {num(completo.atendidos - primera.atendidos)} viajes en la reserva, casi todos por devoluciones sin hueco.</>,
        <>Tras tres ampliaciones ({num(final.anclajes)} anclajes) la diferencia baja a <strong>{num(completo.atendidos - final.atendidos)} viajes</strong>. Cada módulo recupera {num(d.recuperados_por_modulo, 1)} viajes en la reserva.</>,
        "El despliegue por etapas es viable para repartir la inversión, pero tres semanas de observación no igualan el reparto de T32, que usa las tres semanas a la vez.",
      ]}
      fuente="tablas/movilidad/T81_etapas.csv, T81_ampliaciones.csv y T81_estaciones.csv">
      <div className="capacidad-graficas">
        <Grafica descripcion="Servicio por semana del ajuste con el despliegue por etapas y el completo" alto={300}
          trazas={[
            { type: "bar", name: "Por etapas", x: semanas.map((r) => r.etapa), y: semanas.map((r) => r.atendidos / r.solicitudes * 100),
              marker: { color: COLOR.serie1 }, customdata: semanas.map((r) => r.anclajes),
              hovertemplate: "%{x}: %{y:.1f} % con %{customdata} anclajes<extra></extra>" },
            { type: "bar", name: "Completo", x: semanas.map((r) => r.etapa), y: semanas.map((r) => (r.atendidos_completo ?? 0) / r.solicitudes * 100),
              marker: { color: COLOR.eje }, hovertemplate: "%{x}: %{y:.1f} % con el despliegue completo<extra></extra>" },
          ]}
          capa={{ barmode: "group", yaxis: { title: { text: "Solicitudes atendidas (%)" }, ticksuffix: " %", range: [60, 80] },
            legend: { orientation: "h", y: 1.12 } }} />
        <Grafica descripcion="Servicio en la semana reservada según la etapa del despliegue" alto={300}
          trazas={[{ type: "bar", x: res.map((r) => r.etapa), y: res.map((r) => r.atendidos / r.solicitudes * 100),
            marker: { color: [COLOR.eje, COLOR.serie1, COLOR.texto] }, text: res.map((r) => num(r.anclajes) + " anclajes"),
            textposition: "outside", hovertemplate: "%{x}: %{y:.1f} %<extra></extra>" }]}
          capa={{ yaxis: { title: { text: "Solicitudes atendidas (%)" }, ticksuffix: " %", range: [60, 75] } }} />
      </div>
    </Bloque>
    <TablaDesplegable titulo="Ver las etapas"
      cabeceras={["Etapa", "Periodo", "Anclajes", "Atendidos", "Sin anclaje", "Estaciones saturadas", "Módulos nuevos"]}
      numericas={[2, 3, 4, 5, 6]}
      filas={d.t81.map((r) => [r.etapa, PERIODOS[r.periodo], num(r.anclajes), num(r.atendidos), num(r.sin_anclaje),
        r.saturadas == null ? "—" : num(r.saturadas), r.modulos_nuevos == null ? "—" : num(r.modulos_nuevos)])} />
    <p className="loc-nota">Cada semana del ajuste se simula sola, con el stock inicial de T32 y el rebalanceo de 100 patinetes por noche.
      El módulo de {d.modulo} anclajes es una hipótesis de diseño. Ficheros: <a href={CSV + "T80_anclajes.csv"}>T80 anclajes</a> ·{" "}
      <a href={CSV + "T81_etapas.csv"}>T81 etapas</a> · <a href={CSV + "T81_estaciones.csv"}>T81 estaciones</a>.</p>
  </>;
}
