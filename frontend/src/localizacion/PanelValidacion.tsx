import { fecha, num, pc } from "../formato";
import type { Candidato } from "./modelo";
import { BuscarEmplazamiento, FichaEmplazamiento } from "./Controles";
import type { Punto } from "../mapa/datos";
import {
  contornoSector, PERIODOS, ROLES, SECTORES, type EstadoValidacion, type Periodo, type Sector,
} from "./validacion";

export function pp(x: number | null) {
  return x === null ? "—" : (x > 0 ? "+" : "") + num(x, 1) + " pp";
}

const porcentaje = (x: number | null) => x === null ? "—" : pc(x);
const metros = (x: number | null) => x === null ? "—" : num(x) + " m";

export function FiltrosValidacion({ estado: e }: { estado: EstadoValidacion }) {
  if (!e.datos || !e.red) return null;
  return (
    <div className="loc-controles">
      <label>
        Red congelada
        <select value={e.red.network_id} onChange={(x) => e.cambiarRed(x.target.value)}>
          {e.datos.redes.map((r) => <option key={r.network_id} value={r.network_id}>
            {ROLES[r.rol]} · {r.k} est. · {r.radio_m} m
          </option>)}
        </select>
      </label>
      <label>
        Periodo evaluado
        <select value={e.periodo} onChange={(x) => e.cambiarPeriodo(x.target.value as Periodo)}>
          {Object.entries(PERIODOS).map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
        </select>
      </label>
      <label>
        Sector peatonal
        <select value={e.sector} onChange={(x) => e.cambiarSector(x.target.value as Sector)}>
          {Object.entries(SECTORES).map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
        </select>
      </label>
    </div>
  );
}

export function IndicadoresValidacion({ estado: e }: { estado: EstadoValidacion }) {
  if (!e.datos || !e.red || !e.geo || !e.pie) return null;
  const p = e.datos.periodos[e.periodo];
  const { geo, pie } = e;
  return (
    <div className="val-indicadores">
      <div className="val-contexto">
        <span>{ROLES[e.red.rol]} · {e.datos.metodos[e.red.metodo]}</span>
        <p>{e.red.k} estaciones · {e.red.radio_m} m · {fecha(p.inicio)}–{fecha(p.fin)} de 2021</p>
      </div>
      <div className="val-geo">
        <div>
          <strong>{pc(geo.pct_viajes_cubiertos)}</strong>
          <span>Roma · ambos extremos en línea recta</span>
        </div>
        <p>{num(geo.viajes_cubiertos)} de {num(geo.viajes)} viajes · {num(geo.viajes_dia, 1)} viajes/día · P90 {metros(geo.d_p90_m)}</p>
      </div>
      <div className="val-peatonal">
        <div className="val-zona">{SECTORES[e.sector]} · {num(pie.viajes_comparables)} viajes comparables</div>
        <dl className="val-cifras">
          <div><dt>Línea recta</dt><dd>{porcentaje(pie.pct_linea)}</dd></div>
          <div><dt>A pie</dt><dd>{porcentaje(pie.pct_a_pie)}</dd></div>
          <div><dt>Cambio</dt><dd>{pp(pie.delta_pp)}</dd></div>
        </dl>
        <p>{num(pie.linea_cubiertos)} → {num(pie.a_pie_cubiertos)} viajes con cobertura en los dos extremos.</p>
        <p>P90 de {metros(pie.p90_linea_m)} en recta y {metros(pie.p90_a_pie_m)} a pie.</p>
        <p>{num(pie.cambios_estacion)} de {num(pie.extremos_asignables_ambos)} extremos cubiertos con ambos métodos cambian de estación.</p>
        <p>{num(pie.viajes_sin_par_rutas)} de {num(pie.viajes_sector)} viajes quedaron fuera de la comparación por falta de un par de rutas medibles.</p>
      </div>
    </div>
  );
}

export function PanelValidacion({ estado: e, enfocar, enfocarArea }: {
  estado: EstadoValidacion;
  enfocar: (c: Candidato) => void;
  enfocarArea: (puntos: Punto[]) => void;
}) {
  if (e.error) return <p role="alert">{e.error}</p>;
  if (!e.datos || !e.red || !e.geo || !e.pie) return <p role="status">Cargando la validación…</p>;
  const foco = e.caso ? [...e.caso.camino, ...e.caso.recta] : e.visibles.flatMap(contornoSector);
  return (
    <>
      <FiltrosValidacion estado={e} />
      <IndicadoresValidacion estado={e} />
      <div className="loc-acciones">
        <button type="button" onClick={() => enfocarArea(foco)}>{e.caso ? "Acercar al recorrido" : "Centrar sectores"}</button>
      </div>
      <ul className="loc-leyenda" aria-label="Leyenda de validación">
        <li><span style={{ background: "#42a7c1" }} />Estaciones de la red</li>
        <li><span style={{ background: "#e79929" }} />Sectores medidos</li>
        {e.caso && <>
          <li><span style={{ background: "#acb0bb" }} />Línea recta</li>
          <li><span style={{ background: "#3bd69b" }} />Camino peatonal</li>
        </>}
      </ul>
      {e.caso && <p className="loc-nota">Tramo de {e.caso.extremo} hasta la misma estación. {metros(e.caso.d_recta_m)} en recta y {metros(e.caso.d_a_pie_m)} por la red peatonal.</p>}
      <p className="loc-nota">El mapa delimita los sectores de la prueba. Los recorridos usan la cartografía archivada de OpenStreetMap.</p>
      <BuscarEmplazamiento puntos={e.marcadores} elegido={e.elegido} cambiar={e.elegir} />
      {e.elegido && <FichaEmplazamiento candidato={e.elegido} acercar={() => enfocar(e.elegido!)} />}
      <p className="loc-nota"><a href="#/fase1/t30">Ver gráficos, cotas y método</a></p>
    </>
  );
}
