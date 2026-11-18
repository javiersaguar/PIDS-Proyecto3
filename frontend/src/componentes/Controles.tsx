import type { ReactNode } from "react";

type Opcion<T extends string> = { valor: T; texto: string };

export function Segmentado<T extends string>({ etiqueta, opciones, valor, cambiar }: {
  etiqueta: string;
  opciones: Opcion<T>[];
  valor: T;
  cambiar: (v: T) => void;
}) {
  return (
    <div className="segmentado" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => cambiar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function TablaDesplegable({ titulo, cabeceras, filas, numericas = [] }: {
  titulo: string;
  cabeceras: string[];
  filas: ReactNode[][];
  numericas?: number[];
}) {
  return (
    <details className="tabla">
      <summary>{titulo}</summary>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              {cabeceras.map((c, i) => (
                <th key={`${i}-${c}`} className={numericas.includes(i) ? "num" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className={numericas.includes(j) ? "num" : undefined}>
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Cargando({ error }: { error: string | null }) {
  return <p className="aviso">{error ?? "Cargando datos…"}</p>;
}
