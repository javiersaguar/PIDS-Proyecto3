import { useCallback, useEffect, useMemo, useState } from "react";
import { useDatos } from "../datos";
import { fecha, num, pc } from "../formato";
import { BuscarEmplazamiento, ControlesRed, FichaEmplazamiento, LeyendaLocalizacion, type FiltrosRed } from "./Controles";
import {
  AVISOS, comparar, marcadoresT24, marcadoresT25, METODOS, presupuestos,
  type Candidato, type DatosT24, type DatosT25, type VistaCandidatos,
} from "./modelo";

type Pestana = "candidatos" | "redes";
type Seleccion = {
  pestana: Pestana;
  filtro: VistaCandidatos;
  red: FiltrosRed;
  id: string | null;
};

function leerSeleccion(ruta: string): Seleccion {
  const [pestana, radio, k, modo, id] = ruta.split("/");
  const esCatalogo = pestana === "candidatos";
  return {
    pestana: esCatalogo ? "candidatos" : "redes",
    filtro: "todos",
    red: { radio: Number(radio), k: Number(k), modo: modo === "kmedoids" || modo === "kmeans" ? modo : "ambos", radiosVisibles: false },
    id: (esCatalogo ? radio : id) || null,
  };
}

export function useLocalizacionDemo(activa: boolean, ruta: string) {
  const t24 = useDatos<DatosT24>("fase1/t24_candidatos", activa);
  const t25 = useDatos<DatosT25>("fase1/t25_lineas_base", activa);
  const [seleccion, cambiar] = useState(() => leerSeleccion(ruta));
  useEffect(() => {
    cambiar(leerSeleccion(ruta));
  }, [ruta]);

  const datos = t25.datos;
  const catalogo = t24.datos;
  const { pestana, filtro, id } = seleccion;
  const radio = datos?.radios.includes(seleccion.red.radio)
    ? seleccion.red.radio
    : datos?.radios.includes(300) ? 300 : datos?.radios[0] ?? 300;
  const k = datos && presupuestos(datos, radio).includes(seleccion.red.k) ? seleccion.red.k : datos?.referencias[radio] ?? 0;
  const filtros = { ...seleccion.red, radio, k };
  const comparacion = useMemo(
    () => activa && datos && catalogo && pestana === "redes" ? comparar(datos, catalogo, radio, k) : null,
    [activa, datos, catalogo, pestana, radio, k],
  );
  const marcadores = useMemo(() => {
    if (!activa || !catalogo) return [];
    return pestana === "candidatos" ? marcadoresT24(catalogo, filtro) : marcadoresT25(comparacion, filtros.modo);
  }, [activa, catalogo, pestana, filtro, comparacion, filtros.modo]);
  const elegido = marcadores.find(({ candidato }) => candidato.candidate_id === id)?.candidato;
  const elegir = useCallback((id: string | null) => cambiar((s) => ({ ...s, id })), []);

  return {
    catalogo, datos, error: t24.error ?? t25.error, pestana, filtro, filtros, comparacion, marcadores, elegido,
    cambiarPestana: (p: Pestana) => cambiar((s) => ({ ...s, pestana: p, id: null })),
    cambiarFiltro: (f: VistaCandidatos) => cambiar((s) => ({ ...s, filtro: f, id: null })),
    cambiarRed: (red: FiltrosRed) => cambiar((s) => ({ ...s, red })),
    elegir,
  };
}

export function PanelLocalizacion({ estado: e, enfocar }: {
  estado: ReturnType<typeof useLocalizacionDemo>;
  enfocar: (c: Candidato) => void;
}) {
  if (e.error) return <p role="alert">{e.error}</p>;
  if (!e.catalogo || !e.datos) return <p role="status">Cargando catálogo y redes…</p>;

  const { resumen, periodo_ajuste: [inicio, fin] } = e.catalogo;
  const comparando = e.pestana === "redes";
  return (
    <>
      <div className="mapa-segmentado" role="group" aria-label="Vista de localización">
        <button type="button" aria-pressed={!comparando} onClick={() => e.cambiarPestana("candidatos")}>Candidatos · T24</button>
        <button type="button" aria-pressed={comparando} onClick={() => e.cambiarPestana("redes")}>Redes · T25</button>
      </div>
      <p className="loc-nota">Viajes observados del {fecha(inicio)} al {fecha(fin)}. Los puntos son emplazamientos de cálculo.</p>
      {comparando ? <ControlesRed datos={e.datos} filtros={e.filtros} cambiar={e.cambiarRed} /> : (
        <div className="loc-controles">
          <label>
            Candidatos visibles
            <select value={e.filtro} onChange={(x) => e.cambiarFiltro(x.target.value as VistaCandidatos)}>
              {AVISOS.map(({ valor, texto }) => <option key={valor} value={valor}>{texto}</option>)}
            </select>
          </label>
        </div>
      )}
      {comparando && e.comparacion && (
        <div className="mapa-cifras">
          {METODOS.map((m) => <div key={m}>
            <div className="valor">{pc(e.comparacion!.resultados[m].pct_viajes_cubiertos)}</div>
            <div className="nombre">{e.datos!.metodos[m]} · ambos extremos</div>
          </div>)}
          <div><div className="valor">{num(e.comparacion.compartidos)}</div><div className="nombre">Emplazamientos compartidos</div></div>
          <div><div className="valor">{num(e.filtros.k - e.comparacion.compartidos)}</div><div className="nombre">Exclusivos de cada método</div></div>
        </div>
      )}
      {!comparando && <p className="loc-nota">{num(e.marcadores.length)} posiciones visibles de {num(resumen.candidatos)}. {num(resumen.desplazados)} centros se desplazaron a tierra.</p>}
      <LeyendaLocalizacion puntos={e.marcadores} />
      <BuscarEmplazamiento puntos={e.marcadores} elegido={e.elegido} cambiar={e.elegir} />
      {e.elegido && <FichaEmplazamiento candidato={e.elegido} comparacion={e.comparacion} metodos={e.datos.metodos}
        radio={e.filtros.radio} acercar={() => enfocar(e.elegido!)} />}
      <p className="loc-nota">
        <a href={comparando ? "#/fase1/t25" : "#/fase1/t24"}>Ver gráficas y método</a>
        {" · "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
      </p>
    </>
  );
}
