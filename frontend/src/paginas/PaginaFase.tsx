import type { ReactNode } from "react";
import { Fase0 } from "../contenido/fase0/Fase0";
import { Fase1 } from "../contenido/fase1/Fase1";
import type { Fase } from "../fases";

const CONTENIDO: Record<string, () => ReactNode> = {
  fase0: () => <Fase0 />,
  fase1: () => <Fase1 />,
};

export function PaginaFase({ fase }: { fase: Fase }) {
  const contenido = CONTENIDO[fase.id];
  return (
    <>
      <div className="migas">
        <a href="#/">Proyecto 3</a> / {fase.pestana}
      </div>
      <div className="encabezado">
        <div>
          <h1>{fase.titulo}</h1>
          <div className="detalles">
            <span className={`chapa${fase.estado === "en curso" ? " activa" : ""}`}>{fase.estado}</span>
            <span className="chapa">{fase.fechas}</span>
            {fase.peso && <span className="chapa">{fase.peso} de la nota</span>}
            <span className="chapa">{fase.tareas}</span>
          </div>
        </div>
        <div>
          <p>{fase.descripcion}</p>
        </div>
      </div>
      {contenido ? (
        contenido()
      ) : (
        <section className="seccion">
          <div className="aviso">
            <strong>En preparación.</strong> Las gráficas de esta fase aparecerán aquí cuando sus notebooks estén
            terminados. Está previsto mostrar:
            <ul>
              {fase.previsto.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
