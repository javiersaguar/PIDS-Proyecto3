import { WebMercatorViewport, type MapViewState } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { num } from "../formato";
import { cargarBaseRoma, type Base, type Punto } from "../mapa/datos";
import { TEMAS } from "../mapa/tema";
import { capasLocalizacion, fondoLocalizacion, rotulosLocalizacion } from "./capas";
import { BuscarEmplazamiento, FichaEmplazamiento, LeyendaLocalizacion } from "./Controles";
import type { Candidato, Comparacion, Marcador, Metodo } from "./modelo";

type Props = {
  catalogo: Candidato[];
  marcadores: Marcador[];
  seleccionado: Candidato | undefined;
  cambiar: (id: string | null) => void;
  radio?: number;
  dibujarRadios?: boolean;
  comparacion?: Comparacion;
  metodos?: Record<Metodo, string>;
};

const ROMA: MapViewState = {
  longitude: 12.484, latitude: 41.878, zoom: 11.1, minZoom: 9, maxZoom: 19, pitch: 0, bearing: 0,
};
const TEMA = TEMAS.claro;

export default function MapaRoma({ catalogo, marcadores, seleccionado, cambiar, radio, dibujarRadios, comparacion, metodos }: Props) {
  const idMapa = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const [vista, setVista] = useState(ROMA);
  const [base, setBase] = useState<Base | null>(null);
  const [error, setError] = useState(false);
  const extent = useMemo((): [Punto, Punto] => [
    [Math.min(...catalogo.map((c) => c.lon)), Math.min(...catalogo.map((c) => c.lat))],
    [Math.max(...catalogo.map((c) => c.lon)), Math.max(...catalogo.map((c) => c.lat))],
  ], [catalogo]);

  useEffect(() => {
    let activo = true;
    cargarBaseRoma().then((b) => activo && setBase(b)).catch(() => activo && setError(true));
    return () => { activo = false; };
  }, []);

  const encuadrar = (limites: [Punto, Punto]) => {
    const espacio = contenedor.current?.getBoundingClientRect();
    if (!espacio || espacio.width < 100) return;
    const { latitude, longitude, zoom } = new WebMercatorViewport({
      ...ROMA, width: espacio.width, height: espacio.height,
    }).fitBounds(limites, { padding: 42, maxZoom: 16.6 });
    setVista({ ...ROMA, latitude, longitude, zoom });
  };

  const contorno = seleccionado?.contorno;
  useEffect(() => {
    if (contorno?.length) {
      encuadrar([
        [Math.min(...contorno.map(([lon]) => lon)), Math.min(...contorno.map(([, lat]) => lat))],
        [Math.max(...contorno.map(([lon]) => lon)), Math.max(...contorno.map(([, lat]) => lat))],
      ]);
    } else {
      encuadrar(extent);
    }
    // El encuadre cambia al elegir un punto o al volver a la vista general.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, contorno]);

  const detalleVial = vista.zoom >= 14;
  const capasRoma = useMemo(() => base ? fondoLocalizacion(base, TEMA, detalleVial) : [], [base, detalleVial]);
  const barrios = vista.zoom >= 12.9;
  const rotulos = useMemo(() => base ? rotulosLocalizacion(base, TEMA, barrios) : null, [base, barrios]);
  const datos = useMemo(
    () => capasLocalizacion(marcadores, seleccionado, dibujarRadios ? radio ?? 0 : 0, TEMA),
    [marcadores, seleccionado, dibujarRadios, radio],
  );
  const zoom = (delta: number) => setVista((v) => ({ ...v, zoom: Math.max(9, Math.min(19, v.zoom + delta)) }));

  return (
    <div className="loc-explorador">
      <div>
        <div ref={contenedor} className="loc-mapa" role="region" aria-label="Mapa ampliable de Roma">
          {base && !error ? (
            <DeckGL
              id={idMapa}
              viewState={vista}
              controller={{ scrollZoom: false, dragRotate: false, touchRotate: false, keyboard: false }}
              onViewStateChange={({ viewState }) => setVista(viewState as MapViewState)}
              layers={[...capasRoma, ...datos, rotulos]}
              onClick={(i) => {
                const punto = i.object as Marcador | undefined;
                if (punto && i.layer?.id === "localizacion-puntos") cambiar(punto.candidato.candidate_id);
              }}
              getTooltip={(i) => i.layer?.id === "localizacion-puntos" && i.object ? {
                text: `${i.object.candidato.via_cercana ?? i.object.candidato.candidate_id}\n${num(i.object.candidato.extremos)} extremos en el ajuste`,
              } : null}
              onError={() => setError(true)}
              getCursor={({ isDragging, isHovering }) => isDragging ? "grabbing" : isHovering ? "pointer" : "grab"}
            />
          ) : (
            <p className="loc-estado">{error ? "Usa el selector para consultar las ubicaciones y abrirlas en OpenStreetMap." : "Cargando cartografía de Roma…"}</p>
          )}
          {base && !error && (
            <div className="loc-zoom">
              <button type="button" aria-label="Ampliar mapa" onClick={() => zoom(1)}>+</button>
              <button type="button" aria-label="Reducir mapa" onClick={() => zoom(-1)}>−</button>
              <button type="button" onClick={() => encuadrar(extent)}>Vista general</button>
            </div>
          )}
          <a className="loc-atribucion" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            © OpenStreetMap contributors
          </a>
        </div>
        <LeyendaLocalizacion puntos={marcadores} />
      </div>
      <aside className="loc-inspector" aria-label="Inspección de emplazamientos">
        <BuscarEmplazamiento puntos={marcadores} elegido={seleccionado} cambiar={cambiar} />
        {seleccionado ? (
          <FichaEmplazamiento candidato={seleccionado} comparacion={comparacion} metodos={metodos} radio={radio}
            acercar={base && !error ? () => setVista({ ...ROMA, longitude: seleccionado.lon, latitude: seleccionado.lat, zoom: 17.2 }) : undefined} />
        ) : (
          <p className="loc-nota">Elige un punto del mapa o búscalo para ver sus coordenadas y datos.</p>
        )}
      </aside>
    </div>
  );
}
