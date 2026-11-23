// Gráficos en SVG con animación de entrada. En modo impresión (PDF) se dibujan ya terminados.
import { createContext, useContext, type ReactNode } from "react";
import { motion } from "motion/react";
import type { Datos } from "./tipos";
import { num, pc } from "./tipos";

export const Estatico = createContext(false);

// Props de animación: en impresión, sin estado inicial (se pinta el final).
function useEntrada(retardo = 0, duracion = 0.8) {
  const estatico = useContext(Estatico);
  return (desde: Record<string, number>, hasta: Record<string, number>) =>
    estatico
      ? { initial: false as const, animate: hasta }
      : { initial: desde, animate: hasta, transition: { duration: duracion, delay: retardo, ease: [0.22, 1, 0.36, 1] as const } };
}

export function Aparece({ children, retardo = 0, className, style }: { children: ReactNode; retardo?: number; className?: string; style?: React.CSSProperties }) {
  const anim = useEntrada(retardo, 0.6);
  return (
    <motion.div className={className} style={style} {...anim({ opacity: 0, y: 24 }, { opacity: 1, y: 0 })}>
      {children}
    </motion.div>
  );
}

const escala = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const camino = (xs: number[], ys: number[]) => xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");

function Linea({ d, color, ancho = 4, retardo = 0, discontinua = false }: { d: string; color: string; ancho?: number; retardo?: number; discontinua?: boolean }) {
  const anim = useEntrada(retardo, 1.4);
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={ancho}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={discontinua ? "10 10" : undefined}
      {...(discontinua ? anim({ opacity: 0 }, { opacity: 1 }) : anim({ pathLength: 0 }, { pathLength: 1 }))}
    />
  );
}

function EjeX({ x, valores, y, texto, fmt = (v: number) => num(v) }: { x: (v: number) => number; valores: number[]; y: number; texto: string; fmt?: (v: number) => string }) {
  return (
    <g className="eje">
      {valores.map((v) => (
        <text key={v} x={x(v)} y={y + 32} textAnchor="middle">
          {fmt(v)}
        </text>
      ))}
      <text x={(x(valores[0]) + x(valores.at(-1)!)) / 2} y={y + 72} textAnchor="middle">
        {texto}
      </text>
    </g>
  );
}

