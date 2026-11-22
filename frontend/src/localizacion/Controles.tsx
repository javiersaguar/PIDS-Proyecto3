import { useMemo, useState } from "react";
import { num } from "../formato";
import { css } from "../mapa/tema";
import {
  avisos, COLORES_LOCALIZACION, GRUPOS, METODOS, presupuestos, type Candidato, type Comparacion,
  type DatosT25, type Marcador, type Metodo, type ModoComparacion,
} from "./modelo";
import "./localizacion.css";

export type FiltrosRed = { radio: number; k: number; modo: ModoComparacion; radiosVisibles: boolean };

export function ControlesRed({ datos, filtros, cambiar }: {
  datos: DatosT25;
  filtros: FiltrosRed;
  cambiar: (filtros: FiltrosRed) => void;
}) {
  return (
    <div className="loc-controles">
      <label>
        Radio geométrico
        <select value={filtros.radio} onChange={(e) => {
          const radio = Number(e.target.value);
          cambiar({ ...filtros, radio, k: datos.referencias[radio] });
        }}>
          {datos.radios.map((r) => <option key={r} value={r}>{r} m</option>)}
        </select>
      </label>
      <label>
        Estaciones por método
        <select value={filtros.k} onChange={(e) => cambiar({ ...filtros, k: Number(e.target.value) })}>
          {presupuestos(datos, filtros.radio).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label>
        Redes visibles
        <select value={filtros.modo} onChange={(e) => cambiar({ ...filtros, modo: e.target.value as ModoComparacion })}>
          <option value="ambos">Comparar ambas</option>
          {METODOS.map((m) => <option key={m} value={m}>{datos.metodos[m]}</option>)}
        </select>
      </label>
      <label className="loc-casilla">
        <input type="checkbox" checked={filtros.radiosVisibles}
          onChange={(e) => cambiar({ ...filtros, radiosVisibles: e.target.checked })} />
        Dibujar radios
      </label>
    </div>
  );
}

export function LeyendaLocalizacion({ puntos }: { puntos: Marcador[] }) {
  const grupos = [...new Set(puntos.map((m) => m.grupo))];
  return (
    <ul className="loc-leyenda" aria-label="Leyenda de emplazamientos">
      {grupos.map((g) => (
        <li key={g}><span style={{ background: css(COLORES_LOCALIZACION[g]) }} />{GRUPOS[g]}</li>
      ))}
    </ul>
  );
}

export function BuscarEmplazamiento({ puntos, elegido, cambiar }: {
  puntos: Marcador[];
  elegido?: Candidato;
  cambiar: (id: string | null) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const normalizar = (texto: string) => texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const opciones = useMemo(
    () => puntos.map(({ candidato }) => candidato).sort((a, b) => b.extremos - a.extremos || a.candidate_id.localeCompare(b.candidate_id)),
    [puntos],
  );
  const q = normalizar(consulta.trim());
  const lista = opciones.filter((c) =>
    c.candidate_id === elegido?.candidate_id || normalizar(c.candidate_id + " " + (c.via_cercana ?? "")).includes(q));
  return (
    <div className="loc-busqueda">
      <label>
        Buscar por H3 o vía
        <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
      </label>
      <label>
        Emplazamiento
        <select value={elegido?.candidate_id ?? ""} onChange={(e) => cambiar(e.target.value || null)}>
          <option value="">{lista.length ? `Elegir de ${num(lista.length)} posiciones` : "Sin coincidencias"}</option>
          {lista.map((c) => <option key={c.candidate_id} value={c.candidate_id}>
            {c.via_cercana ? `${c.via_cercana} · ` : ""}{c.candidate_id}
          </option>)}
        </select>
      </label>
    </div>
  );
}

export function FichaEmplazamiento({ candidato: c, comparacion, metodos, radio, acercar }: {
  candidato: Candidato;
  comparacion?: Comparacion | null;
  metodos?: Record<Metodo, string>;
  radio?: number;
  acercar?: () => void;
}) {
  const marcas = avisos(c);
  const movido = c.posicion === "extremo_en_tierra";
  const coords = `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`;
  const osm = `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=19/${c.lat}/${c.lon}`;
  const metros = (m: number | null) => m === null ? "Sin dato" : `${num(m)} m`;
  const actividad = METODOS.flatMap((m) => {
    const perfil = comparacion?.perfiles[m].get(c.candidate_id);
    return perfil ? [{ m, perfil }] : [];
  });
  return (
    <div className="loc-ficha">
      <h4>{c.via_cercana ?? "Emplazamiento H3"}</h4>
      {c.via_cercana && <p className="loc-nota">Vía de referencia a {metros(c.d_via_cercana_m)}.</p>}
      <dl>
        <div><dt>Coordenadas WGS84</dt><dd className="loc-coordenadas">{coords}</dd></div>
        <div><dt>Celda H3</dt><dd className="loc-coordenadas">{c.candidate_id}</dd></div>
        <div><dt>Extremos observados</dt><dd>{num(c.origenes)} orígenes · {num(c.destinos)} destinos</dd></div>
        <div><dt>Candidato más próximo</dt><dd>{metros(c.d_vecino_m)}</dd></div>
        <div><dt>Vecinos con posible solape</dt><dd>{num(c.vecinos_en_solape)}</dd></div>
        <div><dt>Río / vía restringida</dt><dd>{metros(c.d_rio_m)} / {metros(c.d_via_restringida_m)}</dd></div>
        {movido && <div><dt>Desplazamiento del centro</dt><dd>{metros(c.desplazamiento_m)}</dd></div>}
      </dl>
      {marcas.length > 0 && <p className="loc-aviso">{marcas.join(" · ")}.</p>}
      <p className="loc-nota">Revisión urbana pendiente.</p>
      {actividad.length > 0 && (
        <div className="loc-actividad">
          <h5>Viajes con cobertura a {radio} m</h5>
          {actividad.map(({ m, perfil: [salidas, llegadas] }) => (
            <p key={m}><b>{metodos?.[m]}.</b> {num(salidas)} salidas y {num(llegadas)} llegadas en el ajuste.</p>
          ))}
        </div>
      )}
      <div className="loc-acciones">
        {acercar && <button type="button" onClick={acercar}>Acercar al punto</button>}
        <a href={osm} target="_blank" rel="noopener noreferrer">Abrir en OpenStreetMap ↗</a>
      </div>
    </div>
  );
}
