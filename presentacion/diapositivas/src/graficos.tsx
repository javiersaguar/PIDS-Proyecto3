// Gráficos en SVG con animación de entrada. En modo impresión (PDF) se dibujan ya terminados.
import { useEffect, useMemo, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Contador, Onda, SUAVE, azar, useEntrada, useEstatico } from "./animacion";
import type { Datos } from "./tipos";
import { num, pc } from "./tipos";

const escala = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const camino = (xs: number[], ys: number[]) => xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
const color = (c: string) => ({ "--c": c }) as CSSProperties;

// Punto a una fracción t de la longitud de una polilínea (para que la cabeza siga al trazo).
function puntoEn(xs: number[], ys: number[]) {
  const acum = [0];
  for (let i = 1; i < xs.length; i++) acum.push(acum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const total = acum.at(-1) || 1;
  return (t: number) => {
    const s = Math.min(Math.max(t, 0), 1) * total;
    let i = 1;
    while (i < acum.length - 1 && acum[i] < s) i++;
    const f = (s - acum[i - 1]) / (acum[i] - acum[i - 1] || 1);
    return { x: xs[i - 1] + f * (xs[i] - xs[i - 1]), y: ys[i - 1] + f * (ys[i] - ys[i - 1]) };
  };
}

// Línea que se dibuja con una punta luminosa delante; opcionalmente, con el área de debajo.
function Linea({ xs, ys, c, ancho = 5, retardo = 0, duracion = 1.6, base, brillo = true }: { xs: number[]; ys: number[]; c: string; ancho?: number; retardo?: number; duracion?: number; base?: number; brillo?: boolean }) {
  const estatico = useEstatico();
  const p = useMotionValue(estatico ? 1 : 0);
  useEffect(() => {
    if (estatico) return;
    const control = animate(p, 1, { duration: duracion, delay: retardo, ease: SUAVE });
    return () => control.stop();
  }, [estatico, p, duracion, retardo]);
  const en = useMemo(() => puntoEn(xs, ys), [xs, ys]);
  const cx = useTransform(p, (v) => en(v).x);
  const cy = useTransform(p, (v) => en(v).y);
  const opacidad = useTransform(p, [0, 0.02, 0.9, 1], [0, 1, 1, 0]);
  const area = useEntrada(retardo + duracion * 0.6, 1);
  const d = camino(xs, ys);
  const sombra = brillo ? { filter: `drop-shadow(0 0 10px ${c})` } : {};
  return (
    <g>
      {base !== undefined && <motion.path d={`${d}L${xs.at(-1)},${base}L${xs[0]},${base}Z`} fill={c} {...area({ fillOpacity: 0 }, { fillOpacity: 0.14 })} />}
      <motion.path d={d} fill="none" stroke={c} strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: p, ...sombra }} />
      {!estatico && <motion.circle cx={cx} cy={cy} r={ancho + 3} fill="#fff" style={{ opacity: opacidad, filter: `drop-shadow(0 0 12px ${c})` }} />}
    </g>
  );
}

function EjeX({ x, valores, y, texto, fmt = (v: number) => num(v) }: { x: (v: number) => number; valores: number[]; y: number; texto: string; fmt?: (v: number) => string }) {
  return (
    <motion.g className="eje" {...useEntrada(0.1, 0.6)({ opacity: 0 }, { opacity: 1 })}>
      {valores.map((v) => (
        <text key={v} x={x(v)} y={y + 34} textAnchor="middle">
          {fmt(v)}
        </text>
      ))}
      <text x={(x(valores[0]) + x(valores.at(-1)!)) / 2} y={y + 76} textAnchor="middle">
        {texto}
      </text>
    </motion.g>
  );
}