function EjeY({ y, valores, x0, x1, fmt = (v: number) => num(v) }: { y: (v: number) => number; valores: number[]; x0: number; x1: number; fmt?: (v: number) => string }) {
  return (
    <g className="eje">
      {valores.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke="#e3e9ef" />
          <text x={x0 - 14} y={y(v) + 7} textAnchor="end">
            {fmt(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

// Viajes por hora de salida, laborable frente a fin de semana.
export function PerfilHorario({ p }: { p: Datos["perfil"] }) {
  const W = 900, H = 520, izq = 80, der = 20, arr = 20, abj = 90;
  const ymax = Math.ceil(Math.max(...p.laborable, ...p.fin_de_semana) / 20) * 20;
  const x = escala(0, 23, izq, W - der);
  const y = escala(0, ymax, H - abj, arr);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <EjeY y={y} valores={[0, 20, 40, 60, 80, 100].filter((v) => v <= ymax)} x0={izq} x1={W - der} />
        <EjeX x={x} valores={[0, 6, 12, 18, 23]} y={H - abj} texto="Hora de salida" fmt={(v) => `${v} h`} />
        <Linea d={camino(p.horas.map(x), p.fin_de_semana.map(y))} color="var(--naranja)" />
        <Linea d={camino(p.horas.map(x), p.laborable.map(y))} color="var(--azul)" retardo={0.3} />
      </svg>
      <div className="leyenda">
        <span style={{ "--c": "var(--azul)" } as React.CSSProperties}>Laborable</span>
        <span style={{ "--c": "var(--naranja)" } as React.CSSProperties}>Fin de semana</span>
        <span>Viajes por hora y día, periodo de ajuste</span>
      </div>
    </div>
  );
}

// Embudo de la limpieza: barras horizontales con lo que queda tras cada regla.
export function Embudo({ e }: { e: Datos["embudo"] }) {
  const anim = useEntrada(0.2, 0.9);
  const filas = [{ texto: "Viajes del CSV", quedan: e.brutos, excluidos: 0 }, ...e.pasos.map((p) => ({ texto: p.descripcion.split(" (")[0], quedan: p.quedan, excluidos: p.excluidos }))];
  const W = 900, fila = 64, izq = 330;
  const x = escala(0, e.brutos, 0, W - izq - 150);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${filas.length * fila}`}>
        {filas.map((f, i) => (
          <g key={f.texto} transform={`translate(0 ${i * fila})`}>
            <text className="rotulo" x={izq - 16} y={34} textAnchor="end">
              {f.texto}
            </text>
            <motion.rect x={izq} y={10} height={40} rx={6} fill={i === filas.length - 1 ? "var(--azul-oscuro)" : "var(--azul)"} {...anim({ width: 0 }, { width: x(f.quedan) })} />
            <text className="rotulo-fuerte" x={izq + x(f.quedan) + 12} y={37}>
              {num(f.quedan)}
              {f.excluidos > 0 && <tspan className="rotulo"> (−{num(f.excluidos)})</tspan>}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const COLOR_RADIO: Record<number, string> = { 200: "var(--gris)", 250: "var(--naranja)", 300: "var(--azul)" };

// Frente de Pareto: estaciones frente a viajes cubiertos, una línea por radio.
export function Pareto({ redes, finalistas, elegida }: { redes: Datos["pareto"]; finalistas: Datos["finalistas"]; elegida: string }) {
  const W = 1000, H = 600, izq = 90, der = 30, arr = 20, abj = 100;
  const x = escala(50, 450, izq, W - der);
  const y = escala(30, 100, H - abj, arr);
  const radios = [...new Set(redes.map((r) => r.radio))].sort();
  const anim = useEntrada(1.2, 0.5);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <EjeY y={y} valores={[40, 60, 80, 100]} x0={izq} x1={W - der} fmt={(v) => `${v} %`} />
        <EjeX x={x} valores={[100, 200, 300, 400]} y={H - abj} texto="Estaciones de la red" />
        <line x1={izq} x2={W - der} y1={y(80)} y2={y(80)} stroke="var(--naranja)" strokeWidth={2} strokeDasharray="8 8" />
        <text className="rotulo" x={W - der} y={y(80) + 30} textAnchor="end">
          Objetivo: 80 % de los viajes
        </text>
        {radios.map((r, i) => {
          // Envolvente: para cada número de estaciones, la mejor cobertura con ese número o menos.
          const pts = redes
            .filter((p) => p.radio === r && p.k >= 50 && p.k <= 450)
            .sort((a, b) => a.k - b.k || b.pct - a.pct)
            .filter((p, j, todas) => todas.slice(0, j).every((q) => q.pct < p.pct));
          return <Linea key={r} d={camino(pts.map((p) => x(p.k)), pts.map((p) => y(p.pct)))} color={COLOR_RADIO[r]} retardo={0.2 * i} />;
        })}
        {finalistas
          .filter((f) => f.k >= 50 && f.k <= 450)
          .map((f) => (
            <motion.g key={f.id} {...anim({ opacity: 0 }, { opacity: 1 })}>
              <circle cx={x(f.k)} cy={y(f.pct)} r={f.id === elegida ? 14 : 9} fill={f.id === elegida ? "var(--azul-oscuro)" : "#fff"} stroke="var(--azul-oscuro)" strokeWidth={3} />
            </motion.g>
          ))}
      </svg>
      <div className="leyenda">
        {radios.map((r) => (
          <span key={r} style={{ "--c": COLOR_RADIO[r] } as React.CSSProperties}>
            {r} m
          </span>
        ))}
        <span>Círculo relleno: red elegida</span>
      </div>
    </div>
  );
}

// Mapa esquemático de las estaciones (sin teselas, para que funcione sin red) con las líneas de deseo.
export function MapaRed({ estaciones, lineas, conLineas }: { estaciones: Datos["estaciones"]; lineas: Datos["lineas"]; conLineas: boolean }) {
  const lon = estaciones.map((e) => e.lon), lat = estaciones.map((e) => e.lat);
  const kx = Math.cos((41.89 * Math.PI) / 180);
  const [x0, x1, y0, y1] = [Math.min(...lon), Math.max(...lon), Math.min(...lat), Math.max(...lat)];
  const W = 900, margen = 30;
  const esc = (W - 2 * margen) / ((x1 - x0) * kx);
  const H = (y1 - y0) * esc + 2 * margen;
  const px = (l: number) => margen + (l - x0) * kx * esc;
  const py = (l: number) => margen + (y1 - l) * esc;
  const pos = new Map(estaciones.map((e) => [e.id, e]));
  const nmax = Math.max(...lineas.map((l) => l.n));
  const smax = Math.max(...estaciones.map((e) => e.salidas));
  const animL = useEntrada(0.6, 1.2);
  const animP = useEntrada(0, 0.5);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {conLineas &&
          [...lineas].reverse().map((l, i) => {
            const a = pos.get(l.o)!, b = pos.get(l.d)!;
            const f = l.n / nmax;
            return (
              <motion.line key={i} x1={px(a.lon)} y1={py(a.lat)} x2={px(b.lon)} y2={py(b.lat)} stroke="var(--azul)" strokeOpacity={0.2 + 0.7 * f} strokeWidth={1 + 7 * f} strokeLinecap="round"
                {...animL({ pathLength: 0 }, { pathLength: 1 })} />
            );
          })}
        {estaciones.map((e) => (
          <motion.circle key={e.id} cx={px(e.lon)} cy={py(e.lat)} fill="var(--azul-oscuro)" fillOpacity={0.85}
            {...animP({ r: 0 }, { r: conLineas ? 3 + 9 * Math.sqrt(e.salidas / smax) : 2 + 1.6 * e.anclajes })} />
        ))}
      </svg>
    </div>
  );
}

const NOMBRES: Record<string, [string, string]> = {
  atendido: ["Atendidos", "var(--azul)"],
  sin_patinete: ["Sin patinete", "var(--naranja)"],
  sin_anclaje: ["Sin anclaje", "#f3a57f"],
  sin_cobertura: ["Sin estación a 300 m", "var(--gris)"],
};

// Barra apilada de las solicitudes del ajuste por resultado.
export function Conciliacion({ filas }: { filas: Datos["asignacion"]["conciliacion"] }) {
  const total = filas.reduce((s, f) => s + f.viajes, 0);
  const W = 1680, H = 90;
  let acumulado = 0;
  const anim = useEntrada(0.2, 1);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
        {filas.map((f, i) => {
          const x = (acumulado / total) * W;
          const w = (f.viajes / total) * W;
          acumulado += f.viajes;
          return <motion.rect key={f.resultado} x={x} y={0} height={H} fill={NOMBRES[f.resultado][1]} {...anim({ width: 0 }, { width: w })} transition={{ delay: 0.2 + 0.25 * i, duration: 0.6 }} />;
        })}
      </svg>
      <div className="leyenda" style={{ fontSize: 24 }}>
        {filas.map((f) => (
          <span key={f.resultado} style={{ "--c": NOMBRES[f.resultado][1] } as React.CSSProperties}>
            {NOMBRES[f.resultado][0]}: <strong style={{ color: "var(--tinta)" }}>{num(f.viajes)}</strong> ({pc(f.pct)})
          </span>
        ))}
      </div>
    </div>
  );
}

// Curva de servicio frente a flota, con la flota mínima y el máximo marcados.
export function CurvaFlota({ f }: { f: Datos["flota"] }) {
  const W = 1000, H = 600, izq = 90, der = 30, arr = 30, abj = 100;
  const x = escala(150, 900, izq, W - der);
  const y = escala(40, 100, H - abj, arr);
  const base = f.curvas.find((c) => c.rebalanceo === f.rebalanceo)!.puntos;
  const sin = f.curvas.find((c) => c.rebalanceo === 0)!.puntos;
  const max = base.reduce((a, b) => (b.pct > a.pct ? b : a));
  const min = base.find((p) => p.flota === f.minima)!;
  const anim = useEntrada(1.4, 0.5);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <EjeY y={y} valores={[40, 60, 80, 100]} x0={izq} x1={W - der} fmt={(v) => `${v} %`} />
        <EjeX x={x} valores={[200, 400, 600, 800]} y={H - abj} texto="Patinetes en la flota" />
        <line x1={izq} x2={W - der} y1={y(f.objetivo)} y2={y(f.objetivo)} stroke="var(--naranja)" strokeWidth={2} strokeDasharray="8 8" />
        <Linea d={camino(sin.map((p) => x(p.flota)), sin.map((p) => y(p.pct)))} color="var(--gris)" />
        <Linea d={camino(base.map((p) => x(p.flota)), base.map((p) => y(p.pct)))} color="var(--azul)" retardo={0.3} />
        <motion.g {...anim({ opacity: 0 }, { opacity: 1 })}>
          <circle cx={x(min.flota)} cy={y(min.pct)} r={11} fill="var(--naranja)" stroke="#fff" strokeWidth={3} />
          <text className="rotulo-fuerte" x={x(min.flota) - 18} y={y(min.pct) + 46} textAnchor="end">
            {num(min.flota)}: {pc(min.pct)}
          </text>
          <circle cx={x(max.flota)} cy={y(max.pct)} r={11} fill="var(--azul-oscuro)" stroke="#fff" strokeWidth={3} />
          <text className="rotulo-fuerte" x={x(max.flota) + 18} y={y(max.pct) - 18}>
            Máximo: {num(max.flota)}, {pc(max.pct)}
          </text>
        </motion.g>
      </svg>
      <div className="leyenda">
        <span style={{ "--c": "var(--azul)" } as React.CSSProperties}>{f.rebalanceo} recolocaciones por noche</span>
        <span style={{ "--c": "var(--gris)" } as React.CSSProperties}>Sin rebalanceo</span>
        <span style={{ "--c": "var(--naranja)" } as React.CSSProperties}>Objetivo del {f.objetivo} %</span>
      </div>
    </div>
  );
}
