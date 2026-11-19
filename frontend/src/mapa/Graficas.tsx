// Gráficas pequeñas del panel en SVG: curva de cobertura del barrido y perfiles por hora
// de una estación. Un solo eje Y por gráfica, marcas finas y lectura al pasar el ratón.
import { useState, type PointerEvent } from "react";
import { num, pc } from "../formato";
import type { BarridoRadio } from "./datos";

const ANCHO = 300;
const MARGEN = { izq: 30, der: 10, arr: 10, aba: 22 };

function useCursor() {
  const [x, setX] = useState<number | null>(null);
  const mover = (e: PointerEvent<SVGSVGElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    setX(((e.clientX - caja.left) / caja.width) * ANCHO);
  };
  return { x, mover, salir: () => setX(null) };
}

export function CurvaCobertura({
  barrido,
  k,
  alCambiar,
}: {
  barrido: BarridoRadio;
  k: number;
  alCambiar: (k: number) => void;
}) {
  const alto = 112;
  const n = barrido.pct_viajes.length;
  const sx = (i: number) => MARGEN.izq + ((i - 1) / (n - 1)) * (ANCHO - MARGEN.izq - MARGEN.der);
  const sy = (v: number) => MARGEN.arr + (1 - v / 100) * (alto - MARGEN.arr - MARGEN.aba);
  const camino = barrido.pct_viajes.map((v, i) => `${i ? "L" : "M"}${sx(i + 1).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  const { x, mover, salir } = useCursor();
  const kCursor = x === null ? null : Math.round(1 + ((x - MARGEN.izq) / (ANCHO - MARGEN.izq - MARGEN.der)) * (n - 1));
  const kVisto = kCursor !== null && kCursor >= 1 && kCursor <= n ? kCursor : null;
  const kRef = barrido.k_referencia;
  return (
    <figure className="grafica-mini">
      <figcaption>Viajes con origen y destino cubiertos según el número de estaciones</figcaption>
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        role="img"
        aria-label={`Con ${k} estaciones se cubre el ${pc(barrido.pct_viajes[k - 1])} de los viajes`}
        onPointerMove={mover}
        onPointerLeave={salir}
        onClick={() => kVisto && alCambiar(kVisto)}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line className="rejilla" x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={sy(v)} y2={sy(v)} />
            <text className="eje" x={MARGEN.izq - 5} y={sy(v) + 3} textAnchor="end">
              {v} %
            </text>
          </g>
        ))}
        {[1, 100, 200, 300, 400].filter((v) => v <= n).map((v) => (
          <text key={v} className="eje" x={sx(v)} y={alto - 6} textAnchor="middle">
            {v}
          </text>
        ))}
        <line className="referencia" x1={sx(kRef)} x2={sx(kRef)} y1={sy(100)} y2={sy(0)} />
        <text className="eje" x={sx(kRef) + 4} y={sy(100) + 8}>
          80 % · {kRef}
        </text>
        <path className="serie-1 trazo" d={camino} />
        <circle className="serie-1 punto" cx={sx(k)} cy={sy(barrido.pct_viajes[k - 1])} r={4.5} />
        {kVisto && (
          <g className="cursor">
            <line x1={sx(kVisto)} x2={sx(kVisto)} y1={sy(100)} y2={sy(0)} />
            <text x={Math.min(sx(kVisto) + 6, ANCHO - 96)} y={sy(barrido.pct_viajes[kVisto - 1]) + 14}>
              {kVisto} → {pc(barrido.pct_viajes[kVisto - 1])}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

type Serie = { nombre: string; clase: string; valores: number[] };

// Perfil de 24 horas: líneas (salidas y llegadas) o barras (energía).
export function PerfilHorario({
  titulo,
  series,
  unidad,
  barras = false,
  horaActual,
  decimales = 1,
}: {
  titulo: string;
  series: Serie[];
  unidad: string;
  barras?: boolean;
  horaActual?: number;
  decimales?: number;
}) {
  const alto = 112;
  const tope = Math.max(1e-9, ...series.flatMap((s) => s.valores));
  const paso = (ANCHO - MARGEN.izq - MARGEN.der) / 24;
  const sx = (h: number) => MARGEN.izq + (h + 0.5) * paso;
  const sy = (v: number) => MARGEN.arr + (1 - v / tope) * (alto - MARGEN.arr - MARGEN.aba);
  const { x, mover, salir } = useCursor();
  const hCursor = x === null ? null : Math.floor((x - MARGEN.izq) / paso);
  const hVista = hCursor !== null && hCursor >= 0 && hCursor < 24 ? hCursor : null;
  return (
    <figure className="grafica-mini">
      <figcaption>{titulo}</figcaption>
      {series.length > 1 && (
        <div className="leyenda-mini">
          {series.map((s) => (
            <span key={s.nombre}>
              <i className={s.clase} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label={titulo} onPointerMove={mover} onPointerLeave={salir}>
        {[0, tope].map((v, i) => (
          <g key={i}>
            <line className="rejilla" x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={sy(v)} y2={sy(v)} />
            <text className="eje" x={MARGEN.izq - 5} y={sy(v) + 3} textAnchor="end">
              {num(v, v && v < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18].map((hh) => (
          <text key={hh} className="eje" x={sx(hh)} y={alto - 6} textAnchor="middle">
            {hh} h
          </text>
        ))}
        {horaActual !== undefined && (
          <rect className="hora-actual" x={MARGEN.izq + horaActual * paso} y={MARGEN.arr} width={paso} height={alto - MARGEN.arr - MARGEN.aba} />
        )}
        {series.map((s) =>
          barras ? (
            <g key={s.nombre} className={`${s.clase} relleno`}>
              {s.valores.map((v, hh) => {
                const y = sy(v);
                const base = sy(0);
                return v > 0 ? (
                  <rect key={hh} x={sx(hh) - paso / 2 + 1} y={y} width={paso - 2} height={Math.max(0.5, base - y)} rx={Math.min(2, (paso - 2) / 2)} />
                ) : null;
              })}
            </g>
          ) : (
            <path
              key={s.nombre}
              className={`${s.clase} trazo`}
              d={s.valores.map((v, hh) => `${hh ? "L" : "M"}${sx(hh).toFixed(1)},${sy(v).toFixed(1)}`).join("")}
            />
          ),
        )}
        {hVista !== null && (
          <g className="cursor">
            <line x1={sx(hVista)} x2={sx(hVista)} y1={MARGEN.arr} y2={alto - MARGEN.aba} />
            <text x={Math.min(sx(hVista) + 6, ANCHO - 150)} y={MARGEN.arr + 10}>
              {hVista}–{hVista + 1} h: {series.map((s) => `${num(s.valores[hVista], decimales)}`).join(" / ")} {unidad}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
