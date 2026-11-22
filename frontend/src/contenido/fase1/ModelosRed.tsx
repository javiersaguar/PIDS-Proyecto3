import { useState } from "react";
import type { Data, Shape } from "plotly.js-dist-min";
import { Grafica } from "../../componentes/Grafica";
import { num, pc } from "../../formato";
import { pp } from "../../localizacion/PanelValidacion";
import { enlaceValidacion, ROLES, type DatosValidacion } from "../../localizacion/validacion";

const COLORES: Record<string, string> = {
  lscp: "#975738", mclp: "#238471", pmediana: "#82629e",
  voraz: "#677685", kmedoids: "#306eae", kmeans: "#a26c37",
};

export const umbralCobertura = (y: number): Partial<Shape> => ({
  type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: y, y1: y,
  line: { color: "#677685", dash: "dot", width: 1.3 },
});

export function CoberturaParcial({ datos }: { datos: DatosValidacion }) {
  const filas = datos.lscp_audit;
  const principal = filas.find((r) => r.network_id === datos.seleccionada);
  const y = filas.map((r) => r.radio_m + " m");
  const trazas: Data[] = [
    { type: "scatter", mode: "markers", name: "Solución factible e intervalo",
      x: filas.map((r) => r.k_factible), y, marker: { color: COLORES.lscp, size: 10 },
      error_x: { type: "data", symmetric: false, array: filas.map(() => 0),
        arrayminus: filas.map((r) => r.brecha_estaciones), thickness: 3, width: 6, color: COLORES.lscp },
      customdata: filas.map((r) => r.cota_inferior),
      hovertemplate: "%{y}<br>Mínimo posible entre %{customdata} y %{x} estaciones<extra></extra>" },
    { type: "scatter", mode: "markers", name: "Voraz por extremos",
      x: filas.map((r) => r.k_voraz), y, marker: { color: COLORES.voraz, size: 11, symbol: "diamond-open" },
      hovertemplate: "%{y}<br>%{x} estaciones con la heurística voraz<extra></extra>" },
  ];
  return (
    <>
      {principal && <div className="val-hallazgo">
        <strong>{principal.cota_inferior}–{principal.k_factible} estaciones</strong>
        <p>Intervalo certificado para cubrir el {datos.objetivo_pct} % a {principal.radio_m} m.
          La solución de {principal.k_factible} cubre {num(principal.viajes_cubiertos)} viajes completos y supera el objetivo por {principal.viajes_margen} viajes.</p>
      </div>}
      <p className="val-texto">El modelo minimiza el número de candidatos abiertos. Cada viaje cuenta si tiene al menos una estación alcanzable en el origen y otra en el destino, que puede ser la misma. Los viajes con los mismos conjuntos de acceso se agrupan y conservan su multiplicidad.</p>
      <h3>Cuántas estaciones exige cada radio</h3>
      <Grafica descripcion="Cotas certificadas y soluciones factibles de T26 por radio" trazas={trazas} alto={275}
        capa={{ xaxis: { title: { text: "Estaciones" } }, yaxis: { type: "category", autorange: "reversed" } }} />
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Radio</th><th>Voraz</th><th>Cota anterior</th><th>Cota auditada</th><th>Factible</th><th>Viajes cubiertos</th><th>Margen sobre objetivo</th><th>Estaciones por resolver</th><th>Procedencia</th></tr></thead>
          <tbody>{filas.map((r) => <tr key={r.network_id} className={r.network_id === datos.seleccionada ? "val-fila" : undefined}>
            <th scope="row">{r.radio_m} m{r.radio_m === 400 && " · sensibilidad"}</th><td>{r.k_voraz}</td>
            <td>{r.cota_previa}</td><td>{r.cota_inferior}</td><td>{r.k_factible}</td>
            <td>{num(r.viajes_cubiertos)} de {num(datos.periodos.ajuste.viajes)}</td>
            <td>+{num(r.viajes_margen)}</td><td>{r.brecha_estaciones || "0 · óptimo"}</td><td>{r.origen_solucion === "MILP" ? "MILP" : "Heurística OD"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <details className="tabla">
        <summary>Cómo se certifica el intervalo</summary>
        <p>El objetivo exige cubrir {num(filas[0].objetivo_viajes)} viajes completos. Se comprueba cada solución candidata recalculando el acceso de los viajes. La cobertura voraz aporta una referencia factible.</p>
        <p>Al permitir aperturas fraccionarias se obtiene una cota inferior. La formulación comparte una variable por conjunto de candidatos accesibles. Se verifica el dual con aritmética entera y se redondea hacia arriba. Se conserva también la mejor cota de la resolución original.</p>
        {principal?.cota_lp_verificada != null && <p>A {principal.radio_m} m, la cota verificada antes de redondear es {num(principal.cota_lp_verificada, 3)}.
          El intervalo mide cuántas estaciones se podrían llegar a ahorrar y se refiere al catálogo y la demanda del ajuste.</p>}
      </details>
    </>
  );
}

export function PresupuestoFijo({ datos }: { datos: DatosValidacion }) {
  const principal = datos.redes.find((r) => r.network_id === datos.seleccionada)!;
  const [radio, cambiarRadio] = useState(principal.radio_m);
  const [presupuesto, cambiarPresupuesto] = useState(principal.k);
  const presupuestos = datos.barrido.filter((r) => r.radio_m === radio && r.metodo === "mclp").map((r) => r.k).sort((a, b) => a - b);
  const k = presupuestos.includes(presupuesto) ? presupuesto : presupuestos.reduce((a, b) => Math.abs(a - presupuesto) <= Math.abs(b - presupuesto) ? a : b);
  const filas = datos.barrido.filter((r) => r.radio_m === radio && r.k === k)
    .sort((a, b) => b.viajes_cubiertos - a.viajes_cubiertos || a.d_p90_m - b.d_p90_m);
  const mclp = filas.find((r) => r.metodo === "mclp")!;
  const voraz = filas.find((r) => r.metodo === "voraz")!;
  const mediana = filas.find((r) => r.metodo === "pmediana")!;
  const cota = datos.mclp_audit.find((r) => r.network_id === mclp.network_id)!;
  const solver = datos.solver.find((r) => r.network_id === mediana.network_id);
  const x = filas.map((r) => datos.metodos[r.metodo].replace(" (MCLP)", "").replace(" (LSCP)", ""));
  const series = [
    { nombre: "Ambos extremos", color: "#238471", valores: filas.map((r) => r.viajes_cubiertos) },
    { nombre: "Solo un extremo", color: "#ca8550", valores: filas.map((r) => r.viajes_un_extremo) },
    { nombre: "Ningún extremo", color: "#a7b5c2", valores: filas.map((r) => r.viajes_sin_cobertura) },
  ];
  return (
    <>
      <div className="loc-controles">
        <label>Radio de acceso<select value={radio} onChange={(e) => cambiarRadio(Number(e.target.value))}>
          {datos.lscp_audit.map(({ radio_m: r }) => <option key={r} value={r}>{r} m{r === 400 ? " · sensibilidad" : ""}</option>)}</select></label>
        <label>Presupuesto de estaciones<select value={k} onChange={(e) => cambiarPresupuesto(Number(e.target.value))}>
          {presupuestos.map((n) => <option key={n} value={n}>{n} estaciones</option>)}</select></label>
      </div>
      <p className="val-texto"><strong>MCLP</strong> maximiza viajes cubiertos en ambos extremos con {k} estaciones.
        <strong> P-mediana</strong> minimiza la distancia media de los extremos agrupados por H3, ponderada por su frecuencia.
        Todas las redes que se muestran para este presupuesto se miden después sobre los mismos viajes de ajuste.</p>
      <div className="val-hallazgo">
        <strong>{num(mclp.viajes_cubiertos - voraz.viajes_cubiertos)} viajes</strong>
        <p>Diferencia de viajes completos entre MCLP y la heurística voraz ({pp(mclp.pct_viajes_cubiertos - voraz.pct_viajes_cubiertos)}), a {radio} m y con {k} estaciones.</p>
      </div>
      <h3>Cómo se reparte la cobertura del mismo presupuesto</h3>
      <Grafica descripcion="Viajes con dos, uno o cero extremos cubiertos por método" alto={330}
        trazas={series.map(({ nombre, color, valores }): Data => ({ type: "bar", name: nombre, y: x, x: valores,
          orientation: "h", marker: { color }, hovertemplate: "%{x} viajes<extra>%{fullData.name}</extra>" }))}
        capa={{ barmode: "stack", xaxis: { title: { text: "Viajes de ajuste" } }, yaxis: { autorange: "reversed" } }} />
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Método</th><th>Ambos</th><th>Solo uno</th><th>Ninguno</th><th>Distancia media</th><th>P90</th><th>P90 origen</th><th>P90 destino</th></tr></thead>
          <tbody>{filas.map((r) => <tr key={r.network_id}>
            <th scope="row">{datos.metodos[r.metodo]}</th><td>{num(r.viajes_cubiertos)} · {pc(r.pct_viajes_cubiertos, 2)}</td>
            <td>{num(r.viajes_un_extremo)}</td><td>{num(r.viajes_sin_cobertura)}</td><td>{num(r.d_media_m, 1)} m</td>
            <td>{num(r.d_p90_m, 1)} m</td><td>{num(r.d_origen_p90_m, 1)} m</td><td>{num(r.d_destino_p90_m, 1)} m</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="val-evidencia">
        <div className="val-recuadro">
          <h4>Cota de MCLP</h4>
          <p>Se cubren {num(cota.viajes_cubiertos)} viajes. La cota superior auditada es {num(cota.cota_superior)}.
            {cota.brecha_viajes ? " Quedan hasta " + num(cota.brecha_viajes) + " viajes de mejora posible." : " El óptimo queda certificado."}</p>
          {cota.cota_previa > cota.cota_superior && <p>La cota inicial era {num(cota.cota_previa)} viajes.</p>}
        </div>
        <div className="val-recuadro">
          <h4>Cota de p-mediana</h4>
          {solver?.cota_obj != null && solver.obj_factible != null && <p>Objetivo factible de {num(solver.obj_factible, 3)} m y cota inferior de {num(solver.cota_obj, 3)} m sobre celdas ponderadas.
            Brecha del solver de {pc(solver.brecha_pct ?? 0, 5)}.</p>}
          <p>La cota relaja asignaciones lejanas. El coste factible usa la distancia completa y las distancias de la tabla se calculan en las coordenadas originales. P90 es la distancia que no supera el 90 % de los extremos.</p>
        </div>
      </div>
    </>
  );
}

export function ElegirRed({ datos }: { datos: DatosValidacion }) {
  const [radio, cambiarRadio] = useState(0);
  const [eje, cambiarEje] = useState<"k" | "d_p90_m">("k");
  const [objetivo, cambiarObjetivo] = useState(datos.objetivo_pct);
  const esPrincipal = (r: { radio_m: number }) => datos.radios_principales.includes(r.radio_m);
  const frente = (r: DatosValidacion["barrido"][number]) => radio ? r.pareto_radio : r.pareto_principal;
  const filas = datos.barrido.filter((r) => radio ? r.radio_m === radio : esPrincipal(r));
  const cumple = datos.barrido.filter((r) => esPrincipal(r) && r.viajes_cubiertos * 1000 >= Math.round(objetivo * 10) * r.viajes);
  const escenario = cumple.sort((a, b) => a.k - b.k || a.d_p90_m - b.d_p90_m ||
    b.viajes_cubiertos - a.viajes_cubiertos || a.radio_m - b.radio_m || a.network_id.localeCompare(b.network_id))[0];
  const trazas: Data[] = Object.keys(COLORES).flatMap((metodo) => {
    const t = filas.filter((r) => r.metodo === metodo);
    if (!t.length) return [];
    return [{
      type: "scatter", mode: "markers", name: datos.metodos[metodo],
      x: t.map((r) => r[eje]), y: t.map((r) => r.pct_viajes_cubiertos),
      hovertext: t.map((r) => r.k + " estaciones · radio " + r.radio_m + " m<br>P90 " + num(r.d_p90_m, 1) +
        " m · " + num(r.viajes_cubiertos) + " viajes" + (frente(r) ? "<br>En el frente" : "")),
      marker: { color: COLORES[metodo], size: t.map((r) => r.network_id === datos.seleccionada ? 15 : frente(r) ? 9 : 6),
        symbol: t.map((r) => r.network_id === datos.seleccionada ? "star" : "circle"),
        opacity: t.map((r) => frente(r) ? 1 : .35) },
      hovertemplate: "%{hovertext}<br>Cobertura %{y:.2f} %<extra>%{fullData.name}</extra>",
    } as Data];
  });
  return (
    <>
      <p className="val-texto">El frente conserva alternativas sin otra red que las iguale o mejore en estaciones, cobertura y P90, con mejora estricta en al menos un criterio. La elección principal comprueba el {datos.objetivo_pct} % en los radios de 200, 250 y 300 m. Entre las redes que cumplen, ordena por menos estaciones, menor P90, más viajes cubiertos y menor radio.</p>
      <div className="loc-controles">
        <label>Radios del gráfico<select value={radio} onChange={(e) => cambiarRadio(Number(e.target.value))}>
          <option value={0}>Principales · 200–300 m</option>
          {datos.lscp_audit.map(({ radio_m: r }) => <option key={r} value={r}>{r} m{r === 400 ? " · sensibilidad" : ""}</option>)}</select></label>
        <label>Eje horizontal<select value={eje} onChange={(e) => cambiarEje(e.target.value as typeof eje)}>
          <option value="k">Número de estaciones</option><option value="d_p90_m">P90 de acceso</option></select></label>
        <label className="val-rango">Objetivo de cobertura en el ajuste
          <span><input type="range" min={75} max={90} step={0.1} value={objetivo}
            onChange={(e) => cambiarObjetivo(Number(e.target.value))} /> <output>{pc(objetivo)}</output></span>
        </label>
      </div>
      <div className="val-hallazgo">
        <strong>{escenario ? escenario.k + " estaciones · " + escenario.radio_m + " m" : "Sin escenario observado"}</strong>
        <p>{escenario ? datos.metodos[escenario.metodo] + " alcanza " + pc(escenario.pct_viajes_cubiertos, 2) + " con P90 de " +
          num(escenario.d_p90_m, 1) + " m. Es la primera alternativa del ajuste según la regla para " + pc(objetivo) + "." :
          "Las alternativas ensayadas a 200–300 m quedan por debajo de " + pc(objetivo) + "."}</p>
      </div>
      <h3>Presupuesto, cobertura y distancia</h3>
      <p className="loc-nota">Los puntos grandes pertenecen al frente para los radios visibles. La estrella marca la red congelada al {datos.objetivo_pct} %. La línea indica el objetivo del escenario.</p>
      <Grafica descripcion="Frente de Pareto de redes candidatas en el ajuste" alto={375} trazas={trazas}
        capa={{ xaxis: { title: { text: eje === "k" ? "Estaciones" : "P90 de todos los extremos (m)" } },
          yaxis: { title: { text: "Viajes completos cubiertos (%)" }, ticksuffix: " %" }, shapes: [umbralCobertura(objetivo)] }} />
      <h3>Redes congeladas para comprobar el acceso</h3>
      <div className="tabla-scroll">
        <table>
          <thead><tr><th>Decisión</th><th>Método</th><th>Estaciones</th><th>Radio</th><th>Cobertura de ajuste</th><th>Margen sobre objetivo</th><th>P90</th><th>Mapa</th></tr></thead>
          <tbody>{datos.redes.map((r) => {
            const m = datos.barrido.find((x) => x.network_id === r.network_id)!;
            return <tr key={r.network_id} className={r.rol === "recomendada" ? "val-fila" : undefined}>
              <th scope="row">{ROLES[r.rol]}</th><td>{datos.metodos[r.metodo]}</td><td>{r.k}</td><td>{r.radio_m} m</td>
              <td>{num(m.viajes_cubiertos)} · {pc(m.pct_viajes_cubiertos, 2)}</td>
              <td>{pp(m.pct_viajes_cubiertos - datos.objetivo_pct, 2)}</td><td>{num(m.d_p90_m, 1)} m</td>
              <td><a href={enlaceValidacion("ajuste", "ambos", r.network_id)}>Ver en Roma</a></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="loc-nota">El objetivo explorado cambia solo la lectura de los ensayos. T29 y T30 usan las ubicaciones de esta tabla, seleccionadas antes de medir la semana reservada.</p>
    </>
  );
}
