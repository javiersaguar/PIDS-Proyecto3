import { useEffect, useState } from "react";

// Cada gráfica lee el JSON que exporta su notebook (frontend/public/datos/<fase>/<nombre>.json).
const cache = new Map<string, Promise<unknown>>();

function pedir(ruta: string): Promise<unknown> {
  let promesa = cache.get(ruta);
  if (!promesa) {
    promesa = fetch(`${import.meta.env.BASE_URL}datos/${ruta}.json`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo leer ${ruta}.json (${r.status})`);
      return r.json();
    });
    cache.set(ruta, promesa);
  }
  return promesa;
}

export type Estado<T> = { datos: T; error: null } | { datos: null; error: string | null };

export function useDatos<T>(ruta: string): Estado<T> {
  const [estado, setEstado] = useState<Estado<T>>({ datos: null, error: null });
  useEffect(() => {
    let vigente = true;
    pedir(ruta)
      .then((d) => vigente && setEstado({ datos: d as T, error: null }))
      .catch((e: Error) => vigente && setEstado({ datos: null, error: e.message }));
    return () => {
      vigente = false;
    };
  }, [ruta]);
  return estado;
}
