// Piezas de animación comunes. En modo impresión (PDF) todo se pinta ya en su estado final.
import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { animate, motion } from "motion/react";
import { num } from "./tipos";

export const Estatico = createContext(false);
export const useEstatico = () => useContext(Estatico);

// Curva de salida rápida y frenada larga: el movimiento llega con fuerza y se posa suave.
export const SUAVE = [0.22, 1, 0.36, 1] as const;

// Props de animación: en impresión, sin estado inicial (se pinta el final).
export function useEntrada(retardo = 0, duracion = 0.8) {
  const estatico = useEstatico();
  return (desde: Record<string, number | string>, hasta: Record<string, number | string>) =>
    estatico
      ? { initial: false as const, animate: hasta }
      : { initial: desde, animate: hasta, transition: { duration: duracion, delay: retardo, ease: SUAVE } };
}

// Bloque que sube y se enfoca al entrar.
export function Aparece({ children, retardo = 0, className, style }: { children: ReactNode; retardo?: number; className?: string; style?: CSSProperties }) {
  const anim = useEntrada(retardo, 0.8);
  return (
    <motion.div className={className} style={style} {...anim({ opacity: 0, y: 36, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)" })}>
      {children}
    </motion.div>
  );
}

// Texto que entra palabra a palabra desde debajo de una máscara.
export function Palabras({ texto, retardo = 0, paso = 0.055 }: { texto: string; retardo?: number; paso?: number }) {
  const estatico = useEstatico();
  return (
    <span aria-label={texto}>
      {texto.split(" ").map((p, i, todas) => (
        <span key={i} aria-hidden>
          <span className="mascara">
            <motion.span
              style={{ display: "inline-block", transformOrigin: "0 100%" }}
              initial={estatico ? false : { y: "115%", rotate: 7 }}
              animate={{ y: "0%", rotate: 0 }}
              transition={{ delay: retardo + paso * i, duration: 0.9, ease: SUAVE }}
            >
              {p}
            </motion.span>
          </span>
          {i < todas.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

// Cifra que cuenta desde cero hasta su valor. Recibe el texto ya formateado («12 750», «95,1 %»,
// «−0,40») y conserva sus decimales, prefijo y sufijo.
const CIFRA = /^(.*?)(−?\d(?:[\d ]*\d)?)(,\d+)?(.*)$/s;

export function Contador({ texto, retardo = 0, duracion = 1.6, svg = false }: { texto: string; retardo?: number; duracion?: number; svg?: boolean }) {
  const estatico = useEstatico();
  const ref = useRef<HTMLSpanElement & SVGTSpanElement>(null);
  const m = texto.match(CIFRA);
  useEffect(() => {
    if (estatico || !m || !ref.current) return;
    const [, antes, entero, decimales = "", despues] = m;
    const n = decimales.length ? decimales.length - 1 : 0;
    const valor = Number(entero.replace(/ /g, "").replace("−", "-") + (n ? "." + decimales.slice(1) : ""));
    const el = ref.current;
    const pintar = (v: number) => (el.textContent = antes + num(v, n) + despues);
    pintar(0);
    const control = animate(0, valor, { duration: duracion, delay: retardo, ease: SUAVE, onUpdate: pintar });
    return () => control.stop();
    // El texto define la animación; si cambia, se vuelve a contar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, estatico]);
  return svg ? <tspan ref={ref}>{texto}</tspan> : <span ref={ref}>{texto}</span>;
}

// Ondas que se expanden alrededor de un punto para señalarlo.
export function Onda({ cx, cy, r, color, retardo = 0 }: { cx: number; cy: number; r: number; color: string; retardo?: number }) {
  if (useEstatico()) return null;
  return (
    <>
      {[0, 1].map((k) => (
        <motion.circle
          key={k}
          cx={cx}
          cy={cy}
          fill="none"
          stroke={color}
          strokeWidth={3}
          initial={{ r, opacity: 0 }}
          animate={{ r: [r, r * 3.6], opacity: [0.8, 0] }}
          transition={{ duration: 2.2, delay: retardo + 1.1 * k, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

// Número pseudoaleatorio estable a partir de un índice (para que cada recarga dibuje lo mismo).
export const azar = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
