import type { ReactNode } from "react";

type Props = {
  id: string;
  tarea: string;
  responsable: string;
  titulo: string;
  objetivo: ReactNode;
  valor: ReactNode;
  notebook?: string;
  children: ReactNode;
};

const REPO = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/";

// Una sección por tarea: título a la izquierda, objetivo y valor a la derecha, y sus bloques debajo.
export function Seccion({ id, tarea, responsable, titulo, objetivo, valor, notebook, children }: Props) {
  return (
    <section id={id} className="seccion">
      <header>
        <div>
          <div className="etiqueta">
            {tarea} · {responsable}
          </div>
          <h2>{titulo}</h2>
          {notebook && (
            <p className="fuente">
              Notebook: <a href={REPO + notebook}>{notebook}</a>
            </p>
          )}
        </div>
        <div>
          <p>
            <strong>Objetivo.</strong> {objetivo}
          </p>
          <p>
            <strong>Valor para el proyecto.</strong> {valor}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}
