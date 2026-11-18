import { useEffect, useRef, useState } from "react";
import type { Data, Layout, PlotMouseEvent } from "plotly.js-dist-min";
import { CONFIG, capa } from "../graficas";

type Plotly = typeof import("plotly.js-dist-min").default;
let carga: Promise<Plotly> | null = null;
// Plotly pesa unos 4 MB: se descarga una sola vez y solo cuando hay una gráfica en pantalla.
const cargarPlotly = () => (carga ??= import("plotly.js-dist-min").then((m) => m.default));

type Props = {
  trazas: Data[];
  capa?: Partial<Layout>;
  alto?: number;
  descripcion: string;
  alClic?: (evento: PlotMouseEvent) => void;
};

type ElementoPlotly = HTMLDivElement & {
  on: (evento: string, f: (e: PlotMouseEvent) => void) => void;
  removeAllListeners?: (evento: string) => void;
};

export function Grafica({ trazas, capa: propia, alto = 380, descripcion, alClic }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [lista, setLista] = useState(false);
  const clic = useRef(alClic);
  useEffect(() => {
    clic.current = alClic;
  });

  useEffect(() => {
    let vigente = true;
    cargarPlotly().then(async (Plotly) => {
      const el = ref.current;
      if (!vigente || !el) return;
      await Plotly.react(el, trazas, { ...capa(propia), height: alto, autosize: true }, CONFIG);
      if (!vigente) return;
      setLista(true);
      const g = el as ElementoPlotly;
      g.removeAllListeners?.("plotly_click");
      g.on("plotly_click", (e) => clic.current?.(e));
    });
    return () => {
      vigente = false;
    };
  }, [trazas, propia, alto]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) cargarPlotly().then((Plotly) => Plotly.purge(el));
    };
  }, []);

  return (
    <div className="grafica" style={{ minHeight: alto }} role="figure" aria-label={descripcion}>
      {!lista && <div className="grafica-cargando">Cargando gráfica…</div>}
      <div ref={ref} />
    </div>
  );
}
