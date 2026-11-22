import type { Data } from "plotly.js-dist-min";
import { Grafica } from "../../componentes/Grafica";
import { fecha, FRANJAS, num, pc, TIPO_DIA } from "../../formato";
import { FiltrosValidacion, pp } from "../../localizacion/PanelValidacion";
import { enlaceValidacion, PERIODOS, SECTORES, type DatosValidacion, type EstadoValidacion } from "../../localizacion/validacion";
import { umbralCobertura } from "./ModelosRed";

const RECTAS = "#3e6e98";
const RUTAS = "#277d68";
const RESERVA = "#975738";

function pct(x: number | null) {
  return x == null ? "—" : pc(x);
}

export function AccesoPeatonal({ estado: e }: { estado: EstadoValidacion }) {
  if (!e.datos || !e.red || !e.pie) return null;
  const { datos, red, pie, sector, periodo } = e;
  const curva = datos.peatonal_radios.filter((r) =>
    r.network_id === red.network_id && r.periodo === periodo && r.sector === sector).sort((a, b) => a.radio_m - b.radio_m);
  const ultimoUmbral = curva.at(-1);
  const sectores = datos.peatonal.filter((r) => r.network_id === red.network_id && r.periodo === periodo &&
    (sector === "ambos" || sector === r.sector));
  const casos = datos.ejemplos.filter((c) => c.network_id === red.network_id && c.periodo === periodo &&
    (sector === "ambos" || sector === c.sector));
  const grafos = datos.grafos.filter((g) => g.periodo === periodo && (sector === "ambos" || sector === g.sector));
  const sensibilidad: Data[] = [
    { type: "scatter", mode: "lines+markers", name: "Línea recta", line: { color: RECTAS, dash: "dash" },
      x: curva.map((r) => r.radio_m), y: curva.map((r) => r.pct_linea), customdata: curva.map((r) => r.linea_cubiertos),
      hovertemplate: "%{x} m · %{y:.1f} %<br>%{customdata} viajes cubiertos<extra>%{fullData.name}</extra>" },
    { type: "scatter", mode: "lines+markers", name: "Por calles", line: { color: RUTAS },
      x: curva.map((r) => r.radio_m), y: curva.map((r) => r.pct_a_pie), customdata: curva.map((r) => r.a_pie_cubiertos),
      hovertemplate: "%{x} m · %{y:.1f} %<br>%{customdata} viajes cubiertos<extra>%{fullData.name}</extra>" },
  ];
  const perdidas = [
    { nombre: "Conservan ambos", campo: "a_pie_cubiertos", color: RUTAS },
    { nombre: "Pierden el origen", campo: "pierde_origen", color: "#a96b3d" },
    { nombre: "Pierden el destino", campo: "pierde_destino", color: "#c99058" },
    { nombre: "Pierden ambos", campo: "pierde_ambos", color: "#764b59" },
  ] as const;
  return (
    <>
      <FiltrosValidacion estado={e} />
      <div className="val-hallazgo">
        <strong>{pct(pie.pct_linea)} → {pct(pie.pct_a_pie)}</strong>
        <p>Viajes con ambos extremos cubiertos a {red.radio_m} m al pasar de recta a calles ({pp(pie.delta_pp)}).
          Se comparan {num(pie.viajes_comparables)} de {num(pie.viajes_sector)} viajes de {SECTORES[sector]}. {num(pie.viajes_sin_par_rutas)} quedaron sin un par de rutas medibles.</p>
      </div>
      <div className="val-evidencia">
        <div>
          <h3>Sensibilidad al límite de acceso</h3>
          <p className="loc-nota">Mismas estaciones y mismos viajes. La línea vertical marca el radio de diseño.</p>
          <Grafica descripcion="Cobertura en línea recta y a pie con distintos límites de acceso" alto={300} trazas={sensibilidad}
            capa={{ xaxis: { title: { text: "Límite por extremo (m)" }, tickvals: curva.map((r) => r.radio_m) },
              yaxis: { title: { text: "Viajes cubiertos (%)" }, range: [0, 100], ticksuffix: " %" },
              shapes: [{ type: "line", xref: "x", yref: "paper", x0: red.radio_m, x1: red.radio_m, y0: 0, y1: 1,
                line: { color: "#677685", dash: "dot", width: 1.3 } }] }} />
        </div>
        <div>
          <h3>En qué extremo se pierde cobertura</h3>
          <p className="loc-nota">Viajes que cumplían en recta, por resultado al recorrer las calles a {red.radio_m} m.</p>
          <Grafica descripcion="Viajes cubiertos en recta que conservan o pierden acceso por extremo" alto={300}
            trazas={perdidas.map(({ nombre, campo, color }): Data => ({ type: "bar", orientation: "h", name: nombre,
              y: sectores.map((r) => r.sector === "ambos" ? "Ambos sectores" : SECTORES[r.sector].split(" · ")[0]),
              x: sectores.map((r) => r[campo]), marker: { color }, hovertemplate: "%{x} viajes<extra>%{fullData.name}</extra>" }))}
            capa={{ barmode: "stack", margin: { t: 60 }, xaxis: { title: { text: "Viajes con cobertura en recta" } },
              yaxis: { autorange: "reversed" } }} />
        </div>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Sector</th><th>Comparables</th><th>En recta</th><th>A pie</th><th>Solo pierde origen</th><th>Solo pierde destino</th><th>Pierde ambos</th></tr></thead>
          <tbody>{sectores.map((r) => <tr key={r.sector}>
            <th scope="row">{SECTORES[r.sector]}</th><td>{num(r.viajes_comparables)} de {num(r.viajes_sector)}</td>
            <td>{num(r.linea_cubiertos)}</td><td>{num(r.a_pie_cubiertos)}</td>
            <td>{num(r.pierde_origen)}</td><td>{num(r.pierde_destino)}</td><td>{num(r.pierde_ambos)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {pie.p90_linea_m != null && pie.p90_a_pie_m != null && pie.mediana_desvio_m != null &&
        <p className="val-texto">El P90 de acceso pasa de <strong>{num(pie.p90_linea_m, 1)} a {num(pie.p90_a_pie_m, 1)} m</strong>.
          El sobrecoste mediano por extremo es {num(pie.mediana_desvio_m, 1)} m. En {num(pie.cambios_estacion)} de {num(pie.extremos_asignables_ambos)} extremos dentro del radio en ambas métricas cambia la estación más próxima.</p>}
      {ultimoUmbral?.pct_a_pie != null && <p className="val-texto">Con el mayor límite ensayado ({ultimoUmbral.radio_m} m), la misma red cubre a pie el <strong>{pct(ultimoUmbral.pct_a_pie)}</strong> de estos viajes comparables.</p>}
      <div className="loc-cabecera">
        <h3>Recorridos en el mapa de Roma</h3>
        <a href={enlaceValidacion(periodo, sector, red.network_id)}>Abrir la red y el sector en 3D ↗</a>
      </div>
      {casos.length > 0 && <div className="val-evidencia">
        {casos.map((c) => <div key={c.sector} className="val-recuadro">
          <h4>{SECTORES[c.sector]}</h4>
          <p>Tramo de {c.extremo} para la misma estación. <strong>{num(c.d_recta_m, 1)} m</strong> en recta y <strong>{num(c.d_a_pie_m, 1)} m</strong> por calles.</p>
          <a href={enlaceValidacion(periodo, c.sector, c.network_id)}>Ver el recorrido y acercar ↗</a>
        </div>)}
      </div>}
      <details className="tabla">
        <summary>Grafo, muestra y controles de la comparación</summary>
        <p>Entran los viajes con origen y destino dentro del núcleo. Se enlaza cada punto a una vía transitable a un máximo de {datos.enlace_max_m} m y se impide que el conector cruce los ejes de río o ferrocarril. El camino más corto respeta sentidos y restricciones a pie. Se mide origen → estación y estación → destino, incluidos los dos conectores.</p>
        <p>El grafo rebasa el núcleo más allá del mayor umbral medido y del enlace, para permitir rodeos. La cartografía OSM archivada en noviembre de 2026 se aplica a los viajes de febrero de 2021. Los resultados describen Tíber y Termini, con acceso medible en los dos extremos.</p>
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Sector</th><th>Nodos</th><th>Tramos</th><th>Margen del recorte</th><th>Extremos sin enlace</th><th>Estaciones sin enlace</th></tr></thead>
            <tbody>{grafos.map((g) => <tr key={g.sector}>
              <th scope="row">{SECTORES[g.sector]}</th><td>{num(g.nodos)}</td><td>{num(g.tramos)}</td><td>{num(g.margen_min_m)} m</td>
              <td>{num(g.extremos_sin_enlace)}</td><td>{g.estaciones_sin_enlace} de {g.estaciones_sector}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function TransferenciaTemporal({ estado: e }: { estado: EstadoValidacion }) {
  if (!e.datos || !e.red || !e.pie) return null;
  const { datos, red, periodo, sector, pie } = e;
  const redActual = (r: { network_id: string }) => r.network_id === red.network_id;
  const geometria = datos.geometria.filter(redActual);
  const a = geometria.find((g) => g.periodo === "ajuste")!;
  const r = geometria.find((g) => g.periodo === "reservada")!;
  const delta = r.pct_viajes_cubiertos - a.pct_viajes_cubiertos;
  const dias = datos.diaria.filter(redActual).sort((x, y) => x.fecha.localeCompare(y.fecha));
  const diasReserva = dias.filter((d) => d.periodo === "reservada" && d.viajes > 0);
  const alcanzan = diasReserva.filter((d) => d.viajes_cubiertos * 100 >= datos.objetivo_pct * d.viajes).length;
  const peor = [...diasReserva].sort((x, y) => x.viajes_cubiertos / x.viajes - y.viajes_cubiertos / y.viajes)[0];
  const trazas: Data[] = (["ajuste", "reservada"] as const).flatMap((p): Data[] => {
    const serie = dias.filter((d) => d.periodo === p);
    const color = p === "ajuste" ? RECTAS : RESERVA;
    const x = serie.map((d) => d.fecha);
    return [
      { type: "bar", name: PERIODOS[p], x, y: serie.map((d) => d.viajes), yaxis: "y2", showlegend: false,
        marker: { color }, hovertemplate: "%{x|%d/%m} · %{y} viajes<extra>%{fullData.name}</extra>" },
      { type: "scatter", mode: "lines+markers", name: PERIODOS[p], x, line: { color },
        y: serie.map((d) => d.viajes ? 100 * d.viajes_cubiertos / d.viajes : null),
        customdata: serie.map((d) => [d.viajes_cubiertos, d.viajes]), opacity: p === periodo ? 1 : .62,
        hovertemplate: "%{x|%d/%m} · %{y:.1f} %<br>%{customdata[0]} de %{customdata[1]} viajes<extra>%{fullData.name}</extra>" },
    ];
  });
  return (
    <>
      <FiltrosValidacion estado={e} />
      <div className="val-hallazgo">
        <strong>{pc(a.pct_viajes_cubiertos, 2)} → {pc(r.pct_viajes_cubiertos, 2)}</strong>
        <p>Cobertura geométrica de viajes completos en Roma ({pp(delta)}). La red de {red.k} estaciones y radio de {red.radio_m} m se eligió con las salidas del 1 al 21 de febrero. La evaluación reservada usa las del 22 al 28.</p>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Periodo</th><th>Viajes elegibles</th><th>Viajes/día</th><th>Ambos extremos</th><th>P90 de acceso</th><th>Margen sobre objetivo</th></tr></thead>
          <tbody>{geometria.map((g) => <tr key={g.periodo} className={g.periodo === periodo ? "val-fila" : undefined}>
            <th scope="row">{PERIODOS[g.periodo]}</th><td>{num(g.viajes)}</td><td>{num(g.viajes_dia, 1)}</td>
            <td>{num(g.viajes_cubiertos)} · {pc(g.pct_viajes_cubiertos, 2)}</td><td>{num(g.d_p90_m, 1)} m</td>
            <td>{pp(g.pct_viajes_cubiertos - datos.objetivo_pct, 2)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <h3>Cobertura y viajes por día</h3>
      <p className="loc-nota">La línea punteada marca el {datos.objetivo_pct} %. Cada punto usa los viajes elegibles del día y cada barra muestra su volumen.</p>
      <Grafica descripcion="Cobertura y número de viajes por día en ajuste y semana reservada" alto={385} trazas={trazas}
        capa={{ xaxis: { type: "date", tickformat: "%d/%m", nticks: 8, anchor: "y2" },
          yaxis: { domain: [.36, 1], ticksuffix: " %", title: { text: "Cobertura OD" } },
          yaxis2: { domain: [0, .26], rangemode: "tozero", title: { text: "Viajes" } },
          shapes: [umbralCobertura(datos.objetivo_pct)] }} />
      {peor && <p className="val-texto">En la reserva, <strong>{alcanzan} de {diasReserva.length} días con viajes</strong> alcanzan el {datos.objetivo_pct} %. La menor cobertura se da el {fecha(peor.fecha)} con {pc(100 * peor.viajes_cubiertos / peor.viajes, 2)} en {num(peor.viajes)} viajes.</p>}
      <DesgloseTemporal datos={datos} id={red.network_id} />
      <div className="val-recuadro">
        <h3>Comprobación a pie en {SECTORES[sector]}</h3>
        <p>{PERIODOS[periodo]} · {num(pie.viajes_comparables)} viajes comparables. La cobertura pasa de <strong>{pct(pie.pct_linea)}</strong> en recta a <strong>{pct(pie.pct_a_pie)}</strong> a pie ({pp(pie.delta_pp)}).</p>
        <div className="loc-acciones">
          <a href={["#/fase1/t29", periodo, sector, red.network_id].join("/")}>Ver sensibilidad y pérdidas por extremo</a>
          <a href={enlaceValidacion(periodo, sector, red.network_id)}>Abrir esta validación en 3D ↗</a>
        </div>
      </div>
      <details className="tabla">
        <summary>Cómo se preserva la prueba reservada</summary>
        <p>La selección de T28 fija estaciones, radios y regla de cobertura con el ajuste. Se verifica la huella de los archivos de estaciones y finalistas antes de usar los resultados de T29. El recuento reutiliza los mismos criterios de elegibilidad y de acceso. Una semana mide transferencia al final de febrero de 2021. La cobertura mide proximidad y acceso, antes de simular disponibilidad de patinetes o plazas.</p>
        <p>SHA-256 del archivo de estaciones congeladas</p>
        <code className="val-huella">{datos.huella_redes}</code>
      </details>
    </>
  );
}

function DesgloseTemporal({ datos, id }: { datos: DatosValidacion; id: string }) {
  const efectos = datos.efectos.filter((g) => g.network_id === id);
  const franjas = datos.franjas.filter((g) => g.network_id === id);
  const totalMezcla = efectos.reduce((suma, g) => suma + g.mezcla_pp, 0);
  const totalDentro = efectos.reduce((suma, g) => suma + g.dentro_pp, 0);
  return (
    <>
      <h3>De dónde sale el cambio semanal</h3>
      <div className="val-evidencia">
        <div className="val-recuadro">
          <h4>Distribución horaria y tipo de día</h4>
          <p><strong>{pp(totalMezcla, 2)}</strong> por el cambio del peso de las franjas laborables y de fin de semana.</p>
        </div>
        <div className="val-recuadro">
          <h4>Cobertura dentro de las franjas</h4>
          <p><strong>{pp(totalDentro, 2)}</strong> por la diferencia de cobertura al comparar cada franja con su equivalente.</p>
        </div>
      </div>
      <p className="loc-nota">Descomposición descriptiva. Cada cambio de peso se multiplica por la cobertura media de ambos periodos y cada cambio de cobertura por el peso medio. Los aportes de la última columna suman el cambio global. Las tasas usan los viajes de cada fila.</p>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Tipo de día</th><th>Franja de salida</th><th>Ajuste · cubiertos / total</th><th>Reservada · cubiertos / total</th><th>Cambio en la franja</th><th>Aporte al cambio global</th></tr></thead>
          <tbody>{efectos.map((g) => {
            const filas = franjas.filter((f) => f.tipo_dia === g.tipo_dia && f.franja === g.franja);
            const a = filas.find((f) => f.periodo === "ajuste")!;
            const r = filas.find((f) => f.periodo === "reservada")!;
            const tasaA = a.viajes ? 100 * a.viajes_cubiertos / a.viajes : null;
            const tasaR = r.viajes ? 100 * r.viajes_cubiertos / r.viajes : null;
            return <tr key={g.tipo_dia + g.franja}>
              <th scope="row">{TIPO_DIA[g.tipo_dia]}</th><td>{FRANJAS[g.franja]}</td>
              <td>{num(a.viajes_cubiertos)} / {num(a.viajes)} · {pct(tasaA)}</td>
              <td>{num(r.viajes_cubiertos)} / {num(r.viajes)} · {pct(tasaR)}</td>
              <td>{pp(tasaA == null || tasaR == null ? null : tasaR - tasaA)}</td>
              <td>{pp(g.mezcla_pp + g.dentro_pp, 2)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <details className="tabla">
        <summary>Cobertura y volumen de cada día</summary>
        <div className="tabla-scroll">
          <table>
            <thead><tr><th>Salida</th><th>Periodo</th><th>Viajes elegibles</th><th>Viajes cubiertos</th><th>Cobertura</th></tr></thead>
            <tbody>{datos.diaria.filter((d) => d.network_id === id).map((d) => (
              <tr key={d.fecha}><th scope="row">{fecha(d.fecha)}</th><td>{PERIODOS[d.periodo]}</td>
                <td>{num(d.viajes)}</td><td>{num(d.viajes_cubiertos)}</td>
                <td>{pct(d.viajes ? 100 * d.viajes_cubiertos / d.viajes : null)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}
