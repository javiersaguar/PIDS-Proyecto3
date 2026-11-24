import type { ReactNode } from "react";
import { Fase0 } from "../contenido/fase0/Fase0";
import { Fase1 } from "../contenido/fase1/Fase1";
import { Fase2 } from "../contenido/fase2/Fase2";
import type { Fase } from "../fases";
import { estadoDe, hechas, tareasDe } from "../tareas";

const CONTENIDO: Record<string, () => ReactNode> = {
  fase0: () => <Fase0 />,
  fase1: () => <Fase1 />,
  fase2: () => <Fase2 />,
};

export function PaginaFase({ fase }: { fase: Fase }) {
  const contenido = CONTENIDO[fase.id];
  const tareas = tareasDe(fase.tareas);
  const estado = estadoDe(tareas);
  return (
    <>
      <div className="migas">
        <a href="#/">Proyecto 3</a> / {fase.pestana}
      </div>
      <div className="encabezado">
        <div>
          <h1>{fase.titulo}</h1>
          <div className="detalles">
            <span className={`chapa${estado === "en curso" ? " activa" : ""}`}>{estado}</span>
            <span className="chapa">{fase.fechas}</span>
            {fase.peso && <span className="chapa">{fase.peso} de la nota</span>}
            <a className="chapa" href="#/inicio/seguimiento">
              {fase.tareas} · {hechas(tareas)} de {tareas.length} hechas
            </a>
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
