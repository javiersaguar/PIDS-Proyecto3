// Estado de las tareas leído de docs/TAREAS.md (scripts/tareas.mjs genera tareas.json).
import datos from "./tareas.json";

export type EstadoTarea = "pendiente" | "en curso" | "revisión" | "hecha";
export type Tarea = { id: string; titulo: string; tipo: string; responsable: string; estado: EstadoTarea };
export type Bloque = { nombre: string; rangos: string; responsable: string; tareas: Tarea[] };

const TAREAS: Record<string, Tarea> = Object.fromEntries(
  Object.entries(datos.tareas).map(([id, t]) => [id, { id, ...t, estado: t.estado as EstadoTarea }]),
);

export const BLOQUES: Bloque[] = datos.bloques.map((b) => ({ ...b, tareas: b.tareas.map((id) => TAREAS[id]) }));
export const TODAS: Tarea[] = Object.values(TAREAS);

/** Tareas de un rango como «T40–T46». */
export function tareasDe(rango: string): Tarea[] {
  const [a, b = a] = rango.split(/[–-]/).map((s) => Number(s.replace("T", "")));
  return TODAS.filter((t) => Number(t.id.slice(1)) >= a && Number(t.id.slice(1)) <= b);
}

export function hechas(tareas: Tarea[]) {
  return tareas.filter((t) => t.estado === "hecha").length;
}

/** Cerrada si todas están hechas, pendiente si ninguna ha empezado y en curso en otro caso. */
export function estadoDe(tareas: Tarea[]): "cerrada" | "en curso" | "pendiente" {
  if (tareas.length && tareas.every((t) => t.estado === "hecha")) return "cerrada";
  return tareas.some((t) => t.estado !== "pendiente") ? "en curso" : "pendiente";
}