function EjeY({ y, valores, x0, x1, fmt = (v: number) => num(v) }: { y: (v: number) => number; valores: number[]; x0: number; x1: number; fmt?: (v: number) => string }) {
  const anim = useEntrada(0, 1);
  return (
    <g className="eje">
      {valores.map((v, i) => (
        <g key={v}>
          <motion.line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke="var(--rejilla)" {...anim({ pathLength: 0, opacity: 0 }, { pathLength: 1, opacity: 1 })} transition={{ delay: 0.05 * i, duration: 1, ease: SUAVE }} />
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
        <Linea xs={p.horas.map(x)} ys={p.fin_de_semana.map(y)} c="var(--naranja)" retardo={0.4} duracion={1.8} />
        <Linea xs={p.horas.map(x)} ys={p.laborable.map(y)} c="var(--azul)" retardo={0.8} duracion={1.8} base={H - abj} />
      </svg>
      <div className="leyenda">
        <span style={color("var(--azul)")}>Laborable</span>
        <span style={color("var(--naranja)")}>Fin de semana</span>
        <span>Viajes por hora y día, periodo de ajuste</span>
      </div>
    </div>
  );
}

// Embudo de la limpieza: barras horizontales con lo que queda tras cada regla.
export function Embudo({ e }: { e: Datos["embudo"] }) {
  const estatico = useEstatico();
  const filas = [{ texto: "Viajes del CSV", quedan: e.brutos, excluidos: 0 }, ...e.pasos.map((p) => ({ texto: p.descripcion.split(" (")[0], quedan: p.quedan, excluidos: p.excluidos }))];
  const W = 900, fila = 64, izq = 330;
  const x = escala(0, e.brutos, 0, W - izq - 170);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${filas.length * fila}`}>
        {filas.map((f, i) => {
          const ultima = i === filas.length - 1;
          const retardo = 0.3 + 0.12 * i;
          return (
            <g key={f.texto} transform={`translate(0 ${i * fila})`}>
              <motion.text className="rotulo" x={izq - 16} y={34} textAnchor="end" initial={estatico ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: retardo, duration: 0.6, ease: SUAVE }}>
                {f.texto}
              </motion.text>
              <motion.rect
                x={izq}
                y={10}
                height={40}
                rx={8}
                fill={ultima ? "url(#embudo-final)" : "var(--azul)"}
                fillOpacity={ultima ? 1 : 0.55 + 0.45 * (i / filas.length)}
                initial={estatico ? false : { width: 0 }}
                animate={{ width: x(f.quedan) }}
                transition={{ delay: retardo, type: "spring", stiffness: 60, damping: 16 }}
                style={ultima ? { filter: "drop-shadow(0 0 14px var(--cian))" } : undefined}
              />
              <motion.text className="rotulo-fuerte" x={izq + x(f.quedan) + 14} y={37} initial={estatico ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: retardo + 0.3 }}>
                <Contador texto={num(f.quedan)} retardo={retardo} duracion={1.2} svg />
                {f.excluidos > 0 && <tspan className="rotulo"> (−{num(f.excluidos)})</tspan>}
              </motion.text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="embudo-final" x1="0" x2="1">
            <stop offset="0" stopColor="var(--azul)" />
            <stop offset="1" stopColor="var(--cian)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const COLOR_RADIO: Record<number, string> = { 200: "var(--gris)", 250: "var(--naranja)", 300: "var(--azul)" };

// Frente de Pareto: estaciones frente a viajes cubiertos, una línea por radio.
export function Pareto({ redes, finalistas, elegida }: { redes: Datos["pareto"]; finalistas: Datos["finalistas"]; elegida: string }) {
  const estatico = useEstatico();
  const W = 1000, H = 600, izq = 90, der = 30, arr = 20, abj = 100;
  const x = escala(50, 450, izq, W - der);
  const y = escala(30, 100, H - abj, arr);
  const radios = [...new Set(redes.map((r) => r.radio))].sort();
  const sel = finalistas.find((f) => f.id === elegida);
  const rotulo = useEntrada(2, 0.6);
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <EjeY y={y} valores={[40, 60, 80, 100]} x0={izq} x1={W - der} fmt={(v) => `${v} %`} />
        <EjeX x={x} valores={[100, 200, 300, 400]} y={H - abj} texto="Estaciones de la red" />
        <motion.line x1={izq} x2={W - der} y1={y(80)} y2={y(80)} stroke="var(--naranja)" strokeWidth={2} strokeDasharray="8 8" {...useEntrada(0.3, 0.8)({ opacity: 0 }, { opacity: 1 })} />
        <text className="rotulo" x={W - der} y={y(80) + 30} textAnchor="end">
          Objetivo: 80 % de los viajes
        </text>
        {radios.map((r, i) => {
          // Envolvente: para cada número de estaciones, la mejor cobertura con ese número o menos.
          const pts = redes
            .filter((p) => p.radio === r && p.k >= 50 && p.k <= 450)
            .sort((a, b) => a.k - b.k || b.pct - a.pct)
            .filter((p, j, todas) => todas.slice(0, j).every((q) => q.pct < p.pct));
          return <Linea key={r} xs={pts.map((p) => x(p.k))} ys={pts.map((p) => y(p.pct))} c={COLOR_RADIO[r]} retardo={0.3 + 0.25 * i} brillo={r === 300} />;
        })}
        {finalistas
          .filter((f) => f.k >= 50 && f.k <= 450)
          .map((f, i) => (
            <motion.circle
              key={f.id}
              cx={x(f.k)}
              cy={y(f.pct)}
              fill={f.id === elegida ? "var(--cian)" : "var(--fondo)"}
              stroke={f.id === elegida ? "#fff" : "var(--azul-claro)"}
              strokeWidth={3}
              initial={estatico ? false : { r: 0 }}
              animate={{ r: f.id === elegida ? 14 : 9 }}
              transition={{ delay: 1.6 + 0.08 * i, type: "spring", stiffness: 300, damping: 12 }}
            />
          ))}
        {sel && (
          <>
            <Onda cx={x(sel.k)} cy={y(sel.pct)} r={14} color="var(--cian)" retardo={2} />
            <motion.text className="rotulo-fuerte" x={x(sel.k) + 26} y={y(sel.pct) - 22} {...rotulo({ opacity: 0 }, { opacity: 1 })}>
              Red elegida
            </motion.text>
          </>
        )}
      </svg>
      <div className="leyenda">
        {radios.map((r) => (
          <span key={r} style={color(COLOR_RADIO[r])}>
            {r} m
          </span>
        ))}
        <span>Círculos: redes finalistas</span>
      </div>
    </div>
  );
}

// Mapa esquemático de las estaciones (sin teselas, para que funcione sin red). Tres modos:
// «lineas», con las líneas de deseo y patinetes circulando; «anclajes», con el tamaño de cada
// estación; «fondo», la red tenue y en movimiento detrás de la portada.
export function MapaRed({ estaciones, lineas, modo, retardo = 0 }: { estaciones: Datos["estaciones"]; lineas: Datos["lineas"]; modo: "lineas" | "anclajes" | "fondo"; retardo?: number }) {
  const estatico = useEstatico();
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
  // Las estaciones aparecen en ola desde el centro de la red.
  const [cx, cy] = [px((x0 + x1) / 2), py((y0 + y1) / 2)];
  const dmax = Math.max(...estaciones.map((e) => Math.hypot(px(e.lon) - cx, py(e.lat) - cy)));
  const conLineas = modo !== "anclajes";
  const radio = (e: Datos["estaciones"][number]) => (modo === "anclajes" ? 2 + 1.6 * e.anclajes : modo === "fondo" ? 2.5 + 5 * Math.sqrt(e.salidas / smax) : 3 + 9 * Math.sqrt(e.salidas / smax));
  const viajeros = conLineas && !estatico ? lineas.slice(0, modo === "fondo" ? 90 : 70) : [];
  return (
    <div className={`figura mapa mapa-${modo}`}>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {conLineas &&
          [...lineas].reverse().map((l, i) => {
            const a = pos.get(l.o)!, b = pos.get(l.d)!;
            const f = l.n / nmax;
            return (
              <motion.line
                key={i}
                x1={px(a.lon)}
                y1={py(a.lat)}
                x2={px(b.lon)}
                y2={py(b.lat)}
                stroke="var(--azul)"
                strokeOpacity={0.15 + 0.6 * f}
                strokeWidth={1 + 6 * f}
                strokeLinecap="round"
                initial={estatico ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: retardo + 0.8 + 0.004 * i, duration: 1.2, ease: SUAVE }}
              />
            );
          })}
        {estaciones.map((e) => {
          const d = Math.hypot(px(e.lon) - cx, py(e.lat) - cy) / dmax;
          return (
            <motion.circle
              key={e.id}
              cx={px(e.lon)}
              cy={py(e.lat)}
              className="estacion"
              initial={estatico ? false : { r: 0, opacity: 0 }}
              animate={{ r: radio(e), opacity: 1 }}
              transition={{ delay: retardo + 0.1 + 0.7 * d, type: "spring", stiffness: 260, damping: 14 }}
            />
          );
        })}
        {viajeros.map((l, i) => {
          const a = pos.get(l.o)!, b = pos.get(l.d)!;
          const [ax, ay, bx, by] = [px(a.lon), py(a.lat), px(b.lon), py(b.lat)];
          const ida = azar(i) > 0.5;
          const [sx, sy, ex, ey] = ida ? [ax, ay, bx, by] : [bx, by, ax, ay];
          const tramo = (t: number) => [sx + t * (ex - sx), sy + t * (ey - sy)];
          const ks = [0, 0.12, 0.88, 1].map(tramo);
          return (
            <motion.circle
              key={`v${i}`}
              r={modo === "fondo" ? 3 : 4.5}
              className="patinete"
              initial={{ cx: sx, cy: sy, opacity: 0 }}
              animate={{ cx: ks.map((k) => k[0]), cy: ks.map((k) => k[1]), opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 1.6 + Math.hypot(ex - sx, ey - sy) / 160,
                delay: retardo + 1.8 + 4 * azar(i + 100),
                repeat: Infinity,
                repeatDelay: 1 + 3 * azar(i + 200),
                ease: "linear",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

const NOMBRES: Record<string, [string, string]> = {
  atendido: ["Atendidos", "var(--azul)"],
  sin_patinete: ["Sin patinete", "var(--naranja)"],
  sin_anclaje: ["Sin anclaje", "#ffb48a"],
  sin_cobertura: ["Sin estación a 300 m", "var(--gris)"],
};

// Barra apilada de las solicitudes del ajuste por resultado.
export function Conciliacion({ filas }: { filas: Datos["asignacion"]["conciliacion"] }) {
  const estatico = useEstatico();
  const total = filas.reduce((s, f) => s + f.viajes, 0);
  const W = 1680, H = 110, hueco = 6;
  let acumulado = 0;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", overflow: "visible" }}>
        {filas.map((f, i) => {
          const x = (acumulado / total) * W + (i ? hueco / 2 : 0);
          const w = Math.max((f.viajes / total) * W - hueco, 2);
          acumulado += f.viajes;
          return (
            <motion.rect
              key={f.resultado}
              x={x}
              y={0}
              height={H}
              rx={10}
              fill={NOMBRES[f.resultado][1]}
              initial={estatico ? false : { width: 0, opacity: 0 }}
              animate={{ width: w, opacity: 1 }}
              transition={{ delay: 0.3 + 0.35 * i, duration: 0.9, ease: SUAVE }}
              style={i === 0 ? { filter: "drop-shadow(0 0 18px var(--azul))" } : undefined}
            />
          );
        })}
      </svg>
      <div className="leyenda grande">
        {filas.map((f, i) => (
          <span key={f.resultado} style={color(NOMBRES[f.resultado][1])}>
            {NOMBRES[f.resultado][0]}:{" "}
            <strong>
              <Contador texto={num(f.viajes)} retardo={0.3 + 0.35 * i} />
            </strong>{" "}
            ({pc(f.pct)})
          </span>
        ))}
      </div>
    </div>
  );
}

// Curva de servicio frente a flota, con la flota mínima y el máximo marcados.
export function CurvaFlota({ f }: { f: Datos["flota"] }) {
  const W = 1000, H = 600, izq = 90, der = 30, arr = 40, abj = 100;
  const x = escala(150, 900, izq, W - der);
  const y = escala(40, 100, H - abj, arr);
  const base = f.curvas.find((c) => c.rebalanceo === f.rebalanceo)!.puntos;
  const sin = f.curvas.find((c) => c.rebalanceo === 0)!.puntos;
  const max = base.reduce((a, b) => (b.pct > a.pct ? b : a));
  const min = base.find((p) => p.flota === f.minima)!;
  const guia = useEntrada(2, 0.9);
  const marca = useEntrada(2.4, 0.5);
  const estatico = useEstatico();
  return (
    <div className="figura">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <EjeY y={y} valores={[40, 60, 80, 100]} x0={izq} x1={W - der} fmt={(v) => `${v} %`} />
        <EjeX x={x} valores={[200, 400, 600, 800]} y={H - abj} texto="Patinetes en la flota" />
        <motion.line x1={izq} x2={W - der} y1={y(f.objetivo)} y2={y(f.objetivo)} stroke="var(--naranja)" strokeWidth={2} strokeDasharray="8 8" {...useEntrada(0.3, 0.8)({ opacity: 0 }, { opacity: 1 })} />
        <Linea xs={sin.map((p) => x(p.flota))} ys={sin.map((p) => y(p.pct))} c="var(--gris)" retardo={0.3} brillo={false} />
        <Linea xs={base.map((p) => x(p.flota))} ys={base.map((p) => y(p.pct))} c="var(--azul)" retardo={0.6} duracion={1.8} />
        <motion.line x1={x(min.flota)} x2={x(min.flota)} y1={H - abj} y2={y(min.pct)} stroke="var(--naranja)" strokeWidth={2} strokeDasharray="4 6" {...guia({ opacity: 0 }, { opacity: 1 })} />
        <Onda cx={x(min.flota)} cy={y(min.pct)} r={11} color="var(--naranja)" retardo={2.4} />
        <motion.circle cx={x(min.flota)} cy={y(min.pct)} fill="var(--naranja)" stroke="#fff" strokeWidth={3} initial={estatico ? false : { r: 0 }} animate={{ r: 12 }} transition={{ delay: 2.2, type: "spring", stiffness: 320, damping: 11 }} />
        <motion.circle cx={x(max.flota)} cy={y(max.pct)} fill="var(--cian)" stroke="#fff" strokeWidth={3} initial={estatico ? false : { r: 0 }} animate={{ r: 10 }} transition={{ delay: 2.5, type: "spring", stiffness: 320, damping: 11 }} />
        <motion.g {...marca({ opacity: 0, y: 10 }, { opacity: 1, y: 0 })}>
          <text className="rotulo-fuerte" x={x(min.flota) - 20} y={y(min.pct) + 50} textAnchor="end">
            {num(min.flota)}: {pc(min.pct)}
          </text>
          <text className="rotulo-fuerte" x={x(max.flota) + 18} y={y(max.pct) - 22}>
            Máximo: {num(max.flota)}, {pc(max.pct)}
          </text>
        </motion.g>
      </svg>
      <div className="leyenda">
        <span style={color("var(--azul)")}>{f.rebalanceo} recolocaciones por noche</span>
        <span style={color("var(--gris)")}>Sin rebalanceo</span>
        <span style={color("var(--naranja)")}>Objetivo del {f.objetivo} %</span>
      </div>
    </div>
  );
}
