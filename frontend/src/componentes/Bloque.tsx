import type { ReactNode } from "react";

type Props = {
  titulo: string;
  queMuestra: ReactNode;
  porQue: ReactNode;
  comoLeer?: ReactNode;
  conclusiones: ReactNode[];
  fuente?: string;
  children: ReactNode;
};

// Gráfica a la izquierda, explicación a la derecha y conclusiones debajo.
export function Bloque({ titulo, queMuestra, porQue, comoLeer, conclusiones, fuente, children }: Props) {
  return (
    <article className="bloque">
      <h3>{titulo}</h3>
      <div className="bloque-cuerpo">
        <div className="bloque-grafica">{children}</div>
        <aside className="bloque-explicacion">
          <h4>Qué muestra</h4>
          <p>{queMuestra}</p>
          <h4>Por qué importa</h4>
          <p>{porQue}</p>
          {comoLeer && (
            <>
              <h4>Cómo leerla</h4>
              <p>{comoLeer}</p>
            </>
          )}
        </aside>
      </div>
      <div className="bloque-conclusiones">
        <h4>Conclusiones</h4>
        <ul>
          {conclusiones.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
      {fuente && <p className="fuente">Fuente: {fuente}</p>}
    </article>
  );
}
