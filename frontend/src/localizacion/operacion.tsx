import { ArcLayer, SolidPolygonLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import { useDatos } from "../datos";
import { num, pc } from "../formato";
import type { Punto } from "../mapa/datos";
import type { EstadoValidacion } from "./validacion";

type Celda = { h3: string; periodo: string; contorno: Punto[]; viajes: number; cubiertos: number; atendidos: number };
type Flujo = { periodo: string; estacion_origen: string; estacion_destino: string; viajes: number };
type Datos = { network_id: string; celdas: Celda[]; flujos: Flujo[] };
export type VistaOperacion = "ninguna" | "cobertura" | "servicio" | "flujos";

export function useOperacion(estado: EstadoValidacion, activa: boolean, vista: VistaOperacion) {
  const { datos, error } = useDatos<Datos>("fase1/t36_operacion", activa);
  const disponible = datos != null && estado.red?.network_id === datos.network_id;
  if (!activa || !disponible || !datos || vista === "ninguna") {
    return { disponible, error, capas: [], flujosMostrados: 0 };
  }
  if (vista === "flujos") {
    const lugares = new Map(estado.marcadores.map(({ candidato: c }) => [c.candidate_id, [c.lon, c.lat] as Punto]));
    const id = estado.elegido?.candidate_id;
    const flujos = datos.flujos.filter((f) => f.periodo === estado.periodo && f.estacion_origen !== f.estacion_destino &&
      lugares.has(f.estacion_origen) && lugares.has(f.estacion_destino) &&
      (!id || id === f.estacion_origen || id === f.estacion_destino))
      .sort((a, b) => b.viajes - a.viajes).slice(0, id ? 8 : 25);
    return { disponible, error, flujosMostrados: flujos.length, capas: [new ArcLayer<Flujo>({
      id: "operacion-flujos", data: flujos, pickable: true, widthUnits: "pixels",
      getSourcePosition: (f) => lugares.get(f.estacion_origen)!,
      getTargetPosition: (f) => lugares.get(f.estacion_destino)!,
      getSourceColor: [76, 163, 224, 190], getTargetColor: [104, 224, 172, 220],
      getWidth: (f) => Math.min(6, 1 + Math.sqrt(f.viajes) / 2),
    })] };
  }
  return { disponible, error, flujosMostrados: 0, capas: [new SolidPolygonLayer<Celda>({
    id: "operacion-celdas", data: datos.celdas.filter((c) => c.periodo === estado.periodo), pickable: true,
    getPolygon: (c) => c.contorno,
    getFillColor: (c) => {
      const proporcion = (vista === "servicio" ? c.atendidos : c.cubiertos) / c.viajes;
      return [Math.round(218 - 160 * proporcion), Math.round(109 + 63 * proporcion), 106, 145];
    },
    updateTriggers: { getFillColor: vista },
  })] };
}

export function tooltipOperacion(info: PickingInfo) {
  if (!info.object) return;
  if (info.layer?.id === "operacion-celdas") {
    const c = info.object as Celda;
    return { text: "Celda H3 " + c.h3 + "\n" + num(c.viajes) + " salidas observadas\n" +
      pc(100 * c.cubiertos / c.viajes) + " cubiertas · " + pc(100 * c.atendidos / c.viajes) + " atendidas" };
  }
  if (info.layer?.id === "operacion-flujos") {
    const f = info.object as Flujo;
    return { text: f.estacion_origen + " → " + f.estacion_destino + "\n" + num(f.viajes) + " viajes atendidos" };
  }
}

export function ControlOperacion({ datos, vista, cambiar }: {
  datos: ReturnType<typeof useOperacion>; vista: VistaOperacion; cambiar: (v: VistaOperacion) => void;
}) {
  if (datos.error) return <p className="loc-nota" role="status">{datos.error}</p>;
  if (!datos.disponible) return null;
  return <>
    <div className="loc-controles">
      <label>Capa de operación
        <select value={vista} onChange={(e) => cambiar(e.target.value as VistaOperacion)}>
          <option value="ninguna">Estaciones y sectores</option>
          <option value="cobertura">Cobertura OD por celda de origen</option>
          <option value="servicio">Servicio simulado por celda de origen</option>
          <option value="flujos">Flujos atendidos entre estaciones</option>
        </select>
      </label>
    </div>
    {vista === "flujos" && <p className="loc-nota">{datos.flujosMostrados} flujos principales entre estaciones distintas.
      Selecciona una estación para ver sus entradas y salidas.</p>}
    {(vista === "cobertura" || vista === "servicio") && <p className="loc-nota">Color de rojo (0 %) a verde (100 %).
      Cada celda usa las salidas observadas en ella como denominador.</p>}
    <p className="loc-nota"><a href="#/fase1/t36">Método y datos de las capas</a></p>
  </>;
}
